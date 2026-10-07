import { Transaction, Wallet, User } from '../models/index.js';

/**
 * Format poisha to BDT string with symbol (e.g. 50000 -> "৳500.00")
 */
export function formatBdt(poisha) {
  return `৳${((poisha || 0) / 100).toFixed(2)}`;
}

/**
 * Get start of current month and previous month date boundaries.
 */
function getDateBoundaries() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  return {
    now,
    startOfThisMonth,
    startOfLastMonth,
    endOfLastMonth,
    sevenDaysAgo,
    thirtyDaysAgo,
    ninetyDaysAgo,
  };
}

/**
 * Calculate total spending and breakdown by category for a user within a time window.
 */
export async function getSpendingSummary({ userId, period = 'month' }) {
  const { startOfThisMonth, sevenDaysAgo } = getDateBoundaries();
  const sinceDate = period === 'week' ? sevenDaysAgo : startOfThisMonth;

  const outgoingTxns = await Transaction.find({
    senderUserId: userId,
    status: 'settled',
    createdAt: { $gte: sinceDate },
  });

  let totalSpendingPoisha = 0;
  const categories = {
    send: { labelBn: 'সেন্ড মানি', labelEn: 'Send Money', totalPoisha: 0, count: 0 },
    cash_out: { labelBn: 'ক্যাশ আউট', labelEn: 'Cash Out', totalPoisha: 0, count: 0 },
    bill: { labelBn: 'বিল পরিশোধ', labelEn: 'Bill Pay', totalPoisha: 0, count: 0 },
    recharge: { labelBn: 'মোবাইল রিচার্জ', labelEn: 'Mobile Recharge', totalPoisha: 0, count: 0 },
    group_bill: { labelBn: 'গ্রুপ বিল শেয়ার', labelEn: 'Group Bill Share', totalPoisha: 0, count: 0 },
    other: { labelBn: 'অন্যান্য', labelEn: 'Other', totalPoisha: 0, count: 0 },
  };

  for (const tx of outgoingTxns) {
    const cost = tx.total || tx.amount || 0;
    totalSpendingPoisha += cost;

    const catKey = categories[tx.type] ? tx.type : 'other';
    categories[catKey].totalPoisha += cost;
    categories[catKey].count += 1;
  }

  return {
    period,
    totalSpendingPoisha,
    totalSpendingBdt: (totalSpendingPoisha / 100).toFixed(2),
    transactionCount: outgoingTxns.length,
    categories,
  };
}

/**
 * Calculate total income / credits received within a time window.
 */
export async function getIncomeSummary({ userId, period = 'month' }) {
  const { startOfThisMonth, sevenDaysAgo } = getDateBoundaries();
  const sinceDate = period === 'week' ? sevenDaysAgo : startOfThisMonth;

  const incomingTxns = await Transaction.find({
    recipientUserId: userId,
    status: 'settled',
    createdAt: { $gte: sinceDate },
  });

  let totalIncomePoisha = 0;
  let addMoneyPoisha = 0;
  let transferInPoisha = 0;

  for (const tx of incomingTxns) {
    const amt = tx.amount || 0;
    totalIncomePoisha += amt;
    if (tx.type === 'add_money') addMoneyPoisha += amt;
    else transferInPoisha += amt;
  }

  return {
    period,
    totalIncomePoisha,
    totalIncomeBdt: (totalIncomePoisha / 100).toFixed(2),
    addMoneyBdt: (addMoneyPoisha / 100).toFixed(2),
    transferInBdt: (transferInPoisha / 100).toFixed(2),
    count: incomingTxns.length,
  };
}

/**
 * Compare current month spending with previous month spending.
 */
export async function compareSpending({ userId }) {
  const { startOfThisMonth, startOfLastMonth, endOfLastMonth } = getDateBoundaries();

  // This month
  const thisMonthTxns = await Transaction.find({
    senderUserId: userId,
    status: 'settled',
    createdAt: { $gte: startOfThisMonth },
  });

  // Last month
  const lastMonthTxns = await Transaction.find({
    senderUserId: userId,
    status: 'settled',
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });

  const sumCost = (txns) => txns.reduce((acc, t) => acc + (t.total || t.amount || 0), 0);
  const thisMonthPoisha = sumCost(thisMonthTxns);
  const lastMonthPoisha = sumCost(lastMonthTxns);

  const diffPoisha = thisMonthPoisha - lastMonthPoisha;
  const isHigher = diffPoisha > 0;
  const percentageChange = lastMonthPoisha > 0
    ? Math.abs(Math.round((diffPoisha / lastMonthPoisha) * 100))
    : 0;

  return {
    thisMonthPoisha,
    thisMonthBdt: (thisMonthPoisha / 100).toFixed(2),
    lastMonthPoisha,
    lastMonthBdt: (lastMonthPoisha / 100).toFixed(2),
    diffPoisha: Math.abs(diffPoisha),
    diffBdt: (Math.abs(diffPoisha) / 100).toFixed(2),
    isHigher,
    percentageChange,
    thisMonthCount: thisMonthTxns.length,
    lastMonthCount: lastMonthTxns.length,
  };
}

/**
 * Explain user spending habits and pattern (answers "Why am I running out of money every month?").
 * Fact-grounded analysis of income vs expenses and top categories.
 */
export async function explainFinancialHabits({ userId, language = 'bn' }) {
  const { ninetyDaysAgo } = getDateBoundaries();

  const [outgoing, incoming] = await Promise.all([
    Transaction.find({ senderUserId: userId, status: 'settled', createdAt: { $gte: ninetyDaysAgo } }),
    Transaction.find({ recipientUserId: userId, status: 'settled', createdAt: { $gte: ninetyDaysAgo } }),
  ]);

  const totalSpentPoisha = outgoing.reduce((sum, t) => sum + (t.total || t.amount || 0), 0);
  const totalIncomePoisha = incoming.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Group outgoing by type
  const typeMap = {};
  for (const tx of outgoing) {
    typeMap[tx.type] = (typeMap[tx.type] || 0) + (tx.total || tx.amount || 0);
  }

  // Sort categories by expenditure
  const sortedTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedTypes[0] ? sortedTypes[0][0] : 'send';
  const topCategoryAmountPoisha = sortedTypes[0] ? sortedTypes[0][1] : 0;

  const avgMonthlyIncomeBdt = (totalIncomePoisha / 3 / 100).toFixed(2);
  const avgMonthlySpentBdt = (totalSpentPoisha / 3 / 100).toFixed(2);
  const topCategoryBdt = (topCategoryAmountPoisha / 100).toFixed(2);

  // Categorical names
  const categoryNamesBn = {
    send: 'অন্যকে টাকা পাঠানো (Send Money)',
    cash_out: 'নগদ উত্তোলন (Cash Out)',
    bill: 'ইউটিলিটি বিল পরিশোধ (Bill Pay)',
    recharge: 'মোবাইল রিচার্জ (Recharge)',
    group_bill: 'গ্রুপ বিল শেয়ার',
  };

  const categoryNamesEn = {
    send: 'Peer Transfers (Send Money)',
    cash_out: 'Cash Withdrawals (Cash Out)',
    bill: 'Utility Bills',
    recharge: 'Mobile Recharge',
    group_bill: 'Group Bill Shares',
  };

  const topName = language === 'bn'
    ? (categoryNamesBn[topCategory] || topCategory)
    : (categoryNamesEn[topCategory] || topCategory);

  let explanation = '';
  if (language === 'bn') {
    explanation = `📊 গত ৩ মাসের আর্থিক প্যাটার্ন বিশ্লেষণ:\n` +
      `• গড় মাসিক আয়/জমা: ৳${avgMonthlyIncomeBdt}\n` +
      `• গড় মাসিক মোট খরচ: ৳${avgMonthlySpentBdt}\n` +
      `• সবচেয়ে বেশি খরচ হয়েছে: ${topName} খাতে (মোট ৳${topCategoryBdt})\n\n` +
      `💡 পর্যবেক্ষণ ও পরামর্শ:\n` +
      (Number(avgMonthlySpentBdt) >= Number(avgMonthlyIncomeBdt)
        ? `আপনার গড় খরচ আয়ের প্রায় কাছাকাছি বা বেশি। ${topName} খাতে কিছুটা নিয়ন্ত্রণ রেখে ২% মাইক্রো-সেভিংস বা রাউন্ড-আপ চালু করলে ভবিষ্যৎ জরুরি তহবিলের জন্য সঞ্চয় তৈরি হবে।`
        : `আপনার নিয়মিত সঞ্চয় করার পর্যাপ্ত সুযোগ রয়েছে। একটি মাসিক সেভিংস গোল সেট করে নিতে পারেন।`);
  } else {
    explanation = `📊 Financial pattern analysis over the past 3 months:\n` +
      `• Average monthly income/credits: ৳${avgMonthlyIncomeBdt}\n` +
      `• Average monthly spending: ৳${avgMonthlySpentBdt}\n` +
      `• Largest expenditure category: ${topName} (Total: ৳${topCategoryBdt})\n\n` +
      `💡 Observation & Recommendation:\n` +
      (Number(avgMonthlySpentBdt) >= Number(avgMonthlyIncomeBdt)
        ? `Your spending is very close to or exceeds your inflow. Optimizing expenditures in ${topName} and enabling 2% micro-savings or round-ups will help build an emergency cushion.`
        : `You have healthy cash flow headroom. Setting up an automated monthly micro-savings plan will help grow your wealth.`);
  }

  return {
    avgMonthlyIncomeBdt,
    avgMonthlySpentBdt,
    topCategory,
    topCategoryBdt,
    totalSpentPoisha,
    totalIncomePoisha,
    explanation,
  };
}

export default {
  formatBdt,
  getSpendingSummary,
  getIncomeSummary,
  compareSpending,
  explainFinancialHabits,
};
