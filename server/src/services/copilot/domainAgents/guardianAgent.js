/**
 * @file guardianAgent.js
 * Specialized Domain Agent for all Guardian Mode, Child Accounts,
 * Approvals, and Family Spending Limit Controls.
 */

import crypto from 'node:crypto';
import { User, PendingAction, GuardianLink, ProtectedProfile } from '../../../models/index.js';
import {
  getPendingApprovals,
  decideGuardianApproval,
  updateChildControlMode,
} from '../../guardian.service.js';
import { updateTaskState, clearActiveTask } from '../taskStateManager.js';
import { emitCopilotEvent, COPILOT_EVENTS } from '../copilotEventBus.js';
import { formatBdt } from '../../agentCopilot.service.js';
import logger from '../../../utils/logger.js';

/**
 * Checks if the message belongs to the Guardian domain.
 * Robust against typos ("gchildren", "liimit"), slang, and partial text.
 * @param {string} text
 * @param {Object} [taskState]
 * @returns {boolean}
 */
export function isGuardianIntent(text, taskState, intent) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  const isSwitchingDomain =
    lower.includes('split') ||
    lower.includes('bill') ||
    lower.includes('request') ||
    lower.includes('সঞ্চয়') ||
    lower.includes('সেভিংস') ||
    lower.includes('saving') ||
    lower.includes('save') ||
    lower.includes('remind') ||
    lower.includes('schedule') ||
    lower.includes('rule') ||
    lower.includes('when ');

  if (!isSwitchingDomain && taskState?.status === 'collecting') {
    if (
      taskState?.intent === 'guardian_mode' ||
      taskState?.activeWorkflow === 'guardian_mode' ||
      taskState?.activeTool?.startsWith('guardian_') ||
      taskState?.activeTool === 'add_child_account'
    ) {
      return true;
    }
  }

  const guardianTerms = [
    'guardian', 'guardians', 'গার্ডিয়ান', 'গার্ডিয়ান', 'অভিভাবক',
    'child', 'children', 'gchild', 'gchildren', 'সন্তান', 'বাচ্চা', 'ছেলে', 'মেয়ে',
    'ward', 'minor', 'parent',
  ];

  return guardianTerms.some((term) => lower.includes(term));
}

/**
 * Main execution handler for the Guardian Domain Agent.
 * @param {Object} context
 * @returns {Promise<Object>} Structured JSON response
 */
export async function handleGuardianDomain(context) {
  const { userId, messageText, language = 'bn', taskState } = context;
  const lower = messageText.toLowerCase().trim();

  logger.info({ userId, messageText }, '[GuardianAgent] Processing guardian intent');

  // Extract phone number if present
  const phoneMatch = messageText.match(/01[3-9]\d{8}/);
  const targetPhone = phoneMatch
    ? phoneMatch[0]
    : (taskState?.status === 'collecting' ? (taskState?.parameters?.phoneNumber || taskState?.parameters?.childPhone || null) : null);

  // Extract limit if present (flexible against typos like "liimit", "সীমা", "limit 800", "900 tk limit")
  const limitMatch =
    messageText.match(/(?:l+i+m+i+t|লিমিট|সীমা|দৈনিক সীমা|daily\s*limit)\s*[:=]?\s*(\d+)/i) ||
    messageText.match(/(\d+)\s*(?:tk|taka|টাকা)?\s*(?:l+i+m+i+t|সীমা|লিমিট)/i) ||
    messageText.match(/(?:l+i+m+i+t|লিমিট|সীমা)\s*(\d+)\s*(?:tk|taka|টাকা)?/i);
  const customLimit = limitMatch ? parseInt(limitMatch[1], 10) : (taskState?.parameters?.dailyLimit || 500);

  // 1. Transaction Approval by Guardian (e.g., "approve child payment", "অনুমোদন করো", "approve 500")
  const isApproval =
    lower.includes('approve') ||
    lower.includes('অনুমোদন') ||
    lower.includes('accept') ||
    lower.includes('মঞ্জুর');

  if (isApproval) {
    const pendingList = await getPendingApprovals(userId);
    if (!pendingList || pendingList.length === 0) {
      return {
        handled: true,
        reply: language === 'bn'
          ? 'এই মুহূর্তে আপনার কোনো সন্তানের লেনদেন অনুমোদনের জন্য অপেক্ষমাণ নেই।'
          : 'No child transactions are currently held awaiting your approval.',
        clientAction: { type: 'open_modal', modal: 'guardian' },
        pendingAction: null,
      };
    }

    const targetTxn = pendingList[0];
    const txnId = targetTxn.id || targetTxn._id?.toString();
    const txnAmount = targetTxn.amountPoisha || targetTxn.amount || 0;
    const actionId = crypto.randomUUID();
    const actionArgs = {
      guardianUserId: userId,
      transactionId: txnId,
      decision: 'approved',
    };
    const actionHash = crypto.createHash('sha256').update(actionId + JSON.stringify(actionArgs)).digest('hex');

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'guardian_decision',
      args: actionArgs,
      preview: {
        actionType: 'guardian_decision',
        title: language === 'bn' ? 'সন্তানের লেনদেন অনুমোদন নিশ্চিতকরণ' : 'Confirm Child Payment Approval',
        amountPoisha: txnAmount,
        feePoisha: targetTxn.feePoisha || targetTxn.fee || 0,
        totalPoisha: targetTxn.totalPoisha || targetTxn.total || txnAmount,
        recipientLabel: `${targetTxn.sender?.name || targetTxn.senderUserId?.name || 'Child'} ➔ ${targetTxn.recipientUserId?.name || 'Recipient'}`,
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `সন্তানের ${formatBdt(txnAmount)} লেনদেন অনুমোদন করতে নিচের কার্ডে আপনার পিন (PIN) দিন।`
        : `To approve child transaction of ${formatBdt(txnAmount)}, please confirm with your PIN below.`,
      pendingAction: pending,
      clientAction: null,
    };
  }

  // 2. Update Child Spending Limit (e.g., "child limit 1500 koro", "set limit 1000", "সীমা পরিবর্তন")
  const isUpdateLimit =
    (lower.includes('change') || lower.includes('update') || lower.includes('set') || lower.includes('পরিবর্তন') || lower.includes('বাড়াও') || lower.includes('কমাও')) &&
    (lower.includes('limit') || lower.includes('সীমা') || lower.includes('লিমিট'));

  if (isUpdateLimit && limitMatch) {
    const profiles = await ProtectedProfile.find({ guardianId: userId, status: { $ne: 'inactive' } }).populate('childUserId');
    if (!profiles || profiles.length === 0) {
      return {
        handled: true,
        reply: language === 'bn'
          ? 'আপনার অ্যাকাউন্টের সাথে কোনো সন্তানের প্রোফাইল যুক্ত নেই। প্রথমে সন্তান যুক্ত করুন।'
          : 'No active child account linked to your profile. Please link a child first.',
        clientAction: { type: 'open_modal', modal: 'guardian' },
        pendingAction: null,
      };
    }

    const targetProfile = (targetPhone && profiles.find((p) => p.childUserId?.phone === targetPhone)) || profiles[0];
    await updateChildControlMode({
      guardianUserId: userId,
      childUserId: targetProfile.childUserId._id,
      controlMode: targetProfile.controlMode || 'LIMITED',
      dailyLimitPoisha: customLimit * 100,
    });

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `✅ ${targetProfile.childUserId.name || 'সন্তানের'}-এর দৈনিক খরচ করার সীমা ৳${customLimit} নির্ধারণ করা হয়েছে।`
        : `✅ Daily spending limit for ${targetProfile.childUserId.name || 'child'} updated to ৳${customLimit}.`,
      clientAction: { type: 'open_modal', modal: 'guardian' },
      pendingAction: null,
    };
  }

  // 3. Add Child Account (e.g., "add child 0177...", "gchildren add koro 900 tk liimit die", "সন্তান যুক্ত")
  const isAddChild =
    lower.includes('add') ||
    lower.includes('যুক্ত') ||
    lower.includes('set') ||
    lower.includes('link') ||
    lower.includes('বানাও') ||
    lower.includes('create') ||
    Boolean(targetPhone);

  if (isAddChild) {
    const clientAction = {
      type: 'open_modal',
      modal: 'guardian',
      prefill: {
        childPhone: targetPhone || '',
        childName: 'Family Member',
        dailyLimit: String(customLimit),
      },
    };

    if (!targetPhone) {
      updateTaskState(userId, {
        intent: 'guardian_mode',
        activeWorkflow: 'guardian_mode',
        activeTool: 'add_child_account',
        status: 'collecting',
        requiredParameters: ['phoneNumber'],
        missingParameters: ['phoneNumber'],
        parameters: { dailyLimit: customLimit },
        accumulatedParams: { dailyLimit: customLimit },
        clientAction,
      });

      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'guardian_mode',
        message: 'Child phone number missing for Guardian Mode',
        actionState: taskState,
      });

      return {
        handled: true,
        reply: language === 'bn'
          ? `অভিভাবক বা সন্তানের মোবাইল নম্বরটি দিন (যেমন: 017XXXXXXXX)। সন্তান যুক্ত করার উইন্ডো খোলা হচ্ছে (দৈনিক সীমা: ৳${customLimit})।`
          : `Please provide the guardian or child phone number (e.g. 017XXXXXXXX). Opening Guardian controls with daily limit ৳${customLimit}.`,
        clientAction,
        pendingAction: null,
      };
    }

    updateTaskState(userId, {
      intent: 'guardian_mode',
      activeWorkflow: 'guardian_mode',
      activeTool: 'add_child_account',
      status: 'ready',
      missingParameters: [],
      parameters: {
        phoneNumber: targetPhone,
        childPhone: targetPhone,
        childName: 'Family Member',
        dailyLimit: customLimit,
      },
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'guardian_mode',
      message: `Guardian setup ready for ${targetPhone} with limit ৳${customLimit}`,
      actionState: taskState,
      persistNotification: true,
    });

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `${targetPhone} নম্বরের জন্য দৈনিক ৳${customLimit} সীমার অভিভাবক নিয়ন্ত্রণ উইন্ডো খোলা হচ্ছে। আপনি সেখানে পিন ও সেটিংস নিশ্চিত করে যুক্ত করতে পারেন।`
        : `Opening Guardian controls window for ${targetPhone} with daily limit ৳${customLimit}. You can set PIN to complete setup.`,
      clientAction,
      pendingAction: null,
    };
  }

  // 4. Query Guardian Status & Linked Children (e.g., "my children", "child status", "গার্ডিয়ান মোড")
  clearActiveTask(userId);
  const profiles = await ProtectedProfile.find({ guardianId: userId, status: 'active' }).populate('childUserId');
  const count = profiles.length;

  const childrenSummaryBn = count > 0
    ? profiles.map((p) => `• ${p.childUserId?.name || 'Child'} (${p.childUserId?.phone || ''}): দৈনিক সীমা ৳${((p.dailyLimitPoisha || 0) / 100).toFixed(0)}`).join('\n')
    : '• বর্তমানে কোনো সন্তানের অ্যাকাউন্ট যুক্ত নেই।';

  const childrenSummaryEn = count > 0
    ? profiles.map((p) => `• ${p.childUserId?.name || 'Child'} (${p.childUserId?.phone || ''}): Daily limit ৳${((p.dailyLimitPoisha || 0) / 100).toFixed(0)}`).join('\n')
    : '• No child accounts currently linked.';

  return {
    handled: true,
    reply: language === 'bn'
      ? `🛡️ অভিভাবক নিয়ন্ত্রণ প্রোফাইল:\n• স্ট্যাটাস: সক্রিয়\n• যুক্ত সন্তানের সংখ্যা: ${count}\n\nসন্তানদের তালিকা:\n${childrenSummaryBn}`
      : `🛡️ Guardian Mode Profile:\n• Status: Active\n• Linked Children: ${count}\n\nChildren List:\n${childrenSummaryEn}`,
    clientAction: { type: 'open_modal', modal: 'guardian' },
    pendingAction: null,
  };
}
