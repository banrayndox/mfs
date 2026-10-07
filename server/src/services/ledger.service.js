import mongoose from 'mongoose';
import { Wallet, LedgerEntry, Transaction, Notification, AuditLog } from '../models/index.js';
import logger from '../utils/logger.js';

export const INITIAL_DEMO_BALANCE_POISHA = 1000000; // ৳10,000 in integer poisha

/**
 * Creates initial demo balance (৳10,000) for a newly registered account.
 * Must run inside an atomic MongoDB transaction.
 * Creates an initial-credit transaction, an append-only ledger entry, and a welcome notification.
 */
export async function createInitialBalance({ userId, walletId, session }) {
  if (!userId || !walletId) {
    throw new Error('userId and walletId are required for initial balance creation');
  }

  // 1. Create Initial Credit Transaction
  const [txn] = await Transaction.create(
    [
      {
        recipientWalletId: walletId,
        recipientUserId: userId,
        type: 'initial_credit',
        channel: 'ui',
        amount: INITIAL_DEMO_BALANCE_POISHA,
        fee: 0,
        total: INITIAL_DEMO_BALANCE_POISHA,
        status: 'settled',
        idempotencyKey: `init-credit-${userId}-${Date.now()}`,
        metadata: {
          note: 'Initial demo balance credited upon registration',
          bdtAmount: 10000,
        },
      },
    ],
    { session }
  );

  // 2. Update Wallet balance atomically
  const updatedWallet = await Wallet.findOneAndUpdate(
    { _id: walletId },
    { $inc: { balance: INITIAL_DEMO_BALANCE_POISHA } },
    { new: true, session }
  );

  if (!updatedWallet) {
    throw new Error(`Wallet not found for initial credit: ${walletId}`);
  }

  // 3. Create Append-Only Ledger Entry
  await LedgerEntry.create(
    [
      {
        txnId: txn._id,
        walletId: walletId,
        direction: 'credit',
        amount: INITIAL_DEMO_BALANCE_POISHA,
        balanceAfter: updatedWallet.balance,
        description: 'Initial demo balance (৳10,000)',
      },
    ],
    { session }
  );

  // 4. Create Welcome Notification
  await Notification.create(
    [
      {
        userId: userId,
        title: 'স্বাগতম বোনাস (Welcome Demo Balance)',
        body: 'আপনার অ্যাকাউন্টে ৳১০,০০০ ডেমো ব্যালেন্স যুক্ত করা হয়েছে। (৳10,000 demo balance added to your wallet.)',
        type: 'transaction',
        metadata: { txnId: txn._id, amountPoisha: INITIAL_DEMO_BALANCE_POISHA },
      },
    ],
    { session }
  );

  // 5. Create Audit Log
  await AuditLog.create(
    [
      {
        userId: userId,
        action: 'INITIAL_DEMO_BALANCE_CREDITED',
        actorType: 'system',
        status: 'success',
        details: {
          walletId: walletId,
          amountPoisha: INITIAL_DEMO_BALANCE_POISHA,
          balanceAfter: updatedWallet.balance,
        },
      },
    ],
    { session }
  );

  logger.info({ userId, walletId, balance: updatedWallet.balance }, 'Initial demo balance of ৳10,000 credited.');
  return { txn, wallet: updatedWallet };
}

/**
 * Execute a double-entry fund transfer between two wallets atomically.
 * Debits sender wallet, credits recipient wallet, writes paired ledger entries.
 * Enforces zero-negative balance invariant.
 */
export async function executeLedgerTransfer({
  txnId,
  senderWalletId,
  recipientWalletId,
  amountPoisha,
  feePoisha = 0,
  session,
}) {
  const totalDebit = amountPoisha + feePoisha;

  // 1. Atomically debit sender wallet with strict balance check
  const debitedSender = await Wallet.findOneAndUpdate(
    {
      _id: senderWalletId,
      status: 'active',
      balance: { $gte: totalDebit },
    },
    {
      $inc: {
        balance: -totalDebit,
        dailySpendPoisha: totalDebit,
        monthlySpendPoisha: totalDebit,
      },
    },
    { new: true, session }
  );

  if (!debitedSender) {
    throw new Error('Insufficient wallet balance or account inactive.');
  }

  // 2. Atomically credit recipient wallet
  const creditedRecipient = await Wallet.findOneAndUpdate(
    {
      _id: recipientWalletId,
      status: 'active',
    },
    {
      $inc: { balance: amountPoisha },
    },
    { new: true, session }
  );

  if (!creditedRecipient) {
    throw new Error('Recipient wallet not found or inactive.');
  }

  // 3. Write immutable paired ledger entries
  // 3a. Sender debit
  await LedgerEntry.create(
    [
      {
        txnId,
        walletId: senderWalletId,
        direction: 'debit',
        amount: totalDebit,
        balanceAfter: debitedSender.balance,
        description: feePoisha > 0 ? `Debit (Amount: ${amountPoisha}, Fee: ${feePoisha})` : `Debit (${amountPoisha})`,
      },
      {
        txnId,
        walletId: recipientWalletId,
        direction: 'credit',
        amount: amountPoisha,
        balanceAfter: creditedRecipient.balance,
        description: `Credit (${amountPoisha})`,
      },
    ],
    { session, ordered: true }
  );

  return {
    senderBalanceAfter: debitedSender.balance,
    recipientBalanceAfter: creditedRecipient.balance,
  };
}

/**
 * Debit a wallet for a single-party outgoing transaction (e.g. utility bill, mobile recharge)
 */
export async function executeLedgerDebit({ txnId, walletId, amountPoisha, feePoisha = 0, description, session }) {
  const totalDebit = amountPoisha + feePoisha;

  const debitedWallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      status: 'active',
      balance: { $gte: totalDebit },
    },
    {
      $inc: {
        balance: -totalDebit,
        dailySpendPoisha: totalDebit,
        monthlySpendPoisha: totalDebit,
      },
    },
    { new: true, session }
  );

  if (!debitedWallet) {
    throw new Error('Insufficient wallet balance or account inactive.');
  }

  await LedgerEntry.create(
    [
      {
        txnId,
        walletId,
        direction: 'debit',
        amount: totalDebit,
        balanceAfter: debitedWallet.balance,
        description: description || `Debit (${totalDebit})`,
      },
    ],
    { session }
  );

  return { balanceAfter: debitedWallet.balance };
}

/**
 * Credit a wallet for an incoming transaction (e.g. Add Money from simulated bank)
 */
export async function executeLedgerCredit({ txnId, walletId, amountPoisha, description, session }) {
  const creditedWallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      status: 'active',
    },
    {
      $inc: { balance: amountPoisha },
    },
    { new: true, session }
  );

  if (!creditedWallet) {
    throw new Error('Wallet not found or inactive.');
  }

  await LedgerEntry.create(
    [
      {
        txnId,
        walletId,
        direction: 'credit',
        amount: amountPoisha,
        balanceAfter: creditedWallet.balance,
        description: description || `Credit (${amountPoisha})`,
      },
    ],
    { session }
  );

  return { balanceAfter: creditedWallet.balance };
}

export default {
  createInitialBalance,
  executeLedgerTransfer,
  executeLedgerDebit,
  executeLedgerCredit,
  INITIAL_DEMO_BALANCE_POISHA,
};
