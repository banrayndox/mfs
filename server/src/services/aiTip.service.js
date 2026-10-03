import { AiTip, Transaction, Wallet, User } from '../models/index.js';
import logger from '../utils/logger.js';

/**
 * Validate that every number present in the generated text exists in the facts object.
 * Checks both ASCII numbers (123) and Bengali numerals (১২৩).
 */
export function validateFactNumbers(text, facts) {
  if (!text) return true;

  // Extract all numbers from facts (including nested values)
  const extractNumbers = (val) => {
    let nums = [];
    if (typeof val === 'number') nums.push(String(val));
    else if (typeof val === 'string' && /^\d+$/.test(val)) nums.push(val);
    else if (typeof val === 'object' && val !== null) {
      for (const k of Object.keys(val)) {
        nums = nums.concat(extractNumbers(val[k]));
      }
    }
    return nums;
  };

  const allowedNumberStrings = extractNumbers(facts);

  // Convert Bengali numerals to Western digits for comparison
  const bnToEnMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const normalizedText = text.replace(/[০-৯]/g, (d) => bnToEnMap[d]);

  // Find all numeric sequences in text (strip commas, periods in currency like 500.00)
  const matches = normalizedText.match(/\b\d+(\.\d+)?\b/g) || [];

  for (const match of matches) {
    const intPart = match.split('.')[0];
    const isAllowed = allowedNumberStrings.some((allowed) => {
      return (
        allowed === match ||
        allowed === intPart ||
        String(Number(allowed) / 100) === match ||
        String(Number(allowed) / 100) === intPart ||
        allowed.includes(intPart)
      );
    });

    if (!isAllowed) {
      logger.warn({ match, allowedNumberStrings }, 'Number validator rejected generated text: unauthorized number detected.');
      return false;
    }
  }

  return true;
}

/**
 * Deterministically generate fact-grounded feedback templates for any transaction.
 */
export function generateDeterministicTip(facts) {
  const { transactionType, bdtAmount, feeBdt, recipientLabel, billerName, goalName } = facts;

  switch (transactionType) {
    case 'send':
      return {
        tipBn: `${recipientLabel || 'প্রাপক'}-কে ৳${bdtAmount} পাঠানো হয়েছে। এটি সফলভাবে সম্পন্ন হয়েছে।`,
        tipEn: `Sent ৳${bdtAmount} to ${recipientLabel || 'recipient'}. Transfer completed successfully.`,
        explanationBn: `নিয়মিত প্রাপক হলে কন্টাক্ট সেভ করে রাখতে পারেন।`,
        explanationEn: `You can save this recipient as a contact for faster transfers.`,
      };

    case 'cash_out':
      return {
        tipBn: `৳${bdtAmount} ক্যাশ আউট সম্পন্ন হয়েছে। সার্ভিস ফি ছিল ৳${feeBdt}।`,
        tipEn: `Cashed out ৳${bdtAmount}. The cash-out fee was ৳${feeBdt}.`,
        explanationBn: `এজেন্ট পয়েন্টে ক্যাশ আউট চার্জ নির্ধারিত ফি অনুযায়ী কেটে নেওয়া হয়েছে।`,
        explanationEn: `Agent cash-out charge was calculated according to transparent fee policy.`,
      };

    case 'bill':
      return {
        tipBn: `${billerName || 'বিদ্যুৎ'} বিলের ৳${bdtAmount} সফলভাবে পরিশোধিত হয়েছে।`,
        tipEn: `Your ${billerName || 'utility'} bill of ৳${bdtAmount} was paid successfully.`,
        explanationBn: `এটি নিয়মিত বিল হলে পরবর্তী মাসের জন্য শিডিউল করে রাখতে পারেন।`,
        explanationEn: `This appears to be a regular bill. You can schedule it for automatic future payment.`,
      };

    case 'recharge':
      return {
        tipBn: `৳${bdtAmount} মোবাইল রিচার্জ সফল হয়েছে।`,
        tipEn: `Mobile recharge of ৳${bdtAmount} completed successfully.`,
        explanationBn: `আপনার অপারেটরে ব্যালেন্স অবিলম্বে যুক্ত হবে।`,
        explanationEn: `Balance will be credited immediately to your operator.`,
      };

    case 'savings_deposit':
      return {
        tipBn: `সঞ্চয়ী লক্ষ্য "${goalName || 'সাধারণ'}"-এ ৳${bdtAmount} জমা হয়েছে।`,
        tipEn: `Deposited ৳${bdtAmount} into savings goal "${goalName || 'General'}".`,
        explanationBn: `নিয়মিত সঞ্চয় আপনার ভবিষ্যৎ লক্ষ্য অর্জনে সাহায্য করবে।`,
        explanationEn: `Regular savings deposits help you reach your financial milestones faster.`,
      };

    case 'initial_credit':
      return {
        tipBn: `অ্যাকাউন্টে ৳${bdtAmount} স্বাগতম ডেমো ব্যালেন্স যুক্ত করা হয়েছে।`,
        tipEn: `Welcome demo balance of ৳${bdtAmount} added to your account.`,
        explanationBn: `এই ব্যালেন্স দিয়ে আপনি সব ফিচার নিরাপদে টেস্ট করতে পারবেন।`,
        explanationEn: `You can use this simulated balance to test all features safely.`,
      };

    default:
      return {
        tipBn: `৳${bdtAmount} এর লেনদেন সফল হয়েছে।`,
        tipEn: `Transaction of ৳${bdtAmount} completed successfully.`,
        explanationBn: `লেনদেনটি সফলভাবে লেজারে যুক্ত হয়েছে।`,
        explanationEn: `The transaction has been settled and recorded in the double-entry ledger.`,
      };
  }
}

/**
 * Generate and persist AI tip for a settled transaction.
 * Runs asynchronously and never blocks transaction commitment.
 */
export async function createAiTipForTransaction(txnId) {
  try {
    const txn = await Transaction.findById(txnId)
      .populate('senderUserId', 'name phone')
      .populate('recipientUserId', 'name phone accountType agentProfile');

    if (!txn || txn.status !== 'settled') return null;

    const bdtAmount = txn.amount / 100;
    const feeBdt = (txn.fee || 0) / 100;

    const facts = {
      transactionType: txn.type,
      amountPoisha: txn.amount,
      bdtAmount,
      feePoisha: txn.fee,
      feeBdt,
      recipientLabel: txn.recipientUserId?.agentProfile?.businessName || txn.recipientUserId?.name || txn.metadata?.recipientPhone || 'Recipient',
      billerName: txn.metadata?.billerId || txn.metadata?.billerName,
      goalName: txn.metadata?.goalName,
    };

    // Use deterministic generator (and validate numbers)
    const generated = generateDeterministicTip(facts);
    const validBn = validateFactNumbers(generated.tipBn, facts);
    const validEn = validateFactNumbers(generated.tipEn, facts);

    const isTemplateFallback = !validBn || !validEn;

    const aiTip = await AiTip.create({
      txnId: txn._id,
      userId: txn.senderUserId?._id || txn.recipientUserId?._id,
      category: txn.type === 'cash_out' ? 'cash_out_fee' : txn.type === 'bill' ? 'recurring_bill_schedule' : 'general',
      factsJson: facts,
      tipBn: generated.tipBn,
      tipEn: generated.tipEn,
      explanationBn: generated.explanationBn,
      explanationEn: generated.explanationEn,
      isTemplateFallback,
    });

    logger.debug({ tipId: aiTip._id, txnId }, 'AiTip generated and saved.');
    return aiTip;
  } catch (err) {
    logger.error({ err, txnId }, 'Failed to generate AiTip for transaction (non-fatal)');
    return null;
  }
}

export default {
  validateFactNumbers,
  generateDeterministicTip,
  createAiTipForTransaction,
};
