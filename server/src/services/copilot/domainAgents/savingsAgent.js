/**
 * @file savingsAgent.js
 * Specialized Domain Agent for all Savings, Micro-Savings, Goals, and DPS Operations.
 * Operates via structured JSON payloads, supporting semantic intent extraction,
 * partial slot filling (missing parameter follow-ups), and deterministic service integration.
 */

import crypto from 'node:crypto';
import {
  SavingsPlan,
  FinancialMemory,
  PendingAction,
} from '../../../models/index.js';
import {
  configureMicroSavings,
  getMicroSavingsConfig,
  pauseMicroSavings,
  resumeMicroSavings,
  disableMicroSavings,
  calculateGoalPace,
} from '../../microSavings.service.js';
import { updateTaskState, clearActiveTask } from '../taskStateManager.js';
import {
  formatBdt,
  extractExplicitAmountPoisha,
} from '../../agentCopilot.service.js';
import logger from '../../../utils/logger.js';

/**
 * Evaluates whether a user query pertains to the Savings domain.
 * Robust against typos, Banglish, slang, and partial commands.
 * @param {string} text
 * @param {Object} [taskState]
 * @param {Object} [intent]
 * @returns {boolean}
 */
export function isSavingsIntent(text, taskState, intent) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // If already classified as a savings intent by main agent
  if (
    intent?.type === 'set_percentage_savings' ||
    intent?.type === 'set_roundup_savings' ||
    intent?.type === 'set_threshold_savings' ||
    intent?.type === 'disable_savings' ||
    intent?.type === 'pause_savings' ||
    intent?.type === 'resume_savings' ||
    intent?.type === 'get_savings_settings' ||
    intent?.type === 'get_savings_progress' ||
    intent?.type === 'update_savings_goal' ||
    intent?.type === 'create_savings_goal' ||
    intent?.type === 'remember_financial_goal' ||
    intent?.type === 'get_remembered_goal'
  ) {
    return true;
  }

  // Avoid hijacking when other primary intents are present
  const isSwitchingDomain =
    lower.includes('when ') ||
    lower.includes('remind') ||
    lower.includes('reminder') ||
    lower.includes('split ') ||
    lower.includes('group bill') ||
    lower.includes('guardian') ||
    lower.includes('child');

  if (isSwitchingDomain) {
    return false;
  }

  // Active workflow check
  if (taskState?.status === 'collecting') {
    if (
      taskState?.intent === 'savings' ||
      taskState?.activeWorkflow === 'savings' ||
      taskState?.activeTool?.startsWith('savings_') ||
      taskState?.activeTool === 'create_savings_goal'
    ) {
      return true;
    }
  }

  // Savings keywords and variations
  const savingsTerms = [
    'saving', 'savings', 'save', 'সঞ্চয়', 'সঞ্চয়', 'সেভিংস', 'সেভ',
    'dps', 'ডিপিএস', 'round-up', 'round up', 'রাউন্ড-আপ', 'রাউন্ড আপ',
    'goal', 'লক্ষ্য', 'টাকা জমানো', 'জমাও', 'জমাবো', 'জমিয়ে', 'জমিয়ে',
    'auto-save', 'auto save', 'অটো সেভ', 'অটো সেভিংস',
  ];

  const hasSavingsTerm = savingsTerms.some((term) => lower.includes(term));
  if (hasSavingsTerm) return true;

  // Percentage + money context (e.g. "-5%", "150%", "2% kete rakho", "5% sorie rakho")
  if (/-?\d+\s*%/.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Main execution handler for the Savings Agent.
 * @param {Object} context
 * @param {string} context.userId
 * @param {string} context.messageText
 * @param {string} [context.language='bn']
 * @param {Object} [context.user]
 * @param {Object} [context.wallet]
 * @param {Object} [context.taskState]
 * @returns {Promise<Object>} Structured JSON response
 */
export async function handleSavingsDomain(context) {
  const { userId, messageText, language = 'bn', taskState } = context;
  const lower = messageText.toLowerCase().trim();

  logger.info({ userId, messageText }, '[SavingsAgent] Processing savings intent');

  // 1. Percentage Auto-Savings Configuration (e.g., "5% save koro", "set savings to 10%", "Save 5% from every transaction", "Set savings to -5%")
  const pctMatch = messageText.match(/(-?\d+)\s*%/);
  const isPctCommand = pctMatch || (lower.includes('percentage') || lower.includes('পার্সেন্ট'));
  if (isPctCommand) {
    const rawPct = pctMatch ? parseInt(pctMatch[1], 10) : null;
    if (rawPct !== null) {
      if (rawPct < 1 || rawPct > 25) {
        return {
          handled: true,
          reply: language === 'bn'
            ? '⚠️ পার্সেন্টেজ সঞ্চয় ১% থেকে ২৫% এর মধ্যে হতে হবে (must be between 1% and 25%)।'
            : '⚠️ Percentage savings must be between 1% and 25%.',
          clientAction: null,
          pendingAction: null,
        };
      }
      await configureMicroSavings({
        userId,
        enabled: true,
        paused: false,
        mode: 'percentage',
        percentage: rawPct,
      });
      clearActiveTask(userId);
      const ex300 = ((300 * rawPct) / 100).toFixed(2);
      const ex500 = ((500 * rawPct) / 100).toFixed(2);
      return {
        handled: true,
        reply: language === 'bn'
          ? `✅ প্রতি ট্রানজ্যাকশনে ${rawPct}% অটো-সঞ্চয় সফলভাবে চালু করা হয়েছে।\n• উদাহরণ: ৳৩০০ লেনদেনে ৳${ex300} সঞ্চয় হবে।\n• উদাহরণ: ৳৫০০ লেনদেনে ৳${ex500} সঞ্চয় হবে।`
          : `✅ Auto-savings configured to ${rawPct}% per transaction successfully.\n• Example: Spending ৳300 saves ৳${ex300}.\n• Example: Spending ৳500 saves ৳${ex500}.`,
        microSavings: { enabled: true, mode: 'percentage', percentage: rawPct },
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }
  }

  // 2. Round-Up Savings Configuration (e.g., "enable round-up savings", "round up koro", "রাউন্ড আপ চালু করো")
  if (lower.includes('round-up') || lower.includes('round up') || lower.includes('রাউন্ড আপ') || lower.includes('রাউন্ড-আপ')) {
    if (lower.includes('off') || lower.includes('disable') || lower.includes('বন্ধ') || lower.includes('বাদ')) {
      await configureMicroSavings({ userId, enabled: false });
      return {
        handled: true,
        reply: language === 'bn'
          ? '🛑 আপনার স্বয়ংক্রিয় মাইক্রো-সেভিংস বন্ধ (Disabled) করা হয়েছে।'
          : '🛑 Automatic micro-savings has been disabled.',
        microSavings: { enabled: false },
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }
    await configureMicroSavings({
      userId,
      enabled: true,
      paused: false,
      mode: 'round_up',
    });
    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? '✅ ট্রানজ্যাকশন রাউন্ড-আপ সঞ্চয় সফলভাবে চালু করা হয়েছে (Round-up / Round-Up Savings enabled)। খরচের পর অবশিষ্ট পয়সা সঞ্চয় তহবিলে জমা হবে।\n• উদাহরণ: ৳৮৭ খরচ হলে ৳১০০ ধরে ৳১৩ সঞ্চয় হবে।'
        : '✅ Round-up / Round-Up Savings enabled! Change from everyday purchases will round up to the next round figure and deposit into savings.\n• Example: Spending ৳87 rounds to ৳100, saving ৳13.00.\n• Example: Spending ৳463 rounds to ৳500, saving ৳37.00.',
      microSavings: { enabled: true, mode: 'round_up' },
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 3. Pause Savings (e.g., "pause savings", "সঞ্চয় সাময়িক বন্ধ", "thamiye rakho")
  if (
    lower.includes('pause') ||
    lower.includes('সাময়িক বন্ধ') ||
    lower.includes('থামিয়ে') ||
    lower.includes('thamiye')
  ) {
    await pauseMicroSavings(userId);
    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? '⏸️ মাইক্রো-সঞ্চয় সাময়িকভাবে স্থগিত করা হয়েছে। যেকোনো সময় আবার চালু করতে "Resume savings" বলুন।'
        : '⏸️ Micro-savings paused. Say "Resume savings" anytime to unpause.',
      microSavings: { isPaused: true, paused: true },
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 4. Resume / Unpause Savings (e.g., "resume savings", "আবার চালু", "chalu koro")
  if (
    lower.includes('resume') ||
    lower.includes('unpause') ||
    (lower.includes('chalu') && !lower.includes('round') && !lower.includes('goal')) ||
    (lower.includes('চালু') && lower.includes('সঞ্চয়') && !lower.includes('রাউন্ড'))
  ) {
    await resumeMicroSavings(userId);
    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? '▶️ মাইক্রো-সঞ্চয় পুনরায় সক্রিয় করা হয়েছে।'
        : '▶️ Micro-savings resumed successfully.',
      microSavings: { isPaused: false, paused: false },
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 5. Disable / Stop Savings (e.g., "disable savings", "stop savings", "savings bondho koro", "সেভিংস বন্ধ")
  if (
    lower.includes('disable') ||
    lower.includes('stop saving') ||
    lower.includes('bondho koro') ||
    lower.includes('bondho') ||
    lower.includes('বন্ধ করো') ||
    lower.includes('বন্ধ করে দাও')
  ) {
    await disableMicroSavings(userId);
    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? '🛑 আপনার স্বয়ংক্রিয় মাইক্রো-সেভিংস বন্ধ (Disabled) করা হয়েছে। আপনার পূর্বে জমানো সঞ্চয় সুরক্ষিত রয়েছে।'
        : '🛑 Automatic micro-savings has been disabled. Your existing saved funds remain safe in your savings plans.',
      microSavings: { enabled: false },
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 6. Direct Manual Deposit into a Goal / Savings Plan (e.g., "deposit 500 to savings", "laptop goale 1000 taka dao")
  const isDeposit =
    lower.includes('deposit') ||
    lower.includes('জমা দাও') ||
    lower.includes('জমা করো') ||
    (lower.includes('rakho') && /\d+/.test(lower) && !lower.includes('%')) ||
    (lower.includes('রাখো') && /\d+/.test(lower) && !lower.includes('%'));

  if (isDeposit) {
    const explicitPoisha = extractExplicitAmountPoisha(messageText);
    const amountBdt = explicitPoisha ? explicitPoisha / 100 : null;

    if (!amountBdt || amountBdt <= 0) {
      updateTaskState(userId, {
        intent: 'savings',
        activeWorkflow: 'savings',
        activeTool: 'savings_deposit',
        status: 'collecting',
        requiredParameters: ['amount'],
        missingParameters: ['amount'],
      });
      return {
        handled: true,
        reply: language === 'bn'
          ? 'সঞ্চয় তহবিলে কত টাকা জমা করতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ৫০০ টাকা)।'
          : 'How much would you like to deposit into savings? Please specify the amount (e.g. 500 taka).',
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }

    const plans = await SavingsPlan.find({ userId, status: 'active' });
    const targetPlan = plans[0] || null;

    if (!targetPlan) {
      return {
        handled: true,
        reply: language === 'bn'
          ? 'আপনার কোনো সক্রিয় সঞ্চয় তহবিল নেই। সঞ্চয় উইন্ডো থেকে একটি নতুন তহবিল তৈরি করুন।'
          : 'You do not have an active savings plan. Please create one in the savings modal.',
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }

    const amountPoisha = explicitPoisha;
    const actionId = crypto.randomUUID();
    const actionArgs = {
      planId: targetPlan._id.toString(),
      amountPoisha,
    };
    const actionHash = crypto.createHash('sha256').update(actionId + JSON.stringify(actionArgs)).digest('hex');

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'savings_deposit',
      args: actionArgs,
      preview: {
        actionType: 'savings_deposit',
        title: language === 'bn' ? `সঞ্চয় তহবিলে জমা (${targetPlan.title})` : `Deposit to Savings (${targetPlan.title})`,
        amountPoisha,
        feePoisha: 0,
        totalPoisha: amountPoisha,
        recipientLabel: targetPlan.title,
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    clearActiveTask(userId);
    return {
      handled: true,
      reply: language === 'bn'
        ? `${targetPlan.title} তহবিলে ${formatBdt(amountPoisha)} জমা করতে নিচের কার্ডে আপনার পিন (PIN) দিন।`
        : `To deposit ${formatBdt(amountPoisha)} into ${targetPlan.title}, please confirm with your PIN below.`,
      pendingAction: pending,
      clientAction: null,
    };
  }

  // 7. Update Savings Goal Target (e.g. "Update savings goal to 20,000 taka", "Change savings goal to 20000")
  const isGoalUpdate =
    (lower.includes('update') || lower.includes('change') || lower.includes('আপডেট') || lower.includes('পরিবর্তন')) &&
    (lower.includes('goal') || lower.includes('লক্ষ্য') || lower.includes('plan') || lower.includes('প্ল্যান')) &&
    /\d+/.test(lower);

  if (isGoalUpdate) {
    const explicitPoisha = extractExplicitAmountPoisha(messageText);
    if (!explicitPoisha || explicitPoisha <= 0) {
      return {
        handled: true,
        reply: language === 'bn'
          ? '⚠️ সঞ্চয় লক্ষ্যের নতুন পরিমাণ সঠিক সংখ্যা হতে হবে (যেমন: "Update savings goal to 20,000 taka")।'
          : '⚠️ Please specify a valid amount for your savings goal (e.g. "Update savings goal to 20,000 taka").',
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }

    const plan = await SavingsPlan.findOne({ userId, status: 'active' }).sort({ updatedAt: -1 });
    if (!plan) {
      return {
        handled: true,
        reply: language === 'bn'
          ? 'আপনার কোনো সক্রিয় সঞ্চয় লক্ষ্য পাওয়া যায়নি।'
          : 'No active savings goal found to update.',
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }

    const oldBdt = (plan.targetAmountPoisha / 100).toFixed(2);
    plan.targetAmountPoisha = explicitPoisha;
    await plan.save();
    const newBdt = (explicitPoisha / 100).toFixed(2);

    return {
      handled: true,
      reply: language === 'bn'
        ? `🎯 সঞ্চয় লক্ষ্যের পরিমাণ সফলভাবে পরিবর্তন করা হয়েছে!\n• লক্ষ্য: "${plan.title}"\n• পূর্বের লক্ষ্য: ৳${oldBdt}\n• নতুন লক্ষ্য: ৳${newBdt}`
        : `🎯 Savings goal target successfully updated!\n• Goal: "${plan.title}"\n• Previous Target: ৳${oldBdt}\n• New Target: ৳${newBdt}`,
      savingsPlan: plan,
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 8. Remember Financial Goal (e.g. "I am saving for a laptop", "I'm saving for a bike")
  if (
    lower.includes('saving for a') ||
    lower.includes('saving for my') ||
    lower.includes('saving for') ||
    lower.includes('জন্য সঞ্চয় করছি') ||
    lower.includes('কেনার জন্য টাকা জমাচ্ছি')
  ) {
    let keyword = 'laptop';
    const laptopMatch = messageText.match(/(?:saving\s+for\s+(?:a\s+|an\s+|the\s+|my\s+)?|for\s+(?:a\s+|an\s+|the\s+|my\s+)?|জন্য\s+)([\p{L}]+)/iu);
    if (laptopMatch && !['a', 'an', 'the', 'my', 'some'].includes(laptopMatch[1].toLowerCase())) {
      keyword = laptopMatch[1].toLowerCase();
    }

    const title = language === 'bn' ? `${keyword} ক্রয়ের সঞ্চয়` : `${keyword} Goal`;
    const targetPoisha = 6000000; // ৳60,000

    let plan = await SavingsPlan.findOne({ userId, title: new RegExp(keyword, 'i'), status: 'active' });
    if (!plan) {
      plan = await SavingsPlan.create({
        userId,
        planType: 'savings',
        title,
        targetAmountPoisha: targetPoisha,
        currentAmountPoisha: 0,
        status: 'active',
      });
    }

    let memory = await FinancialMemory.findOne({ userId });
    if (!memory) {
      memory = new FinancialMemory({ userId, microSavings: {} });
    }
    if (!memory.financialGoals) memory.financialGoals = [];
    memory.financialGoals = memory.financialGoals.filter((g) => g.keyword !== keyword);
    memory.financialGoals.push({
      keyword,
      title,
      targetPoisha,
      savingsPlanId: plan._id,
      notes: `Saving for ${keyword}`,
    });
    await memory.save();

    return {
      handled: true,
      reply: language === 'bn'
        ? `📝 মনে রাখা হয়েছে! আপনার "${keyword}" সঞ্চয় লক্ষ্য নথিভুক্ত করা হয়েছে (লক্ষ্য: ${formatBdt(targetPoisha)})。\nপরবর্তীতে 'How am I doing with my ${keyword}?' বললে বর্তমান অগ্রগতি জানতে পারবেন।`
        : `📝 Noted! I've recorded your "${keyword}" savings goal (Target: ${formatBdt(targetPoisha)}).\nYou can ask 'How am I doing with my ${keyword}?' anytime to see progress.`,
      goal: { keyword, targetPoisha, planId: plan._id },
      savingsPlan: plan,
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 9. Retrieve Remembered Goal (e.g. "How am I doing with my laptop?", "How is my laptop goal?")
  if (
    lower.includes('how am i doing with my') ||
    (lower.includes('how is my') && lower.includes('goal')) ||
    lower.includes('লক্ষ্যের অবস্থা')
  ) {
    let keyword = 'laptop';
    const match = messageText.match(/(?:with\s+my\s+|for\s+my\s+|about\s+my\s+|with\s+the\s+|আমার\s+)([\p{L}]+)/iu);
    if (match && !['a', 'an', 'the', 'my'].includes(match[1].toLowerCase())) {
      keyword = match[1].toLowerCase();
    }

    const memory = await FinancialMemory.findOne({ userId });
    const remembered = memory?.financialGoals?.find((g) => g.keyword === keyword || g.title?.toLowerCase().includes(keyword));
    const plan = remembered?.savingsPlanId
      ? await SavingsPlan.findById(remembered.savingsPlanId)
      : await SavingsPlan.findOne({ userId, title: new RegExp(keyword, 'i') });

    if (plan) {
      const currentBdt = (plan.currentAmountPoisha / 100).toFixed(2);
      const targetBdt = (plan.targetAmountPoisha / 100).toFixed(2);
      const pct = plan.targetAmountPoisha > 0
        ? ((plan.currentAmountPoisha / plan.targetAmountPoisha) * 100).toFixed(1)
        : 0;

      return {
        handled: true,
        reply: language === 'bn'
          ? `💻 সঞ্চয় লক্ষ্য: ${plan.title}\n• লক্ষ্য: ৳${targetBdt}\n• বর্তমান জমাকৃত: ৳${currentBdt}\n• অগ্রগতি (Progress): ${pct}%\n💡 অবস্থা: সঞ্চয় সক্রিয় রয়েছে।`
          : `💻 Savings Goal: ${plan.title}\n• Target: ৳${targetBdt}\n• Current Saved: ৳${currentBdt}\n• Progress: ${pct}%\n💡 Status: Active.`,
        savingsPlan: plan,
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }
  }

  // 10. Create New Savings Goal / Plan (e.g., "Create a savings goal of 10,000 taka in 6 months", "I want to save 10000 taka in the next 3 months for laptop", "নতুন সঞ্চয় লক্ষ্য")
  const isGoalCreation =
    context.intent?.type === 'create_savings_goal' ||
    lower.includes('create a savings goal') ||
    lower.includes('create savings goal') ||
    lower.includes('savings goal of') ||
    lower.includes('নতুন সঞ্চয় লক্ষ্য') ||
    lower.includes('নতুন গোল') ||
    (lower.includes('save') && (lower.includes('month') || lower.includes('for ') || lower.includes('লক্ষ্য')) && /\d+/.test(lower)) ||
    ((lower.includes('goal') || lower.includes('লক্ষ্য') || lower.includes('dps') || lower.includes('তহবিল')) &&
     (lower.includes('create') || lower.includes('make') || lower.includes('তৈরি') || lower.includes('বানাও') || lower.includes('koro')));

  if (isGoalCreation) {
    const explicitPoisha = extractExplicitAmountPoisha(messageText);

    // Extract title (e.g. Laptop, Bike, Eid, Emergency, Tour)
    let purposeKeyword = 'সঞ্চয়';
    let purposeEn = 'Savings';
    const preGoalMatch = messageText.match(/([a-zA-Z\u0980-\u09FF]{2,20})\s+(?:goal|লক্ষ্য|তহবিল)/i);
    const purposeMatch = messageText.match(/(?:for\s+my\s+new\s+|for\s+my\s+|for\s+a\s+new\s+|for\s+a\s+|for\s+|জন্য\s+|er\s+jonno\s+)([\p{L}]+)/iu);

    if (purposeMatch && !['a', 'an', 'the', 'my', 'some', 'new', 'taka', 'tk', 'of'].includes(purposeMatch[1].toLowerCase())) {
      purposeKeyword = purposeMatch[1];
      purposeEn = purposeMatch[1];
    } else if (preGoalMatch && !['taka', 'tk', 'create', 'new', 'notun', 'koro', 'of', 'savings', 'set', 'make'].includes(preGoalMatch[1].toLowerCase())) {
      purposeKeyword = preGoalMatch[1].trim();
      purposeEn = preGoalMatch[1].trim();
    } else if (messageText.toLowerCase().includes('laptop') || messageText.includes('ল্যাপটপ')) {
      purposeKeyword = 'ল্যাপটপ';
      purposeEn = 'Laptop';
    }

    const purposeDisplay = purposeEn.charAt(0).toUpperCase() + purposeEn.slice(1);
    const goalTitle = purposeDisplay;

    if (explicitPoisha !== null && explicitPoisha <= 0) {
      return {
        handled: true,
        reply: language === 'bn'
          ? '⚠️ সঞ্চয় লক্ষ্যের পরিমাণ ০ বা ঋণাত্মক হতে পারে না (must be greater than zero)।'
          : '⚠️ Savings goal target must be greater than zero. Please specify a valid amount.',
        clientAction: null,
        pendingAction: null,
      };
    }

    if (!explicitPoisha) {
      updateTaskState(userId, {
        intent: 'savings',
        activeWorkflow: 'savings',
        activeTool: 'create_savings_goal',
        status: 'collecting',
        requiredParameters: ['targetAmount'],
        missingParameters: ['targetAmount'],
        parameters: { goalTitle },
      });
      return {
        handled: true,
        reply: language === 'bn'
          ? `আপনার '${purposeKeyword}'-এর জন্য সঞ্চয় লক্ষ্যের পরিমাণ কত টাকা নির্ধারণ করতে চান? (যেমন: ২০,০০০ টাকা)`
          : `What target amount would you like to set for your '${purposeDisplay}' savings goal? (e.g. 20,000 taka)`,
        clientAction: { type: 'open_modal', modal: 'savings' },
        pendingAction: null,
      };
    }

    const durationMatch = messageText.match(/(\d+)\s*(?:month|months|মাস)/i);
    const durationMonths = durationMatch ? parseInt(durationMatch[1], 10) : 6;

    const newPlan = await SavingsPlan.create({
      userId,
      planType: 'savings',
      title: goalTitle,
      targetAmountPoisha: explicitPoisha,
      currentAmountPoisha: 0,
      durationMonths,
      frequency: 'monthly',
      status: 'active',
    });

    const pace = calculateGoalPace({ targetPoisha: explicitPoisha, durationMonths, language });
    clearActiveTask(userId);

    const formattedAmt = (explicitPoisha / 100).toLocaleString('en-US');
    return {
      handled: true,
      reply: language === 'bn'
        ? `🎯 নতুন সঞ্চয় পরিকল্পনা '${newPlan.title}' সফলভাবে তৈরি করা হয়েছে!\n• লক্ষ্য: ৳${formattedAmt} (${formatBdt(explicitPoisha)})\n• মেয়াদ: ${durationMonths} মাস\n${pace.recommendation}`
        : `🎯 New Savings Plan '${newPlan.title}' created successfully!\n• Target: ৳${formattedAmt} (${formatBdt(explicitPoisha)})\n• Duration: ${durationMonths} months\n${pace.recommendation}`,
      savingsPlan: newPlan,
      goalPace: pace,
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 11. Query Savings Settings (e.g., "Show my current savings settings", "What is my savings percentage?", "savings settings")
  if (
    lower.includes('savings settings') ||
    lower.includes('savings config') ||
    lower.includes('current savings settings') ||
    lower.includes('what is my savings') ||
    lower.includes('সঞ্চয় সেটিংস') ||
    lower.includes('সেভিংস সেটিংস')
  ) {
    const settings = await getMicroSavingsConfig(userId);
    const config = settings.config || settings.microSavings || {};
    const { targetPlan } = settings;
    let statusEn = 'Disabled';
    let statusBn = 'বন্ধ';
    if (config.enabled) {
      if (config.paused) {
        statusEn = 'Paused';
        statusBn = 'স্থগিত (Paused)';
      } else {
        const modeUpper = (config.mode || 'percentage').toUpperCase();
        statusEn = `Active (${modeUpper})`;
        statusBn = `সক্রিয় (${config.mode === 'percentage' ? config.percentage + '%' : config.mode === 'round_up' ? 'রাউন্ড-আপ' : 'থ্রেশহোল্ড'})`;
      }
    }
    const savedBdt = ((config.totalSavedPoisha || 0) / 100).toFixed(2);
    const targetName = targetPlan ? targetPlan.title : (language === 'bn' ? 'সাধারণ সঞ্চয় ওয়ালেট' : 'General Savings Wallet');

    const reply = language === 'bn'
      ? `⚙️ আপনার বর্তমান সঞ্চয় সেটিংস (Your Current Savings Settings):\n` +
        `• অবস্থা: ${statusBn}\n` +
        `• পদ্ধতি: ${config.mode === 'percentage' ? `${config.percentage}% পার্সেন্টেজ (${config.percentage}% Percentage)` : config.mode === 'round_up' ? `রাউন্ড-আপ (Round-Up)` : 'থ্রেশহোল্ড'}\n` +
        `• লক্ষ্য গোল: ${targetName}\n` +
        `• সর্বমোট সঞ্চয়: ৳${savedBdt}`
      : `⚙️ Your Current Savings Settings:\n` +
        `• Status: ${statusEn}\n` +
        `• Mode: ${config.mode === 'percentage' ? `${config.percentage}% Percentage` : config.mode === 'round_up' ? `Round-Up` : 'Threshold'}\n` +
        `• Linked Goal: ${targetName}\n` +
        `• Total Saved: ৳${savedBdt}`;

    return {
      handled: true,
      reply,
      microSavings: config,
      targetPlan,
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 12. Query Savings Progress & Overview (e.g., "show savings progress", "how much have i saved", "আমার সঞ্চয় কত")
  const isProgressQuery =
    lower.includes('progress') ||
    lower.includes('অগ্রগতি') ||
    lower.includes('how much have i saved') ||
    lower.includes('amar savings koto') ||
    lower.includes('আমার সঞ্চয় কত') ||
    lower.includes('status') ||
    lower.includes('তালিক');

  if (isProgressQuery || lower === 'savings' || lower === 'সঞ্চয়' || lower === 'সেভিংস') {
    const configData = await getMicroSavingsConfig(userId);
    const plans = configData.activePlans || [];
    const micro = configData.config || {};

    let totalSavedPoisha = 0;
    plans.forEach((p) => {
      totalSavedPoisha += p.currentAmountPoisha || 0;
    });

    const autoModeDescBn = micro.enabled
      ? (micro.mode === 'percentage' ? `${micro.percentage || 2}% প্রতি লেনদেনে` : 'রাউন্ড-আপ সঞ্চয়')
      : 'বন্ধ আছে';
    const autoModeDescEn = micro.enabled
      ? (micro.mode === 'percentage' ? `${micro.percentage || 2}% per transaction` : 'Round-up savings')
      : 'Disabled';

    const planLinesBn = plans.length > 0
      ? plans.map((p) => `• ${p.title}: ৳${(p.currentAmountPoisha / 100).toFixed(0)} / ৳${(p.targetAmountPoisha / 100).toFixed(0)} (${Math.round((p.currentAmountPoisha / (p.targetAmountPoisha || 1)) * 100)}%)`).join('\n')
      : '• কোনো সক্রিয় সঞ্চয় তহবিল নেই।';

    const planLinesEn = plans.length > 0
      ? plans.map((p) => `• ${p.title}: ৳${(p.currentAmountPoisha / 100).toFixed(0)} / ৳${(p.targetAmountPoisha / 100).toFixed(0)} (${Math.round((p.currentAmountPoisha / (p.targetAmountPoisha || 1)) * 100)}%)`).join('\n')
      : '• No active savings plans found.';

    return {
      handled: true,
      reply: language === 'bn'
        ? `💰 আপনার সঞ্চয়ের বিবরণ:\n• মোট সঞ্চিত: ৳${(totalSavedPoisha / 100).toLocaleString()}\n• অটো-সঞ্চয়: ${autoModeDescBn}\n\nসক্রিয় তহবিলসমূহ:\n${planLinesBn}`
        : `💰 Your Savings Overview:\n• Total Saved: ৳${(totalSavedPoisha / 100).toLocaleString()}\n• Auto-Save: ${autoModeDescEn}\n\nActive Plans:\n${planLinesEn}`,
      microSavings: micro,
      clientAction: { type: 'open_modal', modal: 'savings' },
      pendingAction: null,
    };
  }

  // 13. Default Partial / Ambiguous Savings Guidance
  return {
    handled: true,
    reply: language === 'bn'
      ? '💡 সঞ্চয় সুবিধার জন্য আপনি নির্দেশ দিতে পারেন:\n• অটো-সঞ্চয়: "Set savings to 5%" বা "Enable round-up savings"\n• লক্ষ্য নির্ধারণ: "Create 20,000 taka laptop goal"\n• জমা করতে: "Deposit 500 to savings"\n• সঞ্চয় সাময়িক বন্ধ: "Pause savings"\n\nসঞ্চয় ড্যাশবোর্ড খোলা হচ্ছে...'
      : '💡 You can command any savings action:\n• Auto-Save: "Set savings to 5%" or "Enable round-up savings"\n• Create Goal: "Create 20,000 taka laptop goal"\n• Deposit: "Deposit 500 to savings"\n• Pause: "Pause savings"\n\nOpening Savings dashboard...',
    clientAction: { type: 'open_modal', modal: 'savings' },
    pendingAction: null,
  };
}

export default {
  isSavingsIntent,
  handleSavingsDomain,
};
