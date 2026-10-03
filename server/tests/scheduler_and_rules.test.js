import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { register } from '../src/services/auth.service.js';
import { createSchedule, executeScheduledJob } from '../src/services/scheduler.service.js';
import { createRule, handleWalletCreditEvent } from '../src/services/rule.service.js';
import { Wallet, Transaction, Schedule, Rule } from '../src/models/index.js';

describe('14, 16, 17, 19: Persistent Scheduler & Conditional Rules Engine', () => {
  let userA, userB;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const regA = await register({ phone: '01710000010', pin: '1234', name: 'User A' });
    userA = regA.user;

    const regB = await register({ phone: '01710000020', pin: '1234', name: 'User B' });
    userB = regB.user;
  });

  it('Scheduled one-time send money executes successfully and adheres to mandate limit', async () => {
    const schedule = await createSchedule({
      userId: userA.id,
      actionType: 'send_money',
      frequency: 'one_time',
      actionPayload: { recipientPhone: userB.phone, amountPoisha: 50000 }, // ৳500
      nextRunAt: new Date(),
      mandate: { maxAmountPerRun: 100000 }, // ৳1,000 max
    });

    expect(schedule.status).toBe('active');

    // Execute scheduled job
    await executeScheduledJob(schedule);

    const updatedSchedule = await Schedule.findById(schedule._id);
    expect(updatedSchedule.status).toBe('completed');

    // Verify User A balance decreased by ৳500 and User B increased
    const walletA = await Wallet.findOne({ userId: userA.id });
    const walletB = await Wallet.findOne({ userId: userB.id });

    expect(walletA.balance).toBe(950000); // 10,000 - 500
    expect(walletB.balance).toBe(1050000); // 10,000 + 500
  });

  it('Schedule mandate rejects attempts exceeding maxAmountPerRun', async () => {
    const schedule = await createSchedule({
      userId: userA.id,
      actionType: 'send_money',
      frequency: 'one_time',
      actionPayload: { recipientPhone: userB.phone, amountPoisha: 200000 }, // ৳2,000
      nextRunAt: new Date(),
      mandate: { maxAmountPerRun: 100000 }, // ৳1,000 max allowed
    });

    await expect(executeScheduledJob(schedule)).rejects.toThrow('exceeds scheduled mandate limit');
  });

  it('Conditional Rule: WHEN wallet receives ৳1,000 or more, THEN automatically pay electricity bill', async () => {
    // 1. Create rule: When wallet_credit >= 100,000 poisha (৳1,000), pay DPDC bill of ৳1,200 (120,000 poisha)
    const rule = await createRule({
      userId: userA.id,
      trigger: { type: 'wallet_credit', minAmount: 100000 },
      action: { type: 'pay_bill', billerId: 'DPDC', billAccountNo: '442109', amount: 120000 },
      mandate: { maxAmountPerRun: 200000 },
    });

    expect(rule.status).toBe('active');

    // 2. Simulate wallet credit event of ৳2,000 (200,000 poisha)
    await handleWalletCreditEvent({
      userId: userA.id,
      amountPoisha: 200000,
      senderPhone: 'Demo Bank',
    });

    // 3. Verify rule was executed and bill transaction was created
    const billTxn = await Transaction.findOne({ senderUserId: userA.id, type: 'bill', channel: 'rule' });
    expect(billTxn).toBeDefined();
    expect(billTxn.amount).toBe(120000);
    expect(billTxn.status).toBe('settled');

    const updatedRule = await Rule.findById(rule._id);
    expect(updatedRule.executionCount).toBe(1);

    // Verify wallet was debited for the bill
    const walletA = await Wallet.findOne({ userId: userA.id });
    expect(walletA.balance).toBe(1000000 - 120000); // 880,000 poisha (৳8,800)
  });
});
