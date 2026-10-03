import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { app } from '../src/app.js';
import { register } from '../src/services/auth.service.js';
import { Schedule, Rule, PendingAction, ConsumedToken } from '../src/models/index.js';
import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-fallback-key-32chars';

describe('Schedule & Rule Step-Up Authorization & Anti-Replay Security', () => {
  let userA, userB, tokenA;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const regA = await register({ phone: '01711111111', pin: '1234', name: 'User A' });
    userA = regA.user;
    tokenA = regA.tokens.accessToken;

    const regB = await register({ phone: '01722222222', pin: '1234', name: 'User B' });
    userB = regB.user;
  });

  // ==========================================
  // SCHEDULE STEP-UP PIPELINE
  // ==========================================
  describe('Schedule Step-Up Pipeline & Canonical Hash', () => {
    it('successfully prepares, authorizes step-up with matching canonical hash, and confirms schedule', async () => {
      // 1. Prepare schedule
      const prepRes = await request(app)
        .post('/api/schedules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          actionType: 'send_money',
          frequency: 'one_time',
          actionPayload: { recipientPhone: userB.phone, amountPoisha: 50000 },
          nextRunAt: new Date(Date.now() + 24 * 3600 * 1000),
          mandate: { maxAmountPerRun: 100000 },
        });

      expect(prepRes.status).toBe(201);
      expect(prepRes.body.success).toBe(true);
      const { actionId, actionHash } = prepRes.body.pendingAction;
      expect(actionId).toBeDefined();
      expect(actionHash).toBeDefined();

      // Verify PendingAction in MongoDB
      const pending = await PendingAction.findOne({ actionId });
      expect(pending).toBeDefined();
      expect(pending.status).toBe('pending');
      expect(pending.actionHash).toBe(actionHash);

      // 2. Request step-up token using the exact canonical actionHash
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '1234', actionHash });

      expect(stepUpRes.status).toBe(200);
      const stepUpToken = stepUpRes.body.stepUpToken;
      expect(stepUpToken).toBeDefined();

      // 3. Confirm schedule
      const confirmRes = await request(app)
        .post('/api/schedules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.schedule).toBeDefined();
      expect(confirmRes.body.schedule.status).toBe('active');

      // 4. Verify schedule persisted in DB
      const schedule = await Schedule.findOne({ userId: userA.id, actionType: 'send_money' });
      expect(schedule).toBeDefined();
      expect(schedule.status).toBe('active');

      // 5. Verify PendingAction marked executed
      const updatedPending = await PendingAction.findOne({ actionId });
      expect(updatedPending.status).toBe('executed');

      // 6. Verify step-up token was marked consumed
      const isConsumed = await ConsumedToken.findOne({ actionHash });
      expect(isConsumed).toBeDefined();
    });

    it('rejects schedule confirmation with incorrect PIN during step-up', async () => {
      // 1. Prepare
      const prepRes = await request(app)
        .post('/api/schedules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          actionType: 'send_money',
          frequency: 'one_time',
          actionPayload: { recipientPhone: userB.phone, amountPoisha: 50000 },
        });
      const { actionHash } = prepRes.body.pendingAction;

      // 2. Step-up with wrong PIN
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '9999', actionHash });

      expect(stepUpRes.status).toBe(400);
      expect(stepUpRes.body.message).toContain('Invalid PIN');
    });

    it('rejects confirmation when step-up token action hash does NOT match canonical hash', async () => {
      // 1. Prepare
      const prepRes = await request(app)
        .post('/api/schedules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          actionType: 'send_money',
          frequency: 'one_time',
          actionPayload: { recipientPhone: userB.phone, amountPoisha: 50000 },
        });
      const { actionId, actionHash } = prepRes.body.pendingAction;

      // 2. Step-up with WRONG actionHash
      const wrongHash = 'wrong-action-hash-12345';
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '1234', actionHash: wrongHash });

      const stepUpToken = stepUpRes.body.stepUpToken;

      // 3. Attempt confirmation
      const confirmRes = await request(app)
        .post('/api/schedules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId });

      expect(confirmRes.status).toBe(403);
      expect(confirmRes.body.message).toContain('anti-replay violation');
    });

    it('rejects confirmation with expired step-up token', async () => {
      // 1. Prepare
      const prepRes = await request(app)
        .post('/api/schedules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          actionType: 'send_money',
          frequency: 'one_time',
          actionPayload: { recipientPhone: userB.phone, amountPoisha: 50000 },
        });
      const { actionId, actionHash } = prepRes.body.pendingAction;

      // 2. Generate expired token
      const expiredToken = jwt.sign(
        {
          userId: userA.id,
          actionHash,
          tier: 'T2',
          purpose: 'step_up',
        },
        JWT_ACCESS_SECRET,
        { expiresIn: '-10s' }
      );

      // 3. Confirm with expired token
      const confirmRes = await request(app)
        .post('/api/schedules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', expiredToken)
        .set('x-action-hash', actionHash)
        .send({ actionId });

      expect(confirmRes.status).toBe(403);
      expect(confirmRes.body.message).toContain('jwt expired');
    });

    it('rejects confirmation when step-up token is reused (anti-replay)', async () => {
      // 1. Prepare schedule 1
      const prepRes1 = await request(app)
        .post('/api/schedules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          actionType: 'send_money',
          frequency: 'one_time',
          actionPayload: { recipientPhone: userB.phone, amountPoisha: 50000 },
        });
      const { actionId: actionId1, actionHash: actionHash1 } = prepRes1.body.pendingAction;

      // 2. Step-up
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '1234', actionHash: actionHash1 });
      const stepUpToken = stepUpRes.body.stepUpToken;

      // 3. First confirmation succeeds
      const confirmRes1 = await request(app)
        .post('/api/schedules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash1)
        .send({ actionId: actionId1 });
      expect(confirmRes1.status).toBe(201);

      // 4. Second attempt using the SAME step-up token must be rejected as already consumed
      const confirmRes2 = await request(app)
        .post('/api/schedules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash1)
        .send({ actionId: actionId1 });

      expect(confirmRes2.status).toBe(403);
      expect(confirmRes2.body.message).toContain('already been consumed (anti-replay violation)');
    });
  });

  // ==========================================
  // RULE STEP-UP PIPELINE
  // ==========================================
  describe('Rule Step-Up Pipeline & Canonical Hash', () => {
    it('successfully prepares, authorizes step-up with matching canonical hash, and confirms rule', async () => {
      // 1. Prepare rule
      const prepRes = await request(app)
        .post('/api/schedules/rules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          trigger: { type: 'wallet_credit', minAmount: 100000 },
          action: { type: 'pay_bill', billerId: 'DPDC', billAccountNo: '442109', amount: 120000 },
          mandate: { maxAmountPerRun: 200000 },
        });

      expect(prepRes.status).toBe(201);
      expect(prepRes.body.success).toBe(true);
      const { actionId, actionHash } = prepRes.body.pendingAction;
      expect(actionId).toBeDefined();
      expect(actionHash).toBeDefined();

      // 2. Request step-up token with canonical actionHash
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '1234', actionHash });

      expect(stepUpRes.status).toBe(200);
      const stepUpToken = stepUpRes.body.stepUpToken;

      // 3. Confirm rule
      const confirmRes = await request(app)
        .post('/api/schedules/rules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.rule).toBeDefined();
      expect(confirmRes.body.rule.status).toBe('active');

      // 4. Verify rule persisted in DB
      const rule = await Rule.findOne({ userId: userA.id });
      expect(rule).toBeDefined();
      expect(rule.status).toBe('active');

      // 5. Reusing the token must fail
      const replayRes = await request(app)
        .post('/api/schedules/rules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId });

      expect(replayRes.status).toBe(403);
      expect(replayRes.body.message).toContain('already been consumed');
    });

    it('rejects rule confirmation with mismatched action hash', async () => {
      // 1. Prepare
      const prepRes = await request(app)
        .post('/api/schedules/rules/prepare')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          trigger: { type: 'wallet_credit', minAmount: 100000 },
          action: { type: 'pay_bill', billerId: 'DPDC', billAccountNo: '442109', amount: 120000 },
        });
      const { actionId, actionHash } = prepRes.body.pendingAction;

      // 2. Step-up with incorrect hash
      const stepUpRes = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pin: '1234', actionHash: 'tampered-hash-xyz' });
      const stepUpToken = stepUpRes.body.stepUpToken;

      // 3. Attempt confirmation
      const confirmRes = await request(app)
        .post('/api/schedules/rules/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-step-up-token', stepUpToken)
        .set('x-action-hash', actionHash)
        .send({ actionId });

      expect(confirmRes.status).toBe(403);
      expect(confirmRes.body.message).toContain('anti-replay violation');
    });
  });
});
