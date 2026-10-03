import { Rule, Notification, AuditLog } from '../models/index.js';
import { payBill, sendMoney } from './transaction.service.js';
import { eventBus } from './eventBus.js';
import logger from '../utils/logger.js';

/**
 * Create a conditional automation rule.
 */
export async function createRule({
  userId,
  trigger,
  action,
  mandate,
}) {
  if (!userId || !action || !mandate) {
    throw new Error('userId, action, and mandate are required.');
  }

  const rule = await Rule.create({
    userId,
    trigger: {
      type: trigger?.type || 'wallet_credit',
      minAmount: trigger?.minAmount || 0,
      senderPhone: trigger?.senderPhone,
    },
    action: {
      type: action.type,
      amount: action.amount,
      percentage: action.percentage,
      recipientPhone: action.recipientPhone,
      billerId: action.billerId || 'DPDC',
      billAccountNo: action.billAccountNo,
    },
    mandate: {
      maxAmountPerRun: mandate.maxAmountPerRun,
      dailyCap: mandate.dailyCap,
      expiresAt: mandate.expiresAt ? new Date(mandate.expiresAt) : undefined,
    },
    status: 'active',
  });

  await AuditLog.create({
    userId,
    action: 'RULE_CREATED',
    actorType: 'user',
    status: 'success',
    details: { ruleId: rule._id, actionType: action.type },
  });

  return rule;
}

/**
 * Handle incoming wallet.credit event and evaluate matching rules.
 */
export async function handleWalletCreditEvent({ userId, walletId, amountPoisha, senderPhone }) {
  try {
    const activeRules = await Rule.find({
      userId,
      status: 'active',
      'trigger.type': 'wallet_credit',
    });

    if (!activeRules || activeRules.length === 0) return;

    for (const rule of activeRules) {
      // Check condition: incoming amount >= minAmount
      if (rule.trigger.minAmount && amountPoisha < rule.trigger.minAmount) {
        logger.debug({ ruleId: rule._id, amountPoisha, minRequired: rule.trigger.minAmount }, 'Rule trigger condition not met (amount below threshold).');
        continue;
      }

      // Check sender condition if specified
      if (rule.trigger.senderPhone && senderPhone !== rule.trigger.senderPhone) {
        continue;
      }

      // Calculate action execution amount
      let executeAmountPoisha = rule.action.amount || 0;
      if (rule.action.percentage && amountPoisha > 0) {
        executeAmountPoisha = Math.round((amountPoisha * rule.action.percentage) / 100);
      }

      // Mandate check
      if (rule.mandate?.maxAmountPerRun && executeAmountPoisha > rule.mandate.maxAmountPerRun) {
        executeAmountPoisha = rule.mandate.maxAmountPerRun;
      }

      if (executeAmountPoisha <= 0) continue;

      logger.info({ ruleId: rule._id, actionType: rule.action.type, executeAmountPoisha }, 'Triggering conditional rule action...');

      let txnResult = null;
      if (rule.action.type === 'pay_bill') {
        txnResult = await payBill({
          userId,
          billerId: rule.action.billerId || 'DPDC',
          accountNo: rule.action.billAccountNo || '442109',
          amountPoisha: executeAmountPoisha,
          channel: 'rule',
          idempotencyKey: `rule-${rule._id}-${Date.now()}`,
        });
      } else if (rule.action.type === 'send_money') {
        txnResult = await sendMoney({
          senderUserId: userId,
          recipientPhone: rule.action.recipientPhone,
          amountPoisha: executeAmountPoisha,
          channel: 'rule',
          idempotencyKey: `rule-send-${rule._id}-${Date.now()}`,
        });
      }

      // Update rule execution counters
      rule.executionCount += 1;
      rule.lastTriggeredAt = new Date();
      await rule.save();

      // Dispatch notification
      await Notification.create({
        userId,
        title: 'অটোমেশন রুল সম্পন্ন (Conditional Rule Executed)',
        body: `টাকা জমার প্রেক্ষিতে আপনার শর্তযুক্ত রুল "${rule.action.type === 'pay_bill' ? 'বিদ্যুৎ বিল প্রদান' : 'টাকা পাঠানো'}" সফলভাবে কার্যকর হয়েছে।`,
        type: 'rule_executed',
        metadata: { ruleId: rule._id, txnId: txnResult?._id },
      });
    }
  } catch (err) {
    logger.error({ err, userId }, 'Error processing wallet.credit rule triggers');
  }
}

// Subscribe to eventBus
eventBus.on('wallet.credit', (data) => {
  handleWalletCreditEvent(data).catch((err) => {
    logger.error({ err }, 'Error in handleWalletCreditEvent listener');
  });
});

export default {
  createRule,
  handleWalletCreditEvent,
};
