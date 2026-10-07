import express from 'express';
import {
  register,
  login,
  createStepUpToken,
  sanitizeUser,
  quickSwitchUser,
  listDemoAccounts,
  changePin,
} from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { Wallet, ProtectedProfile } from '../models/index.js';

export const authRouter = express.Router();

// List active demo accounts
authRouter.get('/demo-accounts', async (req, res, next) => {
  try {
    const accounts = await listDemoAccounts();
    res.json({ success: true, accounts });
  } catch (err) {
    next(err);
  }
});

// 1-Click quick switch to a demo account
authRouter.post('/quick-switch', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Phone is required.' });
    }
    const result = await quickSwitchUser(phone);
    res.json({
      success: true,
      message: `Switched to ${result.user.name}`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// Register Customer or Agent (with automatic ৳10,000 demo credit)
authRouter.post('/register', async (req, res, next) => {
  try {
    const { phone, pin, name, accountType, agentProfile, dob, parentPhone, dailyLimitPoisha } = req.body;
    const result = await register({
      phone,
      pin,
      name,
      accountType,
      agentProfile,
      dob,
      parentPhone,
      dailyLimitPoisha,
    });
    res.status(201).json({
      success: true,
      message: 'Account registered successfully with ৳10,000 demo balance.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// Login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { phone, pin } = req.body;
    const result = await login({ phone, pin });
    res.json({
      success: true,
      message: 'Login successful.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// Step-Up Authentication (returns 60s stepUpToken bound to actionHash)
authRouter.post('/step-up', requireAuth, async (req, res, next) => {
  try {
    const { pin, actionHash, requiredTier = 'T2' } = req.body;
    const stepUpToken = await createStepUpToken({
      userId: req.user._id,
      pin,
      actionHash,
      requiredTier,
    });
    res.json({
      success: true,
      stepUpToken,
      expiresIn: 60,
    });
  } catch (err) {
    next(err);
  }
});

// Current User Profile & Balance
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id, type: { $in: ['primary', 'agent'] } });
    const sanitized = sanitizeUser(req.user);
    if (req.user.accountType === 'CHILD') {
      const profile = await ProtectedProfile.findOne({
        childUserId: req.user._id,
        status: { $ne: 'inactive' },
      }).populate('guardianId', 'name phone');
      if (profile && profile.guardianId) {
        sanitized.guardian = {
          name: profile.guardianId.name,
          phone: profile.guardianId.phone,
          controlMode: profile.controlMode,
          dailyLimitPoisha: profile.dailyLimitPoisha,
          status: profile.status,
        };
      }
    }
    res.json({
      user: sanitized,
      wallet: {
        balancePoisha: wallet ? wallet.balance : 0,
        type: wallet ? wallet.type : 'primary',
      },
    });
  } catch (err) {
    next(err);
  }
});

// Change PIN securely
authRouter.post('/change-pin', requireAuth, async (req, res, next) => {
  try {
    const { currentPin, newPin, confirmPin } = req.body;
    const result = await changePin({
      userId: req.user._id,
      currentPin,
      newPin,
      confirmPin,
    });
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
});

export default authRouter;

