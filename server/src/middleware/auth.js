import jwt from 'jsonwebtoken';
import { User, PendingAction } from '../models/index.js';
import { verifyStepUpToken } from '../services/auth.service.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-fallback-key-32chars';

/**
 * Middleware requiring a valid session JWT (Tier 1).
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'User account not active.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired session token.' });
  }
}

/**
 * Middleware enforcing security tiers (T2 = PIN/WebAuthn, T3 = PIN only).
 */
export function requireTier(minTier = 'T2') {
  return async (req, res, next) => {
    // If route requires T0 or T1, requireAuth already satisfied T1
    if (minTier === 'T0' || minTier === 'T1') {
      return next();
    }

    const stepUpToken = req.headers['x-step-up-token'];
    let actionHash = req.headers['x-action-hash'];

    // If x-action-hash header was not explicitly set, resolve canonical actionHash
    if (!actionHash && req.body?.actionId) {
      try {
        const pending = await PendingAction.findOne({ actionId: req.body.actionId });
        if (pending && pending.actionHash) {
          actionHash = pending.actionHash;
        } else {
          actionHash = req.body.actionId;
        }
      } catch (e) {
        actionHash = req.body.actionId;
      }
    } else if (!actionHash && req.body?.idempotencyKey) {
      actionHash = String(req.body.idempotencyKey);
    } else if (!actionHash && req.params?.txnId) {
      actionHash = `guardian-approve-${req.params.txnId}`;
    }

    if (!stepUpToken) {
      return res.status(403).json({
        code: 'STEP_UP_REQUIRED',
        message: `Security tier ${minTier} step-up verification required.`,
        requiredTier: minTier,
      });
    }

    try {
      // If actionHash is provided, verify anti-replay binding
      if (actionHash) {
        await verifyStepUpToken({ token: stepUpToken, expectedActionHash: actionHash, minTier });
      }
      req.stepUpToken = stepUpToken;
      next();
    } catch (err) {
      return res.status(403).json({
        code: 'STEP_UP_INVALID',
        message: err.message,
        requiredTier: minTier,
      });
    }
  };
}

export default { requireAuth, requireTier };

