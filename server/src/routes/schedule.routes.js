import crypto from 'crypto';
import express from 'express';
import { requireAuth, requireTier } from '../middleware/auth.js';
import { createSchedule } from '../services/scheduler.service.js';
import { createRule } from '../services/rule.service.js';
import { Schedule, Rule, Reminder, PendingAction } from '../models/index.js';
import { computeCanonicalActionHash, consumeStepUpToken } from '../services/auth.service.js';

export const scheduleRouter = express.Router();

// Schedules
scheduleRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const schedules = await Schedule.find({ userId: req.user._id }).sort({ nextRunAt: 1 });
    res.json({ schedules });
  } catch (err) {
    next(err);
  }
});

// Prepare Schedule -> Creates PendingAction with canonical actionHash
scheduleRouter.post('/prepare', requireAuth, async (req, res, next) => {
  try {
    const { actionType, frequency, actionPayload, nextRunAt, mandate } = req.body;
    if (!actionType || !frequency) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'actionType and frequency are required.' });
    }

    const actionId = `sched-act-${crypto.randomUUID()}`;
    const resolvedNextRunAt = nextRunAt ? new Date(nextRunAt) : new Date(Date.now() + 24 * 3600 * 1000);
    const resolvedMandate = mandate || {
      maxAmountPerRun: actionPayload?.amountPoisha || 50000,
      dailyCap: (actionPayload?.amountPoisha || 50000) * 2,
    };
    const payload = { actionType, frequency, actionPayload, nextRunAt: resolvedNextRunAt, mandate: resolvedMandate };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'create_schedule', payload });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId: req.user._id,
      tool: 'create_schedule',
      args: payload,
      preview: {
        actionType: 'create_schedule',
        title: actionType === 'send_money' ? 'শিডিউল সেন্ড মানি (Scheduled Send Money)' : 'শিডিউল বিদ্যুৎ বিল (Scheduled Bill)',
        amountPoisha: actionPayload?.amountPoisha || 0,
        recipientPhone: actionPayload?.recipientPhone || '',
        details: { frequency, nextRunAt: resolvedNextRunAt },
      },

      requiredTier: 'T2',
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute TTL
    });

    res.status(201).json({
      success: true,
      pendingAction: {
        actionId: pending.actionId,
        actionHash: pending.actionHash,
        preview: pending.preview,
        expiresAt: pending.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Confirm Schedule -> Verifies step-up token and activates schedule
scheduleRouter.post('/confirm', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { actionId } = req.body;
    if (!actionId) {
      return res.status(400).json({ code: 'MISSING_ACTION_ID', message: 'actionId is required for confirmation.' });
    }

    const pending = await PendingAction.findOne({
      actionId,
      userId: req.user._id,
      status: 'pending',
    });

    if (!pending) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'Pending schedule action not found or already processed.' });
    }

    if (pending.expiresAt < new Date()) {
      pending.status = 'expired';
      await pending.save();
      return res.status(400).json({ code: 'ACTION_EXPIRED', message: 'Pending schedule action has expired.' });
    }

    const schedule = await createSchedule({
      userId: req.user._id,
      actionType: pending.args.actionType,
      frequency: pending.args.frequency,
      actionPayload: pending.args.actionPayload,
      nextRunAt: pending.args.nextRunAt,
      mandate: pending.args.mandate,
    });

    pending.status = 'executed';
    await pending.save();

    if (req.stepUpToken) {
      await consumeStepUpToken(req.stepUpToken);
    }

    res.status(201).json({ success: true, schedule });
  } catch (err) {
    next(err);
  }
});

// Legacy / Direct Schedule Creation (also handles actionId confirmation)
scheduleRouter.post('/', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    if (req.body.actionId) {
      const pending = await PendingAction.findOne({
        actionId: req.body.actionId,
        userId: req.user._id,
        status: 'pending',
      });

      if (!pending) {
        return res.status(400).json({ code: 'INVALID_ACTION', message: 'Pending schedule action not found or already processed.' });
      }

      if (pending.expiresAt < new Date()) {
        pending.status = 'expired';
        await pending.save();
        return res.status(400).json({ code: 'ACTION_EXPIRED', message: 'Pending schedule action has expired.' });
      }

      const schedule = await createSchedule({
        userId: req.user._id,
        actionType: pending.args.actionType,
        frequency: pending.args.frequency,
        actionPayload: pending.args.actionPayload,
        nextRunAt: pending.args.nextRunAt,
        mandate: pending.args.mandate,
      });

      pending.status = 'executed';
      await pending.save();

      if (req.stepUpToken) {
        await consumeStepUpToken(req.stepUpToken);
      }

      return res.status(201).json({ success: true, schedule });
    }

    const { actionType, frequency, actionPayload, nextRunAt, mandate } = req.body;
    const schedule = await createSchedule({
      userId: req.user._id,
      actionType,
      frequency,
      actionPayload,
      nextRunAt,
      mandate,
    });

    if (req.stepUpToken) {
      await consumeStepUpToken(req.stepUpToken);
    }

    res.status(201).json({ success: true, schedule });
  } catch (err) {
    next(err);
  }
});

// Rules
scheduleRouter.get('/rules', requireAuth, async (req, res, next) => {
  try {
    const rules = await Rule.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

// Prepare Rule -> Creates PendingAction with canonical actionHash
scheduleRouter.post('/rules/prepare', requireAuth, async (req, res, next) => {
  try {
    const { trigger, action, mandate } = req.body;
    if (!trigger || !action) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'trigger and action are required.' });
    }

    const actionId = `rule-act-${crypto.randomUUID()}`;
    const payload = { trigger, action, mandate };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'create_rule', payload });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId: req.user._id,
      tool: 'create_rule',
      args: payload,
      preview: {
        actionType: 'create_rule',
        title: 'শর্তযুক্ত রুল তৈরি (Conditional Rule)',
        details: { triggerType: trigger.type, actionType: action.type },
      },
      requiredTier: 'T2',
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute TTL
    });

    res.status(201).json({
      success: true,
      pendingAction: {
        actionId: pending.actionId,
        actionHash: pending.actionHash,
        preview: pending.preview,
        expiresAt: pending.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Confirm Rule -> Verifies step-up token and activates rule
scheduleRouter.post('/rules/confirm', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { actionId } = req.body;
    if (!actionId) {
      return res.status(400).json({ code: 'MISSING_ACTION_ID', message: 'actionId is required for confirmation.' });
    }

    const pending = await PendingAction.findOne({
      actionId,
      userId: req.user._id,
      status: 'pending',
    });

    if (!pending) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'Pending rule action not found or already processed.' });
    }

    if (pending.expiresAt < new Date()) {
      pending.status = 'expired';
      await pending.save();
      return res.status(400).json({ code: 'ACTION_EXPIRED', message: 'Pending rule action has expired.' });
    }

    const rule = await createRule({
      userId: req.user._id,
      trigger: pending.args.trigger,
      action: pending.args.action,
      mandate: pending.args.mandate,
    });

    pending.status = 'executed';
    await pending.save();

    if (req.stepUpToken) {
      await consumeStepUpToken(req.stepUpToken);
    }

    res.status(201).json({ success: true, rule });
  } catch (err) {
    next(err);
  }
});

// Legacy / Direct Rule Creation (also handles actionId confirmation)
scheduleRouter.post('/rules', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    if (req.body.actionId) {
      const pending = await PendingAction.findOne({
        actionId: req.body.actionId,
        userId: req.user._id,
        status: 'pending',
      });

      if (!pending) {
        return res.status(400).json({ code: 'INVALID_ACTION', message: 'Pending rule action not found or already processed.' });
      }

      if (pending.expiresAt < new Date()) {
        pending.status = 'expired';
        await pending.save();
        return res.status(400).json({ code: 'ACTION_EXPIRED', message: 'Pending rule action has expired.' });
      }

      const rule = await createRule({
        userId: req.user._id,
        trigger: pending.args.trigger,
        action: pending.args.action,
        mandate: pending.args.mandate,
      });

      pending.status = 'executed';
      await pending.save();

      if (req.stepUpToken) {
        await consumeStepUpToken(req.stepUpToken);
      }

      return res.status(201).json({ success: true, rule });
    }

    const { trigger, action, mandate } = req.body;
    const rule = await createRule({
      userId: req.user._id,
      trigger,
      action,
      mandate,
    });

    if (req.stepUpToken) {
      await consumeStepUpToken(req.stepUpToken);
    }

    res.status(201).json({ success: true, rule });
  } catch (err) {
    next(err);
  }
});


// Reminders
scheduleRouter.get('/reminders', requireAuth, async (req, res, next) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id }).sort({ dueAt: 1 });
    res.json({ reminders });
  } catch (err) {
    next(err);
  }
});

scheduleRouter.post('/reminders', requireAuth, async (req, res, next) => {
  try {
    const { title, dueAt, amount, deepLink } = req.body;
    const reminder = await Reminder.create({
      userId: req.user._id,
      title,
      dueAt: new Date(dueAt),
      amount,
      deepLink,
    });
    res.status(201).json({ success: true, reminder });
  } catch (err) {
    next(err);
  }
});

export default scheduleRouter;
