/**
 * @file confirmationManager.js
 * Confirmation Engine and Security Gate for Guardian MFS AI Copilot.
 * Prepares PendingAction records, computes cryptographic action hashes,
 * formats bilingual confirmation prompts, and enforces security policies.
 */

import crypto from 'crypto';
import { PendingAction } from '../../models/index.js';
import { computeCanonicalActionHash } from '../auth.service.js';

/**
 * Prepares a high-risk action for user confirmation and step-up authentication.
 * Stores a PendingAction in MongoDB with a 5-minute expiration and canonical SHA-256 hash.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.tool
 * @param {Record<string, any>} params.args
 * @param {object} params.preview
 * @returns {Promise<object>} The saved PendingAction document
 */
export async function preparePendingConfirmation({ userId, tool, args, preview }) {
  const actionId = `act-${crypto.randomBytes(8).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  // Map tool to actionType for auth token verification
  const actionTypeMap = {
    send_money: 'send_money',
    cash_out: 'cash_out',
    add_money: 'add_money',
    mobile_recharge: 'mobile_recharge',
    pay_bill: 'pay_bill',
    create_group_bill: 'create_group_bill',
    create_schedule: 'create_schedule',
    create_rule: 'create_rule',
    guardian_decision: 'guardian_decision',
    add_child_account: 'add_child_account',
  };

  const actionType = actionTypeMap[tool] || tool;
  const actionHash = computeCanonicalActionHash({ actionId, actionType, args });

  const pending = await PendingAction.create({
    actionId,
    userId,
    tool,
    actionHash,
    args: { ...args, actionType },
    preview: {
      ...preview,
      expiresAt: expiresAt.toISOString(),
    },
    expiresAt,
    status: 'pending',
  });

  return pending;
}

/**
 * Generates an explicit, natural confirmation prompt for the user.
 * @param {string} tool
 * @param {object} preview
 * @param {string} [language='bn']
 * @returns {string}
 */
export function formatConfirmationPrompt(tool, preview, language = 'bn') {
  const isBn = language === 'bn';
  const amtBdt = preview?.amountPoisha ? (preview.amountPoisha / 100).toFixed(2) : '0.00';
  const feeBdt = preview?.feePoisha ? (preview.feePoisha / 100).toFixed(2) : '0.00';
  const totalBdt = preview?.totalPoisha ? (preview.totalPoisha / 100).toFixed(2) : amtBdt;

  switch (tool) {
    case 'send_money': {
      const recipient = preview.recipientLabel || preview.recipientPhone;
      return isBn
        ? `${recipient}-কে ৳${amtBdt} পাঠানো হবে (চার্জ ৳০.০০)। এগিয়ে যেতে চান?`
        : `Ready to send ৳${amtBdt} to ${recipient} (Fee: ৳0.00). Confirm?`;
    }

    case 'cash_out': {
      const agent = preview.agentLabel || 'Agent';
      return isBn
        ? `${agent}-এর মাধ্যমে ৳${amtBdt} ক্যাশ আউট (ফি ১.৫% = ৳${feeBdt}, মোট ৳${totalBdt}) করা হবে। কনফার্ম করবেন?`
        : `Ready to cash out ৳${amtBdt} via ${agent} (1.5% fee = ৳${feeBdt}, total = ৳${totalBdt}). Confirm?`;
    }

    case 'pay_bill': {
      const biller = preview.billerLabel || preview.billerId || 'Bill';
      return isBn
        ? `${biller} বিল বাবদ ৳${amtBdt} পরিশোধ করতে চান?`
        : `Ready to pay ৳${amtBdt} for ${biller}. Confirm?`;
    }

    case 'mobile_recharge': {
      const phone = preview.recipientPhone;
      const op = preview.operator || '';
      return isBn
        ? `${phone} (${op}) নম্বরে ৳${amtBdt} রিচার্জ করতে চান?`
        : `Ready to recharge ৳${amtBdt} to ${phone} (${op}). Confirm?`;
    }

    case 'create_group_bill': {
      const count = preview.participantCount || 2;
      const eachBdt = preview.eachSharePoisha ? (preview.eachSharePoisha / 100).toFixed(2) : amtBdt;
      return isBn
        ? `৳${amtBdt}-এর গ্রুপ বিল ${count} জনের মধ্যে সমানভাবে ভাগ করলে প্রত্যেকের ৳${eachBdt} হবে। Group bill তৈরি করব?`
        : `Split ৳${amtBdt} equally among ${count} people (৳${eachBdt} each). Create group bill?`;
    }

    case 'create_schedule': {
      const freq = preview.frequency || 'monthly';
      return isBn
        ? `নিয়মিত ${freq} ভিত্তিতে ৳${amtBdt}-এর পেমেন্ট শিডিউল চালু করতে চান?`
        : `Ready to set up a ${freq} payment schedule for ৳${amtBdt}. Confirm?`;
    }

    case 'create_rule': {
      return isBn
        ? `এই শর্তযুক্ত অটোমেশন রুলটি চালু করতে চান?`
        : `Ready to activate this conditional automation rule. Confirm?`;
    }

    case 'guardian_approve': {
      const dec = preview.decision === 'rejected' ? 'বাতিল' : 'অনুমোদন';
      return isBn
        ? `সন্তানের ৳${amtBdt} লেনদেন ${dec} করতে চান?`
        : `Ready to ${preview.decision} child transaction of ৳${amtBdt}. Confirm?`;
    }

    case 'add_child_account': {
      const child = preview.childName || 'Child';
      const phone = preview.childPhone || '';
      return isBn
        ? `${child} (${phone})-কে চাইল্ড অ্যাকাউন্ট হিসেবে যুক্ত করতে চান?`
        : `Add ${child} (${phone}) as a protected child account. Confirm?`;
    }

    default:
      return isBn ? 'আপনি কি এটি নিশ্চিত করতে চান?' : 'Do you want to confirm this action?';
  }
}

export default {
  preparePendingConfirmation,
  formatConfirmationPrompt,
};
