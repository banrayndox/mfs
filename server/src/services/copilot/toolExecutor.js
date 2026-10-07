/**
 * @file toolExecutor.js
 * Deterministic Tool Execution Engine for Guardian MFS AI Copilot.
 * Enforces strict LLM boundary: all mutations, calculations, balance checks,
 * database updates, and external effects happen here deterministically.
 */

import {
  User,
  Wallet,
  Transaction,
  Notification,
  SavingsPlan,
  GuardianLink,
  ProtectedProfile,
  PendingAction,
} from '../../models/index.js';
import { sendMoney, cashOut, addMoney, payBill, mobileRecharge } from '../transaction.service.js';
import { createSchedule } from '../scheduler.service.js';
import { createRule } from '../rule.service.js';
import { createMoneyRequest } from '../request.service.js';
import {
  decideGuardianApproval,
  getPendingApprovals,
  updateChildControlMode,
} from '../guardian.service.js';
import {
  formatBdt,
  getSpendingSummary,
  getIncomeSummary,
  compareSpending,
  explainFinancialHabits,
} from '../financialAnalysis.service.js';
import {
  getMicroSavingsConfig,
  configureMicroSavings,
  pauseMicroSavings,
  resumeMicroSavings,
  disableMicroSavings,
} from '../microSavings.service.js';
import { retrieveKnowledge } from '../rag.service.js';
import { emitToUser } from '../socket.service.js';
import { logExecutionCompleted } from './auditLogger.js';
import memoryService from './memory.service.js';
import logger from '../../utils/logger.js';

/**
 * Executes a confirmed PendingAction tool deterministically.
 * @param {Object} params
 * @param {Object} params.action - PendingAction mongoose document
 * @param {string} params.userId
 * @returns {Promise<{ success: boolean, tool: string, result: any, message: string, messageBn: string }>}
 */
export async function executePendingActionTool({ action, userId }) {
  let result = null;
  const args = action.args || {};

  switch (action.tool) {
    case 'send_money':
      result = await sendMoney({
        senderUserId: userId,
        recipientPhone: args.recipientPhone || args.recipient,
        amountPoisha: args.amountPoisha,
        channel: 'agent',
      });
      break;

    case 'cash_out':
      result = await cashOut({
        customerUserId: userId,
        agentIdentifier: args.agentPhone || args.agentIdentifier || args.agent,
        amountPoisha: args.amountPoisha,
        channel: 'agent',
      });
      break;

    case 'add_money':
      result = await addMoney({
        userId,
        amountPoisha: args.amountPoisha,
        source: args.source || 'simulated_bank',
      });
      break;

    case 'mobile_recharge':
      result = await mobileRecharge({
        userId,
        recipientPhone: args.recipientPhone || args.recipient,
        amountPoisha: args.amountPoisha,
        operator: args.operator || 'Grameenphone',
      });
      break;

    case 'pay_bill':
      result = await payBill({
        userId,
        billerId: args.billerId || args.provider || 'DPDC',
        accountNo: args.accountNo || args.billNumber || '442109',
        amountPoisha: args.amountPoisha,
        channel: 'agent',
      });
      break;

    case 'create_schedule':
      result = await createSchedule({
        userId,
        actionType: args.actionType || 'send_money',
        frequency: args.frequency || 'monthly',
        actionPayload: args.actionPayload || {
          recipientPhone: args.recipientPhone,
          amountPoisha: args.amountPoisha,
        },
        nextRunAt: args.nextRunAt || new Date(Date.now() + 86400000),
        mandate: args.mandate,
      });
      break;

    case 'create_rule':
      result = await createRule({
        userId,
        trigger: args.trigger,
        action: args.action,
        mandate: args.mandate,
      });
      break;

    case 'guardian_decision':
      result = await decideGuardianApproval({
        guardianUserId: userId,
        txnId: args.txnId,
        decision: args.decision,
      });
      break;

    case 'create_group_bill':
      result = await createMoneyRequest({
        creatorUserId: userId,
        kind: 'bill_split',
        splitType: args.splitType || 'equal',
        totalAmountPoisha: args.totalAmountPoisha || args.amountPoisha,
        participants: args.participants || [],
        description: args.description || 'Group Bill Split',
      });
      break;

    case 'create_savings_goal': {
      const plan = await SavingsPlan.create({
        userId,
        title: args.title || 'Savings Goal',
        targetAmountPoisha: args.targetAmountPoisha || args.targetAmount * 100,
        planType: 'savings',
        frequency: args.frequency || 'monthly',
        durationMonths: args.durationMonths || 12,
        status: 'active',
      });
      result = plan;
      break;
    }

    case 'deposit_savings':
    case 'savings_deposit': {
      // Find active savings goal
      let plan = null;
      if (args.goalId || args.planId) {
        plan = await SavingsPlan.findOne({ _id: args.goalId || args.planId, userId, status: 'active' });
      } else {
        plan = await SavingsPlan.findOne({ userId, status: 'active' });
      }
      if (!plan) throw new Error('No active savings goal found to deposit into.');

      // Check wallet balance
      const wallet = await Wallet.findOne({ userId });
      const depositAmount = args.amountPoisha || args.amount * 100;
      const currentBal = wallet?.balance ?? wallet?.balancePoisha ?? 0;
      if (!wallet || currentBal < depositAmount) {
        throw new Error('Insufficient wallet balance for savings deposit.');
      }

      if (wallet.balance !== undefined) {
        wallet.balance -= depositAmount;
      } else {
        wallet.balancePoisha -= depositAmount;
      }
      await wallet.save();
      plan.currentAmountPoisha = (plan.currentAmountPoisha || 0) + depositAmount;
      if (plan.currentAmountPoisha >= plan.targetAmountPoisha) {
        plan.status = 'matured';
      }
      await plan.save();
      result = { plan, depositedPoisha: depositAmount };
      break;
    }

    case 'configure_micro_savings': {
      result = await configureMicroSavings({
        userId,
        ruleType: args.ruleType || 'round_up',
        targetGoalId: args.targetGoalId,
        percentage: args.percentage,
        thresholdPoisha: args.thresholdPoisha,
        roundUpUnitPoisha: args.roundUpUnitPoisha,
      });
      break;
    }

    case 'pause_micro_savings':
      result = await pauseMicroSavings(userId);
      break;

    case 'resume_micro_savings':
      result = await resumeMicroSavings(userId);
      break;

    case 'disable_micro_savings':
      result = await disableMicroSavings(userId);
      break;

    case 'update_child_control':
    case 'update_child_limits': {
      if (args.childUserId) {
        const update = {};
        if (args.dailyLimitPoisha) update.dailyLimitPoisha = args.dailyLimitPoisha;
        if (args.controlMode) update.controlMode = args.controlMode;
        result = await ProtectedProfile.findOneAndUpdate(
          { guardianId: userId, childUserId: args.childUserId },
          { $set: update },
          { new: true }
        );
      }
      break;
    }

    case 'freeze_account': {
      result = await User.findByIdAndUpdate(userId, { isFrozen: true }, { new: true });
      break;
    }

    case 'unfreeze_account': {
      result = await User.findByIdAndUpdate(userId, { isFrozen: false }, { new: true });
      break;
    }

    default:
      throw new Error(`Unsupported tool execution: ${action.tool}`);
  }

  // Update PendingAction state
  action.status = 'executed';
  action.executedTxnId = result?._id || result?.transaction?._id || null;
  await action.save();

  // Audit log
  await logExecutionCompleted({
    userId,
    tool: action.tool,
    actionId: action.actionId,
    status: 'success',
    executedTxnId: action.executedTxnId,
    preview: action.preview,
  });

  // Real-time socket event
  emitToUser(userId, 'copilot:action_completed', {
    tool: action.tool,
    actionId: action.actionId,
  });

  const amtBdt = action.preview?.amountPoisha
    ? (action.preview.amountPoisha / 100).toFixed(2)
    : '0.00';

  let message = `Action ${action.tool} executed successfully.`;
  let messageBn = `কার্যক্রম সফলভাবে সম্পন্ন হয়েছে।`;

  if (action.tool === 'send_money') {
    const recipient = action.preview?.recipientLabel || action.args.recipientPhone;
    message = `৳${amtBdt} successfully sent to ${recipient}.`;
    messageBn = `${recipient}-কে ৳${amtBdt} সফলভাবে পাঠানো হয়েছে।`;
  } else if (action.tool === 'cash_out') {
    message = `৳${amtBdt} successfully cashed out via Agent.`;
    messageBn = `এজেন্টের মাধ্যমে ৳${amtBdt} ক্যাশ আউট সফলভাবে সম্পন্ন হয়েছে।`;
  } else if (action.tool === 'pay_bill') {
    const biller = action.args.billerId || 'Bill';
    message = `৳${amtBdt} bill payment for ${biller} completed successfully.`;
    messageBn = `${biller} বিল বাবদ ৳${amtBdt} সফলভাবে পরিশোধ করা হয়েছে।`;
  } else if (action.tool === 'mobile_recharge') {
    message = `৳${amtBdt} recharge to ${action.args.recipientPhone} completed successfully.`;
    messageBn = `${action.args.recipientPhone} নম্বরে ৳${amtBdt} রিচার্জ সফলভাবে সম্পন্ন হয়েছে।`;
  } else if (action.tool === 'add_money') {
    message = `৳${amtBdt} added to wallet successfully.`;
    messageBn = `ওয়ালেটে ৳${amtBdt} সফলভাবে যোগ হয়েছে।`;
  } else if (action.tool === 'create_schedule') {
    message = `Payment schedule created successfully.`;
    messageBn = `পেমেন্ট শিডিউল সফলভাবে তৈরি হয়েছে।`;
  } else if (action.tool === 'create_rule') {
    message = `Conditional automation rule created successfully.`;
    messageBn = `শর্তযুক্ত অটোমেশন রুল সফলভাবে তৈরি হয়েছে।`;
  } else if (action.tool === 'guardian_decision') {
    message = `Child transaction of ৳${amtBdt} approved successfully.`;
    messageBn = `সন্তানের ৳${amtBdt} লেনদেন সফলভাবে অনুমোদিত হয়েছে।`;
  } else if (action.tool === 'create_group_bill') {
    const count = action.args.participants?.length || 0;
    message = `Group bill for ৳${amtBdt} ('${action.args.description || 'Split'}') created successfully. Requests sent to ${count} participants.`;
    messageBn = `৳${amtBdt} টাকার গ্রুপ বিল ('${action.args.description || 'স্প্লিট'}') সফলভাবে তৈরি হয়েছে। ${count} জন সদস্যের কাছে অনুরোধ পাঠানো হয়েছে।`;
  } else if (action.tool === 'create_savings_goal') {
    message = `Savings goal '${action.args.title}' created successfully.`;
    messageBn = `'${action.args.title}' সঞ্চয় লক্ষ্য সফলভাবে তৈরি হয়েছে।`;
  } else if (action.tool === 'deposit_savings') {
    message = `৳${amtBdt} deposited to savings goal successfully.`;
    messageBn = `সঞ্চয় লক্ষ্যে ৳${amtBdt} সফলভাবে জমা হয়েছে।`;
  } else if (action.tool === 'configure_micro_savings') {
    message = `Micro-savings configured successfully.`;
    messageBn = `মাইক্রো-সেভিংস সফলভাবে চালু হয়েছে।`;
  } else if (action.tool === 'pause_micro_savings') {
    message = `Micro-savings paused successfully.`;
    messageBn = `মাইক্রো-সেভিংস সাময়িকভাবে স্থগিত করা হয়েছে।`;
  } else if (action.tool === 'resume_micro_savings') {
    message = `Micro-savings resumed successfully.`;
    messageBn = `মাইক্রো-সেভিংস পুনরায় চালু করা হয়েছে।`;
  }

  return { success: true, tool: action.tool, result, message, messageBn };
}

/**
 * Executes a read-only tool query deterministically.
 * @param {Object} params
 * @param {string} params.tool
 * @param {Object} params.parameters
 * @param {string} params.userId
 * @param {string} [params.language='bn']
 * @returns {Promise<{ reply: string, data?: any }>}
 */
export async function executeReadOnlyTool({ tool, parameters = {}, userId, language = 'bn' }) {
  switch (tool) {
    case 'check_balance': {
      const wallet = await Wallet.findOne({ userId });
      const balPoisha = wallet?.balance ?? wallet?.balancePoisha ?? 0;
      const balBdt = (balPoisha / 100).toFixed(2);
      const reply =
        language === 'bn'
          ? `আপনার বর্তমান ওয়ালেট ব্যালেন্স: ৳${balBdt}`
          : `Your current wallet balance is: ৳${balBdt}`;
      return { reply, balancePoisha: balPoisha, data: { balancePoisha: balPoisha, balanceBdt: balBdt } };
    }

    case 'transaction_history': {
      const limit = parameters.limit || 5;
      const txns = await Transaction.find({
        $or: [{ senderUserId: userId }, { recipientUserId: userId }, { customerUserId: userId }],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      if (!txns.length) {
        return {
          reply:
            language === 'bn'
              ? 'আপনার কোনো সাম্প্রতিক লেনদেন পাওয়া যায়নি।'
              : 'No recent transactions found.',
          data: { transactions: [] },
        };
      }

      const lines = txns.map((t) => {
        const amt = (t.amountPoisha / 100).toFixed(2);
        const type = t.type;
        const date = new Date(t.createdAt).toLocaleDateString();
        return language === 'bn'
          ? `• ${date}: ${type} - ৳${amt} (${t.status})`
          : `• ${date}: ${type} - ৳${amt} (${t.status})`;
      });

      const reply =
        language === 'bn'
          ? `আপনার সর্বশেষ ${txns.length}টি লেনদেন:\n${lines.join('\n')}`
          : `Your last ${txns.length} transactions:\n${lines.join('\n')}`;

      return { reply, data: { transactions: txns } };
    }

    case 'transaction_details': {
      let txn = null;
      if (parameters.txnId) {
        txn = await Transaction.findOne({ _id: parameters.txnId });
      } else {
        txn = await Transaction.findOne({
          $or: [{ senderUserId: userId }, { recipientUserId: userId }, { customerUserId: userId }],
        }).sort({ createdAt: -1 });
      }

      if (!txn) {
        return {
          reply:
            language === 'bn'
              ? 'কোনো লেনদেনের তথ্য পাওয়া যায়নি।'
              : 'No transaction details found.',
          data: null,
        };
      }

      const amt = (txn.amountPoisha / 100).toFixed(2);
      const date = new Date(txn.createdAt).toLocaleString();
      const reply =
        language === 'bn'
          ? `📌 লেনদেনের বিস্তারিত:\n• ট্রানজেকশন আইডি: ${txn._id}\n• ধরন: ${txn.type}\n• পরিমাণ: ৳${amt}\n• স্ট্যাটাস: ${txn.status}\n• তারিখ: ${date}`
          : `📌 Transaction Details:\n• ID: ${txn._id}\n• Type: ${txn.type}\n• Amount: ৳${amt}\n• Status: ${txn.status}\n• Date: ${date}`;

      return { reply, data: txn };
    }

    case 'spending_summary': {
      const summary = await getSpendingSummary({ userId, days: parameters.days || 30 });
      const totalBdt = (summary.totalSpentPoisha / 100).toFixed(2);
      const reply =
        language === 'bn'
          ? `গত ${parameters.days || 30} দিনে আপনার মোট খরচ: ৳${totalBdt}`
          : `In the last ${parameters.days || 30} days, your total spending was: ৳${totalBdt}`;
      return { reply, data: summary };
    }

    case 'income_summary': {
      const summary = await getIncomeSummary({ userId, days: parameters.days || 30 });
      const totalBdt = (summary.totalIncomePoisha / 100).toFixed(2);
      const reply =
        language === 'bn'
          ? `গত ${parameters.days || 30} দিনে আপনার মোট আয়/প্রাপ্তি: ৳${totalBdt}`
          : `In the last ${parameters.days || 30} days, your total income was: ৳${totalBdt}`;
      return { reply, data: summary };
    }

    case 'compare_spending': {
      const comparison = await compareSpending({ userId });
      const currentBdt = (comparison.currentMonthSpentPoisha / 100).toFixed(2);
      const prevBdt = (comparison.previousMonthSpentPoisha / 100).toFixed(2);
      const reply =
        language === 'bn'
          ? `চলতি মাসে খরচ: ৳${currentBdt}, গত মাসে খরচ: ৳${prevBdt} (${comparison.trendTextBn || 'তুলনামূলক হিসাব'})`
          : `This month: ৳${currentBdt}, Last month: ৳${prevBdt} (${comparison.trendText || 'comparison'})`;
      return { reply, data: comparison };
    }

    case 'financial_habits': {
      const habits = await explainFinancialHabits({ userId, language });
      return { reply: habits.explanation || habits.message, data: habits };
    }

    case 'micro_savings_status': {
      const config = await getMicroSavingsConfig(userId);
      const statusText = config?.enabled ? (config?.isPaused ? 'স্থগিত (Paused)' : 'সক্রিয় (Active)') : 'নিষ্ক্রিয় (Inactive)';
      const reply =
        language === 'bn'
          ? `আপনার মাইক্রো-সেভিংস স্ট্যাটাস: ${statusText}`
          : `Your micro-savings status: ${statusText}`;
      return { reply, data: config };
    }

    case 'savings_goals_list': {
      const goals = await SavingsPlan.find({ userId, status: 'active' }).lean();
      if (!goals.length) {
        return {
          reply:
            language === 'bn'
              ? 'আপনার কোনো সক্রিয় সঞ্চয় লক্ষ্য নেই। নতুন লক্ষ্য তৈরি করতে "Save 5000 for emergency" বলুন।'
              : 'You have no active savings goals. To create one, say "Save 5000 for emergency".',
          data: { goals: [] },
        };
      }
      const lines = goals.map((g) => {
        const cur = (g.currentAmountPoisha / 100).toFixed(2);
        const tgt = (g.targetAmountPoisha / 100).toFixed(2);
        return `• ${g.title}: ৳${cur} / ৳${tgt}`;
      });
      const reply =
        language === 'bn'
          ? `আপনার সক্রিয় সঞ্চয় লক্ষ্যসমূহ:\n${lines.join('\n')}`
          : `Your active savings goals:\n${lines.join('\n')}`;
      return { reply, data: { goals } };
    }

    case 'pending_approvals': {
      const approvals = await getPendingApprovals(userId);
      if (!approvals.length) {
        return {
          reply:
            language === 'bn'
              ? 'সন্তানের কোনো অপেক্ষমাণ লেনদেন অনুমোদন নেই।'
              : 'No pending approvals from child accounts.',
          data: { approvals: [] },
        };
      }
      const count = approvals.length;
      return {
        reply:
          language === 'bn'
            ? `আপনার কাছে সন্তানের ${count}টি লেনদেন অনুমোদনের জন্য অপেক্ষমাণ রয়েছে।`
            : `You have ${count} child transaction approvals pending review.`,
        data: { approvals },
      };
    }

    case 'child_controls_summary': {
      const links = await GuardianLink.find({ guardianId: userId, status: 'active' })
        .populate('wardId', 'name phone')
        .lean();
      if (!links.length) {
        return {
          reply:
            language === 'bn'
              ? 'আপনার সাথে কোনো সন্তানের অ্যাকাউন্ট সংযুক্ত নেই।'
              : 'No child accounts linked to your guardian profile.',
          data: { children: [] },
        };
      }
      const names = links.map((l) => l.wardId?.name || l.wardId?.phone || 'Child').join(', ');
      return {
        reply:
          language === 'bn'
            ? `সংযুক্ত চাইল্ড অ্যাকাউন্ট: ${names}। সীমা পরিবর্তন বা পর্যবেক্ষণ করতে চাইল্ড কন্ট্রোল পেইজ ব্যবহার করুন।`
            : `Linked child accounts: ${names}. Use Child Control settings to update limits or monitor activity.`,
        data: { children: links },
      };
    }

    case 'notifications': {
      const notifs = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(5).lean();
      if (!notifs.length) {
        return {
          reply: language === 'bn' ? 'আপনার কোনো নোটিফিকেশন নেই।' : 'You have no notifications.',
          data: { notifications: [] },
        };
      }
      const lines = notifs.map((n) => `• ${n.title || n.type}: ${n.message}`);
      return {
        reply:
          language === 'bn'
            ? `সর্বশেষ নোটিফিকেশনসমূহ:\n${lines.join('\n')}`
            : `Recent notifications:\n${lines.join('\n')}`,
        data: { notifications: notifs },
      };
    }

    case 'get_profile': {
      const user = await User.findById(userId).lean();
      const wallet = await Wallet.findOne({ userId }).lean();
      const balBdt = wallet ? (((wallet.balance ?? wallet.balancePoisha) ?? 0) / 100).toFixed(2) : '0.00';
      return {
        reply:
          language === 'bn'
            ? `👤 প্রোফাইল তথ্য:\n• নাম: ${user?.name || 'ব্যবহারকারী'}\n• মোবাইল: ${user?.phone}\n• বর্তমান ব্যালেন্স: ৳${balBdt}`
            : `👤 Profile Information:\n• Name: ${user?.name || 'User'}\n• Phone: ${user?.phone}\n• Current Balance: ৳${balBdt}`,
        data: { user, wallet },
      };
    }

    case 'app_logout': {
      return {
        reply:
          language === 'bn'
            ? 'আপনাকে অ্যাকাউন্ট থেকে লগআউট করা হচ্ছে...'
            : 'Logging you out of your account...',
        logoutRequired: true,
      };
    }

    case 'app_navigate': {
      const target = parameters.targetScreen || 'home';
      return {
        reply:
          language === 'bn'
            ? `আপনাকে ${target} স্ক্রিনে নিয়ে যাওয়া হচ্ছে...`
            : `Navigating to ${target} screen...`,
        navigateTo: target,
      };
    }

    case 'remember_fact': {
      const fact = parameters.fact || parameters.note || parameters.text || '';
      const res = await memoryService.rememberFact({
        userId,
        fact,
        category: parameters.category,
        key: parameters.key,
        value: parameters.value,
      });
      return {
        reply: language === 'bn' ? res.summaryBn : res.summaryEn,
        data: res,
      };
    }

    case 'recall_memory': {
      const res = await memoryService.recallMemories({
        userId,
        query: parameters.query,
        category: parameters.category,
      });
      const reply = language === 'bn'
        ? `আপনার সংরক্ষিত তথ্যসমূহ (${res.totalCount}টি আইটেম)`
        : `Your remembered facts (${res.totalCount} items)`;
      return {
        reply,
        data: res,
      };
    }

    case 'forget_memory': {
      const res = await memoryService.forgetFact({
        userId,
        query: parameters.query,
        factId: parameters.factId,
        category: parameters.category,
      });
      return {
        reply: language === 'bn' ? res.summaryBn : res.summaryEn,
        data: res,
      };
    }

    case 'clear_memory': {
      const res = await memoryService.clearUserMemory({ userId });
      return {
        reply: language === 'bn' ? res.summaryBn : res.summaryEn,
        data: res,
      };
    }

    case 'knowledge_query':
    default: {
      const query = parameters.query || '';
      const kb = await retrieveKnowledge(query, language);
      return {
        reply: kb.answer || kb.content || (language === 'bn' ? 'তথ্য পাওয়া যায়নি।' : 'Information not found.'),
        data: kb,
      };
    }
  }
}

export default {
  executePendingActionTool,
  executeReadOnlyTool,
};
