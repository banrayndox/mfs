/**
 * @file copilotEventBus.js
 * Centralized Copilot Event System for Guardian MFS AI Copilot.
 * Emits real-time stateful events to UI, persists AI notifications, and audits workflows.
 */

import crypto from 'crypto';
import { Notification } from '../../models/index.js';
import { emitToUser } from '../socket.service.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {Object} CopilotEvent
 * @property {string} id
 * @property {'intent_detected'|'parameter_collected'|'missing_parameter'|'action_ready'|'confirmation_required'|'action_started'|'action_completed'|'action_failed'} type
 * @property {string} intent
 * @property {string} message
 * @property {Object} actionState
 * @property {Object} [metadata]
 * @property {string} timestamp
 */

/**
 * Emit and persist a centralized Copilot event.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.type
 * @param {string} params.intent
 * @param {string} params.message
 * @param {Object} params.actionState
 * @param {Object} [params.metadata]
 * @param {boolean} [params.persistNotification=false]
 * @returns {Promise<CopilotEvent>}
 */
export async function emitCopilotEvent({
  userId,
  type,
  intent,
  message,
  actionState,
  metadata = {},
  persistNotification = false,
}) {
  const event = {
    id: `cpevt-${crypto.randomUUID()}`,
    type,
    intent: intent || actionState?.intent || 'unknown',
    message,
    actionState: actionState || null,
    metadata,
    timestamp: new Date().toISOString(),
  };

  // 1. Broadcast real-time event to connected user clients via WebSocket
  try {
    emitToUser(userId, 'copilot:event', event);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to emit socket copilot:event');
  }

  // 2. Persist meaningful AI feedback as official system notifications
  if (persistNotification || ['action_ready', 'confirmation_required', 'action_completed', 'action_failed'].includes(type)) {
    try {
      const intentTitles = {
        send_money: 'Send Money',
        mobile_recharge: 'Mobile Recharge',
        cash_out: 'Cash Out',
        pay_bill: 'Bill Payment',
        add_money: 'Add Money',
        savings: 'Savings Plan',
        request_money: 'Money Request',
        guardian_mode: 'Guardian Mode',
        reminder: 'Reminder',
        schedule: 'Scheduled Payment',
        rules: 'Automation Rule',
        group_bill: 'Group Bill',
      };

      const titleAction = intentTitles[intent] || 'Financial Action';
      let title = `AI Copilot: ${titleAction}`;
      if (type === 'action_ready' || type === 'confirmation_required') {
        title = `AI Copilot: ${titleAction} Prepared`;
      } else if (type === 'action_completed') {
        title = `AI Copilot: ${titleAction} Completed`;
      } else if (type === 'action_failed') {
        title = `AI Copilot: ${titleAction} Failed`;
      }

      const notif = await Notification.create({
        userId,
        title,
        body: message,
        type: 'copilot',
        isRead: false,
        metadata: {
          copilotEventId: event.id,
          intent,
          type,
          actionId: actionState?.actionId,
          ...metadata,
        },
      });

      emitToUser(userId, 'notification:new', {
        id: notif._id,
        title: notif.title,
        body: notif.body,
        type: notif.type,
        createdAt: notif.createdAt,
        metadata: notif.metadata,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to persist Copilot notification');
    }
  }

  return event;
}

export const COPILOT_EVENTS = {
  INTENT_DETECTED: 'intent_detected',
  PARAM_COLLECTED: 'parameter_collected',
  MISSING_PARAMETER: 'missing_parameter',
  ACTION_READY: 'action_ready',
  CONFIRMATION_REQUIRED: 'confirmation_required',
  ACTION_STARTED: 'action_started',
  ACTION_COMPLETED: 'action_completed',
  ACTION_FAILED: 'action_failed',
  ACTION_CANCELLED: 'action_cancelled',
};

export default {
  emitCopilotEvent,
  COPILOT_EVENTS,
};
