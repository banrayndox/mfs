import express from 'express';
import { requireAuth, requireTier } from '../middleware/auth.js';
import {
  sendMoney,
  cashOut,
  payBill,
  mobileRecharge,
  addMoney,
} from '../services/transaction.service.js';
import mongoose from 'mongoose';
import { User, Wallet, Transaction, AiTip, LinkedAccount, SavingsPlan } from '../models/index.js';
import { notifyWalletUpdate, notifySavingsPlanUpdate } from '../services/socket.service.js';
import { getMicroSavingsConfig, configureMicroSavings } from '../services/microSavings.service.js';

export const transactionRouter = express.Router();

// Lookup Recipient Account for Pre-validation
transactionRouter.get('/lookup-recipient/:phone', requireAuth, async (req, res, next) => {
  try {
    const cleanPhone = req.params.phone.trim().replace(/^(\+88)/, '');
    const recipient = await User.findOne({ phone: cleanPhone, status: 'active' }).select('name phone accountType');
    if (!recipient) {
      return res.status(404).json({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Invalid account / Account not found in Guardian MFS.',
      });
    }
    res.json({
      success: true,
      recipient: {
        name: recipient.name,
        phone: recipient.phone,
        accountType: recipient.accountType,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get Wallet Balance
transactionRouter.get('/balance', requireAuth, async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id, type: { $in: ['primary', 'agent'] } });
    res.json({
      balancePoisha: wallet ? wallet.balance : 0,
      currency: 'BDT',
      status: wallet ? wallet.status : 'active',
      dailySpendPoisha: wallet?.dailySpendPoisha || 0,
    });
  } catch (err) {
    next(err);
  }
});

// Send Money (Requires Tier 2)
transactionRouter.post('/send', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { recipientPhone, amountPoisha, idempotencyKey } = req.body;
    const txn = await sendMoney({
      senderUserId: req.user._id,
      recipientPhone,
      amountPoisha: Number(amountPoisha),
      channel: 'ui',
      idempotencyKey,
    });

    res.status(200).json({
      success: true,
      message: 'Money sent successfully.',
      transaction: txn,
    });
  } catch (err) {
    next(err);
  }
});

// Cash Out (Customer -> Agent, Requires Tier 2)
transactionRouter.post('/cashout', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { agentIdentifier, amountPoisha, idempotencyKey } = req.body;
    const txn = await cashOut({
      customerUserId: req.user._id,
      agentIdentifier,
      amountPoisha: Number(amountPoisha),
      channel: 'ui',
      idempotencyKey,
    });

    res.status(200).json({
      success: true,
      message: 'Cash out settled successfully.',
      transaction: txn,
    });
  } catch (err) {
    next(err);
  }
});

// Pay Bill (Utility, Requires Tier 2)
transactionRouter.post('/bill', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { billerId, accountNo, amountPoisha, idempotencyKey } = req.body;
    const txn = await payBill({
      userId: req.user._id,
      billerId,
      accountNo,
      amountPoisha: Number(amountPoisha),
      channel: 'ui',
      idempotencyKey,
    });

    res.status(200).json({
      success: true,
      message: 'Bill paid successfully.',
      transaction: txn,
    });
  } catch (err) {
    next(err);
  }
});

// Mobile Recharge (Requires Tier 2)
transactionRouter.post('/recharge', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { phone, operator, amountPoisha, idempotencyKey } = req.body;
    const txn = await mobileRecharge({
      userId: req.user._id,
      phone,
      operator,
      amountPoisha: Number(amountPoisha),
      channel: 'ui',
      idempotencyKey,
    });

    res.status(200).json({
      success: true,
      message: 'Mobile recharge successful.',
      transaction: txn,
    });
  } catch (err) {
    next(err);
  }
});

// Add Money (Simulated Bank -> Wallet)
transactionRouter.post('/addmoney', requireAuth, async (req, res, next) => {
  try {
    const { bankName, accountNo, amountPoisha, idempotencyKey } = req.body;
    const txn = await addMoney({
      userId: req.user._id,
      bankName,
      accountNo,
      amountPoisha: Number(amountPoisha),
      idempotencyKey,
    });

    res.status(200).json({
      success: true,
      message: 'Money added successfully from simulated bank.',
      transaction: txn,
    });
  } catch (err) {
    next(err);
  }
});

// Transaction History with AI Tips
transactionRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '30', 10);
    const filter = req.query.filter || 'all';

    const query = {
      $or: [{ senderUserId: req.user._id }, { recipientUserId: req.user._id }],
      status: { $in: ['settled', 'awaiting_guardian', 'failed'] },
    };

    if (filter === 'in') query.recipientUserId = req.user._id;
    if (filter === 'out') query.senderUserId = req.user._id;

    const txns = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderUserId', 'name phone')
      .populate('recipientUserId', 'name phone agentProfile');

    const txnsWithTips = await Promise.all(
      txns.map(async (t) => {
        const tip = await AiTip.findOne({ txnId: t._id });
        return {
          id: t._id,
          type: t.type,
          channel: t.channel,
          status: t.status,
          amountPoisha: t.amount,
          feePoisha: t.fee,
          totalPoisha: t.total,
          direction: t.senderUserId?._id?.toString() === req.user._id.toString() ? 'out' : 'in',
          sender: t.senderUserId ? { name: t.senderUserId.name, phone: t.senderUserId.phone } : null,
          recipient: t.recipientUserId
            ? {
                name: t.recipientUserId.agentProfile?.businessName || t.recipientUserId.name,
                phone: t.recipientUserId.phone,
              }
            : null,
          createdAt: t.createdAt,
          metadata: t.metadata,
          aiTip: tip
            ? {
                tipBn: tip.tipBn,
                tipEn: tip.tipEn,
                explanationBn: tip.explanationBn,
                explanationEn: tip.explanationEn,
              }
            : null,
        };
      })
    );

    res.json({ transactions: txnsWithTips });
  } catch (err) {
    next(err);
  }
});

// ==================== LINKED ACCOUNTS ====================

// Get all active linked accounts
transactionRouter.get('/linked-accounts', requireAuth, async (req, res, next) => {
  try {
    const accounts = await LinkedAccount.find({
      userId: req.user._id,
      status: 'linked',
    }).sort({ createdAt: -1 });

    res.json({ success: true, linkedAccounts: accounts });
  } catch (err) {
    next(err);
  }
});

// Add a new linked account
transactionRouter.post('/linked-accounts', requireAuth, async (req, res, next) => {
  try {
    const { institutionName, accountNumber, accountType = 'bank', holderName } = req.body;

    if (!institutionName || !institutionName.trim()) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Institution/Bank name is required.' });
    }

    const cleanAcc = (accountNumber || '').trim().replace(/[\s-]/g, '');
    if (!cleanAcc || cleanAcc.length < 4) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Account number must be at least 4 digits.' });
    }

    // Check if already linked
    const existing = await LinkedAccount.findOne({
      userId: req.user._id,
      accountNumber: cleanAcc,
      institutionName: institutionName.trim(),
      status: 'linked',
    });

    if (existing) {
      return res.status(400).json({ code: 'ALREADY_LINKED', message: 'This account is already linked.' });
    }

    const newLinked = await LinkedAccount.create({
      userId: req.user._id,
      institutionName: institutionName.trim(),
      accountNumber: cleanAcc,
      accountType,
      holderName: (holderName || req.user.name).trim(),
      status: 'linked',
    });

    res.status(201).json({ success: true, linkedAccount: newLinked });
  } catch (err) {
    next(err);
  }
});

// Remove/unlink an account
transactionRouter.delete('/linked-accounts/:id', requireAuth, async (req, res, next) => {
  try {
    const updated = await LinkedAccount.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: 'linked' },
      { status: 'unlinked' },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Linked account not found or already unlinked.' });
    }

    res.json({ success: true, message: 'Account unlinked successfully.' });
  } catch (err) {
    next(err);
  }
});

// ==================== SAVINGS & DPS PLANS ====================

// Get all active savings & DPS plans for user (seeds default initial plans if user has none)
transactionRouter.get('/savings-plans', requireAuth, async (req, res, next) => {
  try {
    let plans = await SavingsPlan.find({
      userId: req.user._id,
      status: 'active',
    }).sort({ createdAt: -1 });

    if (plans.length === 0) {
      // Initialize starter plans so user always has familiar base plans alongside custom plans
      const initialPlans = [
        {
          userId: req.user._id,
          planType: 'savings',
          title: 'জরুরি ফান্ড (Emergency Fund)',
          targetAmountPoisha: 2000000,
          currentAmountPoisha: 500000,
          installmentAmountPoisha: 50000,
          frequency: 'monthly',
          durationMonths: 12,
        },
        {
          userId: req.user._id,
          planType: 'savings',
          title: 'হজ্জ বা ওমরাহ সঞ্চয় (Hajj / Umrah)',
          targetAmountPoisha: 5000000,
          currentAmountPoisha: 1500000,
          installmentAmountPoisha: 150000,
          frequency: 'monthly',
          durationMonths: 24,
        },
        {
          userId: req.user._id,
          planType: 'savings',
          title: 'ল্যাপটপ সঞ্চয় (Tech Savings)',
          targetAmountPoisha: 1500000,
          currentAmountPoisha: 800000,
          installmentAmountPoisha: 100000,
          frequency: 'monthly',
          durationMonths: 6,
        },
        {
          userId: req.user._id,
          planType: 'dps',
          title: 'মাসিক সঞ্চয় ডিপিএস (Monthly DPS)',
          targetAmountPoisha: 6000000,
          currentAmountPoisha: 1200000,
          installmentAmountPoisha: 100000,
          frequency: 'monthly',
          durationMonths: 60,
          interestRatePercent: 7.5,
          autoDebit: true,
        },
      ];

      plans = await SavingsPlan.insertMany(initialPlans);
    }

    res.json({ success: true, savingsPlans: plans });
  } catch (err) {
    next(err);
  }
});

// Create a Custom Savings or Custom DPS plan
transactionRouter.post('/savings-plans', requireAuth, async (req, res, next) => {
  try {
    const {
      planType = 'savings',
      title,
      targetAmountPoisha,
      installmentAmountPoisha = 0,
      frequency = 'monthly',
      durationMonths = 12,
      interestRatePercent = 0,
      autoDebit = false,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Plan title/goal name is required.' });
    }

    const targetPoisha = Number(targetAmountPoisha);
    if (!targetPoisha || targetPoisha <= 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Target amount must be greater than 0.' });
    }

    const newPlan = await SavingsPlan.create({
      userId: req.user._id,
      planType: planType === 'dps' ? 'dps' : 'savings',
      title: title.trim(),
      targetAmountPoisha: Math.round(targetPoisha),
      currentAmountPoisha: 0,
      installmentAmountPoisha: Math.round(Number(installmentAmountPoisha) || 0),
      frequency: ['daily', 'weekly', 'monthly'].includes(frequency) ? frequency : 'monthly',
      durationMonths: Math.max(1, Number(durationMonths) || 12),
      interestRatePercent: Number(interestRatePercent) || (planType === 'dps' ? 7.5 : 0),
      autoDebit: Boolean(autoDebit),
      status: 'active',
    });

    res.status(201).json({ success: true, savingsPlan: newPlan });
  } catch (err) {
    next(err);
  }
});

// Deposit funds from Primary Wallet into a Savings / DPS Plan
transactionRouter.post('/savings-plans/:id/deposit', requireAuth, async (req, res, next) => {
  try {
    const { amountPoisha } = req.body;
    const numPoisha = Math.round(Number(amountPoisha));

    if (!numPoisha || numPoisha < 100) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Deposit amount must be at least ৳1.' });
    }

    const wallet = await Wallet.findOne({ userId: req.user._id, type: { $in: ['primary', 'agent'] } });
    if (!wallet || wallet.balance < numPoisha) {
      return res.status(400).json({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds in primary wallet.' });
    }

    const plan = await SavingsPlan.findOne({ _id: req.params.id, userId: req.user._id, status: 'active' });
    if (!plan) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Savings/DPS plan not found.' });
    }

    // Atomic debit & credit
    wallet.balance -= numPoisha;
    await wallet.save();

    plan.currentAmountPoisha += numPoisha;
    if (plan.currentAmountPoisha >= plan.targetAmountPoisha) {
      plan.status = 'matured';
    }
    await plan.save();

    // Create persistent transaction record
    const txn = await Transaction.create({
      senderWalletId: wallet._id,
      senderUserId: req.user._id,
      type: 'savings_deposit',
      channel: 'ui',
      amount: numPoisha,
      fee: 0,
      total: numPoisha,
      status: 'settled',
      idempotencyKey: req.body.idempotencyKey || `savings-dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metadata: {
        savingsPlanId: plan._id.toString(),
        savingsPlanTitle: plan.title,
        planType: plan.planType,
      },
    });

    notifyWalletUpdate(req.user._id, { balancePoisha: wallet.balance, transaction: txn });
    notifySavingsPlanUpdate(req.user._id, plan);

    res.json({
      success: true,
      message: `৳${(numPoisha / 100).toFixed(2)} deposited into ${plan.title}.`,
      updatedPlan: plan,
      newWalletBalancePoisha: wallet.balance,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== MICRO-SAVINGS MANUAL CONFIGURATION ====================

// Get micro-savings configuration and target plan
transactionRouter.get('/savings/config', requireAuth, async (req, res, next) => {
  try {
    const config = await getMicroSavingsConfig(req.user._id);
    res.json({ success: true, ...config });
  } catch (err) {
    next(err);
  }
});

// Configure micro-savings rules manually
transactionRouter.post('/savings/config', requireAuth, async (req, res, next) => {
  try {
    const microSavings = await configureMicroSavings({
      userId: req.user._id,
      ...req.body,
    });
    res.json({ success: true, config: microSavings, microSavings });
  } catch (err) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
  }
});

// Update / Edit an existing Savings Plan or Goal
transactionRouter.patch('/savings-plans/:id', requireAuth, async (req, res, next) => {
  try {
    const { title, targetAmountPoisha, installmentAmountPoisha, frequency, durationMonths, status } = req.body;
    const plan = await SavingsPlan.findOne({ _id: req.params.id, userId: req.user._id });
    if (!plan) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Savings plan not found.' });
    }

    if (title && title.trim()) plan.title = title.trim();
    if (targetAmountPoisha !== undefined) {
      const numTarget = Number(targetAmountPoisha);
      if (isNaN(numTarget) || numTarget <= 0) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Target amount must be greater than zero.' });
      }
      plan.targetAmountPoisha = Math.round(numTarget);
    }
    if (installmentAmountPoisha !== undefined) {
      plan.installmentAmountPoisha = Math.max(0, Math.round(Number(installmentAmountPoisha) || 0));
    }
    if (frequency && ['daily', 'weekly', 'monthly'].includes(frequency)) {
      plan.frequency = frequency;
    }
    if (durationMonths !== undefined) {
      plan.durationMonths = Math.max(1, Number(durationMonths) || 12);
    }
    if (status && ['active', 'matured', 'cancelled'].includes(status)) {
      plan.status = status;
    }

    await plan.save();
    notifySavingsPlanUpdate(req.user._id, plan);

    res.json({ success: true, message: 'Savings plan updated successfully.', plan, savingsPlan: plan });
  } catch (err) {
    next(err);
  }
});

// Cancel / Remove a Savings Plan or Goal (refunds accumulated balance to primary wallet)
transactionRouter.delete('/savings-plans/:id', requireAuth, async (req, res, next) => {
  try {
    const plan = await SavingsPlan.findOne({ _id: req.params.id, userId: req.user._id, status: { $ne: 'cancelled' } });
    if (!plan) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Savings plan not found or already cancelled.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let refundedPoisha = 0;
      if (plan.currentAmountPoisha > 0) {
        refundedPoisha = plan.currentAmountPoisha;
        const wallet = await Wallet.findOne({ userId: req.user._id, type: { $in: ['primary', 'agent'] } });
        if (wallet) {
          wallet.balance += refundedPoisha;
          await wallet.save({ session });

          await Transaction.create(
            [
              {
                senderWalletId: wallet._id,
                senderUserId: req.user._id,
                type: 'savings_withdraw',
                channel: 'ui',
                amount: refundedPoisha,
                fee: 0,
                total: refundedPoisha,
                status: 'settled',
                idempotencyKey: `savings-refund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                metadata: {
                  savingsPlanId: plan._id.toString(),
                  savingsPlanTitle: plan.title,
                  refundReason: 'Plan cancelled by user',
                },
              },
            ],
            { session }
          );

          notifyWalletUpdate(req.user._id, { balancePoisha: wallet.balance });
        }
      }

      plan.currentAmountPoisha = 0;
      plan.status = 'cancelled';
      await plan.save({ session });

      await session.commitTransaction();
      notifySavingsPlanUpdate(req.user._id, plan);

      res.json({
        success: true,
        message:
          refundedPoisha > 0
            ? `Plan cancelled. ৳${(refundedPoisha / 100).toFixed(2)} refunded to your primary wallet.`
            : 'Plan cancelled successfully.',
        refundedPoisha,
        savingsPlan: plan,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    next(err);
  }
});

export default transactionRouter;

