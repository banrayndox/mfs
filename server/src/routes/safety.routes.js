import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';
import logger from '../utils/logger.js';

export const safetyRouter = express.Router();

/**
 * Check suspicious SMS / message text for scam & fraud indicators.
 */
safetyRouter.post('/check-message', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Message text is required.' });
    }

    const lower = message.toLowerCase();
    const reasons = [];
    let score = 10;
    let label = 'likely_safe';

    // 1. PIN or OTP asking
    if (
      lower.includes('pin') ||
      lower.includes('otp') ||
      lower.includes('পিন') ||
      lower.includes('ওটিপি') ||
      lower.includes('পাসওয়ার্ড') ||
      lower.includes('password')
    ) {
      score += 45;
      reasons.push({
        code: 'CREDENTIAL_HARVESTING',
        bn: 'পিন (PIN) বা ওটিপি (OTP) চাওয়া হচ্ছে, যা কোনো আর্থিক প্রতিষ্ঠান কখনো চায় না।',
        en: 'Asking for PIN or OTP, which financial institutions will never request.',
      });
    }

    // 2. Lottery, Prize, Free Money
    if (
      lower.includes('lottery') ||
      lower.includes('prize') ||
      lower.includes('congratulations') ||
      lower.includes('লটারি') ||
      lower.includes('পুরস্কার') ||
      lower.includes('বিজয়ী') ||
      lower.includes('জিতেছেন') ||
      lower.includes('বোনাস')
    ) {
      score += 35;
      reasons.push({
        code: 'LOTTERY_SCAM',
        bn: 'ভুয়া লটারি বা বিনা মূল্যে পুরস্কারের লোভ দেখানো হয়েছে।',
        en: 'Fake lottery or unearned cash reward incentive detected.',
      });
    }

    // 3. Urgent threats or pressure
    if (
      lower.includes('urgent') ||
      lower.includes('immediately') ||
      lower.includes('হুমকি') ||
      lower.includes('জরুরি') ||
      lower.includes('বন্ধ হয়ে যাবে') ||
      lower.includes('এখনি') ||
      lower.includes('ব্লক') ||
      lower.includes('পুলিশ')
    ) {
      score += 25;
      reasons.push({
        code: 'FALSE_URGENCY',
        bn: 'অ্যাকাউন্ট ব্লক বা আইনি ভীতি দেখিয়ে তাড়াহুড়ো করানো হচ্ছে।',
        en: 'Creating false urgency or legal threats to coerce immediate action.',
      });
    }

    // 4. Impersonation of upay, bKash, Nagad
    if (
      lower.includes('head office') ||
      lower.includes('হেড অফিস') ||
      lower.includes('কাস্টমার কেয়ার') ||
      lower.includes('সার্ভার আপডেট') ||
      lower.includes('system update')
    ) {
      score += 20;
      reasons.push({
        code: 'IMPERSONATION',
        bn: 'এমএফএস প্রধান কার্যালয় বা কাস্টমার সাপোর্টের মিথ্যা পরিচয় ব্যবহার করা হয়েছে।',
        en: 'False impersonation of official MFS support or central operations.',
      });
    }

    score = Math.min(100, score);
    if (score >= 65) {
      label = 'scam';
    } else if (score >= 35) {
      label = 'suspicious';
    } else {
      label = 'likely_safe';
    }

    const explanationBn =
      label === 'scam'
        ? '⚠️ এটি অত্যন্ত ঝুঁকিপূর্ণ একটি স্ক্যাম বার্তা! কোনো লিংকে ক্লিক করবেন না এবং পিন/ওটিপি কারো সাথে শেয়ার করবেন না।'
        : label === 'suspicious'
        ? '⚠️ এই বার্তাটিতে সন্দেহজনক উপাদান রয়েছে। প্রেরকের সত্যতা যাচাই না করে কোনো আর্থিক লেনদেন করবেন না।'
        : '✓ বার্তাটিতে কোনো পরিচিত প্রতারণা বা ফিশিং চিহ্ন পাওয়া যায়নি। তবুও অপরিচিত নম্বরে লেনদেনে সতর্ক থাকুন।';

    const explanationEn =
      label === 'scam'
        ? '⚠️ High risk scam message detected! Do not click any links or share your secret PIN/OTP.'
        : label === 'suspicious'
        ? '⚠️ This message exhibits suspicious patterns. Verify the sender identity before taking any action.'
        : '✓ No known scam or phishing patterns detected. Always exercise standard caution with unfamiliar contacts.';

    res.json({
      success: true,
      label,
      score,
      reasons,
      explanationBn,
      explanationEn,
      safetyTips: [
        'কখনই কারো সাথে ৪-সংখ্যার গোপন পিন শেয়ার করবেন না।',
        'উপায় বা কোনো ব্যাংক কখনোই ফোন করে ওটিপি চায় না।',
        'সন্দেহ হলে সরাসরি ১৬২১৬ হেল্পলাইনে কল করুন।',
      ],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get all notifications for current authenticated user from MongoDB
 */
safetyRouter.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Mark a single notification as read
 */
safetyRouter.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found.' });
    }
    res.json({ success: true, notification });
  } catch (err) {
    next(err);
  }
});

/**
 * Mark all notifications as read for current user
 */
safetyRouter.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

export default safetyRouter;
