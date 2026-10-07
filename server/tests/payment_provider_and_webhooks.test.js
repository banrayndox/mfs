import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { app } from '../src/app.js';
import { register } from '../src/services/auth.service.js';
import { Wallet, Transaction } from '../src/models/index.js';
import { getPaymentProvider, MockPaymentProvider, SandboxPaymentProvider } from '../src/services/paymentProvider/index.js';


describe('Payment Provider Abstraction, State Machine & Webhook Settlement', () => {
  let user, userToken;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const reg = await register({
      phone: '01710000001',
      pin: '1234',
      name: 'Sandbox Test User',
    });
    user = reg.user;

    const loginRes = await request(app).post('/api/auth/login').send({
      phone: '01710000001',
      pin: '1234',
    });
    userToken = loginRes.body.tokens.accessToken;
  });

  describe('1. Provider Unit Tests (Mock & Sandbox)', () => {
    it('MockPaymentProvider initiates and refunds synchronously', async () => {
      const mock = new MockPaymentProvider();
      const initiated = await mock.initiatePayment({
        txnId: 'txn-123',
        amountPoisha: 50000,
        customerPhone: '01710000001',
      });

      expect(initiated.status).toBe('SUCCESS');
      expect(initiated.providerReference).toMatch(/^mock_ref_/);

      const refund = await mock.refundPayment({
        providerReference: initiated.providerReference,
        amountPoisha: 50000,
      });
      expect(refund.success).toBe(true);
      expect(refund.refundReference).toMatch(/^ref_mock_/);
    });

    it('SandboxPaymentProvider manages state transitions and HMAC signatures', async () => {
      const sandbox = new SandboxPaymentProvider({ webhookSecret: 'test-secret-key-32chars' });

      // Step 1: Initiate payment -> PENDING
      const initiated = await sandbox.initiatePayment({
        txnId: 'txn-456',
        amountPoisha: 100000,
        customerPhone: '01710000001',
      });
      expect(initiated.status).toBe('PENDING');
      expect(initiated.checkoutUrl).toContain(initiated.providerReference);

      // Verify order status
      const verifiedPending = await sandbox.verifyPayment(initiated.providerReference);
      expect(verifiedPending.status).toBe('PENDING');

      // Step 2: Simulate upstream webhook callback
      const callback = sandbox.simulateWebhookCallback({
        providerReference: initiated.providerReference,
        targetStatus: 'SUCCESS',
      });
      expect(callback.signature).toBeTruthy();
      expect(callback.payload.status).toBe('SUCCESS');

      // Verify valid signature handling
      const handleValid = await sandbox.handleWebhook({
        payload: callback.payload,
        signature: callback.signature,
      });
      expect(handleValid.isValid).toBe(true);
      expect(handleValid.status).toBe('SUCCESS');

      // Step 3: Verify forged/tampered signature rejection
      const handleTampered = await sandbox.handleWebhook({
        payload: { ...callback.payload, amountPoisha: 9999999 }, // tampered payload
        signature: callback.signature,
      });
      expect(handleTampered.isValid).toBe(false);
      expect(handleTampered.error).toContain('INVALID_SIGNATURE');
    });
  });

  describe('2. End-to-End Gateway Checkout & Webhook Settlement HTTP Flow', () => {
    it('initiates add-money into processing state, then settles atomically upon HMAC webhook', async () => {
      const initialWallet = await Wallet.findOne({ userId: user.id });
      const initialBalance = initialWallet.balance; // ৳10,000 (1,000,000 poisha)

      // 1. User initiates payment via API
      const initRes = await request(app)
        .post('/api/transactions/provider/initiate-add-money')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amountPoisha: 150000, // ৳1,500
          bankName: 'City Bank Gateway',
          providerName: 'sandbox',
        });

      expect(initRes.status).toBe(201);
      expect(initRes.body.success).toBe(true);
      expect(initRes.body.status).toBe('PENDING');
      const providerReference = initRes.body.providerReference;
      expect(providerReference).toBeTruthy();

      // Verify transaction in DB is 'processing'
      const txn = await Transaction.findOne({ providerReference });
      expect(txn.status).toBe('processing');
      expect(txn.amount).toBe(150000);

      // Verify wallet balance is NOT credited prematurely
      const walletMid = await Wallet.findOne({ userId: user.id });
      expect(walletMid.balance).toBe(initialBalance);

      // 2. Gateway dispatches HMAC-signed webhook callback
      const sandbox = getPaymentProvider('sandbox');
      const { payload, signature } = sandbox.simulateWebhookCallback({
        providerReference,
        targetStatus: 'SUCCESS',
      });

      const webhookRes = await request(app)
        .post('/api/transactions/callbacks/provider')
        .set('x-provider-signature', signature)
        .send(payload);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.success).toBe(true);
      expect(webhookRes.body.status).toBe('settled');

      // 3. Verify transaction in DB is now settled
      const settledTxn = await Transaction.findOne({ providerReference });
      expect(settledTxn.status).toBe('settled');
      expect(settledTxn.providerStatus).toBe('SUCCESS');

      // 4. Verify wallet balance credited exactly ৳1,500
      const finalWallet = await Wallet.findOne({ userId: user.id });
      expect(finalWallet.balance).toBe(initialBalance + 150000);
    });

    it('rejects forged webhook requests with invalid HMAC signatures (HTTP 401)', async () => {
      const initRes = await request(app)
        .post('/api/transactions/provider/initiate-add-money')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amountPoisha: 50000,
          bankName: 'BRAC Bank',
        });

      const providerReference = initRes.body.providerReference;

      // Send forged callback with fake signature
      const webhookRes = await request(app)
        .post('/api/transactions/callbacks/provider')
        .set('x-provider-signature', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
        .send({
          event: 'payment.success',
          providerReference,
          status: 'SUCCESS',
        });

      expect(webhookRes.status).toBe(401);
      expect(webhookRes.body.code).toBe('INVALID_SIGNATURE');

      // Transaction must remain in 'processing' state
      const txn = await Transaction.findOne({ providerReference });
      expect(txn.status).toBe('processing');
    });

    it('handles upstream provider failure callback by marking transaction failed without crediting wallet', async () => {
      const initialWallet = await Wallet.findOne({ userId: user.id });
      const initialBalance = initialWallet.balance;

      const initRes = await request(app)
        .post('/api/transactions/provider/initiate-add-money')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amountPoisha: 75000,
          bankName: 'EBL Gateway',
        });

      const providerReference = initRes.body.providerReference;
      const sandbox = getPaymentProvider('sandbox');
      const { payload, signature } = sandbox.simulateWebhookCallback({
        providerReference,
        targetStatus: 'FAILED',
        failureReason: 'INSUFFICIENT_CUSTOMER_FUNDS',
      });

      const webhookRes = await request(app)
        .post('/api/transactions/callbacks/provider')
        .set('x-provider-signature', signature)
        .send(payload);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.status).toBe('failed');

      const failedTxn = await Transaction.findOne({ providerReference });
      expect(failedTxn.status).toBe('failed');
      expect(failedTxn.errorMessage).toBe('INSUFFICIENT_CUSTOMER_FUNDS');

      // Wallet balance must NOT change
      const finalWallet = await Wallet.findOne({ userId: user.id });
      expect(finalWallet.balance).toBe(initialBalance);
    });
  });
});
