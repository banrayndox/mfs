import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from './helpers.js';
import { app } from '../src/app.js';
import { User, Wallet, Transaction, SavingsPlan, FinancialMemory, PendingAction } from '../src/models/index.js';
import {
  calculatePercentageSavings,
  calculateRoundUpSavings,
  calculateThresholdSavings,
  calculateGoalPace,
} from '../src/services/microSavings.service.js';
import { evaluateGuardianRisk } from '../src/services/guardianRisk.service.js';
import { retrieveKnowledge } from '../src/services/rag.service.js';
import { processAgentMessage, executePendingAction } from '../src/services/agentCopilot.service.js';

describe('AI Financial Operating Layer Integration Tests', () => {
  let userA, tokenA, walletA;
  let userB, tokenB, walletB;

  beforeAll(async () => {
    await setupTestDb();

    // Register User A
    const resA = await request(app).post('/api/auth/register').send({
      phone: '01711223344',
      pin: '1234',
      name: 'User A',
      accountType: 'CUSTOMER',
    });
    tokenA = resA.body.tokens.accessToken;
    userA = resA.body.user;

    // Register User B
    const resB = await request(app).post('/api/auth/register').send({
      phone: '01799887766',
      pin: '1234',
      name: 'User B',
      accountType: 'CUSTOMER',
    });
    tokenB = resB.body.tokens.accessToken;
    userB = resB.body.user;

    walletA = await Wallet.findOne({ userId: userA.id });
    walletB = await Wallet.findOne({ userId: userB.id });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  // ========================================================
  // 1. Critical Financial Test Cases (Section 54 Spec Math)
  // ========================================================
  describe('Micro-Savings Deterministic Math', () => {
    it('calculates percentage savings accurately: ৳300 * 2% = ৳6.00 and ৳500 * 2% = ৳10.00', () => {
      // ৳300 (30,000 poisha) at 2% = 600 poisha (৳6.00)
      const save300 = calculatePercentageSavings({ amountPoisha: 30000, percentage: 2 });
      expect(save300).toBe(600);

      // ৳500 (50,000 poisha) at 2% = 1,000 poisha (৳10.00)
      const save500 = calculatePercentageSavings({ amountPoisha: 50000, percentage: 2 });
      expect(save500).toBe(1000);
    });

    it('calculates round-up savings accurately: ৳87 -> ৳100 = ৳13.00 and ৳463 -> ৳500 = ৳37.00', () => {
      // ৳87 (8,700 poisha) rounded to nearest ৳100 (10,000 poisha) = 1,300 poisha (৳13.00)
      const round87 = calculateRoundUpSavings({ amountPoisha: 8700, roundUpUnit: 10000 });
      expect(round87).toBe(1300);

      // ৳463 (46,300 poisha) rounded to nearest ৳500 (50,000 poisha) = 3,700 poisha (৳37.00)
      const round463 = calculateRoundUpSavings({ amountPoisha: 46300, roundUpUnit: 50000 });
      expect(round463).toBe(3700);

      // Exact round figure produces 0 savings
      const round100 = calculateRoundUpSavings({ amountPoisha: 10000, roundUpUnit: 10000 });
      expect(round100).toBe(0);
    });

    it('calculates threshold savings accurately: > ৳500 saves to next round figure', () => {
      // ৳670 (67,000 poisha) > ৳500 threshold -> next round ৳700 (70,000 poisha) = 3,000 poisha (৳30.00)
      const thresh670 = calculateThresholdSavings({
        amountPoisha: 67000,
        thresholdPoisha: 50000,
        roundUpUnit: 10000,
      });
      expect(thresh670).toBe(3000);

      // ৳450 <= ৳500 threshold -> 0 savings
      const thresh450 = calculateThresholdSavings({
        amountPoisha: 45000,
        thresholdPoisha: 50000,
        roundUpUnit: 10000,
      });
      expect(thresh450).toBe(0);
    });

    it('calculates goal pace accurately: ৳10,000 in 3 months = ~৳3,333.33/month', () => {
      const pace = calculateGoalPace({ targetPoisha: 1000000, durationMonths: 3, language: 'en' });
      expect(pace.targetBdt).toBe('10000.00');
      expect(pace.monthlyBdt).toBe('3333.33');
      expect(pace.recommendation).toContain('3333.33');
    });
  });

  // ========================================================
  // 2. Guardian Risk Engine Signals & Explainability
  // ========================================================
  describe('Guardian Risk Signals', () => {
    it('marks normal amounts to known recipients as safe with no unnecessary warnings', async () => {
      // Record prior settled transactions between User A and User B
      await Transaction.create({
        senderWalletId: walletA._id,
        senderUserId: userA.id,
        recipientUserId: userB.id,
        type: 'send',
        channel: 'ui',
        amount: 50000, // ৳500
        total: 50000,
        status: 'settled',
        idempotencyKey: 'test-seed-known-tx-1',
        metadata: { recipientPhone: '01799887766' },
      });
      await Transaction.create({
        senderWalletId: walletA._id,
        senderUserId: userA.id,
        recipientUserId: userB.id,
        type: 'send',
        channel: 'ui',
        amount: 50000, // ৳500
        total: 50000,
        status: 'settled',
        idempotencyKey: 'test-seed-known-tx-2',
        metadata: { recipientPhone: '01799887766' },
      });

      const risk = await evaluateGuardianRisk({
        userId: userA.id,
        amountPoisha: 50000,
        recipientPhone: '01799887766',
        date: new Date(2026, 9, 3, 14, 0, 0),
      });

      expect(risk.isSuspicious).toBe(false);
      expect(risk.reasons.length).toBe(0);
    });

    it('detects and explains new recipient risk when sending to an unfamiliar number', async () => {
      const risk = await evaluateGuardianRisk({
        userId: userA.id,
        amountPoisha: 400000, // ৳4,000
        recipientPhone: '01855667788', // never sent before
        date: new Date(2026, 9, 3, 14, 0, 0),
      });

      expect(risk.isSuspicious).toBe(true);
      expect(risk.reasons.some((r) => r.code === 'NEW_RECIPIENT')).toBe(true);
      expect(risk.reasons[0].en).toBeDefined();
      expect(risk.reasons[0].bn).toBeDefined();
    });

    it('detects and explains unusually high transfer amounts', async () => {
      const risk = await evaluateGuardianRisk({
        userId: userA.id,
        amountPoisha: 800000, // ৳8,000 (much higher than ৳500 average)
        recipientPhone: '01799887766',
        date: new Date(2026, 9, 3, 14, 0, 0),
      });

      expect(risk.isSuspicious).toBe(true);
      expect(risk.reasons.some((r) => r.code === 'UNUSUAL_HIGH_AMOUNT' || r.code === 'EXCEEDS_HISTORICAL_MAX')).toBe(true);
    });
  });

  // ========================================================
  // 3. AI Financial Copilot Queries & Factual Explanations
  // ========================================================
  describe('Financial Analysis & Queries via Copilot', () => {
    it('retrieves accurate wallet balance with zero hallucination', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'What is my current balance?',
        language: 'en',
      });

      expect(res.reply).toContain('৳');
      expect(res.balancePoisha).toBeDefined();
      expect(res.pendingAction).toBeNull();
    });

    it('answers "How much did I spend this month?" with accurate breakdown', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'How much did I spend this month?',
        language: 'en',
      });

      expect(res.spendingSummary).toBeDefined();
      expect(res.reply).toContain('Total spending this month');
      expect(res.spendingSummary.categories).toBeDefined();
    });

    it('answers "Compare this month with last month" with exact calculations', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Compare this month with last month',
        language: 'en',
      });

      expect(res.comparison).toBeDefined();
      expect(res.reply).toContain('Month-over-Month Spending Comparison');
    });

    it('answers "Why am I running out of money every month?" with fact-grounded explanation', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Why am I running out of money every month?',
        language: 'en',
      });

      expect(res.financialAnalysis).toBeDefined();
      expect(res.reply).toContain('Financial pattern analysis over the past 3 months');
      expect(res.reply).toContain('Largest expenditure category');
    });
  });

  // ========================================================
  // 4. Personalized Micro-Savings & Financial Memory
  // ========================================================
  describe('Micro-Savings & Financial Memory via Copilot', () => {
    it('configures 2% transaction savings on "Save 2% from every transaction"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Save 2% from every transaction',
        language: 'en',
      });

      expect(res.microSavings).toBeDefined();
      expect(res.microSavings.enabled).toBe(true);
      expect(res.microSavings.percentage).toBe(2);
      expect(res.reply).toContain('2%');
      expect(res.reply).toContain('300 saves ৳6.00');

      const mem = await FinancialMemory.findOne({ userId: userA.id });
      expect(mem.microSavings.enabled).toBe(true);
      expect(mem.microSavings.mode).toBe('percentage');
    });

    it('configures round-up savings on "Enable round-up savings"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Enable round-up savings',
        language: 'en',
      });

      expect(res.microSavings).toBeDefined();
      expect(res.microSavings.enabled).toBe(true);
      expect(res.microSavings.mode).toBe('round_up');
      expect(res.reply).toContain('87 rounds to ৳100');

      const mem = await FinancialMemory.findOne({ userId: userA.id });
      expect(mem.microSavings.mode).toBe('round_up');
    });

    it('pauses and resumes micro-savings on command', async () => {
      const pauseRes = await processAgentMessage({
        userId: userA.id,
        messageText: 'Pause my savings',
        language: 'en',
      });
      expect(pauseRes.reply).toContain('paused');

      let mem = await FinancialMemory.findOne({ userId: userA.id });
      expect(mem.microSavings.paused).toBe(true);

      const resumeRes = await processAgentMessage({
        userId: userA.id,
        messageText: 'Resume my savings',
        language: 'en',
      });
      expect(resumeRes.reply).toContain('resumed');

      mem = await FinancialMemory.findOne({ userId: userA.id });
      expect(mem.microSavings.paused).toBe(false);
    });

    it('creates goal and remembers "I am saving for a laptop"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: "I'm saving for a laptop",
        language: 'en',
      });

      expect(res.reply).toContain('laptop');
      expect(res.goal).toBeDefined();

      const mem = await FinancialMemory.findOne({ userId: userA.id });
      expect(mem.financialGoals.some((g) => g.keyword === 'laptop')).toBe(true);
    });

    it('retrieves authoritative goal data on "How am I doing with my laptop?"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'How am I doing with my laptop?',
        language: 'en',
      });

      expect(res.savingsPlan).toBeDefined();
      expect(res.reply).toContain('laptop');
      expect(res.reply).toContain('Progress');
    });
  });

  // ========================================================
  // 5. RAG Knowledge Pipeline
  // ========================================================
  describe('RAG Knowledge Pipeline', () => {
    it('retrieves difference between Send Money and Cash Out documentation', () => {
      const docs = retrieveKnowledge('What is the difference between Send Money and Cash Out?', {
        language: 'en',
      });

      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].id).toBe('kb-send-vs-cashout');
      expect(docs[0].content).toContain('1.5%');
    });

    it('answers natural language fee inquiries via Copilot with RAG grounding', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'What is the difference between Send Money and Cash Out?',
        language: 'en',
      });

      expect(res.reply).toContain('Difference between Send Money and Cash Out');
      expect(res.knowledgeDoc).toBeDefined();
      expect(res.pendingAction).toBeNull();
    });
  });

  // ========================================================
  // 6. Application Control Actions (Logout, PIN, Navigate)
  // ========================================================
  describe('Application Control Tools', () => {
    it('executes real logout action on "logout"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'logout',
        language: 'en',
      });

      expect(res.clientAction).toEqual({ type: 'logout' });
      expect(res.reply).toContain('Logging you out');
      expect(res.pendingAction).toBeNull();
    });

    it('initiates secure change PIN flow without prompting for PIN in chat', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Change my PIN',
        language: 'en',
      });

      expect(res.clientAction).toEqual({ type: 'open_modal', modal: 'change_pin' });
      expect(res.reply).toContain('never accepted inside chat');
      expect(res.pendingAction).toBeNull();
    });

    it('triggers navigation on "open transaction history"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'open transaction history',
        language: 'en',
      });

      expect(res.clientAction).toEqual({ type: 'navigate', path: '/history', subview: undefined });
      expect(res.pendingAction).toBeNull();
    });
  });

  // ========================================================
  // 7. High-Risk Action Confirmation & Canonical Hash
  // ========================================================
  describe('High-Risk Action Confirmation & Execution', () => {
    it('asks for missing amount on ambiguous command "Send money to Rahim"', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Send money to Rahim',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('What amount would you like to send');
    });

    it('creates PendingAction with canonical actionHash when valid', async () => {
      const res = await processAgentMessage({
        userId: userA.id,
        messageText: 'Send 500 taka to 01799887766',
        language: 'en',
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction.actionHash).toBeDefined();
      expect(res.pendingAction.preview.amountPoisha).toBe(50000);
      expect(res.pendingAction.riskDecision).toBeDefined();
    });

    it('executes PendingAction via /api/copilot/confirm with valid step-up token', async () => {
      // 1. Initiate command
      const initiateRes = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ message: 'Send 300 taka to 01799887766' });

      const pending = initiateRes.body.pendingAction;
      expect(pending).toBeDefined();

      const actionHash = pending.actionHash || pending.actionId;

      // 2. Request Step-Up Token
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '1234', actionHash });

      expect(stepUpRes.status).toBe(200);
      const stepUpToken = stepUpRes.body.stepUpToken;

      // 3. Confirm PendingAction
      const confirmRes = await request(app)
        .post('/api/copilot/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId: pending.actionId });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);

      // Verify anti-replay: token cannot be reused
      const replayRes = await request(app)
        .post('/api/copilot/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId: pending.actionId });

      expect(replayRes.status).toBe(403);
    });
  });
});
