/**
 * @file scheduleRuleAgent.js
 * Specialized Domain Agent for Reminders, One-Time Schedules,
 * Recurring Schedules, and Conditional Trigger-Action Rules.
 * Operates via structured JSON payloads with partial slot-filling and modal integration.
 */

import { Schedule, Rule, Notification } from '../../../models/index.js';
import { updateTaskState, clearActiveTask } from '../taskStateManager.js';
import { emitCopilotEvent, COPILOT_EVENTS } from '../copilotEventBus.js';
import { formatBdt } from '../../agentCopilot.service.js';
import logger from '../../../utils/logger.js';

/**
 * Checks if the message belongs to Reminders, Schedules, or Conditional Rules.
 * @param {string} text
 * @param {Object} [taskState]
 * @returns {boolean}
 */
export function isScheduleRuleIntent(text, taskState, intent) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // If intent is already a known query, savings, or memory, DO NOT intercept!
  if (
    intent?.type === 'financial_health' ||
    intent?.type === 'category_spending' ||
    intent?.type === 'biggest_transactions' ||
    intent?.type === 'balance' ||
    intent?.type === 'reminders_list' ||
    intent?.type === 'reminder_cancel' ||
    intent?.type === 'schedules_list' ||
    intent?.type === 'schedule_cancel' ||
    intent?.type === 'rules_list' ||
    intent?.type === 'rule_toggle' ||
    intent?.type === 'set_percentage_savings' ||
    intent?.type === 'set_roundup_savings' ||
    intent?.type === 'disable_savings' ||
    intent?.type === 'create_savings_goal' ||
    intent?.type === 'update_savings_goal' ||
    intent?.type === 'split_bill' ||
    intent?.type === 'create_group_bill'
  ) {
    return false;
  }

  // If it's an inquiry about money running out or spending explanation, DO NOT intercept
  if (
    lower.includes('running out of money') ||
    lower.includes('why am i') ||
    lower.includes('কেন আমার টাকা') ||
    lower.includes('টাকা শেষ') ||
    lower.includes('খরচ কেন')
  ) {
    return false;
  }

  // If it's a micro-savings command like "save 5% from every transaction"
  if (
    (lower.includes('save') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস')) &&
    (lower.includes('%') || lower.includes('percent') || lower.includes('round-up') || lower.includes('round up'))
  ) {
    return false;
  }

  // If it's list or cancel reminders/schedules/rules, let the dedicated read tools handle it
  if (
    (lower.includes('show') || lower.includes('cancel') || lower.includes('list') || lower.includes('দেখাও') || lower.includes('বাতিল')) &&
    (lower.includes('reminder') || lower.includes('schedule') || lower.includes('rule') || lower.includes('রিমাইন্ডার') || lower.includes('শিডিউল') || lower.includes('রুল'))
  ) {
    return false;
  }

  // If it's a multi-step composite command like "send 500 to Kabir Agent and remind me"
  if (lower.includes('and remind me') || lower.includes('এবং মনে করিয়ে দিও')) {
    return false;
  }

  if (taskState?.status === 'collecting') {
    if (
      taskState?.intent === 'reminder' ||
      taskState?.intent === 'schedule' ||
      taskState?.intent === 'rules' ||
      taskState?.activeWorkflow === 'reminder' ||
      taskState?.activeWorkflow === 'schedule' ||
      taskState?.activeWorkflow === 'rules'
    ) {
      return true;
    }
  }

  const terms = [
    'remind', 'reminder', 'রিমাইন্ডার', 'মনে করিয়ে', 'মনে করিয়ে দিও',
    'schedule', 'শিডিউল', 'কালকে', 'আগামীকাল', 'tomorrow',
    'every friday', 'every month', 'every day', 'every week',
    'প্রতি মাসে', 'প্রতি সপ্তাহে', 'প্রতি শুক্রবার', 'প্রতিদিন',
    'when ', 'if ', 'যখন', 'টাকা ঢুকলে', 'টাকা আসলে', 'ব্যালেন্স কমে গেলে',
    'rule', 'রুল', 'শর্ত',
  ];

  return terms.some((term) => lower.includes(term));
}

/**
 * Main execution handler for Schedule and Rule Agent.
 * @param {Object} context
 * @returns {Promise<Object>} Structured JSON response
 */
export async function handleScheduleRuleDomain(context) {
  const { userId, messageText, language = 'bn', taskState } = context;
  const lower = messageText.toLowerCase().trim();

  logger.info({ userId, messageText }, '[ScheduleRuleAgent] Processing schedule/rule intent');

  // Extract amount if present
  const amountMatch = messageText.match(/(\d{2,7})\s*(?:taka|tk|টাকা)?/i);
  const amountBdt = amountMatch ? parseInt(amountMatch[1], 10) : (taskState?.parameters?.amount || null);

  // Extract phone number if present
  const phoneMatch = messageText.match(/01[3-9]\d{8}/);
  const targetPhone = phoneMatch ? phoneMatch[0] : (taskState?.parameters?.recipient || null);

  // 1. Conditional Trigger-Action Rule (e.g. "when money comes save 500", "ব্যালেন্স ১০০০ এর নিচে নামলে")
  const isConditional =
    lower.includes('when ') ||
    lower.includes('if ') ||
    lower.includes('যখন') ||
    lower.includes('টাকা ঢুকলে') ||
    lower.includes('টাকা আসলে') ||
    lower.includes('ব্যালেন্স কমে গেলে');

  if (isConditional) {
    const triggerEvent = lower.includes('balance') || lower.includes('ব্যালেন্স') ? 'balance_low' : 'wallet_credit';
    const actionType = lower.includes('bill') || lower.includes('বিল') ? 'pay_bill' : (lower.includes('save') || lower.includes('সঞ্চয়') ? 'save' : 'send');

    const clientAction = {
      type: 'open_modal',
      modal: 'rules',
      prefill: {
        trigger: triggerEvent,
        action: actionType,
        amount: amountBdt ? String(amountBdt) : '500',
      },
    };

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `⚙️ শর্তযুক্ত অটোমেশন রুল উইন্ডো খোলা হচ্ছে!\n• ট্রিগার: ${triggerEvent === 'wallet_credit' ? 'ওয়ালেটে টাকা আসলে' : 'ব্যালেন্স কমে গেলে'}\n• অ্যাকশন: ${actionType === 'save' ? 'সঞ্চয় করা' : (actionType === 'pay_bill' ? 'বিল দেওয়া' : 'টাকা পাঠানো')}\n\nশর্তযুক্ত রুল উইন্ডোতে কনফার্ম করে সক্রিয় করুন।`
        : `⚙️ Opening Conditional Automation Rule window!\n• Trigger: ${triggerEvent}\n• Action: ${actionType}\n\nPlease confirm in the rules modal.`,
      clientAction,
      pendingAction: null,
    };
  }

  // 2. Recurring Schedule (e.g. "every friday send 500 to 0171...", "প্রতি মাসে কারেন্ট বিল দাও")
  const isRecurring =
    lower.includes('every ') ||
    lower.includes('প্রতি মাসে') ||
    lower.includes('প্রতি শুক্রবার') ||
    lower.includes('monthly') ||
    lower.includes('weekly');

  if (isRecurring) {
    const frequency =
      lower.includes('week') ||
      lower.includes('friday') ||
      lower.includes('monday') ||
      lower.includes('sunday') ||
      lower.includes('সপ্তাহ') ||
      lower.includes('শুক্রবার') ||
      lower.includes('শনিবার') ||
      lower.includes('রবিবার')
        ? 'weekly'
        : (lower.includes('day') || lower.includes('প্রতিদিন') ? 'daily' : 'monthly');

    if (!amountBdt) {
      updateTaskState(userId, {
        intent: 'schedule',
        activeWorkflow: 'schedule',
        activeTool: 'create_schedule',
        status: 'collecting',
        requiredParameters: ['amount'],
        missingParameters: ['amount'],
        parameters: { frequency, recipient: targetPhone },
      });
      return {
        handled: true,
        reply: language === 'bn'
          ? `প্রতি ${frequency === 'weekly' ? 'সপ্তাহে' : 'মাসে'} কত টাকা পাঠাতে চান? (যেমন: ৫০০ টাকা)`
          : `How much amount per ${frequency} recurrence? (e.g. 500 taka)`,
        clientAction: { type: 'open_modal', modal: 'scheduled' },
        pendingAction: null,
      };
    }

    const clientAction = {
      type: 'open_modal',
      modal: 'scheduled',
      prefill: {
        frequency,
        amount: String(amountBdt),
        recipient: targetPhone || '',
      },
    };

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `📅 রিকারিং শিডিউল উইন্ডো খোলা হচ্ছে!\n• সময়কাল: প্রতি ${frequency === 'weekly' ? 'সপ্তাহে' : 'মাসে'}\n• পরিমাণ: ৳${amountBdt}\n• প্রাপক: ${targetPhone || 'উল্লেখ করুন'}\n\nশিডিউল উইন্ডোতে বিবরণ যাচাই করে পিন দিয়ে সংরক্ষণ করুন।`
        : `📅 Opening Recurring Schedule modal!\n• Frequency: ${frequency}\n• Amount: ৳${amountBdt}\n• Recipient: ${targetPhone || 'Specify in modal'}\n\nPlease confirm in the schedule window.`,
      clientAction,
      pendingAction: null,
    };
  }

  // 3. One-Time Reminder (e.g. "remind me tomorrow to pay electric bill", "কালকে বিল দেওয়ার কথা মনে করিয়ে দিও")
  const isReminder =
    lower.startsWith('remind') ||
    lower.includes('রিমাইন্ডার') ||
    lower.includes('মনে করিয়ে') ||
    lower.includes('মনে রেখো');

  if (isReminder) {
    // Extract title (e.g. pay bill, send money, buy medicine)
    const titleMatch = messageText.match(/(?:to|about|কথা|বিষয়ে)\s+(.+)/i);
    const reminderTitle = titleMatch ? titleMatch[1].trim() : 'বিল পরিশোধের রিমাইন্ডার (Payment Reminder)';

    // Default due time: tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const clientAction = {
      type: 'open_modal',
      modal: 'rules',
      prefill: {
        reminderTitle,
        dueAt: tomorrow.toISOString(),
      },
    };

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `⏰ নতুন রিমাইন্ডার সংরক্ষিত হচ্ছে:\n• বিষয়: ${reminderTitle}\n• সময়: আগামীকাল সকাল ১০:০০ টা\n\nরিমাইন্ডার প্যানেল খোলা হচ্ছে...`
        : `⏰ New reminder setup:\n• Title: ${reminderTitle}\n• Time: Tomorrow at 10:00 AM\n\nOpening reminder panel...`,
      clientAction,
      pendingAction: null,
    };
  }

  // 4. Query Scheduled Payments & Rules List (e.g. "show scheduled", "আমার রুলগুলো দেখাও")
  return {
    handled: true,
    reply: language === 'bn'
      ? '📋 আপনার শিডিউলড পেমেন্ট ও অটোমেশন রুল ম্যানেজমেন্ট উইন্ডো খোলা হচ্ছে...'
      : '📋 Opening Scheduled Payments and Automation Rules panel...',
    clientAction: { type: 'open_modal', modal: 'scheduled' },
    pendingAction: null,
  };
}
