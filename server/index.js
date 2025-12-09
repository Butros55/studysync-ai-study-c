import "dotenv/config";
import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import {
  initDatabase,
  modulesDB,
  scriptsDB,
  notesDB,
  tasksDB,
  flashcardsDB,
} from "./database.js";
import { roomsRouter } from "./rooms.js";
import { createCrudRoutes } from "./crud-routes.js";
import {
  calculateCost,
  DEFAULT_MODEL,
  MODEL_PRICING,
  FALLBACK_MODEL,
} from "../shared/model-pricing.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3001;
// Render hat ein Default-Limit von 100MB, wir nutzen konservativ 50MB
// Default-Upload-Limit erhöhen (z.B. für große Backups/Uploads)
// Kann per ENV JSON_LIMIT überschrieben werden, z.B. "600mb"
const JSON_LIMIT = process.env.JSON_LIMIT || "600mb";
const DEV_META_ENV = process.env.NODE_ENV || "unknown";

// CORS: Manually set headers on EVERY response to ensure cross-origin works
// This runs before any other middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Also use cors middleware as backup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: false,
  optionsSuccessStatus: 200
}));

// Body parsers - MUST come before routes
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));

function resolveBaseUrl(req) {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!proto || !host) return "";
  return `${proto}://${host}`;
}

app.get("/api/meta", (req, res) => {
  const baseUrl = resolveBaseUrl(req);
  res.json({
    env: DEV_META_ENV || "unknown",
    serverTime: new Date().toISOString(),
    baseUrl,
    service: {
      provider: process.env.RENDER ? "render" : "unknown",
      port: process.env.PORT,
      host: req.get("host"),
      forwardedProto: req.get("x-forwarded-proto"),
    },
  });
});

app.use("/api/rooms", roomsRouter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHARED_BACKUP_PATH = path.join(__dirname, "shared-backup.json");

function estimateCost(model, usage) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[FALLBACK_MODEL];
  const normalizedModel = model?.replace(/-\d{4}-\d{2}-\d{2}$/, "") || model;
  const inputTokens =
    usage?.prompt_tokens ??
    usage?.input_tokens ??
    usage?.cache_read_input_tokens ??
    0;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
  const cachedInputTokens = usage?.cache_read_input_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  const inputUsd = pricing ? inputTokens * pricing.input : undefined;
  const outputUsd = pricing ? outputTokens * pricing.output : undefined;
  const estimatedUsd =
    inputUsd !== undefined || outputUsd !== undefined
      ? (inputUsd || 0) + (outputUsd || 0)
      : undefined;

  return {
    normalizedModel,
    usage: {
      inputTokens,
      outputTokens,
      cachedInputTokens,
      totalTokens,
    },
    cost: {
      estimatedUsd,
      breakdown: {
        inputUsd,
        outputUsd,
      },
      pricingModelKey: pricing ? model : undefined,
    },
  };
}

// Shared Backup Endpoints (einfacher JSON-Store auf dem Server)
app.get("/api/shared-backup", async (_req, res) => {
  try {
    await fs.access(SHARED_BACKUP_PATH);
    res.sendFile(SHARED_BACKUP_PATH);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return res.status(404).json({ error: "Kein Server-Backup vorhanden" });
    }
    console.error("[SharedBackup] read failed:", error);
    res.status(500).json({ error: "Backup konnte nicht gelesen werden" });
  }
});

app.post("/api/shared-backup", async (req, res) => {
  try {
    // Accept body from express.json (object) or raw buffer/string
    let rawBody = "";
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf-8");
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else if (req.body && typeof req.body === "object") {
      // Already parsed by express.json
      rawBody = JSON.stringify(req.body);
    }

    if (!rawBody) {
      return res.status(400).json({ error: "Leeres Backup-Payload" });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch (e) {
      return res.status(400).json({ error: "Ungültiges JSON-Backup" });
    }

    if (!parsed?.version || !parsed?.data) {
      return res.status(400).json({ error: "Ungültiges Backup-Payload" });
    }

    const payload = {
      ...parsed,
      savedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      SHARED_BACKUP_PATH,
      JSON.stringify(payload, null, 2),
      "utf-8"
    );

    res.json({
      status: "saved",
      version: parsed.version,
      exportedAt: parsed.exportedAt,
    });
  } catch (error) {
    console.error("[SharedBackup] save failed:", error);
    res.status(500).json({ error: "Backup konnte nicht gespeichert werden" });
  }
});

// Root-Route
app.get("/", (req, res) => {
  res.json({
    name: "StudySync Backend",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/api/health",
      llm: "/api/llm (POST)",
    },
  });
});

// Healthcheck-Route für Render
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/llm", async (req, res) => {
  try {
    const {
      prompt,
      model = DEFAULT_MODEL,
      jsonMode = false,
      operation = "unknown",
      moduleId,
      imageBase64, // Neuer Parameter für Vision-API (Legacy)
      image, // Bevorzugter Parameter für Vision-API (Data URL)
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt ist erforderlich",
        details: 'Der Request muss ein "prompt"-Feld enthalten',
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Server-Konfigurationsfehler",
        details: "OPENAI_API_KEY Umgebungsvariable ist nicht gesetzt",
      });
    }

    const imagePayload = image || imageBase64;

    // Prüfe ob Vision-Modus mit Bild
    const isVisionRequest = !!imagePayload;
    const effectiveModel = isVisionRequest
      ? model.includes("gpt-4") || model.includes("gpt-5")
        ? model
        : "gpt-5.1"
      : model;

    console.log(
      `[LLM] Request - Model: ${effectiveModel}, JSON Mode: ${jsonMode}, Operation: ${operation}, Vision: ${isVisionRequest}, Prompt length: ${
        prompt.length
      }${isVisionRequest ? ", Image included" : ""}`
    );

    let responseText = "";
    let usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    let completion;

    if (isVisionRequest) {
      const imageUrl = imagePayload.startsWith("data:")
        ? imagePayload
        : `data:image/png;base64,${imagePayload}`;

      console.log(
        "[VISION] image length:",
        imagePayload?.length,
        "prefix:",
        imagePayload?.slice(0, 30)
      );

      const messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ];

      completion = await openai.chat.completions.create({
        model: effectiveModel,
        messages: messages,
        max_completion_tokens: 4096,
      });

      responseText = completion.choices[0]?.message?.content || "";

      usage = completion.usage || usage;
    } else {
      const requestOptions = {
        model: effectiveModel,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 1,
      };

      if (jsonMode) {
        requestOptions.response_format = { type: "json_object" };
      }

      completion = await openai.chat.completions.create(requestOptions);
      responseText = completion.choices[0]?.message?.content || "";
      usage = completion.usage || usage;
    }

    const estimation = estimateCost(completion.model, usage);

    console.log(
      `[LLM] Response - Length: ${responseText.length}, Tokens: ${
        estimation.usage.totalTokens
      }, Cost: ${
        estimation.cost.estimatedUsd !== undefined
          ? `$${estimation.cost.estimatedUsd.toFixed(6)}`
          : "unknown"
      }`
    );

    res.json({
      response: responseText,
      usage: {
        promptTokens: estimation.usage.inputTokens,
        completionTokens: estimation.usage.outputTokens,
        cachedInputTokens: estimation.usage.cachedInputTokens,
        totalTokens: estimation.usage.totalTokens,
        cost: estimation.cost.estimatedUsd,
        raw: usage,
      },
      model: completion.model,
      normalizedModel: estimation.normalizedModel,
      cost: estimation.cost,
      operation,
      moduleId,
    });
  } catch (error) {
    console.error("[LLM] Error:", error);

    if (error.status === 429) {
      return res.status(429).json({
        error: "Rate Limit erreicht",
        details:
          "Zu viele Anfragen an OpenAI. Bitte warte einen Moment und versuche es erneut.",
        retryAfter: error.headers?.["retry-after"] || 60,
      });
    }

    if (error.code === "context_length_exceeded") {
      return res.status(413).json({
        error: "Token-Limit überschritten",
        details:
          "Der Text ist zu lang für dieses Modell. Bitte teile ihn in kleinere Abschnitte auf.",
        maxTokens: error.message.match(/\d+/)?.[0] || "unbekannt",
      });
    }

    if (error.code === "invalid_api_key") {
      return res.status(500).json({
        error: "Ungültiger API-Key",
        details:
          "Der OpenAI API-Key ist ungültig. Bitte überprüfe die Konfiguration.",
      });
    }

    res.status(error.status || 500).json({
      error: error.message || "Unbekannter Fehler",
      details: error.toString(),
      code: error.code,
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.OPENAI_API_KEY,
  });
});

// ========== CRUD ROUTES ==========
// Using generic factory to reduce code duplication
createCrudRoutes(app, "modules", modulesDB);
createCrudRoutes(app, "scripts", scriptsDB);
createCrudRoutes(app, "notes", notesDB);
createCrudRoutes(app, "tasks", tasksDB, { hasUpdate: true });
createCrudRoutes(app, "flashcards", flashcardsDB, { hasUpdate: true });

// Server starten mit Datenbank-Initialisierung
async function startServer() {
  try {
    await initDatabase();

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 StudyMate Backend läuft auf Port ${PORT}`);
      console.log(`📡 LLM Endpoint: http://localhost:${PORT}/api/llm`);
      console.log(`📦 Datenbank-API: http://localhost:${PORT}/api/modules`);
      console.log(
        `🔑 OpenAI API-Key: ${
          process.env.OPENAI_API_KEY ? "✓ Konfiguriert" : "✗ Nicht gesetzt"
        }`
      );
    });

    // Keep server alive
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down gracefully");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("SIGINT received, shutting down gracefully");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Fehler beim Starten des Servers:", error);
    process.exit(1);
  }
}

startServer();
