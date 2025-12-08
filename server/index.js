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
import { calculateCost, DEFAULT_MODEL } from "../shared/model-pricing.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3001;
// Render hat ein Default-Limit von 100MB, wir nutzen konservativ 50MB
const JSON_LIMIT = process.env.JSON_LIMIT || "50mb";

// CORS-Konfiguration: Erlaubte Origins für Dev und Prod
const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://butros55.github.io",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Erlaube Requests ohne Origin (z.B. Server-zu-Server, Postman)
      if (!origin) return callback(null, true);

      // Prüfe ob Origin in der Liste oder mit GitHub Pages Subdomain beginnt
      if (
        allowedOrigins.some(
          (allowed) => origin === allowed || origin.startsWith(allowed)
        )
      ) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);

app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));
app.use("/api/rooms", roomsRouter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHARED_BACKUP_PATH = path.join(__dirname, "shared-backup.json");

// Shared Backup Endpoints (einfacher JSON-Store auf dem Server)
app.get("/api/shared-backup", async (_req, res) => {
  try {
    const raw = await fs.readFile(SHARED_BACKUP_PATH, "utf-8");
    const backup = JSON.parse(raw);
    res.json({ backup });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return res.status(404).json({ error: "Kein Server-Backup vorhanden" });
    }
    console.error("[SharedBackup] read failed:", error);
    res.status(500).json({ error: "Backup konnte nicht gelesen werden" });
  }
});

app.post("/api/shared-backup", async (req, res) => {
  const backup = req.body;
  if (!backup || !backup.version || !backup.data) {
    return res.status(400).json({ error: "Ungültiges Backup-Payload" });
  }

  try {
    const payload = {
      ...backup,
      savedAt: new Date().toISOString(),
    };
    await fs.writeFile(
      SHARED_BACKUP_PATH,
      JSON.stringify(payload, null, 2),
      "utf-8"
    );
    res.json({
      status: "saved",
      version: backup.version,
      exportedAt: backup.exportedAt,
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

    const cost = calculateCost(
      completion.model,
      usage.prompt_tokens,
      usage.completion_tokens
    );

    console.log(
      `[LLM] Response - Length: ${responseText.length}, Tokens: ${
        usage.total_tokens
      }, Cost: $${cost.toFixed(6)}`
    );

    res.json({
      response: responseText,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost: cost,
      },
      model: completion.model,
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
