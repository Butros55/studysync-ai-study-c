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

const app = express();
const PORT = process.env.PORT || 3001;

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

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);

app.use(express.json({ limit: "10mb" }));

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

const DEFAULT_MODEL = "gpt-4o-mini";

const MODEL_PRICING = {
  // GPT-5 Familie
  "gpt-5.1": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5-mini": { input: 0.25 / 1_000_000, output: 2.0 / 1_000_000 },
  "gpt-5-nano": { input: 0.05 / 1_000_000, output: 0.4 / 1_000_000 },
  "gpt-5.1-chat-latest": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5-chat-latest": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5.1-codex-max": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5.1-codex": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5-codex": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5.1-codex-mini": { input: 0.25 / 1_000_000, output: 2.0 / 1_000_000 },
  "gpt-5-search-api": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-5-pro": { input: 15.0 / 1_000_000, output: 120.0 / 1_000_000 },

  // GPT-4.1 Familie
  "gpt-4.1": { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },
  "gpt-4.1-mini": { input: 0.4 / 1_000_000, output: 1.6 / 1_000_000 },
  "gpt-4.1-nano": { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
  "gpt-4.1-2025-04-14": { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000 },
  "gpt-4.1-mini-2025-04-14": {
    input: 0.8 / 1_000_000,
    output: 3.2 / 1_000_000,
  },
  "gpt-4.1-nano-2025-04-14": {
    input: 0.2 / 1_000_000,
    output: 0.8 / 1_000_000,
  },

  // GPT-4o Familie
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4o-2024-05-13": { input: 5.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o-2024-11-20": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4o-realtime-preview": {
    input: 5.0 / 1_000_000,
    output: 20.0 / 1_000_000,
  },
  "gpt-4o-mini-realtime-preview": {
    input: 0.6 / 1_000_000,
    output: 2.4 / 1_000_000,
  },
  "gpt-4o-mini-search-preview": {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
  },
  "gpt-4o-search-preview": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4o-audio-preview": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4o-mini-audio-preview": {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
  },

  // Realtime
  "gpt-realtime": { input: 4.0 / 1_000_000, output: 16.0 / 1_000_000 },
  "gpt-realtime-mini": { input: 0.6 / 1_000_000, output: 2.4 / 1_000_000 },

  // Audio
  "gpt-audio": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-audio-mini": { input: 0.6 / 1_000_000, output: 2.4 / 1_000_000 },

  // Reasoning / O-Serie
  o1: { input: 15.0 / 1_000_000, output: 60.0 / 1_000_000 },
  "o1-pro": { input: 150.0 / 1_000_000, output: 600.0 / 1_000_000 },
  "o1-mini": { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  "o1-2024-12-17": { input: 15.0 / 1_000_000, output: 60.0 / 1_000_000 },
  "o3-pro": { input: 20.0 / 1_000_000, output: 80.0 / 1_000_000 },
  o3: { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },
  "o3-deep-research": { input: 10.0 / 1_000_000, output: 40.0 / 1_000_000 },
  "o3-mini": { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  "o4-mini": { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  "o4-mini-deep-research": { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },

  // Tools / Suche
  "computer-use-preview": { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000 },

  // GPT-4 Turbo
  "gpt-4-turbo": { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
  "gpt-4-turbo-preview": { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
  "gpt-4-turbo-2024-04-09": {
    input: 10.0 / 1_000_000,
    output: 30.0 / 1_000_000,
  },

  // GPT-4 Classic
  "gpt-4": { input: 30.0 / 1_000_000, output: 60.0 / 1_000_000 },
  "gpt-4-0613": { input: 30.0 / 1_000_000, output: 60.0 / 1_000_000 },
  "gpt-4-0125-preview": { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },

  // GPT-3.5
  "gpt-3.5-turbo": { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
  "gpt-3.5-turbo-16k": { input: 3.0 / 1_000_000, output: 4.0 / 1_000_000 },
  "gpt-3.5-turbo-1106": { input: 1.0 / 1_000_000, output: 2.0 / 1_000_000 },
  "gpt-3.5-turbo-instruct": { input: 1.5 / 1_000_000, output: 2.0 / 1_000_000 },
  "gpt-3.5-turbo-instruct-0914": {
    input: 1.5 / 1_000_000,
    output: 2.0 / 1_000_000,
  },

  // Codex Mini
  "codex-mini-latest": { input: 1.5 / 1_000_000, output: 6.0 / 1_000_000 },

  // Image Tokens
  "gpt-image-1": { input: 10.0 / 1_000_000, output: 40.0 / 1_000_000 },
  "gpt-image-1-mini": { input: 2.5 / 1_000_000, output: 8.0 / 1_000_000 },
};

function calculateCost(model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    console.warn(
      `Unknown model pricing for: ${model}, using gpt-4o-mini as fallback`
    );
    const fallback = MODEL_PRICING["gpt-4o-mini"];
    return promptTokens * fallback.input + completionTokens * fallback.output;
  }

  return promptTokens * pricing.input + completionTokens * pricing.output;
}

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

// ========== MODULES API ==========
app.get("/api/modules", (req, res) => {
  try {
    const modules = modulesDB.getAll();
    res.json(modules);
  } catch (error) {
    console.error("[Modules] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/modules", (req, res) => {
  try {
    const module = modulesDB.create(req.body);
    res.json(module);
  } catch (error) {
    console.error("[Modules] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/modules/:id", (req, res) => {
  try {
    modulesDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Modules] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SCRIPTS API ==========
app.get("/api/scripts", (req, res) => {
  try {
    const scripts = scriptsDB.getAll();
    res.json(scripts);
  } catch (error) {
    console.error("[Scripts] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/scripts", (req, res) => {
  try {
    const script = scriptsDB.create(req.body);
    res.json(script);
  } catch (error) {
    console.error("[Scripts] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/scripts/:id", (req, res) => {
  try {
    scriptsDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Scripts] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== NOTES API ==========
app.get("/api/notes", (req, res) => {
  try {
    const notes = notesDB.getAll();
    res.json(notes);
  } catch (error) {
    console.error("[Notes] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notes", (req, res) => {
  try {
    const note = notesDB.create(req.body);
    res.json(note);
  } catch (error) {
    console.error("[Notes] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    notesDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Notes] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== TASKS API ==========
app.get("/api/tasks", (req, res) => {
  try {
    const tasks = tasksDB.getAll();
    res.json(tasks);
  } catch (error) {
    console.error("[Tasks] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks", (req, res) => {
  try {
    const task = tasksDB.create(req.body);
    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/tasks/:id", (req, res) => {
  try {
    const task = tasksDB.update(req.params.id, req.body);
    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    tasksDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Tasks] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== FLASHCARDS API ==========
app.get("/api/flashcards", (req, res) => {
  try {
    const flashcards = flashcardsDB.getAll();
    res.json(flashcards);
  } catch (error) {
    console.error("[Flashcards] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/flashcards", (req, res) => {
  try {
    const flashcard = flashcardsDB.create(req.body);
    res.json(flashcard);
  } catch (error) {
    console.error("[Flashcards] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/flashcards/:id", (req, res) => {
  try {
    const flashcard = flashcardsDB.update(req.params.id, req.body);
    res.json(flashcard);
  } catch (error) {
    console.error("[Flashcards] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/flashcards/:id", (req, res) => {
  try {
    flashcardsDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Flashcards] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

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
