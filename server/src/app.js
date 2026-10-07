import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import logger from "./utils/logger.js";

// Import Routers
import { authRouter } from "./routes/auth.routes.js";
import { transactionRouter } from "./routes/transaction.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { scheduleRouter } from "./routes/schedule.routes.js";
import { requestRouter } from "./routes/request.routes.js";
import { guardianRouter } from "./routes/guardian.routes.js";
import { agentAiRouter } from "./routes/agentAi.routes.js";
import { safetyRouter } from "./routes/safety.routes.js";

export const app = express();

// Trust proxy for reverse proxy platforms (e.g. Vercel, Nginx)
app.set("trust proxy", 1);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// Cross-Origin Resource Sharing
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === clientOrigin ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "RATE_LIMIT_EXCEEDED",
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});
app.use("/api/", limiter);

// Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.debug({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Health & Diagnostic Endpoint
app.get("/api/health", (req, res) => {
  const isMock =
    !process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "";
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    ai: {
      mockMode: isMock,
      provider: isMock ? "deterministic-mock" : "groq",
      modelText: process.env.GROQ_MODEL_TEXT || "openai/gpt-oss-120b",
    },
    db: {
      connected: mongoose.connection.readyState === 1,
    },
    version: "1.0.0",
  });
});

// Mount Feature API Routers
// Database Readiness Guard: Ensure database queries only execute when connected
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.originalUrl === "/api/health")
    return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      code: "DATABASE_UNAVAILABLE",
      message:
        "Database connection is not ready. Operations cannot be executed.",
    });
  }
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/wallet", transactionRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/agents", agentRouter);
app.use("/api/schedules", scheduleRouter);
app.use("/api/requests", requestRouter);
app.use("/api/guardians", guardianRouter);
app.use("/api/agent", agentAiRouter);
app.use("/api/copilot", agentAiRouter);
app.use("/api/safety", safetyRouter);

// Catch-all 404 handler
app.use("/api/*", (req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Centralized Error Handler (standard format)
app.use((err, req, res, next) => {
  logger.error({ err }, "Unhandled server error");
  const status =
    err.status ||
    (err.message && err.message.includes("not found") ? 404 : 400);
  res.status(status).json({
    code: err.code || "BAD_REQUEST",
    message: err.message || "An unexpected error occurred.",
    details: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

export default app;
