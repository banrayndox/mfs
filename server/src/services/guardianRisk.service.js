import { Transaction, User } from '../models/index.js';

/**
 * Perform Guardian Risk Analysis on an outgoing transaction.
 * Evaluates real historical data signals and returns explainable reasons.
 *
 * @param {{
 *   userId: string,
 *   amountPoisha: number,
 *   recipientPhone?: string,
 *   type?: string
 * }} params
 * @returns {Promise<{
 *   isSuspicious: boolean,
 *   reasons: Array<{ code: string, bn: string, en: string }>,
 *   riskScore: number
 * }>}
 */
export async function evaluateGuardianRisk({ userId, amountPoisha, recipientPhone, type = 'send', date = new Date() }) {
  const reasons = [];
  let riskScore = 0.05; // baseline low risk

  // 1. Fetch user's historical outgoing transactions (last 50)
  const history = await Transaction.find({
    senderUserId: userId,
    status: 'settled',
  })
    .sort({ createdAt: -1 })
    .limit(50);

  // 2. Check: New Recipient
  if (recipientPhone) {
    const cleanPhone = recipientPhone.trim().replace(/^(\+88)/, '');
    const hasSentBefore = history.some((tx) => {
      const pastRecipientPhone = tx.metadata?.recipientPhone;
      return pastRecipientPhone && pastRecipientPhone.replace(/^(\+88)/, '') === cleanPhone;
    });

    if (!hasSentBefore && history.length > 0) {
      riskScore += 0.35;
      reasons.push({
        code: 'NEW_RECIPIENT',
        bn: 'এই প্রাপকের নম্বরে পূর্বে কখনো টাকা পাঠানো হয়নি (নতুন প্রাপক)।',
        en: 'This is a new recipient you have not sent money to before.',
      });
    }
  }

  // 3. Check: Unusually High Amount vs User History
  if (history.length >= 2) {
    const pastAmounts = history.map((t) => t.amount || 0).filter((a) => a > 0);
    const avgAmount = pastAmounts.reduce((a, b) => a + b, 0) / pastAmounts.length;
    const maxAmount = Math.max(...pastAmounts);

    // If amount is > 2.5x historical average AND > ৳1,000 (100,000 poisha)
    if (amountPoisha > avgAmount * 2.5 && amountPoisha > 100000) {
      riskScore += 0.35;
      reasons.push({
        code: 'UNUSUAL_HIGH_AMOUNT',
        bn: `লেনদেনের পরিমাণ আপনার গড় লেনদেনের (৳${(avgAmount / 100).toFixed(2)}) চেয়ে উল্লেখযোগ্যভাবে বেশি।`,
        en: `The amount is significantly higher than your typical average transfer (৳${(avgAmount / 100).toFixed(2)}).`,
      });
    } else if (amountPoisha > maxAmount && amountPoisha > 200000) {
      riskScore += 0.20;
      reasons.push({
        code: 'EXCEEDS_HISTORICAL_MAX',
        bn: `লেনদেনের পরিমাণ আপনার পূর্ববর্তী সর্বোচ্চ লেনদেনের (৳${(maxAmount / 100).toFixed(2)}) চেয়ে বেশি।`,
        en: `The transfer amount exceeds your previous highest transaction (৳${(maxAmount / 100).toFixed(2)}).`,
      });
    }
  } else if (amountPoisha >= 200000) {
    // New user transferring >= ৳2,000
    riskScore += 0.20;
    reasons.push({
      code: 'LARGE_INITIAL_TRANSFER',
      bn: 'নতুন অ্যাকাউন্টে বড় অঙ্কের লেনদেন শুরু করা হয়েছে।',
      en: 'Relatively large transfer for a new account without transaction history.',
    });
  }

  // 4. Check: Unusual Hours (Late night / early morning 1 AM - 5 AM local time)
  const currentHour = date.getHours();
  if (currentHour >= 1 && currentHour < 5) {
    riskScore += 0.15;
    reasons.push({
      code: 'UNUSUAL_TIME',
      bn: 'লেনদেনটি মধ্যরাতে বা অস্বাভাবিক সময়ে সম্পন্ন করার চেষ্টা করা হচ্ছে।',
      en: 'This transaction is occurring outside regular active hours (1 AM - 5 AM).',
    });
  }

  // 5. Check: Rapid successive transactions (>= 3 in last 10 minutes)
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentCount = history.filter((t) => new Date(t.createdAt) >= tenMinsAgo).length;
  if (recentCount >= 3) {
    riskScore += 0.25;
    reasons.push({
      code: 'RAPID_TRANSACTIONS',
      bn: 'গত ১০ মিনিটে একাধিক দ্রুত লেনদেন শনাক্ত হয়েছে।',
      en: 'Multiple rapid successive transactions detected within the last 10 minutes.',
    });
  }

  const isSuspicious = reasons.length > 0;

  return {
    isSuspicious,
    riskScore: Math.min(1.0, riskScore),
    reasons,
  };
}

export default {
  evaluateGuardianRisk,
};
