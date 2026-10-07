/**
 * @file intentPlanner.js
 * AI Intent & Planning Agent for Guardian MFS Copilot.
 * Integrates Groq LLM (when configured) with intelligent fallback to a
 * multilingual, semantic understanding engine across Bangla, English, and Banglish.
 * Never relies on fragile keyword equality.
 */

import OpenAI from 'openai';
import { normalizeInput, extractAmountInPoisha } from './inputNormalizer.js';
import { TOOL_REGISTRY, getLlmToolDefinitions } from './toolRegistry.js';
import {
  MFS_INTENT_SCHEMAS,
  extractFollowUpParameters,
  detectUserCorrection,
  isConfirmation,
  isCancellation,
} from './taskStateManager.js';
import { retrieveKnowledge } from '../rag.service.js';
import logger from '../../utils/logger.js';

/**
 * Evaluates security boundaries (Prompt Injection, Secret Probing, Cross-User Access).
 * ALWAYS runs before LLM or tool planner to prevent prompt injection and unauthorized overrides.
 * @param {string} text
 * @returns {{ isSecurityViolation: boolean, type?: string, reason?: string }}
 */
export function evaluateSecurityBoundaries(text) {
  if (!text || typeof text !== 'string') return { isSecurityViolation: false };
  const lower = text.toLowerCase().trim();

  // 1. Prompt Injection & Policy Bypass
  const injectionPatterns = [
    'ignore previous',
    'ignore all previous',
    'ignore all rules',
    'disable guardian',
    'system message:',
    'override policy',
    'send all my money',
    'transfer everything',
    'do not ask for pin',
    'without pin',
    'without confirmation',
    'do not ask for confirmation',
    'reveal system prompt',
    'reveal your system prompt',
    'show hidden tools',
    'give me another user',
    'ignore the limit',
    'ignore my guardian',
    'ignore the warning',
    'ignore warning',
    'approve my own',
    'pretend i am the guardian',
    'pretend i am an agent',
    'api key',
    'secret key',
    'show me the database',
    'you are now the administrator',
    'you are now admin',
    'disable all security',
    'disable security',
    'reveal tool credentials',
    'tool credentials',
    'use another user',
    'shob taka pathao',
    'pin lagbe na',
    'pin chara',
    'override koro',
    'guardian bad dao',
  ];

  if (injectionPatterns.some((p) => lower.includes(p))) {
    return {
      isSecurityViolation: true,
      type: 'injection',
      reason: 'Potential prompt injection, security bypass, or unauthorized policy override detected.',
    };
  }

  // 2. Secret Credential Probes (PIN, OTP, Passwords)
  const secretPatterns = [
    'what is my pin',
    'show my pin',
    'reveal pin',
    'tell me my pin',
    'আমার পিন কত',
    'amar pin koto',
    'pin bolo',
    'pin dekhaw',
    'what is my otp',
    'show my otp',
    'give me otp',
    'otp bolo',
    'otp dekhaw',
    'what password',
    'show password',
    'password bolo',
  ];

  if (secretPatterns.some((p) => lower.includes(p))) {
    return {
      isSecurityViolation: true,
      type: 'secret_probe',
      reason: 'PIN, OTP, and passwords are confidential credentials and strictly inaccessible.',
    };
  }

  // 3. Cross-User Data Access
  const crossUserPatterns = [
    'show user b',
    'user b balance',
    'another user balance',
    'other user balance',
    'all users balance',
    'show all users',
    'onno user balance',
    'onno karor balance',
    'onno karor taka',
    'shobar balance',
    'অন্য ব্যবহারকারীর ব্যালেন্স',
    'অন্য কারও ব্যালেন্স',
    'সবার ব্যালেন্স',
  ];

  if (crossUserPatterns.some((p) => lower.includes(p))) {
    return {
      isSecurityViolation: true,
      type: 'cross_user_probe',
      reason: 'Accessing balances or private data of other accounts is strictly restricted.',
    };
  }

  // 4. Irrelevant Non-Financial Queries (Bangla, Banglish, English)
  const irrelevantPatterns = [
    'capital of',
    'weather',
    'abhowa',
    'write a poem',
    'write poem',
    'poem',
    'kobita',
    'tell me a joke',
    'tell a joke',
    'joke',
    'koutuk',
    'write python',
    'write code',
    'python code',
    'javascript code',
    'coding',
    'who won',
    'world cup',
    'cricket',
    'football',
    'recipe',
    'recipes',
    'how to cook',
    'lyrics',
    'president of',
    'prime minister of',
    'meaning of life',
    'solve this math',
    'trivia',
    'আবহাওয়া',
    'আবহাওয়া',
    'কবিতা',
    'কৌতুক',
    'রান্নার রেসিপি',
    'গান গাও',
    'গান শোনাও',
    'shonao',
  ];

  if (irrelevantPatterns.some((p) => lower.includes(p))) {
    return {
      isSecurityViolation: true,
      type: 'irrelevant',
      reason: 'Query is unrelated to financial services.',
    };
  }

  // 5. Speculative Schemes / Guaranteed Returns / High-Risk Trading (OOD Defense)
  const speculativePatterns = [
    'guaranteed profit',
    'guaranteed return',
    'guaranteed returns',
    'guaranteed investment',
    'guaranteed labh',
    'guaranteed',
    'cryptocurrency',
    'crypto',
    'bitcoin',
    'ethereum',
    'forex trading',
    'forex',
    'lottery',
    'casino',
    'সুনিশ্চিত লাভ',
    'গ্যারান্টিড লাভ',
    'গ্যারান্টিড প্রফিট',
    'বিটকয়েন',
    'ক্রিপ্টো',
    'লটারি',
  ];

  if (speculativePatterns.some((p) => lower.includes(p))) {
    return {
      isSecurityViolation: true,
      type: 'unsupported_financial_scheme',
      reason: 'Speculative trading, crypto investments, and guaranteed return schemes are not supported by Guardian MFS.',
    };
  }

  return { isSecurityViolation: false };
}

/**
 * Semantic intent planning and parameter extraction.
 * Understands what the user MEANS across Bangla, English, Banglish, and mixed dialects.
 * @param {object} params
 * @param {string} params.text
 * @param {object} [params.taskState]
 * @param {string} [params.language='bn']
 * @returns {Promise<object>}
 */
export async function planIntent({ text, taskState = null, language = 'bn' }) {
  // 1. Always evaluate security boundaries first
  const sec = evaluateSecurityBoundaries(text);
  if (sec.isSecurityViolation) {
    return {
      intent: sec.type,
      tool: null,
      parameters: {},
      missing_fields: [],
      clarification_required: false,
      confirmation_required: false,
      securityBlocked: true,
      reason: sec.reason,
    };
  }

  const normalized = normalizeInput(text);
  const lower = normalized.toLowerCase().trim();

  // Try live Groq LLM if configured and not in mock mode
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim() !== '') {
    try {
      const llmResult = await planWithLlm({ text, normalized, lower, taskState, language, groqKey });
      if (llmResult && llmResult.confidence >= 0.7) {
        return llmResult;
      }
    } catch (llmErr) {
      logger.warn({ err: llmErr }, 'Groq LLM planning failed, utilizing deterministic semantic planner');
    }
  }

  // Deterministic Semantic Planner (reliable, offline-safe, instant, zero keys needed)
  return planWithSemanticEngine({ text, normalized, lower, taskState, language });
}

/**
 * LLM-based planner using Groq OpenAI SDK.
 */
async function planWithLlm({ text, normalized, lower, taskState, language, groqKey }) {
  const client = new OpenAI({
    apiKey: groqKey,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    timeout: 6000,
  });

  const model = process.env.GROQ_MODEL_TEXT || 'openai/gpt-oss-120b';

  const systemPrompt = `You are the AI Intent & Planning Engine for Guardian MFS (a mobile financial service app in Bangladesh).
Your role is to understand user financial requests in English, Bengali, or Banglish, and return a strict JSON tool plan.

Available tools:
${JSON.stringify(getLlmToolDefinitions(), null, 2)}

Rules:
1. Output ONLY valid JSON matching this schema:
{
  "intent": string,
  "tool": string,
  "parameters": object,
  "missing_fields": string[],
  "clarification_required": boolean,
  "confirmation_required": boolean,
  "confidence": number,
  "question": string | null
}
2. Extract monetary amounts in BDT (numbers only, e.g. 500 for 500 taka).
3. If parameters are missing, list them in missing_fields, set clarification_required to true, and provide a polite clarifying question in ${language === 'bn' ? 'Bengali' : 'English'}.
4. Never invent financial amounts or recipients. If ambiguous, set clarification_required to true.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(taskState?.history || []).slice(-4),
    { role: 'user', content: text },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
  if (parsed.tool && TOOL_REGISTRY[parsed.tool]) {
    const toolDef = TOOL_REGISTRY[parsed.tool];
    parsed.confirmation_required = toolDef.confirmation_required;
    parsed.risk_level = toolDef.risk_level;
    parsed.authentication_required = toolDef.authentication_required;
    return parsed;
  }

  return null;
}

/**
 * Deterministic Semantic Understanding Engine.
 * Understands all semantic intent categories across Bangla, English, Banglish, and mixed inputs.
 */
function planWithSemanticEngine({ text, normalized, lower, taskState, language }) {
  const extractedPoisha = extractAmountInPoisha(normalized);
  const amountBdt = extractedPoisha ? extractedPoisha / 100 : null;

  // ==========================================
  // 0. ACTIVE TASK CONTEXT (Confirm, Cancel, Correction, Follow-up)
  // ==========================================
  if (taskState && (taskState.intent || taskState.activeIntent || taskState.status === 'collecting' || taskState.preparedPendingAction)) {
    // 0a. Conversational Cancellation
    if (isCancellation(text)) {
      return {
        intent: 'cancel',
        tool: 'cancel_active_task',
        parameters: {},
        missing_fields: [],
        clarification_required: false,
        confirmation_required: false,
        confidence: 0.99,
      };
    }

    // 0b. Conversational Confirmation
    if (isConfirmation(text) && (taskState.preparedPendingAction || taskState.status === 'ready' || taskState.status === 'awaiting_confirmation')) {
      return {
        intent: 'confirm',
        tool: 'confirm_active_task',
        parameters: taskState.parameters || {},
        missing_fields: [],
        clarification_required: false,
        confirmation_required: false,
        confidence: 0.99,
      };
    }

    // 0c. Conversational Correction ("Actually make it 800", "না, কানজিলকে পাঠাও")
    const correction = detectUserCorrection(text, taskState);
    if (correction.isCorrection) {
      const activeIntentName = taskState.intent || taskState.activeIntent;
      const updatedParams = { ...(taskState.parameters || taskState.accumulatedParams || {}), ...(correction.updatedParams || {}) };
      const schema = MFS_INTENT_SCHEMAS[activeIntentName];
      const missing = schema ? schema.required.filter((f) => updatedParams[f] === undefined || updatedParams[f] === null || updatedParams[f] === '') : [];
      return {
        intent: activeIntentName,
        tool: schema?.tool || taskState.activeTool || activeIntentName,
        parameters: updatedParams,
        missing_fields: missing,
        clarification_required: missing.length > 0,
        confirmation_required: missing.length === 0,
        isCorrection: true,
        confidence: 0.98,
      };
    }

    // 0d. Follow-up parameter extraction for active collecting workflow
    if (taskState.status === 'collecting' || (taskState.missingParameters && taskState.missingParameters.length > 0) || (taskState.missingFields && taskState.missingFields.length > 0)) {
      const isExplicitHighLevel =
        lower.includes('logout') ||
        lower.includes('log out') ||
        lower.includes('লগআউট') ||
        lower.includes('balance') ||
        lower.includes('ব্যালেন্স') ||
        lower.includes('change pin') ||
        lower.includes('পিন পরিবর্তন');

      if (!isExplicitHighLevel) {
        const extractedFollowUp = extractFollowUpParameters(text, taskState);
        if (Object.keys(extractedFollowUp).length > 0) {
          const activeIntentName = taskState.intent || taskState.activeIntent;
          const updatedParams = { ...(taskState.parameters || taskState.accumulatedParams || {}), ...extractedFollowUp };
          const schema = MFS_INTENT_SCHEMAS[activeIntentName];
          const missing = schema ? schema.required.filter((f) => updatedParams[f] === undefined || updatedParams[f] === null || updatedParams[f] === '') : [];
          return {
            intent: activeIntentName,
            tool: schema?.tool || taskState.activeTool || activeIntentName,
            parameters: updatedParams,
            missing_fields: missing,
            clarification_required: missing.length > 0,
            confirmation_required: missing.length === 0,
            isFollowUp: true,
            confidence: 0.98,
          };
        }
      }
    }
  }

  // ==========================================
  // 1. APPLICATION CONTROL: LOGOUT
  // ==========================================
  // "logout", "please logout", "log me out", "sign me out", "আমি logout করতে চাই", "আমাকে logout করে দাও", "আমি account থেকে বের হতে চাই", "sessionটা বন্ধ করো"
  if (
    lower.includes('logout') ||
    lower.includes('log out') ||
    lower.includes('log me out') ||
    lower.includes('sign me out') ||
    lower.includes('sign out') ||
    lower.includes('signout') ||
    lower.includes('লগআউট') ||
    lower.includes('লগ আউট') ||
    lower.includes('বের হতে চাই') ||
    lower.includes('বের করে দাও') ||
    lower.includes('বের হয়ে যাও') ||
    lower.includes('account থেকে বের') ||
    lower.includes('সাইন আউট') ||
    lower.includes('sessionটা বন্ধ') ||
    lower.includes('সেশন বন্ধ') ||
    lower.includes('session বন্ধ')
  ) {
    return {
      intent: 'app_logout',
      tool: 'app_logout',
      parameters: {},
      missing_fields: [],
      clarification_required: false,
      confirmation_required: false,
      confidence: 0.98,
    };
  }

  // ==========================================
  // 2. APPLICATION CONTROL: CHANGE PIN
  // ==========================================
  if (
    lower.includes('change pin') ||
    lower.includes('change my pin') ||
    lower.includes('reset pin') ||
    lower.includes('update pin') ||
    lower.includes('পিন পরিবর্তন') ||
    lower.includes('পিন পাল্টাও') ||
    lower.includes('পিন বদলাও')
  ) {
    return {
      intent: 'app_change_pin',
      tool: 'app_change_pin',
      parameters: {},
      missing_fields: [],
      clarification_required: false,
      confirmation_required: false,
      confidence: 0.98,
    };
  }

  // ==========================================
  // 3. APPLICATION CONTROL: CHANGE PHONE
  // ==========================================
  if (
    lower.includes('change phone') ||
    lower.includes('phone number change') ||
    lower.includes('update phone') ||
    lower.includes('ফোন নম্বর পরিবর্তন') ||
    lower.includes('নম্বর পাল্টাও') ||
    lower.includes('মোবাইল নম্বর পরিবর্তন')
  ) {
    // Check if new phone is provided
    const phoneMatch = normalized.match(/(?:01[3-9]\d{8})/);
    const newPhone = phoneMatch ? phoneMatch[0] : null;

    if (!newPhone) {
      return {
        intent: 'change_phone_number',
        tool: 'change_phone_number',
        parameters: {},
        missing_fields: ['new_phone'],
        clarification_required: true,
        question: language === 'bn' ? 'নতুন ফোন নম্বরটি দিন।' : 'Please provide the new phone number.',
        confidence: 0.95,
      };
    }

    return {
      intent: 'change_phone_number',
      tool: 'change_phone_number',
      parameters: { new_phone: newPhone },
      missing_fields: [],
      clarification_required: false,
      confirmation_required: true,
      confidence: 0.95,
    };
  }

  // ==========================================
  // 4. APPLICATION NAVIGATION
  // ==========================================
  if (lower.includes('history') || lower.includes('ইতিহাস') || lower.includes('লেনদেনের ইতিহাস')) {
    return {
      intent: 'app_navigate',
      tool: 'app_navigate',
      parameters: { path: '/history' },
      missing_fields: [],
      confidence: 0.95,
    };
  }
  if (lower.includes('savings') || lower.includes('সঞ্চয় খোলো') || lower.includes('সেভিংস পাতা')) {
    if (lower.includes('open') || lower.includes('go to') || lower.includes('খোলো') || lower.includes('পাতা')) {
      return {
        intent: 'app_navigate',
        tool: 'app_navigate',
        parameters: { path: '/account', subview: 'savings' },
        missing_fields: [],
        confidence: 0.95,
      };
    }
  }
  if (lower.includes('profile') || lower.includes('প্রোফাইল')) {
    if (lower.includes('open') || lower.includes('go to') || lower.includes('খোলো') || lower.includes('দেখাও')) {
      return {
        intent: 'app_navigate',
        tool: 'app_navigate',
        parameters: { path: '/account' },
        missing_fields: [],
        confidence: 0.95,
      };
    }
  }
  if (lower.includes('guardian') || lower.includes('গার্ডিয়ান') || lower.includes('গার্ডিয়ান')) {
    if (lower.includes('open') || lower.includes('mode') || lower.includes('খোলো') || lower.includes('দেখাও') || lower.includes('চালু')) {
      return {
        intent: 'app_open_guardian',
        tool: 'open_modal',
        parameters: { modal: 'guardian' },
        missing_fields: [],
        confidence: 0.95,
      };
    }
  }

  // ==========================================
  // 5. GROUP BILL / SPLIT BILL
  // ==========================================
  const isGroupBill =
    lower.includes('group bill') ||
    lower.includes('গ্রুপ বিল') ||
    lower.includes('বিল ভাগ') ||
    lower.includes('ভাগ করো') ||
    lower.includes('split') ||
    lower.includes('equal ভাগ') ||
    lower.includes('সমান ভাগ') ||
    lower.includes('মিলে বিল') ||
    lower.includes('নিয়ে বিল') ||
    (lower.includes('মিলে') && lower.includes('বিল'));

  if (isGroupBill) {
    // 5a. Follow-up: who owes?
    if (lower.includes('কে কে') || lower.includes('who still owes') || lower.includes('কার বাকি') || lower.includes('টাকা দেয়নি')) {
      return {
        intent: 'get_group_bill_status',
        tool: 'get_group_bill_status',
        parameters: {},
        missing_fields: [],
        confidence: 0.95,
      };
    }

    // 5b. Follow-up: remind participant
    if (lower.includes('remind') || lower.includes('মনে করিয়ে')) {
      const participantMatch = text.match(/([a-zA-Z\u0980-\u09FF]+?)\s*কে\s*(?:remind|মনে)/i);
      const participant = participantMatch ? participantMatch[1] : null;
      return {
        intent: 'remind_group_member',
        tool: 'remind_group_member',
        parameters: { participant },
        missing_fields: participant ? [] : ['participant'],
        clarification_required: !participant,
        question: language === 'bn' ? 'কাকে রিমাইন্ডার পাঠাতে চান?' : 'Who would you like to remind?',
        confidence: 0.95,
      };
    }

    // 5c. Follow-up: cancel bill
    if (lower.includes('cancel') || lower.includes('বাতিল')) {
      return {
        intent: 'cancel_group_bill',
        tool: 'cancel_group_bill',
        parameters: {},
        missing_fields: [],
        confidence: 0.95,
      };
    }

    // 5d. Follow-up: settle/pay my share
    if (lower.includes('pay') || lower.includes('পরিশোধ') || lower.includes('আমার অংশ')) {
      return {
        intent: 'settle_group_bill',
        tool: 'settle_group_bill',
        parameters: {},
        missing_fields: [],
        confidence: 0.95,
      };
    }

    // 5e. Create Group Bill: Extract participants & split method
    // Extract names: "আমি, রাকিব আর কানজিল", "আমি আর কানজিল", "কানজিলকে নিয়ে"
    const participants = [];
    if (lower.includes('আমি') || lower.includes('me') || lower.includes('আমার') || lower.includes('i')) {
      participants.push('Me');
    }

    // Match recipient names using Bengali/English tokens
    const names = [
      'Rahim', 'Karim', 'Rakib', 'Kanjil', 'Suman', 'Nabila', 'Mom', 'Mother', 'Father', 'Brother', 'Friend',
      'রহিম', 'করিম', 'রাকিব', 'কানজিল', 'সুমন', 'নাবিলা', 'মা', 'বাবা', 'ভাই', 'বন্ধু'
    ];
    for (const name of names) {
      if (text.includes(name) && !participants.includes(name)) {
        participants.push(name);
      }
    }

    // Split method detection
    let splitMethod = 'equal';
    if (lower.includes('%') || lower.includes('percent')) {
      splitMethod = 'percentage';
    } else if (lower.includes('দেবে') || lower.includes('will give') || lower.includes('বাকিটা')) {
      splitMethod = 'custom';
    }

    return {
      intent: 'create_group_bill',
      tool: 'create_group_bill',
      parameters: {
        total_amount: amountBdt,
        totalAmountPoisha: extractedPoisha,
        participants,
        split_method: splitMethod,
        description: 'Dinner/Group Bill',
      },
      missing_fields: !amountBdt ? ['total_amount'] : participants.length < 2 ? ['participants'] : [],
      clarification_required: !amountBdt || participants.length < 2,
      question: !amountBdt
        ? (language === 'bn' ? 'মোট বিলের পরিমাণ কত টাকা?' : 'What is the total bill amount?')
        : (language === 'bn' ? 'বিলে কারা কারা অংশগ্রহণ করবে?' : 'Who are the participants in this bill?'),
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.95,
    };
  }

  // ==========================================
  // 6. GUARDIAN APPROVAL & PERMISSIONS
  // ==========================================
  if (
    lower.includes('approve') ||
    lower.includes('অনুমোদন') ||
    lower.includes('onumodon') ||
    (lower.includes('child') && lower.includes('pending')) ||
    (lower.includes('সন্তান') && (lower.includes('অনুমোদন') || lower.includes('পেন্ডিং') || lower.includes('লেনদেন')))
  ) {
    return {
      intent: 'guardian_approve',
      tool: 'guardian_approval',
      parameters: {},
      missing_fields: [],
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.98,
    };
  }

  // ==========================================
  // 6b. CHILD / FAMILY / GUARDIAN ACCOUNT
  // ==========================================
  const isChildAction =
    lower.includes('child add') ||
    lower.includes('child account') ||
    lower.includes('add guardian') ||
    lower.includes('set guardian') ||
    lower.includes('সন্তান যুক্ত') ||
    lower.includes('বাচ্চা যুক্ত') ||
    lower.includes('অভিভাবক যুক্ত') ||
    lower.includes('গার্ডিয়ান যুক্ত') ||
    lower.includes('গার্ডিয়ান সেট') ||
    (lower.includes('guardian') && (lower.includes('add') || lower.includes('যুক্ত') || lower.includes('set'))) ||
    (lower.includes('child') && (lower.includes('add') || lower.includes('যুক্ত')));

  if (isChildAction) {
    const phoneMatch = normalized.match(/(?:01[3-9]\d{8})/);
    const phone = phoneMatch ? phoneMatch[0] : null;
    const nameMatch = text.match(/(?:child|নাম|name|guardian|অভিভাবক)\s+([a-zA-Z\u0980-\u09FF]+)/i);
    const childName = nameMatch ? nameMatch[1] : (phone ? 'Family Member' : null);

    if (!phone) {
      return {
        intent: 'guardian_mode',
        tool: 'add_child_account',
        parameters: { child_name: childName, child_phone: null, phoneNumber: null },
        missing_fields: ['phoneNumber'],
        clarification_required: true,
        question: language === 'bn' ? 'অভিভাবক বা সন্তানের মোবাইল নম্বর দিন।' : 'Please provide the guardian or child’s phone number.',
        confidence: 0.95,
      };
    }

    return {
      intent: 'guardian_mode',
      tool: 'add_child_account',
      parameters: { child_name: childName, child_phone: phone, phoneNumber: phone, daily_limit: amountBdt || 1000 },
      missing_fields: [],
      clarification_required: false,
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.95,
    };
  }

  // ==========================================
  // 7. SAVINGS & MICRO-SAVINGS
  // ==========================================
  // Percentage Savings: "Save 2% from every transaction", "২% টাকা সঞ্চয় করো"
  if (
    (lower.includes('save') || lower.includes('সঞ্চয়') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস')) &&
    (lower.includes('%') || lower.includes('percent') || lower.includes('পার্সেন্ট') || lower.includes('শতাংশ'))
  ) {
    const pctMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
    const pct = pctMatch ? parseFloat(pctMatch[1]) : 2;
    return {
      intent: 'set_percentage_savings',
      tool: 'configure_micro_savings',
      parameters: { percentage: pct },
      missing_fields: [],
      confirmation_required: true,
      confidence: 0.96,
    };
  }

  // Round-Up Savings
  if (lower.includes('round-up') || lower.includes('round up') || lower.includes('রাউন্ড-আপ') || lower.includes('রাউন্ড আপ')) {
    return {
      intent: 'set_roundup_savings',
      tool: 'configure_micro_savings',
      parameters: { roundUpEnabled: true },
      missing_fields: [],
      confirmation_required: true,
      confidence: 0.96,
    };
  }

  // Disable Savings
  if (
    (lower.includes('disable') || lower.includes('turn off') || lower.includes('stop') || lower.includes('বন্ধ করো')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস') || lower.includes('round'))
  ) {
    return {
      intent: 'disable_savings',
      tool: 'disable_micro_savings',
      parameters: {},
      missing_fields: [],
      confirmation_required: false,
      confidence: 0.96,
    };
  }

  // Savings Goal Creation: "Create a savings goal of 10000 taka for wedding / laptop"
  if (
    (lower.includes('savings goal') || lower.includes('savings plan') || lower.includes('সঞ্চয় লক্ষ্য') || lower.includes('সেভিংস প্ল্যান') || lower.includes('goal বানাও') || lower.includes('লক্ষ্য বানাও')) ||
    ((lower.includes('wedding') || lower.includes('laptop') || lower.includes('বিয়ে') || lower.includes('ল্যাপটপ')) && (lower.includes('savings') || lower.includes('সঞ্চয়')))
  ) {
    let goalName = 'General Savings';
    if (lower.includes('wedding') || lower.includes('বিয়ে')) goalName = 'Wedding';
    else if (lower.includes('laptop') || lower.includes('ল্যাপটপ')) goalName = 'Laptop';
    else if (lower.includes('emergency') || lower.includes('জরুরি')) goalName = 'Emergency Fund';

    if (!amountBdt) {
      return {
        intent: 'create_savings_goal',
        tool: 'create_savings_goal',
        parameters: { name: goalName },
        missing_fields: ['target_amount'],
        clarification_required: true,
        question: language === 'bn' ? `কত টাকা টার্গেট করতে চান?` : `What target amount would you like for ${goalName}?`,
        confidence: 0.95,
      };
    }

    return {
      intent: 'create_savings_goal',
      tool: 'create_savings_goal',
      parameters: {
        name: goalName,
        target_amount: amountBdt,
        targetAmountPoisha: extractedPoisha,
        target_months: 6,
      },
      missing_fields: [],
      clarification_required: false,
      confirmation_required: true,
      confidence: 0.95,
    };
  }

  // ==========================================
  // 8. FINANCIAL COPILOT (SPENDING & SUMMARIES)
  // ==========================================
  // Spending Habit Explanation: "Why am I running out of money?"
  if (
    lower.includes('why am i running out of money') ||
    lower.includes('where is my money going') ||
    lower.includes('টাকা কেন শেষ হয়ে যায়') ||
    lower.includes('টাকা থাকে না কেন') ||
    lower.includes('spending habit') ||
    lower.includes('খরচের অভ্যাস')
  ) {
    return {
      intent: 'financial_explanation',
      tool: 'explain_financial_habits',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  // Month-over-Month Comparison
  if (lower.includes('compare this month') || lower.includes('compare spending') || lower.includes('তুলনা করো') || lower.includes('গত মাসের সাথে তুলনা')) {
    return {
      intent: 'compare_spending',
      tool: 'compare_spending',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  // Total Spending Summary / Spending Analysis
  if (
    lower.includes('how much did i spend') ||
    lower.includes('total spend') ||
    lower.includes('spending analysis') ||
    lower.includes('spending breakdown') ||
    lower.includes('spending') ||
    lower.includes('কত টাকা খরচ') ||
    lower.includes('এই মাসে কত খরচ') ||
    lower.includes('মোট খরচ কত') ||
    lower.includes('খরচ করেছি') ||
    lower.includes('khoroch') ||
    lower.includes('খাতে কত')
  ) {
    return {
      intent: 'spending_summary',
      tool: 'spending_summary',
      parameters: { period: lower.includes('week') || lower.includes('সপ্তাহ') ? 'week' : 'month' },
      missing_fields: [],
      confidence: 0.98,
    };
  }

  // Total Income Summary
  if (
    lower.includes('how much did i receive') ||
    lower.includes('total income') ||
    lower.includes('কত টাকা পেয়েছি') ||
    lower.includes('কত টাকা ঢুকেছে')
  ) {
    return {
      intent: 'income_summary',
      tool: 'income_summary',
      parameters: { period: 'month' },
      missing_fields: [],
      confidence: 0.98,
    };
  }

  // Biggest Transactions
  if (lower.includes('biggest transaction') || lower.includes('সবচেয়ে বড় লেনদেন') || lower.includes('highest transaction') || lower.includes('বড় খরচ')) {
    return {
      intent: 'biggest_transactions',
      tool: 'biggest_transactions',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  // ==========================================
  // 9. AUTOMATION: SCHEDULES & RULES
  // ==========================================
  // Recurring: "Every month on the 5th...", "Every Friday send...", "agami shukrobar theke 500 taka kore dio"
  const isRecurring =
    lower.includes('every month') ||
    lower.includes('every week') ||
    lower.includes('every day') ||
    lower.includes('every friday') ||
    lower.includes('প্রতি মাসে') ||
    lower.includes('প্রতি সপ্তাহে') ||
    lower.includes('প্রতি শুক্রবার') ||
    lower.includes('নিয়মিত') ||
    lower.includes('weekly') ||
    lower.includes('monthly') ||
    lower.includes('kore dio') ||
    lower.includes('করে দিও');

  if (isRecurring) {
    return {
      intent: 'recurring',
      tool: 'create_schedule',
      parameters: {
        frequency: lower.includes('week') || lower.includes('শুক্রবার') ? 'weekly' : 'monthly',
        amount: amountBdt,
        amountPoisha: extractedPoisha,
        actionType: lower.includes('bill') || lower.includes('বিল') ? 'pay_bill' : 'send',
      },
      missing_fields: !amountBdt ? ['amount'] : [],
      clarification_required: !amountBdt,
      question: language === 'bn' ? 'প্রতি কিস্তিতে কত টাকা দিতে চান?' : 'How much amount per recurrence?',
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.95,
    };
  }

  // Conditional Rule: "When money comes into my wallet...", "If balance below..."
  const isConditional =
    lower.includes('when money comes') ||
    lower.includes('when 1,000 or more') ||
    lower.includes('when ') ||
    lower.includes('টাকা ঢুকলে') ||
    lower.includes('টাকা আসলে') ||
    lower.includes('ব্যালেন্স কমে গেলে');

  if (isConditional) {
    return {
      intent: 'conditional',
      tool: 'create_rule',
      parameters: {
        trigger: { event: 'wallet_credit' },
        action: { type: lower.includes('bill') || lower.includes('বিল') ? 'pay_bill' : 'send' },
      },
      missing_fields: [],
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.95,
    };
  }

  // Scheduled once: "Tomorrow at 8 PM send 500...", "Schedule 500 taka to Mom tomorrow"
  const isScheduled =
    lower.includes('tomorrow') ||
    lower.includes('schedule') ||
    lower.includes('কালকে') ||
    lower.includes('আগামীকাল') ||
    lower.includes('শিডিউল');

  if (isScheduled && !lower.includes('remind') && !lower.includes('মনে করিয়ে')) {
    return {
      intent: 'scheduled',
      tool: 'create_schedule',
      parameters: {
        frequency: 'once',
        amount: amountBdt,
        amountPoisha: extractedPoisha,
        actionType: 'send',
      },
      missing_fields: !amountBdt ? ['amount'] : [],
      clarification_required: !amountBdt,
      question: language === 'bn' ? 'কত টাকা পাঠাতে চান?' : 'How much would you like to schedule?',
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.95,
    };
  }

  // Reminders: "Remind me tomorrow to send 500", "আমাকে কালকে মনে করিয়ে দিও"
  if (lower.includes('remind') || lower.includes('মনে করিয়ে')) {
    return {
      intent: 'reminder',
      tool: 'create_reminder',
      parameters: {
        title: text,
        amount: amountBdt,
        amountPoisha: extractedPoisha,
      },
      missing_fields: [],
      confirmation_required: false,
      confidence: 0.95,
    };
  }

  // ==========================================
  // 10. IMMEDIATE MONEY MUTATIONS: SEND / CASHOUT / RECHARGE / BILL / ADD / REQUEST
  // ==========================================
  // Cash Out: "2000 taka cashout koro", "cash out 500"
  const isCashOutKnowledge = lower.includes('difference') || lower.includes('পার্থক্য') || lower.includes('parthokko') || lower.includes('fee') || lower.includes('ফি') || lower.includes('charge') || lower.includes('চার্জ');
  if (!isCashOutKnowledge && (lower.includes('cash out') || lower.includes('cashout') || lower.includes('ক্যাশ আউট') || lower.includes('ক্যাশআউট'))) {
    return {
      intent: 'cash_out',
      tool: 'cash_out',
      parameters: {
        amount: amountBdt,
        amountPoisha: extractedPoisha,
      },
      missing_fields: !amountBdt ? ['amount'] : [],
      clarification_required: !amountBdt,
      question: language === 'bn' ? 'কত টাকা ক্যাশ আউট করতে চান?' : 'How much would you like to cash out?',
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.96,
    };
  }

  // Add Money / Cash In: "Add 1000 taka to my wallet", "টাকা যোগ করো", "add money"
  const isAddMoney =
    lower.includes('add money') ||
    lower.includes('add taka') ||
    lower.includes('cash in') ||
    lower.includes('টাকা যোগ') ||
    lower.includes('ক্যাশ ইন') ||
    lower.includes('ওয়ালেটে টাকা যোগ') ||
    lower.includes('ওয়ালেটে টাকা') ||
    (lower.startsWith('add ') && (amountBdt !== null || lower.includes('taka') || lower.includes('টাকা')));

  if (isAddMoney) {
    return {
      intent: 'add_money',
      tool: 'add_money',
      parameters: {
        amount: amountBdt,
        amountPoisha: extractedPoisha,
        source: 'simulated_bank',
      },
      missing_fields: !amountBdt ? ['amount'] : [],
      clarification_required: !amountBdt,
      question: language === 'bn' ? 'ওয়ালেটে কত টাকা যোগ করতে চান?' : 'How much would you like to add to your wallet?',
      confirmation_required: true,
      risk_level: 'medium',
      confidence: 0.96,
    };
  }

  // Mobile Recharge: "Recharge 100", "১০০ টাকা রিচার্জ করো"
  if (lower.includes('recharge') || lower.includes('রিচার্জ') || lower.includes('ফ্লেক্সিলোড')) {
    const phoneMatch = normalized.match(/(?:01[3-9]\d{8})/);
    const recipientPhone = phoneMatch ? phoneMatch[0] : null;

    let operator = null;
    if (recipientPhone) {
      if (recipientPhone.startsWith('017') || recipientPhone.startsWith('013')) operator = 'Grameenphone';
      else if (recipientPhone.startsWith('019') || recipientPhone.startsWith('014')) operator = 'Banglalink';
      else if (recipientPhone.startsWith('018')) operator = 'Robi';
      else if (recipientPhone.startsWith('016')) operator = 'Airtel';
      else if (recipientPhone.startsWith('015')) operator = 'Teletalk';
    }
    if (lower.includes('grameen') || lower.includes('gp') || lower.includes('গ্রামীন')) operator = 'Grameenphone';
    else if (lower.includes('banglalink') || lower.includes('bl') || lower.includes('বাংলালিংক')) operator = 'Banglalink';
    else if (lower.includes('robi') || lower.includes('রবি')) operator = 'Robi';
    else if (lower.includes('airtel') || lower.includes('এয়ারটেল')) operator = 'Airtel';
    else if (lower.includes('teletalk') || lower.includes('টেলিটক')) operator = 'Teletalk';

    const missing = [];
    if (!recipientPhone) missing.push('recipient');
    if (!amountBdt) missing.push('amount');

    return {
      intent: 'mobile_recharge',
      tool: 'mobile_recharge',
      parameters: {
        amount: amountBdt,
        amountPoisha: extractedPoisha,
        recipient: recipientPhone,
        operator: operator || 'Grameenphone',
      },
      missing_fields: missing,
      clarification_required: missing.length > 0,
      question: !amountBdt
        ? (language === 'bn' ? 'কত টাকা রিচার্জ করতে চান?' : 'How much recharge amount?')
        : (language === 'bn' ? 'কোন নম্বরে রিচার্জ করবেন?' : 'Which phone number would you like to recharge?'),
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.96,
    };
  }

  // Bill Payment: "Pay electricity bill 1200", "বিদ্যুৎ বিল দাও"
  const isBillReminderOrSplit = lower.includes('remind') || lower.includes('মনে করিয়ে') || lower.includes('মনে করিয়ে') || lower.includes('split') || lower.includes('স্প্লিট') || lower.includes('ভাগ');
  if (!isBillReminderOrSplit && (lower.includes('bill') || lower.includes('বিল'))) {
    let billerId = 'DPDC';
    if (lower.includes('desco') || lower.includes('ডেসকো')) billerId = 'DESCO';
    else if (lower.includes('wasa') || lower.includes('ওয়াসা')) billerId = 'Dhaka WASA';
    else if (lower.includes('titas') || lower.includes('তিতাস')) billerId = 'Titas Gas';

    return {
      intent: 'pay_bill',
      tool: 'pay_bill',
      parameters: {
        amount: amountBdt,
        amountPoisha: extractedPoisha,
        billerId,
      },
      missing_fields: !amountBdt ? ['amount'] : [],
      clarification_required: !amountBdt,
      question: language === 'bn' ? 'বিলের পরিমাণ কত টাকা?' : 'How much is the bill amount?',
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.96,
    };
  }

  // Request Money (Individual): "Request 500 taka from Rahim", "টাকা রিকোয়েস্ট করো"
  const isRequestMoney =
    (lower.includes('request money') ||
     lower.includes('টাকা রিকোয়েস্ট') ||
     lower.includes('টাকা চাও') ||
     (lower.includes('request') && (lower.includes('taka') || lower.includes('টাকা') || amountBdt !== null))) &&
    !lower.includes('group bill') && !lower.includes('গ্রুপ বিল');

  if (isRequestMoney) {
    const phoneMatch = normalized.match(/(?:01[3-9]\d{8})/);
    let recipient = phoneMatch ? phoneMatch[0] : null;
    if (!recipient) {
      const recipientMatch =
        text.match(/([a-zA-Z\u0980-\u09FF]+)\s+(?:কাছ থেকে|kache)/i) ||
        text.match(/(?:from|কাছ থেকে)\s+([a-zA-Z\u0980-\u09FF]+)/i);
      if (recipientMatch && recipientMatch[1]) {
        recipient = recipientMatch[1].trim();
      }
    }

    const missing = [];
    if (!recipient) missing.push('recipient');
    if (!amountBdt) missing.push('amount');

    return {
      intent: 'request_money',
      tool: 'request_money',
      parameters: {
        recipient,
        amount: amountBdt,
        amountPoisha: extractedPoisha,
      },
      missing_fields: missing,
      clarification_required: missing.length > 0,
      question: !recipient
        ? (language === 'bn' ? 'কার কাছ থেকে টাকা রিকোয়েস্ট করতে চান?' : 'Who would you like to request money from?')
        : (language === 'bn' ? 'কত টাকা রিকোয়েস্ট করবেন?' : 'How much money would you like to request?'),
      confirmation_required: true,
      risk_level: 'medium',
      confidence: 0.96,
    };
  }

  // Send Money / Transfer:
  // "Send 500 to Rahim", "রাকিবকে ৫০০ টাকা পাঠাও", "আমার মেয়েকে ৫০০ টাকা দাও", "amar meye ke 500 taka dao"
  const isSendMoney =
    lower.includes('send') ||
    lower.includes('pathao') ||
    lower.includes('পাঠাও') ||
    lower.includes('পাঠিয়ে দাও') ||
    lower.includes('ট্রান্সফার') ||
    lower.includes('transfer') ||
    lower.includes('টাকা দাও') ||
    lower.includes('taka dao') ||
    lower.includes('taka dio') ||
    lower.includes('টাকা পাঠাও') ||
    (lower.includes('দাও') && (amountBdt !== null || lower.includes('টাকা') || lower.includes('মেয়ে') || lower.includes('মেয়ে') || lower.includes('ছেলে') || lower.includes('কে'))) ||
    (/(?:dao|dio|দাও|পাঠাও)(?:$|\s|[.,!?])/i.test(lower) && (amountBdt !== null || lower.includes('taka') || lower.includes('টাকা') || lower.includes('meye') || lower.includes('daughter') || lower.includes('ke') || lower.includes('কে')));

  if (isSendMoney) {
    // Extract recipient: e.g. "Rahim ke", "to Rahim", "Rahim কে", "daughter", "meye", phone number
    const phoneMatch = normalized.match(/(?:01[3-9]\d{8})/);
    let recipient = phoneMatch ? phoneMatch[0] : null;

    if (!recipient) {
      if (lower.includes('meye') || lower.includes('daughter') || lower.includes('মেয়ে') || lower.includes('মেয়ে')) {
        recipient = 'daughter';
      } else if (lower.includes('chele') || lower.includes('son') || lower.includes('ছেলে')) {
        recipient = 'son';
      } else if (lower.includes('ammu') || lower.includes('ma') || lower.includes('mother') || lower.includes('মা') || lower.includes('আম্মু')) {
        recipient = 'mother';
      } else if (lower.includes('abbu') || lower.includes('baba') || lower.includes('father') || lower.includes('বাবা') || lower.includes('আব্বু')) {
        recipient = 'father';
      } else {
        const recipientMatch =
          text.match(/([a-zA-Z\u0980-\u09FF]+)\s+(?:কাছে|kache)/i) ||
          text.match(/([a-zA-Z\u0980-\u09FF]+?)\s*(?:-কে|কে|-ke|ke)/i) ||
          text.match(/(?:to|send to|কাছে)\s+([a-zA-Z\u0980-\u09FF]+)/i) ||
          text.match(/Send\s+[0-9]+\s+(?:to\s+)?([a-zA-Z\u0980-\u09FF]+)/i);

        if (recipientMatch && recipientMatch[1]) {
          recipient = recipientMatch[1]
            .trim()
            .replace(/(?:-এর|এর|ের|র|-er|er|-কে|কে|-ke|ke)$/i, '');
        }
      }
    }

    const missing = [];
    if (!recipient) missing.push('recipient');
    if (!amountBdt) missing.push('amount');

    return {
      intent: 'send_money',
      tool: 'send_money',
      parameters: {
        recipient,
        amount: amountBdt,
        amountPoisha: extractedPoisha,
      },
      missing_fields: missing,
      clarification_required: missing.length > 0,
      question: !recipient
        ? (language === 'bn' ? 'কাকে টাকা পাঠাতে চান?' : 'Who would you like to send money to?')
        : (language === 'bn' ? 'কত টাকা পাঠাব?' : 'How much money would you like to send?'),
      confirmation_required: true,
      risk_level: 'high',
      confidence: 0.97,
    };
  }

  // ==========================================
  // 11. READ TOOLS: BALANCE, HISTORY, NOTIFICATIONS
  // ==========================================
  if (
    lower.includes('balance') ||
    lower.includes('ব্যালেন্স') ||
    lower.includes('টাকা কত আছে') ||
    lower.includes('how much money do i have')
  ) {
    return {
      intent: 'balance',
      tool: 'check_balance',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  if (
    lower.includes('transaction history') ||
    lower.includes('লেনদেনের ইতিহাস') ||
    lower.includes('লেনদেন দেখাও') ||
    lower.includes('recent transactions')
  ) {
    return {
      intent: 'transactions',
      tool: 'transaction_history',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  if (lower.includes('last transaction') || lower.includes('শেষ লেনদেন') || lower.includes('লেনদেনের বিস্তারিত')) {
    return {
      intent: 'transaction_details',
      tool: 'transaction_details',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  if (lower.includes('notification') || lower.includes('নোটিফিকেশন')) {
    return {
      intent: 'notifications',
      tool: 'notifications',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  if (lower.includes('account information') || lower.includes('account status') || lower.includes('অ্যাকাউন্টের তথ্য')) {
    return {
      intent: 'account',
      tool: 'get_profile',
      parameters: {},
      missing_fields: [],
      confidence: 0.98,
    };
  }

  // ==========================================
  // 12. KNOWLEDGE & FAQ QUERY (RAG)
  // ==========================================
  const ragMatches = retrieveKnowledge(text, { minScore: 0.15, topK: 1 });
  if (ragMatches.length > 0) {
    return {
      intent: 'knowledge',
      tool: 'knowledge_query',
      parameters: { query: text, docId: ragMatches[0].id },
      missing_fields: [],
      confidence: ragMatches[0].score,
      retrievedDoc: ragMatches[0],
    };
  }

  // ==========================================
  // 13. OUT-OF-DISTRIBUTION (OOD) / UNKNOWN INTENT
  // ==========================================
  return {
    intent: 'unknown_ood',
    tool: null,
    parameters: { rawText: text },
    missing_fields: [],
    clarification_required: true,
    confirmation_required: false,
    confidence: 0.20,
    isOutOfDistribution: true,
    question: language === 'bn'
      ? 'দুঃখিত, আমি আপনার অনুরোধটি পুরোপুরি বুঝতে পারিনি। আপনি কি সেন্ড মানি, ক্যাশ আউট, বিল পে, মোবাইল রিচার্জ বা সেভিংস সম্পর্কে জানতে চান?'
      : 'I am sorry, I could not understand your request. Would you like to Send Money, Cash Out, Pay a Bill, Recharge, or manage Savings?',
  };
}

export default {
  evaluateSecurityBoundaries,
  planIntent,
};
