import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import webpush from "web-push";
import OpenAI from "openai";
import { formatMongoError } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");
dotenv.config({ path: path.join(rootDir, ".env") });

export async function runDoctor({ isServerBoot = false } = {}) {
  const results = {
    ok: true,
    node: { ok: false, version: process.version },
    db: { ok: false, isReplicaSet: false, ephemeral: false, message: "" },
    groq: {
      hasKey: false,
      modelsReachable: false,
      models: {},
      capabilities: {},
      mockMode: false,
      warnings: [],
      suggestedFixes: [],
    },
    vapid: { ok: false, message: "" },
  };

  const log = (...args) => {
    if (!isServerBoot) console.log(...args);
  };

  log("\n🩺 Guardian MFS System Doctor");
  log("======================================================");

  // 1. Check Node Version
  const major = parseInt(process.version.replace("v", "").split(".")[0], 10);
  if (major >= 20) {
    results.node.ok = true;
    log(`✓ Node.js version: ${process.version} (supported)`);
  } else {
    results.ok = false;
    log(`❌ Node.js version: ${process.version} (requires Node 20+)`);
  }

  // 2. Check Database / Mongo Connection & Transactions
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.trim() === "") {
    results.db.ephemeral = true;
    results.db.ok = true;
    results.db.isReplicaSet = true;
    results.db.message =
      "No MONGODB_URI provided. Server will use in-memory MongoMemoryReplicaSet (ephemeral dev mode with transaction support).";
    log(
      `⚠️  Database: MONGODB_URI is empty. Ephemeral in-memory replica set will be used.`,
    );
  } else {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 4000,
        autoSelectFamily: false,
      });
      const admin = conn.connection.db.admin();
      const status = await admin
        .command({ replSetGetStatus: 1 })
        .catch(() => null);
      if (status && status.ok) {
        results.db.ok = true;
        results.db.isReplicaSet = true;
        results.db.message =
          "Connected to MongoDB replica set with multi-document transaction support.";
        log(
          `✓ Database: Connected to MongoDB replica set (${status.set || "primary"}).`,
        );
      } else {
        results.db.ok = true;
        results.db.isReplicaSet = false;
        results.db.message =
          "Connected to standalone MongoDB. Transactions require a replica set (like MongoDB Atlas).";
        log(
          `⚠️  Database: Connected, but not a replica set. Transactions will fail unless running as a replica set.`,
        );
      }
      if (!isServerBoot) {
        await mongoose.disconnect();
      }
    } catch (err) {
      results.db.ok = false;
      const diag = formatMongoError(err);
      results.db.message = `${diag.title}: ${err.message}`;
      log(`❌ Database connection failed: ${diag.title}`);
      for (const s of diag.suggestions) {
        log(`   👉 ${s}`);
      }
    }
  }

  // 3. Check VAPID Keys
  try {
    const pubKey = process.env.VAPID_PUBLIC_KEY;
    const privKey = process.env.VAPID_PRIVATE_KEY;
    if (pubKey && privKey) {
      webpush.setVapidDetails(
        "mailto:support@guardian-mfs.local",
        pubKey,
        privKey,
      );
      results.vapid.ok = true;
      results.vapid.message = "VAPID keys are valid.";
      log(`✓ Push Notifications: VAPID keys verified.`);
    } else {
      results.vapid.message = "Missing VAPID keys in .env. Run npm run setup.";
      log(`⚠️  Push Notifications: VAPID keys missing.`);
    }
  } catch (err) {
    results.vapid.message = `Invalid VAPID keys: ${err.message}`;
    log(`❌ Push Notifications: Invalid VAPID keys (${err.message}).`);
  }

  // 4. Check Groq AI Models & Capabilities
  const groqKey = process.env.GROQ_API_KEY;
  const baseUrl = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

  const configuredModels = {
    text: process.env.GROQ_MODEL_TEXT || "openai/gpt-oss-120b",
    textFallback: process.env.GROQ_MODEL_TEXT_FALLBACK || "openai/gpt-oss-20b",
    vision: process.env.GROQ_MODEL_VISION || "qwen/qwen3.8-27b",
    stt: process.env.GROQ_MODEL_STT || "whisper-large-v3",
    guard:
      process.env.GROQ_MODEL_GUARD || "meta-llama/llama-prompt-guard-2-86m",
  };

  if (!groqKey || groqKey.trim() === "") {
    results.groq.mockMode = true;
    log("\n⚠️  AI / LLM: GROQ_API_KEY is not set.");
    log("   App will run in DETERMINISTIC MOCK MODE with full functionality.");
    log('   A visible "AI: mock mode" badge will be displayed.');
  } else {
    results.groq.hasKey = true;
    log(`\n🔍 Verifying Groq API credentials and models at ${baseUrl}...`);
    try {
      const client = new OpenAI({
        apiKey: groqKey,
        baseURL: baseUrl,
        timeout: 10000,
      });

      const modelsList = await client.models.list();
      results.groq.modelsReachable = true;
      const availableModelIds = modelsList.data.map((m) => m.id);
      log(
        `✓ Reached Groq endpoint. ${availableModelIds.length} models available.`,
      );

      for (const [key, modelId] of Object.entries(configuredModels)) {
        const exists = availableModelIds.includes(modelId);
        results.groq.models[key] = { configured: modelId, exists };
        if (exists) {
          log(`  ✓ ${key.toUpperCase()}: ${modelId} (Found)`);
        } else {
          // Find closest model
          const fallback = availableModelIds.find((id) =>
            key === "vision"
              ? id.includes("vision") || id.includes("qwen")
              : key === "stt"
                ? id.includes("whisper")
                : id.includes("llama") || id.includes("gpt"),
          );
          results.groq.warnings.push(`Model ${modelId} for ${key} not found.`);
          if (fallback) {
            results.groq.suggestedFixes.push(
              `Set GROQ_MODEL_${key.toUpperCase()}=${fallback} in .env`,
            );
          }
          log(
            `  ❌ ${key.toUpperCase()}: ${modelId} (Not found in active list)`,
          );
          if (fallback) log(`     👉 Suggested alternative: ${fallback}`);
        }
      }

      // Capability live tests
      log("\n🔬 Running live capability micro-tests:");

      // Test 1: 1-token chat completion
      const activeTextModel = results.groq.models.text?.exists
        ? configuredModels.text
        : availableModelIds.find(
            (id) =>
              id.includes("llama-3.3") ||
              id.includes("llama-3.1") ||
              id.includes("gpt-oss"),
          );
      if (activeTextModel) {
        try {
          const chatRes = await client.chat.completions.create({
            model: activeTextModel,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          });
          results.groq.capabilities.chat = true;
          log(`  ✓ 1-token chat completion: OK (${activeTextModel})`);
        } catch (err) {
          results.groq.capabilities.chat = false;
          log(`  ❌ Chat completion failed: ${err.message}`);
        }

        // Test 2: Tool calling
        try {
          const toolRes = await client.chat.completions.create({
            model: activeTextModel,
            messages: [
              { role: "user", content: "What is the weather in Dhaka?" },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "get_weather",
                  description: "Get weather for city",
                  parameters: {
                    type: "object",
                    properties: { city: { type: "string" } },
                    required: ["city"],
                  },
                },
              },
            ],
            tool_choice: "auto",
          });
          const toolCalls = toolRes.choices[0]?.message?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            results.groq.capabilities.toolUse = true;
            log(`  ✓ Tool-call roundtrip: OK (${toolCalls[0].function.name})`);
          } else {
            results.groq.capabilities.toolUse = false;
            log(`  ⚠️ Tool call test: Model did not emit tool call`);
          }
        } catch (err) {
          results.groq.capabilities.toolUse = false;
          log(`  ❌ Tool-call test failed: ${err.message}`);
        }
      }

      // Test 3: Vision (tiny 1x1 or 64x64 PNG in base64)
      const activeVisionModel = results.groq.models.vision?.exists
        ? configuredModels.vision
        : availableModelIds.find(
            (id) => id.includes("vision") || id.includes("qwen"),
          );
      if (activeVisionModel) {
        try {
          // Minimal 32x32 PNG base64 (Groq requires >= 32 pixels in each dimension)
          const dummyImageBase64 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGM4kWJEU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULANWleEzy5ps3AAAAAElFTkSuQmCC";
          await client.chat.completions.create({
            model: activeVisionModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "describe briefly" },
                  { type: "image_url", image_url: { url: dummyImageBase64 } },
                ],
              },
            ],
            max_tokens: 5,
          });
          results.groq.capabilities.vision = true;
          log(`  ✓ Vision OCR micro-test: OK (${activeVisionModel})`);
        } catch (err) {
          results.groq.capabilities.vision = false;
          log(`  ⚠️ Vision test failed: ${err.message}`);
        }
      }
    } catch (err) {
      results.groq.modelsReachable = false;
      log(`❌ Could not connect to Groq: ${err.message}`);
      results.groq.mockMode = true;
      log("   Falling back to deterministic mock mode.");
    }
  }

  log("======================================================\n");
  return results;
}

// If executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith("doctor.js")) {
  runDoctor({ isServerBoot: false })
    .then((results) => {
      if (!results.ok) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Doctor crashed:", err);
      process.exit(1);
    });
}
