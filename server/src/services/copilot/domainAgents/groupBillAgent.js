/**
 * @file groupBillAgent.js
 * Specialized Domain Agent for Request Money, Group Bills, and Bill Splitting.
 * Supports partial slot filling (missing amount, missing participants),
 * equal & custom mathematical splits, and prefilled modal execution.
 */

import { MoneyRequest, User } from '../../../models/index.js';
import { updateTaskState, clearActiveTask } from '../taskStateManager.js';
import { emitCopilotEvent, COPILOT_EVENTS } from '../copilotEventBus.js';
import { formatBdt } from '../../agentCopilot.service.js';
import logger from '../../../utils/logger.js';

/**
 * Checks if the message belongs to Request Money or Group Bill domain.
 * @param {string} text
 * @param {Object} [taskState]
 * @returns {boolean}
 */
export function isGroupBillIntent(text, taskState, intent) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // If intent has full participants for create_group_bill or split_bill, let main agent handle PendingAction
  if (intent?.type === 'split_bill' || intent?.type === 'create_group_bill') {
    if (lower.includes('with') || lower.includes('সাথে') || lower.includes('and') || lower.includes('এবং')) {
      return false;
    }
  }

  const isSwitchingDomain =
    lower.includes('saving') ||
    lower.includes('সঞ্চয়') ||
    lower.includes('guardian') ||
    lower.includes('child') ||
    lower.includes('remind') ||
    lower.includes('schedule') ||
    lower.includes('when ');

  if (!isSwitchingDomain && taskState?.status === 'collecting') {
    if (
      taskState?.intent === 'request_money' ||
      taskState?.intent === 'group_bill' ||
      taskState?.activeWorkflow === 'group_bill' ||
      taskState?.activeTool === 'create_group_bill' ||
      taskState?.activeTool === 'request_money'
    ) {
      return true;
    }
  }

  const terms = [
    'split', 'স্প্লিট', 'group bill', 'গ্রুপ বিল', 'bill split', 'বিল ভাগ',
    'ভাগ করো', 'ভাগ করে', 'ভাগাভাগি', 'equal ভাগ',
    'request', 'রিকোয়েস্ট', 'request money', 'টাকা চাও', 'টাকা রিকোয়েস্ট', 'request পাঠাও',
    'who owes', 'কে টাকা দেয়নি', 'বাকি আছে',
  ];

  return terms.some((term) => lower.includes(term));
}

/**
 * Main execution handler for Group Bill and Request Money Agent.
 * @param {Object} context
 * @returns {Promise<Object>} Structured JSON response
 */
export async function handleGroupBillDomain(context) {
  const { userId, messageText, language = 'bn', taskState } = context;
  const lower = messageText.toLowerCase().trim();

  logger.info({ userId, messageText }, '[GroupBillAgent] Processing request/group bill intent');

  // Extract amount in BDT if present
  const amountMatch =
    messageText.match(/(?:split|bill|request|টাকা|tk|taka)?\s*(\d{2,7})/i) ||
    messageText.match(/(\d{2,7})\s*(?:taka|tk|টাকা)/i);
  const rawAmountBdt = amountMatch ? parseInt(amountMatch[1], 10) : (taskState?.parameters?.amount || null);

  // Extract phone number if present
  const phoneMatch = messageText.match(/01[3-9]\d{8}/);
  const targetPhone = phoneMatch ? phoneMatch[0] : (taskState?.parameters?.phone || null);

  // 1. Individual Request Money (e.g. "request 500 from 0171...", "রাকিবের কাছে ৫০০ টাকা চাও")
  const isIndividualRequest =
    (lower.startsWith('request ') && !lower.includes('group') && !lower.includes('split') && !lower.includes('bill')) ||
    (lower.includes('request money') && !lower.includes('group')) ||
    (lower.includes('টাকা চাও') && !lower.includes('গ্রুপ'));

  if (isIndividualRequest) {
    if (!rawAmountBdt) {
      updateTaskState(userId, {
        intent: 'request_money',
        activeWorkflow: 'request_money',
        activeTool: 'request_money',
        status: 'collecting',
        requiredParameters: ['amount'],
        missingParameters: ['amount'],
        parameters: { phone: targetPhone },
      });
      return {
        handled: true,
        reply: language === 'bn'
          ? 'কত টাকা রিকোয়েস্ট পাঠাতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ৫০০ টাকা)।'
          : 'How much money would you like to request? Please specify the amount (e.g. 500 taka).',
        clientAction: { type: 'open_modal', modal: 'request' },
        pendingAction: null,
      };
    }

    if (!targetPhone) {
      updateTaskState(userId, {
        intent: 'request_money',
        activeWorkflow: 'request_money',
        activeTool: 'request_money',
        status: 'collecting',
        requiredParameters: ['phoneNumber'],
        missingParameters: ['phoneNumber'],
        parameters: { amount: rawAmountBdt },
      });
      return {
        handled: true,
        reply: language === 'bn'
          ? `৳${rawAmountBdt} কার কাছ থেকে রিকোয়েস্ট করতে চান? অনুগ্রহ করে মোবাইল নম্বরটি দিন (যেমন: 017XXXXXXXX)।`
          : `Who would you like to request ৳${rawAmountBdt} from? Please provide the mobile number (e.g. 017XXXXXXXX).`,
        clientAction: {
          type: 'open_modal',
          modal: 'request',
          prefill: { amount: String(rawAmountBdt) },
        },
        pendingAction: null,
      };
    }

    const clientAction = {
      type: 'open_modal',
      modal: 'request',
      prefill: {
        fromPhone: targetPhone,
        phone: targetPhone,
        amount: String(rawAmountBdt),
        description: 'Payment request',
      },
    };

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `${targetPhone} নম্বরে ৳${rawAmountBdt} রিকোয়েস্ট পাঠানোর উইন্ডো খোলা হচ্ছে। আপনি সেখানে বিবরণ দেখে পাঠিয়ে দিতে পারেন।`
        : `Opening payment request modal for ৳${rawAmountBdt} to ${targetPhone}.`,
      clientAction,
      pendingAction: null,
    };
  }

  // 2. Group Bill / Split Bill Creation (e.g. "split 2400 with Rahim, Karim and Nabila", "dinner bill 1200 split")
  const isGroupCreation =
    lower.includes('split') ||
    lower.includes('group bill') ||
    lower.includes('গ্রুপ বিল') ||
    lower.includes('ভাগ করো') ||
    lower.includes('ভাগাভাগি');

  if (isGroupCreation && !lower.includes('who owes') && !lower.includes('status')) {
    // Extract title (e.g. dinner, tour, lunch, groceries, flat rent)
    const titleMatch = messageText.match(/(?:for|for a|বিল|হলো)\s+([a-zA-Z\u0980-\u09FF\s]{2,20})/i);
    const billTitle = titleMatch ? titleMatch[1].trim() : 'গ্রুপ বিল (Group Bill)';

    // Extract participants names from text (words following 'with' or 'সাথে')
    const withMatch = messageText.match(/(?:with|সাথে|মাঝে)\s+(.+)/i);
    let participants = [];
    if (withMatch) {
      participants = withMatch[1]
        .replace(/and|এবং|o|ও|me|আমি/gi, ',')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }

    if (!rawAmountBdt) {
      updateTaskState(userId, {
        intent: 'group_bill',
        activeWorkflow: 'group_bill',
        activeTool: 'create_group_bill',
        status: 'collecting',
        requiredParameters: ['totalAmount'],
        missingParameters: ['totalAmount'],
        parameters: { title: billTitle, participants },
      });
      return {
        handled: true,
        reply: language === 'bn'
          ? `"${billTitle}"-এর মোট কত টাকার বিল ভাগ করতে চান? (যেমন: ২৪০০ টাকা)`
          : `What is the total bill amount for "${billTitle}"? (e.g. 2400 taka)`,
        clientAction: { type: 'open_modal', modal: 'group_bill' },
        pendingAction: null,
      };
    }

    const totalMembers = Math.max(2, participants.length + 1); // including creator
    const perPersonBdt = Math.round(rawAmountBdt / totalMembers);

    const clientAction = {
      type: 'open_modal',
      modal: 'group_bill',
      prefill: {
        title: billTitle,
        totalAmount: String(rawAmountBdt),
        participants: participants.join(', '),
        perPerson: String(perPersonBdt),
      },
    };

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `👥 গ্রুপ বিল স্প্লিট উইন্ডো খোলা হচ্ছে!\n• বিল: ${billTitle}\n• মোট বিল: ৳${rawAmountBdt}\n• অংশগ্রহণকারী: ${totalMembers} জন (${participants.length > 0 ? participants.join(', ') + ' এবং আপনি' : 'সমান ভাগে'})\n• জনপ্রতি: প্রায় ৳${perPersonBdt}\n\nগ্রুপ বিল উইন্ডোতে কনফার্ম করুন।`
        : `👥 Opening Group Bill split modal!\n• Bill: ${billTitle}\n• Total: ৳${rawAmountBdt}\n• Members: ${totalMembers} people\n• Per Person: approx ৳${perPersonBdt}\n\nPlease confirm in the modal.`,
      clientAction,
      pendingAction: null,
    };
  }

  // 3. Query Group Bill Status (e.g. "who owes me", "গ্রুপ বিলের হিসাব দেখাও", "who has paid")
  const bills = await MoneyRequest.find({
    $or: [{ creatorId: userId }, { 'participants.userId': userId }],
  }).sort({ createdAt: -1 }).limit(3);

  if (!bills || bills.length === 0) {
    return {
      handled: true,
      reply: language === 'bn'
        ? 'বর্তমানে আপনার কোনো সক্রিয় গ্রুপ বিল নেই।'
        : 'You do not have any active group bills at the moment.',
      clientAction: { type: 'open_modal', modal: 'group_bill' },
      pendingAction: null,
    };
  }

  const latest = bills[0];
  const paidCount = latest.participants?.filter((p) => p.status === 'paid').length || 0;
  const totalCount = latest.participants?.length || 0;

  return {
    handled: true,
    reply: language === 'bn'
      ? `📊 সর্বশেষ গ্রুপ বিলের অবস্থা (${latest.title}):\n• মোট বিল: ৳${(latest.totalAmountPoisha / 100).toFixed(0)}\n• পরিশোধ করেছে: ${paidCount} / ${totalCount} জন\n• স্ট্যাটাস: ${latest.status}\n\nবিস্তারিত দেখতে গ্রুপ বিল উইন্ডো খোলা হচ্ছে...`
      : `📊 Latest Group Bill Status (${latest.title}):\n• Total: ৳${(latest.totalAmountPoisha / 100).toFixed(0)}\n• Paid: ${paidCount} / ${totalCount} members\n• Status: ${latest.status}\n\nOpening details...`,
    clientAction: { type: 'open_modal', modal: 'group_bill' },
    pendingAction: null,
  };
}
