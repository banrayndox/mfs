/**
 * @file taskStateManager.js
 * Multi-turn Task State & Conversation Context Manager for Guardian MFS AI Copilot.
 * Implements persistent ActionState, declarative intent schemas, parameter accumulation,
 * natural user corrections ("না, ৭০০ পাঠাও"), confirmations, and cancellations.
 */

import crypto from 'crypto';
import { extractAmountInPoisha } from './inputNormalizer.js';
import { CopilotActionState } from '../../models/CopilotActionState.js';
import logger from '../../utils/logger.js';

// In-memory session task state store with TTL for fast access
const userStates = new Map();
const STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Declarative Intent Schemas for all supported MFS Financial Workflows.
 */
export const MFS_INTENT_SCHEMAS = {
  send_money: {
    tool: 'send_money',
    required: ['recipient', 'amount'],
    optional: ['note'],
    modal: 'send',
  },
  mobile_recharge: {
    tool: 'mobile_recharge',
    required: ['recipient', 'amount'],
    optional: ['operator', 'simType'],
    modal: 'recharge',
  },
  cash_out: {
    tool: 'cash_out',
    required: ['amount'],
    optional: ['agentPhone', 'agentIdentifier'],
    modal: 'cashout',
  },
  pay_bill: {
    tool: 'pay_bill',
    required: ['billerId', 'amount'],
    optional: ['accountNo'],
    modal: 'paybill',
  },
  add_money: {
    tool: 'add_money',
    required: ['amount'],
    optional: ['source'],
    modal: 'addmoney',
  },
  savings: {
    tool: 'create_savings_goal',
    required: ['target_amount'],
    optional: ['name', 'target_months', 'frequency', 'percentage'],
    modal: 'savings',
  },
  request_money: {
    tool: 'request_money',
    required: ['recipient', 'amount'],
    optional: ['note'],
    modal: 'request',
  },
  guardian_mode: {
    tool: 'add_child_account',
    required: ['phoneNumber'],
    optional: ['relationship', 'dailyLimit', 'child_name'],
    modal: 'guardian',
  },
  reminder: {
    tool: 'create_reminder',
    required: ['title', 'dueAt'],
    optional: ['amount', 'recipient'],
    modal: 'schedule',
  },
  schedule: {
    tool: 'create_schedule',
    required: ['actionType', 'frequency', 'amount'],
    optional: ['recipient', 'billerId', 'nextRunAt'],
    modal: 'schedule',
  },
  rules: {
    tool: 'create_rule',
    required: ['trigger', 'action'],
    optional: ['condition'],
    modal: 'schedule',
  },
  group_bill: {
    tool: 'create_group_bill',
    required: ['participants', 'total_amount'],
    optional: ['split_method', 'description'],
    modal: 'request',
  },
};

/**
 * Creates a standard ActionState object conforming to production architecture.
 * @param {Object} [fields]
 * @returns {Object}
 */
export function createActionState(fields = {}) {
  const schema = fields.intent ? MFS_INTENT_SCHEMAS[fields.intent] : null;
  const req = fields.requiredParameters || (schema ? [...schema.required] : []);
  const params = fields.parameters || fields.accumulatedParams || {};

  const missing = fields.missingParameters || req.filter((f) => {
    return params[f] === undefined || params[f] === null || params[f] === '';
  });

  return {
    actionId: fields.actionId || `act-${crypto.randomUUID()}`,
    intent: fields.intent || fields.activeIntent || null,
    status: fields.status || (missing.length === 0 && fields.intent ? 'ready' : (fields.intent ? 'collecting' : 'idle')),
    activeTool: fields.activeTool || (schema ? schema.tool : null),
    parameters: params,
    accumulatedParams: params,
    requiredParameters: req,
    missingParameters: missing,
    missingFields: missing,
    confidence: fields.confidence ?? 1.0,
    source: fields.source || 'conversation',
    preparedPendingAction: fields.preparedPendingAction || null,
    clientAction: fields.clientAction || null,
    history: fields.history || [],
    createdAt: fields.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Gets or initializes the task state for a user.
 * @param {string} userId
 * @returns {Object}
 */
export function getTaskState(userId) {
  const uid = String(userId);
  const now = Date.now();

  let state = userStates.get(uid);
  if (!state || now - (state.lastUpdatedAt || 0) > STATE_TTL_MS) {
    state = createActionState();
    userStates.set(uid, state);

    // Asynchronously check DB for any persisted active action
    CopilotActionState.findOne({ userId, status: { $in: ['collecting', 'ready', 'awaiting_confirmation'] } })
      .then((doc) => {
        if (doc) {
          const loaded = createActionState({
            actionId: doc.actionId,
            intent: doc.intent,
            status: doc.status,
            activeTool: doc.activeTool,
            parameters: doc.parameters,
            requiredParameters: doc.requiredParameters,
            missingParameters: doc.missingParameters,
            confidence: doc.confidence,
            source: doc.source,
            preparedPendingAction: doc.preparedPendingAction,
            history: doc.history,
            clientAction: doc.clientAction,
            createdAt: doc.createdAt?.toISOString(),
          });
          userStates.set(uid, loaded);
        }
      })
      .catch((err) => logger.warn({ err: err.message }, 'Failed to load CopilotActionState from DB'));
  }

  return state;
}

/**
 * Updates the task state for a user and synchronizes to MongoDB.
 * @param {string} userId
 * @param {Object} updates
 * @returns {Object}
 */
export function updateTaskState(userId, updates) {
  const state = getTaskState(userId);
  Object.assign(state, updates, {
    lastUpdatedAt: Date.now(),
    updatedAt: new Date().toISOString(),
  });

  // Re-synchronize aliases between parameters and accumulatedParams
  if (updates.parameters) {
    state.accumulatedParams = state.parameters;
  } else if (updates.accumulatedParams) {
    state.parameters = state.accumulatedParams;
  }

  // Re-calculate missing parameters
  if (state.intent && MFS_INTENT_SCHEMAS[state.intent]) {
    const req = state.requiredParameters?.length ? state.requiredParameters : MFS_INTENT_SCHEMAS[state.intent].required;
    state.requiredParameters = req;
    state.missingParameters = req.filter((f) => {
      const v = state.parameters[f];
      return v === undefined || v === null || v === '';
    });
    state.missingFields = state.missingParameters;

    if (state.missingParameters.length === 0 && state.status === 'collecting') {
      state.status = 'ready';
    }
  }

  userStates.set(String(userId), state);

  // Persist to MongoDB asynchronously
  CopilotActionState.findOneAndUpdate(
    { userId },
    {
      actionId: state.actionId,
      intent: state.intent,
      status: state.status,
      activeTool: state.activeTool,
      parameters: state.parameters,
      requiredParameters: state.requiredParameters,
      missingParameters: state.missingParameters,
      confidence: state.confidence,
      source: state.source,
      preparedPendingAction: state.preparedPendingAction,
      history: state.history,
      clientAction: state.clientAction,
    },
    { upsert: true, new: true }
  ).catch((err) => logger.warn({ err: err.message }, 'Failed to persist CopilotActionState'));

  return state;
}

/**
 * Resets the active task state (after execution or cancellation).
 * @param {string} userId
 * @param {string} [targetStatus='idle']
 */
export function clearActiveTask(userId, targetStatus = 'idle') {
  const state = getTaskState(userId);
  state.intent = null;
  state.activeIntent = null;
  state.activeTool = null;
  state.status = targetStatus;
  state.parameters = {};
  state.accumulatedParams = {};
  state.missingParameters = [];
  state.missingFields = [];
  state.preparedPendingAction = null;
  state.clientAction = null;
  state.lastUpdatedAt = Date.now();
  state.updatedAt = new Date().toISOString();

  userStates.set(String(userId), state);

  CopilotActionState.findOneAndUpdate(
    { userId },
    {
      intent: null,
      status: targetStatus,
      activeTool: null,
      parameters: {},
      missingParameters: [],
      preparedPendingAction: null,
      clientAction: null,
    }
  ).catch((err) => logger.warn({ err: err.message }, 'Failed to clear CopilotActionState in DB'));
}

/**
 * Detects if user input is an explicit confirmation.
 * @param {string} text
 * @returns {boolean}
 */
export function isConfirmation(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    t === 'yes' ||
    t === 'y' ||
    t === 'হ্যাঁ' ||
    t === 'হ্যা' ||
    t === 'confirm' ||
    t === 'করো' ||
    t === 'করে দাও' ||
    t === 'পাঠাও' ||
    t === 'পাঠিয়ে দাও' ||
    t === 'ঠিক আছে' ||
    t === 'ok' ||
    t === 'okay' ||
    t === 'proceed' ||
    t === 'create koro' ||
    t === 'বানাও' ||
    t === 'send koro' ||
    t === 'continue' ||
    t === 'do it' ||
    t === 'করুন'
  );
}

/**
 * Detects if user input is an explicit cancellation.
 * @param {string} text
 * @returns {boolean}
 */
export function isCancellation(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
  const exacts = [
    'no',
    'না',
    'cancel',
    'বাতিল',
    'বাতিল করো',
    'দরকার নেই',
    'stop',
    'abort',
    'lagbe na',
    'না পাঠিও না',
    "don't",
    'dont',
    'না বাতিল করো',
    'বাতিল করুন',
    'না বাতিল করুন',
    'start over',
    'never mind',
    'বাদ দাও',
    'থামো',
  ];
  if (exacts.includes(t)) return true;

  if (
    (t.includes('বাতিল') || t.includes('cancel') || t.includes('দরকার নেই') || t.includes('abort') || t.includes('stop') || t.includes('never mind')) &&
    !t.includes('পাঠাও') &&
    !t.includes('send') &&
    !t.includes('pay') &&
    !t.includes('recharge')
  ) {
    return true;
  }

  return false;
}

/**
 * Detects if user is making a natural correction to the active task.
 * @param {string} text
 * @param {Object} state
 * @returns {{ isCorrection: boolean, updatedParams?: Record<string, any> }}
 */
export function detectUserCorrection(text, state) {
  const currentParams = state.parameters || state.accumulatedParams || {};
  if (!state.intent && !state.activeIntent) {
    return { isCorrection: false };
  }
  if (Object.keys(currentParams).length === 0) {
    return { isCorrection: false };
  }

  const lower = text.toLowerCase().trim();
  const startsWithNegation =
    lower.startsWith('না,') ||
    lower.startsWith('না ') ||
    lower.startsWith('no,') ||
    lower.startsWith('no ') ||
    lower.includes('make it') ||
    lower.includes('change to') ||
    lower.includes('actually');

  // Case 1: Correcting amount (e.g. "Actually make it 800", "না, ৭০০ পাঠাও", "make it 1000")
  const correctedAmount = extractAmountInPoisha(text);
  if (correctedAmount && (startsWithNegation || /^\d+$/.test(lower) || /^[০-৯]+$/.test(lower))) {
    return {
      isCorrection: true,
      updatedParams: { amount: correctedAmount / 100, amountPoisha: correctedAmount },
    };
  }

  // Case 2: Correcting phone number / recipient (e.g. "Actually send it to 018XXXXXXXX", "না, কানজিলকে পাঠাও")
  const phoneMatch = text.match(/(?:01[3-9]\d{8})/);
  if (phoneMatch && startsWithNegation) {
    return {
      isCorrection: true,
      updatedParams: { recipient: phoneMatch[0], phoneNumber: phoneMatch[0] },
    };
  }

  if (startsWithNegation && (lower.includes('কে') || lower.includes('to '))) {
    const recipientMatch =
      text.match(/(?:না,?\s*)?([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?ke|-?কে|-?re|-?রে|-?te|-?তে|-?er|-?এর)/i) ||
      text.match(/(?:send to|to)\s+([a-zA-Z\u0980-\u09FF\s]+)/i);

    if (recipientMatch && recipientMatch[1]) {
      const newRecipient = recipientMatch[1].replace(/^(না|no|actually)\s*/i, '').trim();
      return {
        isCorrection: true,
        updatedParams: { recipient: newRecipient, recipientName: newRecipient },
      };
    }
  }

  return { isCorrection: false };
}

/**
 * Merges follow-up message into active workflow missing parameters.
 * Understands follow-ups like "01712345678", "500", "Grameenphone", "tomorrow", etc.
 * @param {string} text
 * @param {Object} state
 * @returns {Record<string, any>} Newly extracted follow-up parameters
 */
export function extractFollowUpParameters(text, state) {
  const missing = state.missingParameters || state.missingFields || [];
  if (missing.length === 0) return {};

  const extracted = {};
  const lower = text.toLowerCase().trim();
  const phoneMatch = text.match(/(?:01[3-9]\d{8})/);
  const amountPoisha = extractAmountInPoisha(text);
  const amountBdt = amountPoisha ? amountPoisha / 100 : null;

  // 1. Phone / Recipient extraction
  if (phoneMatch && (missing.includes('recipient') || missing.includes('phoneNumber') || missing.includes('agentPhone') || missing.includes('childPhone'))) {
    const ph = phoneMatch[0];
    if (missing.includes('recipient')) extracted.recipient = ph;
    if (missing.includes('phoneNumber')) extracted.phoneNumber = ph;
    if (missing.includes('agentPhone')) extracted.agentPhone = ph;
    if (missing.includes('childPhone')) extracted.childPhone = ph;

    // Auto-infer operator for mobile recharge from prefix
    if (ph.startsWith('017') || ph.startsWith('013')) extracted.operator = 'Grameenphone';
    else if (ph.startsWith('019') || ph.startsWith('014')) extracted.operator = 'Banglalink';
    else if (ph.startsWith('018')) extracted.operator = 'Robi';
    else if (ph.startsWith('016')) extracted.operator = 'Airtel';
    else if (ph.startsWith('015')) extracted.operator = 'Teletalk';
  }

  // 2. Amount extraction
  if (amountBdt && (missing.includes('amount') || missing.includes('total_amount') || missing.includes('target_amount'))) {
    if (missing.includes('amount')) {
      extracted.amount = amountBdt;
      extracted.amountPoisha = amountPoisha;
    }
    if (missing.includes('total_amount')) {
      extracted.total_amount = amountBdt;
      extracted.totalAmountPoisha = amountPoisha;
    }
    if (missing.includes('target_amount')) {
      extracted.target_amount = amountBdt;
      extracted.targetAmountPoisha = amountPoisha;
    }
  }

  // 2b. Daily Limit extraction for Guardian Mode
  const limitMatch = text.match(/(?:l+i+m+i+t|লিমিট|সীমা|দৈনিক সীমা|daily\s*limit)\s*[:=]?\s*(\d+)/i) ||
                     text.match(/(\d+)\s*(?:tk|taka|টাকা)?\s*(?:l+i+m+i+t|সীমা|লিমিট)/i) ||
                     text.match(/(?:l+i+m+i+t|লিমিট|সীমা)\s*(\d+)\s*(?:tk|taka|টাকা)?/i);
  if (limitMatch) {
    extracted.dailyLimit = parseInt(limitMatch[1], 10);
  }

  // 3. Operator extraction for Mobile Recharge
  if (missing.includes('operator')) {
    if (lower.includes('grameen') || lower.includes('gp') || lower.includes('গ্রামীন')) extracted.operator = 'Grameenphone';
    else if (lower.includes('banglalink') || lower.includes('bl') || lower.includes('বাংলালিংক')) extracted.operator = 'Banglalink';
    else if (lower.includes('robi') || lower.includes('রবি')) extracted.operator = 'Robi';
    else if (lower.includes('airtel') || lower.includes('এয়ারটেল')) extracted.operator = 'Airtel';
    else if (lower.includes('teletalk') || lower.includes('টেলিটক')) extracted.operator = 'Teletalk';
  }

  // 4. Biller extraction for Bill Payment
  if (missing.includes('billerId')) {
    if (lower.includes('dpdc') || lower.includes('ডিপিডিসি')) extracted.billerId = 'DPDC';
    else if (lower.includes('desco') || lower.includes('ডেসকো')) extracted.billerId = 'DESCO';
    else if (lower.includes('wasa') || lower.includes('ওয়াসা')) extracted.billerId = 'Dhaka WASA';
    else if (lower.includes('titas') || lower.includes('তিতাস')) extracted.billerId = 'Titas Gas';
  }

  // 5. Account / Customer Number for Bill Payment
  if (missing.includes('accountNo') && /^\d{6,14}$/.test(lower) && !phoneMatch) {
    extracted.accountNo = lower;
  }

  // 6. Relationship extraction for Guardian Mode
  if (missing.includes('relationship')) {
    if (lower.includes('father') || lower.includes('বাবা') || lower.includes('আব্বু')) extracted.relationship = 'father';
    else if (lower.includes('mother') || lower.includes('মা') || lower.includes('আম্মু')) extracted.relationship = 'mother';
    else if (lower.includes('brother') || lower.includes('ভাই')) extracted.relationship = 'brother';
    else if (lower.includes('sister') || lower.includes('বোন')) extracted.relationship = 'sister';
    else if (lower.includes('guardian') || lower.includes('অভিভাবক')) extracted.relationship = 'guardian';
  }

  // 7. Group Bill Participants extraction
  if (missing.includes('participants')) {
    const cleaned = text.replace(/and|এবং|o|আর|me|আমি/gi, ',').split(',');
    const parts = cleaned.map((p) => p.trim()).filter((p) => p.length > 1);
    if (parts.length > 0) {
      extracted.participants = parts;
    }
  }

  return extracted;
}

export default {
  MFS_INTENT_SCHEMAS,
  createActionState,
  getTaskState,
  updateTaskState,
  clearActiveTask,
  isConfirmation,
  isCancellation,
  detectUserCorrection,
  extractFollowUpParameters,
};
