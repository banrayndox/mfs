/**
 * @file domainRouter.js
 * Central Orchestrator & Domain Router for Guardian MFS AI Copilot.
 * Accepts structured JSON context and dispatches to specialized Domain Agents:
 * - SavingsAgent (all manual savings, micro-savings, percentage, round-up, goals)
 * - GuardianAgent (all child accounts, daily limits, approvals, status)
 * - GroupBillAgent (request money, equal/custom group bill splits, status)
 * - ScheduleRuleAgent (reminders, one-time schedules, recurring, conditional rules)
 *
 * Each domain agent provides robust semantic understanding, handling typos,
 * slang, Banglish, and partial slot-filling across multi-turn workflows.
 */

import { isSavingsIntent, handleSavingsDomain } from './savingsAgent.js';
import { isGuardianIntent, handleGuardianDomain } from './guardianAgent.js';
import { isGroupBillIntent, handleGroupBillDomain } from './groupBillAgent.js';
import { isScheduleRuleIntent, handleScheduleRuleDomain } from './scheduleRuleAgent.js';
import logger from '../../../utils/logger.js';

/**
 * Routes the user request to the matching specialized Domain Agent.
 * @param {Object} context
 * @param {string} context.userId
 * @param {string} context.messageText
 * @param {string} [context.language='bn']
 * @param {Object} [context.user]
 * @param {Object} [context.wallet]
 * @param {Object} [context.taskState]
 * @param {Object} [context.intent]
 * @returns {Promise<{ handled: boolean, reply?: string, clientAction?: Object, pendingAction?: Object, actionState?: Object }>}
 */
export async function routeToDomainAgent(context) {
  const { messageText, taskState, intent } = context;
  if (!messageText) return { handled: false };

  // Priority 1: Savings, Goals & Micro-Savings Domain
  if (isSavingsIntent(messageText, taskState, intent)) {
    try {
      logger.info('[DomainRouter] Routing to SavingsAgent');
      const result = await handleSavingsDomain(context);
      if (result && result.handled) return result;
    } catch (err) {
      logger.error({ err }, '[DomainRouter] Error in SavingsAgent');
    }
  }

  // Priority 2: Guardian & Child Domain
  if (isGuardianIntent(messageText, taskState, intent)) {
    try {
      logger.info('[DomainRouter] Routing to GuardianAgent');
      const result = await handleGuardianDomain(context);
      if (result && result.handled) return result;
    } catch (err) {
      logger.error({ err }, '[DomainRouter] Error in GuardianAgent');
    }
  }

  // Priority 3: Group Bill & Payment Requests Domain
  if (isGroupBillIntent(messageText, taskState, intent)) {
    try {
      logger.info('[DomainRouter] Routing to GroupBillAgent');
      const result = await handleGroupBillDomain(context);
      if (result && result.handled) return result;
    } catch (err) {
      logger.error({ err }, '[DomainRouter] Error in GroupBillAgent');
    }
  }

  // Priority 4: Reminders, Scheduled Transfers & Conditional Rules Domain
  if (isScheduleRuleIntent(messageText, taskState, intent)) {
    try {
      logger.info('[DomainRouter] Routing to ScheduleRuleAgent');
      const result = await handleScheduleRuleDomain(context);
      if (result && result.handled) return result;
    } catch (err) {
      logger.error({ err }, '[DomainRouter] Error in ScheduleRuleAgent');
    }
  }

  return { handled: false };
}

export default {
  routeToDomainAgent,
};
