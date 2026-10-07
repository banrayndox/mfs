import mongoose from 'mongoose';
import { FinancialMemory, SavingsPlan, Wallet, Transaction, AuditLog } from '../models/index.js';
import { executeLedgerTransfer } from './ledger.service.js';
import { notifySavingsPlanUpdate, notifyWalletUpdate, notifySavingsConfigUpdate } from './socket.service.js';
import logger from '../utils/logger.js';

/**
 * Mode A: Percentage Saving calculation
 * e.g. ৳300 * 2% = ৳6.00 (600 poisha)
 * e.g. ৳500 * 2% = ৳10.00 (1000 poisha)
 */
export function calculatePercentageSavings({ amountPoisha, percentage = 2 }) {
  if (!amountPoisha || amountPoisha <= 0 || !percentage || percentage <= 0) return 0;
  return Math.round((amountPoisha * percentage) / 100);
}

/**
 * Mode B: Round-Up Saving calculation
 * Rounds to nearest round figure:
 * e.g. ৳87 (8700 poisha) -> ৳100 (10000 poisha) => ৳13.00 (1300 poisha)
 * e.g. ৳463 (46300 poisha) -> ৳500 (50000 poisha) => ৳37.00 (3700 poisha)
 */
export function calculateRoundUpSavings({ amountPoisha, roundUpUnit = 10000 }) {
  if (!amountPoisha || amountPoisha <= 0) return 0;
  const remainder = amountPoisha % roundUpUnit;
  if (remainder === 0) return 0;
  return roundUpUnit - remainder;
}

/**
 * Mode D: Threshold Saving calculation
 * Whenever spending exceeds threshold (e.g. ৳500 / 50000 poisha), saves difference to next hundred.
 * e.g. ৳670 (67000 poisha) -> Next round ৳700 (70000 poisha) => ৳30.00 (3000 poisha)
 */
export function calculateThresholdSavings({ amountPoisha, thresholdPoisha = 50000, roundUpUnit = 10000 }) {
  if (!amountPoisha || amountPoisha <= thresholdPoisha) return 0;
  return calculateRoundUpSavings({ amountPoisha, roundUpUnit });
}

/**
 * Mode C: Goal-Based Saving pace calculation
 * Calculates monthly requirement and student-friendly micro-saving recommendation.
 */
export function calculateGoalPace({ targetPoisha, durationMonths = 3, language = 'bn' }) {
  const months = Math.max(1, durationMonths);
  const monthlyPoisha = Math.round(targetPoisha / months);
  const monthlyBdt = (monthlyPoisha / 100).toFixed(2);
  const targetBdt = (targetPoisha / 100).toFixed(2);

  const recommendationBn = `লক্ষ্য: ৳${targetBdt} (${months} মাস)\n• প্রয়োজনীয় গড় মাসিক সঞ্চয়: প্রায় ৳${monthlyBdt}/মাস\n💡 ছাত্র-বান্ধব মাইক্রো-সঞ্চয় কৌশল: আপনি ২% ট্রানজ্যাকশন সেভিংস + রাউন্ড-আপ সেভিংস চালু রাখলে দৈনন্দিন খরচের পাশাপাশি এই লক্ষ্যের দিকে এগিয়ে যেতে পারবেন।`;
  const recommendationEn = `Goal: ৳${targetBdt} (${months} months)\n• Required monthly average: approx ৳${monthlyBdt}/month\n💡 Student Micro-Savings Strategy: Based on your daily expenses, combining 2% transaction savings with round-ups can steadily build toward this milestone.`;

  return {
    targetPoisha,
    targetBdt,
    durationMonths: months,
    monthlyPoisha,
    monthlyBdt,
    recommendation: language === 'bn' ? recommendationBn : recommendationEn,
  };
}

/**
 * Get or initialize user's FinancialMemory
 */
export async function getOrCreateFinancialMemory(userId) {
  let memory = await FinancialMemory.findOne({ userId });
  if (!memory) {
    // Check if user has an existing savings plan to link as default
    let defaultPlan = await SavingsPlan.findOne({ userId, status: 'active' });
    if (!defaultPlan) {
      defaultPlan = await SavingsPlan.create({
        userId,
        planType: 'savings',
        title: 'সাধারণ সঞ্চয় তহবিল (General Savings)',
        targetAmountPoisha: 1000000, // ৳10,000
        currentAmountPoisha: 0,
        status: 'active',
      });
    }

    memory = await FinancialMemory.create({
      userId,
      microSavings: {
        enabled: false,
        paused: false,
        mode: 'percentage',
        percentage: 2,
        roundUpUnit: 10000,
        thresholdMinPoisha: 50000,
        targetPlanId: defaultPlan._id,
        autoDeductOnSpend: true,
      },
    });
  }
  return memory;
}

/**
 * Configure / update micro-savings rule
 */
export async function configureMicroSavings({
  userId,
  enabled,
  paused,
  mode,
  percentage,
  roundUpUnit,
  thresholdMinPoisha,
  targetPlanId,
}) {
  const memory = await getOrCreateFinancialMemory(userId);

  if (percentage !== undefined) {
    const numPct = Number(percentage);
    if (isNaN(numPct) || numPct < 1 || numPct > 25) {
      throw new Error('Percentage savings must be between 1% and 25%.');
    }
    memory.microSavings.percentage = numPct;
  }

  if (roundUpUnit !== undefined) {
    const numUnit = Number(roundUpUnit);
    if (isNaN(numUnit) || numUnit <= 0) {
      throw new Error('Round-up unit must be greater than zero.');
    }
    memory.microSavings.roundUpUnit = numUnit;
  }

  if (thresholdMinPoisha !== undefined) {
    const numThresh = Number(thresholdMinPoisha);
    if (isNaN(numThresh) || numThresh <= 0) {
      throw new Error('Threshold amount must be greater than zero.');
    }
    memory.microSavings.thresholdMinPoisha = numThresh;
  }

  if (mode !== undefined) {
    if (!['percentage', 'round_up', 'threshold', 'none'].includes(mode)) {
      throw new Error('Invalid micro-savings mode. Must be percentage, round_up, or threshold.');
    }
    memory.microSavings.mode = mode;
  }

  if (enabled !== undefined) {
    memory.microSavings.enabled = Boolean(enabled);
  }

  if (paused !== undefined) {
    memory.microSavings.paused = Boolean(paused);
  }

  if (targetPlanId !== undefined) {
    memory.microSavings.targetPlanId = targetPlanId || null;
  }

  await memory.save();

  // Emit realtime configuration update
  try {
    notifySavingsConfigUpdate(userId, memory.microSavings);
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to emit notifySavingsConfigUpdate');
  }

  return memory.microSavings;
}

/**
 * Get micro-savings configuration and related active plans
 */
export async function getMicroSavingsConfig(userId) {
  const memory = await getOrCreateFinancialMemory(userId);
  let targetPlan = null;
  if (memory.microSavings?.targetPlanId) {
    targetPlan = await SavingsPlan.findById(memory.microSavings.targetPlanId);
  }
  if (!targetPlan) {
    targetPlan = await SavingsPlan.findOne({ userId, status: 'active' });
  }
  const activePlans = await SavingsPlan.find({ userId, status: 'active' }).sort({ createdAt: -1 });

  return {
    config: memory.microSavings,
    microSavings: memory.microSavings,
    targetPlan,
    activePlans,
  };
}

export async function pauseMicroSavings(userId) {
  return configureMicroSavings({ userId, paused: true });
}

export async function resumeMicroSavings(userId) {
  return configureMicroSavings({ userId, paused: false, enabled: true });
}

export async function disableMicroSavings(userId) {
  return configureMicroSavings({ userId, enabled: false });
}

/**
 * Automatically execute micro-savings deduction on outgoing transaction settlement
 */
export async function processMicroSavingsForTransaction({ userId, amountPoisha }) {
  try {
    const memory = await FinancialMemory.findOne({ userId });
    if (!memory || !memory.microSavings?.enabled || memory.microSavings.paused) {
      return null;
    }

    const { mode, percentage, roundUpUnit, thresholdMinPoisha, targetPlanId } = memory.microSavings;

    let savedPoisha = 0;
    if (mode === 'percentage') {
      savedPoisha = calculatePercentageSavings({ amountPoisha, percentage });
    } else if (mode === 'round_up') {
      savedPoisha = calculateRoundUpSavings({ amountPoisha, roundUpUnit });
    } else if (mode === 'threshold') {
      savedPoisha = calculateThresholdSavings({ amountPoisha, thresholdPoisha: thresholdMinPoisha, roundUpUnit });
    }

    if (savedPoisha <= 0) return null;

    // Check target plan
    let plan = targetPlanId ? await SavingsPlan.findById(targetPlanId) : null;
    if (!plan || plan.status !== 'active') {
      plan = await SavingsPlan.findOne({ userId, status: 'active' });
    }
    if (!plan) return null;

    // Check user wallet has enough funds for savings
    const wallet = await Wallet.findOne({ userId, type: 'primary' });
    if (!wallet || wallet.balance < savedPoisha) {
      logger.warn({ userId, walletBalance: wallet?.balance, savedPoisha }, 'Insufficient balance for micro-savings auto-debit');
      return null;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Debit wallet
      wallet.balance -= savedPoisha;
      await wallet.save({ session });

      // 2. Credit savings plan
      plan.currentAmountPoisha += savedPoisha;
      if (plan.currentAmountPoisha >= plan.targetAmountPoisha && plan.targetAmountPoisha > 0) {
        plan.status = 'matured';
      }
      await plan.save({ session });

      // 3. Create micro-savings transaction record
      const [saveTxn] = await Transaction.create(
        [
          {
            senderWalletId: wallet._id,
            senderUserId: userId,
            type: 'savings_deposit',
            channel: 'agent',
            amount: savedPoisha,
            fee: 0,
            total: savedPoisha,
            status: 'settled',
            metadata: {
              planId: plan._id,
              planTitle: plan.title,
              microSavingsMode: mode,
              baseAmountPoisha: amountPoisha,
            },
          },
        ],
        { session }
      );

      // 4. Update memory counters
      memory.microSavings.totalSavedPoisha = (memory.microSavings.totalSavedPoisha || 0) + savedPoisha;
      memory.microSavings.savingsCount = (memory.microSavings.savingsCount || 0) + 1;
      await memory.save({ session });

      await session.commitTransaction();

      // Emit realtime events
      notifySavingsPlanUpdate(userId, plan);
      notifyWalletUpdate(userId, { balancePoisha: wallet.balance, transaction: saveTxn });

      logger.info(
        { userId, planId: plan._id, savedPoisha, mode },
        'Micro-savings deposited automatically on spend'
      );

      return {
        savedPoisha,
        savedBdt: (savedPoisha / 100).toFixed(2),
        planTitle: plan.title,
        newPlanBalanceBdt: (plan.currentAmountPoisha / 100).toFixed(2),
      };
    } catch (err) {
      await session.abortTransaction();
      logger.error({ err, userId }, 'Failed to process micro-savings deposit');
      return null;
    } finally {
      session.endSession();
    }
  } catch (err) {
    logger.error({ err, userId }, 'Error checking micro-savings on transaction');
    return null;
  }
}

export default {
  calculatePercentageSavings,
  calculateRoundUpSavings,
  calculateThresholdSavings,
  calculateGoalPace,
  getOrCreateFinancialMemory,
  configureMicroSavings,
  getMicroSavingsConfig,
  pauseMicroSavings,
  resumeMicroSavings,
  disableMicroSavings,
  processMicroSavingsForTransaction,
};
