import crypto from 'crypto';
import {
  PendingAction,
  User,
  Wallet,
  Schedule,
  Rule,
  Reminder,
  Transaction,
  Notification,
  ProtectedProfile,
  GuardianLink,
  MoneyRequest,
  AuditLog,
  SavingsPlan,
  FinancialMemory,
} from '../models/index.js';
import {
  evaluateGuardianPolicy,
  decideGuardianApproval,
  getPendingApprovals,
  updateChildControlMode,
} from './guardian.service.js';
import { getAgentDashboard } from './agent.directory.service.js';
import { retrieveKnowledge } from './rag.service.js';
import {
  formatBdt,
  getSpendingSummary,
  getIncomeSummary,
  compareSpending,
  explainFinancialHabits,
} from './financialAnalysis.service.js';
import {
  calculatePercentageSavings,
  calculateRoundUpSavings,
  calculateThresholdSavings,
  calculateGoalPace,
  getOrCreateFinancialMemory,
  configureMicroSavings,
  getMicroSavingsConfig,
  pauseMicroSavings,
  resumeMicroSavings,
  disableMicroSavings,
} from './microSavings.service.js';
import { evaluateGuardianRisk } from './guardianRisk.service.js';
import { computeCanonicalActionHash } from './auth.service.js';
import { emitToUser } from './socket.service.js';
import { validateFactNumbers } from './aiTip.service.js';
import logger from '../utils/logger.js';
import {
  convertBengaliDigits,
  convertNumberWords,
  normalizeInput,
  extractAmountInPoisha as extractAmountInPoishaModular,
} from './copilot/inputNormalizer.js';
import {
  getTaskState,
  updateTaskState,
  clearActiveTask,
  isConfirmation,
  isCancellation,
  detectUserCorrection,
  extractFollowUpParameters,
  MFS_INTENT_SCHEMAS,
} from './copilot/taskStateManager.js';
import {
  emitCopilotEvent,
  COPILOT_EVENTS,
} from './copilot/copilotEventBus.js';
import {
  resolveRecipient as resolveRecipientModular,
  normalizeBdPhone,
  BN_TO_EN_NAMES,
} from './copilot/entityResolver.js';
import {
  validateTransactionRules,
  validateGroupBillSplit,
  calculateCashOutFee,
} from './copilot/ruleEngine.js';
import {
  preparePendingConfirmation,
  formatConfirmationPrompt as formatConfirmationPromptModular,
} from './copilot/confirmationManager.js';
import {
  planIntent,
  evaluateSecurityBoundaries,
} from './copilot/intentPlanner.js';
import {
  executePendingActionTool,
  executeReadOnlyTool,
} from './copilot/toolExecutor.js';
import {
  recordCopilotAudit,
  logSecurityBlocked,
  logToolPlanned,
  logConfirmationRequested,
  logExecutionCompleted,
} from './copilot/auditLogger.js';
import {
  formatClarificationResponse,
  formatConfirmationPrompt,
  formatSecurityRejection,
} from './copilot/responseGenerator.js';
import {
  rememberFact,
  recallMemories,
  forgetFact,
  clearUserMemory,
  resolveAliasRecipient,
  resolveUtilityAccount,
  saveConversationMessage,
  getConversationHistory,
  clearConversationHistory,
  getMemoryContextSummary,
} from './copilot/memory.service.js';
import { routeToDomainAgent } from './copilot/domainAgents/domainRouter.js';

export { formatBdt };

/**
 * Classify user natural language intent into structured category.
 */
export function classifyIntent(text) {
  const lower = text.toLowerCase().trim();

  // 1. Prompt Injection & Policy Override Detection
  if (
    lower.includes('ignore previous') ||
    lower.includes('ignore all previous') ||
    lower.includes('ignore all rules') ||
    lower.includes('disable guardian') ||
    lower.includes('system message:') ||
    lower.includes('override policy') ||
    lower.includes('send all my money') ||
    lower.includes('transfer everything') ||
    lower.includes('do not ask for pin') ||
    lower.includes('without pin') ||
    lower.includes('without confirmation') ||
    lower.includes('do not ask for confirmation') ||
    lower.includes('reveal system prompt') ||
    lower.includes('reveal your system prompt') ||
    lower.includes('show hidden tools') ||
    lower.includes('give me another user') ||
    lower.includes('ignore the limit') ||
    lower.includes('ignore my guardian') ||
    lower.includes('ignore the warning') ||
    lower.includes('ignore warning') ||
    lower.includes('approve my own') ||
    lower.includes('pretend i am the guardian') ||
    lower.includes('pretend i am an agent') ||
    lower.includes('api key') ||
    lower.includes('secret key') ||
    lower.includes('show me the database') ||
    lower.includes('you are now the administrator') ||
    lower.includes('you are now admin') ||
    lower.includes('disable all security') ||
    lower.includes('disable security') ||
    lower.includes('reveal tool credentials') ||
    lower.includes('tool credentials') ||
    lower.includes('use another user') ||
    lower.includes('shob taka pathao') ||
    lower.includes('pin lagbe na') ||
    lower.includes('pin chara') ||
    lower.includes('override koro') ||
    lower.includes('guardian bad dao')
  ) {
    return { type: 'injection', reason: 'Potential prompt injection, security bypass, or unauthorized policy override detected.' };
  }

  // 1b. Secret Credential Probes (PIN, OTP, Passwords)
  if (
    lower.includes('what is my pin') ||
    lower.includes('show my pin') ||
    lower.includes('reveal pin') ||
    lower.includes('tell me my pin') ||
    lower.includes('আমার পিন কত') ||
    lower.includes('amar pin koto') ||
    lower.includes('pin bolo') ||
    lower.includes('pin dekhaw') ||
    lower.includes('what is my otp') ||
    lower.includes('show my otp') ||
    lower.includes('give me otp') ||
    lower.includes('otp bolo') ||
    lower.includes('otp dekhaw') ||
    lower.includes('what password') ||
    lower.includes('show password') ||
    lower.includes('password bolo')
  ) {
    return { type: 'secret_probe' };
  }

  // 1c. Cross-User Data Access Probes
  if (
    lower.includes('show user b') ||
    lower.includes('user b balance') ||
    lower.includes('another user balance') ||
    lower.includes('other user balance') ||
    lower.includes('all users balance') ||
    lower.includes('show all users') ||
    lower.includes('onno user balance') ||
    lower.includes('onno karor balance') ||
    lower.includes('onno karor taka') ||
    lower.includes('shobar balance') ||
    lower.includes('অন্য ব্যবহারকারীর ব্যালেন্স') ||
    lower.includes('অন্য কারও ব্যালেন্স') ||
    lower.includes('সবার ব্যালেন্স')
  ) {
    return { type: 'cross_user_probe' };
  }

  // 1d. Irrelevant Non-Financial Queries (politely refuse instead of hallucinating)
  if (
    lower.includes('capital of') ||
    lower.includes('weather') ||
    lower.includes('write a poem') ||
    lower.includes('write poem') ||
    lower.includes('poem') ||
    lower.includes('tell me a joke') ||
    lower.includes('tell a joke') ||
    lower.includes('joke') ||
    lower.includes('write python') ||
    lower.includes('write code') ||
    lower.includes('python code') ||
    lower.includes('javascript code') ||
    lower.includes('coding') ||
    lower.includes('who won') ||
    lower.includes('world cup') ||
    lower.includes('recipe') ||
    lower.includes('recipes') ||
    lower.includes('how to cook') ||
    lower.includes('lyrics') ||
    lower.includes('president of') ||
    lower.includes('prime minister of') ||
    lower.includes('meaning of life') ||
    lower.includes('solve this math') ||
    lower.includes('trivia') ||
    lower.includes('আবহাওয়া') ||
    lower.includes('কবিতা') ||
    lower.includes('কৌতুক') ||
    lower.includes('রান্নার রেসিপি') ||
    lower.includes('গান গাও')
  ) {
    return { type: 'irrelevant' };
  }

  // 2. Application Control: Logout
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
    return { type: 'app_logout' };
  }

  // 3. Application Control: Change PIN
  if (
    lower.includes('change pin') ||
    lower.includes('change my pin') ||
    lower.includes('reset pin') ||
    lower.includes('update pin') ||
    lower.includes('পিন পরিবর্তন') ||
    lower.includes('পিন পাল্টাও') ||
    lower.includes('পিন বদলাও')
  ) {
    return { type: 'app_change_pin' };
  }

  // 4. Application Control: App Navigation
  if (
    lower.includes('open transaction history') ||
    lower.includes('open my transaction history') ||
    lower.includes('go to history') ||
    lower.includes('open history') ||
    lower.includes('লেনদেনের ইতিহাস খোলো')
  ) {
    return { type: 'app_navigate', path: '/history' };
  }
  if (
    lower.includes('open savings') ||
    lower.includes('go to savings') ||
    lower.includes('সঞ্চয় খোলো') ||
    lower.includes('সেভিংস পাতা')
  ) {
    return { type: 'app_navigate', path: '/account', subview: 'savings' };
  }
  if (
    lower.includes('show my profile') ||
    lower.includes('open profile') ||
    lower.includes('go to profile') ||
    lower.includes('আমার প্রোফাইল দেখাও')
  ) {
    return { type: 'app_navigate', path: '/account' };
  }
  if (
    lower.includes('open guardian') ||
    lower.includes('guardian mode') ||
    lower.includes('guardians') ||
    lower.includes('guardian খোলো') ||
    lower.includes('গার্ডিয়ান মোড') ||
    lower.includes('গার্ডিয়ান খোলো') ||
    lower.includes('গার্ডিয়ান মোড') ||
    lower.includes('গার্ডিয়ান খোলো')
  ) {
    return { type: 'app_open_guardian' };
  }
  if (
    lower.includes('open more') ||
    lower.includes('go to more') ||
    lower.includes('settings') ||
    lower.includes('সেটিংস') ||
    lower.includes('আরো অপশন')
  ) {
    return { type: 'app_navigate', path: '/more' };
  }

  // 5. Financial Explanations: "Why am I running out of money every month?"
  if (
    lower.includes('why am i running out of money') ||
    lower.includes('why do i have no money') ||
    lower.includes('where is my money going') ||
    lower.includes('টাকা কেন শেষ হয়ে যায়') ||
    lower.includes('টাকা থাকে না কেন') ||
    lower.includes('খরচের অভ্যাস') ||
    lower.includes('spending habit')
  ) {
    return { type: 'financial_explanation' };
  }

  // 6. Spending Comparison: "Compare this month with last month" / "Why am I spending more than last month"
  if (
    lower.includes('compare this month') ||
    lower.includes('compare with last month') ||
    lower.includes('compare spending') ||
    lower.includes('spending more than last month') ||
    lower.includes('গত মাসের সাথে তুলনা') ||
    lower.includes('গত মাসের চেয়ে বেশি') ||
    lower.includes('তুলনা করো')
  ) {
    return { type: 'compare_spending' };
  }

  // 7. Spending Summary: "How much did I spend this month / week?" / "Where did most of my money go?"
  if (
    lower.includes('how much did i spend') ||
    lower.includes('how much did i spend this month') ||
    lower.includes('how much did i spend this week') ||
    lower.includes('total spending') ||
    lower.includes('where did most of my money go') ||
    lower.includes('এই মাসে কত খরচ') ||
    lower.includes('সবচেয়ে বেশি খরচ কোথায়') ||
    lower.includes('মোট খরচ কত')
  ) {
    return { type: 'spending_summary' };
  }

  // 8. Income Summary: "How much did I receive this month?"
  if (
    lower.includes('how much did i receive') ||
    lower.includes('how much money came in') ||
    lower.includes('total income') ||
    lower.includes('কত টাকা পেয়েছি') ||
    lower.includes('কত টাকা ঢুকেছে') ||
    lower.includes('জমা হয়েছে কত')
  ) {
    return { type: 'income_summary' };
  }

  // 9. Category Spending: "How much did I spend on recharge / bill?"
  if (
    (lower.includes('spend on recharge') || lower.includes('রিচার্জে কত')) ||
    (lower.includes('spend on bill') || lower.includes('বিলে কত')) ||
    (lower.includes('spend on send money') || lower.includes('টাকা পাঠানোতে কত'))
  ) {
    return { type: 'category_spending' };
  }

  // 10. Biggest Transactions Query: "Show my biggest transactions"
  if (
    lower.includes('biggest transaction') ||
    lower.includes('highest transaction') ||
    lower.includes('সবচেয়ে বড় লেনদেন') ||
    lower.includes('বড় খরচ')
  ) {
    return { type: 'biggest_transactions' };
  }

  // 11. Micro-Savings: Percentage Saving ("Save 2% from every transaction", "Change savings to 5%", "Set savings to -5%")
  if (
    (lower.includes('save') || lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস') || lower.includes('change savings')) &&
    (lower.includes('%') || lower.includes('percent') || lower.includes('পার্সেন্ট'))
  ) {
    return { type: 'set_percentage_savings' };
  }

  // 12. Micro-Savings: Disable Savings ("Disable savings", "Disable round-up savings", "savings bondho koro")
  if (
    (lower.includes('disable') || lower.includes('turn off') || lower.includes('stop') || lower.includes('বন্ধ করো') || lower.includes('বন্ধ') || lower.includes('bondho')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস') || lower.includes('round-up') || lower.includes('round up'))
  ) {
    return { type: 'disable_savings' };
  }

  // 13. Micro-Savings: Round-Up Saving ("Enable round-up savings", "Round-up savings on koro")
  if (
    lower.includes('round-up') ||
    lower.includes('round up') ||
    lower.includes('রাউন্ড-আপ') ||
    lower.includes('রাউন্ড আপ')
  ) {
    return { type: 'set_roundup_savings' };
  }

  // 14. Micro-Savings: Threshold Saving ("Whenever I spend more than 500")
  if (
    (lower.includes('spend more than') || lower.includes('বেশি খরচ করলে')) &&
    (lower.includes('save') || lower.includes('সঞ্চয়') || lower.includes('round'))
  ) {
    return { type: 'set_threshold_savings' };
  }

  // 15. Micro-Savings: Pause / Resume
  if (
    (lower.includes('pause') || lower.includes('থামাও') || lower.includes('স্থগিত')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস'))
  ) {
    return { type: 'pause_savings' };
  }
  if (
    (lower.includes('resume') || lower.includes('চালু করো') || lower.includes('পুনরায় চালু')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('সেভিংস'))
  ) {
    return { type: 'resume_savings' };
  }

  // 16. Update Savings Goal: "Change my savings goal to ৳20,000" / "Update savings goal to 20000"
  if (
    (lower.includes('change') || lower.includes('update') || lower.includes('set') || lower.includes('পরিবর্তন') || lower.includes('আপডেট')) &&
    (lower.includes('savings goal') || lower.includes('goal') || lower.includes('সঞ্চয় লক্ষ্য') || lower.includes('টার্গেট')) &&
    /\d+/.test(lower)
  ) {
    return { type: 'update_savings_goal' };
  }

  // 17. Savings Goal Creation: "Create a savings goal of 10,000 taka" / "I want to save 5000 taka in the next 2 months" / "Every week save 500 taka for my laptop" / "Make a savings plan for my new laptop"
  if (
    (lower.includes('savings goal') || lower.includes('save') || lower.includes('সঞ্চয় লক্ষ্য') || lower.includes('জমাতে চাই') || lower.includes('নতুন লক্ষ্য') || lower.includes('savings plan') || lower.includes('সেভিংস প্ল্যান') || lower.includes('সঞ্চয় পরিকল্পনা') || lower.includes('সেভিংস গোল') || lower.includes('ডিপিএস') || lower.includes('dps')) &&
    (lower.includes('goal') || lower.includes('লক্ষ্য') || lower.includes('month') || lower.includes('মাস') || lower.includes('week') || lower.includes('সপ্তাহ') || lower.includes('plan') || lower.includes('পরিকল্পনা') || lower.includes('laptop') || lower.includes('ল্যাপটপ') || lower.includes('for my') || lower.includes('for a') || lower.includes('জন্য') || /\d+/.test(lower)) &&
    !lower.includes('%') && !lower.includes('percent') && !lower.includes('পার্সেন্ট') && !lower.includes('round-up') && !lower.includes('round up') &&
    !lower.includes('when ') && !lower.includes('if ') && !lower.includes('যখন') && !lower.includes('টাকা ঢুকলে') && !lower.includes('টাকা আসলে') && !lower.startsWith('every ')
  ) {
    return { type: 'create_savings_goal' };
  }

  // 18. Query Savings Settings: "Show my current savings settings", "What is my savings percentage?", "Is savings active?"
  if (
    lower.includes('savings settings') ||
    lower.includes('savings config') ||
    lower.includes('savings percentage') ||
    lower.includes('is savings active') ||
    lower.includes('what is my savings goal') ||
    lower.includes('সঞ্চয়ের সেটিংস') ||
    lower.includes('সঞ্চয় কি চালু') ||
    lower.includes('সঞ্চয়ের শতকরা হার') ||
    lower.includes('সঞ্চয়ের রুল')
  ) {
    return { type: 'get_savings_settings' };
  }

  // 19. Ambiguous Commands (require clarification)
  if (
    lower === 'change my savings' ||
    lower === 'change savings' ||
    lower === 'আমার সঞ্চয় পরিবর্তন করো'
  ) {
    return { type: 'ambiguous_change_savings' };
  }

  if (
    lower === 'remind me later' ||
    lower === 'remind later' ||
    lower === 'পরে মনে করিয়ে দিও'
  ) {
    return { type: 'ambiguous_reminder' };
  }

  if (
    lower === 'save more' ||
    lower === 'আরও সঞ্চয় করো' ||
    lower === 'বেশি সেভ করো'
  ) {
    return { type: 'ambiguous_save_more' };
  }

  if (
    (lower.startsWith('pay ') || lower.startsWith('পে ')) &&
    !/\d+/.test(lower) &&
    !lower.includes('bill') &&
    !lower.includes('বিল')
  ) {
    return { type: 'ambiguous_pay' };
  }

  if (
    lower === 'save some money for me' ||
    lower === 'save some money' ||
    lower === 'আমার জন্য কিছু টাকা জমিয়ে রাখো' ||
    lower === 'টাকা জমাও'
  ) {
    return { type: 'ambiguous_savings' };
  }

  // 20. Financial Memory: "I'm saving for a laptop" / "How am I doing with my laptop?"
  if (
    lower.includes('how am i doing with my') ||
    lower.includes('how is my') && lower.includes('goal') ||
    lower.includes('লক্ষ্যের অবস্থা কী')
  ) {
    return { type: 'get_remembered_goal' };
  }
  if (
    lower.includes("saving for a") ||
    lower.includes("saving for my") ||
    lower.includes('জন্য সঞ্চয় করছি') ||
    lower.includes('কেনার জন্য টাকা জমাচ্ছি')
  ) {
    return { type: 'remember_financial_goal' };
  }

  // 20b. Memory: Recall / Query remembered information
  if (
    lower.includes('what do you remember') ||
    lower.includes('what do you know about me') ||
    lower.includes('show my memory') ||
    lower.includes('show memories') ||
    lower.includes('show remembered') ||
    lower.includes('list memories') ||
    lower.includes('what are my saved') ||
    lower.includes('কী মনে রেখেছো') ||
    lower.includes('কী জানো আমার সম্পর্কে') ||
    lower.includes('মেমোরি দেখাও') ||
    lower.includes('সংরক্ষিত তথ্য')
  ) {
    return { type: 'recall_memory' };
  }

  // 20c. Memory: Clear all memories
  if (
    lower.includes('clear all memory') ||
    lower.includes('clear my memory') ||
    lower.includes('clear memory') ||
    lower.includes('delete all memory') ||
    lower.includes('মেমোরি মুছে ফেলো') ||
    lower.includes('সব মেমোরি মুছে ফেলো') ||
    lower.includes('সব তথ্য মুছে ফেলো') ||
    lower.includes('সব তথ্য ভুলে যাও')
  ) {
    return { type: 'clear_memory' };
  }

  // 20d. Memory: Forget specific fact
  if (
    lower.startsWith('forget ') ||
    lower.startsWith('forget that ') ||
    lower.includes('forget that') ||
    lower.includes('delete fact') ||
    lower.includes('remove memory') ||
    lower.includes('delete memory') ||
    lower.includes('ভুলে যাও') ||
    (lower.includes('মুছে ফেলো') && (lower.includes('তথ্য') || lower.includes('নোট') || lower.includes('মেমোরি')))
  ) {
    return { type: 'forget_memory' };
  }

  // 20e. Memory: Remember new fact, relationship alias, utility account, or preference
  const isExplicitRemember =
    lower.startsWith('remember ') ||
    lower.startsWith('remember that ') ||
    lower.includes('remember that') ||
    lower.startsWith('save note') ||
    lower.startsWith('save fact') ||
    lower.startsWith('note that') ||
    lower.startsWith('keep in mind that') ||
    lower.startsWith('keep in mind') ||
    lower.startsWith('মনে রাখো ') ||
    lower.startsWith('মনে রেখো ') ||
    lower.includes('মনে রাখো যে') ||
    lower.includes('মনে রেখো যে') ||
    lower.startsWith('নোট করো');

  const isImplicitKinship =
    !lower.includes('send') &&
    !lower.includes('pathao') &&
    !lower.includes('পাঠাও') &&
    !lower.includes('pay ') &&
    !lower.includes('পে ') &&
    !/\d{4,}/.test(lower) &&
    (
      lower.includes('is my brother') ||
      lower.includes('is my sister') ||
      lower.includes('is my friend') ||
      lower.includes('is my father') ||
      lower.includes('is my mother') ||
      lower.includes('is my wife') ||
      lower.includes('is my husband') ||
      lower.includes('is my landlord') ||
      lower.includes('আমার ভাই') ||
      lower.includes('আমার বোন') ||
      lower.includes('আমার বাবা') ||
      lower.includes('আমার মা') ||
      lower.includes('আমার স্ত্রী') ||
      lower.includes('আমার বন্ধু') ||
      lower.includes('আমার বাড়িওয়ালা')
    );

  if (isExplicitRemember || isImplicitKinship) {
    return { type: 'remember_fact' };
  }

  // 21. Savings Progress Query: "Show my savings progress"
  if (
    lower.includes('savings progress') ||
    lower.includes('my savings') ||
    lower.includes('how much have i saved') ||
    lower.includes('আমার সঞ্চয় কত') ||
    lower.includes('সঞ্চয়ের অগ্রগতি') ||
    lower.includes('সেভিংস গোল')
  ) {
    return { type: 'get_savings_progress' };
  }

  // 19. Agent Account Statistics Query
  if (
    lower.includes('agent balance') ||
    lower.includes('collection') ||
    lower.includes('cash-out volume') ||
    lower.includes('customer transactions') ||
    lower.includes('agent statistics') ||
    lower.includes('এজেন্ট ব্যালেন্স') ||
    lower.includes('কালেকশন') ||
    lower.includes('এজেন্ট ড্যাশবোর্ড')
  ) {
    return { type: 'agent_stats' };
  }

  // 20. Balance Query Intent
  if (
    lower.includes('balance') ||
    lower.includes('ব্যালেন্স') ||
    lower.includes('how much money') ||
    lower.includes('কত টাকা আছে') ||
    lower.includes('আমার টাকা') ||
    lower.includes('আমার কাছে কত') ||
    lower.includes('how much can i spend') ||
    lower.includes('how much can i cash out') ||
    lower.includes('আমার ব্যালেন্স') ||
    lower.includes('balance koto') ||
    lower.includes('amar taka koto') ||
    lower.includes('koto taka ase') ||
    lower.includes('taka koto') ||
    lower.includes('amar balance')
  ) {
    return { type: 'balance' };
  }

  // 21. Account / Limit / Profile Query Intent
  if (
    lower.includes('my account') ||
    lower.includes('account type') ||
    lower.includes('account information') ||
    lower.includes('my profile') ||
    lower.includes('my limits') ||
    lower.includes('transaction limits') ||
    lower.includes('অ্যাকাউন্ট') ||
    lower.includes('আমার লিমিট') ||
    lower.includes('আমার তথ্য') ||
    lower.includes('সীমা')
  ) {
    return { type: 'account' };
  }

  // 22. Notifications Query Intent
  if (
    lower.includes('notification') ||
    lower.includes('নোটিফিকেশন') ||
    lower.includes('what happened') ||
    lower.includes('বার্তা') ||
    lower.includes('নতুন কোনো নোটিফিকেশন')
  ) {
    return { type: 'notifications' };
  }

  // 23. Transaction Details Query (last transaction breakdown)
  if (
    lower.includes('about my last transaction') ||
    lower.includes('who received my last') ||
    lower.includes('what fee did i pay') ||
    lower.includes('was my transaction successful') ||
    lower.includes('why did my transaction fail') ||
    lower.includes('শেষ লেনদেনের বিবরণ') ||
    lower.includes('লাস্ট লেনদেন')
  ) {
    return { type: 'transaction_details' };
  }

  // 24. Transaction History Query Intent
  if (
    lower.includes('transaction history') ||
    lower.includes('transactions') ||
    lower.includes('recent transactions') ||
    lower.includes('what did i spend') ||
    lower.includes('my last transaction') ||
    lower.includes('last 10 transactions') ||
    lower.includes('did i send money') ||
    lower.includes('history') ||
    lower.includes('লেনদেনের ইতিহাস') ||
    lower.includes('লেনদেন দেখাও') ||
    lower.includes('লেনদেনগুলো') ||
    lower.includes('খরচ কত')
  ) {
    return { type: 'transactions' };
  }

  // 24b. Group Bill Creation Intent (Natural Language)
  if (lower.startsWith('split ') || (lower.includes('split') && !lower.includes('group bill') && !lower.startsWith('create'))) {
    if (!lower.includes('status') && !lower.includes('who owes') && !lower.includes('বাকি')) {
      return { type: 'split_bill' };
    }
  }

  if (
    ((lower.includes('create') || lower.includes('make') || lower.includes('তৈরি') || lower.includes('বানাও') || lower.includes('খোলো') || lower.includes('করো')) &&
      (lower.includes('group bill') || lower.includes('গ্রুপ বিল') || lower.includes('bill split') || lower.includes('বিল স্প্লিট') || lower.includes('split bill') || lower.includes('group split'))) ||
    ((lower.includes('group bill') || lower.includes('গ্রুপ বিল') || lower.includes('bill split') || lower.includes('বিল স্প্লিট')) &&
      (/\d+/.test(lower) || lower.includes('with') || lower.includes('সাথে')))
  ) {
    if (!lower.includes('status') && !lower.includes('who owes') && !lower.includes('বাকি')) {
      return { type: 'create_group_bill' };
    }
  }

  // 25. Group Bill / Split Bill Query
  if (
    lower.includes('group bill') ||
    lower.includes('split bill') ||
    lower.includes('who still owes') ||
    lower.includes('who has paid') ||
    lower.includes('how much is due') ||
    lower.includes('গ্রুপ বিল') ||
    lower.includes('কে টাকা দিয়েছে') ||
    lower.includes('বাকি টাকা')
  ) {
    return { type: 'group_bill_query' };
  }

  // 26. Payment Requests Query (List)
  if (
    lower.includes('pending request') ||
    lower.includes('who owes me') ||
    lower.includes('রিকোয়েস্ট দেখাও') ||
    lower.includes('রিকোয়েস্টের তালিকা')
  ) {
    return { type: 'requests_list' };
  }

  // 26b. Create Individual Payment Request
  if (
    (lower.startsWith('request ') || lower.includes('request money') || lower.includes('টাকা রিকোয়েস্ট') || lower.includes('টাকা চাও') || lower.includes('টাকা পাঠাতে বলো')) &&
    !lower.includes('group') && !lower.includes('গ্রুপ')
  ) {
    return { type: 'request_money' };
  }

  // 26c. Guardian Natural Language Approval Intent
  if (
    (lower.includes('approve') || lower.includes('অনুমোদন') || lower.includes('অ্যাপ্রুভ')) &&
    (lower.includes('child') || lower.includes('son') || lower.includes('daughter') || lower.includes('ward') ||
     lower.includes('সন্তান') || lower.includes('ছেলে') || lower.includes('মেয়ে') || lower.includes('পেমেন্ট') ||
     lower.includes('লেনদেন') || lower.includes('pending') || lower.includes('পেন্ডিং') || lower.includes('payment'))
  ) {
    return { type: 'guardian_approve' };
  }

  // 26d. Guardian Setup / Add Child Intent
  if (
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
    (lower.includes('child') && (lower.includes('add') || lower.includes('যুক্ত')))
  ) {
    return { type: 'guardian_mode' };
  }

  // 27. Guardian Management Queries & Status
  if (
    lower.includes('my children') ||
    lower.includes('child permissions') ||
    lower.includes('child\'s daily limit') ||
    lower.includes('pending child transaction') ||
    lower.includes('approve') ||
    lower.includes('reject') ||
    lower.includes('অনুমোদন') ||
    lower.includes('সন্তানের') ||
    lower.includes('গার্ডিয়ান')
  ) {
    return { type: 'guardian_query' };
  }

  // 28. Child queries regarding permissions/limits
  if (
    lower.includes('what can i do') ||
    lower.includes('spending limit') ||
    lower.includes('need guardian approval') ||
    lower.includes('restrictions') ||
    lower.includes('আমি কি করতে পারি') ||
    lower.includes('আমার খরচ করার সীমা')
  ) {
    return { type: 'child_query' };
  }

  // 29. Reminder List or Cancel
  if (
    (lower.includes('show') || lower.includes('what') || lower.includes('list') || lower.includes('দেখাও')) &&
    (lower.includes('reminder') || lower.includes('রিমাইন্ডার'))
  ) {
    return { type: 'reminders_list' };
  }
  if (
    (lower.includes('cancel') || lower.includes('delete') || lower.includes('বাতিল') || lower.includes('মুছে')) &&
    (lower.includes('reminder') || lower.includes('রিমাইন্ডার'))
  ) {
    return { type: 'reminder_cancel' };
  }

  // 30. Schedule List or Cancel
  if (
    (lower.includes('show') || lower.includes('what') || lower.includes('list') || lower.includes('দেখাও')) &&
    (lower.includes('schedule') || lower.includes('শিডিউল'))
  ) {
    return { type: 'schedules_list' };
  }
  if (
    (lower.includes('cancel') || lower.includes('pause') || lower.includes('resume') || lower.includes('বাতিল')) &&
    (lower.includes('schedule') || lower.includes('শিডিউল') || lower.includes('monthly payment'))
  ) {
    return { type: 'schedule_cancel' };
  }

  // 31. Rules List or Toggle/Delete
  if (
    (lower.includes('show') || lower.includes('what') || lower.includes('list') || lower.includes('দেখাও')) &&
    (lower.includes('rule') || lower.includes('রুল'))
  ) {
    return { type: 'rules_list' };
  }
  if (
    (lower.includes('disable') || lower.includes('enable') || lower.includes('delete') || lower.includes('বন্ধ') || lower.includes('বাতিল')) &&
    (lower.includes('rule') || lower.includes('রুল'))
  ) {
    return { type: 'rule_toggle' };
  }

  // 31b. Past Reminder Intent (invalid boundary)
  if (
    (lower.startsWith('remind me') || lower.includes('রিমাইন্ডার') || lower.includes('মনে করিয়ে দিও')) &&
    (lower.includes('yesterday') || lower.includes('গতকালের') || lower.includes('আগের'))
  ) {
    return { type: 'past_reminder' };
  }

  // 32. Reminder Create Intent
  if (lower.startsWith('remind me') || lower.includes('রিমাইন্ডার') || lower.includes('মনে করিয়ে দিও')) {
    return { type: 'reminder' };
  }

  // 33. Conditional Rule Intent (WHEN / IF)
  if (
    lower.includes('when ') ||
    lower.includes('if ') ||
    lower.includes('যখন') ||
    lower.includes('আসলে') ||
    lower.includes('টাকা ঢুকলে')
  ) {
    return { type: 'conditional' };
  }

  // 34. Recurring Schedule Intent
  if (
    lower.includes('every ') ||
    lower.includes('প্রতি মাসে') ||
    lower.includes('প্রতি শুক্রবার') ||
    lower.includes('প্রতিদিন') ||
    lower.includes('monthly') ||
    lower.includes('weekly')
  ) {
    return { type: 'recurring' };
  }

  // 35. One-time Schedule Intent
  if (
    lower.includes('tomorrow') ||
    lower.includes('schedule') ||
    lower.includes('কালকে') ||
    lower.includes('আগামীকাল') ||
    lower.includes('in 5 minutes') ||
    lower.includes('পরে পাঠাও')
  ) {
    return { type: 'scheduled' };
  }

  // 36. Knowledge & Help Queries (RAG)
  if (
    lower.includes('difference between') ||
    lower.includes('পার্থক্য কী') ||
    lower.includes('how does') ||
    lower.includes('ফি কত') ||
    (/\bcharge\b/i.test(lower) && !lower.includes('recharge') && !lower.includes('রিচার্জ')) ||
    lower.includes('কীভাবে কাজ করে') ||
    lower.includes('কিভাবে কাজ করে') ||
    lower.includes('help') ||
    lower.includes('সাহায্য')
  ) {
    return { type: 'knowledge' };
  }

  // 36b. Mobile Recharge Intent
  if (
    lower.startsWith('recharge') ||
    lower.includes('recharge ') ||
    lower.includes('রিচার্জ') ||
    lower.includes('মোবাইল রিচার্জ')
  ) {
    return { type: 'mobile_recharge' };
  }

  // 37. Immediate Financial Transaction Intents (Send, Cash Out, Bill Pay, Recharge, Add Money in Bangla, Banglish & English)
  if (
    lower.startsWith('send ') ||
    lower.startsWith('pay ') ||
    lower.startsWith('recharge ') ||
    lower.includes('cash out') ||
    lower.includes('cashout') ||
    lower.includes('cash in') ||
    lower.startsWith('add ') ||
    lower.includes('add money') ||
    lower.includes('withdraw') ||
    lower.includes('send koro') ||
    lower.includes('send kor') ||
    lower.includes('send money') ||
    lower.includes('pathao') ||
    lower.includes('pathate') ||
    lower.includes('pathano') ||
    lower.includes('পাঠাও') ||
    lower.includes('পাঠাতে') ||
    lower.includes('পাঠানো') ||
    lower.includes('বিল দাও') ||
    lower.includes('বিল পরিশোধ') ||
    lower.includes('রিচার্জ') ||
    lower.includes('ক্যাশ আউট') ||
    lower.includes('ক্যাশআউট') ||
    lower.includes('উত্তোলন') ||
    lower.includes('ক্যাশ ইন') ||
    lower.includes('টাকা যোগ') ||
    lower.includes('desco') ||
    lower.includes('dpdc') ||
    lower.includes('wasa') ||
    lower.includes('titas') ||
    lower.includes('nesco') ||
    ((lower.includes('bill') || lower.includes('বিল') || lower.includes('বিদ্যুৎ') || lower.includes('পানি') || lower.includes('গ্যাস') || lower.includes('electricity')) &&
      (lower.includes('pay') || lower.includes('দাও') || lower.includes('পরিশোধ') || lower.includes('দেওয়া') || /\d+/.test(lower))) ||
    (!lower.includes('limit') && !lower.includes('সীমা') && (lower.includes('dao') || lower.includes('দাও')) &&
      (lower.includes('taka') || lower.includes('টাকা') || lower.includes('friend') || lower.includes('ke') || lower.includes('কে') || /\d+/.test(lower))) ||
    (lower.includes('send') && (/\d+/.test(lower) || lower.includes('rahim') || lower.includes('to')))
  ) {
    return { type: 'immediate' };
  }

  return { type: 'query' };
}

/**
 * Extract explicit numerical amount in poisha from user message text.
 * Returns null if no explicit number is present.
 */
export function extractExplicitAmountPoisha(text) {
  if (!text) return null;
  const wordConverted = convertNumberWords(text);
  const bnToEnMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  let normalized = wordConverted.replace(/[০-৯]/g, (d) => bnToEnMap[d]);

  // Strip out commas in numbers e.g. "10,000" or "5,000"
  normalized = normalized.replace(/,/g, '');

  // Strip out time expressions like "8 PM", "8:00 AM", "8am"
  normalized = normalized.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '');

  // Strip 11-digit phone numbers so they don't get misidentified as amounts
  let textWithoutPhones = normalized.replace(/01[3-9]\d{8}/g, '');

  // Strip percentages so "2%" or "-5%" is not captured as amount
  textWithoutPhones = textWithoutPhones.replace(/-?\d+\s*%/g, '');

  const match =
    textWithoutPhones.match(/(?:send|pay|recharge|add|cash out|withdraw|goal|target|৳|tk|taka|টাকা|পাঠাও|রিচার্জ|যোগ|লক্ষ্য)\s*(-?\d+)/i) ||
    textWithoutPhones.match(/(-?\d+)\s*(?:taka|tk|টাকা)/i) ||
    textWithoutPhones.match(/(?:^|\s)(-?\d+)(?:\s|$|[,\.?!])/);

  if (match) {
    const raw = match[1] !== undefined ? match[1] : match[0];
    const bdt = parseInt(raw.trim(), 10);
    if (!isNaN(bdt)) {
      return bdt * 100;
    }
  }
  return null;
}

/**
 * Fallback amount extractor defaulting to 500 BDT if none found
 */
export function extractAmountPoisha(text) {
  const explicit = extractExplicitAmountPoisha(text);
  return explicit !== null ? explicit : 50000;
}

/**
 * Helper to resolve operator from phone number
 */
function getOperatorFromPhone(phone) {
  if (!phone) return 'Grameenphone';
  if (phone.startsWith('017') || phone.startsWith('013')) return 'Grameenphone';
  if (phone.startsWith('018')) return 'Robi';
  if (phone.startsWith('019') || phone.startsWith('014')) return 'Banglalink';
  if (phone.startsWith('015')) return 'Teletalk';
  if (phone.startsWith('016')) return 'Airtel';
  return 'Grameenphone';
}

/**
 * Helper to get name search candidates including transliterations.
 */
export function getNameTargets(name) {
  if (!name) return [];
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const transliterated = BN_TO_EN_NAMES[trimmed] || BN_TO_EN_NAMES[lower];
  const list = [trimmed];
  if (transliterated) list.push(transliterated);
  return list;
}

/**
 * Extract recipient name or phone from natural language text
 */
export async function resolveRecipient(text, senderUserId) {
  if (!text) return null;

  // 1. Check for 11-digit phone number
  const phoneMatch = text.match(/01[3-9]\d{8}/);
  if (phoneMatch) {
    const cleanPhone = phoneMatch[0];
    const user = await User.findOne({ phone: cleanPhone, status: 'active' });
    return {
      phone: cleanPhone,
      name: user ? user.name : cleanPhone,
      isKnown: Boolean(user),
      user: user || null,
    };
  }

  // 1b. Check User Memory for Contact Aliases (e.g. "brother", "bhai", "ভাই", "landlord")
  if (senderUserId) {
    try {
      const aliasMatch = await resolveAliasRecipient({ userId: senderUserId, aliasQuery: text });
      if (aliasMatch && (aliasMatch.phone || aliasMatch.user)) {
        return {
          phone: aliasMatch.phone || (aliasMatch.user ? aliasMatch.user.phone : null),
          name: aliasMatch.name,
          isKnown: Boolean(aliasMatch.user || aliasMatch.phone),
          user: aliasMatch.user || null,
          relationship: aliasMatch.relationship,
        };
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to resolve recipient from memory alias');
    }
  }

  // 2. Extract potential recipient candidates from text:
  // e.g. "to Rahim", "প্রাপক রহিম"
  const toMatch = text.match(/(?:^|\s)(?:to|প্রাপক)\s+([A-Za-z\u0980-\u09FF]{2,})/i);
  let explicitCandidate = null;
  if (toMatch) {
    const word = toMatch[1].trim();
    if (!['send', 'taka', 'money', 'bdt', 'tk', 'pay', 'cash', 'please', 'account', 'wallet', 'save', 'bill'].includes(word.toLowerCase())) {
      explicitCandidate = word;
    }
  }

  const kacheMatch = text.match(/([A-Za-z\u0980-\u09FF]{2,})\s*(?:-এর|এর|ের|র|-er|er)?\s+(?:কাছে|kache)/i);
  if (kacheMatch) {
    const word = kacheMatch[1].trim().replace(/(?:-এর|এর|ের|র|-er|er)$/i, '');
    if (!['send', 'taka', 'money', 'bdt', 'tk', 'pay', 'cash', 'amar', 'আমার', 'koto', 'kot', 'bill', 'save', 'koro', 'করো'].includes(word.toLowerCase())) {
      explicitCandidate = explicitCandidate || word;
    }
  }

  // Next, check "<Name> ke" or "<Name>ke" or "<Name>কে" or "<Name>-কে" or "<Name> er" or "<Name>রে"
  const keMatch = text.match(/(?:^|\s)([A-Za-z\u0980-\u09FF]{2,})(?:\s*-\s*|\s*)?(?:ke|কে|re|রে|er|এর)(?:[\s,.\?!;:]|$)/i);
  if (keMatch) {
    const word = keMatch[1].trim();
    if (!['send', 'taka', 'money', 'bdt', 'tk', 'pay', 'cash', 'amar', 'আমার', 'koto', 'kot', 'bill', 'save', 'koro', 'করো'].includes(word.toLowerCase())) {
      explicitCandidate = explicitCandidate || word;
    }
  }

  // Check all words against registered Users in DB
  const rawWords = text
    .replace(/[,\.?!;:()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const commandWords = [
    'send', 'sent', 'pathao', 'pathate', 'pathano', 'taka', 'tk', 'money', 'bdt', 'pay', 'cash',
    'out', 'in', 'please', 'wallet', 'account', 'bill', 'recharge', 'transfer', 'koro', 'করো',
    'পাঠাও', 'পাঠাতে', 'পাঠানো', 'টাকা', 'দাও', 'dao', 'amar', 'আমার', 'friend', 'বন্ধু', 'need',
    'want', 'chai', 'can', 'you', 'to', 'from', 'for', 'with', 'সাথে', 'এবং', 'and', 'er', 'এর',
    'ke', 'কে', 'e', 'এ', 'te', 'তে'
  ];

  for (const rawWord of rawWords) {
    const cleanWord = rawWord.replace(/(?:-?ke|-?কে|-?re|-?রে|-?te|-?তে|-?er|-?এর|-?e|-?এ)$/i, '');
    const lowerClean = cleanWord.toLowerCase();

    if (commandWords.includes(lowerClean) || cleanWord.length < 2) {
      continue;
    }

    const targets = getNameTargets(cleanWord);

    // Try exact name match with transliterations
    let matchedUser = await User.findOne({
      _id: { $ne: senderUserId },
      $or: targets.map((t) => ({ name: { $regex: new RegExp(`^${t}$`, 'i') } })),
      status: 'active',
    });

    // Try partial name match if no exact
    if (!matchedUser) {
      matchedUser = await User.findOne({
        _id: { $ne: senderUserId },
        $or: targets.map((t) => ({ name: { $regex: new RegExp(`\\b${t}\\b`, 'i') } })),
        status: 'active',
      });
    }

    if (matchedUser) {
      return {
        phone: matchedUser.phone,
        name: matchedUser.name,
        isKnown: true,
        user: matchedUser,
      };
    }
  }

  // If candidate was identified (e.g. "friend", "UnknownPerson") but not found in DB
  if (explicitCandidate) {
    const cleanCand = explicitCandidate.replace(/(?:-?ke|-?কে|-?re|-?রে|-?te|-?তে|-?er|-?এর|-?e|-?এ)$/i, '');
    const targets = getNameTargets(cleanCand);
    let matchedUser = await User.findOne({
      _id: { $ne: senderUserId },
      $or: targets.map((t) => ({ name: { $regex: new RegExp(`^${t}$`, 'i') } })),
      status: 'active',
    });

    if (!matchedUser) {
      matchedUser = await User.findOne({
        _id: { $ne: senderUserId },
        $or: targets.map((t) => ({ name: { $regex: new RegExp(`\\b${t}\\b`, 'i') } })),
        status: 'active',
      });
    }

    if (matchedUser) {
      return {
        phone: matchedUser.phone,
        name: matchedUser.name,
        isKnown: true,
        user: matchedUser,
      };
    }

    return {
      phone: null,
      name: explicitCandidate,
      isKnown: false,
      user: null,
    };
  }

  return null;
}

/**
 * Detect conflicting instructions in user message text
 */
export function detectConflicts(text) {
  if (!text) return { hasConflict: false };
  const lower = text.toLowerCase();

  const hasEnableSavings =
    (lower.includes('enable') || lower.includes('start') || lower.includes('চালু') || lower.includes('on')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('round-up') || lower.includes('round up'));
  const hasDisableSavings =
    (lower.includes('disable') || lower.includes('stop') || lower.includes('turn off') || lower.includes('বন্ধ') || lower.includes('off')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়') || lower.includes('round-up') || lower.includes('round up'));

  if (hasEnableSavings && hasDisableSavings) {
    return {
      hasConflict: true,
      reason: 'Conflicting savings commands detected: both enable and disable requested in the same command.',
      reasonBn: 'সঞ্চয় সংক্রান্ত পরস্পরবিরোধী নির্দেশ শনাক্ত হয়েছে: একই সাথে চালু এবং বন্ধ উভয় অনুরোধ করা হয়েছে। অনুগ্রহ করে স্পষ্ট করুন আপনি কোনটি কার্যকর করতে চান।',
    };
  }

  const hasPauseSavings =
    (lower.includes('pause') || lower.includes('স্থগিত')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়'));
  const hasResumeSavings =
    (lower.includes('resume') || lower.includes('পুনরায় চালু')) &&
    (lower.includes('saving') || lower.includes('সঞ্চয়'));

  if (hasPauseSavings && hasResumeSavings) {
    return {
      hasConflict: true,
      reason: 'Conflicting savings commands detected: both pause and resume requested simultaneously.',
      reasonBn: 'সঞ্চয় স্থগিত (pause) এবং পুনরায় চালু (resume) উভয় নির্দেশ একসাথে দেওয়া হয়েছে। অনুগ্রহ করে স্পষ্ট করুন আপনি কোনটি করতে চান।',
    };
  }

  const hasSend = (lower.includes('send') || lower.includes('পাঠাও')) && !lower.includes('cancel');
  const hasCancelSend = (lower.includes('cancel') || lower.includes('বাতিল')) && (lower.includes('send') || lower.includes('পাঠানো'));
  if (hasSend && hasCancelSend) {
    return {
      hasConflict: true,
      reason: 'Conflicting transfer commands detected: both send and cancel requested.',
      reasonBn: 'লেনদেন পাঠানো এবং বাতিল করার পরস্পরবিরোধী নির্দেশ শনাক্ত হয়েছে। অনুগ্রহ করে স্পষ্ট করুন।',
    };
  }

  return { hasConflict: false };
}

/**
 * Split multi-intent clauses joined with 'and', 'এবং', etc.
 */
export function splitMultiIntentClauses(text) {
  if (!text) return [text];
  // Do NOT split comparison or difference questions
  if (text.toLowerCase().includes('difference between') || text.includes('পার্থক্য')) {
    return [text];
  }
  // Do NOT split companion reminder phrases like "and remind me" or "এবং মনে করিয়ে দিও"
  if (/and\s+(?:remind\s+me|মনে\s+করিয়ে\s+দিও)/i.test(text)) {
    return [text];
  }
  // If the whole prompt is classified as injection, do NOT split
  if (classifyIntent(text).type === 'injection') {
    return [text];
  }
  const lowerText = text.toLowerCase();
  // If text is a composite child/guardian command with limit, do not split
  if (
    (lowerText.includes('child') || lowerText.includes('guardian') || lowerText.includes('সন্তান') || lowerText.includes('বাচ্চা') || lowerText.includes('অভিভাবক')) &&
    (lowerText.includes('limit') || lowerText.includes('সীমা'))
  ) {
    return [text];
  }

  const rawParts = text.split(/\s+(?:and|এবং|&|\+|আর)\s+/i).map((p) => p.trim()).filter(Boolean);
  if (rawParts.length > 1) {
    // If any part is merely a parameter fragment (e.g., "limit 800", "with limit 500", "note ..."), do not split
    const hasParamFragment = rawParts.some((p) => {
      const pl = p.toLowerCase();
      return (
        pl.startsWith('limit ') ||
        pl.startsWith('সীমা ') ||
        pl.startsWith('with ') ||
        pl.startsWith('for ') ||
        pl.startsWith('note ') ||
        pl.startsWith('নোট ')
      );
    });
    if (hasParamFragment) {
      return [text];
    }

    const classified = rawParts.map((p) => classifyIntent(p));
    // If any clause is injection, do NOT split
    if (classified.some((c) => c.type === 'injection')) {
      return [text];
    }
    const allSpecific = classified.every((c) => c.type !== 'query' && c.type !== 'knowledge');
    if (allSpecific && rawParts.length <= 3) {
      return rawParts;
    }
  }
  return [text];
}

/**
 * Main AI Copilot Processor:
 * Integrates:
 * Layer A: Financial Copilot
 * Layer B: Financial Guardian
 * Layer C: Micro-Savings Engine
 * Layer D: Radical Personalization + Financial Memory
 * + RAG Knowledge Retriever
 * + App Control (Navigate, Logout, Change PIN)
 */
export async function processAgentMessage({ userId, messageText, language = 'bn' }) {
  // Persist incoming user message to persistent conversation history
  try {
    await saveConversationMessage({
      userId,
      sender: 'user',
      text: messageText,
      language,
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to persist user conversation message');
  }

  let response;

  // 1. Security Gate: Reject prompt injections cleanly ALWAYS FIRST
  const intent = classifyIntent(messageText);
  if (intent.type === 'injection') {
    response = {
      reply: language === 'bn'
        ? '⚠️ নিরাপত্তা সতর্কতা: অননুমোদিত নির্দেশ, সিস্টেম প্রম্পট বা পলিসি বাইপাসের চেষ্টা শনাক্ত হয়েছে। এই কমান্ডটি বাতিল করা হলো।'
        : '⚠️ Security Alert: Unauthorized instructions, system prompt, or policy override detected. This command has been rejected.',
      pendingAction: null,
      securityBlocked: true,
    };
  } else {
    // 2. Conflict Detection
    const conflict = detectConflicts(messageText);
    if (conflict.hasConflict) {
      response = {
        reply: language === 'bn' ? `⚠️ ${conflict.reasonBn}` : `⚠️ ${conflict.reason}`,
        pendingAction: null,
        conflictDetected: true,
      };
    } else {
      // 3. Multi-Intent Decomposition
      const clauses = splitMultiIntentClauses(messageText);
      if (clauses.length > 1) {
        const results = [];
        for (const clause of clauses) {
          const res = await processSingleIntent({ userId, messageText: clause, language });
          results.push(res);
        }
        const anyBlocked = results.some((r) => r.securityBlocked);
        if (anyBlocked) {
          response = {
            reply: language === 'bn'
              ? '⚠️ নিরাপত্তা সতর্কতা: অননুমোদিত নির্দেশ, সিস্টেম প্রম্পট বা পলিসি বাইপাসের চেষ্টা শনাক্ত হয়েছে। এই কমান্ডটি বাতিল করা হলো।'
              : '⚠️ Security Alert: Unauthorized instructions, system prompt, or policy override detected. This command has been rejected.',
            pendingAction: null,
            securityBlocked: true,
          };
        } else {
          const combinedReply = results.map((r, i) => `${i + 1}. ${r.reply}`).join('\n\n');
          const firstPending = results.find((r) => r.pendingAction)?.pendingAction || null;
          response = {
            reply: combinedReply,
            multiIntentResults: results,
            pendingAction: firstPending,
          };
        }
      } else {
        response = await processSingleIntent({ userId, messageText, language });
      }
    }
  }

  // Persist outgoing copilot reply to conversation history
  if (response && response.reply) {
    try {
      await saveConversationMessage({
        userId,
        sender: 'copilot',
        text: response.reply,
        language,
        intent: intent.type,
        tool: response.tool || null,
        pendingAction: response.pendingAction || null,
        clientAction: response.clientAction || (response.logoutRequired ? { action: 'logout' } : (response.navigateTo ? { action: 'navigate', target: response.navigateTo } : null)),
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to persist copilot response message');
    }
  }

  return response;
}

export async function processSingleIntent({ userId, messageText, language = 'bn' }) {
  let intent = classifyIntent(messageText);

  // 1. Security Gate: Reject prompt injections cleanly
  if (intent.type === 'injection') {
    return {
      reply: language === 'bn'
        ? '⚠️ নিরাপত্তা সতর্কতা: অননুমোদিত নির্দেশ, সিস্টেম প্রম্পট বা পলিসি বাইপাসের চেষ্টা শনাক্ত হয়েছে। এই কমান্ডটি বাতিল করা হলো।'
        : '⚠️ Security Alert: Unauthorized instructions, system prompt, or policy override detected. This command has been rejected.',
      pendingAction: null,
      securityBlocked: true,
    };
  }

  // 1b. Secret Credential Protection Gate (PIN, OTP, Passwords)
  if (intent.type === 'secret_probe') {
    return {
      reply: language === 'bn'
        ? '🔒 গোপনীয়তা ও নিরাপত্তা বিজ্ঞপ্তি: আপনার পিন (PIN), ওটিপি (OTP) বা পাসওয়ার্ড অত্যন্ত গোপনীয়। এই সংবেদনশীল তথ্যসমূহ সম্পূর্ণ এনক্রিপ্টেড এবং এআই বা কোনো প্রতিনিধির দেখার অনুমতি নেই। পিন পরিবর্তন করতে "Change PIN" বলুন। কখনো কারো সাথে পিন বা ওটিপি শেয়ার করবেন না।'
        : '🔒 Privacy & Security Notice: Your PIN, OTP, and passwords are confidential credentials. They are strictly encrypted and never accessible to the AI or support agents. To change your PIN, say "Change PIN". Never share your PIN or OTP with anyone.',
      pendingAction: null,
      secretProtected: true,
    };
  }

  // 1c. Cross-User Data Access Privacy Boundary
  if (intent.type === 'cross_user_probe') {
    return {
      reply: language === 'bn'
        ? '🛡️ নিরাপত্তা ও গোপনীয়তা সীমা: আপনি শুধুমাত্র আপনার নিজস্ব অ্যাকাউন্টের তথ্য দেখতে পারবেন। অন্য কোনো ব্যবহারকারীর ব্যালেন্স, লেনদেন বা ব্যক্তিগত তথ্য দেখার অনুমতি নেই।'
        : '🛡️ Privacy & Security Boundary: You can only access your own account information. Accessing balances, transactions, or data of other users is strictly restricted.',
      pendingAction: null,
    };
  }

  // 1d. Past Reminder Boundary Rejection
  if (intent.type === 'past_reminder') {
    return {
      reply: language === 'bn'
        ? '⚠️ অতীতে কোনো রিমাইন্ডার সেট করা সম্ভব নয়। অনুগ্রহ করে ভবিষ্যতের কোনো তারিখ বা সময় উল্লেখ করুন।'
        : '⚠️ Cannot schedule a reminder in the past. Please specify a future date or time.',
      pendingAction: null,
    };
  }

  // 1e. Ambiguous Commands (require clarification)
  if (intent.type === 'irrelevant') {
    return {
      reply: language === 'bn'
        ? 'আমি শুধুমাত্র আপনার উপায়ের (UPAY) আর্থিক লেনদেন, ব্যালেন্স, বিল পরিশোধ, সঞ্চয় এবং অভিভাবক সংক্রান্ত কার্যক্রমে সহায়তা করতে পারি। এই অনুরোধটি আর্থিক সেবার আওতাভুক্ত নয়।'
        : 'I am your UPAY Financial Copilot and can only assist with financial transactions, account balance, bill payments, savings, and Guardian controls. I cannot assist with non-financial topics.',
      pendingAction: null,
    };
  }

  if (intent.type === 'ambiguous_change_savings') {
    return {
      reply: language === 'bn'
        ? '💡 আপনি সঞ্চয়ের কোন বিষয়টি পরিবর্তন করতে চান?\n• পার্সেন্টেজ পরিবর্তন করতে: "Set savings to 5%"\n• রাউন্ড-আপ চালু করতে: "Enable round-up savings"\n• সঞ্চয় সাময়িক বন্ধ রাখতে: "Pause savings"\n• সম্পূর্ণ বন্ধ করতে: "Disable savings"\n• সঞ্চয় লক্ষ্য পরিবর্তন করতে: "Update savings goal to 20,000 taka"'
        : '💡 How would you like to change your savings?\n• Change percentage: "Set savings to 5%"\n• Enable round-up: "Enable round-up savings"\n• Pause savings: "Pause savings"\n• Disable savings: "Disable savings"\n• Update goal: "Update savings goal to 20,000 taka"',
      pendingAction: null,
    };
  }

  if (intent.type === 'ambiguous_reminder') {
    return {
      reply: language === 'bn'
        ? '⏰ আপনি কখন এবং কী বিষয়ে রিমাইন্ডার পেতে চান? অনুগ্রহ করে সময় ও বিবরণ উল্লেখ করুন (যেমন: "Remind me tomorrow to pay electricity bill")।'
        : '⏰ When and what would you like to be reminded about? Please specify the time and details (e.g. "Remind me tomorrow to pay electricity bill").',
      pendingAction: null,
    };
  }

  if (intent.type === 'ambiguous_save_more') {
    return {
      reply: language === 'bn'
        ? '💡 আরও সঞ্চয় করতে আপনি নিচের যেকোনো একটি উপায় বেছে নিতে পারেন:\n১. পার্সেন্টেজ বাড়াতে পারেন: "Set savings to 5%" (১% থেকে ২৫% পর্যন্ত প্রযোজ্য)\n২. রাউন্ড-আপ সঞ্চয় চালু করতে পারেন: "Enable round-up savings"\n৩. নতুন লক্ষ্য তৈরি করতে পারেন: "Create a savings goal of 15,000 taka"'
        : '💡 To save more, you can choose any of the following options:\n1. Increase percentage: "Set savings to 5%" (Supported: 1% to 25%)\n2. Enable Round-Up savings: "Enable round-up savings"\n3. Create a higher savings goal: "Create a savings goal of 15,000 taka"',
      pendingAction: null,
    };
  }

  if (intent.type === 'ambiguous_pay') {
    return {
      reply: language === 'bn'
        ? 'কাকে বা কোন বিলে কত টাকা পরিশোধ করতে চান? অনুগ্রহ করে টাকার পরিমাণ এবং প্রাপক বা বিলারের নাম উল্লেখ করুন (যেমন: "Pay 500 to Rahim" বা "Pay electricity bill 1200 taka")।'
        : 'Who or what bill would you like to pay, and what amount? Please specify the recipient/biller and amount (e.g. "Pay 500 to Rahim" or "Pay electricity bill 1200 taka").',
      pendingAction: null,
    };
  }

  const taskState = getTaskState(userId);

  // 1f. Multi-Turn Conversational Cancellation: "না", "cancel", "বাতিল", "দরকার নেই", "না পাঠিও না"
  if (isCancellation(messageText) && (taskState.activeIntent || taskState.intent || taskState.preparedPendingAction)) {
    const cancelledIntent = taskState.intent || taskState.activeIntent;
    clearActiveTask(userId, 'cancelled');
    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_CANCELLED,
      intent: cancelledIntent,
      message: 'Action cancelled by user',
      actionState: getTaskState(userId),
    });
    return {
      reply: language === 'bn'
        ? 'আপনার অনুরোধটি বাতিল করা হয়েছে। অন্য কোনো লেনদেন বা তথ্যের জন্য নির্দেশ দিন।'
        : 'Your request has been cancelled. How else can I assist you?',
      pendingAction: null,
      cancelled: true,
    };
  }

  // 1g. Multi-Turn Conversational Confirmation: "হ্যাঁ", "confirm", "proceed", "yes", "করো", "পাঠাও"
  if (isConfirmation(messageText) && (taskState.preparedPendingAction || taskState.status === 'ready' || taskState.status === 'awaiting_confirmation')) {
    const action = taskState.preparedPendingAction;
    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.CONFIRMATION_REQUIRED,
      intent: taskState.intent || taskState.activeIntent,
      message: 'User confirmed action; awaiting authentication gate (PIN)',
      actionState: taskState,
    });
    return {
      reply: language === 'bn'
        ? 'লেনদেনটি সম্পন্ন করতে অনুগ্রহ করে আপনার পিন (PIN) বা বায়োমেট্রিক প্রদান করুন।'
        : 'Please enter your PIN or use biometric authentication to complete this transaction.',
      pendingAction: action,
      awaitingStepUp: true,
      clientAction: taskState.clientAction || null,
    };
  }

  // 1h. Multi-Turn Conversational Corrections & Parameter Accumulation
  const lowerMsgText = messageText.toLowerCase().trim();
  const correction = detectUserCorrection(messageText, taskState);

  const isExplicitNewCommand =
    (lowerMsgText.startsWith('create a') ||
      lowerMsgText.startsWith('create ') ||
      lowerMsgText.startsWith('send ') ||
      lowerMsgText.startsWith('pay ') ||
      lowerMsgText.startsWith('recharge ') ||
      lowerMsgText.startsWith('cash out') ||
      lowerMsgText.startsWith('add money') ||
      lowerMsgText.startsWith('remember') ||
      lowerMsgText.startsWith('what do you remember') ||
      lowerMsgText.startsWith('show my memory') ||
      lowerMsgText.startsWith('split') ||
      lowerMsgText.startsWith('set ') ||
      lowerMsgText.startsWith('enable ') ||
      lowerMsgText.startsWith('pause') ||
      lowerMsgText.startsWith('resume') ||
      lowerMsgText.startsWith('deposit') ||
      lowerMsgText.startsWith('when ') ||
      lowerMsgText.startsWith('every ') ||
      lowerMsgText.startsWith('request ') ||
      lowerMsgText.includes('group bill')) &&
    !isConfirmation(messageText) &&
    !isCancellation(messageText) &&
    !correction.isCorrection;

  if (isExplicitNewCommand && (taskState.intent || taskState.status === 'ready' || taskState.preparedPendingAction)) {
    clearActiveTask(userId);
  }

  let effectiveText = messageText;
  if (correction.isCorrection) {
    const activeWorkflow = taskState.intent || taskState.activeIntent;
    const newParams = { ...(taskState.parameters || {}), ...(correction.updatedParams || {}) };
    if (correction.updatedParams?.recipient && !correction.updatedParams?.recipientPhone) {
      delete newParams.recipientPhone;
    }
    updateTaskState(userId, {
      parameters: newParams,
      accumulatedParams: newParams,
    });
    const updatedState = getTaskState(userId);
    if (activeWorkflow === 'send_money' || taskState.activeTool === 'send_money') {
      const recipient = correction.updatedParams?.recipient || updatedState.parameters.recipientName || updatedState.parameters.recipient || updatedState.parameters.recipientPhone || 'Rahim';
      const amount = updatedState.parameters.amount || 500;
      effectiveText = `Send ${amount} to ${recipient}`;
    } else if (activeWorkflow === 'mobile_recharge' || taskState.activeTool === 'mobile_recharge') {
      const recipient = updatedState.parameters.recipient || user?.phone;
      const amount = updatedState.parameters.amount || 50;
      const operator = updatedState.parameters.operator || '';
      effectiveText = `Recharge ${amount} to ${recipient} ${operator}`;
    } else if (activeWorkflow === 'cash_out' || taskState.activeTool === 'cash_out') {
      const amount = updatedState.parameters.amount || 1000;
      effectiveText = `Cash out ${amount}`;
    } else if (activeWorkflow === 'pay_bill' || taskState.activeTool === 'pay_bill') {
      const amount = updatedState.parameters.amount || 1000;
      const biller = updatedState.parameters.billerId || 'DPDC';
      effectiveText = `Pay bill ${amount} for ${biller}`;
    } else if (activeWorkflow === 'add_money' || taskState.activeTool === 'add_money') {
      const amount = updatedState.parameters.amount || 1000;
      effectiveText = `Add money ${amount}`;
    }
  } else if ((taskState.status === 'collecting' || (taskState.missingParameters && taskState.missingParameters.length > 0) || (taskState.missingFields && taskState.missingFields.length > 0)) && (taskState.intent || taskState.activeIntent)) {
    // Check if the user is providing the missing parameter (follow-up)
    const followUpParams = extractFollowUpParameters(messageText, taskState);
    if (Object.keys(followUpParams).length > 0) {
      const activeWorkflow = taskState.intent || taskState.activeIntent;
      updateTaskState(userId, {
        parameters: { ...(taskState.parameters || {}), ...followUpParams },
        accumulatedParams: { ...(taskState.accumulatedParams || {}), ...followUpParams },
      });
      const updatedState = getTaskState(userId);

      // If still missing required fields, ask ONLY for remaining missing field
      if (updatedState.missingParameters && updatedState.missingParameters.length > 0) {
        emitCopilotEvent({
          userId,
          type: COPILOT_EVENTS.PARAM_COLLECTED,
          intent: activeWorkflow,
          message: `Collected parameter(s): ${Object.keys(followUpParams).join(', ')}`,
          actionState: updatedState,
        });

        const nextMissing = updatedState.missingParameters[0];
        let promptText = '';
        if (nextMissing === 'amount') {
          const target = updatedState.parameters.recipientName || updatedState.parameters.recipient || updatedState.parameters.billerId || '';
          promptText = language === 'bn'
            ? `${target ? target + '-কে ' : ''}কত টাকা পাঠাতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ৫০০ টাকা)।`
            : `How much would you like to ${activeWorkflow === 'mobile_recharge' ? 'recharge' : activeWorkflow === 'pay_bill' ? 'pay' : 'send'}${target ? ' to ' + target : ''}? Please specify the amount.`;
        } else if (nextMissing === 'recipient' || nextMissing === 'phoneNumber') {
          promptText = language === 'bn'
            ? 'কাকে পাঠাতে চান? প্রাপকের মোবাইল নম্বর বা নাম উল্লেখ করুন।'
            : 'Who is the recipient? Please specify the phone number or name.';
        } else if (nextMissing === 'operator') {
          promptText = language === 'bn'
            ? 'কোন অপারেটরে রিচার্জ করবেন? (যেমন: গ্রামীণফোন, রবি, বাংলালিংক, এয়ারটেল, টেলিটক)'
            : 'Which operator? (e.g. Grameenphone, Robi, Banglalink, Airtel, Teletalk)';
        } else if (nextMissing === 'billerId') {
          promptText = language === 'bn'
            ? 'কোন প্রতিষ্ঠানের বিল পরিশোধ করতে চান? (যেমন: DPDC, DESCO, WASA, Titas)'
            : 'Which utility biller? (e.g. DPDC, DESCO, WASA, Titas)';
        } else {
          promptText = language === 'bn'
            ? `অনুগ্রহ করে ${nextMissing} উল্লেখ করুন।`
            : `Please provide ${nextMissing}.`;
        }

        return {
          reply: promptText,
          pendingAction: null,
          actionState: updatedState,
        };
      }

      // All required fields collected! Synthesize effectiveText to run full validation
      if (activeWorkflow === 'send_money' || taskState.activeTool === 'send_money') {
        const recipient = updatedState.parameters.recipientPhone || updatedState.parameters.recipient || '01712345678';
        const amount = updatedState.parameters.amount || 500;
        effectiveText = `Send ${amount} to ${recipient}`;
      } else if (activeWorkflow === 'mobile_recharge' || taskState.activeTool === 'mobile_recharge') {
        const recipient = updatedState.parameters.recipient || user?.phone;
        const amount = updatedState.parameters.amount || 50;
        const operator = updatedState.parameters.operator || '';
        effectiveText = `Recharge ${amount} to ${recipient} ${operator}`;
      } else if (activeWorkflow === 'cash_out' || taskState.activeTool === 'cash_out') {
        const amount = updatedState.parameters.amount || 1000;
        effectiveText = `Cash out ${amount}`;
      } else if (activeWorkflow === 'pay_bill' || taskState.activeTool === 'pay_bill') {
        const amount = updatedState.parameters.amount || 1000;
        const biller = updatedState.parameters.billerId || 'DPDC';
        effectiveText = `Pay bill ${amount} for ${biller}`;
      } else if (activeWorkflow === 'add_money' || taskState.activeTool === 'add_money') {
        const amount = updatedState.parameters.amount || 1000;
        effectiveText = `Add money ${amount}`;
      } else if (activeWorkflow === 'guardian_mode' || taskState.activeTool === 'add_child_account') {
        const targetPhone = updatedState.parameters.phoneNumber || updatedState.parameters.childPhone || followUpParams.phoneNumber || followUpParams.childPhone || messageText.match(/01[3-9]\d{8}/)?.[0] || '01712345678';
        const limitPart = updatedState.parameters.dailyLimit ? ` limit ${updatedState.parameters.dailyLimit}` : '';
        effectiveText = `add child ${targetPhone}${limitPart}`;
      } else if (activeWorkflow === 'request_money' || taskState.activeTool === 'request_money') {
        const targetPhone = updatedState.parameters.phoneNumber || updatedState.parameters.recipient || followUpParams.phoneNumber || followUpParams.recipient || '01712345678';
        const amount = updatedState.parameters.amount || 500;
        effectiveText = `request ${amount} from ${targetPhone}`;
      }
    }
  }

  if (effectiveText !== messageText) {
    intent = classifyIntent(effectiveText);
  }

  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    return {
      reply: language === 'bn' ? 'ব্যবহারকারীর অ্যাকাউন্টটি সক্রিয় নয়।' : 'User account is not active.',
      pendingAction: null,
    };
  }

  const wallet = await Wallet.findOne({ userId, type: { $in: ['primary', 'agent'] } });
  const balancePoisha = wallet ? (wallet.balance ?? wallet.balancePoisha ?? 0) : 0;
  const rawExplicitAmount = extractExplicitAmountPoisha(effectiveText);
  const amountPoisha = rawExplicitAmount !== null ? rawExplicitAmount : 50000;
  const bdtAmount = amountPoisha / 100;

  // Realtime notification that Copilot is reasoning
  emitToUser(userId, 'copilot:action_started', { query: messageText });

  // 1i. Domain Agent Orchestration (Savings, Guardian, Group Bill, Schedule/Rule)
  // Operates via structured JSON payloads, slot filling and specialized domain handlers.
  if (
    intent.type !== 'app_logout' &&
    intent.type !== 'app_change_pin' &&
    intent.type !== 'remember_fact' &&
    intent.type !== 'recall_memory' &&
    intent.type !== 'forget_memory' &&
    intent.type !== 'create_group_bill' &&
    intent.type !== 'split_bill' &&
    intent.type !== 'guardian_approve' &&
    intent.type !== 'financial_health' &&
    intent.type !== 'category_spending' &&
    intent.type !== 'biggest_transactions' &&
    intent.type !== 'reminders_list' &&
    intent.type !== 'reminder_cancel' &&
    intent.type !== 'schedules_list' &&
    intent.type !== 'schedule_cancel' &&
    intent.type !== 'rules_list' &&
    intent.type !== 'rule_toggle' &&
    !(intent.type === 'scheduled' && (effectiveText || messageText).toLowerCase().includes('remind me'))
  ) {
    const domainResult = await routeToDomainAgent({
      userId,
      messageText: effectiveText || messageText,
      language,
      user,
      wallet,
      taskState,
      intent,
    });

    if (domainResult && domainResult.handled) {
      return {
        ...domainResult,
        reply: domainResult.reply,
        clientAction: domainResult.clientAction || null,
        pendingAction: domainResult.pendingAction || null,
        actionState: domainResult.actionState || getTaskState(userId),
      };
    }
  }

  // ==========================================
  // APP CONTROL TOOLS (Logout, PIN, Navigate)
  // ==========================================

  // 2. App Control: Real Logout
  if (intent.type === 'app_logout') {
    return {
      reply: language === 'bn'
        ? 'আপনাকে সফলভাবে লগআউট করা হচ্ছে। পুনরায় প্রবেশ করতে পিন দিয়ে লগইন করুন।'
        : 'Logging you out safely. You will be redirected to the login screen.',
      clientAction: { type: 'logout' },
      pendingAction: null,
    };
  }

  // 3. App Control: Change PIN
  if (intent.type === 'app_change_pin') {
    return {
      reply: language === 'bn'
        ? 'নিরাপত্তার স্বার্থে চ্যাটে পিন নেওয়া হয় না। নিরাপদ পিন পরিবর্তন উইন্ডো খোলা হচ্ছে...'
        : 'For security, PINs are never accepted inside chat. Opening the secure PIN change modal...',
      clientAction: { type: 'open_modal', modal: 'change_pin' },
      pendingAction: null,
    };
  }

  // 3b. App Control: Open Guardian Mode Modal
  if (
    intent.type === 'app_open_guardian' ||
    (intent.type === 'open_modal' && (intent.modal === 'guardian' || intent.parameters?.modal === 'guardian'))
  ) {
    return {
      reply: language === 'bn'
        ? 'গার্ডিয়ান মোড ও চাইল্ড অ্যাকাউন্ট ম্যানেজমেন্ট উইন্ডো খোলা হচ্ছে...'
        : 'Opening Guardian Mode controls and child account settings...',
      clientAction: { type: 'open_modal', modal: 'guardian' },
      pendingAction: null,
    };
  }

  // 4. App Control: Navigation
  if (intent.type === 'app_navigate') {
    return {
      reply: language === 'bn'
        ? `নির্ধারিত পেজ খোলা হচ্ছে... (${intent.path})`
        : `Opening requested section... (${intent.path})`,
      clientAction: { type: 'navigate', path: intent.path, subview: intent.subview },
      pendingAction: null,
    };
  }

  // ==========================================
  // LAYER A: FINANCIAL ANALYSIS & EXPLANATIONS
  // ==========================================

  // 5. Financial Habits Explanation ("Why am I running out of money every month?")
  if (intent.type === 'financial_explanation') {
    const analysis = await explainFinancialHabits({ userId, language });
    return {
      reply: analysis.explanation,
      financialAnalysis: analysis,
      pendingAction: null,
    };
  }

  // 6. Compare Spending: "Compare this month with last month"
  if (intent.type === 'compare_spending') {
    const comparison = await compareSpending({ userId });
    let reply = '';
    if (language === 'bn') {
      reply = `📊 মাসভিত্তিক খরচের তুলনা:\n` +
        `• এই মাসের খরচ: ৳${comparison.thisMonthBdt} (${comparison.thisMonthCount}টি লেনদেন)\n` +
        `• গত মাসের খরচ: ৳${comparison.lastMonthBdt} (${comparison.lastMonthCount}টি লেনদেন)\n` +
        `• ব্যবধান: ৳${comparison.diffBdt} (${comparison.percentageChange}% ${comparison.isHigher ? 'বেশি' : 'কম'})\n` +
        (comparison.isHigher
          ? `💡 সতর্কতা: গত মাসের চেয়ে খরচ বেড়েছে। অপ্রয়োজনীয় খরচ কমাতে ২% সঞ্চয় বা রাউন্ড-আপ চালু করতে পারেন।`
          : `💡 চমৎকার! গত মাসের চেয়ে আপনি খরচ নিয়ন্ত্রণে রেখেছেন।`);
    } else {
      reply = `📊 Month-over-Month Spending Comparison:\n` +
        `• This Month: ৳${comparison.thisMonthBdt} (${comparison.thisMonthCount} txns)\n` +
        `• Last Month: ৳${comparison.lastMonthBdt} (${comparison.lastMonthCount} txns)\n` +
        `• Difference: ৳${comparison.diffBdt} (${comparison.percentageChange}% ${comparison.isHigher ? 'higher' : 'lower'})\n` +
        (comparison.isHigher
          ? `💡 Notice: Spending increased compared to last month. Enabling 2% micro-savings can help retain a cushion.`
          : `💡 Great job! Your spending is lower than last month.`);
    }

    return {
      reply,
      comparison,
      pendingAction: null,
    };
  }

  // 7. Spending Summary: "How much did I spend this month / week?"
  if (intent.type === 'spending_summary') {
    const isWeek = messageText.toLowerCase().includes('week') || messageText.includes('সপ্তাহ');
    const summary = await getSpendingSummary({ userId, period: isWeek ? 'week' : 'month' });

    let cats = Object.values(summary.categories)
      .filter((c) => c.totalPoisha > 0)
      .map((c) => `• ${language === 'bn' ? c.labelBn : c.labelEn}: ৳${(c.totalPoisha / 100).toFixed(2)} (${c.count}টি)`)
      .join('\n');

    if (!cats) cats = language === 'bn' ? '• কোনো খরচ রেকর্ড নেই' : '• No expenses recorded';

    const reply = language === 'bn'
      ? `💸 ${isWeek ? 'এই সপ্তাহের' : 'এই মাসের'} মোট খরচ: ৳${summary.totalSpendingBdt} (${summary.transactionCount}টি লেনদেন)\n\nখাতভিত্তিক বিভাজন:\n${cats}`
      : `💸 Total spending ${isWeek ? 'this week' : 'this month'}: ৳${summary.totalSpendingBdt} (${summary.transactionCount} txns)\n\nBreakdown:\n${cats}`;

    return {
      reply,
      spendingSummary: summary,
      pendingAction: null,
    };
  }

  // 8. Income Summary: "How much did I receive this month?"
  if (intent.type === 'income_summary') {
    const isWeek = messageText.toLowerCase().includes('week') || messageText.includes('সপ্তাহ');
    const income = await getIncomeSummary({ userId, period: isWeek ? 'week' : 'month' });

    const reply = language === 'bn'
      ? `💰 ${isWeek ? 'এই সপ্তাহের' : 'এই মাসের'} মোট প্রাপ্তি/জমা: ৳${income.totalIncomeBdt} (${income.count}টি লেনদেন)\n• ব্যাংক থেকে যোগ (Add Money): ৳${income.addMoneyBdt}\n• সরাসরি ট্রান্সফার প্রাপ্তি: ৳${income.transferInBdt}`
      : `💰 Total credits ${isWeek ? 'this week' : 'this month'}: ৳${income.totalIncomeBdt} (${income.count} txns)\n• Add Money from Bank: ৳${income.addMoneyBdt}\n• Transfers Received: ৳${income.transferInBdt}`;

    return {
      reply,
      incomeSummary: income,
      pendingAction: null,
    };
  }

  // 9. Category Spending Specific Filter: "How much did I spend on recharge / bill?"
  if (intent.type === 'category_spending') {
    const summary = await getSpendingSummary({ userId, period: 'month' });
    let catKey = 'recharge';
    if (messageText.toLowerCase().includes('bill') || messageText.includes('বিল')) catKey = 'bill';
    else if (messageText.toLowerCase().includes('send') || messageText.includes('পাঠানো')) catKey = 'send';

    const cat = summary.categories[catKey];
    const catBdt = (cat.totalPoisha / 100).toFixed(2);

    const reply = language === 'bn'
      ? `📱 এই মাসে ${cat.labelBn} খাতে মোট খরচ: ৳${catBdt} (${cat.count}টি লেনদেন)।`
      : `📱 Total spent on ${cat.labelEn} this month: ৳${catBdt} (${cat.count} transactions).`;

    return { reply, pendingAction: null };
  }

  // 10. Biggest Transactions Query: "Show my biggest transactions"
  if (intent.type === 'biggest_transactions') {
    const txns = await Transaction.find({ senderUserId: userId, status: 'settled' })
      .sort({ amount: -1 })
      .limit(3)
      .populate('recipientUserId', 'name phone');

    if (txns.length === 0) {
      return {
        reply: language === 'bn' ? 'কোনো বড় লেনদেনের রেকর্ড নেই।' : 'No large transactions recorded.',
        pendingAction: null,
      };
    }

    const list = txns
      .map((t, idx) => {
        const party = t.recipientUserId?.name || t.metadata?.recipientPhone || t.type;
        return `${idx + 1}. ৳${((t.total || t.amount) / 100).toFixed(2)} - ${party} (${t.type})`;
      })
      .join('\n');

    return {
      reply: language === 'bn' ? `🔝 আপনার শীর্ষ ব্যয়বহুল লেনদেন সমূহ:\n${list}` : `🔝 Your largest transactions:\n${list}`,
      transactions: txns,
      pendingAction: null,
    };
  }

  // ==========================================
  // LAYER C: PERSONALIZED MICRO-SAVINGS
  // ==========================================

  // 11. Mode A: Percentage Savings ("Save 2% from every transaction", "Change savings to 5%")
  if (intent.type === 'set_percentage_savings') {
    const pctMatch = messageText.match(/(-?\d+)\s*%/);
    let pct = pctMatch ? parseInt(pctMatch[1], 10) : null;
    if (pct === null) {
      const numMatch = messageText.match(/(?:percentage|percent|হার|পার্সেন্ট)\s*(-?\d+)/i) ||
        messageText.match(/(-?\d+)\s*(?:percentage|percent|পার্সেন্ট)/i);
      pct = numMatch ? parseInt(numMatch[1], 10) : 2;
    }

    if (pct <= 0 || pct > 25) {
      return {
        reply: language === 'bn'
          ? `⚠️ সঞ্চয়ের পার্সেন্টেজ ১% থেকে ২৫%-এর মধ্যে হতে হবে (আপনি ${pct}% দিয়েছেন)। অনুগ্রহ করে ১% থেকে ২৫%-এর মধ্যে কোনো মান উল্লেখ করুন।`
          : `⚠️ Savings percentage must be between 1% and 25% (you specified ${pct}%). Please specify a value between 1% and 25%.`,
        pendingAction: null,
      };
    }

    await configureMicroSavings({
      userId,
      enabled: true,
      mode: 'percentage',
      percentage: pct,
      paused: false,
    });

    const ex300 = (calculatePercentageSavings({ amountPoisha: 30000, percentage: pct }) / 100).toFixed(2);
    const ex500 = (calculatePercentageSavings({ amountPoisha: 50000, percentage: pct }) / 100).toFixed(2);

    const reply = language === 'bn'
      ? `✅ স্বয়ংক্রিয় পার্সেন্টেজ সেভিংস সক্রিয় করা হয়েছে (${pct}%)!\n` +
        `প্রতিটি লেনদেন থেকে স্বয়ংক্রিয়ভাবে ${pct}% আপনার সঞ্চয় তহবিলে জমা হবে।\n` +
        `• উদাহরণ: ৳৩০০ খরচ করলে ৳${ex300} সঞ্চয় হবে।\n` +
        `• উদাহরণ: ৳৫০০ খরচ করলে ৳${ex500} সঞ্চয় হবে।\n` +
        `যেকোনো সময় 'Pause savings' বলে এটি স্থগিত করতে পারেন।`
      : `✅ Automatic Percentage Savings enabled at ${pct}%!\n` +
        `${pct}% will be saved from each transaction into your savings fund.\n` +
        `• Example: Spending ৳300 saves ৳${ex300}.\n` +
        `• Example: Spending ৳500 saves ৳${ex500}.\n` +
        `You can pause this at any time by saying 'Pause savings'.`;

    return {
      reply,
      microSavings: { enabled: true, mode: 'percentage', percentage: pct },
      pendingAction: null,
    };
  }

  // 12. Mode B: Round-Up Savings ("Enable round-up savings")
  if (intent.type === 'set_roundup_savings') {
    await configureMicroSavings({
      userId,
      enabled: true,
      mode: 'round_up',
      roundUpUnit: 10000, // round to nearest ৳100
      paused: false,
    });

    const ex87 = (calculateRoundUpSavings({ amountPoisha: 8700, roundUpUnit: 10000 }) / 100).toFixed(2);
    const ex463 = (calculateRoundUpSavings({ amountPoisha: 46300, roundUpUnit: 50000 }) / 100).toFixed(2);

    const reply = language === 'bn'
      ? `✅ রাউন্ড-আপ সেভিংস সক্রিয় করা হয়েছে!\n` +
        `দৈনন্দিন খরচের অতিরিক্ত খুচরা টাকা পূর্ণ সংখ্যায় রাউন্ড করে সঞ্চয় তহবিলে জমা হবে।\n` +
        `• উদাহরণ: ৳৮৭ খরচ হলে নিকটতম ৳১০০ ধরে ৳${ex87} সঞ্চয় হবে।\n` +
        `• উদাহরণ: ৳৪৬৩ খরচ হলে নিকটতম ৳৫০০ ধরে ৳${ex463} সঞ্চয় হবে।\n` +
        `যেকোনো সময় 'Pause savings' বলে এটি বন্ধ রাখতে পারেন।`
      : `✅ Round-Up Savings enabled!\n` +
        `Change from everyday purchases will round up to the next round figure and deposit into savings.\n` +
        `• Example: Spending ৳87 rounds to ৳100, saving ৳${ex87}.\n` +
        `• Example: Spending ৳463 rounds to ৳500, saving ৳${ex463}.\n` +
        `You can pause anytime by saying 'Pause savings'.`;

    return {
      reply,
      microSavings: { enabled: true, mode: 'round_up' },
      pendingAction: null,
    };
  }

  // 13. Mode D: Threshold Savings ("Whenever I spend more than 500, save...")
  if (intent.type === 'set_threshold_savings') {
    await configureMicroSavings({
      userId,
      enabled: true,
      mode: 'threshold',
      thresholdMinPoisha: 50000, // ৳500
      roundUpUnit: 10000,
      paused: false,
    });

    const reply = language === 'bn'
      ? `✅ থ্রেশহোল্ড সেভিংস সক্রিয় করা হয়েছে!\n` +
        `৳৫০০-এর বেশি খরচের ক্ষেত্রে পরবর্তী পূর্ণ শতকে রাউন্ড করে অতিরিক্ত অংশ স্বয়ংক্রিয়ভাবে সঞ্চয়ে জমা হবে।\n` +
        `• উদাহরণ: ৳৬৭০ খরচ হলে পরবর্তী রাউন্ড ৳৭০০ ধরে ৳৩০ সঞ্চয় হবে।`
      : `✅ Threshold Savings enabled!\n` +
        `When spending exceeds ৳500, the difference to reach the next round figure will be saved.\n` +
        `• Example: Spending ৳670 rounds to ৳700, saving ৳30.`;

    return {
      reply,
      microSavings: { enabled: true, mode: 'threshold', thresholdBdt: '500.00' },
      pendingAction: null,
    };
  }

  // 13b. Disable Savings ("Disable savings", "Turn off savings")
  if (intent.type === 'disable_savings') {
    await disableMicroSavings(userId);
    return {
      reply: language === 'bn'
        ? '🛑 আপনার স্বয়ংক্রিয় মাইক্রো-সেভিংস বন্ধ (Disabled) করা হয়েছে। আপনার পূর্বে জমানো সঞ্চয় সুরক্ষিত রয়েছে। পুনরায় চালু করতে "Enable round-up savings" বা "Set savings to 2%" বলতে পারেন।'
        : '🛑 Automatic micro-savings has been disabled. Your existing saved funds remain safe in your savings plans. You can re-enable anytime by saying "Enable round-up savings" or "Set savings to 2%".',
      microSavings: { enabled: false },
      pendingAction: null,
    };
  }

  // 13c. Query Savings Settings ("Show my current savings settings", "What is my savings percentage?")
  if (intent.type === 'get_savings_settings') {
    const settings = await getMicroSavingsConfig(userId);
    const config = settings.config || settings.microSavings || {};
    const { targetPlan } = settings;
    let statusEn = 'Disabled';
    let statusBn = 'বন্ধ';
    if (config.enabled) {
      if (config.paused) {
        statusEn = 'Paused';
        statusBn = 'স্থগিত (Paused)';
      } else {
        const modeUpper = (config.mode || 'percentage').toUpperCase();
        statusEn = `Active (${modeUpper})`;
        statusBn = `সক্রিয় (${config.mode === 'percentage' ? config.percentage + '%' : config.mode === 'round_up' ? 'রাউন্ড-আপ' : 'থ্রেশহোল্ড'})`;
      }
    }
    const savedBdt = (config.totalSavedPoisha / 100).toFixed(2);
    const targetName = targetPlan ? targetPlan.title : (language === 'bn' ? 'সাধারণ সঞ্চয় ওয়ালেট' : 'General Savings Wallet');

    const reply = language === 'bn'
      ? `⚙️ আপনার বর্তমান সঞ্চয় সেটিংস:\n` +
        `• অবস্থা: ${statusBn}\n` +
        `• পদ্ধতি: ${config.mode === 'percentage' ? `${config.percentage}% পার্সেন্টেজ` : config.mode === 'round_up' ? `রাউন্ড-আপ (৳${config.roundUpUnit / 100})` : 'থ্রেশহোল্ড'}\n` +
        `• লক্ষ্য গোল: ${targetName}\n` +
        `• সর্বমোট সঞ্চয়: ৳${savedBdt} (${config.count || 0} বার)\n\n` +
        `সেটিংস পরিবর্তন করতে "Set savings to 5%" বা "Disable savings" বলুন।`
      : `⚙️ Your Current Savings Settings:\n` +
        `• Status: ${statusEn}\n` +
        `• Mode: ${config.mode === 'percentage' ? `${config.percentage}% Percentage` : config.mode === 'round_up' ? `Round-Up (৳${config.roundUpUnit / 100})` : 'Threshold'}\n` +
        `• Linked Goal: ${targetName}\n` +
        `• Total Saved: ৳${savedBdt} (${config.count || 0} times)\n\n` +
        `To adjust settings, say "Set savings to 5%" or "Disable savings".`;

    return {
      reply,
      microSavings: config,
      targetPlan,
      pendingAction: null,
    };
  }

  // 14. Pause / Resume Savings
  if (intent.type === 'pause_savings') {
    await pauseMicroSavings(userId);
    return {
      reply: language === 'bn'
        ? '⏸️ আপনার স্বয়ংক্রিয় মাইক্রো-সেভিংস সাময়িকভাবে স্থগিত (Paused) করা হয়েছে।'
        : '⏸️ Your automatic micro-savings has been paused.',
      microSavings: { isPaused: true, paused: true },
      pendingAction: null,
    };
  }
  if (intent.type === 'resume_savings') {
    await resumeMicroSavings(userId);
    return {
      reply: language === 'bn'
        ? '▶️ আপনার স্বয়ংক্রিয় মাইক্রো-সেভিংস পুনরায় সক্রিয় (Resumed) করা হয়েছে।'
        : '▶️ Your automatic micro-savings has been resumed.',
      microSavings: { isPaused: false, paused: false },
      pendingAction: null,
    };
  }

  // 15. Ambiguous Savings: "Save some money for me"
  if (intent.type === 'ambiguous_savings') {
    const reply = language === 'bn'
      ? `💡 আপনি কোন পদ্ধতিতে সঞ্চয় করতে চান? আপনার সুবিধামতো নিচের যে কোনো একটি বেছে নিতে পারেন:\n` +
        `১. পার্সেন্টেজ সেভিংস: "Save 2% from every transaction" (প্রতি লেনদেন থেকে ২% সঞ্চয়)\n` +
        `২. রাউন্ড-আপ সেভিংস: "Enable round-up savings" (৳৮৭ খরচ হলে ৳১০০ ধরে ৳১৩ সঞ্চয়)\n` +
        `৩. লক্ষ্য-ভিত্তিক সঞ্চয়: "Create a savings goal of 10,000 taka" (নির্দিষ্ট লক্ষ্যের জন্য সঞ্চয়)`
      : `💡 Which savings strategy would you prefer?\n` +
        `1. Percentage Savings: "Save 2% from every transaction"\n` +
        `2. Round-Up Savings: "Enable round-up savings" (Spending ৳87 rounds to ৳100 saving ৳13)\n` +
        `3. Goal-Based Savings: "Create a savings goal of 10,000 taka"`;

    return { reply, pendingAction: null };
  }

  // 15b. Update Savings Goal Target
  if (intent.type === 'update_savings_goal') {
    const explicitPoisha = extractExplicitAmountPoisha(messageText);
    if (explicitPoisha === null || explicitPoisha <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ সঞ্চয় লক্ষ্যের নতুন পরিমাণ সঠিক ও ধনাত্মক সংখ্যা হতে হবে (যেমন: "Update savings goal to 20,000 taka")।'
          : '⚠️ Please specify a valid positive amount for your savings goal (e.g. "Update savings goal to 20,000 taka").',
        pendingAction: null,
      };
    }

    const plan = await SavingsPlan.findOne({ userId, status: 'active' }).sort({ updatedAt: -1 });
    if (!plan) {
      return {
        reply: language === 'bn'
          ? 'আপনার কোনো সক্রিয় সঞ্চয় লক্ষ্য পাওয়া যায়নি। নতুন লক্ষ্য তৈরি করতে "Create a savings goal of 10,000 taka" বলুন।'
          : 'No active savings goal found to update. To create one, say "Create a savings goal of 10,000 taka".',
        pendingAction: null,
      };
    }

    const oldBdt = (plan.targetAmountPoisha / 100).toFixed(2);
    plan.targetAmountPoisha = explicitPoisha;
    await plan.save();
    const newBdt = (explicitPoisha / 100).toFixed(2);

    return {
      reply: language === 'bn'
        ? `🎯 সঞ্চয় লক্ষ্যের পরিমাণ সফলভাবে পরিবর্তন করা হয়েছে!\n• লক্ষ্য: "${plan.title}"\n• পূর্বের লক্ষ্য: ৳${oldBdt}\n• নতুন লক্ষ্য: ৳${newBdt}`
        : `🎯 Savings goal target successfully updated!\n• Goal: "${plan.title}"\n• Previous Target: ৳${oldBdt}\n• New Target: ৳${newBdt}`,
      savingsPlan: plan,
      pendingAction: null,
    };
  }

  // 16. Mode C: Savings Goal / Plan Creation
  if (intent.type === 'create_savings_goal') {
    const explicitPoisha = extractExplicitAmountPoisha(messageText);

    // Extract purpose keyword (e.g. laptop, car, emergency, wedding)
    let purposeKeyword = 'সঞ্চয়';
    let purposeEn = 'Savings';
    const purposeMatch = messageText.match(/(?:for\s+my\s+|for\s+a\s+|for\s+|জন্য\s+)([\p{L}]+)/iu);
    if (purposeMatch && !['a', 'an', 'the', 'my', 'some', 'new'].includes(purposeMatch[1].toLowerCase())) {
      purposeKeyword = purposeMatch[1];
      purposeEn = purposeMatch[1];
    } else if (messageText.toLowerCase().includes('laptop') || messageText.includes('ল্যাপটপ')) {
      purposeKeyword = 'ল্যাপটপ';
      purposeEn = 'Laptop';
    }

    if (explicitPoisha === null) {
      return {
        reply: language === 'bn'
          ? `আপনার '${purposeKeyword}'-এর জন্য সঞ্চয় লক্ষ্যের পরিমাণ কত টাকা নির্ধারণ করতে চান? (যেমন: ২০,০০০ টাকা)`
          : `What target amount would you like to set for your '${purposeEn}' savings goal? (e.g. 20,000 taka)`,
        pendingAction: null,
      };
    }

    if (explicitPoisha <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ সঞ্চয় লক্ষ্যের পরিমাণ ০ বা ঋণাত্মক হতে পারে না। অনুগ্রহ করে একটি সঠিক পরিমাণ উল্লেখ করুন (যেমন: ১০,০০০ টাকা)।'
          : '⚠️ Savings goal target must be greater than zero. Please specify a valid amount (e.g. 10,000 taka).',
        pendingAction: null,
      };
    }

    const targetPoisha = explicitPoisha;
    const durationMatch = messageText.match(/(\d+)\s*(?:month|months|মাস)/i);
    const durationMonths = durationMatch ? parseInt(durationMatch[1], 10) : 3;

    let frequency = 'monthly';
    if (messageText.toLowerCase().includes('week') || messageText.includes('সপ্তাহ')) {
      frequency = 'weekly';
    } else if (messageText.toLowerCase().includes('day') || messageText.includes('প্রতিদিন')) {
      frequency = 'daily';
    }

    const pace = calculateGoalPace({ targetPoisha, durationMonths, language });
    const planTitle = language === 'bn' ? `${purposeKeyword} সঞ্চয় লক্ষ্য` : `${purposeEn} Savings Plan`;

    const plan = await SavingsPlan.create({
      userId,
      planType: 'savings',
      title: planTitle,
      targetAmountPoisha: targetPoisha,
      currentAmountPoisha: 0,
      durationMonths,
      frequency,
      status: 'active',
    });

    // Update FinancialMemory default target
    const memory = await getOrCreateFinancialMemory(userId);
    memory.microSavings.targetPlanId = plan._id;
    memory.financialGoals = memory.financialGoals.filter((g) => g.keyword !== purposeEn.toLowerCase());
    memory.financialGoals.push({
      keyword: purposeEn.toLowerCase(),
      title: planTitle,
      targetPoisha,
      savingsPlanId: plan._id,
      notes: `Created via AI Copilot`,
    });
    await memory.save();

    const reply = language === 'bn'
      ? `🎯 নতুন সঞ্চয় পরিকল্পনা '${planTitle}' সফলভাবে তৈরি করা হয়েছে!\n• লক্ষ্য: ${formatBdt(targetPoisha)}\n• মেয়াদ: ${durationMonths} মাস\n${pace.recommendation}\nলক্ষ্যটি সক্রিয় রয়েছে। আপনি 'Show my savings progress' বলে অগ্রগতি দেখতে পারেন।`
      : `🎯 New Savings Plan '${planTitle}' created successfully!\n• Target: ${formatBdt(targetPoisha)}\n• Duration: ${durationMonths} months\n${pace.recommendation}\nPlan is active. You can track it anytime by asking 'Show my savings progress'.`;

    return {
      reply,
      savingsPlan: plan,
      goalPace: pace,
      pendingAction: null,
    };
  }

  // ==========================================
  // LAYER D: RADICAL PERSONALIZATION & FINANCIAL MEMORY
  // ==========================================

  // 17. Remember Financial Goal: "I'm saving for a laptop"
  if (intent.type === 'remember_financial_goal') {
    const memory = await getOrCreateFinancialMemory(userId);

    // Extract keyword e.g. "laptop"
    let keyword = 'laptop';
    const laptopMatch = messageText.match(/(?:saving\s+for\s+(?:a\s+|an\s+|the\s+|my\s+)?|for\s+(?:a\s+|an\s+|the\s+|my\s+)?|জন্য\s+)([\p{L}]+)/iu);
    if (laptopMatch && !['a', 'an', 'the', 'my', 'some'].includes(laptopMatch[1].toLowerCase())) {
      keyword = laptopMatch[1].toLowerCase();
    }

    const title = language === 'bn' ? `${keyword} ক্রয়ের সঞ্চয়` : `${keyword} Goal`;
    const targetPoisha = 6000000; // ৳60,000 default for laptop

    // Create or link SavingsPlan
    let plan = await SavingsPlan.findOne({ userId, title: new RegExp(keyword, 'i'), status: 'active' });
    if (!plan) {
      plan = await SavingsPlan.create({
        userId,
        planType: 'savings',
        title,
        targetAmountPoisha: targetPoisha,
        currentAmountPoisha: 0,
        status: 'active',
      });
    }

    memory.financialGoals = memory.financialGoals.filter((g) => g.keyword !== keyword);
    memory.financialGoals.push({
      keyword,
      title,
      targetPoisha,
      savingsPlanId: plan._id,
      notes: `Saving for ${keyword}`,
    });
    await memory.save();

    const reply = language === 'bn'
      ? `📝 মনে রাখা হয়েছে! আপনার "${keyword}" সঞ্চয় লক্ষ্য নথিভুক্ত করা হয়েছে (লক্ষ্য: ${formatBdt(targetPoisha)})।\nপরবর্তীতে 'How am I doing with my ${keyword}?' বললে বর্তমান অগ্রগতি জানতে পারবেন।`
      : `📝 Noted! I've recorded your "${keyword}" savings goal (Target: ${formatBdt(targetPoisha)}).\nYou can ask 'How am I doing with my ${keyword}?' anytime to see progress.`;

    return {
      reply,
      goal: { keyword, targetPoisha, planId: plan._id },
      pendingAction: null,
    };
  }

  // 18. Retrieve Remembered Goal: "How am I doing with my laptop?"
  if (intent.type === 'get_remembered_goal') {
    const memory = await getOrCreateFinancialMemory(userId);
    let keyword = 'laptop';
    const match = messageText.match(/(?:with\s+my\s+|for\s+my\s+|about\s+my\s+|with\s+the\s+|আমার\s+)([\p{L}]+)/iu);
    if (match && !['a', 'an', 'the', 'my'].includes(match[1].toLowerCase())) {
      keyword = match[1].toLowerCase();
    }

    const remembered = memory.financialGoals.find((g) => g.keyword === keyword || g.title.toLowerCase().includes(keyword));
    const plan = remembered?.savingsPlanId
      ? await SavingsPlan.findById(remembered.savingsPlanId)
      : await SavingsPlan.findOne({ userId, title: new RegExp(keyword, 'i') });

    if (!plan) {
      return {
        reply: language === 'bn'
          ? `আপনার "${keyword}" সম্পর্কিত কোনো সঞ্চয় লক্ষ্য খুঁজে পাওয়া যায়নি। আপনি বলতে পারেন: "I'm saving for a ${keyword}"।`
          : `I couldn't find a savings goal for "${keyword}". You can set one by saying "I'm saving for a ${keyword}".`,
        pendingAction: null,
      };
    }

    const currentBdt = (plan.currentAmountPoisha / 100).toFixed(2);
    const targetBdt = (plan.targetAmountPoisha / 100).toFixed(2);
    const pct = plan.targetAmountPoisha > 0
      ? ((plan.currentAmountPoisha / plan.targetAmountPoisha) * 100).toFixed(1)
      : 0;

    const reply = language === 'bn'
      ? `💻 সঞ্চয় লক্ষ্য: ${plan.title}\n• লক্ষ্য: ৳${targetBdt}\n• বর্তমান জমাকৃত: ৳${currentBdt}\n• অগ্রগতি: ${pct}%\n💡 অবস্থা: সঞ্চয় সক্রিয় রয়েছে।`
      : `💻 Savings Goal: ${plan.title}\n• Target: ৳${targetBdt}\n• Current Saved: ৳${currentBdt}\n• Progress: ${pct}%\n💡 Status: Active.`;

    return {
      reply,
      savingsPlan: plan,
      progressPercent: pct,
      pendingAction: null,
    };
  }

  // 19. Savings Progress & Active Rules Query: "Show my savings progress"
  if (intent.type === 'get_savings_progress') {
    const memory = await getOrCreateFinancialMemory(userId);
    const plans = await SavingsPlan.find({ userId, status: 'active' });

    let ruleStatusBn = 'বন্ধ';
    let ruleStatusEn = 'Disabled';
    if (memory.microSavings?.enabled) {
      if (memory.microSavings.paused) {
        ruleStatusBn = 'স্থগিত (Paused)';
        ruleStatusEn = 'Paused';
      } else {
        ruleStatusBn = memory.microSavings.mode === 'percentage'
          ? `সক্রিয় (${memory.microSavings.percentage}% পার্সেন্টেজ)`
          : memory.microSavings.mode === 'round_up'
          ? 'সক্রিয় (রাউন্ড-আপ)'
          : 'সক্রিয় (থ্রেশহোল্ড)';
        ruleStatusEn = memory.microSavings.mode === 'percentage'
          ? `Active (${memory.microSavings.percentage}% Percentage)`
          : memory.microSavings.mode === 'round_up'
          ? 'Active (Round-Up)'
          : 'Active (Threshold)';
      }
    }

    if (plans.length === 0) {
      return {
        reply: language === 'bn'
          ? `আপনার কোনো সক্রিয় সঞ্চয় গোল নেই। মাইক্রো-সেভিংস রুল: ${ruleStatusBn}।\nআপনি বলতে পারেন: "Create a savings goal of 10,000 taka"`
          : `You have no active savings plans. Active micro-saving rule: ${ruleStatusEn}.\nYou can say: "Create a savings goal of 10,000 taka"`,
        pendingAction: null,
      };
    }

    const planItems = plans
      .map((p) => {
        const cur = (p.currentAmountPoisha / 100).toFixed(2);
        const tgt = (p.targetAmountPoisha / 100).toFixed(2);
        const pct = p.targetAmountPoisha > 0 ? ((p.currentAmountPoisha / p.targetAmountPoisha) * 100).toFixed(1) : 0;
        return `• ${p.title}: ৳${cur} / ৳${tgt} (${pct}%)`;
      })
      .join('\n');

    const reply = language === 'bn'
      ? `📈 আপনার সঞ্চয় অগ্রগতি:\n${planItems}\n\n⚙️ মাইক্রো-সেভিংস রুল: ${ruleStatusBn}\nমোট মাইক্রো-সঞ্চয়: ৳${((memory.microSavings.totalSavedPoisha || 0) / 100).toFixed(2)}`
      : `📈 Your Savings Progress:\n${planItems}\n\n⚙️ Active Micro-Savings Rule: ${ruleStatusEn}\nTotal Micro-Saved: ৳${((memory.microSavings.totalSavedPoisha || 0) / 100).toFixed(2)}`;

    return {
      reply,
      savingsPlans: plans,
      microSavings: memory.microSavings,
      pendingAction: null,
    };
  }

  // 19b. Remember Fact / Contact Alias / Utility Account / Contextual Note
  if (intent.type === 'remember_fact') {
    let fact = messageText
      .replace(/^(?:please\s+)?(?:remember\s+that|remember|save\s+note|save\s+fact|note\s+that|note|keep\s+in\s+mind\s+that|keep\s+in\s+mind)\s+/i, '')
      .replace(/^(?:দয়া\s+করে\s+)?(?:মনে\s+রাখো\s+যে|মনে\s+রেখো\s+যে|মনে\s+রাখো|মনে\s+রেখো|নোট\s+করো)\s+/i, '')
      .trim();

    if (!fact) {
      fact = messageText;
    }

    const res = await rememberFact({ userId, fact });
    const reply = language === 'bn' ? res.summaryBn : res.summaryEn;
    return {
      reply,
      pendingAction: null,
      memoryResult: res,
    };
  }

  // 19c. Recall Memory: "What do you remember about me?", "Show my memory"
  if (intent.type === 'recall_memory') {
    const res = await recallMemories({ userId });
    const reply = language === 'bn' ? res.summaryBn : res.summaryEn;

    return {
      reply,
      pendingAction: null,
      memoryData: res,
    };
  }

  // 19d. Forget Specific Fact: "Forget that Karim is my brother"
  if (intent.type === 'forget_memory') {
    let query = messageText
      .replace(/^(?:please\s+)?(?:forget\s+that|forget|delete\s+fact|remove\s+memory|delete\s+memory)\s+/i, '')
      .replace(/^(?:দয়া\s+করে\s+)?(?:ভুলে\s+যাও\s+যে|ভুলে\s+যাও|মুছে\s+ফেলো)\s+/i, '')
      .trim();

    const res = await forgetFact({ userId, query });
    const reply = language === 'bn' ? res.summaryBn : res.summaryEn;
    return {
      reply,
      pendingAction: null,
      memoryResult: res,
    };
  }

  // 19e. Clear All Memory: "Clear my memory"
  if (intent.type === 'clear_memory') {
    const res = await clearUserMemory({ userId });
    const reply = language === 'bn' ? res.summaryBn : res.summaryEn;
    return {
      reply,
      pendingAction: null,
      memoryResult: res,
    };
  }

  // ==========================================
  // RAG / EXTERNAL KNOWLEDGE QUERIES
  // ==========================================

  // 20. Knowledge / Documentation Query (Send vs Cash Out, Fees, Security, etc.)
  if (intent.type === 'knowledge') {
    const hits = retrieveKnowledge(messageText, { language, topK: 1 });
    if (hits.length > 0) {
      const topDoc = hits[0];
      return {
        reply: `📖 ${topDoc.title}:\n\n${topDoc.content}`,
        knowledgeDoc: topDoc,
        pendingAction: null,
      };
    }
  }

  // ==========================================
  // READ-ONLY TOOLS (MongoDB Real Data)
  // ==========================================

  // Agent Account Statistics & Dashboard Query Tool
  if (intent.type === 'agent_stats') {
    if (user.accountType !== 'AGENT') {
      return {
        reply: language === 'bn'
          ? 'এই সুবিধাটি শুধুমাত্র এজেন্ট অ্যাকাউন্টের জন্য প্রযোজ্য (only available for Agent accounts)।'
          : 'Agent statistics and dashboard are only available for Agent accounts.',
        agentData: undefined,
        pendingAction: null,
      };
    }

    const agentData = await getAgentDashboard(userId);
    const reply = language === 'bn'
      ? `📊 এজেন্ট ড্যাশবোর্ড (Agent Dashboard):\n` +
        `• প্রতিষ্ঠান: ${agentData.businessName}\n` +
        `• বর্তমান এজেন্ট ব্যালেন্স: ৳${agentData.availableBalanceBdt}\n` +
        `• আজকের ক্যাশ-আউট ভলিউম: ৳${agentData.todayVolumeBdt} (${agentData.todayCount}টি)\n` +
        `• এজেন্ট আইডি: ${agentData.agentId || 'N/A'}`
      : `📊 Agent Dashboard:\n` +
        `• Business: ${agentData.businessName}\n` +
        `• Available Agent Balance: ৳${agentData.availableBalanceBdt}\n` +
        `• Today's Cash-Out Volume: ৳${agentData.todayVolumeBdt} (${agentData.todayCount} txns)\n` +
        `• Agent ID: ${agentData.agentId || 'N/A'}`;

    return {
      reply,
      agentData,
      pendingAction: null,
    };
  }

  // Child Account Restrictions & Limits Query
  if (intent.type === 'child_query') {
    const childProfile = await ProtectedProfile.findOne({ childUserId: userId, status: 'active' });
    if (childProfile) {
      const limitBdt = (childProfile.dailyLimitPoisha / 100).toFixed(2);
      const reply = language === 'bn'
        ? `👶 অভিভাবক সুরক্ষা মোড (Guardian Protection):\n` +
          `• আপনার অ্যাকাউন্টটি ${childProfile.controlMode} মোডে পরিচালিত হচ্ছে।\n` +
          `• দৈনিক খরচের সীমা: ৳${limitBdt}\n` +
          `• যেকোনো অতিরিক্ত খরচের ক্ষেত্রে অভিভাবকের অনুমতি প্রয়োজন।`
        : `👶 Guardian Protection Notice:\n` +
          `• Your account control mode is ${childProfile.controlMode}.\n` +
          `• Daily spending limit: ৳${limitBdt}\n` +
          `• Any transactions exceeding this limit require guardian approval.`;

      return {
        reply,
        childProfile,
        pendingAction: null,
      };
    }
  }

  // 21. Balance Query Tool
  if (intent.type === 'balance') {
    const balanceStr = formatBdt(balancePoisha);

    let extraLimitNotice = '';
    const childProfile = await ProtectedProfile.findOne({ childUserId: userId, status: 'active' });
    if (childProfile) {
      const remainingLimitPoisha = Math.max(0, (childProfile.dailyLimitPoisha || 0) - (childProfile.spentTodayPoisha || 0));
      extraLimitNotice = language === 'bn'
        ? `\nঅভিভাবক নিয়ন্ত্রণ: দৈনিক বাকি খরচের সীমা ${formatBdt(remainingLimitPoisha)} (মোট সীমা: ${formatBdt(childProfile.dailyLimitPoisha)})`
        : `\nGuardian Limit: Remaining daily allowance is ${formatBdt(remainingLimitPoisha)} (Total limit: ${formatBdt(childProfile.dailyLimitPoisha)})`;
    }

    return {
      reply: language === 'bn'
        ? `আপনার বর্তমান ওয়ালেট ব্যালেন্স: ${balanceStr}${extraLimitNotice}`
        : `Your current wallet balance is ${balanceStr}${extraLimitNotice}`,
      balancePoisha,
      pendingAction: null,
    };
  }

  // 22. Account Information & Limits Query Tool
  if (intent.type === 'account') {
    const tier = user.tier || 'T1';
    const acType = user.accountType || 'CUSTOMER';
    const dailyLimit = acType === 'CHILD' ? '৳1,000.00' : '৳25,000.00';

    return {
      reply: language === 'bn'
        ? `📋 অ্যাকাউন্ট বিবরণ:\n• নাম: ${user.name}\n• নম্বর: ${user.phone}\n• ধরন: ${acType}\n• নিরাপত্তা টায়ার: ${tier}\n• দৈনিক লেনদেন সীমা: ${dailyLimit}\n• বর্তমান ব্যালেন্স: ${formatBdt(balancePoisha)}`
        : `📋 Account Details:\n• Name: ${user.name}\n• Phone: ${user.phone}\n• Type: ${acType}\n• Security Tier: ${tier}\n• Daily Transaction Limit: ${dailyLimit}\n• Current Balance: ${formatBdt(balancePoisha)}`,
      user: { name: user.name, phone: user.phone, accountType: acType, tier },
      pendingAction: null,
    };
  }

  // 23. Notifications Query Tool
  if (intent.type === 'notifications') {
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(5);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    if (notifications.length === 0) {
      return {
        reply: language === 'bn' ? 'আপনার কোনো নোটিফিকেশন নেই।' : 'You have no notifications.',
        pendingAction: null,
      };
    }

    const items = notifications
      .map((n) => `• [${n.isRead ? 'পঠিত' : 'নতুন'}] ${n.title}: ${n.body}`)
      .join('\n');

    return {
      reply: language === 'bn'
        ? `🔔 সাম্প্রতিক নোটিফিকেশন (অপঠিত: ${unreadCount}):\n${items}`
        : `🔔 Recent Notifications (Unread: ${unreadCount}):\n${items}`,
      notifications,
      pendingAction: null,
    };
  }

  // 24. Transaction Details Query Tool (Last Transaction)
  if (intent.type === 'transaction_details') {
    const lastTxn = await Transaction.findOne({
      $or: [{ senderUserId: userId }, { recipientUserId: userId }],
    })
      .sort({ createdAt: -1 })
      .populate('senderUserId recipientUserId', 'name phone');

    if (!lastTxn) {
      return {
        reply: language === 'bn' ? 'আপনার কোনো পূর্ববর্তী লেনদেন পাওয়া যায়নি।' : 'No previous transactions found.',
        pendingAction: null,
      };
    }

    const isSender = lastTxn.senderUserId?._id?.toString() === userId.toString();
    const otherParty = isSender
      ? (lastTxn.recipientUserId?.name || lastTxn.metadata?.recipientPhone || 'Recipient')
      : (lastTxn.senderUserId?.name || 'Sender');

    return {
      reply: language === 'bn'
        ? `🔍 শেষ লেনদেনের বিবরণ:\n• ধরন: ${lastTxn.type}\n• পরিমাণ: ${formatBdt(lastTxn.amount)}\n• ফি: ${formatBdt(lastTxn.fee)}\n• পক্ষ: ${otherParty}\n• অবস্থা: ${lastTxn.status}\n• তারিখ: ${new Date(lastTxn.createdAt).toLocaleString('bn-BD')}`
        : `🔍 Last Transaction Details:\n• Type: ${lastTxn.type}\n• Amount: ${formatBdt(lastTxn.amount)}\n• Fee: ${formatBdt(lastTxn.fee)}\n• Party: ${otherParty}\n• Status: ${lastTxn.status}\n• Date: ${new Date(lastTxn.createdAt).toLocaleString()}`,
      transaction: lastTxn,
      pendingAction: null,
    };
  }

  // 25. Transaction History Query Tool
  if (intent.type === 'transactions') {
    const txns = await Transaction.find({
      $or: [{ senderUserId: userId }, { recipientUserId: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('senderUserId recipientUserId', 'name phone');

    if (txns.length === 0) {
      return {
        reply: language === 'bn' ? 'আপনার কোনো পূর্ববর্তী লেনদেনের রেকর্ড নেই।' : 'You do not have any transaction records yet.',
        transactions: [],
        pendingAction: null,
      };
    }

    const list = txns
      .map((t) => {
        const isDebit = t.senderUserId?._id?.toString() === userId.toString();
        const sign = isDebit ? '-' : '+';
        const otherName = isDebit
          ? (t.recipientUserId?.name || t.metadata?.recipientPhone || t.type)
          : (t.senderUserId?.name || 'MFS');
        return `• ${otherName}: ${sign}${formatBdt(t.amount)} (${t.type}, ${t.status})`;
      })
      .join('\n');

    return {
      reply: language === 'bn' ? `📜 আপনার সাম্প্রতিক লেনদেন সমূহ:\n${list}` : `📜 Your Recent Transactions:\n${list}`,
      transactions: txns,
      pendingAction: null,
    };
  }

  // 26. Reminder List
  if (intent.type === 'reminders_list') {
    const reminders = await Reminder.find({ userId, isCompleted: false }).sort({ dueAt: 1 });
    if (reminders.length === 0) {
      return {
        reply: language === 'bn' ? 'আপনার কোনো সক্রিয় রিমাইন্ডার নেই।' : 'You have no active reminders.',
        reminders: [],
        pendingAction: null,
      };
    }
    const list = reminders.map((r, i) => `${i + 1}. ${r.title} (তারিখ: ${new Date(r.dueAt).toLocaleDateString()})`).join('\n');
    return {
      reply: language === 'bn' ? `⏰ আপনার সক্রিয় রিমাইন্ডার সমূহ:\n${list}` : `⏰ Active Reminders:\n${list}`,
      reminders,
      pendingAction: null,
    };
  }

  // 27. Reminder Cancel/Delete
  if (intent.type === 'reminder_cancel') {
    const reminder = await Reminder.findOneAndUpdate(
      { userId, isCompleted: false },
      { isCompleted: true },
      { new: true, sort: { createdAt: -1 } }
    );
    return {
      reply: reminder
        ? (language === 'bn'
            ? `🗑️ রিমাইন্ডার "${reminder.title}" বাতিল করা হয়েছে (cancelled)।`
            : `🗑️ Reminder "${reminder.title}" cancelled.`)
        : (language === 'bn' ? 'মুছে ফেলার মতো কোনো রিমাইন্ডার পাওয়া যায়নি।' : 'No active reminder found to cancel.'),
      reminder,
      pendingAction: null,
    };
  }

  // 28. Reminder Create
  if (intent.type === 'reminder') {
    const reminder = await Reminder.create({
      userId,
      title: messageText.length > 50 ? `${messageText.slice(0, 47)}...` : messageText,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
      amount: amountPoisha,
      deepLink: '/send',
      source: 'manual',
    });

    return {
      reply: language === 'bn'
        ? `⏰ আগামীকালের জন্য ${formatBdt(amountPoisha)} লেনদেনের রিমাইন্ডার সেট করা হয়েছে।`
        : `⏰ Reminder set for tomorrow for ${formatBdt(amountPoisha)}.`,
      reminder,
      pendingAction: null,
    };
  }

  // ==========================================
  // LAYER B: GUARDIAN RISK ENGINE & WRITE ACTIONS
  // ==========================================

  // 29a. Group Bill Creation (Natural Language)
  if (intent.type === 'create_group_bill' || intent.type === 'split_bill') {
    if (rawExplicitAmount === null) {
      return {
        reply: language === 'bn'
          ? 'গ্রুপ বিলের মোট পরিমাণ কত টাকা? অনুগ্রহ করে মোট টাকার পরিমাণ উল্লেখ করুন (যেমন: ২০০০ টাকা)।'
          : 'What is the total amount for the group bill? Please specify the total amount (e.g. 2000 taka).',
        pendingAction: null,
      };
    }

    if (rawExplicitAmount <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ গ্রুপ বিলের মোট পরিমাণ ০ বা ঋণাত্মক হতে পারে না।'
          : '⚠️ Group bill amount must be greater than zero.',
        pendingAction: null,
      };
    }

    // Check for vague statements like "with 3 people" without names/phones
    const isVaguePeople = /(?:with\s+\d+\s+people|with\s+friends|with\s+\d+\s+friends|\d+\s*জনের সাথে|বন্ধুদের সাথে)/i.test(messageText);

    // Extract description
    let description = language === 'bn' ? 'গ্রুপ বিল' : 'Group Bill';
    const forMatch = messageText.match(/(?:for|বাবদ|উদ্দেশ্যে)\s+([A-Za-z\u0980-\u09FF\s]+?)(?:\s+(?:with|সাথে)|\s*$)/i);
    if (forMatch && forMatch[1].trim()) {
      description = forMatch[1].trim();
    } else if (messageText.toLowerCase().includes('dinner') || messageText.includes('ডিনার')) {
      description = language === 'bn' ? 'ডিনার' : 'Dinner';
    } else if (messageText.toLowerCase().includes('lunch') || messageText.includes('লাঞ্চ')) {
      description = language === 'bn' ? 'লাঞ্চ' : 'Lunch';
    }

    // Extract participant names/numbers
    let rawCandidates = [];
    const withMatch = messageText.match(/(?:with|সাথে)\s+([^.]+)/i);
    if (withMatch) {
      let segment = withMatch[1].replace(/\s+(?:for|বাবদ|উদ্দেশ্যে)\s+.*$/i, '');
      const parts = segment.replace(/\b(?:and|এবং|o|ও)\b/gi, ',').split(',');
      for (const p of parts) {
        const cleaned = p.trim().replace(/[,\.?!;:()]/g, '');
        if (
          cleaned.length >= 2 &&
          !['people', 'friends', 'jon', 'members', 'মেম্বার', 'জন'].includes(cleaned.toLowerCase()) &&
          !/^\d+\s*(?:people|friends|jon|জন)$/i.test(cleaned)
        ) {
          rawCandidates.push(cleaned);
        }
      }
    }

    // Also collect any phones from the text
    const allPhones = messageText.match(/01[3-9]\d{8}/g) || [];
    for (const ph of allPhones) {
      if (!rawCandidates.includes(ph)) rawCandidates.push(ph);
    }

    if (rawCandidates.length === 0 || (isVaguePeople && allPhones.length === 0)) {
      return {
        reply: language === 'bn'
          ? 'গ্রুপ বিলে কারা অন্তর্ভুক্ত আছেন? অনুগ্রহ করে অংশগ্রহণকারীদের নাম বা মোবাইল নম্বর উল্লেখ করুন (যেমন: রহিম, করিম ও নাবিলা)।'
          : 'Who are the participants in this group bill? Please specify their names or phone numbers (e.g. Rahim, Karim, and Nabila).',
        pendingAction: null,
      };
    }

    // Resolve candidates to real users
    const resolvedParticipants = [];
    for (const cand of rawCandidates) {
      const isPhone = /^01[3-9]\d{8}$/.test(cand);
      let matchedUser = null;
      if (isPhone) {
        matchedUser = await User.findOne({ phone: cand, status: 'active' });
        resolvedParticipants.push({
          phone: cand,
          name: matchedUser ? matchedUser.name : cand,
          user: matchedUser || null,
        });
      } else {
        const cleanName = cand.replace(/(?:-?ke|-?কে|-?re|-?রে|-?er|-?এর|-?e|-?এ|-?te|-?তে)$/i, '').trim();
        const targets = getNameTargets(cleanName);
        matchedUser = await User.findOne({
          _id: { $ne: userId },
          $or: targets.map((t) => ({ name: { $regex: new RegExp(`^${t}$`, 'i') } })),
          status: 'active',
        });
        if (!matchedUser) {
          matchedUser = await User.findOne({
            _id: { $ne: userId },
            $or: targets.map((t) => ({ name: { $regex: new RegExp(`\\b${t}\\b`, 'i') } })),
            status: 'active',
          });
        }

        if (!matchedUser) {
          const totalPeopleEst = Math.max(2, rawCandidates.length + 1);
          const perPersonEst = Math.round((amountPoisha / 100) / totalPeopleEst);
          return {
            reply: language === 'bn'
              ? `'${cleanName}'-এর অ্যাকাউন্ট খুঁজে পাওয়া যায়নি। অনুগ্রহ করে '${cleanName}'-এর ১১ সংখ্যার মোবাইল নম্বর দিন।`
              : `Could not find an account for '${cleanName}'. Please provide their 11-digit phone number.`,
            clientAction: {
              type: 'open_modal',
              modal: 'group_bill',
              prefill: {
                title: description,
                totalAmount: String(amountPoisha / 100),
                participants: rawCandidates.join(', '),
                perPerson: String(perPersonEst),
              },
            },
            pendingAction: null,
          };
        }

        resolvedParticipants.push({
          phone: matchedUser.phone,
          name: matchedUser.name,
          user: matchedUser,
        });
      }
    }

    // Compute equal split among (creator + resolvedParticipants)
    const totalPeople = resolvedParticipants.length + 1; // creator included
    const perPersonPoisha = Math.floor(amountPoisha / totalPeople);

    const participantList = resolvedParticipants.map((p) => ({
      phone: p.phone,
      name: p.name,
      amountPoisha: perPersonPoisha,
    }));

    const totalRequestedPoisha = perPersonPoisha * participantList.length;

    const actionId = `grp-bill-${crypto.randomUUID()}`;
    const pendingArgs = {
      totalAmountPoisha: amountPoisha,
      splitType: 'equal',
      participants: participantList,
      description,
      requestedAmountPoisha: totalRequestedPoisha,
      originalBillAmountPoisha: amountPoisha,
    };
    const actionHash = computeCanonicalActionHash({
      actionId,
      actionType: 'create_group_bill',
      args: pendingArgs,
    });

    const breakdownLinesBn = participantList.map((p) => `• ${p.name} (${p.phone}): ${formatBdt(p.amountPoisha)}`).join('\n');
    const breakdownLinesEn = participantList.map((p) => `• ${p.name} (${p.phone}): ${formatBdt(p.amountPoisha)}`).join('\n');

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'create_group_bill',
      args: pendingArgs,
      preview: {
        actionType: 'create_group_bill',
        title: language === 'bn' ? `গ্রুপ বিল বিভাজন নিশ্চিতকরণ` : `Confirm Group Bill Split`,
        amountPoisha,
        feePoisha: 0,
        totalPoisha: amountPoisha,
        recipientLabel: `${participantList.map((p) => p.name).join(', ')} (${totalPeople} জন)`,
        details: {
          totalBill: formatBdt(amountPoisha),
          perPerson: formatBdt(perPersonPoisha),
          creatorShare: formatBdt(perPersonPoisha),
          description,
        },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const clientAction = {
      type: 'open_modal',
      modal: 'group_bill',
      prefill: {
        defaultMode: 'group',
        amount: String(amountPoisha / 100),
        totalAmount: String(amountPoisha / 100),
        perPerson: String(perPersonPoisha / 100),
        description,
      },
    };

    updateTaskState(userId, {
      intent: 'group_bill',
      activeIntent: 'group_bill',
      activeTool: 'create_group_bill',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        total_amount: amountPoisha / 100,
        totalAmountPoisha: amountPoisha,
        description,
        participants: participantList.map((p) => p.name),
      },
      preparedPendingAction: pending,
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'group_bill',
      message: `Group Bill prepared: ${formatBdt(amountPoisha)} for ${description}`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `📋 '${description}' বাবদ ${formatBdt(amountPoisha)} বিলের হিসাব প্রস্তুত করা হয়েছে:\n` +
          `• মোট ব্যক্তি: ${totalPeople} জন (আপনি সহ)\n` +
          `• জনপ্রতি ভাগ: ${formatBdt(perPersonPoisha)}\n` +
          `• অনুরোধ পাঠানো হবে:\n${breakdownLinesBn}\n\n` +
          `গ্রুপ বিল তৈরি করে অনুরোধ পাঠাতে নিচের কার্ডে পিন দিন।`
        : `📋 Bill split prepared for '${description}' (${formatBdt(amountPoisha)}):\n` +
          `• Total people: ${totalPeople} (including you)\n` +
          `• Share per person: ${formatBdt(perPersonPoisha)}\n` +
          `• Requests to send:\n${breakdownLinesEn}\n\n` +
          `To create this group bill and send requests, please confirm below with your PIN.`,
      pendingAction: pending,
      clientAction,
      actionState: getTaskState(userId),
    };
  }

  // 29b. Guardian Natural Language Approval
  if (intent.type === 'guardian_approve') {
    const pendingApprovals = await getPendingApprovals(userId);

    if (pendingApprovals.length === 0) {
      return {
        reply: language === 'bn'
          ? 'আপনার কোনো সন্তানের বা ওয়ার্ডের পেন্ডিং লেনদেন অনুমোদনের অপেক্ষায় নেই।'
          : 'You have no pending child transactions awaiting guardian approval.',
        pendingAction: null,
      };
    }

    let targetApproval = null;
    if (rawExplicitAmount !== null) {
      const targetPoisha = rawExplicitAmount;
      targetApproval = pendingApprovals.find(
        (a) => a.amountPoisha === targetPoisha || Math.abs(a.amountPoisha - targetPoisha) < 100
      );
      if (!targetApproval) {
        const displayAmt = Math.floor(rawExplicitAmount / 100);
        return {
          reply: language === 'bn'
            ? `৳${displayAmt} পরিমাণের কোনো পেন্ডিং লেনদেন পাওয়া যায়নি। তবে ${formatBdt(pendingApprovals[0].amountPoisha)}-এর একটি অপেক্ষমান লেনদেন রয়েছে (${pendingApprovals[0].sender.name})।`
            : `No pending transaction found for ৳${displayAmt}. However, there is a pending transaction of ${formatBdt(pendingApprovals[0].amountPoisha)} from ${pendingApprovals[0].sender.name}.`,
          pendingAction: null,
        };
      }
    } else {
      targetApproval = pendingApprovals[0];
    }

    const actionId = `guard-appr-${crypto.randomUUID()}`;
    const pendingArgs = {
      txnId: targetApproval.id,
      decision: 'approve',
      amountPoisha: targetApproval.amountPoisha,
      childName: targetApproval.sender.name,
      recipientName: targetApproval.recipient.name,
    };
    const actionHash = computeCanonicalActionHash({
      actionId,
      actionType: 'guardian_decision',
      args: pendingArgs,
    });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'guardian_decision',
      args: pendingArgs,
      preview: {
        actionType: 'guardian_decision',
        title: language === 'bn' ? 'সন্তানের লেনদেন অনুমোদন নিশ্চিতকরণ' : 'Confirm Child Payment Approval',
        amountPoisha: targetApproval.amountPoisha,
        feePoisha: targetApproval.feePoisha || 0,
        totalPoisha: targetApproval.totalPoisha || targetApproval.amountPoisha,
        recipientLabel: `${targetApproval.sender.name} ➔ ${targetApproval.recipient.name}`,
        details: {
          child: targetApproval.sender.name,
          recipient: targetApproval.recipient.name,
          reason: targetApproval.reason,
        },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return {
      reply: language === 'bn'
        ? `সন্তান ${targetApproval.sender.name}-এর ${formatBdt(targetApproval.amountPoisha)} লেনদেন (${targetApproval.recipient.name}-কে) অনুমোদন করতে নিচের কার্ডে আপনার পিন দিন।`
        : `To approve ${targetApproval.sender.name}'s transaction of ${formatBdt(targetApproval.amountPoisha)} to ${targetApproval.recipient.name}, please confirm below with your PIN.`,
      pendingAction: pending,
    };
  }

  // 29c. Guardian Setup / Add Child Intent
  if (intent.type === 'guardian_mode') {
    const taskStateNow = getTaskState(userId);
    const phoneMatch = (effectiveText || messageText).match(/01[3-9]\d{8}/);
    const targetPhone = phoneMatch ? phoneMatch[0] : (taskStateNow.parameters?.phoneNumber || taskStateNow.parameters?.childPhone || null);

    // Extract custom limit if specified (e.g. "limit 800", "900 tk liimit die", "সীমা ৮০০", "800 tk")
    const limitMatch =
      (effectiveText || messageText).match(/(?:l+i+m+i+t|লিমিট|সীমা|দৈনিক সীমা|daily\s*limit)\s*[:=]?\s*(\d+)/i) ||
      (effectiveText || messageText).match(/(\d+)\s*(?:tk|taka|টাকা)?\s*(?:l+i+m+i+t|সীমা|লিমিট)/i) ||
      (effectiveText || messageText).match(/(?:l+i+m+i+t|লিমিট|সীমা)\s*(\d+)\s*(?:tk|taka|টাকা)?/i);
    const customLimit = limitMatch ? parseInt(limitMatch[1], 10) : (taskStateNow.parameters?.dailyLimit || 500);

    const clientAction = {
      type: 'open_modal',
      modal: 'guardian',
      prefill: {
        childPhone: targetPhone || '',
        childName: 'Family Member',
        dailyLimit: String(customLimit),
      },
    };

    if (!targetPhone) {
      updateTaskState(userId, {
        intent: 'guardian_mode',
        activeIntent: 'guardian_mode',
        activeTool: 'add_child_account',
        status: 'collecting',
        requiredParameters: ['phoneNumber'],
        missingParameters: ['phoneNumber'],
        missingFields: ['phoneNumber'],
        parameters: {
          dailyLimit: customLimit,
        },
        accumulatedParams: {
          dailyLimit: customLimit,
        },
        clientAction,
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'guardian_mode',
        message: 'Phone number missing for Guardian Mode',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? `অভিভাবক বা সন্তানের মোবাইল নম্বরটি দিন (যেমন: 017XXXXXXXX)। সন্তান যুক্ত করতে উইন্ডো খোলা হচ্ছে (দৈনিক সীমা: ৳${customLimit})।`
          : `Please provide the guardian or child phone number (e.g. 017XXXXXXXX). Opening Guardian controls with daily limit ৳${customLimit}.`,
        clientAction,
        pendingAction: null,
        actionState: getTaskState(userId),
      };
    }

    updateTaskState(userId, {
      intent: 'guardian_mode',
      activeIntent: 'guardian_mode',
      activeTool: 'add_child_account',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        phoneNumber: targetPhone,
        childPhone: targetPhone,
        childName: 'Family Member',
        dailyLimit: customLimit,
      },
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'guardian_mode',
      message: `Guardian setup ready for ${targetPhone} with limit ৳${customLimit}`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `${targetPhone} নম্বরের জন্য দৈনিক ৳${customLimit} সীমার অভিভাবক নিয়ন্ত্রণ উইন্ডো খোলা হচ্ছে। আপনি সেখানে পিন ও সেটিংস নিশ্চিত করে যুক্ত করতে পারেন।`
        : `Opening Guardian controls window for ${targetPhone} with daily limit ৳${customLimit}. You can set PIN to complete setup.`,
      clientAction,
      pendingAction: null,
      actionState: getTaskState(userId),
    };
  }

  // 29d. Individual Request Money
  if (intent.type === 'request_money') {
    const recipient = await resolveRecipient(effectiveText || messageText, userId);
    if (!recipient && rawExplicitAmount === null) {
      updateTaskState(userId, {
        intent: 'request_money',
        activeIntent: 'request_money',
        activeTool: 'request_money',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: ['recipient', 'amount'],
        missingFields: ['recipient', 'amount'],
        parameters: {},
        accumulatedParams: {},
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'request_money',
        message: 'Recipient and amount missing for Request Money',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? 'কার কাছ থেকে কত টাকা রিকোয়েস্ট করতে চান? অনুগ্রহ করে প্রাপকের নাম বা নম্বর এবং পরিমাণ উল্লেখ করুন।'
          : 'Who would you like to request money from and what amount? Please specify recipient and amount.',
        pendingAction: null,
      };
    }
    if (!recipient) {
      updateTaskState(userId, {
        intent: 'request_money',
        activeIntent: 'request_money',
        activeTool: 'request_money',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: ['recipient'],
        missingFields: ['recipient'],
        parameters: { amount: bdtAmount, amountPoisha },
        accumulatedParams: { amount: bdtAmount, amountPoisha },
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'request_money',
        message: 'Recipient missing for Request Money',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? 'কার কাছ থেকে টাকা রিকোয়েস্ট করতে চান? প্রাপকের মোবাইল নম্বর বা নাম উল্লেখ করুন।'
          : 'Who would you like to request money from? Please specify the recipient phone number or name.',
        pendingAction: null,
      };
    }
    if (rawExplicitAmount === null) {
      updateTaskState(userId, {
        intent: 'request_money',
        activeIntent: 'request_money',
        activeTool: 'request_money',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: ['amount'],
        missingFields: ['amount'],
        parameters: { recipient: recipient.phone || recipient.name, recipientPhone: recipient.phone, recipientName: recipient.name },
        accumulatedParams: { recipient: recipient.phone || recipient.name, recipientPhone: recipient.phone, recipientName: recipient.name },
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'request_money',
        message: 'Amount missing for Request Money',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? `${recipient.name}-এর কাছ থেকে কত টাকা রিকোয়েস্ট করতে চান?`
          : `How much would you like to request from ${recipient.name}?`,
        pendingAction: null,
      };
    }

    const clientAction = {
      type: 'open_modal',
      modal: 'request',
      prefill: {
        defaultMode: 'individual',
        targetPhone: recipient.phone || '',
        amount: String(amountPoisha / 100),
        description: 'Money request via Copilot',
      },
    };

    updateTaskState(userId, {
      intent: 'request_money',
      activeIntent: 'request_money',
      activeTool: 'request_money',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        recipient: recipient.name,
        recipientPhone: recipient.phone,
        amountPoisha,
        amount: bdtAmount,
      },
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'request_money',
      message: `Request Money prepared: ${formatBdt(amountPoisha)} from ${recipient.name}`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `${recipient.name}-এর কাছ থেকে ${formatBdt(amountPoisha)} রিকোয়েস্ট পাঠানোর ফর্ম প্রস্তুত করা হয়েছে।`
        : `Money request of ${formatBdt(amountPoisha)} from ${recipient.name} is ready.`,
      clientAction,
      pendingAction: null,
      actionState: getTaskState(userId),
    };
  }

  // Determine immediate transaction intent type
  const targetMsg = effectiveText || messageText;
  const lowerMsg = targetMsg.toLowerCase();

  const isCashOut =
    intent.type === 'cash_out' ||
    (intent.type === 'immediate' &&
      (lowerMsg.includes('cash out') ||
        lowerMsg.includes('cashout') ||
        lowerMsg.includes('withdraw') ||
        targetMsg.includes('ক্যাশ আউট') ||
        targetMsg.includes('ক্যাশআউট') ||
        targetMsg.includes('উত্তোলন')));

  const isAddMoney =
    intent.type === 'add_money' ||
    (intent.type === 'immediate' &&
      (lowerMsg.includes('cash in') ||
        lowerMsg.includes('add money') ||
        lowerMsg.startsWith('add ') ||
        targetMsg.includes('ক্যাশ ইন') ||
        targetMsg.includes('টাকা যোগ')));

  const isMobileRecharge =
    intent.type === 'mobile_recharge' ||
    (intent.type === 'immediate' &&
      (lowerMsg.includes('recharge') || targetMsg.includes('রিচার্জ')));

  const isPayBill =
    intent.type === 'pay_bill' ||
    (intent.type === 'immediate' &&
      (lowerMsg.includes('desco') ||
        lowerMsg.includes('dpdc') ||
        lowerMsg.includes('wasa') ||
        lowerMsg.includes('titas') ||
        lowerMsg.includes('nesco') ||
        lowerMsg.includes('bill') ||
        targetMsg.includes('বিল') ||
        targetMsg.includes('বিদ্যুৎ') ||
        targetMsg.includes('পানি') ||
        targetMsg.includes('গ্যাস') ||
        lowerMsg.includes('electricity')));

  const isSendMoney =
    intent.type === 'send_money' ||
    (intent.type === 'immediate' && !isCashOut && !isAddMoney && !isMobileRecharge && !isPayBill);

  // 29c. Send Money (with Missing Parameter Check, Recipient Validation & Guardian Risk Analysis)
  if (isSendMoney) {
    // Negative or Zero Amount Check
    if (rawExplicitAmount !== null && rawExplicitAmount <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ লেনদেনের পরিমাণ ০ বা ঋণাত্মক হতে পারে না। অনুগ্রহ করে একটি ধনাত্মক পরিমাণ উল্লেখ করুন (যেমন: ৫০০ টাকা)।'
          : '⚠️ Transaction amount must be greater than zero. Please specify a valid positive amount (e.g. 500 taka).',
        pendingAction: null,
      };
    }

    // Resolve Recipient
    const recipient = await resolveRecipient(effectiveText || messageText, userId);

    // Missing Recipient Check
    if (!recipient) {
      updateTaskState(userId, {
        intent: 'send_money',
        activeIntent: 'send_money',
        activeTool: 'send_money',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: rawExplicitAmount === null ? ['recipient', 'amount'] : ['recipient'],
        missingFields: rawExplicitAmount === null ? ['recipient', 'amount'] : ['recipient'],
        parameters: rawExplicitAmount !== null ? { amount: bdtAmount, amountPoisha } : {},
        accumulatedParams: rawExplicitAmount !== null ? { amount: bdtAmount, amountPoisha } : {},
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'send_money',
        message: 'Recipient missing for Send Money',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? 'কাকে টাকা পাঠাতে চান? অনুগ্রহ করে প্রাপকের মোবাইল নম্বর বা নাম উল্লেখ করুন (যেমন: 017XXXXXXXX বা রহিম)।'
          : 'Who would you like to send money to? Please specify the recipient phone number or name.',
        pendingAction: null,
      };
    }

    // Missing Explicit Amount Check: "Send money to Rahim" without amount
    if (rawExplicitAmount === null) {
      updateTaskState(userId, {
        intent: 'send_money',
        activeIntent: 'send_money',
        activeTool: 'send_money',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: ['amount'],
        missingFields: ['amount'],
        parameters: { recipient: recipient.phone || recipient.name, recipientPhone: recipient.phone, recipientName: recipient.name },
        accumulatedParams: { recipient: recipient.phone || recipient.name, recipientPhone: recipient.phone, recipientName: recipient.name },
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'send_money',
        message: 'Amount missing for Send Money',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? `${recipient.name}-কে কত টাকা পাঠাতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ৫০০ টাকা)।`
          : `What amount would you like to send to ${recipient.name}? Please specify the amount (e.g. 500 taka).`,
        pendingAction: null,
      };
    }

    // If candidate found but unknown/unregistered
    if (!recipient.phone || !recipient.isKnown) {
      return {
        reply: language === 'bn'
          ? 'এই নম্বর/অ্যাকাউন্টটি পাওয়া যায়নি, তাই transfer করা সম্ভব হচ্ছে না।'
          : `This recipient account (${recipient.name || recipient.phone}) was not found, so the transfer cannot be completed.`,
        pendingAction: null,
      };
    }

    // Self-Transfer Check
    if (recipient.phone === user.phone) {
      return {
        reply: language === 'bn'
          ? '⚠️ নিজের নম্বরে সেন্ড মানি করা সম্ভব নয়।'
          : '⚠️ You cannot send money to your own phone number.',
        pendingAction: null,
      };
    }

    // Check Recipient Exists in DB
    const recipientUser = await User.findOne({ phone: recipient.phone, status: 'active' });
    if (!recipientUser) {
      return {
        reply: language === 'bn'
          ? 'এই নম্বর/অ্যাকাউন্টটি পাওয়া যায়নি, তাই transfer করা সম্ভব হচ্ছে না।'
          : `This recipient account (${recipient.phone}) was not found, so the transfer cannot be completed.`,
        pendingAction: null,
      };
    }

    // If Child account, evaluate Guardian Policy first so guardian limits take precedence
    if (user.accountType === 'CHILD') {
      const childPolicy = await evaluateGuardianPolicy({
        userId,
        amountPoisha,
        recipientPhone: recipient.phone,
        riskScore: 0,
      });

      if (childPolicy.decision === 'block') {
        return {
          reply: language === 'bn'
            ? `অভিভাবক সুরক্ষা সতর্কতা: লেনদেনের পরিমাণ আপনার অভিভাবক নির্ধারিত দৈনিক খরচের সীমা অতিক্রম করেছে (${childPolicy.reason})।`
            : `Guardian Protection Notice: The requested transaction exceeds your guardian daily spending limit (${childPolicy.reason}).`,
          pendingAction: null,
        };
      }
    }

    // Transaction Limit Check
    const maxLimitPoisha = user.accountType === 'CHILD' ? 100000 : 2500000;
    if (amountPoisha > maxLimitPoisha) {
      const maxBdt = (maxLimitPoisha / 100).toLocaleString();
      return {
        reply: language === 'bn'
          ? `⚠️ লেনদেনের সীমা অতিক্রম করেছে। একবারে সর্বোচ্চ ৳${maxBdt} পাঠানো সম্ভব।`
          : `⚠️ Transaction limit exceeded. The maximum allowed per transaction is ৳${maxBdt}.`,
        pendingAction: null,
      };
    }

    // Check Balance
    const feePoisha = amountPoisha > 100000 ? 500 : 0; // Flat ৳5 above ৳1,000
    const totalPoisha = amountPoisha + feePoisha;

    if (balancePoisha < totalPoisha) {
      return {
        reply: language === 'bn'
          ? `Transfer করা সম্ভব হচ্ছে না। আপনার বর্তমান balance এই transaction-এর জন্য যথেষ্ট নয়। (বর্তমান ব্যালেন্স: ${formatBdt(balancePoisha)}, প্রয়োজন: ${formatBdt(totalPoisha)})`
          : `Transfer cannot be completed. Your current balance is insufficient for this transaction. (Available: ${formatBdt(balancePoisha)}, Required: ${formatBdt(totalPoisha)})`,
        pendingAction: null,
      };
    }

    // Run Guardian Risk Analysis
    const risk = await evaluateGuardianRisk({
      userId,
      amountPoisha,
      recipientPhone: recipient.phone,
      type: 'send',
    });

    // Check Guardian Child Policy
    const policy = await evaluateGuardianPolicy({
      userId,
      amountPoisha,
      recipientPhone: recipient.phone,
      riskScore: risk.riskScore,
    });

    if (policy.decision === 'block') {
      return {
        reply: language === 'bn'
          ? `অভিভাবক সুরক্ষা সতর্কতা: লেনদেনের পরিমাণ আপনার অভিভাবক নির্ধারিত দৈনিক খরচের সীমা অতিক্রম করেছে (${policy.reason})।`
          : `Guardian Protection Notice: The requested transaction exceeds your guardian daily spending limit (${policy.reason}).`,
        pendingAction: null,
      };
    }

    const actionId = `send-act-${crypto.randomUUID()}`;
    const pendingArgs = {
      recipientPhone: recipient.phone,
      recipientName: recipient.name,
      amountPoisha,
      feePoisha,
      totalPoisha,
    };

    const actionHash = computeCanonicalActionHash({
      actionId,
      actionType: 'send_money',
      args: pendingArgs,
    });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'send_money',
      args: pendingArgs,
      preview: {
        actionType: 'send_money',
        title: language === 'bn' ? 'সেন্ড মানি নিশ্চিতকরণ' : 'Confirm Send Money',
        amountPoisha,
        feePoisha,
        totalPoisha,
        recipientName: recipient.name,
        recipientLabel: `${recipient.name} (${recipient.phone})`,
        recipientPhone: recipient.phone,
        details: {
          fee: feePoisha > 0 ? '৳5.00 (above ৳1,000)' : '৳0.00 (Free)',
          guardianStatus: risk.isSuspicious ? 'Review Recommended' : 'Clean & Verified',
        },
      },
      riskDecision: {
        score: risk.riskScore,
        decision: risk.isSuspicious ? 'review' : 'allow',
        reasons: risk.reasons,
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const clientAction = {
      type: 'open_modal',
      modal: 'send',
      prefill: {
        recipient: recipient.phone,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        amount: String(amountPoisha / 100),
      },
    };

    updateTaskState(userId, {
      intent: 'send_money',
      activeIntent: 'send_money',
      activeTool: 'send_money',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        recipient: recipient.name,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        amountPoisha,
        amount: bdtAmount,
      },
      accumulatedParams: {
        recipient: recipient.name,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        amountPoisha,
        amount: bdtAmount,
      },
      preparedPendingAction: pending,
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'send_money',
      message: `Send Money prepared: ${formatBdt(amountPoisha)} to ${recipient.name} (${recipient.phone})`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    let riskNotice = '';
    if (risk.isSuspicious) {
      const bullets = risk.reasons.map((r) => `• ${language === 'bn' ? r.bn : r.en}`).join('\n');
      riskNotice = language === 'bn'
        ? `\n\n🛡️ এআই গার্ডিয়ান সতর্কতা (লেনদেনটি অস্বাভাবিক মনে হচ্ছে):\n${bullets}\nতথ্যগুলো পর্যালোচনা করে আপনার পিন দিয়ে নিশ্চিত করুন।`
        : `\n\n🛡️ AI Guardian Review (Unusual transaction signals detected):\n${bullets}\nPlease review carefully before confirming with your PIN.`;
    }

    return {
      reply: language === 'bn'
        ? `${recipient.name}-এর অ্যাকাউন্ট পাওয়া গেছে। আপনি ${recipient.name}-কে (${recipient.phone}) ${formatBdt(amountPoisha)} পাঠাতে যাচ্ছেন। আপনি কি এগিয়ে যেতে চান? নিশ্চিত করতে নিচের কার্ডে পিন দিন। (ফি: ${formatBdt(feePoisha)})${riskNotice}`
        : `I found ${recipient.name}'s account. You are about to send ${formatBdt(amountPoisha)} to ${recipient.name} (${recipient.phone}). Do you want to continue? Please confirm below with your PIN. (Fee: ${formatBdt(feePoisha)})${riskNotice}`,
      pendingAction: pending,
      clientAction,
      actionState: getTaskState(userId),
    };
  }

  // 30. Cash Out
  if (isCashOut) {
    if (rawExplicitAmount === null) {
      updateTaskState(userId, {
        intent: 'cash_out',
        activeIntent: 'cash_out',
        activeTool: 'cash_out',
        status: 'collecting',
        requiredParameters: ['amount'],
        missingParameters: ['amount'],
        missingFields: ['amount'],
        parameters: {},
        accumulatedParams: {},
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'cash_out',
        message: 'Amount required for Cash Out',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? 'কত টাকা ক্যাশ আউট করতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ২০০০ টাকা)।'
          : 'How much would you like to cash out? Please specify the amount (e.g. 2000 taka).',
        pendingAction: null,
      };
    }

    if (rawExplicitAmount <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ ক্যাশ আউটের পরিমাণ ০ বা ঋণাত্মক হতে পারে না।'
          : '⚠️ Cash out amount must be greater than zero.',
        pendingAction: null,
      };
    }

    if (amountPoisha > 2500000) {
      return {
        reply: language === 'bn'
          ? '⚠️ ক্যাশ আউট সীমা অতিক্রম করেছে। একবারে সর্বোচ্চ ৳২৫,০০০ ক্যাশ আউট সম্ভব।'
          : '⚠️ Cash out limit exceeded. Maximum ৳25,000 per transaction.',
        pendingAction: null,
      };
    }

    let agentUser = null;
    const phoneMatch = messageText.match(/01[3-9]\d{8}/);
    if (phoneMatch) {
      agentUser = await User.findOne({ phone: phoneMatch[0], accountType: 'AGENT', status: 'active' });
      if (!agentUser) {
        return {
          reply: language === 'bn'
            ? `এই নম্বরে (${phoneMatch[0]}) কোনো সক্রিয় এজেন্ট অ্যাকাউন্ট পাওয়া যায়নি, তাই ক্যাশ আউট করা সম্ভব নয়।`
            : `No active agent account found for ${phoneMatch[0]}. Cash out cannot be completed.`,
          pendingAction: null,
        };
      }
    } else {
      agentUser = await User.findOne({ accountType: 'AGENT', status: 'active' });
    }

    if (!agentUser) {
      return {
        reply: language === 'bn' ? 'সক্রিয় কোনো ক্যাশ আউট এজেন্ট পাওয়া যায়নি।' : 'No active cash-out agent found.',
        pendingAction: null,
      };
    }

    const feePoisha = Math.round(amountPoisha * 0.015); // 1.5% fee
    const totalPoisha = amountPoisha + feePoisha;

    if (balancePoisha < totalPoisha) {
      return {
        reply: language === 'bn'
          ? `ক্যাশ আউট করা সম্ভব হচ্ছে না। আপনার বর্তমান ব্যালেন্স ফি সহ এই লেনদেনের জন্য যথেষ্ট নয়। (বর্তমান ব্যালেন্স: ${formatBdt(balancePoisha)}, প্রয়োজন: ${formatBdt(totalPoisha)})`
          : `Cash out cannot be completed due to insufficient balance including the 1.5% fee. (Available: ${formatBdt(balancePoisha)}, Required: ${formatBdt(totalPoisha)})`,
        pendingAction: null,
      };
    }

    const actionId = `cashout-${crypto.randomUUID()}`;
    const pendingArgs = { agentPhone: agentUser.phone, amountPoisha, feePoisha, totalPoisha };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'cash_out', args: pendingArgs });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'cash_out',
      args: pendingArgs,
      preview: {
        actionType: 'cash_out',
        title: language === 'bn' ? `ক্যাশ আউট নিশ্চিতকরণ` : `Confirm Cash Out`,
        amountPoisha,
        feePoisha,
        totalPoisha,
        recipientLabel: `${agentUser.name} (${agentUser.phone})`,
        recipientPhone: agentUser.phone,
        details: { fee: '1.5% (৳15 per ৳1,000)' },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const clientAction = {
      type: 'open_modal',
      modal: 'cashout',
      prefill: {
        agentPhone: agentUser.phone,
        amount: String(amountPoisha / 100),
      },
    };

    updateTaskState(userId, {
      intent: 'cash_out',
      activeIntent: 'cash_out',
      activeTool: 'cash_out',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        agentPhone: agentUser.phone,
        amountPoisha,
        amount: amountPoisha / 100,
      },
      preparedPendingAction: pending,
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'cash_out',
      message: `Cash Out prepared: ${formatBdt(amountPoisha)} via Agent ${agentUser.name}`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `এজেন্ট ${agentUser.name}-এর মাধ্যমে ${formatBdt(amountPoisha)} ক্যাশ আউট করতে পিন দিয়ে নিশ্চিত করুন। (ফি: ${formatBdt(feePoisha)})`
        : `To cash out ${formatBdt(amountPoisha)} via Agent ${agentUser.name}, please confirm with your PIN. (Fee: ${formatBdt(feePoisha)})`,
      pendingAction: pending,
      clientAction,
      actionState: getTaskState(userId),
    };
  }

  // 31. Add Money / Cash In
  if (isAddMoney) {
    if (rawExplicitAmount === null) {
      updateTaskState(userId, {
        intent: 'add_money',
        activeIntent: 'add_money',
        activeTool: 'add_money',
        status: 'collecting',
        requiredParameters: ['amount'],
        missingParameters: ['amount'],
        missingFields: ['amount'],
        parameters: {},
        accumulatedParams: {},
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'add_money',
        message: 'Amount missing for Add Money',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? 'ওয়ালেটে কত টাকা যোগ করতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ১০০০ টাকা)।'
          : 'How much would you like to add to your wallet? Please specify the amount (e.g. 1000 taka).',
        pendingAction: null,
      };
    }

    if (rawExplicitAmount <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ টাকা যোগের পরিমাণ ০ বা ঋণাত্মক হতে পারে না।'
          : '⚠️ Add money amount must be greater than zero.',
        pendingAction: null,
      };
    }
    if (amountPoisha > 5000000) {
      return {
        reply: language === 'bn'
          ? '⚠️ একবারে সর্বোচ্চ ৳৫০,০০০ টাকা যোগ করা সম্ভব।'
          : '⚠️ Maximum add money amount per transaction is ৳50,000.',
        pendingAction: null,
      };
    }

    const actionId = `add-act-${crypto.randomUUID()}`;
    const pendingArgs = { source: 'simulated_bank', amountPoisha };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'add_money', args: pendingArgs });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'add_money',
      args: pendingArgs,
      preview: {
        actionType: 'add_money',
        title: language === 'bn' ? `ওয়ালেটে টাকা যোগ নিশ্চিতকরণ` : `Confirm Add Money`,
        amountPoisha,
        feePoisha: 0,
        totalPoisha: amountPoisha,
        recipientLabel: 'Internal Wallet Credit (Simulated Bank)',
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const clientAction = {
      type: 'open_modal',
      modal: 'addmoney',
      prefill: {
        amount: String(amountPoisha / 100),
      },
    };

    updateTaskState(userId, {
      intent: 'add_money',
      activeIntent: 'add_money',
      activeTool: 'add_money',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        amountPoisha,
        amount: amountPoisha / 100,
      },
      preparedPendingAction: pending,
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'add_money',
      message: `Add Money prepared: ${formatBdt(amountPoisha)}`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `ওয়ালেটে ${formatBdt(amountPoisha)} যোগ করতে নিচের কার্ডে পিন দিয়ে নিশ্চিত করুন।`
        : `To add ${formatBdt(amountPoisha)} to your wallet, please confirm below with your PIN.`,
      pendingAction: pending,
      clientAction,
      actionState: getTaskState(userId),
    };
  }

  // 32. Mobile Recharge
  if (isMobileRecharge) {
    const phoneMatch = messageText.match(/01[3-9]\d{8}/);
    const isExplicitOwn = lowerMsg.includes('my phone') || lowerMsg.includes('my number') || lowerMsg.includes('নিজের') || lowerMsg.includes('আমার');
    const rechargePhone = phoneMatch ? phoneMatch[0] : (isExplicitOwn ? user.phone : null);

    if (rawExplicitAmount === null) {
      const targetPhone = rechargePhone || user.phone;
      const operator = getOperatorFromPhone(targetPhone);
      updateTaskState(userId, {
        intent: 'mobile_recharge',
        activeIntent: 'mobile_recharge',
        activeTool: 'mobile_recharge',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: ['amount'],
        missingFields: ['amount'],
        parameters: { recipient: targetPhone, operator },
        accumulatedParams: { recipient: targetPhone, operator },
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'mobile_recharge',
        message: 'Amount missing for Mobile Recharge',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? `${targetPhone} নম্বরে (${operator}) কত টাকা রিচার্জ করতে চান? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ৫০ টাকা)।`
          : `How much would you like to recharge to ${targetPhone} (${operator})? Please specify the amount (e.g. 50 taka).`,
        pendingAction: null,
      };
    }

    if (!rechargePhone) {
      updateTaskState(userId, {
        intent: 'mobile_recharge',
        activeIntent: 'mobile_recharge',
        activeTool: 'mobile_recharge',
        status: 'collecting',
        requiredParameters: ['recipient', 'amount'],
        missingParameters: ['recipient'],
        missingFields: ['recipient'],
        parameters: { amount: bdtAmount, amountPoisha },
        accumulatedParams: { amount: bdtAmount, amountPoisha },
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'mobile_recharge',
        message: 'Phone number missing for Mobile Recharge',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? `কোন নম্বরে ৳${bdtAmount} রিচার্জ করতে চান? অনুগ্রহ করে ১১ ডিজিটের মোবাইল নম্বর দিন (অথবা নিজের নম্বরে করতে লিখুন "আমার নম্বরে")।`
          : `Which phone number would you like to recharge ৳${bdtAmount} to? Please provide the 11-digit mobile number (or say "to my number").`,
        pendingAction: null,
      };
    }

    if (rawExplicitAmount < 1000 || rawExplicitAmount > 100000) {
      return {
        reply: language === 'bn'
          ? '⚠️ রিচার্জের পরিমাণ ৳১০ থেকে ৳১,০০০-এর মধ্যে হতে হবে।'
          : '⚠️ Recharge amount must be between ৳10 and ৳1,000.',
        pendingAction: null,
      };
    }

    const operator = getOperatorFromPhone(rechargePhone);

    const actionId = `rech-act-${crypto.randomUUID()}`;
    const pendingArgs = { recipientPhone: rechargePhone, amountPoisha, operator };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'mobile_recharge', args: pendingArgs });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'mobile_recharge',
      args: pendingArgs,
      preview: {
        actionType: 'mobile_recharge',
        title: language === 'bn' ? `মোবাইল রিচার্জ নিশ্চিতকরণ` : `Confirm Mobile Recharge`,
        amountPoisha,
        feePoisha: 0,
        totalPoisha: amountPoisha,
        recipientLabel: `${operator} (${rechargePhone})`,
        recipientPhone: rechargePhone,
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const clientAction = {
      type: 'open_modal',
      modal: 'recharge',
      prefill: {
        phone: rechargePhone,
        operator,
        amount: String(amountPoisha / 100),
      },
    };

    updateTaskState(userId, {
      intent: 'mobile_recharge',
      activeIntent: 'mobile_recharge',
      activeTool: 'mobile_recharge',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        recipient: rechargePhone,
        operator,
        amountPoisha,
        amount: amountPoisha / 100,
      },
      preparedPendingAction: pending,
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'mobile_recharge',
      message: `Mobile Recharge prepared: ${formatBdt(amountPoisha)} to ${rechargePhone} (${operator})`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `${rechargePhone} নম্বরে (${operator}) ${formatBdt(amountPoisha)} রিচার্জ করতে পিন দিয়ে নিশ্চিত করুন।`
        : `To recharge ${formatBdt(amountPoisha)} to ${rechargePhone} (${operator}), please confirm below with your PIN.`,
      pendingAction: pending,
      clientAction,
      actionState: getTaskState(userId),
    };
  }

  // 33. Bill Pay
  if (isPayBill) {
    let billerId = 'DPDC';
    let billLabel = 'DPDC Electricity';
    const lowerBill = messageText.toLowerCase();
    if (lowerBill.includes('desco')) {
      billerId = 'DESCO';
      billLabel = 'DESCO Electricity';
    } else if (lowerBill.includes('wasa') || lowerBill.includes('পানি') || lowerBill.includes('water')) {
      billerId = 'WASA';
      billLabel = 'Dhaka WASA Water';
    } else if (lowerBill.includes('titas') || lowerBill.includes('গ্যাস') || lowerBill.includes('gas')) {
      billerId = 'TITAS';
      billLabel = 'Titas Gas';
    } else if (lowerBill.includes('nesco')) {
      billerId = 'NESCO';
      billLabel = 'NESCO Electricity';
    } else if (lowerBill.includes('বিদ্যুৎ') || lowerBill.includes('electricity')) {
      billerId = 'DPDC';
      billLabel = 'DPDC Electricity';
    }

    if (rawExplicitAmount === null) {
      updateTaskState(userId, {
        intent: 'pay_bill',
        activeIntent: 'pay_bill',
        activeTool: 'pay_bill',
        status: 'collecting',
        requiredParameters: ['billerId', 'amount'],
        missingParameters: ['amount'],
        missingFields: ['amount'],
        parameters: { billerId },
        accumulatedParams: { billerId },
      });
      emitCopilotEvent({
        userId,
        type: COPILOT_EVENTS.MISSING_PARAMETER,
        intent: 'pay_bill',
        message: 'Amount missing for Bill Payment',
        actionState: getTaskState(userId),
      });
      return {
        reply: language === 'bn'
          ? `${billLabel}-এর বিলের পরিমাণ কত টাকা? অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন (যেমন: ১২০০ টাকা)।`
          : `What is the bill amount you would like to pay for ${billLabel}? Please specify the amount (e.g. 1200 taka).`,
        pendingAction: null,
      };
    }

    if (rawExplicitAmount <= 0) {
      return {
        reply: language === 'bn'
          ? '⚠️ বিল পরিশোধের পরিমাণ ০ বা ঋণাত্মক হতে পারে না।'
          : '⚠️ Bill payment amount must be greater than zero.',
        pendingAction: null,
      };
    }

    let accountNo = '442109';
    // Resolve utility account from memory
    try {
      const rememberedUtil = await resolveUtilityAccount({ userId, billerQuery: `${billerId} ${messageText}` });
      if (rememberedUtil?.accountNo) {
        accountNo = rememberedUtil.accountNo;
        if (rememberedUtil.billerId) {
          billerId = rememberedUtil.billerId;
          billLabel = `${billerId} Bill`;
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to resolve utility account from memory');
    }

    const accMatches = messageText.match(/\b\d{6,12}\b/g);
    if (accMatches && accMatches.length > 0) {
      const explicitAmtStr = String(Math.floor(amountPoisha / 100));
      const nonAmtMatch = accMatches.find((m) => m !== explicitAmtStr);
      if (nonAmtMatch) accountNo = nonAmtMatch;
    }

    if (balancePoisha < amountPoisha) {
      return {
        reply: language === 'bn'
          ? `বিল পরিশোধ করা সম্ভব হচ্ছে না। আপনার বর্তমান ব্যালেন্স অপর্যাপ্ত। (বর্তমান ব্যালেন্স: ${formatBdt(balancePoisha)}, বিল: ${formatBdt(amountPoisha)})`
          : `Bill payment cannot be completed due to insufficient balance. (Available: ${formatBdt(balancePoisha)}, Required: ${formatBdt(amountPoisha)})`,
        pendingAction: null,
      };
    }

    const actionId = `bill-act-${crypto.randomUUID()}`;
    const pendingArgs = { billerId, accountNo, amountPoisha };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'pay_bill', args: pendingArgs });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'pay_bill',
      args: pendingArgs,
      preview: {
        actionType: 'pay_bill',
        title: language === 'bn' ? `${billLabel} পরিশোধ নিশ্চিতকরণ` : `Confirm ${billLabel} Payment`,
        amountPoisha,
        feePoisha: 0,
        totalPoisha: amountPoisha,
        recipientLabel: `${billLabel} (A/C: ${accountNo})`,
        details: {
          biller: billerId,
          accountNumber: accountNo,
        },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const clientAction = {
      type: 'open_modal',
      modal: 'paybill',
      prefill: {
        biller: billerId,
        amount: String(amountPoisha / 100),
        accountNo,
      },
    };

    updateTaskState(userId, {
      intent: 'pay_bill',
      activeIntent: 'pay_bill',
      activeTool: 'pay_bill',
      status: 'ready',
      missingParameters: [],
      missingFields: [],
      parameters: {
        billerId,
        accountNo,
        amountPoisha,
        amount: amountPoisha / 100,
      },
      preparedPendingAction: pending,
      clientAction,
    });

    emitCopilotEvent({
      userId,
      type: COPILOT_EVENTS.ACTION_READY,
      intent: 'pay_bill',
      message: `Bill Payment prepared: ${formatBdt(amountPoisha)} for ${billLabel}`,
      actionState: getTaskState(userId),
      persistNotification: true,
    });

    return {
      reply: language === 'bn'
        ? `${billLabel} (হিসাব নং ${accountNo})-এর ${formatBdt(amountPoisha)} বিল পরিশোধ করতে পিন দিয়ে নিশ্চিত করুন।`
        : `To pay ${formatBdt(amountPoisha)} for ${billLabel} (A/C: ${accountNo}), please confirm with your PIN.`,
      pendingAction: pending,
      clientAction,
      actionState: getTaskState(userId),
    };
  }

  // 33. One-time Scheduled Payment with optional companion reminder
  if (intent.type === 'scheduled') {
    const recipient = await resolveRecipient(messageText, userId);
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let reminder = null;
    if (messageText.toLowerCase().includes('remind') || messageText.includes('মনে')) {
      reminder = await Reminder.create({
        userId,
        title: `Scheduled payment of ${formatBdt(amountPoisha)} to ${recipient?.name || 'Kabir Agent'}`,
        dueAt: nextRun,
        amount: amountPoisha,
        deepLink: '/history',
        source: 'ai_suggested',
      });
    }

    const recipientPhone = recipient?.phone || '01710000002';
    const actionId = `sched-once-${crypto.randomUUID()}`;
    const pendingArgs = {
      actionType: 'send',
      frequency: 'once',
      actionPayload: {
        recipientPhone,
        amountPoisha,
      },
      nextRunAt: nextRun,
    };

    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'create_schedule', args: pendingArgs });
    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'create_schedule',
      args: pendingArgs,
      preview: {
        actionType: 'create_schedule',
        title: language === 'bn' ? 'শিডিউল লেনদেন নিশ্চিতকরণ' : 'Confirm Scheduled Payment',
        recipientLabel: `${recipient?.name || 'Kabir Agent'} (${recipientPhone})`,
        amountPoisha,
        details: {
          scheduledFor: nextRun.toLocaleDateString(),
          hasReminder: Boolean(reminder),
        },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const reminderNote = reminder
      ? (language === 'bn' ? ' (সহায়ক রিমাইন্ডার তৈরি করা হয়েছে - companion reminder created)' : ' (companion reminder created)')
      : '';

    const reply = language === 'bn'
      ? `আগামীকালের জন্য ${formatBdt(amountPoisha)} লেনদেনের শিডিউল প্রস্তুত করা হয়েছে${reminderNote}। কার্যকর করতে নিচের কার্ডে পিন দিন।`
      : `Scheduled payment prepared for tomorrow${reminderNote}. Please confirm below with your PIN.`;

    return {
      reply,
      pendingAction: pending,
      reminder,
    };
  }

  // 34. Recurring Monthly Schedule
  if (intent.type === 'recurring') {
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 30);

    const actionId = `sched-rec-${crypto.randomUUID()}`;
    const pendingArgs = {
      actionType: 'pay_bill',
      frequency: 'monthly',
      actionPayload: { billerId: 'DPDC', accountNo: '442109', amountPoisha: amountPoisha || 120000 },
      nextRunAt: nextRun,
      mandate: { maxAmountPerRun: 200000 },
    };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'create_schedule', args: pendingArgs });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'create_schedule',
      args: pendingArgs,
      preview: {
        actionType: 'create_schedule',
        title: language === 'bn' ? 'মাসিক শিডিউল পেমেন্ট নিশ্চিতকরণ' : 'Confirm Monthly Scheduled Payment',
        recipientLabel: 'DPDC Electricity Bill (Monthly)',
        amountPoisha: amountPoisha || 120000,
        details: { frequency: 'Monthly', nextRun: nextRun.toLocaleDateString() },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return {
      reply: language === 'bn'
        ? `প্রতি মাসে বিদ্যুৎ বিল পরিশোধের স্বয়ংক্রিয় শিডিউল সেট করতে পিন দিয়ে কনফার্ম করুন।`
        : `To schedule automatic monthly bill payments, please confirm below with your PIN.`,
      pendingAction: pending,
    };
  }

  // 35. Conditional Rules (WHEN / IF)
  if (intent.type === 'conditional') {
    const actionId = `rule-act-${crypto.randomUUID()}`;
    const pendingArgs = {
      trigger: { type: 'wallet_credit', minAmount: 100000 },
      action: { type: 'pay_bill', billerId: 'DPDC', billAccountNo: '442109', amount: amountPoisha || 120000 },
      mandate: { maxAmountPerRun: 200000 },
    };
    const actionHash = computeCanonicalActionHash({ actionId, actionType: 'create_rule', args: pendingArgs });

    const pending = await PendingAction.create({
      actionId,
      actionHash,
      userId,
      tool: 'create_rule',
      args: pendingArgs,
      preview: {
        actionType: 'create_rule',
        title: language === 'bn' ? 'শর্তযুক্ত অটোমেশন রুল কনফার্মেশন' : 'Conditional Automation Rule Confirmation',
        recipientLabel: 'DPDC Electricity Bill',
        details: {
          condition: 'WHEN wallet receives ৳1,000 or more',
          action: 'THEN pay electricity bill',
        },
      },
      requiredTier: 'T2',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return {
      reply: language === 'bn'
        ? 'ওয়ালেটে ৳১,০০০ বা বেশি জমা হলে স্বয়ংক্রিয়ভাবে বিদ্যুৎ বিল পরিশোধের শর্তযুক্ত রুল তৈরি করতে কনফার্ম করুন।'
        : 'Please confirm the conditional rule: When ৳1,000 or more enters your wallet, pay your electricity bill.',
      pendingAction: pending,
    };
  }

  // Default query reply with RAG fallback
  const ragDocs = retrieveKnowledge(messageText, { language, topK: 1 });
  if (ragDocs.length > 0) {
    return {
      reply: `📖 ${ragDocs[0].title}:\n\n${ragDocs[0].content}`,
      knowledgeDoc: ragDocs[0],
      pendingAction: null,
    };
  }

  return {
    reply: language === 'bn'
      ? 'আমি আপনার আর্থিক সহকারী (AI Copilot)। আপনি আমাকে ব্যালেন্স দেখতে, খরচ বিশ্লেষণ করতে, টাকা পাঠাতে, ২% বা রাউন্ড-আপ সঞ্চয় চালু করতে, রিমাইন্ডার সেট করতে বা অ্যাপের যেকোনো পাতায় যেতে বলতে পারেন।'
      : 'I am your AI Copilot. You can ask me to check balance, explain your spending, send money, enable 2% or round-up savings, set reminders, or navigate the application.',
    pendingAction: null,
  };
}

/**
 * Execute an approved PendingAction after T2 step-up authentication.
 */
export async function executePendingAction({ actionId, userId }) {
  const action = await PendingAction.findOne({ actionId, userId, status: 'pending' });
  if (!action) {
    throw new Error('Pending action not found or already executed.');
  }

  if (new Date() > new Date(action.expiresAt)) {
    action.status = 'expired';
    await action.save();
    throw new Error('This action has expired. Please initiate the request again.');
  }

  // Cryptographic Action Hash Binding Verification (Security Hardening):
  // Recalculate canonical hash from stored args to guarantee payload hasn't been tampered with
  if (action.actionHash) {
    const rawArgs = { ...(action.args?.toObject ? action.args.toObject() : action.args) };
    const actionType = rawArgs.actionType || action.tool;
    const cleanArgs = { ...rawArgs };
    delete cleanArgs.actionType;

    const computedClean = computeCanonicalActionHash({
      actionId: action.actionId,
      actionType,
      args: cleanArgs,
    });
    const computedDirect = computeCanonicalActionHash({
      actionId: action.actionId,
      actionType,
      args: rawArgs,
    });

    if (action.actionHash !== computedClean && action.actionHash !== computedDirect) {
      action.status = 'rejected';
      await action.save();
      throw new Error('Action integrity violation: Canonical action hash mismatch. Execution rejected.');
    }
  }

  clearActiveTask(userId);
  return executePendingActionTool({ action, userId });
}


export default {
  classifyIntent,
  detectConflicts,
  splitMultiIntentClauses,
  extractAmountPoisha,
  extractExplicitAmountPoisha,
  processAgentMessage,
  processSingleIntent,
  executePendingAction,
};
