import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';
import { User, Wallet, Transaction, ProtectedProfile, ConsumedToken } from '../src/models/index.js';
import { createStepUpToken } from '../src/services/auth.service.js';
import { sendMoney } from '../src/services/transaction.service.js';

describe('Guardian Mode Approval PIN Flow & Security Boundaries', () => {
  let guardianUser;
  let guardianToken;
  let childUser;
  let childToken;
  let recipientUser;
  const guardianPin = '1234';

  beforeAll(async () => {
    await setupTestDb();

    // 1. Create Guardian User
    const gPhone = `0171${Math.floor(1000000 + Math.random() * 9000000)}`;
    const gRes = await request(app).post('/api/auth/register').send({
      phone: gPhone,
      pin: guardianPin,
      name: 'Guardian Parent',
      accountType: 'CUSTOMER',
    });
    guardianUser = gRes.body.user;
    guardianToken = gRes.body.tokens.accessToken;

    // 2. Create Child User under Guardian with APPROVAL_REQUIRED mode
    const cPhone = `0172${Math.floor(1000000 + Math.random() * 9000000)}`;
    const cRes = await request(app).post('/api/auth/register').send({
      phone: cPhone,
      pin: '4321',
      name: 'Child Ward',
      accountType: 'CHILD',
      parentPhone: gPhone,
    });
    childUser = cRes.body.user;
    childToken = cRes.body.tokens.accessToken;

    await ProtectedProfile.updateOne(
      { childUserId: childUser.id || childUser._id },
      { $set: { controlMode: 'APPROVAL_REQUIRED' } }
    );

    // 3. Create Recipient User
    const rPhone = `0173${Math.floor(1000000 + Math.random() * 9000000)}`;
    const rRes = await request(app).post('/api/auth/register').send({
      phone: rPhone,
      pin: '9999',
      name: 'Friend Recipient',
      accountType: 'CUSTOMER',
    });
    recipientUser = rRes.body.user;
  });

  // Helper to initiate a child transaction held for guardian approval
  async function createAwaitingTxn(amountPoisha = 50000) {
    const txn = await sendMoney({
      senderUserId: childUser.id || childUser._id,
      recipientPhone: recipientUser.phone,
      amountPoisha,
      note: 'School fees',
      idempotencyKey: `child-send-${Date.now()}-${Math.random()}`,
    });
    expect(txn.status).toBe('awaiting_guardian');
    return txn;
  }

  it('1. GET /api/guardians/approvals/:txnId returns full summary for authorized guardian', async () => {
    const txn = await createAwaitingTxn(35000);

    const res = await request(app)
      .get(`/api/guardians/approvals/${txn.id || txn._id}`)
      .set('Authorization', `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.approval).toBeDefined();
    expect(res.body.approval.id).toBe(txn.id || txn._id);
    expect(res.body.approval.amountPoisha).toBe(35000);
    expect(res.body.approval.sender.phone).toBe(childUser.phone);
    expect(res.body.approval.recipient.phone).toBe(recipientUser.phone);
    expect(res.body.approval.status).toBe('awaiting_guardian');
  });

  it('2. Rejects step-up authorization with wrong PIN (401 Invalid PIN)', async () => {
    const txn = await createAwaitingTxn(40000);
    const txnId = txn.id || txn._id;

    const stepRes = await request(app)
      .post('/api/auth/step-up')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({
        pin: '0000', // Incorrect PIN
        actionHash: `guardian-approve-${txnId}`,
      });

    expect([400, 401]).toContain(stepRes.status);
    expect(stepRes.body.message).toMatch(/Invalid PIN/i);

    // Verify transaction remains awaiting_guardian
    const inDb = await Transaction.findById(txnId);
    expect(inDb.status).toBe('awaiting_guardian');
  });

  it('3. Rejects step-up authorization with invalid PIN format (400 validation error)', async () => {
    const txn = await createAwaitingTxn(40000);
    const txnId = txn.id || txn._id;

    const stepRes = await request(app)
      .post('/api/auth/step-up')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({
        pin: '12', // Less than 4 digits
        actionHash: `guardian-approve-${txnId}`,
      });

    expect(stepRes.status).toBe(400);

    const inDb = await Transaction.findById(txnId);
    expect(inDb.status).toBe('awaiting_guardian');
  });

  it('4. Successfully approves with correct PIN, matching actionHash, and settles ledger', async () => {
    const txn = await createAwaitingTxn(50000);
    const txnId = txn.id || txn._id;
    const actionHash = `guardian-approve-${txnId}`;

    // Step 1: Request step-up token
    const stepRes = await request(app)
      .post('/api/auth/step-up')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({
        pin: guardianPin,
        actionHash,
      });

    expect(stepRes.status).toBe(200);
    const stepUpToken = stepRes.body.stepUpToken;
    expect(stepUpToken).toBeDefined();

    // Step 2: Decide approval
    const approveRes = await request(app)
      .post(`/api/guardians/approvals/${txnId}/decide`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .set('x-step-up-token', stepUpToken)
      .set('x-action-hash', actionHash)
      .send({ decision: 'approve' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.status).toBe('settled');

    // Verify transaction is settled in DB
    const settledTxn = await Transaction.findById(txnId);
    expect(settledTxn.status).toBe('settled');
  });

  it('5. Enforces anti-replay: Reusing the same step-up token is rejected', async () => {
    const txn1 = await createAwaitingTxn(20000);
    const txn1Id = txn1.id || txn1._id;
    const actionHash1 = `guardian-approve-${txn1Id}`;

    // Get step-up token
    const stepRes = await request(app)
      .post('/api/auth/step-up')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({
        pin: guardianPin,
        actionHash: actionHash1,
      });
    const token = stepRes.body.stepUpToken;

    // Use token for txn1
    const app1 = await request(app)
      .post(`/api/guardians/approvals/${txn1Id}/decide`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .set('x-step-up-token', token)
      .set('x-action-hash', actionHash1)
      .send({ decision: 'approve' });
    expect(app1.status).toBe(200);

    // Attempt to reuse same token for txn1 again (e.g. rapid double submit)
    const appReuse = await request(app)
      .post(`/api/guardians/approvals/${txn1Id}/decide`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .set('x-step-up-token', token)
      .set('x-action-hash', actionHash1)
      .send({ decision: 'approve' });

    expect(appReuse.status).toBe(403);
    expect(appReuse.body.message).toMatch(/already consumed|anti-replay/i);
  });

  it('6. Rejects step-up token with mismatched action hash (anti-tamper binding)', async () => {
    const txn = await createAwaitingTxn(25000);
    const txnId = txn.id || txn._id;

    // Token generated for different action hash
    const stepRes = await request(app)
      .post('/api/auth/step-up')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({
        pin: guardianPin,
        actionHash: 'guardian-approve-different-txn',
      });
    const token = stepRes.body.stepUpToken;

    const res = await request(app)
      .post(`/api/guardians/approvals/${txnId}/decide`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .set('x-step-up-token', token)
      .set('x-action-hash', `guardian-approve-${txnId}`)
      .send({ decision: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/action hash mismatch/i);
  });

  it('7. Rejects expired step-up token', async () => {
    const txn = await createAwaitingTxn(25000);
    const txnId = txn.id || txn._id;
    const actionHash = `guardian-approve-${txnId}`;

    // Craft an expired step-up token
    const expiredToken = jwt.sign(
      {
        userId: (guardianUser.id || guardianUser._id).toString(),
        tier: 'T2',
        actionHash,
        jti: 'expired-test-jti',
      },
      process.env.JWT_ACCESS_SECRET || 'dev-access-secret-fallback-key-32chars',
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .post(`/api/guardians/approvals/${txnId}/decide`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .set('x-step-up-token', expiredToken)
      .set('x-action-hash', actionHash)
      .send({ decision: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('8. Unauthorized user cannot approve or view approval details', async () => {
    const txn = await createAwaitingTxn(20000);
    const txnId = txn.id || txn._id;

    // Recipient user attempts to view/approve child transaction
    const rToken = (
      await request(app).post('/api/auth/login').send({
        phone: recipientUser.phone,
        pin: '9999',
      })
    ).body.tokens.accessToken;

    const viewRes = await request(app)
      .get(`/api/guardians/approvals/${txnId}`)
      .set('Authorization', `Bearer ${rToken}`);
    expect([400, 403, 500]).toContain(viewRes.status);

    const stepRes = await request(app)
      .post('/api/auth/step-up')
      .set('Authorization', `Bearer ${rToken}`)
      .send({
        pin: '9999',
        actionHash: `guardian-approve-${txnId}`,
      });

    const decideRes = await request(app)
      .post(`/api/guardians/approvals/${txnId}/decide`)
      .set('Authorization', `Bearer ${rToken}`)
      .set('x-step-up-token', stepRes.body.stepUpToken)
      .set('x-action-hash', `guardian-approve-${txnId}`)
      .send({ decision: 'approve' });

    expect([400, 403, 500]).toContain(decideRes.status); // Throws "Unauthorized: You are not the registered guardian for this account."
  });

  afterAll(async () => {
    await teardownTestDb();
  });
});
