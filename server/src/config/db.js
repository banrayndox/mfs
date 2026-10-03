import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import logger from '../utils/logger.js';

let replSetInstance = null;

/**
 * Connect to MongoDB.
 * If MONGODB_URI is provided, connects directly.
 * If empty in development, spins up an in-memory single-node replica set
 * so MongoDB multi-document transactions work out of the box with zero external setup.
 */
export async function connectDb() {
  let uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    logger.warn('⚠️  MONGODB_URI is empty. Starting in-memory single-node replica set (ephemeral data)...');
    try {
      replSetInstance = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      uri = replSetInstance.getUri();
      logger.info(`✓ In-memory MongoDB replica set initialized at: ${uri}`);
    } catch (err) {
      logger.error({ err }, 'Failed to start in-memory replica set');
      throw err;
    }
  }

  try {
    await mongoose.connect(uri);
    logger.info('✓ Successfully connected to MongoDB.');

    // Ensure collections exist to avoid catalog changes during transactions
    const modelNames = ['User', 'Wallet', 'Transaction', 'LedgerEntry', 'Notification', 'AuditLog'];
    for (const name of modelNames) {
      if (mongoose.models[name]) {
        await mongoose.models[name].createCollection().catch(() => {});
      }
    }

    return mongoose.connection;
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error');
    throw err;
  }
}

/**
 * Gracefully disconnect from database and stop in-memory server if running.
 */
export async function disconnectDb() {
  try {
    await mongoose.disconnect();
    if (replSetInstance) {
      await replSetInstance.stop();
      replSetInstance = null;
      logger.info('✓ In-memory MongoDB replica set stopped.');
    }
    logger.info('✓ Disconnected from MongoDB.');
  } catch (err) {
    logger.error({ err }, 'Error during MongoDB disconnect');
  }
}

export default { connectDb, disconnectDb };
