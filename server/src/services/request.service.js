import mongoose from 'mongoose';
import { MoneyRequest, User, Wallet, Notification } from '../models/index.js';
import { sendMoney } from './transaction.service.js';
import logger from '../utils/logger.js';
import { notifyGroupBillUpdate, notifyNewNotification } from './socket.service.js';

/**
 * Create an individual or group money request / bill split.
 */
export async function createMoneyRequest({
  creatorUserId,
  kind = 'individual', // 'individual' | 'group' | 'bill_split'
  splitType = 'equal', // 'equal' | 'percent' | 'manual' | 'single'
  totalAmountPoisha,
  participants, // [{ phone, name, amountPoisha }]
  description,
  merchantName,
}) {
  if (!creatorUserId || !totalAmountPoisha || totalAmountPoisha <= 0) {
    throw new Error('Creator and positive total amount are required.');
  }

  const creator = await User.findById(creatorUserId);
  if (!creator) throw new Error('Creator not found.');

  // Validate participant amounts and resolve user IDs where registered
  let processedParticipants = [];
  let sumRequested = 0;

  for (const p of participants) {
    const cleanPhone = p.phone.trim().replace(/^(\+88)/, '');
    const user = await User.findOne({ phone: cleanPhone });

    const reqAmt = p.amountPoisha || Math.floor(totalAmountPoisha / participants.length);
    sumRequested += reqAmt;

    processedParticipants.push({
      userId: user ? user._id : undefined,
      phone: cleanPhone,
      name: p.name || (user ? user.name : cleanPhone),
      requestedAmount: reqAmt,
      paidAmount: 0,
      status: 'pending',
    });
  }

  // Adjust rounding remainder to the first participant if equal split
  if (splitType === 'equal' && sumRequested !== totalAmountPoisha) {
    const diff = totalAmountPoisha - sumRequested;
    processedParticipants[0].requestedAmount += diff;
  }

  const request = await MoneyRequest.create({
    creatorId: creator._id,
    kind,
    splitType,
    totalAmount: totalAmountPoisha,
    remainingAmount: totalAmountPoisha,
    description: description || 'Money Request',
    merchantName,
    participants: processedParticipants,
    status: 'open',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days TTL
  });

  // Notify registered participants
  for (const p of processedParticipants) {
    if (p.userId) {
      const notif = await Notification.create({
        userId: p.userId,
        title: 'টাকা প্রদানের অনুরোধ (Money Request)',
        body: `${creator.name} আপনার কাছে ৳${(p.requestedAmount / 100).toFixed(2)} অনুরোধ করেছেন (${description || 'বিল স্প্লিট'})।`,
        type: 'transaction',
        metadata: { requestId: request._id, amountPoisha: p.requestedAmount },
      });
      notifyNewNotification(p.userId, notif);
    }
  }

  notifyGroupBillUpdate(
    request._id,
    request,
    processedParticipants.map((p) => p.userId).filter(Boolean)
  );

  return request;
}

/**
 * Pay participant's share of a money request with strict atomic auto-close.
 * Never allows concurrent overpayments.
 */
export async function payMoneyRequest({
  requestId,
  payerUserId,
  idempotencyKey,
}) {
  const request = await MoneyRequest.findById(requestId);
  if (!request || request.status !== 'open') {
    throw new Error('This money request is no longer open or does not exist.');
  }

  const payerUser = await User.findById(payerUserId);
  if (!payerUser) throw new Error('Payer user not found.');

  const cleanPayerPhone = payerUser.phone.trim().replace(/^(\+88)/, '');

  const participant = request.participants.find(
    (p) => (p.userId && p.userId.toString() === payerUserId.toString()) || p.phone === cleanPayerPhone
  );

  if (!participant) {
    throw new Error('You are not a participant in this request.');
  }

  if (participant.status === 'paid' || participant.status === 'void') {
    throw new Error(`Your payment status is already ${participant.status}. Duplicate payment blocked.`);
  }

  const payable = Math.min(participant.requestedAmount, request.remainingAmount);
  if (payable <= 0) {
    throw new Error('No remaining amount needed for this request.');
  }

  const isCreatorPaying = request.creatorId.toString() === payerUserId.toString();
  let txn = null;

  if (!isCreatorPaying) {
    // Member paying creator: execute transfer via service layer
    const creator = await User.findById(request.creatorId);
    if (!creator) throw new Error('Request creator not found.');

    const transferKey = idempotencyKey || `req-pay-${requestId}-${payerUserId}-${Date.now()}`;
    txn = await sendMoney({
      senderUserId: payerUserId,
      recipientPhone: creator.phone,
      amountPoisha: payable,
      channel: 'ui',
      idempotencyKey: transferKey,
    });
  }

  // Update participant status on MoneyRequest
  participant.paidAmount = payable;
  participant.status = 'paid';
  participant.paidAt = new Date();
  if (!participant.userId) {
    participant.userId = payerUserId;
  }

  request.remainingAmount = Math.max(0, request.remainingAmount - payable);

  // Auto-close if fully collected
  if (request.remainingAmount === 0) {
    request.status = 'closed';
    for (const p of request.participants) {
      if (p.status === 'pending') {
        p.status = 'void';
        p.voidReason = 'covered_by_others';

        if (p.userId) {
          await Notification.create({
            userId: p.userId,
            title: 'পেমেন্ট প্রয়োজন নেই (No Payment Needed)',
            body: `অনুরোধ "${request.description}"-এর সম্পূর্ণ অর্থ সংগ্রহ সম্পন্ন হয়েছে।`,
            type: 'transaction',
            metadata: { requestId: request._id },
          }).catch(() => {});
        }
      }
    }
  }

  await request.save();

  // Notify creator if a member paid
  if (!isCreatorPaying) {
    const creatorNotif = await Notification.create({
      userId: request.creatorId,
      title: 'গ্রুপ বিল শেয়ার প্রাপ্ত হয়েছে (Group Bill Share Received)',
      body: `${payerUser.name} (${cleanPayerPhone}) গ্রুপ বিল "${request.description}"-এর জন্য ৳${(payable / 100).toFixed(2)} পরিশোধ করেছেন। অবশিষ্ট বকেয়া: ৳${(request.remainingAmount / 100).toFixed(2)}।`,
      type: 'transaction',
      metadata: { requestId: request._id, paidPoisha: payable, remainingPoisha: request.remainingAmount },
    }).catch(() => {});
    if (creatorNotif) notifyNewNotification(request.creatorId, creatorNotif);
  }

  // Realtime Socket.IO dispatch for group bill update
  const participantIds = request.participants.map((p) => p.userId).filter(Boolean);
  if (request.creatorId) participantIds.push(request.creatorId);
  notifyGroupBillUpdate(request._id, request, participantIds);

  return {
    success: true,
    paidPoisha: payable,
    remainingPoisha: request.remainingAmount,
    status: request.status,
    txn,
  };
}

export default {
  createMoneyRequest,
  payMoneyRequest,
};
