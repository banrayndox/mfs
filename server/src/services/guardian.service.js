import mongoose from 'mongoose';
import { GuardianLink, ProtectedProfile, User, Notification, AuditLog, Transaction, Wallet } from '../models/index.js';
import { executeLedgerTransfer } from './ledger.service.js';
import { eventBus } from './eventBus.js';
import logger from '../utils/logger.js';
import { notifyWalletUpdate, notifyNewNotification, notifyGuardianApprovalDecided } from './socket.service.js';

/**
 * Link an adult ward to a guardian with mutual consent.
 */
export async function linkGuardian({ guardianPhone, wardUserId, relationship = 'family', warnMode = 'ask_approval' }) {
  const cleanGuardianPhone = guardianPhone.trim().replace(/^(\+88)/, '');
  const guardian = await User.findOne({ phone: cleanGuardianPhone });

  if (!guardian) {
    throw new Error('Guardian phone number is not registered in Guardian MFS.');
  }

  if (guardian._id.toString() === wardUserId.toString()) {
    throw new Error('Cannot link yourself as your own guardian.');
  }

  const existingLink = await GuardianLink.findOne({
    guardianId: guardian._id,
    wardId: wardUserId,
  });

  if (existingLink) {
    existingLink.status = 'active';
    existingLink.warnMode = warnMode;
    await existingLink.save();
    return existingLink;
  }

  const link = await GuardianLink.create({
    guardianId: guardian._id,
    wardId: wardUserId,
    relationship,
    warnMode,
    status: 'active',
  });

  await Notification.create({
    userId: guardian._id,
    title: 'অভিভাবক সংযোগ (Guardian Linked)',
    body: 'আপনি একজন সদস্যের গার্ডিয়ান হিসেবে যুক্ত হয়েছেন।',
    type: 'system',
  });

  return link;
}

/**
 * Create a protected child profile under a guardian.
 */
export async function createChildProfile({
  guardianUserId,
  name,
  phone,
  dob,
  birthCertificateNumber = '20121234567890123',
  pin = '1234',
  dailyLimitPoisha = 50000, // 500 BDT
}) {
  const { register } = await import('./auth.service.js');

  const guardian = await User.findById(guardianUserId);
  if (!guardian) {
    throw new Error('Guardian account not found.');
  }

  // Register child account atomically with initial balance
  const registration = await register({
    phone,
    pin,
    name,
    accountType: 'CHILD',
    dob: dob || '2012-05-15',
    parentPhone: guardian.phone,
    dailyLimitPoisha,
  });

  const childUser = registration.user;
  const profile = await ProtectedProfile.findOne({ childUserId: childUser.id });

  return { childUser, profile };
}

/**
 * Check whether a transaction requires guardian approval or warning.
 */
export async function evaluateGuardianPolicy({ userId, amountPoisha, recipientPhone, riskScore = 0.1 }) {
  // 1. Check if user is a child
  const childProfile = await ProtectedProfile.findOne({ childUserId: userId, status: 'active' });
  if (childProfile) {
    const mode = childProfile.controlMode || 'APPROVAL_REQUIRED';

    if (mode === 'APPROVAL_REQUIRED') {
      return {
        decision: 'hold',
        reason: 'Child account operates under APPROVAL_REQUIRED mode. Guardian approval required.',
        guardianId: childProfile.guardianId,
        isChild: true,
      };
    }

    if (mode === 'LIMITED') {
      if (amountPoisha > childProfile.dailyLimitPoisha) {
        return {
          decision: 'block',
          reason: `Guardian limit exceeded. Daily spending limit is ৳${(childProfile.dailyLimitPoisha / 100).toFixed(2)}`,
          guardianId: childProfile.guardianId,
          isChild: true,
        };
      }
      return {
        decision: 'allow',
        reason: 'Transaction is within child daily spending limit.',
        guardianId: childProfile.guardianId,
        isChild: true,
      };
    }

    if (mode === 'UPDATES_ONLY') {
      return {
        decision: 'allow',
        reason: 'Child account operates under UPDATES_ONLY mode. Informational notice sent to guardian.',
        guardianId: childProfile.guardianId,
        isChild: true,
        notifyGuardian: true,
      };
    }
  }

  // 2. Check if user has an active guardian link
  const guardianLink = await GuardianLink.findOne({ wardId: userId, status: 'active' });
  if (guardianLink) {
    if (riskScore >= 0.70) {
      return {
        decision: 'hold',
        reason: 'High risk score requires guardian review and approval.',
        guardianId: guardianLink.guardianId,
        isChild: false,
      };
    }

    if (riskScore >= 0.30 && guardianLink.warnMode === 'ask_approval') {
      return {
        decision: 'hold',
        reason: 'Moderate risk transfer subject to guardian approval policy.',
        guardianId: guardianLink.guardianId,
        isChild: false,
      };
    }

    if (riskScore >= 0.30) {
      return {
        decision: 'warn',
        reason: 'Moderate risk transfer detected. Guardian informed.',
        guardianId: guardianLink.guardianId,
        isChild: false,
      };
    }
  }

  // 3. User with no guardian but high risk
  if (riskScore >= 0.70) {
    return {
      decision: 'cooling_off',
      reason: 'Unusually high risk. 10-minute security cooling-off period initiated.',
    };
  }

  return { decision: 'allow', reason: 'Policy check passed.' };
}

/**
 * Get all pending approvals for a guardian.
 */
export async function getPendingApprovals(guardianUserId) {
  const children = await ProtectedProfile.find({ guardianId: guardianUserId, status: 'active' });
  const wards = await GuardianLink.find({ guardianId: guardianUserId, status: 'active' });

  const wardUserIds = [
    ...children.map((c) => c.childUserId),
    ...wards.map((w) => w.wardId),
  ];

  if (wardUserIds.length === 0) {
    return [];
  }

  const txns = await Transaction.find({
    senderUserId: { $in: wardUserIds },
    status: 'awaiting_guardian',
  })
    .populate('senderUserId', 'name phone accountType')
    .populate('recipientUserId', 'name phone')
    .sort({ createdAt: -1 });

  return txns.map((t) => ({
    id: t._id.toString(),
    type: t.type,
    amountPoisha: t.amount,
    feePoisha: t.fee,
    totalPoisha: t.total,
    sender: {
      id: t.senderUserId?._id,
      name: t.senderUserId?.name || 'Child',
      phone: t.senderUserId?.phone || '',
    },
    recipient: {
      id: t.recipientUserId?._id,
      name: t.recipientUserId?.name || t.metadata?.recipientName || 'Recipient',
      phone: t.recipientUserId?.phone || t.metadata?.recipientPhone || '',
    },
    reason: t.metadata?.holdReason || t.risk?.reasons?.[0]?.descriptionBn || 'Guardian approval required',
    createdAt: t.createdAt,
  }));
}

/**
 * Get a specific pending approval by txnId for a guardian.
 */
export async function getPendingApprovalById({ guardianUserId, txnId }) {
  const txn = await Transaction.findById(txnId)
    .populate('senderUserId', 'name phone accountType')
    .populate('recipientUserId', 'name phone');

  if (!txn) {
    throw new Error('Transaction not found.');
  }

  // Check authorization
  const isChild = await ProtectedProfile.findOne({
    guardianId: guardianUserId,
    childUserId: txn.senderUserId?._id || txn.senderUserId,
    status: 'active',
  });
  const isWard = await GuardianLink.findOne({
    guardianId: guardianUserId,
    wardId: txn.senderUserId?._id || txn.senderUserId,
    status: 'active',
  });

  if (!isChild && !isWard) {
    throw new Error('Unauthorized: You are not the guardian for this transaction.');
  }

  return {
    id: txn._id.toString(),
    status: txn.status,
    type: txn.type,
    amountPoisha: txn.amount,
    feePoisha: txn.fee,
    totalPoisha: txn.total,
    sender: {
      id: txn.senderUserId?._id,
      name: txn.senderUserId?.name || 'Child',
      phone: txn.senderUserId?.phone || '',
    },
    recipient: {
      id: txn.recipientUserId?._id,
      name: txn.recipientUserId?.name || txn.metadata?.recipientName || 'Recipient',
      phone: txn.recipientUserId?.phone || txn.metadata?.recipientPhone || '',
    },
    reason: txn.metadata?.holdReason || txn.risk?.reasons?.[0]?.descriptionBn || 'Guardian approval required',
    createdAt: txn.createdAt,
  };
}

/**
 * Guardian decides (approves or rejects) a pending transaction.
 */
export async function decideGuardianApproval({ guardianUserId, txnId, decision }) {
  const txn = await Transaction.findById(txnId);
  if (!txn || txn.status !== 'awaiting_guardian') {
    throw new Error('Transaction not found or not pending guardian approval.');
  }

  // Check authorization: Is caller the registered guardian for sender?
  const isChildProfile = await ProtectedProfile.findOne({
    guardianId: guardianUserId,
    childUserId: txn.senderUserId,
    status: 'active',
  });
  const isGuardianLink = await GuardianLink.findOne({
    guardianId: guardianUserId,
    wardId: txn.senderUserId,
    status: 'active',
  });

  if (!isChildProfile && !isGuardianLink) {
    throw new Error('Unauthorized: You are not the registered guardian for this account.');
  }

  const sender = await User.findById(txn.senderUserId);
  const recipient = await User.findById(txn.recipientUserId);

  if (decision === 'reject') {
    txn.status = 'cancelled';
    txn.errorMessage = 'Rejected by guardian.';
    await txn.save();

    const [childNotif] = await Notification.create([
      {
        userId: txn.senderUserId,
        title: 'লেনদেন বাতিল করা হয়েছে (Transaction Rejected)',
        body: `আপনার অভিভাবক ৳${(txn.amount / 100).toFixed(2)} পাঠানোর আবেদনটি বাতিল করেছেন।`,
        type: 'transaction',
        metadata: { txnId: txn._id, status: 'cancelled' },
      },
    ]);

    notifyGuardianApprovalDecided(txn.senderUserId, guardianUserId, {
      txnId: txn._id,
      status: 'cancelled',
      decision: 'reject',
    });
    notifyNewNotification(txn.senderUserId, childNotif);

    return {
      success: true,
      status: 'cancelled',
      message: 'Transaction rejected successfully.',
      transaction: txn,
    };
  }

  if (decision === 'approve') {
    const senderWallet = await Wallet.findById(txn.senderWalletId);
    const recipientWallet = await Wallet.findById(txn.recipientWalletId);

    if (!senderWallet || senderWallet.balance < txn.total) {
      txn.status = 'failed';
      txn.errorMessage = 'Sender has insufficient balance at approval time.';
      await txn.save();
      throw new Error('Sender wallet has insufficient balance to settle this transaction.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { senderBalanceAfter, recipientBalanceAfter } = await executeLedgerTransfer({
        txnId: txn._id,
        senderWalletId: txn.senderWalletId,
        recipientWalletId: txn.recipientWalletId,
        amountPoisha: txn.amount,
        feePoisha: txn.fee,
        session,
      });

      txn.status = 'settled';
      await txn.save({ session });

      senderWallet.dailySpendPoisha = (senderWallet.dailySpendPoisha || 0) + txn.total;
      await senderWallet.save({ session });

      const notifs = await Notification.create(
        [
          {
            userId: sender._id,
            title: 'লেনদেন অনুমোদিত (Transaction Approved)',
            body: `আপনার অভিভাবক ৳${(txn.amount / 100).toFixed(2)} পাঠানো অনুমোদন করেছেন এবং টাকা সফলভাবে পাঠানো হয়েছে।`,
            type: 'transaction',
            metadata: { txnId: txn._id, balanceAfter: senderBalanceAfter },
          },
          {
            userId: recipient._id,
            title: 'টাকা গ্রহণ (Money Received)',
            body: `${sender.name} (${sender.phone}) থেকে ৳${(txn.amount / 100).toFixed(2)} প্রাপ্ত হয়েছে।`,
            type: 'transaction',
            metadata: { txnId: txn._id, balanceAfter: recipientBalanceAfter },
          },
          {
            userId: guardianUserId,
            title: 'লেনদেন অনুমোদন সম্পন্ন (Approval Successful)',
            body: `আপনি ${sender.name}-এর ৳${(txn.amount / 100).toFixed(2)} লেনদেন সফলভাবে অনুমোদন করেছেন।`,
            type: 'transaction',
            metadata: { txnId: txn._id },
          },
        ],
        { session, ordered: true }
      );

      await AuditLog.create(
        [
          {
            userId: guardianUserId,
            action: 'GUARDIAN_APPROVED_TRANSACTION',
            actorType: 'user',
            status: 'success',
            details: {
              txnId: txn._id,
              senderUserId: sender._id,
              recipientUserId: recipient._id,
              amountPoisha: txn.amount,
            },
          },
        ],
        { session, ordered: true }
      );

      await session.commitTransaction();

      // Realtime Socket.IO dispatch
      notifyGuardianApprovalDecided(sender._id, guardianUserId, {
        txnId: txn._id,
        status: 'settled',
        decision: 'approve',
      });
      notifyWalletUpdate(sender._id, { balancePoisha: senderBalanceAfter, transaction: txn });
      notifyWalletUpdate(recipient._id, { balancePoisha: recipientBalanceAfter, transaction: txn });
      if (notifs[0]) notifyNewNotification(sender._id, notifs[0]);
      if (notifs[1]) notifyNewNotification(recipient._id, notifs[1]);
      if (notifs[2]) notifyNewNotification(guardianUserId, notifs[2]);

      eventBus.emit('transaction.settled', txn);
      eventBus.emit('wallet.credit', {
        userId: recipient._id,
        walletId: recipientWallet._id,
        amountPoisha: txn.amount,
        senderPhone: sender.phone,
      });

      return {
        success: true,
        status: 'settled',
        message: 'Transaction approved and settled successfully.',
        transaction: txn,
      };
    } catch (err) {
      await session.abortTransaction();
      logger.error({ err, txnId: txn._id }, 'Guardian approval settlement failed');
      throw err;
    } finally {
      session.endSession();
    }
  }

  throw new Error('Invalid decision. Must be "approve" or "reject".');
}

/**
  * Update child control mode and optionally daily limit.
  */
export async function updateChildControlMode({ guardianUserId, childUserId, controlMode, dailyLimitPoisha }) {
  const validModes = ['APPROVAL_REQUIRED', 'LIMITED', 'UPDATES_ONLY'];
  if (!validModes.includes(controlMode)) {
    throw new Error(`Invalid control mode: ${controlMode}. Must be one of ${validModes.join(', ')}`);
  }

  const profile = await ProtectedProfile.findOne({
    guardianId: guardianUserId,
    childUserId,
    status: { $ne: 'inactive' },
  });

  if (!profile) {
    throw new Error('Active child profile not found for this guardian.');
  }

  profile.controlMode = controlMode;
  if (dailyLimitPoisha !== undefined && dailyLimitPoisha !== null) {
    profile.dailyLimitPoisha = Number(dailyLimitPoisha);
  }
  await profile.save();

  return profile;
}

/**
  * Remove (deactivate) child relationship without deleting child user account.
  */
export async function removeChildRelationship({ guardianUserId, childUserId }) {
  const profile = await ProtectedProfile.findOne({
    guardianId: guardianUserId,
    childUserId,
  });

  if (!profile) {
    throw new Error('Child relationship not found for this guardian.');
  }

  profile.status = 'inactive';
  await profile.save();

  await Notification.create({
    userId: guardianUserId,
    title: 'সন্তানের অ্যাকাউন্ট অপসারণ (Child Removed)',
    body: 'সন্তানের অভিভাবকত্ব প্রোফাইল সফলভাবে নিষ্ক্রিয় করা হয়েছে। অ্যাকাউন্ট সংরক্ষিত থাকবে।',
    type: 'system',
  }).catch(() => {});

  return profile;
}

export default {
  linkGuardian,
  createChildProfile,
  evaluateGuardianPolicy,
  getPendingApprovals,
  decideGuardianApproval,
  updateChildControlMode,
  removeChildRelationship,
};
