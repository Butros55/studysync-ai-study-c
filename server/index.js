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

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = "gpt-4o-mini";

const MODEL_PRICING = {
  "gpt-4o": {
    input: 2.5 / 1_000_000,
    output: 10.0 / 1_000_000,
  },
  "gpt-4o-mini": {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
  },
  "gpt-4o-2024-11-20": {
    input: 2.5 / 1_000_000,
    output: 10.0 / 1_000_000,
  },
  "gpt-4-turbo": {
    input: 10.0 / 1_000_000,
    output: 30.0 / 1_000_000,
  },
  "gpt-4": {
    input: 30.0 / 1_000_000,
    output: 60.0 / 1_000_000,
  },
  "gpt-3.5-turbo": {
    input: 0.5 / 1_000_000,
    output: 1.5 / 1_000_000,
  },
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

    console.log(
      `[LLM] Request - Model: ${model}, JSON Mode: ${jsonMode}, Operation: ${operation}, Prompt length: ${prompt.length}`
    );

    const requestOptions = {
      model: model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    };

    if (jsonMode) {
      requestOptions.response_format = { type: "json_object" };
    }

    const completion = await openai.chat.completions.create(requestOptions);

    const responseText = completion.choices[0]?.message?.content || "";
    const usage = completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
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
