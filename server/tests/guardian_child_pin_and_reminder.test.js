import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { app } from '../src/app.js';
import { Reminder, Notification, ProtectedProfile } from '../src/models/index.js';
import { pollAndExecuteDueReminders } from '../src/services/scheduler.service.js';

describe('Guardian Child PIN & Scheduler Reminder Realtime Integration', () => {
  let guardianToken;
  let guardianUser;

  beforeAll(async () => {
    await setupTestDb();

    // Register Guardian Parent
    const phone = `0171${Math.floor(1000000 + Math.random() * 9000000)}`;
    const regRes = await request(app).post('/api/auth/register').send({
      phone,
      pin: '1234',
      name: 'Guardian Parent Tester',
      accountType: 'CUSTOMER',
    });
    guardianToken = regRes.body.tokens.accessToken;
    guardianUser = regRes.body.user;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Guardian Child Account Creation - PIN Validation', () => {
    it('rejects child creation if 4-digit PIN is missing', async () => {
      const childPhone = `0172${Math.floor(1000000 + Math.random() * 9000000)}`;
      const res = await request(app)
        .post('/api/guardians/child')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({
          name: 'Child No PIN',
          phone: childPhone,
          dailyLimitPoisha: 50000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/পিন নম্বর আবশ্যক|PIN is required/i);
    });

    it('rejects child creation if PIN is not exactly 4 numeric digits', async () => {
      const childPhone = `0173${Math.floor(1000000 + Math.random() * 9000000)}`;
      const res = await request(app)
        .post('/api/guardians/child')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({
          name: 'Child Invalid PIN',
          phone: childPhone,
          pin: '12', // only 2 digits
          dailyLimitPoisha: 50000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('successfully creates child profile when valid 4-digit PIN is provided', async () => {
      const childPhone = `0174${Math.floor(1000000 + Math.random() * 9000000)}`;
      const res = await request(app)
        .post('/api/guardians/child')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({
          name: 'Child With PIN',
          phone: childPhone,
          pin: '5678',
          dailyLimitPoisha: 100000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.childUser).toBeDefined();
      expect(res.body.childUser.phone).toBe(childPhone);

      const profile = await ProtectedProfile.findOne({ childUserId: res.body.childUser.id });
      expect(profile).toBeDefined();
      expect(profile.dailyLimitPoisha).toBe(100000);
    });
  });

  describe('Scheduler Due Reminder Polling & Notifications', () => {
    it('polls due reminders, marks them completed and generates notifications', async () => {
      // 1. Create a due reminder in database
      const duePast = new Date(Date.now() - 60000); // 1 minute ago
      const reminder = await Reminder.create({
        userId: guardianUser.id,
        title: 'Electricity Bill Payment Due',
        dueAt: duePast,
        amount: 850,
        source: 'manual',
        isCompleted: false,
      });

      expect(reminder.isCompleted).toBe(false);

      // 2. Run pollAndExecuteDueReminders()
      await pollAndExecuteDueReminders();

      // 3. Verify reminder is marked completed
      const updatedReminder = await Reminder.findById(reminder._id);
      expect(updatedReminder.isCompleted).toBe(true);
      expect(updatedReminder.completedAt).toBeDefined();

      // 4. Verify Notification was created
      const notif = await Notification.findOne({
        userId: guardianUser.id,
        type: 'reminder',
        'metadata.reminderId': reminder._id,
      });
      expect(notif).toBeDefined();
      expect(notif.title).toContain('রিমাইন্ডার');
      expect(notif.body).toContain('Electricity Bill Payment Due');
    });
  });
});
