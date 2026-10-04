import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';
import {
  User,
  Wallet,
  Transaction,
  SavingsPlan,
  FinancialMemory,
  PendingAction,
  MoneyRequest,
  ProtectedProfile,
} from '../src/models/index.js';
import {
  processAgentMessage,
  executePendingAction,
} from '../src/services/agentCopilot.service.js';

describe('Conversational Financial AI Copilot Comprehensive Scenarios', () => {
  let userMe, tokenMe;
  let userRahim, tokenRahim;
  let userKarim, tokenKarim;
  let userNabila, tokenNabila;
  let agentUser;
  let childUser;

  beforeAll(async () => {
    await setupTestDb();

    // 1. Current user (Me)
    const resMe = await request(app).post('/api/auth/register').send({
      phone: '01710000001',
      pin: '1234',
      name: 'Main User',
      accountType: 'CUSTOMER',
    });
    userMe = resMe.body.user;
    tokenMe = resMe.body.tokens.accessToken;

    // 2. Rahim
    const resRahim = await request(app).post('/api/auth/register').send({
      phone: '01710000002',
      pin: '1234',
      name: 'Rahim',
      accountType: 'CUSTOMER',
    });
    userRahim = resRahim.body.user;
    tokenRahim = resRahim.body.tokens.accessToken;

    // 3. Karim
    const resKarim = await request(app).post('/api/auth/register').send({
      phone: '01710000003',
      pin: '1234',
      name: 'Karim',
      accountType: 'CUSTOMER',
    });
    userKarim = resKarim.body.user;
    tokenKarim = resKarim.body.tokens.accessToken;

    // 4. Nabila
    const resNabila = await request(app).post('/api/auth/register').send({
      phone: '01710000004',
      pin: '1234',
      name: 'Nabila',
      accountType: 'CUSTOMER',
    });
    userNabila = resNabila.body.user;
    tokenNabila = resNabila.body.tokens.accessToken;

    // 5. Agent
    const resAgent = await request(app).post('/api/auth/register').send({
      phone: '01720000005',
      pin: '1234',
      name: 'Agent Kabir',
      accountType: 'AGENT',
    });
    agentUser = resAgent.body.user;

    // 6. Child
    const resChild = await request(app).post('/api/auth/register').send({
      phone: '01730000006',
      pin: '1234',
      name: 'My Child',
      accountType: 'CHILD',
      parentPhone: userMe.phone,
      dailyLimitPoisha: 100000,
    });
    childUser = resChild.body.user;

    // Setup Guardian Protected Profile
    await ProtectedProfile.updateOne(
      { childUserId: childUser.id },
      { $set: { guardianId: userMe.id, dailyLimitPoisha: 100000, controlMode: 'strict', status: 'active' } },
      { upsert: true }
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  // ==========================================
  // 1. MONEY TRANSFER
  // ==========================================
  describe('1. Money Transfer via Conversational Agent', () => {
    it('understands "Rahim ke 500 taka pathao", resolves Rahim, checks balance, and prepares summary card', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Rahim ke 500 taka pathao',
        language: 'bn',
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction.tool).toBe('send_money');
      expect(res.pendingAction.args.amountPoisha).toBe(50000); // ৳500
      expect(res.pendingAction.args.recipientPhone).toBe(userRahim.phone);
      expect(res.pendingAction.preview.recipientLabel).toContain('Rahim');
      expect(res.reply).toContain('Rahim');
      expect(res.reply).toContain('500');
    });

    it('rejects transfer to non-existent account like "01799999999 e 1000 send koro" with truthful error', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: '01799999999 e 1000 send koro',
        language: 'bn',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('এই নম্বর/অ্যাকাউন্টটি পাওয়া যায়নি, তাই transfer করা সম্ভব হচ্ছে না।');
    });

    it('rejects "amar friend ke 200 taka dao" when friend is not a registered user without faking success', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'amar friend ke 200 taka dao',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply.toLowerCase()).toContain('not found');
      expect(res.reply.toLowerCase()).toContain('cannot be completed');
    });

    it('rejects transfer when available balance is insufficient with clear truthful explanation', async () => {
      // Set wallet balance to ৳100 (10,000 poisha)
      await Wallet.updateOne({ userId: userMe.id }, { balance: 10000 });

      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Rahim ke 500 taka pathao',
        language: 'bn',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('Transfer করা সম্ভব হচ্ছে না। আপনার বর্তমান balance এই transaction-এর জন্য যথেষ্ট নয়।');

      // Restore wallet balance to ৳10,000 (1,000,000 poisha)
      await Wallet.updateOne({ userId: userMe.id }, { balance: 1000000 });
    });

    it('rejects negative or zero transfer amounts', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Send -500 to Rahim',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('greater than zero');
    });

    it('does not execute money-moving action without confirmation, and executes only on valid step-up PIN', async () => {
      // 1. Ask agent to send money
      const initiateRes = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Rahim ke 500 taka pathao',
        language: 'en',
      });

      const action = initiateRes.pendingAction;
      expect(action).toBeDefined();

      // Ensure recipient balance has not changed yet
      const rahimWalletBefore = await Wallet.findOne({ userId: userRahim.id });
      const initialRahimBalance = rahimWalletBefore.balance;

      // 2. Reject wrong PIN via step-up
      const badStepUp = await request(app).post('/api/auth/step-up').set('Authorization', `Bearer ${tokenMe}`).send({
        pin: '9999',
        actionHash: action.actionHash,
      });
      expect(badStepUp.status).toBe(400);

      // 3. Obtain valid step-up token
      const goodStepUp = await request(app).post('/api/auth/step-up').set('Authorization', `Bearer ${tokenMe}`).send({
        pin: '1234',
        actionHash: action.actionHash,
      });
      expect(goodStepUp.status).toBe(200);
      const stepUpToken = goodStepUp.body.stepUpToken;

      // 4. Confirm and execute
      const confirmRes = await request(app)
        .post('/api/copilot/confirm')
        .set('Authorization', `Bearer ${tokenMe}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', action.actionHash)
        .send({ actionId: action.actionId });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.message).toContain('৳500.00 successfully sent to Rahim');

      // 5. Verify database mutation
      const rahimWalletAfter = await Wallet.findOne({ userId: userRahim.id });
      expect(rahimWalletAfter.balance).toBe(initialRahimBalance + 50000);
    });
  });

  // ==========================================
  // 2. CASH OUT
  // ==========================================
  describe('2. Cash Out via Conversational Agent', () => {
    it('understands "2000 taka cashout koro", calculates 1.5% fee, and prepares summary card', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: '2000 taka cashout koro',
        language: 'bn',
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction.tool).toBe('cash_out');
      expect(res.pendingAction.args.amountPoisha).toBe(200000);
      expect(res.pendingAction.args.feePoisha).toBe(3000); // 1.5% of ৳2,000 = ৳30
      expect(res.pendingAction.args.totalPoisha).toBe(203000); // ৳2,030
      expect(res.reply).toContain('2000');
      expect(res.reply).toContain('30');
    });

    it('rejects cash out when balance is insufficient for amount + 1.5% fee', async () => {
      // Temporarily set wallet to ৳1,000 (100,000 poisha)
      await Wallet.updateOne({ userId: userMe.id }, { balance: 100000 });

      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Cash out 2000',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply.toLowerCase()).toContain('insufficient balance');

      // Restore wallet
      await Wallet.updateOne({ userId: userMe.id }, { balance: 1000000 });
    });
  });

  // ==========================================
  // 3. BILL PAYMENT
  // ==========================================
  describe('3. Bill Payment via Conversational Agent', () => {
    it('understands "Pay my electricity bill" without amount and asks clarifying question', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Pay my electricity bill',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('What is the bill amount you would like to pay');
    });

    it('understands "DESCO bill 1200 taka dao", extracts biller DESCO, amount 1200, and prepares summary', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'DESCO bill 1200 taka dao',
        language: 'bn',
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction.tool).toBe('pay_bill');
      expect(res.pendingAction.args.billerId).toBe('DESCO');
      expect(res.pendingAction.args.amountPoisha).toBe(120000); // ৳1,200
      expect(res.pendingAction.preview.recipientLabel).toContain('DESCO');
    });

    it('rejects bill payment when balance is insufficient', async () => {
      await Wallet.updateOne({ userId: userMe.id }, { balance: 50000 }); // ৳500

      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Pay 1200 taka DESCO bill',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply.toLowerCase()).toContain('insufficient balance');

      await Wallet.updateOne({ userId: userMe.id }, { balance: 1000000 });
    });
  });

  // ==========================================
  // 4. GROUP BILL SPLIT
  // ==========================================
  describe('4. Group Bill Creation via Conversational Agent', () => {
    it('prompts for participant names when vague request like "with 3 people" is made', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Create a 2000 taka group bill for dinner with 3 people',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('Who are the participants in this group bill?');
    });

    it('prompts for phone number if an unknown participant is named', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Create a 2000 taka group bill for dinner with UnknownPerson',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain("Could not find an account for 'UnknownPerson'");
    });

    it('calculates equal split accurately and prepares group bill when participants are resolved', async () => {
      // Rahim, Karim, and Nabila are all registered.
      // Total bill = ৳2,000. People = 4 (Me + 3 friends). Share = ৳500 each.
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Create a 2000 taka group bill for dinner with Rahim, Karim and Nabila',
        language: 'bn',
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction.tool).toBe('create_group_bill');
      expect(res.pendingAction.args.splitType).toBe('equal');
      expect(res.pendingAction.args.participants.length).toBe(3);
      // Each participant is requested ৳500 (50,000 poisha)
      expect(res.pendingAction.args.participants[0].amountPoisha).toBe(50000);
      expect(res.pendingAction.args.participants[1].amountPoisha).toBe(50000);
      expect(res.pendingAction.args.participants[2].amountPoisha).toBe(50000);
      expect(res.reply).toContain('500');
    });

    it('executes real group bill creation on backend with step-up authentication', async () => {
      const initiateRes = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Create a 2000 taka group bill for dinner with Rahim, Karim and Nabila',
        language: 'en',
      });

      const action = initiateRes.pendingAction;
      expect(action).toBeDefined();

      const stepUp = await request(app).post('/api/auth/step-up').set('Authorization', `Bearer ${tokenMe}`).send({
        pin: '1234',
        actionHash: action.actionHash,
      });
      expect(stepUp.status).toBe(200);

      const confirmRes = await request(app)
        .post('/api/copilot/confirm')
        .set('Authorization', `Bearer ${tokenMe}`)
        .set('x-step-up-token', stepUp.body.stepUpToken)
        .set('x-action-hash', action.actionHash)
        .send({ actionId: action.actionId });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);

      // Verify real MoneyRequest was created in MongoDB
      const createdReq = await MoneyRequest.findOne({ creatorId: userMe.id, kind: 'bill_split' });
      expect(createdReq).toBeDefined();
      expect(createdReq.participants.length).toBe(3);
    });
  });

  // ==========================================
  // 5. SAVINGS PLANS
  // ==========================================
  describe('5. Savings Plans via Conversational Agent', () => {
    it('asks for target amount when user says "Make a savings plan for my new laptop" without amount', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Make a savings plan for my new laptop',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain("What target amount would you like to set for your 'Laptop' savings goal?");
    });

    it('creates and activates real savings plan when duration and target are specified: "I want to save 5000 taka in the next 2 months"', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'I want to save 5000 taka in the next 2 months',
        language: 'en',
      });

      expect(res.savingsPlan).toBeDefined();
      expect(res.savingsPlan.targetAmountPoisha).toBe(500000); // ৳5,000
      expect(res.savingsPlan.durationMonths).toBe(2);
      expect(res.reply).toContain('5000');
      expect(res.reply).toContain('2 months');

      // Verify DB record
      const dbPlan = await SavingsPlan.findById(res.savingsPlan._id);
      expect(dbPlan).toBeDefined();
      expect(dbPlan.status).toBe('active');
    });
  });

  // ==========================================
  // 6. GUARDIAN MODE
  // ==========================================
  describe('6. Guardian Mode Approvals via Conversational Agent', () => {
    it('truthfully tells guardian when no child transactions are awaiting approval', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: "Approve my child's 300 taka payment",
        language: 'bn',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('আপনার কোনো সন্তানের বা ওয়ার্ডের পেন্ডিং লেনদেন অনুমোদনের অপেক্ষায় নেই।');
    });

    it('identifies pending child transaction, prepares confirmation card, and executes approval on step-up PIN', async () => {
      // 1. Create a transaction for child that requires guardian approval
      const childWallet = await Wallet.findOne({ userId: childUser.id });
      const rahimWallet = await Wallet.findOne({ userId: userRahim.id });

      const pendingTxn = await Transaction.create({
        idempotencyKey: 'test-child-hold-key-1',
        senderUserId: childUser.id,
        senderWalletId: childWallet._id,
        recipientUserId: userRahim.id,
        recipientWalletId: rahimWallet._id,
        amount: 30000, // ৳300
        fee: 0,
        total: 30000,
        type: 'send',
        channel: 'ui',
        status: 'awaiting_guardian',
        metadata: {
          recipientName: 'Rahim',
          recipientPhone: userRahim.phone,
          holdReason: 'Child transaction exceeds limit',
        },
      });

      // 2. Ask Copilot to approve
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: "Approve my child's 300 taka payment",
        language: 'bn',
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction.tool).toBe('guardian_decision');
      expect(res.pendingAction.args.txnId).toBe(pendingTxn._id.toString());
      expect(res.pendingAction.preview.recipientLabel).toContain('My Child');

      // 3. Confirm with valid PIN
      const stepUp = await request(app).post('/api/auth/step-up').set('Authorization', `Bearer ${tokenMe}`).send({
        pin: '1234',
        actionHash: res.pendingAction.actionHash,
      });
      expect(stepUp.status).toBe(200);

      const confirmRes = await request(app)
        .post('/api/copilot/confirm')
        .set('Authorization', `Bearer ${tokenMe}`)
        .set('x-step-up-token', stepUp.body.stepUpToken)
        .set('x-action-hash', res.pendingAction.actionHash)
        .send({ actionId: res.pendingAction.actionId });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);

      // Verify transaction is settled
      const settledTxn = await Transaction.findById(pendingTxn._id);
      expect(settledTxn.status).toBe('settled');
    });
  });

  // ==========================================
  // 7. IRRELEVANT REQUEST REFUSAL
  // ==========================================
  describe('7. Irrelevant Non-Financial Request Refusal', () => {
    it('politely declines weather queries and explains UPAY scope', async () => {
      const res = await processAgentMessage({
        userId: userMe.id,
        messageText: 'What is the weather in Dhaka today?',
        language: 'en',
      });

      expect(res.pendingAction).toBeNull();
      expect(res.reply).toContain('I am your UPAY Financial Copilot');
      expect(res.reply).toContain('cannot assist with non-financial topics');
    });

    it('politely declines coding requests and jokes', async () => {
      const resJoke = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Tell me a joke',
        language: 'en',
      });
      expect(resJoke.pendingAction).toBeNull();
      expect(resJoke.reply).toContain('non-financial topics');

      const resCode = await processAgentMessage({
        userId: userMe.id,
        messageText: 'Write python code to reverse a linked list',
        language: 'bn',
      });
      expect(resCode.pendingAction).toBeNull();
      expect(resCode.reply).toContain('শুধুমাত্র আপনার উপায়ের (UPAY) আর্থিক লেনদেন');
    });
  });
});
