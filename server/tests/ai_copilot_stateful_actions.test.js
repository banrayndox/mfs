import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';
import {
  Wallet,
  Notification,
  CopilotActionState,
} from '../src/models/index.js';

describe('AI Copilot Stateful Action Engine & Multi-Turn Workflows', () => {
  let userMe, tokenMe;
  let userRakib;

  beforeAll(async () => {
    await setupTestDb();

    // 1. Primary user
    const resMe = await request(app).post('/api/auth/register').send({
      phone: '01710000001',
      pin: '1234',
      name: 'Main User',
      accountType: 'CUSTOMER',
    });
    userMe = resMe.body.user;
    tokenMe = resMe.body.tokens.accessToken;

    // 2. Beneficiary (Rakib)
    const resRakib = await request(app).post('/api/auth/register').send({
      phone: '01710000002',
      pin: '1234',
      name: 'Rakib',
      accountType: 'CUSTOMER',
    });
    userRakib = resRakib.body.user;

    // Fund userMe wallet with ৳50,000 (5,000,000 poisha)
    await Wallet.findOneAndUpdate(
      { userId: userMe.id || userMe._id },
      { $set: { balancePoisha: 5000000 } }
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('1. should handle multi-turn send_money: prompt for missing amount then accumulate follow-up', async () => {
    // Turn 1: Provide recipient only
    const res1 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Send money to 01710000002',
        language: 'en',
      });

    expect(res1.status).toBe(200);
    // Should NOT have finalized pending action yet because amount is missing
    expect(res1.body.pendingAction).toBeFalsy();
    // Prompt should ask for amount
    expect(res1.body.reply).toMatch(/amount|how much/i);

    // Verify CopilotActionState in DB
    const state = await CopilotActionState.findOne({ userId: userMe.id || userMe._id });
    expect(state).toBeTruthy();
    expect(state.intent).toBe('send_money');
    expect(state.status).toBe('collecting');
    expect(state.missingParameters).toContain('amount');
    expect(state.parameters.recipient).toBe('01710000002');

    // Turn 2: User provides only the amount ("500")
    const res2 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: '500',
        language: 'en',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.pendingAction).toBeTruthy();
    expect(res2.body.pendingAction.tool).toBe('send_money');
    expect(res2.body.pendingAction.preview.recipientPhone).toBe('01710000002');
    expect(res2.body.pendingAction.preview.amountPoisha).toBe(50000);

    // Should return clientAction to auto-open and prefill modal
    expect(res2.body.clientAction).toBeTruthy();
    expect(res2.body.clientAction.type).toBe('open_modal');
    expect(res2.body.clientAction.modal).toBe('send');
    expect(res2.body.clientAction.prefill.recipient).toBe('01710000002');
    expect(Number(res2.body.clientAction.prefill.amount)).toBe(500);

    // Check notification creation
    const notif = await Notification.findOne({
      userId: userMe.id || userMe._id,
      type: 'copilot',
    });
    expect(notif).toBeTruthy();
  });

  it('2. should handle in-flight user correction ("Actually make it 800")', async () => {
    // Initial request
    const res1 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Send 500 to 01710000002',
        language: 'en',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.pendingAction).toBeTruthy();
    expect(res1.body.pendingAction.preview.amountPoisha).toBe(50000);

    // Correction turn
    const res2 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Wait, actually make it 800',
        language: 'en',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.pendingAction).toBeTruthy();
    expect(res2.body.pendingAction.tool).toBe('send_money');
    expect(res2.body.pendingAction.preview.amountPoisha).toBe(80000);
    expect(Number(res2.body.clientAction.prefill.amount)).toBe(800);
  });

  it('3. should handle natural cancellation ("Cancel" / "বাতিল করো")', async () => {
    // Start an action
    await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Recharge 100 to 01710000002',
        language: 'en',
      });

    // Cancel it
    const cancelRes = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Cancel this',
        language: 'en',
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.reply).toMatch(/cancelled|বাতিল/i);
    expect(cancelRes.body.pendingAction).toBeFalsy();

    // Verify state was cleared or cancelled in DB
    const state = await CopilotActionState.findOne({ userId: userMe.id || userMe._id });
    expect(state.status).toBe('cancelled');
  });

  it('4. should handle multi-turn mobile recharge starting with amount first', async () => {
    // Turn 1: Amount only
    const res1 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Recharge 50 taka',
        language: 'en',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.pendingAction).toBeFalsy();
    expect(res1.body.reply).toMatch(/number|phone|নম্বর/i);

    // Turn 2: Provide the phone number
    const res2 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: '01710000002',
        language: 'en',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.pendingAction).toBeTruthy();
    expect(res2.body.pendingAction.tool).toBe('mobile_recharge');
    expect(res2.body.pendingAction.preview.recipientPhone).toBe('01710000002');
    expect(res2.body.pendingAction.preview.amountPoisha).toBe(5000);
    expect(res2.body.clientAction?.modal).toBe('recharge');
  });
});
