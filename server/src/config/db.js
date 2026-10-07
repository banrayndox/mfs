import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import "./loadEnv.js";
import logger from "../utils/logger.js";

/**
 * Global connection cache for Next.js / Serverless / Hot-Reload safety.
 */
let cached = global._mongooseCached;
if (!cached) {
  cached = global._mongooseCached = { conn: null, promise: null };
}

let replSetInstance = null;

/**
 * Safely masks username and password in a MongoDB URI so credentials are never exposed in logs.
 * @param {string} uri
 * @returns {string}
 */
export function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "";
  return uri.replace(
    /(mongodb(?:\+srv)?:\/\/)([^:@]+)(?::[^@]*)?@/i,
    (_match, proto, user) => {
      return `${proto}${user}:****@`;
    },
  );
}

/**
 * Analyzes MongoDB connection errors and returns actionable, human-friendly guidance.
 * @param {Error} err
 * @returns {{ title: string, suggestions: string[], isNetworkAccess: boolean, isAuthFailure: boolean }}
 */
export function formatMongoError(err) {
  const msg = err?.message || String(err);
  const isSslAlert =
    /SSL alert number 80|0A000438|ssl3_read_bytes|tlsv1 alert internal error/i.test(
      msg,
    );
  const isAuth = /bad auth|Authentication failed/i.test(msg);
  const isNoPrimary = /ReplicaSetNoPrimary|no primary found/i.test(msg);
  const isDns = /ENOTFOUND|querySrv ETIMEOUT|queryTxt/i.test(msg);
  const isConnRefused = /ECONNREFUSED/i.test(msg);

  const result = {
    title: "MongoDB Connection Error",
    suggestions: [],
    isNetworkAccess: isSslAlert,
    isAuthFailure: isAuth,
  };

  if (isSslAlert) {
    result.title = "MongoDB Atlas TLS / Network Access Rejected (SSL alert 80)";
    result.suggestions = [
      "MongoDB Atlas closed the secure handshake. This almost always means your current public IP is NOT authorized in Atlas Network Access.",
      'Log in to https://cloud.mongodb.com -> Select your project -> "Network Access" under Security.',
      'Click "Add IP Address" and add your current public IP, or add "0.0.0.0/0" (allow from anywhere) for development.',
      "If using a dynamic IP (mobile hotspot/home broadband), check if your public IP changed recently.",
      "Use the standard SRV URI format: mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/<dbname>",
    ];
  } else if (isAuth) {
    result.title = "MongoDB Authentication Failed";
    result.suggestions = [
      "The username or password in MONGODB_URI in your .env file is incorrect or does not exist on this cluster.",
      "Check Database Access in MongoDB Atlas (cloud.mongodb.com -> Security -> Database Access).",
      "Verify that the database user exists, has readWrite permissions, and that the password in .env matches.",
      "If your password contains special characters like @, :, ?, /, ensure they are URL-encoded (e.g. encodeURIComponent).",
    ];
  } else if (isNoPrimary) {
    result.title = "MongoDB ReplicaSet Primary Node Unreachable";
    result.suggestions = [
      "The client discovered a secondary node but could not reach the replica set primary node.",
      "Verify that the MongoDB Atlas IP Access List allows connections to all cluster shard nodes.",
      "Check if your cluster is currently paused or undergoing maintenance in cloud.mongodb.com.",
    ];
  } else if (isDns) {
    result.title = "MongoDB DNS Resolution Failure";
    result.suggestions = [
      "Could not resolve MongoDB cluster hostname.",
      "Check your local DNS configuration or internet connection.",
      "Verify the cluster hostname in MONGODB_URI.",
    ];
  } else if (isConnRefused) {
    result.title = "MongoDB Connection Refused";
    result.suggestions = [
      "The MongoDB port is not accepting connections.",
      "Ensure the local MongoDB service is running if connecting to localhost, or verify the port number.",
    ];
  } else {
    result.suggestions = [
      "Verify MONGODB_URI in your .env file.",
      "Ensure your MongoDB instance is running and reachable from your current network.",
    ];
  }

  return result;
}

/**
 * Pre-creates collections and indexes for all registered models
 * to prevent catalog change errors during multi-document transactions.
 */
async function initCollections() {
  const modelNames = [
    "User",
    "Wallet",
    "Transaction",
    "LedgerEntry",
    "MoneyRequest",
    "Schedule",
    "Rule",
    "Reminder",
    "Notification",
    "GuardianLink",
    "ProtectedProfile",
    "PendingAction",
    "AiTip",
    "NumberReputation",
    "ScamReport",
    "AuditLog",
    "LinkedAccount",
    "SavingsPlan",
    "ConsumedToken",
    "FinancialMemory",
    "CopilotMessage",
  ];

  for (const name of modelNames) {
    if (mongoose.models[name]) {
      await mongoose.models[name].createCollection().catch(() => {});
      await mongoose.models[name].init().catch(() => {});
    }
  }
}

/**
 * Returns true if the mongoose client is currently connected.
 */
export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Connect to MongoDB with singleton caching, timeout guards, and dev fallback.
 * If MONGODB_URI is provided and reachable, connects directly.
 * If MONGODB_URI is empty, spins up an in-memory single-node replica set for zero-config dev.
 * If MONGODB_URI fails in development, reports diagnostics and falls back to ephemeral replica set.
 */
export async function connectDb() {
  // If already connected, return existing connection
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection;
    return cached.conn;
  }

  // If a connection attempt is in-flight, return the existing promise
  if (cached.promise) {
    return cached.promise;
  }

  cached.promise = (async () => {
    let uri = process.env.MONGODB_URI;
    const isDev = process.env.NODE_ENV !== "production";

    const mongooseOptions = {
      serverSelectionTimeoutMS: parseInt(
        process.env.MONGODB_TIMEOUT_MS || "5000",
        10,
      ),
      connectTimeoutMS: 10000,
      autoSelectFamily: false, // Helps avoid IPv4/IPv6 race conditions on Node 18+
      maxPoolSize: 10,
    };

    // Case 1: MONGODB_URI is empty/not provided
    if (!uri || uri.trim() === "") {
      logger.warn(
        "⚠️  MONGODB_URI is empty. Starting in-memory single-node replica set (ephemeral dev mode)...",
      );
      try {
        if (!replSetInstance) {
          replSetInstance = await MongoMemoryReplSet.create({
            replSet: { count: 1, storageEngine: "wiredTiger" },
          });
        }
        uri = replSetInstance.getUri();
        logger.info(
          `✓ In-memory MongoDB replica set initialized at: ${maskMongoUri(uri)}`,
        );
      } catch (err) {
        logger.error({ err }, "Failed to start in-memory MongoDB replica set");
        cached.promise = null;
        throw err;
      }
    }

    // Try connecting to the specified URI
    try {
      logger.info(`Connecting to MongoDB (${maskMongoUri(uri)})...`);
      await mongoose.connect(uri, mongooseOptions);
      logger.info("✓ Successfully connected to MongoDB.");

      await initCollections();

      cached.conn = mongoose.connection;
      return cached.conn;
    } catch (err) {
      const diag = formatMongoError(err);
      logger.error(`❌ ${diag.title}`);
      for (const s of diag.suggestions) {
        logger.warn(`   👉 ${s}`);
      }

      // If in development mode and remote URI failed, allow fallback to in-memory replica set
      // so development is not blocked by external Atlas IP/auth errors, unless explicitly disabled.
      const allowFallback =
        isDev && process.env.MONGODB_FALLBACK_ON_ERROR !== "false";
      if (allowFallback) {
        logger.warn(
          "🔄 Falling back to in-memory single-node replica set for development...",
        );
        try {
          if (!replSetInstance) {
            replSetInstance = await MongoMemoryReplSet.create({
              replSet: { count: 1, storageEngine: "wiredTiger" },
            });
          }
          const fallbackUri = replSetInstance.getUri();
          await mongoose.connect(fallbackUri, mongooseOptions);
          logger.info(
            `✓ Fallback in-memory replica set ready at: ${maskMongoUri(fallbackUri)}`,
          );
          await initCollections();
          cached.conn = mongoose.connection;
          return cached.conn;
        } catch (fallbackErr) {
          logger.error(
            { err: fallbackErr },
            "Failed to initialize in-memory fallback database",
          );
          cached.promise = null;
          throw err;
        }
      }

      cached.promise = null;
      throw err;
    }
  })();

  return cached.promise;
}

/**
 * Gracefully disconnect from database and stop in-memory server if running.
 */
export async function disconnectDb() {
  try {
    cached.conn = null;
    cached.promise = null;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSetInstance) {
      await replSetInstance.stop();
      replSetInstance = null;
      logger.info("✓ In-memory MongoDB replica set stopped.");
    }
    logger.info("✓ Disconnected from MongoDB.");
  } catch (err) {
    logger.error({ err }, "Error during MongoDB disconnect");
  }
}

export default {
  connectDb,
  disconnectDb,
  isDbConnected,
  maskMongoUri,
  formatMongoError,
};
