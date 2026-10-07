import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';
import { SavingsPlan } from '../src/models/index.js';

describe('AI Copilot Domain Agents & Specialized Tool Calling', () => {
  let tokenMe, userIdMe;
  let tokenRakib, userIdRakib;

  beforeAll(async () => {
    await setupTestDb();

    const resMe = await request(app).post('/api/auth/register').send({
      phone: '01710000001',
      pin: '1234',
      name: 'Main User',
      accountType: 'CUSTOMER',
    });
    tokenMe = resMe.body.tokens.accessToken;
    userIdMe = resMe.body.user._id || resMe.body.user.id;

    const resRakib = await request(app).post('/api/auth/register').send({
      phone: '01710000002',
      pin: '1234',
      name: 'Rakib',
      accountType: 'CUSTOMER',
    });
    tokenRakib = resRakib.body.tokens.accessToken;
    userIdRakib = resRakib.body.user._id || resRakib.body.user.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('1. SavingsAgent - Complete Manual Capabilities', () => {
    it('configures percentage micro-savings (5%)', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'set savings to 5%', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain('5%');
      expect(res.body.clientAction?.modal).toBe('savings');
    });

    it('enables round-up savings mode', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'enable round-up savings', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain('Round-up');
      expect(res.body.clientAction?.modal).toBe('savings');
    });

    it('pauses and resumes micro-savings', async () => {
      const resPause = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'pause savings', language: 'en' });

      expect(resPause.status).toBe(200);
      expect(resPause.body.reply).toContain('paused');

      const resResume = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'resume savings', language: 'en' });

      expect(resResume.status).toBe(200);
      expect(resResume.body.reply).toContain('resumed');
    });

    it('creates a new savings goal with target and recommendation pace', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'create 25000 taka laptop goal', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain('25,000');
      expect(res.body.clientAction?.modal).toBe('savings');

      const plan = await SavingsPlan.findOne({ userId: userIdMe, title: /laptop/i });
      expect(plan).toBeDefined();
      expect(plan.targetAmountPoisha).toBe(2500000);
    });

    it('creates a safe PendingAction for direct savings deposit', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'deposit 500 to savings', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.pendingAction).toBeDefined();
      expect(res.body.pendingAction.preview.amountPoisha).toBe(50000);
      expect(res.body.pendingAction.requiredTier).toBe('T2');
    });

    it('queries grounded savings progress', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'show my savings progress', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain('সঞ্চয়');
      expect(res.body.clientAction?.modal).toBe('savings');
    });
  });

  describe('2. GuardianAgent - Child Accounts, Limits & Approvals', () => {
    it('handles typo command with custom limit ("gchildren add koro 900 tk liimit die")', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'gchildren add koro 900 tk liimit die', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('guardian');
      expect(res.body.clientAction?.prefill.dailyLimit).toBe('900');
    });

    it('handles composite command with phone and custom limit', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: '01774474900 add children and limit 800 tk dao', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('guardian');
      expect(res.body.clientAction?.prefill.childPhone).toBe('01774474900');
      expect(res.body.clientAction?.prefill.dailyLimit).toBe('800');
    });

    it('queries guardian profile status', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'my children status', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('guardian');
      expect(res.body.reply).toContain('Guardian');
    });
  });

  describe('3. GroupBillAgent - Request Money & Bill Splitting', () => {
    it('handles individual payment request with prefilled modal', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'request 650 from 01710000002', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('request');
      expect(res.body.clientAction?.prefill.amount).toBe('650');
      expect(res.body.clientAction?.prefill.phone).toBe('01710000002');
    });

    it('calculates equal group bill split and prefills modal', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'split 2400 for dinner with Rahim and Karim', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('group_bill');
      expect(res.body.clientAction?.prefill.totalAmount).toBe('2400');
      expect(res.body.clientAction?.prefill.perPerson).toBe('800');
    });
  });

  describe('4. ScheduleRuleAgent - Automation, Reminders & Recurring', () => {
    it('sets up a conditional automation rule modal', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'when money comes save 500', language: 'bn' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('rules');
      expect(res.body.clientAction?.prefill.amount).toBe('500');
    });

    it('sets up recurring schedule modal', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'every friday send 300 to 01710000002', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('scheduled');
      expect(res.body.clientAction?.prefill.amount).toBe('300');
      expect(res.body.clientAction?.prefill.frequency).toBe('weekly');
    });

    it('sets up one-time reminder modal', async () => {
      const res = await request(app)
        .post('/api/copilot/message')
        .set('Authorization', `Bearer ${tokenMe}`)
        .send({ message: 'remind me tomorrow to pay electric bill', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.clientAction?.modal).toBe('rules');
      expect(res.body.reply).toContain('reminder');
    });
  });
});
