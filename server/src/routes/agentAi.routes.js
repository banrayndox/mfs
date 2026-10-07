import express from 'express';
import { requireAuth, requireTier } from '../middleware/auth.js';
import { processAgentMessage, executePendingAction } from '../services/agentCopilot.service.js';
import { Transaction, Reminder, Schedule } from '../models/index.js';
import { consumeStepUpToken } from '../services/auth.service.js';

export const agentAiRouter = express.Router();

// Natural Language Message -> PendingAction
agentAiRouter.post('/message', requireAuth, async (req, res, next) => {
  try {
    const { message, language } = req.body;
    const response = await processAgentMessage({
      userId: req.user._id,
      messageText: message,
      language: language || req.user.language || 'bn',
    });
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// Confirm and Execute PendingAction (Requires Tier 2 Step-Up)
agentAiRouter.post('/confirm', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { actionId } = req.body;
    const result = await executePendingAction({
      actionId,
      userId: req.user._id,
    });
    if (req.stepUpToken) {
      await consumeStepUpToken(req.stepUpToken);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});


// Copilot Proactive Insights
agentAiRouter.get('/insights', requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const insights = [];

    // Check for recurring electricity bill pattern
    const billTxns = await Transaction.find({
      senderUserId: user._id,
      type: 'bill',
    }).limit(3);

    const hasBillSchedule = await Schedule.findOne({
      userId: user._id,
      actionType: 'pay_bill',
      status: 'active',
    });

    if (billTxns.length >= 1 && !hasBillSchedule) {
      insights.push({
        id: 'ins-bill-schedule',
        category: 'automation_opportunity',
        titleBn: 'নিয়মিত বিদ্যুৎ বিলের জন্য শিডিউল চালু করুন',
        titleEn: 'Set up automatic schedule for monthly electricity bills',
        descriptionBn: 'আপনি প্রতি মাসে বিদ্যুৎ বিল দেন। এটি স্বয়ংক্রিয় করতে একটি মাসিক শিডিউল চালু করতে পারেন।',
        descriptionEn: 'You pay electricity bills regularly. Would you like to schedule automatic monthly payments?',
        actionPrompt: 'Every month pay my electricity bill',
        actionLabel: 'শিডিউল করুন (Schedule Now)',
      });
    }

    // Check for pending reminders
    const pendingReminder = await Reminder.findOne({
      userId: user._id,
      isCompleted: false,
    });

    if (pendingReminder) {
      insights.push({
        id: 'ins-reminder-due',
        category: 'reminder',
        titleBn: `বকেয়া রিমাইন্ডার: ${pendingReminder.title}`,
        titleEn: `Pending Reminder: ${pendingReminder.title}`,
        descriptionBn: `আপনার একটি নির্ধারিত রিমাইন্ডার বাকি রয়েছে।`,
        descriptionEn: `You have a scheduled reminder waiting for action.`,
        actionLabel: 'সম্পন্ন করুন (Complete)',
      });
    }

    res.json({ insights });
  } catch (err) {
    next(err);
  }
});

// Get Conversation History
agentAiRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { getConversationHistory } = await import('../services/copilot/memory.service.js');
    const limit = parseInt(req.query.limit || '40', 10);
    const history = await getConversationHistory({ userId: req.user._id, limit });
    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

// Clear Conversation History
agentAiRouter.delete('/history', requireAuth, async (req, res, next) => {
  try {
    const { clearConversationHistory } = await import('../services/copilot/memory.service.js');
    await clearConversationHistory({ userId: req.user._id });
    res.json({ success: true, message: 'Conversation history cleared successfully.' });
  } catch (err) {
    next(err);
  }
});

// Get User Financial Memory & Remembered Facts
agentAiRouter.get('/memory', requireAuth, async (req, res, next) => {
  try {
    const { recallMemories, getOrCreateFinancialMemory } = await import('../services/copilot/memory.service.js');
    const memory = await getOrCreateFinancialMemory(req.user._id);
    const recalled = await recallMemories({ userId: req.user._id, query: req.query.q, category: req.query.category });
    res.json({ success: true, memory, ...recalled });
  } catch (err) {
    next(err);
  }
});

// Remember a New Personal Fact, Preference, or Contact Alias
agentAiRouter.post('/memory', requireAuth, async (req, res, next) => {
  try {
    const { rememberFact } = await import('../services/copilot/memory.service.js');
    const { fact, category, key, value } = req.body;
    if (!fact) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Fact text is required.' });
    }
    const result = await rememberFact({
      userId: req.user._id,
      fact,
      category,
      key,
      value,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Delete a Specific Remembered Fact / Alias / Utility
agentAiRouter.delete('/memory/:id', requireAuth, async (req, res, next) => {
  try {
    const { forgetFact } = await import('../services/copilot/memory.service.js');
    const result = await forgetFact({ userId: req.user._id, factId: req.params.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Clear All User Remembered Facts & Context
agentAiRouter.delete('/memory', requireAuth, async (req, res, next) => {
  try {
    const { clearUserMemory } = await import('../services/copilot/memory.service.js');
    await clearUserMemory({ userId: req.user._id });
    res.json({ success: true, message: 'All personal memory notes and aliases cleared.' });
  } catch (err) {
    next(err);
  }
});

// Configure Micro-Savings Rules
agentAiRouter.post('/savings/configure', requireAuth, async (req, res, next) => {
  try {
    const { configureMicroSavings } = await import('../services/microSavings.service.js');
    const microSavings = await configureMicroSavings({
      userId: req.user._id,
      ...req.body,
    });
    res.json({ success: true, microSavings });
  } catch (err) {
    next(err);
  }
});

export default agentAiRouter;
