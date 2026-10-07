/**
 * @file toolRegistry.js
 * Central Declarative Tool Registry for Guardian MFS AI Copilot.
 * Defines schemas, required/optional parameters, confirmation policies,
 * risk levels, authentication tiers, and reversible status.
 */

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const TOOL_CATEGORIES = {
  ACCOUNT: 'account',
  WALLET: 'wallet',
  MONEY_TRANSFER: 'money_transfer',
  CASH_SERVICES: 'cash_services',
  MOBILE_RECHARGE: 'mobile_recharge',
  BILL_PAYMENT: 'bill_payment',
  SAVINGS: 'savings',
  GROUP_BILL: 'group_bill',
  AUTOMATION: 'automation',
  GUARDIAN: 'guardian',
  FINANCIAL_COPILOT: 'financial_copilot',
  KNOWLEDGE: 'knowledge',
  MEMORY: 'memory',
};

/**
 * Registry of all available tools across the application.
 */
export const TOOL_REGISTRY = {
  // ==========================================
  // WALLET & BALANCE
  // ==========================================
  check_balance: {
    name: 'check_balance',
    description: 'Check available and total wallet balance in BDT.',
    category: TOOL_CATEGORIES.WALLET,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  transaction_history: {
    name: 'transaction_history',
    description: 'View recent transactions, money transfers, bills, and recharges.',
    category: TOOL_CATEGORIES.WALLET,
    required_parameters: [],
    optional_parameters: ['limit', 'type'],
    parameter_types: { limit: 'number', type: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  transaction_details: {
    name: 'transaction_details',
    description: 'Get in-depth breakdown and receipt information of the most recent or specified transaction.',
    category: TOOL_CATEGORIES.WALLET,
    required_parameters: [],
    optional_parameters: ['txnId'],
    parameter_types: { txnId: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  // ==========================================
  // MONEY TRANSFER & CASH SERVICES
  // ==========================================
  send_money: {
    name: 'send_money',
    description: 'Transfer money to a verified recipient mobile number or contact.',
    category: TOOL_CATEGORIES.MONEY_TRANSFER,
    required_parameters: ['recipient', 'amount'],
    optional_parameters: ['note'],
    parameter_types: { recipient: 'string', amount: 'number', note: 'string' },
    confirmation_required: true,
    authentication_required: true, // Step-up PIN / WebAuthn
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  request_money: {
    name: 'request_money',
    description: 'Request money from a contact or mobile number.',
    category: TOOL_CATEGORIES.MONEY_TRANSFER,
    required_parameters: ['recipient', 'amount'],
    optional_parameters: ['note'],
    parameter_types: { recipient: 'string', amount: 'number', note: 'string' },
    confirmation_required: true,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  cash_out: {
    name: 'cash_out',
    description: 'Withdraw physical cash via an authorized agent with 1.5% fee.',
    category: TOOL_CATEGORIES.CASH_SERVICES,
    required_parameters: ['amount'],
    optional_parameters: ['agentPhone', 'agentIdentifier'],
    parameter_types: { amount: 'number', agentPhone: 'string', agentIdentifier: 'string' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  add_money: {
    name: 'add_money',
    description: 'Deposit money into wallet from simulated bank or linked card.',
    category: TOOL_CATEGORIES.CASH_SERVICES,
    required_parameters: ['amount'],
    optional_parameters: ['source'],
    parameter_types: { amount: 'number', source: 'string' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  mobile_recharge: {
    name: 'mobile_recharge',
    description: 'Recharge mobile balance for Grameenphone, Banglalink, Robi, Airtel, or Teletalk.',
    category: TOOL_CATEGORIES.MOBILE_RECHARGE,
    required_parameters: ['recipient', 'amount'],
    optional_parameters: ['operator'],
    parameter_types: { recipient: 'string', amount: 'number', operator: 'string' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  pay_bill: {
    name: 'pay_bill',
    description: 'Pay utility bills (DPDC, DESCO, Titas Gas, WASA, Internet).',
    category: TOOL_CATEGORIES.BILL_PAYMENT,
    required_parameters: ['billerId', 'amount'],
    optional_parameters: ['accountNo'],
    parameter_types: { billerId: 'string', amount: 'number', accountNo: 'string' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  // ==========================================
  // GROUP BILL / SPLIT BILL
  // ==========================================
  create_group_bill: {
    name: 'create_group_bill',
    description: 'Create a split bill among multiple participants (equal, custom, or percentage split).',
    category: TOOL_CATEGORIES.GROUP_BILL,
    required_parameters: ['participants', 'total_amount', 'split_method'],
    optional_parameters: ['description', 'custom_shares', 'percentages'],
    parameter_types: {
      participants: 'array',
      total_amount: 'number',
      split_method: 'string', // 'equal' | 'custom' | 'percentage'
      description: 'string',
      custom_shares: 'object',
      percentages: 'object',
    },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  get_group_bill_status: {
    name: 'get_group_bill_status',
    description: 'Check settlement status of active group bills: who paid and who still owes.',
    category: TOOL_CATEGORIES.GROUP_BILL,
    required_parameters: [],
    optional_parameters: ['billId'],
    parameter_types: { billId: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  remind_group_member: {
    name: 'remind_group_member',
    description: 'Send a payment reminder notification to a group bill participant who has not paid.',
    category: TOOL_CATEGORIES.GROUP_BILL,
    required_parameters: ['participant'],
    optional_parameters: ['billId'],
    parameter_types: { participant: 'string', billId: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: true,
  },

  settle_group_bill: {
    name: 'settle_group_bill',
    description: 'Pay your pending share for a group bill request.',
    category: TOOL_CATEGORIES.GROUP_BILL,
    required_parameters: ['billId'],
    optional_parameters: ['amount'],
    parameter_types: { billId: 'string', amount: 'number' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  cancel_group_bill: {
    name: 'cancel_group_bill',
    description: 'Cancel an unsettled group bill created by you.',
    category: TOOL_CATEGORIES.GROUP_BILL,
    required_parameters: ['billId'],
    optional_parameters: [],
    parameter_types: { billId: 'string' },
    confirmation_required: true,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  // ==========================================
  // SAVINGS & MICRO-SAVINGS
  // ==========================================
  create_savings_goal: {
    name: 'create_savings_goal',
    description: 'Create a target savings plan (e.g. for wedding, laptop, emergency fund).',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: ['name', 'target_amount'],
    optional_parameters: ['target_months', 'frequency', 'deposit_amount'],
    parameter_types: {
      name: 'string',
      target_amount: 'number',
      target_months: 'number',
      frequency: 'string',
      deposit_amount: 'number',
    },
    confirmation_required: true,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  list_savings_goals: {
    name: 'list_savings_goals',
    description: 'List user active savings goals, progress, and accumulated balances.',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  update_savings_goal: {
    name: 'update_savings_goal',
    description: 'Update the target amount or timeline of an existing savings goal.',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: ['target_amount'],
    optional_parameters: ['goalId', 'name'],
    parameter_types: { target_amount: 'number', goalId: 'string', name: 'string' },
    confirmation_required: true,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  configure_micro_savings: {
    name: 'configure_micro_savings',
    description: 'Configure auto-save rules (percentage save, round-up save, or threshold save).',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: [],
    optional_parameters: ['percentage', 'roundUpEnabled', 'thresholdAmount', 'saveAmount'],
    parameter_types: {
      percentage: 'number',
      roundUpEnabled: 'boolean',
      thresholdAmount: 'number',
      saveAmount: 'number',
    },
    confirmation_required: true,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  pause_micro_savings: {
    name: 'pause_micro_savings',
    description: 'Temporarily pause automatic micro-savings.',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  resume_micro_savings: {
    name: 'resume_micro_savings',
    description: 'Resume automatic micro-savings.',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  disable_micro_savings: {
    name: 'disable_micro_savings',
    description: 'Turn off micro-savings rules completely.',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  get_savings_settings: {
    name: 'get_savings_settings',
    description: 'Check active micro-savings rules, percentages, and memory goals.',
    category: TOOL_CATEGORIES.SAVINGS,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  // ==========================================
  // AUTOMATION (SCHEDULES & RULES & REMINDERS)
  // ==========================================
  create_schedule: {
    name: 'create_schedule',
    description: 'Create a scheduled or recurring payment (daily, weekly, monthly, or on specific date).',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: ['actionType', 'frequency', 'amount'],
    optional_parameters: ['recipient', 'billerId', 'nextRunAt'],
    parameter_types: {
      actionType: 'string', // 'send' | 'pay_bill'
      frequency: 'string', // 'once' | 'daily' | 'weekly' | 'monthly'
      amount: 'number',
      recipient: 'string',
      billerId: 'string',
      nextRunAt: 'string',
    },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  list_schedules: {
    name: 'list_schedules',
    description: 'List user active scheduled and recurring payments.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  cancel_schedule: {
    name: 'cancel_schedule',
    description: 'Cancel an active scheduled payment.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: ['scheduleId'],
    optional_parameters: [],
    parameter_types: { scheduleId: 'string' },
    confirmation_required: true,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: false,
  },

  create_rule: {
    name: 'create_rule',
    description: 'Create a conditional automation rule (e.g. WHEN money enters wallet, PAY electricity bill).',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: ['trigger', 'action'],
    optional_parameters: ['mandate'],
    parameter_types: { trigger: 'object', action: 'object', mandate: 'object' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  list_rules: {
    name: 'list_rules',
    description: 'List user active conditional automation rules.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  toggle_rule: {
    name: 'toggle_rule',
    description: 'Enable or disable a conditional automation rule.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: ['ruleId', 'enabled'],
    optional_parameters: [],
    parameter_types: { ruleId: 'string', enabled: 'boolean' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.MEDIUM,
    reversible: true,
  },

  create_reminder: {
    name: 'create_reminder',
    description: 'Create a time-based reminder to send money, pay a bill, or check balance.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: ['title', 'dueAt'],
    optional_parameters: ['amount', 'recipient'],
    parameter_types: { title: 'string', dueAt: 'string', amount: 'number', recipient: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  list_reminders: {
    name: 'list_reminders',
    description: 'List pending reminders.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  cancel_reminder: {
    name: 'cancel_reminder',
    description: 'Cancel or delete a reminder.',
    category: TOOL_CATEGORIES.AUTOMATION,
    required_parameters: ['reminderId'],
    optional_parameters: [],
    parameter_types: { reminderId: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  // ==========================================
  // GUARDIAN & FAMILY CONTROLS
  // ==========================================
  guardian_approve: {
    name: 'guardian_approve',
    description: 'Guardian approves or rejects a child transaction held for review.',
    category: TOOL_CATEGORIES.GUARDIAN,
    required_parameters: ['txnId', 'decision'],
    optional_parameters: [],
    parameter_types: { txnId: 'string', decision: 'string' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  guardian_query: {
    name: 'guardian_query',
    description: 'View linked child accounts, daily limits, and pending approval requests.',
    category: TOOL_CATEGORIES.GUARDIAN,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  child_query: {
    name: 'child_query',
    description: 'Check active daily spending limit and Guardian mode restrictions for a child account.',
    category: TOOL_CATEGORIES.GUARDIAN,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  add_child_account: {
    name: 'add_child_account',
    description: 'Link a child phone number to your parent Guardian account with spending limits.',
    category: TOOL_CATEGORIES.GUARDIAN,
    required_parameters: ['child_name', 'child_phone'],
    optional_parameters: ['daily_limit'],
    parameter_types: { child_name: 'string', child_phone: 'string', daily_limit: 'number' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  // ==========================================
  // FINANCIAL COPILOT & INSIGHTS
  // ==========================================
  spending_summary: {
    name: 'spending_summary',
    description: 'Calculate total spending, categorized breakdown, and top categories for this week or month.',
    category: TOOL_CATEGORIES.FINANCIAL_COPILOT,
    required_parameters: [],
    optional_parameters: ['period'], // 'week' | 'month'
    parameter_types: { period: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  income_summary: {
    name: 'income_summary',
    description: 'Calculate total received money and cash-ins for this week or month.',
    category: TOOL_CATEGORIES.FINANCIAL_COPILOT,
    required_parameters: [],
    optional_parameters: ['period'],
    parameter_types: { period: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  compare_spending: {
    name: 'compare_spending',
    description: 'Compare current month spending against last month with percentage difference.',
    category: TOOL_CATEGORIES.FINANCIAL_COPILOT,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  explain_financial_habits: {
    name: 'explain_financial_habits',
    description: 'Analyze why money finishes fast, spending patterns, and provide personalized budgeting tips.',
    category: TOOL_CATEGORIES.FINANCIAL_COPILOT,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  biggest_transactions: {
    name: 'biggest_transactions',
    description: 'Find highest spending transactions in the last 30 days.',
    category: TOOL_CATEGORIES.FINANCIAL_COPILOT,
    required_parameters: [],
    optional_parameters: ['limit'],
    parameter_types: { limit: 'number' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  category_spending: {
    name: 'category_spending',
    description: 'Find total amount spent specifically on recharge, bills, or send money.',
    category: TOOL_CATEGORIES.FINANCIAL_COPILOT,
    required_parameters: ['category'],
    optional_parameters: ['period'],
    parameter_types: { category: 'string', period: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  knowledge_query: {
    name: 'knowledge_query',
    description: 'Query official UPAY knowledge base for limits, charges, fees, and procedures.',
    category: TOOL_CATEGORIES.KNOWLEDGE,
    required_parameters: ['query'],
    optional_parameters: [],
    parameter_types: { query: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  // ==========================================
  // COPILOT MEMORY & PREFERENCES
  // ==========================================
  remember_fact: {
    name: 'remember_fact',
    description: 'Remember a user personal fact, contact alias/relationship, utility meter/account number, or budgeting preference.',
    category: TOOL_CATEGORIES.MEMORY,
    required_parameters: ['fact'],
    optional_parameters: ['category', 'key', 'value'],
    parameter_types: { fact: 'string', category: 'string', key: 'string', value: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  recall_memory: {
    name: 'recall_memory',
    description: 'Recall or review remembered personal facts, contact aliases, utility accounts, and financial goals.',
    category: TOOL_CATEGORIES.MEMORY,
    required_parameters: [],
    optional_parameters: ['query', 'category'],
    parameter_types: { query: 'string', category: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  forget_memory: {
    name: 'forget_memory',
    description: 'Forget or delete a specific remembered fact, contact alias, or utility account from memory.',
    category: TOOL_CATEGORIES.MEMORY,
    required_parameters: [],
    optional_parameters: ['factId', 'query'],
    parameter_types: { factId: 'string', query: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  clear_memory: {
    name: 'clear_memory',
    description: 'Clear all remembered personal facts, contact aliases, and utility accounts from memory.',
    category: TOOL_CATEGORIES.MEMORY,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  // ==========================================
  // APPLICATION CONTROLS & SECURITY
  // ==========================================
  app_logout: {
    name: 'app_logout',
    description: 'Log out of the current user session safely.',
    category: TOOL_CATEGORIES.ACCOUNT,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  app_change_pin: {
    name: 'app_change_pin',
    description: 'Open secure PIN change interface for the user.',
    category: TOOL_CATEGORIES.ACCOUNT,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  change_phone_number: {
    name: 'change_phone_number',
    description: 'Initiate phone number update with verification and security gate.',
    category: TOOL_CATEGORIES.ACCOUNT,
    required_parameters: ['new_phone'],
    optional_parameters: [],
    parameter_types: { new_phone: 'string' },
    confirmation_required: true,
    authentication_required: true,
    risk_level: RISK_LEVELS.HIGH,
    reversible: false,
  },

  app_navigate: {
    name: 'app_navigate',
    description: 'Navigate to app screens (History, Savings, Account, Guardian).',
    category: TOOL_CATEGORIES.ACCOUNT,
    required_parameters: ['path'],
    optional_parameters: ['subview'],
    parameter_types: { path: 'string', subview: 'string' },
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },

  agent_stats: {
    name: 'agent_stats',
    description: 'View agent cash-in and cash-out volumes, transactions, and earned commission.',
    category: TOOL_CATEGORIES.ACCOUNT,
    required_parameters: [],
    optional_parameters: [],
    parameter_types: {},
    confirmation_required: false,
    authentication_required: false,
    risk_level: RISK_LEVELS.LOW,
    reversible: true,
  },
};

/**
 * Returns tool definition by tool name.
 * @param {string} toolName
 * @returns {object|null}
 */
export function getTool(toolName) {
  return TOOL_REGISTRY[toolName] || null;
}

/**
 * Returns all tools formatted for LLM function calling schema.
 * @returns {Array<object>}
 */
export function getLlmToolDefinitions() {
  return Object.values(TOOL_REGISTRY).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.parameter_types).map(([key, type]) => [
            key,
            { type, description: `Parameter ${key}` },
          ])
        ),
        required: tool.required_parameters,
      },
    },
  }));
}

export default {
  RISK_LEVELS,
  TOOL_CATEGORIES,
  TOOL_REGISTRY,
  getTool,
  getLlmToolDefinitions,
};
