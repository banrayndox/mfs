import "../server/src/config/loadEnv.js";
import { app } from "../server/src/app.js";
import { connectDb, isDbConnected } from "../server/src/config/db.js";

export default async function handler(req, res) {
  try {
    // Ensure database connection is ready before processing API queries
    await connectDb();

    if (!isDbConnected() && !req.url?.includes("/api/health")) {
      return res.status(503).json({
        code: "DATABASE_UNAVAILABLE",
        message:
          "Database is connecting or unavailable. Please retry in a moment.",
      });
    }

    return app(req, res);
  } catch (err) {
    console.error("[Vercel API] Database initialization error:", err.message);
    return res.status(503).json({
      code: "DATABASE_CONNECTION_ERROR",
      message: "Failed to establish database connection.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}
