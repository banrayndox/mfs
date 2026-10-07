/**
 * @file responseGenerator.js
 * Grounded Natural Language Response Generator for Guardian MFS AI Copilot.
 * Ensures all numbers, balances, fees, and next steps strictly reflect
 * factual backend state without LLM hallucination.
 */

import { formatBdt } from '../financialAnalysis.service.js';

/**
 * Formats clarification requests when parameters are missing.
 * @param {Object} params
 * @param {string} params.question
 * @param {string[]} params.missingFields
 * @param {string} [params.language='bn']
 * @returns {string}
 */
export function formatClarificationResponse({ question, missingFields = [], language = 'bn' }) {
  if (question) return question;

  if (missingFields.includes('recipient') && missingFields.includes('amount')) {
    return language === 'bn'
      ? 'কাকে এবং কত টাকা পাঠাতে চান দয়া করে জানাবেন?'
      : 'Who would you like to send money to, and what is the amount?';
  }

  if (missingFields.includes('recipient')) {
    return language === 'bn'
      ? 'কাকে টাকা পাঠাতে চান? মোবাইল নম্বর বা প্রাপকের নাম উল্লেখ করুন।'
      : 'Who would you like to send to? Please provide their name or mobile number.';
  }

  if (missingFields.includes('amount')) {
    return language === 'bn'
      ? 'কত টাকা পাঠাতে বা লেনদেন করতে চান?'
      : 'How much money would you like to transfer or pay?';
  }

  return language === 'bn'
    ? 'অনুগ্রহ করে লেনদেনের প্রয়োজনীয় তথ্যসমূহ দিন।'
    : 'Please provide the required transaction details.';
}

/**
 * Formats a clear confirmation prompt for pending financial mutations.
 * @param {Object} params
 * @param {string} params.tool
 * @param {Object} params.pendingAction
 * @param {string} [params.language='bn']
 * @returns {string}
 */
export function formatConfirmationPrompt({ tool, pendingAction, language = 'bn' }) {
  const preview = pendingAction?.preview || {};
  const amtBdt = preview.amountPoisha ? (preview.amountPoisha / 100).toFixed(2) : '0.00';
  const feeBdt = preview.feePoisha ? (preview.feePoisha / 100).toFixed(2) : '0.00';
  const totalBdt = preview.totalDebitedPoisha
    ? (preview.totalDebitedPoisha / 100).toFixed(2)
    : amtBdt;

  if (tool === 'send_money') {
    const recipient = preview.recipientLabel || 'প্রাপক';
    return language === 'bn'
      ? `আপনি কি ${recipient}-কে ৳${amtBdt} পাঠাতে চান? (ফি: ৳${feeBdt}, মোট: ৳${totalBdt})\nনিশ্চিত করতে "হ্যাঁ" বলুন বা পিন প্রদান করুন।`
      : `Are you sure you want to send ৳${amtBdt} to ${recipient}? (Fee: ৳${feeBdt}, Total: ৳${totalBdt})\nReply "Yes" or enter PIN to confirm.`;
  }

  if (tool === 'cash_out') {
    const agent = preview.agentLabel || preview.agentPhone || 'এজেন্ট';
    return language === 'bn'
      ? `এজেন্ট ${agent} থেকে ৳${amtBdt} ক্যাশ আউট করতে চান? ক্যাশ আউট ফি ১.৫% (৳${feeBdt}) সহ মোট ৳${totalBdt} কর্তন করা হবে। নিশ্চিত করতে আপনার পিন দিন।`
      : `Confirm cash out of ৳${amtBdt} from agent ${agent}? Cash-out fee is 1.5% (৳${feeBdt}), total deduction ৳${totalBdt}. Please enter PIN to confirm.`;
  }

  if (tool === 'pay_bill') {
    const biller = preview.billerId || 'ইউটিলিটি';
    return language === 'bn'
      ? `${biller} এর ৳${amtBdt} বিল পরিশোধ নিশ্চিত করবেন? পিন দিয়ে কনফার্ম করুন।`
      : `Confirm payment of ৳${amtBdt} for ${biller}? Enter your PIN to confirm.`;
  }

  if (tool === 'mobile_recharge') {
    const phone = preview.recipientPhone || 'মোবাইল';
    return language === 'bn'
      ? `${phone} নম্বরে ৳${amtBdt} রিচার্জ নিশ্চিত করতে আপনার পিন দিন।`
      : `Confirm mobile recharge of ৳${amtBdt} to ${phone}? Enter your PIN to confirm.`;
  }

  if (tool === 'create_group_bill') {
    const count = preview.participantCount || 0;
    const perPerson = preview.perPersonPoisha
      ? (preview.perPersonPoisha / 100).toFixed(2)
      : '0.00';
    return language === 'bn'
      ? `মোট ৳${amtBdt} টাকার গ্রুপ বিল ${count} জনের মধ্যে ভাগ করতে চান? (জনপ্রতি ৳${perPerson})। নিশ্চিত করতে হ্যাঁ বলুন।`
      : `Confirm group bill of ৳${amtBdt} split among ${count} members (৳${perPerson} each)? Reply Yes to confirm.`;
  }

  return language === 'bn'
    ? `আপনি কি এই কার্যক্রমটি নিশ্চিত করতে চান? এগিয়ে যেতে পিন দিন।`
    : `Would you like to confirm this action? Enter PIN to proceed.`;
}

/**
 * Formats a security rejection notification.
 * @param {Object} params
 * @param {string} params.type
 * @param {string} [params.language='bn']
 * @returns {string}
 */
export function formatSecurityRejection({ type, language = 'bn' }) {
  if (type === 'injection') {
    return language === 'bn'
      ? '⚠️ নিরাপত্তা সতর্কতা: অননুমোদিত নির্দেশ, সিস্টেম প্রম্পট বা পলিসি বাইপাসের চেষ্টা শনাক্ত হয়েছে। এই কমান্ডটি বাতিল করা হলো।'
      : '⚠️ Security Alert: Unauthorized instructions, system prompt, or policy override detected. This command has been rejected.';
  }

  if (type === 'secret_probe') {
    return language === 'bn'
      ? '🔒 গোপনীয়তা ও নিরাপত্তা বিজ্ঞপ্তি: আপনার পিন (PIN), ওটিপি (OTP) বা পাসওয়ার্ড অত্যন্ত গোপনীয়। এই সংবেদনশীল তথ্যসমূহ সম্পূর্ণ এনক্রিপ্টেড এবং এআই বা কোনো প্রতিনিধির দেখার অনুমতি নেই। পিন পরিবর্তন করতে "Change PIN" বলুন। কখনো কারো সাথে পিন বা ওটিপি শেয়ার করবেন না।'
      : '🔒 Privacy & Security Notice: Your PIN, OTP, and passwords are confidential credentials. They are strictly encrypted and never accessible to the AI or support agents. To change your PIN, say "Change PIN". Never share your PIN or OTP with anyone.';
  }

  if (type === 'cross_user_probe') {
    return language === 'bn'
      ? '🛡️ নিরাপত্তা ও গোপনীয়তা সীমা: আপনি শুধুমাত্র আপনার নিজস্ব অ্যাকাউন্টের তথ্য দেখতে পারবেন। অন্য কোনো ব্যবহারকারীর ব্যালেন্স, লেনদেন বা ব্যক্তিগত তথ্য দেখার অনুমতি নেই।'
      : '🛡️ Privacy & Security Boundary: You can only access your own account information. Accessing balances, transactions, or data of other users is strictly restricted.';
  }

  return language === 'bn'
    ? '⚠️ নিরাপত্তা বা পলিসি বিধিনিষেধের কারণে এই অনুরোধটি প্রক্রিয়া করা সম্ভব হচ্ছে না।'
    : '⚠️ This request cannot be processed due to security or policy restrictions.';
}

export default {
  formatClarificationResponse,
  formatConfirmationPrompt,
  formatSecurityRejection,
};
