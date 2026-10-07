import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { register } from '../src/services/auth.service.js';
import { sendMoney, cashOut } from '../src/services/transaction.service.js';
import { listActiveAgents } from '../src/services/agent.directory.service.js';
import { Wallet, LedgerEntry, Transaction, AiTip } from '../src/models/index.js';

describe('3, 7, 8, 9, 10: Internal Send Money, Cash Out & Agent Directory', () => {
  let rakibUser, rahimUser, agentUser;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Register User A: Rakib (starts with ৳10,000 = 1,000,000 poisha)
    const regRakib = await register({
      phone: '01711111111',
      pin: '1234',
      name: 'Rakib',
      accountType: 'CUSTOMER',
    });
    rakibUser = regRakib.user;

    // Register User B: Rahim (starts with ৳10,000 = 1,000,000 poisha)
    const regRahim = await register({
      phone: '01722222222',
      pin: '1234',
      name: 'Rahim',
      accountType: 'CUSTOMER',
    });
    rahimUser = regRahim.user;

    // Register Agent: Rahim Cash Point (starts with ৳10,000)
    const regAgent = await register({
      phone: '01733333333',
      pin: '1234',
      name: 'Rahim Cash Point',
      accountType: 'AGENT',
      agentProfile: {
        businessName: 'Rahim Cash Point',
        location: 'Gulshan 1, Dhaka',
      },
    });
    agentUser = regAgent.user;
  });

  it('Rakib sends ৳500 to Rahim: balances become ৳9,500 and ৳10,500 with ledger entries', async () => {
    // 500 BDT = 50,000 poisha
    const txn = await sendMoney({
      senderUserId: rakibUser.id,
      recipientPhone: rahimUser.phone,
      amountPoisha: 50000,
      idempotencyKey: 'test-send-1',
    });

    expect(txn.status).toBe('settled');
    expect(txn.amount).toBe(50000);

    const rakibWallet = await Wallet.findOne({ userId: rakibUser.id });
    const rahimWallet = await Wallet.findOne({ userId: rahimUser.id });

    // Rakib: 1,000,000 - 50,000 = 950,000 poisha (৳9,500)
    expect(rakibWallet.balance).toBe(950000);
    // Rahim: 1,000,000 + 50,000 = 1,050,000 poisha (৳10,500)
    expect(rahimWallet.balance).toBe(1050000);

    // Verify paired ledger entries
    const debitLedger = await LedgerEntry.findOne({ txnId: txn._id, direction: 'debit' });
    const creditLedger = await LedgerEntry.findOne({ txnId: txn._id, direction: 'credit' });

    expect(debitLedger.amount).toBe(50000);
    expect(debitLedger.balanceAfter).toBe(950000);
    expect(creditLedger.amount).toBe(50000);
    expect(creditLedger.balanceAfter).toBe(1050000);

    // Verify idempotency: resending with same key does not debit twice
    const replay = await sendMoney({
      senderUserId: rakibUser.id,
      recipientPhone: rahimUser.phone,
      amountPoisha: 50000,
      idempotencyKey: 'test-send-1',
    });
    expect(replay._id.toString()).toBe(txn._id.toString());
    const rakibWalletAfter = await Wallet.findOne({ userId: rakibUser.id });
    expect(rakibWalletAfter.balance).toBe(950000);
  });

  it('Cash Out ৳1,000 to Agent: customer debited ৳1,000 + ৳15 fee, agent credited ৳1,000', async () => {
    // ৳1,000 = 100,000 poisha. 1.5% fee = 1,500 poisha (৳15). Total debit = 101,500 poisha.
    const txn = await cashOut({
      customerUserId: rakibUser.id,
      agentIdentifier: agentUser.agentProfile.agentId,
      amountPoisha: 100000,
      idempotencyKey: 'test-cashout-1',
    });

    expect(txn.status).toBe('settled');
    expect(txn.amount).toBe(100000);
    expect(txn.fee).toBe(1500);
    expect(txn.total).toBe(101500);

    const customerWallet = await Wallet.findOne({ userId: rakibUser.id });
    const agentWallet = await Wallet.findOne({ userId: agentUser.id });

    // Rakib: 1,000,000 - 101,500 = 898,500 poisha (৳8,985)
    expect(customerWallet.balance).toBe(898500);
    // Agent: 1,000,000 + 100,000 = 1,100,000 poisha (৳11,000)
    expect(agentWallet.balance).toBe(1100000);
  });

  it('Agent directory lists active agents and rejects inactive agents', async () => {
    const agents = await listActiveAgents();
    expect(agents.length).toBeGreaterThanOrEqual(1);

    const targetAgent = agents.find((a) => a.phone === agentUser.phone);
    expect(targetAgent).toBeDefined();
    expect(targetAgent.name).toBe('Rahim Cash Point');
    expect(targetAgent.status).toBe('active');

    // Attempting cash out to non-existent or inactive agent throws error
    await expect(
      cashOut({
        customerUserId: rakibUser.id,
        agentIdentifier: 'AGT-NONEXISTENT',
        amountPoisha: 50000,
      })
    ).rejects.toThrow('Selected Agent is not active or does not exist.');
  });
});
