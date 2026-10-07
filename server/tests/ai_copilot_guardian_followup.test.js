import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';

describe('AI Copilot Guardian Multi-Turn Follow-Up', () => {
  let tokenMe;

  beforeAll(async () => {
    await setupTestDb();

    const resMe = await request(app).post('/api/auth/register').send({
      phone: '01710000001',
      pin: '1234',
      name: 'Parent User',
      accountType: 'CUSTOMER',
    });
    tokenMe = resMe.body.tokens.accessToken;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('correctly handles "add children" followed by phone number "01774474900"', async () => {
    // Turn 1: Incomplete command
    const res1 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'add children',
        language: 'en',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.reply).toContain('Please provide the guardian or child phone number');

    // Turn 2: Follow-up with raw phone number
    const res2 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: '01774474900',
        language: 'en',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.reply).toContain('01774474900');
    expect(res2.body.reply).toContain('Guardian');
    expect(res2.body.clientAction).toBeDefined();
    expect(res2.body.clientAction.type).toBe('open_modal');
    expect(res2.body.clientAction.modal).toBe('guardian');
    expect(res2.body.clientAction.prefill.childPhone).toBe('01774474900');
  });

  it('correctly handles composite "01774474900 add children and limit 800 tk dao"', async () => {
    const res = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: '01774474900 add children and limit 800 tk dao',
        language: 'bn',
      });

    expect(res.status).toBe(200);
    expect(res.body.clientAction).toBeDefined();
    expect(res.body.clientAction.type).toBe('open_modal');
    expect(res.body.clientAction.modal).toBe('guardian');
    expect(res.body.clientAction.prefill.childPhone).toBe('01774474900');
    expect(res.body.clientAction.prefill.dailyLimit).toBe('800');
    expect(res.body.reply).toContain('01774474900');
    expect(res.body.reply).toContain('800');
  });

  it('correctly handles "gchildren add koro 900 tk liimit die" and preserves 900 limit in followup', async () => {
    // Turn 1: Add child with custom limit and typo, phone not yet provided
    const res1 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: 'gchildren add koro 900 tk liimit die',
        language: 'bn',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.clientAction).toBeDefined();
    expect(res1.body.clientAction.type).toBe('open_modal');
    expect(res1.body.clientAction.modal).toBe('guardian');
    expect(res1.body.clientAction.prefill.dailyLimit).toBe('900');
    expect(res1.body.reply).toContain('900');

    // Turn 2: Providing phone number completes the workflow with 900 limit
    const res2 = await request(app)
      .post('/api/copilot/message')
      .set('Authorization', `Bearer ${tokenMe}`)
      .send({
        message: '01774474900',
        language: 'bn',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.clientAction).toBeDefined();
    expect(res2.body.clientAction.type).toBe('open_modal');
    expect(res2.body.clientAction.modal).toBe('guardian');
    expect(res2.body.clientAction.prefill.childPhone).toBe('01774474900');
    expect(res2.body.clientAction.prefill.dailyLimit).toBe('900');
    expect(res2.body.reply).toContain('01774474900');
    expect(res2.body.reply).toContain('900');
  });
});
