import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';
import {
  User,
  Wallet,
  FinancialMemory,
  CopilotMessage,
} from '../src/models/index.js';
import { processAgentMessage } from '../src/services/agentCopilot.service.js';

describe('AI Copilot Memory & Contextual Learning Suite', () => {
  let userMe, tokenMe;
  let userRakib;
  let userKarim;

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

    // 2. Rakib
    const resRakib = await request(app).post('/api/auth/register').send({
      phone: '01710000002',
      pin: '1234',
      name: 'Rakib',
      accountType: 'CUSTOMER',
    });
    userRakib = resRakib.body.user;

    // 3. Karim
    const resKarim = await request(app).post('/api/auth/register').send({
      phone: '01710000003',
      pin: '1234',
      name: 'Karim',
      accountType: 'CUSTOMER',
    });
    userKarim = resKarim.body.user;

    // Fund userMe wallet with ৳50,000 (5,000,000 poisha)
    await Wallet.findOneAndUpdate(
      { userId: userMe.id || userMe._id },
      { $set: { balancePoisha: 5000000 } }
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('1. should remember contact alias via natural language ("Remember that Rakib is my brother")', async () => {
    const res = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Remember that Rakib is my brother',
        language: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/recorded|brother|Rakib/i);

    const memory = await FinancialMemory.findOne({ userId: userMe.id || userMe._id });
    expect(memory).toBeTruthy();
    expect(memory.contactAliases.length).toBeGreaterThanOrEqual(1);

    const alias = memory.contactAliases.find((a) => a.alias === 'brother');
    expect(alias).toBeTruthy();
    expect(alias.name).toBe('Rakib');
    expect(alias.phone).toBe('01710000002');
  });

  it('2. should automatically resolve recipient alias during send money ("Send 500 to my brother")', async () => {
    const res = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Send 500 to my brother',
        language: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.pendingAction).toBeTruthy();
    expect(res.body.pendingAction.tool).toBe('send_money');
    expect(res.body.pendingAction.preview.recipientName).toBe('Rakib');
    expect(res.body.pendingAction.preview.recipientPhone).toBe('01710000002');
    expect(res.body.pendingAction.preview.amountPoisha).toBe(50000);
  });

  it('3. should remember utility account and resolve it when paying bills ("Remember DESCO account 442109")', async () => {
    const memRes = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Remember DESCO account 442109',
        language: 'en',
      });

    expect(memRes.status).toBe(200);
    expect(memRes.body.reply).toMatch(/DESCO|442109/i);

    // Now pay DESCO bill without specifying the account number
    const billRes = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Pay DESCO bill 1200',
        language: 'en',
      });

    expect(billRes.status).toBe(200);
    expect(billRes.body.pendingAction).toBeTruthy();
    expect(billRes.body.pendingAction.tool).toBe('pay_bill');
    expect(billRes.body.pendingAction.preview.details.biller).toBe('DESCO');
    expect(billRes.body.pendingAction.preview.details.accountNumber).toBe('442109');
    expect(billRes.body.pendingAction.preview.amountPoisha).toBe(120000);
  });

  it('4. should remember contextual user notes and recall all memories ("What do you remember about me?")', async () => {
    // Add custom note
    await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Remember that I prefer paying rent in the first week',
        language: 'en',
      });

    // Recall memory via natural language
    const recallRes = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'What do you remember about me?',
        language: 'en',
      });

    expect(recallRes.status).toBe(200);
    expect(recallRes.body.reply).toMatch(/Rakib/i);
    expect(recallRes.body.reply).toMatch(/DESCO/i);
    expect(recallRes.body.reply).toMatch(/rent/i);

    // Also test GET /api/copilot/memory endpoint
    const apiMem = await request(app)
      .get('/api/copilot/memory')
      .set('Authorization', `Bearer ${tokenMe}`);

    expect(apiMem.status).toBe(200);
    expect(apiMem.body.contactAliases.length).toBeGreaterThanOrEqual(1);
    expect(apiMem.body.utilityAccounts.length).toBeGreaterThanOrEqual(1);
  });

  it('5. should forget specific memory fact ("Forget that Rakib is my brother")', async () => {
    const res = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'Forget that Rakib is my brother',
        language: 'en',
      });

    expect(res.status).toBe(200);

    const memory = await FinancialMemory.findOne({ userId: userMe.id || userMe._id });
    const brotherAlias = memory.contactAliases.find((a) => a.alias === 'brother');
    expect(brotherAlias).toBeUndefined();
  });

  it('6. should persist conversation history and support clear history', async () => {
    const histRes = await request(app)
      .get('/api/copilot/history')
      .set('Authorization', `Bearer ${tokenMe}`);

    expect(histRes.status).toBe(200);
    expect(histRes.body.history.length).toBeGreaterThan(0);

    // Verify chronological order and sender fields
    const firstMsg = histRes.body.history[0];
    expect(firstMsg).toHaveProperty('sender');
    expect(firstMsg).toHaveProperty('text');

    // Clear history
    const delRes = await request(app)
      .delete('/api/copilot/history')
      .set('Authorization', `Bearer ${tokenMe}`);

    expect(delRes.status).toBe(200);

    const emptyHist = await request(app)
      .get('/api/copilot/history')
      .set('Authorization', `Bearer ${tokenMe}`);

    expect(emptyHist.body.history.length).toBe(0);
  });

  it('7. should clear all user memory on DELETE /api/copilot/memory', async () => {
    const clearRes = await request(app)
      .delete('/api/copilot/memory')
      .set('Authorization', `Bearer ${tokenMe}`);

    expect(clearRes.status).toBe(200);

    const memory = await FinancialMemory.findOne({ userId: userMe.id || userMe._id });
    expect(memory.contactAliases.length).toBe(0);
    expect(memory.utilityAccounts.length).toBe(0);
    expect(memory.userContextNotes.length).toBe(0);
  });
});
