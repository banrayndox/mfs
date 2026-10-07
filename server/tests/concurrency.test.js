import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { register } from '../src/services/auth.service.js';
import { sendMoney } from '../src/services/transaction.service.js';
import { Wallet } from '../src/models/index.js';

describe('35: Transaction Concurrency & Anti-Overdraft Invariant', () => {
  let userA, userB;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Register User A
    const regA = await register({
      phone: '01710000001',
      pin: '1234',
      name: 'User A',
    });
    userA = regA.user;

    // Register User B
    const regB = await register({
      phone: '01710000002',
      pin: '1234',
      name: 'User B',
    });
    userB = regB.user;

    // Set User A balance to exactly ৳1,000 (100,000 poisha)
    await Wallet.findOneAndUpdate({ userId: userA.id }, { balance: 100000 });
  });

  it('two simultaneous ৳800 spends on a ৳1,000 balance must settle only ONE payment and never go negative', async () => {
    // ৳800 = 80,000 poisha. Fee for ৳800 is 0.
    const promise1 = sendMoney({
      senderUserId: userA.id,
      recipientPhone: userB.phone,
      amountPoisha: 80000,
      idempotencyKey: 'concurrent-1',
    });

    const promise2 = sendMoney({
      senderUserId: userA.id,
      recipientPhone: userB.phone,
      amountPoisha: 80000,
      idempotencyKey: 'concurrent-2',
    });

    const results = await Promise.allSettled([promise1, promise2]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed and one must fail
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Balance must be exactly ৳200 (20,000 poisha), NEVER negative!
    const walletA = await Wallet.findOne({ userId: userA.id });
    expect(walletA.balance).toBe(20000);
    expect(walletA.balance).toBeGreaterThanOrEqual(0);
  });
});
