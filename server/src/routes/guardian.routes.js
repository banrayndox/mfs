import express from 'express';
import { requireAuth, requireTier } from '../middleware/auth.js';
import {
  linkGuardian,
  createChildProfile,
  getPendingApprovals,
  getPendingApprovalById,
  decideGuardianApproval,
  updateChildControlMode,
  removeChildRelationship,
} from '../services/guardian.service.js';
import { consumeStepUpToken } from '../services/auth.service.js';
import { GuardianLink, ProtectedProfile } from '../models/index.js';

export const guardianRouter = express.Router();

// Get Guardian / Ward Status
guardianRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const asGuardian = await GuardianLink.find({ guardianId: req.user._id, status: 'active' }).populate('wardId', 'name phone');
    const asWard = await GuardianLink.findOne({ wardId: req.user._id, status: 'active' }).populate('guardianId', 'name phone');
    const children = await ProtectedProfile.find({ guardianId: req.user._id, status: { $ne: 'inactive' } }).populate('childUserId', 'name phone dob');
    const childProfile = await ProtectedProfile.findOne({ childUserId: req.user._id, status: { $ne: 'inactive' } }).populate('guardianId', 'name phone');

    res.json({
      isGuardian: asGuardian.length > 0 || children.length > 0,
      hasGuardian: !!asWard || !!childProfile,
      guardian: asWard ? asWard.guardianId : childProfile ? childProfile.guardianId : null,
      wards: asGuardian.map((g) => g.wardId),
      children,
      childProfile: childProfile ? {
        controlMode: childProfile.controlMode,
        dailyLimitPoisha: childProfile.dailyLimitPoisha,
        status: childProfile.status,
      } : null,
    });
  } catch (err) {
    next(err);
  }
});

// Get pending approvals for this guardian
guardianRouter.get('/pending-approvals', requireAuth, async (req, res, next) => {
  try {
    const pendingApprovals = await getPendingApprovals(req.user._id);
    res.json({ success: true, pendingApprovals });
  } catch (err) {
    next(err);
  }
});

// Get specific pending approval by txnId
guardianRouter.get('/approvals/:txnId', requireAuth, async (req, res, next) => {
  try {
    const approval = await getPendingApprovalById({
      guardianUserId: req.user._id,
      txnId: req.params.txnId,
    });
    res.json({ success: true, approval });
  } catch (err) {
    next(err);
  }
});

// Guardian approves or rejects pending transaction (Requires T2 PIN step-up)
guardianRouter.post('/approvals/:txnId/decide', requireAuth, requireTier('T2'), async (req, res, next) => {
  try {
    const { decision, reason } = req.body;
    const result = await decideGuardianApproval({
      guardianUserId: req.user._id,
      txnId: req.params.txnId,
      decision,
      reason,
    });
    if (req.stepUpToken) {
      await consumeStepUpToken(req.stepUpToken);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Link Guardian (Requires T3)
guardianRouter.post('/link', requireAuth, requireTier('T3'), async (req, res, next) => {
  try {
    const { guardianPhone, relationship, warnMode } = req.body;
    const link = await linkGuardian({
      guardianPhone,
      wardUserId: req.user._id,
      relationship,
      warnMode,
    });
    res.json({ success: true, link });
  } catch (err) {
    next(err);
  }
});

// Create Child Profile under Guardian
guardianRouter.post('/child', requireAuth, async (req, res, next) => {
  try {
    const { name, phone, dob, birthCertificateNumber, pin, dailyLimitPoisha } = req.body;
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        message: 'সন্তানের জন্য ৪-সংখ্যার পিন নম্বর আবশ্যক (4-digit numeric PIN is required for child account)',
      });
    }
    const result = await createChildProfile({
      guardianUserId: req.user._id,
      name,
      phone,
      dob,
      birthCertificateNumber,
      pin: String(pin),
      dailyLimitPoisha,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Update Child Control Mode (APPROVAL_REQUIRED, LIMITED, UPDATES_ONLY)
guardianRouter.put('/children/:childId/mode', requireAuth, async (req, res, next) => {
  try {
    const { controlMode, dailyLimitPoisha } = req.body;
    const profile = await updateChildControlMode({
      guardianUserId: req.user._id,
      childUserId: req.params.childId,
      controlMode,
      dailyLimitPoisha,
    });
    res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
});

// Remove Child Relationship (Deactivates relationship, preserves child user account)
guardianRouter.post('/children/:childId/remove', requireAuth, async (req, res, next) => {
  try {
    const profile = await removeChildRelationship({
      guardianUserId: req.user._id,
      childUserId: req.params.childId,
    });
    res.json({
      success: true,
      message: 'Child removed from guardian profile successfully. User account remains preserved.',
      profile,
    });
  } catch (err) {
    next(err);
  }
});

export default guardianRouter;
