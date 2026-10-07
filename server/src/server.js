// Guardian MFS Server
import "./config/loadEnv.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import logger from "./utils/logger.js";
import { runDoctor } from "../scripts/doctor.js";
import {
  startSchedulerWorker,
  stopSchedulerWorker,
} from "./services/scheduler.service.js";
import { initSocket } from "./services/socket.service.js";

const PORT = parseInt(process.env.PORT || "5000", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const httpServer = http.createServer(app);

// Setup Socket.IO
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [CLIENT_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  },
});

initSocket(io);

async function startServer() {
  try {
    logger.info("🚀 Booting Guardian MFS Server...");

    // Production Security Hardening: Enforce strong secrets in production environment
    if (process.env.NODE_ENV === 'production') {
      const weakSecrets = [
        'super-secret-jwt-key-change-me',
        'super-secret-refresh-key-change-me',
        'dev-access-secret-fallback-key-32chars',
        'dev-refresh-secret-fallback-key-32chars',
        'test-secret',
        'dev-secret',
      ];
      const accessSecret = process.env.JWT_ACCESS_SECRET || '';
      const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
      if (!accessSecret || accessSecret.length < 32 || weakSecrets.includes(accessSecret)) {
        throw new Error('FATAL SECURITY ERROR: In production mode, JWT_ACCESS_SECRET must be at least 32 characters and cannot use default/weak keys.');
      }
      if (!refreshSecret || refreshSecret.length < 32 || weakSecrets.includes(refreshSecret)) {
        throw new Error('FATAL SECURITY ERROR: In production mode, JWT_REFRESH_SECRET must be at least 32 characters and cannot use default/weak keys.');
      }
    }

    // Run Doctor diagnostics at boot

    const doctorReport = await runDoctor({ isServerBoot: true });
    if (doctorReport.groq.mockMode) {
      logger.warn(
        "AI Status: GROQ_API_KEY is not configured or unreachable. Running in DETERMINISTIC MOCK MODE.",
      );
    } else {
      logger.info("AI Status: Connected to Groq API. Models verified.");
    }

    // Connect to Database (auto-in-memory replica set if blank)
    await connectDb();

    // Start background persistent automation scheduler worker
    startSchedulerWorker(5000);

    // Handle Port in Use gracefully
    httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logger.error(
          `❌ Port ${PORT} is already in use by another running instance of Guardian MFS.`,
        );
        logger.error(
          `👉 Close the other running terminal, or run: npx kill-port ${PORT}`,
        );
      } else {
        logger.error({ err }, "Server socket error");
      }
      process.exit(1);
    });

    // Start HTTP Server
    httpServer.listen(PORT, () => {
      logger.info(`======================================================`);
      logger.info(
        `🛡️  Guardian MFS Server running on http://localhost:${PORT}`,
      );
      logger.info(`🌐  Client origin: ${CLIENT_ORIGIN}`);
      logger.info(
        `🤖  AI Mode: ${doctorReport.groq.mockMode ? "Deterministic Mock" : "Live Groq"}`,
      );
      logger.info(`======================================================`);
    });
  } catch (err) {
    logger.error({ err }, "Failed to start Guardian MFS server");
    process.exit(1);
  }
}

// Graceful Shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopSchedulerWorker();
  httpServer.close(async () => {
    await disconnectDb();
    logger.info("Server successfully shut down.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
