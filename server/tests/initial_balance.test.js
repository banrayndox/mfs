import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { register } from '../src/services/auth.service.js';
import { Wallet, LedgerEntry, Transaction } from '../src/models/index.js';

describe('1 & 2: Initial Demo Balance & Ledger Integrity', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('newly registered customer must receive exactly ৳10,000 demo balance with auditable ledger entry', async () => {
    const { user, walletBalancePoisha } = await register({
      phone: '01711112222',
      pin: '1234',
      name: 'Rakib Ahmed',
      accountType: 'CUSTOMER',
    });

    // 1. Balance must be exactly ৳10,000 (1,000,000 poisha)
    expect(walletBalancePoisha).toBe(1000000);

    const wallet = await Wallet.findOne({ userId: user.id });
    expect(wallet).toBeDefined();
    expect(wallet.balance).toBe(1000000);

    // 2. Transaction must exist
    const txn = await Transaction.findOne({ recipientUserId: user.id, type: 'initial_credit' });
    expect(txn).toBeDefined();
    expect(txn.amount).toBe(1000000);
    expect(txn.status).toBe('settled');

    // 3. LedgerEntry must exist and match wallet balance
    const ledger = await LedgerEntry.findOne({ walletId: wallet._id, direction: 'credit' });
    expect(ledger).toBeDefined();
    expect(ledger.amount).toBe(1000000);
    expect(ledger.balanceAfter).toBe(1000000);
  });

  it('newly registered agent must also receive ৳10,000 demo balance and agent profile', async () => {
    const { user, walletBalancePoisha } = await register({
      phone: '01799998888',
      pin: '4321',
      name: 'Rahim Cash Point',
      accountType: 'AGENT',
      agentProfile: {
        businessName: 'Rahim Cash Point',
        location: 'Mirpur, Dhaka',
      },
    });

    expect(walletBalancePoisha).toBe(1000000);
    expect(user.accountType).toBe('AGENT');
    expect(user.role).toBe('agent');
    expect(user.agentProfile?.agentId).toBeDefined();

    const wallet = await Wallet.findOne({ userId: user.id, type: 'agent' });
    expect(wallet.balance).toBe(1000000);
  });
});
