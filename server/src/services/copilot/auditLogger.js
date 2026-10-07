/**
 * @file auditLogger.js
 * Dedicated, PII-scrubbed Audit Logger for Guardian MFS AI Copilot.
 * Ensures all intent evaluations, planning steps, security blocks,
 * and deterministic tool executions are recorded without exposing secrets.
 */

import { AuditLog } from '../../models/index.js';
import logger from '../../utils/logger.js';

/**
 * Redacts sensitive fields (PINs, OTPs, passwords, auth tokens, full card/NID numbers) from any object.
 * @param {any} data
 * @returns {any}
 */
export function maskSensitiveData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const sensitiveKeys = [
    'pin',
    'otp',
    'password',
    'token',
    'secret',
    'authorization',
    'stepuptoken',
    'actionhash',
    'nid',
    'birthcertificate',
  ];

  const scrubbed = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'actionid' || lowerKey === 'txnid' || lowerKey === 'userid' || lowerKey === 'executedtxnid') {
      scrubbed[key] = value;
    } else if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      scrubbed[key] = maskSensitiveData(value);
    } else {
      scrubbed[key] = value;
    }
  }
  return scrubbed;
}

/**
 * Records an entry into the AuditLog collection.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.action
 * @param {'success'|'failure'|'blocked'|'pending_approval'} params.status
 * @param {Object} [params.details]
 * @param {'agent_ai'|'user'|'guardian'|'system'} [params.actorType='agent_ai']
 */
export async function recordCopilotAudit({
  userId,
  action,
  status = 'success',
  details = {},
  actorType = 'agent_ai',
}) {
  try {
    const scrubbedDetails = maskSensitiveData(details);
    await AuditLog.create({
      userId,
      action: action.startsWith('copilot.') ? action : `copilot.${action}`,
      actorType,
      status,
      details: scrubbedDetails,
    });
  } catch (err) {
    logger.warn({ err: err.message, action }, 'Failed to persist Copilot AuditLog entry');
  }
}

/**
 * Specific audit logging helper for security blocks.
 */
export async function logSecurityBlocked({ userId, reason, sanitizedText }) {
  return recordCopilotAudit({
    userId,
    action: 'copilot.security_blocked',
    status: 'blocked',
    details: {
      reason,
      sanitizedText: maskSensitiveData(sanitizedText),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Specific audit logging helper for planned tools.
 */
export async function logToolPlanned({ userId, tool, parameters, riskLevel }) {
  return recordCopilotAudit({
    userId,
    action: `copilot.plan.${tool}`,
    status: 'success',
    details: {
      tool,
      riskLevel,
      parameters: maskSensitiveData(parameters),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Specific audit logging helper for confirmation creation.
 */
export async function logConfirmationRequested({ userId, tool, actionId, riskLevel }) {
  return recordCopilotAudit({
    userId,
    action: `copilot.confirm_requested.${tool}`,
    status: 'pending_approval',
    details: {
      tool,
      actionId,
      riskLevel,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Specific audit logging helper for completed executions.
 */
export async function logExecutionCompleted({ userId, tool, actionId, status, executedTxnId, preview, error }) {
  return recordCopilotAudit({
    userId,
    action: `copilot.${tool}`,
    status: status === 'success' ? 'success' : 'failure',
    details: {
      actionId,
      executedTxnId,
      preview: preview || {},
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    },
  });
}

export default {
  maskSensitiveData,
  recordCopilotAudit,
  logSecurityBlocked,
  logToolPlanned,
  logConfirmationRequested,
  logExecutionCompleted,
};
