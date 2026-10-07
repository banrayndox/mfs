import mongoose from 'mongoose';
import { User, Wallet, Transaction, AuditLog, Notification } from '../models/index.js';
import { executeLedgerTransfer, executeLedgerDebit, executeLedgerCredit } from './ledger.service.js';
import { evaluateGuardianPolicy } from './guardian.service.js';
import { createAiTipForTransaction } from './aiTip.service.js';
import { eventBus } from './eventBus.js';
import logger from '../utils/logger.js';
import { notifyWalletUpdate, notifyNewNotification, notifyGuardianApprovalRequired } from './socket.service.js';

/**
 * Send Money (Wallet -> Wallet)
 */
export async function sendMoney({
  senderUserId,
  recipientPhone,
  amountPoisha,
  channel = 'ui',
  idempotencyKey,
}) {
  if (!senderUserId || !recipientPhone || !amountPoisha || amountPoisha <= 0) {
    throw new Error('Valid sender, recipient phone, and positive amount are required.');
  }

  const cleanRecipientPhone = recipientPhone.trim().replace(/^(\+88)/, '');

  // 1. Idempotency Check
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey });
    if (existing) {
      logger.info({ idempotencyKey, txnId: existing._id }, 'Idempotent replay detected for sendMoney.');
      return existing;
    }
  }

  const sender = await User.findById(senderUserId);
  if (!sender || sender.status !== 'active') {
    throw new Error('Sender account is not active.');
  }

  if (sender.phone === cleanRecipientPhone) {
    throw new Error('Cannot send money to your own number.');
  }

  const recipient = await User.findOne({ phone: cleanRecipientPhone, status: 'active' });
  if (!recipient) {
    throw new Error(`Recipient with phone ${cleanRecipientPhone} is not registered in Guardian MFS.`);
  }

  const senderWallet = await Wallet.findOne({ userId: sender._id, type: { $in: ['primary', 'agent'] } });
  const recipientWallet = await Wallet.findOne({ userId: recipient._id, type: { $in: ['primary', 'agent'] } });

  if (!senderWallet || !recipientWallet) {
    throw new Error('Active wallet could not be resolved for sender or recipient.');
  }

  // Send Money Fee: ৳5 (500 poisha) flat fee above ৳1,000, 0 otherwise
  const feePoisha = amountPoisha > 100000 ? 500 : 0;
  const totalPoisha = amountPoisha + feePoisha;

  if (senderWallet.balance < totalPoisha) {
    throw new Error(`Insufficient wallet balance. Available: ৳${(senderWallet.balance / 100).toFixed(2)}, Required: ৳${(totalPoisha / 100).toFixed(2)}`);
  }

  // 2. Policy evaluation (Guardian mode / Child protection)
  const policy = await evaluateGuardianPolicy({
    userId: sender._id,
    amountPoisha,
    recipientPhone: cleanRecipientPhone,
  });

  if (policy.decision === 'cooling_off') {
    throw new Error('Unusually high risk detected. 10-minute security cooling-off period initiated.');
  }

  if (policy.decision === 'block') {
    throw new Error(policy.reason || 'Guardian limit exceeded');
  }

  if (policy.decision === 'hold') {
    const key = idempotencyKey || `send-${sender._id}-${Date.now()}`;
    const [txn] = await Transaction.create([
      {
        senderWalletId: senderWallet._id,
        recipientWalletId: recipientWallet._id,
        senderUserId: sender._id,
        recipientUserId: recipient._id,
        type: 'send',
        channel,
        amount: amountPoisha,
        fee: feePoisha,
        total: totalPoisha,
        status: 'awaiting_guardian',
        risk: {
          score: 0.5,
          decision: 'hold',
          reasons: [{ code: 'GUARDIAN_HOLD', descriptionBn: policy.reason, descriptionEn: policy.reason }],
        },
        idempotencyKey: key,
        metadata: {
          senderPhone: sender.phone,
          recipientPhone: recipient.phone,
          recipientName: recipient.name,
          guardianId: policy.guardianId,
          isChild: policy.isChild,
          holdReason: policy.reason,
        },
      },
    ]);

    if (policy.guardianId) {
      const [guardianNotif] = await Notification.create([
        {
          userId: policy.guardianId,
          title: 'অভিভাবক অনুমোদন প্রয়োজন (Guardian Approval Required)',
          body: `${sender.name} (${sender.phone}) ৳${(amountPoisha / 100).toFixed(2)} পাঠানোর অনুমোদনের আবেদন করেছেন। কারণ: ${policy.reason}`,
          type: 'guardian_request',
          metadata: { txnId: txn._id, amountPoisha, senderUserId: sender._id },
        },
      ]);
      notifyGuardianApprovalRequired(policy.guardianId, {
        txnId: txn._id,
        amountPoisha,
        senderUserId: sender._id,
        senderName: sender.name,
        senderPhone: sender.phone,
        recipientPhone,
        reason: policy.reason,
      });
      notifyNewNotification(policy.guardianId, guardianNotif);
    }

    const [childNotif] = await Notification.create([
      {
        userId: sender._id,
        title: 'অভিভাবকের অনুমোদনের অপেক্ষায় (Awaiting Guardian Approval)',
        body: `আপনার ৳${(amountPoisha / 100).toFixed(2)} পাঠানোর আবেদনটি অভিভাবকের অনুমোদনের অপেক্ষায় জমা হয়েছে।`,
        type: 'transaction',
        metadata: { txnId: txn._id, status: 'awaiting_guardian' },
      },
    ]);
    notifyNewNotification(sender._id, childNotif);

    return txn;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const key = idempotencyKey || `send-${sender._id}-${Date.now()}`;

    // 1. Create Transaction record
    const [txn] = await Transaction.create(
      [
        {
          senderWalletId: senderWallet._id,
          recipientWalletId: recipientWallet._id,
          senderUserId: sender._id,
          recipientUserId: recipient._id,
          type: 'send',
          channel,
          amount: amountPoisha,
          fee: feePoisha,
          total: totalPoisha,
          status: 'settled',
          idempotencyKey: key,
          metadata: {
            senderPhone: sender.phone,
            senderName: sender.name,
            recipientPhone: recipient.phone,
            recipientName: recipient.name,
          },
        },
      ],
      { session }
    );

    // 2. Execute atomic double-entry ledger mutation
    const { senderBalanceAfter, recipientBalanceAfter } = await executeLedgerTransfer({
      txnId: txn._id,
      senderWalletId: senderWallet._id,
      recipientWalletId: recipientWallet._id,
      amountPoisha,
      feePoisha,
      session,
    });

    // 3. Create notifications for both parties
    const notifs = await Notification.create(
      [
        {
          userId: sender._id,
          title: 'টাকা পাঠানো সফল (Money Sent)',
          body: `${recipient.name}-কে ৳${(amountPoisha / 100).toFixed(2)} সফলভাবে পাঠানো হয়েছে।`,
          type: 'transaction',
          metadata: { txnId: txn._id, balanceAfter: senderBalanceAfter },
        },
        {
          userId: recipient._id,
          title: 'টাকা গ্রহণ (Money Received)',
          body: `${sender.name} (${sender.phone}) থেকে ৳${(amountPoisha / 100).toFixed(2)} প্রাপ্ত হয়েছে।`,
          type: 'transaction',
          metadata: { txnId: txn._id, balanceAfter: recipientBalanceAfter },
        },
        ...(policy.notifyGuardian && policy.guardianId
          ? [
              {
                userId: policy.guardianId,
                title: 'সন্তানের লেনদেন আপডেট (Child Activity Update)',
                body: `${sender.name}-এর ওয়ালেট থেকে ৳${(amountPoisha / 100).toFixed(2)} পাঠানো হয়েছে (${recipient.name})।`,
                type: 'transaction',
                metadata: { txnId: txn._id, childUserId: sender._id },
              },
            ]
          : []),
      ],
      { session, ordered: true }
    );

    // 4. Audit Log
    await AuditLog.create(
      [
        {
          userId: sender._id,
          action: 'SEND_MONEY_SETTLED',
          actorType: channel === 'agent' ? 'agent_ai' : 'user',
          status: 'success',
          details: {
            txnId: txn._id,
            recipientPhone: recipient.phone,
            amountPoisha,
            feePoisha,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    logger.info({ txnId: txn._id, amountPoisha }, 'Send Money settled successfully.');

    // Realtime Socket.IO dispatch
    notifyWalletUpdate(sender._id, { balancePoisha: senderBalanceAfter, transaction: txn });
    notifyWalletUpdate(recipient._id, { balancePoisha: recipientBalanceAfter, transaction: txn });
    if (notifs[0]) notifyNewNotification(sender._id, notifs[0]);
    if (notifs[1]) notifyNewNotification(recipient._id, notifs[1]);
    if (notifs[2] && policy.guardianId) notifyNewNotification(policy.guardianId, notifs[2]);

    // 5. Emit events for reactive architecture (rule engine & AI tips)
    eventBus.emit('transaction.settled', txn);
    eventBus.emit('wallet.credit', {
      userId: recipient._id,
      walletId: recipientWallet._id,
      amountPoisha,
      senderPhone: sender.phone,
    });

    // Asynchronous AI Tip creation (never blocks money settlement)
    setImmediate(() => {
      createAiTipForTransaction(txn._id).catch((err) =>
        logger.error({ err, txnId: txn._id }, 'Background AI tip failed')
      );
    });

    return txn;
  } catch (err) {
    await session.abortTransaction();
    logger.error({ err, senderId: senderUserId }, 'Send Money failed atomically');
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Cash Out (Customer Wallet -> Agent Settlement)
 */
export async function cashOut({
  customerUserId,
  agentIdentifier,
  amountPoisha,
  channel = 'ui',
  idempotencyKey,
}) {
  if (!customerUserId || !agentIdentifier || !amountPoisha || amountPoisha <= 0) {
    throw new Error('Customer, agent identifier, and valid amount are required.');
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey });
    if (existing) return existing;
  }

  const customer = await User.findById(customerUserId);
  if (!customer || customer.status !== 'active') throw new Error('Customer account is not active.');

  // Find active agent by agentId or phone
  const agentQuery = agentIdentifier.startsWith('AGT-')
    ? { 'agentProfile.agentId': agentIdentifier }
    : { phone: agentIdentifier.replace(/^(\+88)/, '') };

  const agent = await User.findOne({
    ...agentQuery,
    accountType: 'AGENT',
    status: 'active',
    'agentProfile.status': 'active',
  });

  if (!agent) {
    throw new Error('Selected Agent is not active or does not exist.');
  }

  const customerWallet = await Wallet.findOne({ userId: customer._id, type: 'primary' });
  const agentWallet = await Wallet.findOne({ userId: agent._id, type: 'agent' });

  if (!customerWallet || !agentWallet) {
    throw new Error('Could not find active wallet for customer or agent.');
  }

  // Standard Cash-Out Fee: 1.5% (150 poisha per ৳100 / ৳15 per ৳1000)
  const feePoisha = Math.round(amountPoisha * 0.015);
  const totalDebit = amountPoisha + feePoisha;

  if (customerWallet.balance < totalDebit) {
    throw new Error(`Insufficient balance for cash out. Amount: ৳${(amountPoisha / 100).toFixed(2)}, Fee: ৳${(feePoisha / 100).toFixed(2)}, Total: ৳${(totalDebit / 100).toFixed(2)}`);
  }

  // Policy evaluation (Guardian mode / Child protection)
  const policy = await evaluateGuardianPolicy({
    userId: customer._id,
    amountPoisha,
    recipientPhone: agent.phone,
  });

  if (policy.decision === 'cooling_off') {
    throw new Error('Unusually high risk detected. 10-minute security cooling-off period initiated.');
  }

  if (policy.decision === 'block') {
    throw new Error(policy.reason || 'Guardian limit exceeded');
  }

  if (policy.decision === 'hold') {
    const key = idempotencyKey || `cashout-${customer._id}-${Date.now()}`;
    const [txn] = await Transaction.create([
      {
        senderWalletId: customerWallet._id,
        recipientWalletId: agentWallet._id,
        senderUserId: customer._id,
        recipientUserId: agent._id,
        type: 'cash_out',
        channel,
        amount: amountPoisha,
        fee: feePoisha,
        total: totalDebit,
        status: 'awaiting_guardian',
        risk: {
          score: 0.5,
          decision: 'hold',
          reasons: [{ code: 'GUARDIAN_HOLD', descriptionBn: policy.reason, descriptionEn: policy.reason }],
        },
        idempotencyKey: key,
        metadata: {
          agentId: agent.agentProfile?.agentId,
          agentName: agent.agentProfile?.businessName || agent.name,
          agentPhone: agent.phone,
          guardianId: policy.guardianId,
          isChild: policy.isChild,
          holdReason: policy.reason,
        },
      },
    ]);

    if (policy.guardianId) {
      const [guardianNotif] = await Notification.create([
        {
          userId: policy.guardianId,
          title: 'অভিভাবক অনুমোদন প্রয়োজন (Guardian Approval Required)',
          body: `${customer.name} ৳${(amountPoisha / 100).toFixed(2)} ক্যাশ আউটের অনুমোদনের আবেদন করেছেন। কারণ: ${policy.reason}`,
          type: 'guardian_request',
          metadata: { txnId: txn._id, amountPoisha, senderUserId: customer._id },
        },
      ]);
      notifyGuardianApprovalRequired(policy.guardianId, {
        txnId: txn._id,
        amountPoisha,
        senderUserId: customer._id,
        senderName: customer.name,
        senderPhone: customer.phone,
        agentPhone: agent.phone,
        reason: policy.reason,
      });
      notifyNewNotification(policy.guardianId, guardianNotif);
    }

    const [childNotif] = await Notification.create([
      {
        userId: customer._id,
        title: 'অভিভাবকের অনুমোদনের অপেক্ষায় (Awaiting Guardian Approval)',
        body: `আপনার ৳${(amountPoisha / 100).toFixed(2)} ক্যাশ আউটের আবেদনটি অভিভাবকের পর্যালোচনার জন্য জমা হয়েছে।`,
        type: 'transaction',
        metadata: { txnId: txn._id, status: 'awaiting_guardian' },
      },
    ]);
    notifyNewNotification(customer._id, childNotif);

    return txn;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const key = idempotencyKey || `cashout-${customer._id}-${Date.now()}`;

    // 1. Transaction record
    const [txn] = await Transaction.create(
      [
        {
          senderWalletId: customerWallet._id,
          recipientWalletId: agentWallet._id,
          senderUserId: customer._id,
          recipientUserId: agent._id,
          type: 'cash_out',
          channel,
          amount: amountPoisha,
          fee: feePoisha,
          total: totalDebit,
          status: 'settled',
          idempotencyKey: key,
          metadata: {
            agentId: agent.agentProfile?.agentId,
            agentName: agent.agentProfile?.businessName || agent.name,
            agentPhone: agent.phone,
            bdtAmount: amountPoisha / 100,
            feeBdt: feePoisha / 100,
          },
        },
      ],
      { session }
    );

    // 2. Ledger Transfer: customer debited total, agent credited amount
    const { senderBalanceAfter, recipientBalanceAfter } = await executeLedgerTransfer({
      txnId: txn._id,
      senderWalletId: customerWallet._id,
      recipientWalletId: agentWallet._id,
      amountPoisha,
      feePoisha,
      session,
    });

    // 3. Notifications
    const notifs = await Notification.create(
      [
        {
          userId: customer._id,
          title: 'ক্যাশ আউট সম্পন্ন (Cash Out Successful)',
          body: `${agent.agentProfile?.businessName || 'এজেন্ট'}-এ ৳${(amountPoisha / 100).toFixed(2)} ক্যাশ আউট সম্পন্ন হয়েছে। ফি: ৳${(feePoisha / 100).toFixed(2)}।`,
          type: 'transaction',
          metadata: { txnId: txn._id, balanceAfter: senderBalanceAfter },
        },
        {
          userId: agent._id,
          title: 'ক্যাশ আউট গ্রহণ (Cash Out Collection)',
          body: `গ্রাহক ${customer.name} (${customer.phone}) থেকে ৳${(amountPoisha / 100).toFixed(2)} ক্যাশ আউট রিসিভ করা হয়েছে।`,
          type: 'transaction',
          metadata: { txnId: txn._id, balanceAfter: recipientBalanceAfter },
        },
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();
    logger.info({ txnId: txn._id, amountPoisha }, 'Cash out settled successfully.');

    // Realtime Socket.IO dispatch
    notifyWalletUpdate(customer._id, { balancePoisha: senderBalanceAfter, transaction: txn });
    notifyWalletUpdate(agent._id, { balancePoisha: recipientBalanceAfter, transaction: txn });
    if (notifs[0]) notifyNewNotification(customer._id, notifs[0]);
    if (notifs[1]) notifyNewNotification(agent._id, notifs[1]);

    eventBus.emit('transaction.settled', txn);

    setImmediate(() => {
      createAiTipForTransaction(txn._id).catch((err) =>
        logger.error({ err, txnId: txn._id }, 'Background AI tip failed')
      );
    });

    return txn;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Pay Utility Bill (Electricity, Gas, Water, Internet)
 */
export async function payBill({
  userId,
  billerId = 'DPDC',
  accountNo,
  amountPoisha,
  channel = 'ui',
  idempotencyKey,
}) {
  if (!userId || !amountPoisha || amountPoisha <= 0) {
    throw new Error('Valid user and positive bill amount are required.');
  }

  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey });
    if (existing) return existing;
  }

  const user = await User.findById(userId);
  const wallet = await Wallet.findOne({ userId, type: 'primary' });
  if (!wallet || wallet.balance < amountPoisha) {
    throw new Error('Insufficient wallet balance to pay bill.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const key = idempotencyKey || `bill-${userId}-${Date.now()}`;
    const [txn] = await Transaction.create(
      [
        {
          senderWalletId: wallet._id,
          senderUserId: user._id,
          type: 'bill',
          channel,
          amount: amountPoisha,
          fee: 0,
          total: amountPoisha,
          status: 'settled',
          idempotencyKey: key,
          metadata: {
            billerId,
            billerName: `${billerId} Utility Bill`,
            accountNo: accountNo || '442109',
            bdtAmount: amountPoisha / 100,
          },
        },
      ],
      { session }
    );

    await executeLedgerDebit({
      txnId: txn._id,
      walletId: wallet._id,
      amountPoisha,
      feePoisha: 0,
      description: `Bill Payment - ${billerId} (A/C: ${accountNo || '442109'})`,
      session,
    });

    const notifs = await Notification.create(
      [
        {
          userId,
          title: 'বিল পরিশোধ সফল (Bill Payment Successful)',
          body: `${billerId} বিল বাবদ ৳${(amountPoisha / 100).toFixed(2)} পরিশোধ করা হয়েছে।`,
          type: 'transaction',
          metadata: { txnId: txn._id, billerId, accountNo },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Realtime Socket.IO dispatch
    notifyWalletUpdate(userId, { balancePoisha: wallet.balance - amountPoisha, transaction: txn });
    if (notifs[0]) notifyNewNotification(userId, notifs[0]);

    eventBus.emit('transaction.settled', txn);
    setImmediate(() => createAiTipForTransaction(txn._id).catch(() => {}));

    return txn;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Mobile Recharge
 */
export async function mobileRecharge({
  userId,
  phone,
  operator = 'Grameenphone',
  amountPoisha,
  channel = 'ui',
  idempotencyKey,
}) {
  if (!userId || !amountPoisha || amountPoisha <= 0) {
    throw new Error('Valid user and recharge amount are required.');
  }

  const wallet = await Wallet.findOne({ userId, type: 'primary' });
  if (!wallet || wallet.balance < amountPoisha) {
    throw new Error('Insufficient wallet balance for recharge.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const key = idempotencyKey || `recharge-${userId}-${Date.now()}`;
    const [txn] = await Transaction.create(
      [
        {
          senderWalletId: wallet._id,
          senderUserId: userId,
          type: 'recharge',
          channel,
          amount: amountPoisha,
          fee: 0,
          total: amountPoisha,
          status: 'settled',
          idempotencyKey: key,
          metadata: {
            targetPhone: phone,
            operator,
            bdtAmount: amountPoisha / 100,
          },
        },
      ],
      { session }
    );

    await executeLedgerDebit({
      txnId: txn._id,
      walletId: wallet._id,
      amountPoisha,
      feePoisha: 0,
      description: `Mobile Recharge - ${operator} (${phone})`,
      session,
    });

    const notifs = await Notification.create(
      [
        {
          userId,
          title: 'মোবাইল রিচার্জ সফল (Recharge Successful)',
          body: `${phone} নম্বরে (${operator}) ৳${(amountPoisha / 100).toFixed(2)} রিচার্জ সফল হয়েছে।`,
          type: 'transaction',
          metadata: { txnId: txn._id, phone, operator },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Realtime Socket.IO dispatch
    notifyWalletUpdate(userId, { balancePoisha: wallet.balance - amountPoisha, transaction: txn });
    if (notifs[0]) notifyNewNotification(userId, notifs[0]);

    eventBus.emit('transaction.settled', txn);
    setImmediate(() => createAiTipForTransaction(txn._id).catch(() => {}));

    return txn;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Add Money (Simulated Bank -> Wallet)
 */
export async function addMoney({
  userId,
  bankName = 'Demo Bank A',
  accountNo = '****4321',
  amountPoisha,
  idempotencyKey,
}) {
  if (!userId || !amountPoisha || amountPoisha <= 0) {
    throw new Error('Valid user and amount are required.');
  }

  const wallet = await Wallet.findOne({ userId, type: 'primary' });
  if (!wallet) throw new Error('Wallet not found.');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const key = idempotencyKey || `addmoney-${userId}-${Date.now()}`;
    const [txn] = await Transaction.create(
      [
        {
          recipientWalletId: wallet._id,
          recipientUserId: userId,
          type: 'add_money',
          channel: 'ui',
          amount: amountPoisha,
          fee: 0,
          total: amountPoisha,
          status: 'settled',
          idempotencyKey: key,
          metadata: {
            bankName,
            accountNo,
            bdtAmount: amountPoisha / 100,
          },
        },
      ],
      { session }
    );

    await executeLedgerCredit({
      txnId: txn._id,
      walletId: wallet._id,
      amountPoisha,
      description: `Add Money from ${bankName} (${accountNo})`,
      session,
    });

    const notifs = await Notification.create(
      [
        {
          userId,
          title: 'টাকা যোগ সফল (Add Money Successful)',
          body: `${bankName} থেকে ৳${(amountPoisha / 100).toFixed(2)} সফলভাবে ওয়ালেটে যোগ হয়েছে।`,
          type: 'transaction',
          metadata: { txnId: txn._id, bankName, accountNo },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Realtime Socket.IO dispatch
    notifyWalletUpdate(userId, { balancePoisha: wallet.balance + amountPoisha, transaction: txn });
    if (notifs[0]) notifyNewNotification(userId, notifs[0]);

    eventBus.emit('transaction.settled', txn);
    eventBus.emit('wallet.credit', {
      userId,
      walletId: wallet._id,
      amountPoisha,
      senderPhone: bankName,
    });

    setImmediate(() => createAiTipForTransaction(txn._id).catch(() => {}));

    return txn;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export default {
  sendMoney,
  cashOut,
  payBill,
  mobileRecharge,
  addMoney,
};
