import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { register } from '../src/services/auth.service.js';
import { sendMoney } from '../src/services/transaction.service.js';
import { getPendingApprovals, decideGuardianApproval } from '../src/services/guardian.service.js';
import { Wallet, LedgerEntry, Transaction, ProtectedProfile, Notification } from '../src/models/index.js';

describe('Parent/Child Accounts, Guardian Approvals & Security Boundaries', () => {
  let parentUser, recipientUser, childUser;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register Parent (Customer Rakib)
    const regParent = await register({
      phone: '01711112222',
      pin: '1234',
      name: 'Rakib Parent',
      accountType: 'CUSTOMER',
    });
    parentUser = regParent.user;

    // 2. Register Recipient (Rahim)
    const regRecipient = await register({
      phone: '01733334444',
      pin: '1234',
      name: 'Rahim Recipient',
      accountType: 'CUSTOMER',
    });
    recipientUser = regRecipient.user;
  });

  it('fails child registration if parent phone number is not registered', async () => {
    await expect(
      register({
        phone: '01799887766',
        pin: '1234',
        name: 'Abir Child',
        accountType: 'CHILD',
        parentPhone: '01700000000', // Non-existent parent
      })
    ).rejects.toThrow('Parent phone number is not registered in Guardian MFS.');
  });

  it('successfully registers child, links to parent, and grants ৳10,000 initial balance', async () => {
    const regChild = await register({
      phone: '01799887766',
      pin: '1234',
      name: 'Abir Child',
      accountType: 'CHILD',
      parentPhone: parentUser.phone,
      dailyLimitPoisha: 50000, // ৳500 daily limit
    });
    childUser = regChild.user;

    expect(childUser.accountType).toBe('CHILD');
    expect(regChild.walletBalancePoisha).toBe(1000000); // ৳10,000 demo float

    // Verify ProtectedProfile was created
    const profile = await ProtectedProfile.findOne({ childUserId: childUser.id });
    expect(profile).not.toBeNull();
    expect(profile.guardianId.toString()).toBe(parentUser.id);
    expect(profile.dailyLimitPoisha).toBe(50000);
    expect(profile.requireApprovalForNewRecipients).toBe(true);

    // Verify parent received notification
    const notif = await Notification.findOne({ userId: parentUser.id, type: 'system' });
    expect(notif).not.toBeNull();
    expect(notif.body).toContain('Abir Child');
  });

  it('holds child transaction for guardian approval when sending money', async () => {
    // Register child
    const regChild = await register({
      phone: '01799887766',
      pin: '1234',
      name: 'Abir Child',
      accountType: 'CHILD',
      parentPhone: parentUser.phone,
      dailyLimitPoisha: 50000, // ৳500
    });
    childUser = regChild.user;

    // Child attempts to send ৳600 (60,000 poisha, exceeds ৳500 limit)
    const txn = await sendMoney({
      senderUserId: childUser.id,
      recipientPhone: recipientUser.phone,
      amountPoisha: 60000,
      channel: 'ui',
    });

    expect(txn.status).toBe('awaiting_guardian');
    expect(txn.metadata.isChild).toBe(true);

    // Verify money was NOT transferred yet
    const childWallet = await Wallet.findOne({ userId: childUser.id, type: 'primary' });
    const recipientWallet = await Wallet.findOne({ userId: recipientUser.id, type: 'primary' });
    expect(childWallet.balance).toBe(1000000); // Intact ৳10,000
    expect(recipientWallet.balance).toBe(1000000); // Intact ৳10,000

    // Guardian pending approvals should list this transaction
    const pendingList = await getPendingApprovals(parentUser.id);
    expect(pendingList.length).toBe(1);
    expect(pendingList[0].amountPoisha).toBe(60000);
    expect(pendingList[0].sender.phone).toBe(childUser.phone);
  });

  it('prevents IDOR: non-guardian user cannot approve or reject child transaction', async () => {
    const regChild = await register({
      phone: '01799887766',
      pin: '1234',
      name: 'Abir Child',
      accountType: 'CHILD',
      parentPhone: parentUser.phone,
      dailyLimitPoisha: 50000,
    });
    childUser = regChild.user;

    const txn = await sendMoney({
      senderUserId: childUser.id,
      recipientPhone: recipientUser.phone,
      amountPoisha: 30000,
    });

    // Recipient (or child himself) attempts to decide the approval
    await expect(
      decideGuardianApproval({
        guardianUserId: recipientUser.id, // Not the guardian!
        txnId: txn._id,
        decision: 'approve',
      })
    ).rejects.toThrow('Unauthorized: You are not the registered guardian for this account.');

    await expect(
      decideGuardianApproval({
        guardianUserId: childUser.id, // Child cannot approve own txn!
        txnId: txn._id,
        decision: 'approve',
      })
    ).rejects.toThrow('Unauthorized: You are not the registered guardian for this account.');
  });

  it('guardian rejects transaction: status transitions to cancelled and no funds move', async () => {
    const regChild = await register({
      phone: '01799887766',
      pin: '1234',
      name: 'Abir Child',
      accountType: 'CHILD',
      parentPhone: parentUser.phone,
      dailyLimitPoisha: 50000,
    });
    childUser = regChild.user;

    const txn = await sendMoney({
      senderUserId: childUser.id,
      recipientPhone: recipientUser.phone,
      amountPoisha: 40000,
    });

    const result = await decideGuardianApproval({
      guardianUserId: parentUser.id,
      txnId: txn._id,
      decision: 'reject',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('cancelled');

    const updatedTxn = await Transaction.findById(txn._id);
    expect(updatedTxn.status).toBe('cancelled');

    // Wallets remain unchanged
    const childWallet = await Wallet.findOne({ userId: childUser.id, type: 'primary' });
    expect(childWallet.balance).toBe(1000000);
  });

  it('guardian approves transaction: atomic ledger transfer executes and balances update', async () => {
    const regChild = await register({
      phone: '01799887766',
      pin: '1234',
      name: 'Abir Child',
      accountType: 'CHILD',
      parentPhone: parentUser.phone,
      dailyLimitPoisha: 50000,
    });
    childUser = regChild.user;

    // Send ৳400 (40,000 poisha, fee 0)
    const txn = await sendMoney({
      senderUserId: childUser.id,
      recipientPhone: recipientUser.phone,
      amountPoisha: 40000,
    });

    const result = await decideGuardianApproval({
      guardianUserId: parentUser.id,
      txnId: txn._id,
      decision: 'approve',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('settled');

    // Child balance: 10,000 - 400 = ৳9,600 (960,000 poisha)
    const childWallet = await Wallet.findOne({ userId: childUser.id, type: 'primary' });
    expect(childWallet.balance).toBe(960000);

    // Recipient balance: 10,000 + 400 = ৳10,400 (1,040,000 poisha)
    const recipientWallet = await Wallet.findOne({ userId: recipientUser.id, type: 'primary' });
    expect(recipientWallet.balance).toBe(1040000);

    // Verify double-entry ledger entries exist
    const ledgerEntries = await LedgerEntry.find({ txnId: txn._id });
    expect(ledgerEntries.length).toBe(2);

    const debit = ledgerEntries.find((e) => e.direction === 'debit');
    const credit = ledgerEntries.find((e) => e.direction === 'credit');
    expect(debit.amount).toBe(40000);
    expect(credit.amount).toBe(40000);
  });
});
