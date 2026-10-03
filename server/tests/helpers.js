import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  User,
  Wallet,
  Transaction,
  LedgerEntry,
  Notification,
  AuditLog,
  Schedule,
  Rule,
  Reminder,
  PendingAction,
  AiTip,
  GuardianLink,
  ProtectedProfile,
  SavingsPlan,
  FinancialMemory,
} from '../src/models/index.js';

let replSet = null;

export async function setupTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = replSet.getUri();
  await mongoose.connect(uri);

  // Pre-create all collections and finish indexing upfront to eliminate catalog change conflicts
  const models = [
    User,
    Wallet,
    Transaction,
    LedgerEntry,
    Notification,
    AuditLog,
    Schedule,
    Rule,
    Reminder,
    PendingAction,
    AiTip,
    GuardianLink,
    ProtectedProfile,
    SavingsPlan,
    FinancialMemory,
  ];

  for (const m of models) {
    await m.createCollection().catch(() => {});
    await m.init().catch(() => {});
  }

  return uri;
}

export async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

export async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export default { setupTestDb, teardownTestDb, clearTestDb };
