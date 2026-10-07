import express from 'express';
import { requireAuth, requireTier } from '../middleware/auth.js';
import { createMoneyRequest, payMoneyRequest } from '../services/request.service.js';
import { MoneyRequest } from '../models/index.js';

export const requestRouter = express.Router();

// List Money Requests
requestRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const requests = await MoneyRequest.find({
      $or: [{ creatorId: req.user._id }, { 'participants.userId': req.user._id }, { 'participants.phone': req.user.phone }],
    }).sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// Create Money Request / Bill Split
requestRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { kind, splitType, totalAmountPoisha, participants, description, merchantName } = req.body;
    const request = await createMoneyRequest({
      creatorUserId: req.user._id,
      kind,
      splitType,
      totalAmountPoisha: Number(totalAmountPoisha),
      participants,
      description,
      merchantName,
    });
    res.status(201).json({ success: true, request });
  } catch (err) {
    next(err);
  }
});

// Pay Money Request / Split Share (Requires Tier 2)
requestRouter.post('/:id/pay', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const result = await payMoneyRequest({
      requestId: req.params.id,
      payerUserId: req.user._id,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default requestRouter;
