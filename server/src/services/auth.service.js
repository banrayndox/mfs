import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Wallet, AuditLog, ProtectedProfile, Notification, ConsumedToken } from '../models/index.js';
import { createInitialBalance } from './ledger.service.js';
import logger from '../utils/logger.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-fallback-key-32chars';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-fallback-key-32chars';

export async function register({
  phone,
  pin,
  name,
  accountType = 'CUSTOMER',
  agentProfile = null,
  dob,
  parentPhone = null,
  dailyLimitPoisha = 50000,
}) {
  if (!phone || !pin || !name) {
    throw new Error('Phone, PIN, and name are required.');
  }

  // Validate phone format (BD standard 01XXXXXXXXX)
  const cleanPhone = phone.trim().replace(/^(\+88)/, '');
  if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
    throw new Error('Invalid Bangladeshi mobile number format (must be 11 digits starting with 01[3-9]).');
  }

  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits.');
  }

  const existing = await User.findOne({ phone: cleanPhone });
  if (existing) {
    throw new Error('An account already exists with this phone number.');
  }

  // Parent validation if registering as CHILD
  let parentUser = null;
  if (accountType === 'CHILD') {
    const cleanParentPhone = parentPhone ? parentPhone.trim().replace(/^(\+88)/, '') : null;
    if (!cleanParentPhone) {
      throw new Error('Parent phone number is required for child account registration.');
    }
    parentUser = await User.findOne({ phone: cleanParentPhone, status: 'active' });
    if (!parentUser) {
      throw new Error('Parent phone number is not registered in Guardian MFS.');
    }
    if (parentUser.phone === cleanPhone) {
      throw new Error('Child phone number cannot be the same as parent phone number.');
    }
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const isAgent = accountType === 'AGENT';
    const isChild = accountType === 'CHILD';
    const role = isAgent ? 'agent' : 'user';

    const processedAgentProfile = isAgent
      ? {
          agentId: `AGT-${cleanPhone.slice(-4)}-${Math.floor(100 + Math.random() * 900)}`,
          businessName: agentProfile?.businessName || `${name} Cash Point`,
          location: agentProfile?.location || 'Dhaka',
          address: agentProfile?.address || 'Dhaka, Bangladesh',
          status: 'active',
        }
      : undefined;

    // 1. Create User
    const [user] = await User.create(
      [
        {
          phone: cleanPhone,
          pinHash,
          name: name.trim(),
          accountType: isAgent ? 'AGENT' : isChild ? 'CHILD' : 'CUSTOMER',
          role,
          dob: dob || (isChild ? '2012-05-15' : '1995-01-01'),
          agentProfile: processedAgentProfile,
        },
      ],
      { session }
    );

    // 2. Create Primary Wallet
    const [wallet] = await Wallet.create(
      [
        {
          userId: user._id,
          type: isAgent ? 'agent' : 'primary',
          balance: 0,
        },
      ],
      { session }
    );

    // 3. Credit ৳10,000 initial demo balance through the ledger system
    await createInitialBalance({
      userId: user._id,
      walletId: wallet._id,
      session,
    });

    // 4. Record Audit Log
    await AuditLog.create(
      [
        {
          userId: user._id,
          action: 'USER_REGISTERED',
          actorType: 'user',
          status: 'success',
          details: {
            phone: cleanPhone,
            accountType: user.accountType,
            role,
            initialBalancePoisha: 1000000,
          },
        },
      ],
      { session }
    );

    // 5. If CHILD account, create ProtectedProfile & notify Guardian
    if (isChild && parentUser) {
      await ProtectedProfile.create(
        [
          {
            guardianId: parentUser._id,
            childUserId: user._id,
            birthCertificateMasked: '2012********9012',
            birthCertHash: Buffer.from(`${cleanPhone}-child-cert`).toString('base64'),
            dailyLimitPoisha: Number(dailyLimitPoisha) || 50000,
            requireApprovalForNewRecipients: true,
            status: 'active',
          },
        ],
        { session }
      );

      await Notification.create(
        [
          {
            userId: parentUser._id,
            title: 'সন্তান অ্যাকাউন্ট যুক্ত হয়েছে (Child Account Linked)',
            body: `${user.name} (${user.phone}) আপনার অধীনে চাইল্ড অ্যাকাউন্ট হিসেবে নিবন্ধিত হয়েছে। দৈনিক সীমা: ৳${((Number(dailyLimitPoisha) || 50000) / 100).toFixed(2)}`,
            type: 'system',
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    logger.info({ userId: user._id, phone: cleanPhone, accountType }, 'User registered successfully with ৳10,000 demo balance.');

    const tokens = generateTokens(user);
    return {
      user: sanitizeUser(user),
      tokens,
      walletBalancePoisha: 1000000,
    };
  } catch (err) {
    await session.abortTransaction();
    logger.error({ err, phone: cleanPhone }, 'Registration failed atomically');
    throw err;
  } finally {
    session.endSession();
  }
}

export async function login({ phone, pin }) {
  if (!phone || !pin) {
    throw new Error('Phone and PIN are required.');
  }

  const cleanPhone = phone.trim().replace(/^(\+88)/, '');
  const user = await User.findOne({ phone: cleanPhone });

  if (!user) {
    throw new Error('Invalid phone number or PIN.');
  }

  // Check lockout
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Account locked due to multiple failed attempts. Please try again in ${minutesLeft} minutes.`);
  }

  const isPinValid = await bcrypt.compare(pin, user.pinHash);
  if (!isPinValid) {
    user.failedPinAttempts += 1;
    if (user.failedPinAttempts >= 3) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      user.status = 'locked';
    }
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'LOGIN_FAILED_PIN',
      actorType: 'user',
      status: 'failure',
      details: { failedAttempts: user.failedPinAttempts },
    });

    throw new Error('Invalid phone number or PIN.');
  }

  // Reset failed attempts on success
  user.failedPinAttempts = 0;
  user.lockoutUntil = null;
  if (user.status === 'locked') user.status = 'active';
  await user.save();

  const primaryWallet = await Wallet.findOne({ userId: user._id, type: { $in: ['primary', 'agent'] } });
  const tokens = generateTokens(user);

  await AuditLog.create({
    userId: user._id,
    action: 'LOGIN_SUCCESS',
    actorType: 'user',
    status: 'success',
  });

  const sanitizedUser = sanitizeUser(user);
  if (user.accountType === 'CHILD') {
    const profile = await ProtectedProfile.findOne({ childUserId: user._id, status: { $ne: 'inactive' } }).populate('guardianId', 'name phone');
    if (profile && profile.guardianId) {
      sanitizedUser.guardian = {
        name: profile.guardianId.name,
        phone: profile.guardianId.phone,
        controlMode: profile.controlMode,
        dailyLimitPoisha: profile.dailyLimitPoisha,
        status: profile.status,
      };
    }
  }

  return {
    user: sanitizedUser,
    tokens,
    walletBalancePoisha: primaryWallet ? primaryWallet.balance : 0,
  };
}

/**
 * Canonical action hash generator ensuring stable hash binding between
 * preparation, step-up token issuance, and final confirmation.
 */
export function computeCanonicalActionHash({ actionId, actionType, tool, payload, args }) {
  const type = actionType || tool || 'action';
  const data = payload || args || {};
  const sortedData = JSON.stringify(data, Object.keys(data).sort());
  return crypto
    .createHash('sha256')
    .update(`${actionId}:${type}:${sortedData}`)
    .digest('hex');
}

// In-memory cache for fast synchronous anti-replay lookups backed by MongoDB
const consumedTokensCache = new Set();

export async function isStepUpTokenConsumed(token) {
  if (!token) return false;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (consumedTokensCache.has(tokenHash)) return true;
  const found = await ConsumedToken.findOne({ tokenHash });
  if (found) {
    consumedTokensCache.add(tokenHash);
    return true;
  }
  return false;
}

export async function consumeStepUpToken(token) {
  if (!token) return;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  consumedTokensCache.add(tokenHash);

  try {
    const decoded = jwt.decode(token);
    await ConsumedToken.create({
      tokenHash,
      userId: decoded?.userId,
      actionHash: decoded?.actionHash || 'unknown',
      consumedAt: new Date(),
    });
  } catch (err) {
    // Already tracked or duplicate
  }
}

export async function createStepUpToken({ userId, pin, actionHash, requiredTier = 'T2' }) {
  if (!userId || !pin || !actionHash) {
    throw new Error('userId, PIN, and actionHash are required for step-up authentication.');
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const isPinValid = await bcrypt.compare(pin, user.pinHash);
  if (!isPinValid) {
    throw new Error('Invalid PIN.');
  }

  // Generate single-use step-up token valid for 60 seconds bound to actionHash
  const stepUpToken = jwt.sign(
    {
      userId: user._id.toString(),
      actionHash,
      tier: requiredTier,
      purpose: 'step_up',
      jti: crypto.randomUUID(),
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '60s' }
  );

  return stepUpToken;
}

/**
 * Step-up authentication helper returning { stepUpToken }.
 */
export async function stepUp({ userId, pin, actionType, actionHash, requiredTier = 'T2' }) {
  const stepUpToken = await createStepUpToken({ userId, pin, actionHash, requiredTier });
  return { stepUpToken };
}

export async function verifyStepUpToken({ token, expectedActionHash, minTier = 'T2' }) {
  if (!token) {
    throw new Error('Step-up token is required for this operation (T2/T3).');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    throw new Error(`Step-up authorization failed: ${err.message}`);
  }

  if (decoded.purpose !== 'step_up') {
    throw new Error('Invalid token purpose.');
  }

  if (decoded.actionHash !== expectedActionHash) {
    throw new Error('Step-up token action hash mismatch (anti-replay violation).');
  }

  const tierRanks = { T0: 0, T1: 1, T2: 2, T3: 3 };
  if ((tierRanks[decoded.tier] || 0) < (tierRanks[minTier] || 0)) {
    throw new Error(`Insufficient security tier for this operation. Required: ${minTier}, provided: ${decoded.tier}`);
  }

  // Check if token has already been consumed
  const alreadyConsumed = await isStepUpTokenConsumed(token);
  if (alreadyConsumed) {
    throw new Error('Step-up token has already been consumed (anti-replay violation).');
  }

  return decoded;
}


export function generateTokens(user) {
  const payload = {
    userId: user._id.toString(),
    phone: user.phone,
    role: user.role,
    accountType: user.accountType,
  };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
}

export function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    phone: user.phone,
    name: user.name,
    accountType: user.accountType,
    role: user.role,
    dob: user.dob,
    language: user.language,
    theme: user.theme,
    agentProfile: user.agentProfile,
  };
}

export async function ensureDefaultDemoUsers() {
  // Retained only for standalone seed scripts; NEVER called during normal application startup or runtime.
  return [];
}

export async function quickSwitchUser(phone) {
  const cleanPhone = phone.trim().replace(/^(\+88)/, '');
  const user = await User.findOne({ phone: cleanPhone, status: 'active' });
  if (!user) {
    throw new Error(`Account with phone ${cleanPhone} not found. Please register first.`);
  }

  const wallet = await Wallet.findOne({ userId: user._id, type: { $in: ['primary', 'agent'] } });
  const tokens = generateTokens(user);

  const sanitizedUser = sanitizeUser(user);
  if (user.accountType === 'CHILD') {
    const profile = await ProtectedProfile.findOne({ childUserId: user._id, status: { $ne: 'inactive' } }).populate('guardianId', 'name phone');
    if (profile && profile.guardianId) {
      sanitizedUser.guardian = {
        name: profile.guardianId.name,
        phone: profile.guardianId.phone,
        controlMode: profile.controlMode,
        dailyLimitPoisha: profile.dailyLimitPoisha,
        status: profile.status,
      };
    }
  }

  return {
    user: sanitizedUser,
    tokens,
    walletBalancePoisha: wallet ? wallet.balance : 0,
  };
}

export async function listDemoAccounts() {
  // Return registered users currently in MongoDB (never creates demo accounts)
  const users = await User.find({ status: 'active' }).limit(10);

  const accounts = await Promise.all(
    users.map(async (u) => {
      const wallet = await Wallet.findOne({ userId: u._id, type: { $in: ['primary', 'agent'] } });
      return {
        id: u._id,
        phone: u.phone,
        name: u.name,
        accountType: u.accountType,
        agentProfile: u.agentProfile,
        balancePoisha: wallet ? wallet.balance : 0,
      };
    })
  );

  return accounts;
}

export async function changePin({ userId, currentPin, newPin, confirmPin }) {
  if (!userId || !currentPin || !newPin) {
    throw new Error('Current PIN and new PIN are required.');
  }

  if (!/^\d{4}$/.test(newPin)) {
    throw new Error('New PIN must be exactly 4 digits.');
  }

  if (confirmPin && newPin !== confirmPin) {
    throw new Error('New PIN and confirmation PIN do not match.');
  }

  if (currentPin === newPin) {
    throw new Error('New PIN cannot be the same as current PIN.');
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const isCurrentValid = await bcrypt.compare(currentPin, user.pinHash);
  if (!isCurrentValid) {
    user.failedPinAttempts = (user.failedPinAttempts || 0) + 1;
    await user.save();
    throw new Error('Current PIN is incorrect.');
  }

  const newPinHash = await bcrypt.hash(newPin, 10);
  user.pinHash = newPinHash;
  user.failedPinAttempts = 0;
  await user.save();

  await AuditLog.create({
    userId: user._id,
    action: 'PIN_CHANGE',
    actorType: 'user',
    status: 'success',
  });

  await Notification.create({
    userId: user._id,
    type: 'security_alert',
    title: 'PIN পরিবর্তন সফল হয়েছে',
    body: 'আপনার অ্যাকাউন্টের গোপন পিন সফলভাবে পরিবর্তন করা হয়েছে।',
  });

  return { success: true, message: 'PIN changed successfully.' };
}

export default {
  register,
  login,
  createStepUpToken,
  verifyStepUpToken,
  generateTokens,
  sanitizeUser,
  ensureDefaultDemoUsers,
  quickSwitchUser,
  listDemoAccounts,
  changePin,
};


