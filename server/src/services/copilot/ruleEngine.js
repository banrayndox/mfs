/**
 * @file ruleEngine.js
 * Deterministic Business Rule Engine for Guardian MFS AI Copilot.
 * Enforces financial invariants, fee calculations, balance checks,
 * Guardian policies, and group bill split mathematics.
 */

import { Wallet, ProtectedProfile } from '../../models/index.js';
import { evaluateGuardianPolicy } from '../guardian.service.js';
import { evaluateGuardianRisk } from '../guardianRisk.service.js';

/**
 * Validates wallet balance for an outgoing transfer, cashout, bill, or recharge.
 * @param {string} userId
 * @param {number} requiredAmountPoisha
 * @returns {Promise<{ allowed: boolean, currentBalancePoisha: number, shortfallPoisha?: number }>}
 */
export async function validateWalletBalance(userId, requiredAmountPoisha) {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    return { allowed: false, currentBalancePoisha: 0, shortfallPoisha: requiredAmountPoisha };
  }

  const currentBalancePoisha = wallet.balance;
  if (currentBalancePoisha < requiredAmountPoisha) {
    return {
      allowed: false,
      currentBalancePoisha,
      shortfallPoisha: requiredAmountPoisha - currentBalancePoisha,
    };
  }

  return { allowed: true, currentBalancePoisha };
}

/**
 * Calculates deterministic fee for Cash Out (1.5% standard UPAY agent fee).
 * @param {number} amountPoisha
 * @returns {{ feePoisha: number, totalPoisha: number }}
 */
export function calculateCashOutFee(amountPoisha) {
  const feePoisha = Math.round(amountPoisha * 0.015);
  return {
    feePoisha,
    totalPoisha: amountPoisha + feePoisha,
  };
}

/**
 * Evaluates child/family account policy and guardian limits.
 * @param {object} params
 * @param {string} params.userId
 * @param {number} params.amountPoisha
 * @param {string} params.recipientPhone
 * @param {string} params.transactionType
 * @returns {Promise<{ requiresApproval: boolean, isBlocked: boolean, reason?: string, guardianId?: string }>}
 */
export async function evaluateChildAccountRules({ userId, amountPoisha, recipientPhone, transactionType }) {
  const profile = await ProtectedProfile.findOne({ childUserId: userId, status: 'active' });
  if (!profile) {
    return { requiresApproval: false, isBlocked: false };
  }

  return await evaluateGuardianPolicy({
    childUserId: userId,
    amountPoisha,
    recipientPhone,
    transactionType,
  });
}

/**
 * Evaluates fraud risk / scam score for an intended recipient.
 * @param {object} params
 * @param {string} params.senderUserId
 * @param {string} params.recipientPhone
 * @param {number} params.amountPoisha
 * @returns {Promise<{ isHighRisk: boolean, riskScore: number, warnings: string[] }>}
 */
export async function evaluateRiskRules({ senderUserId, recipientPhone, amountPoisha }) {
  return await evaluateGuardianRisk({
    senderUserId,
    recipientPhone,
    amountPoisha,
    channel: 'agent_copilot',
  });
}

/**
 * Validates group bill split mathematics.
 * - Equal split: calculates each person's exact share.
 * - Custom split: strictly verifies that sum(shares) == total.
 * - Percentage split: strictly verifies that sum(percentages) == 100.
 * @param {object} params
 * @param {number} params.totalAmountPoisha
 * @param {string} params.splitMethod - 'equal' | 'custom' | 'percentage'
 * @param {number} params.participantCount
 * @param {Record<string, number>} [params.customShares] - in poisha
 * @param {Record<string, number>} [params.percentages]
 * @returns {{ valid: boolean, error?: string, errorBn?: string, shares?: Record<string, number> }}
 */
export function validateGroupBillMath({
  totalAmountPoisha,
  splitMethod,
  participantCount,
  customShares,
  percentages,
}) {
  if (totalAmountPoisha <= 0) {
    return {
      valid: false,
      error: 'Total bill amount must be greater than zero.',
      errorBn: 'বিলের মোট পরিমাণ শূন্যের বেশি হতে হবে।',
    };
  }

  if (participantCount < 2) {
    return {
      valid: false,
      error: 'A group bill requires at least 2 participants.',
      errorBn: 'গ্রুপ বিলে কমপক্ষে ২ জন সদস্য থাকতে হবে।',
    };
  }

  // 1. EQUAL SPLIT
  if (splitMethod === 'equal') {
    const eachSharePoisha = Math.floor(totalAmountPoisha / participantCount);
    return {
      valid: true,
      eachSharePoisha,
    };
  }

  // 2. CUSTOM SPLIT (Absolute amounts)
  if (splitMethod === 'custom') {
    if (!customShares || typeof customShares !== 'object') {
      return {
        valid: false,
        error: 'Custom shares must be specified for each participant.',
        errorBn: 'প্রত্যেক সদস্যের টাকার পরিমাণ নির্দিষ্ট করতে হবে।',
      };
    }

    const sumShares = Object.values(customShares).reduce((acc, val) => acc + (val || 0), 0);
    if (sumShares !== totalAmountPoisha) {
      const diffPoisha = Math.abs(totalAmountPoisha - sumShares);
      const diffBdt = (diffPoisha / 100).toFixed(2);
      const isShort = sumShares < totalAmountPoisha;
      return {
        valid: false,
        error: `Sum of participant amounts (৳${(sumShares / 100).toFixed(2)}) does not match total bill amount (৳${(totalAmountPoisha / 100).toFixed(2)}). Difference: ৳${diffBdt} ${isShort ? 'short' : 'over'}.`,
        errorBn: `সদস্যদের টাকার যোগফল (৳${(sumShares / 100).toFixed(2)}) মোট বিলের (৳${(totalAmountPoisha / 100).toFixed(2)}) সাথে মিলছে না। পার্থক্য: ৳${diffBdt}।`,
      };
    }

    return { valid: true, shares: customShares };
  }

  // 3. PERCENTAGE SPLIT
  if (splitMethod === 'percentage') {
    if (!percentages || typeof percentages !== 'object') {
      return {
        valid: false,
        error: 'Percentages must be specified for each participant.',
        errorBn: 'প্রত্যেক সদস্যের শতকরা হার নির্দিষ্ট করতে হবে।',
      };
    }

    const sumPercent = Object.values(percentages).reduce((acc, val) => acc + (val || 0), 0);
    if (Math.round(sumPercent) !== 100) {
      return {
        valid: false,
        error: `Sum of percentages is ${sumPercent}%, but must equal exactly 100%.`,
        errorBn: `শতকরা হারের যোগফল ${sumPercent}%, কিন্তু মোট ঠিক ১০০% হতে হবে।`,
      };
    }

    const shares = {};
    for (const [key, pct] of Object.entries(percentages)) {
      shares[key] = Math.round((totalAmountPoisha * pct) / 100);
    }

    return { valid: true, shares, percentages };
  }

  return {
    valid: false,
    error: `Unknown split method: ${splitMethod}`,
    errorBn: `অজানা স্প্লিট মেথড: ${splitMethod}`,
  };
}

export const validateGroupBillSplit = validateGroupBillMath;
export const validateTransactionRules = validateWalletBalance;

export default {
  validateWalletBalance,
  validateTransactionRules,
  calculateCashOutFee,
  evaluateChildAccountRules,
  evaluateRiskRules,
  validateGroupBillMath,
  validateGroupBillSplit,
};
