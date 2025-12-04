import "dotenv/config";
import express from "express";
import cors from "cors";
import { OpenAI } from "openai";

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

app.listen(PORT, () => {
  console.log(`🚀 StudyMate Backend läuft auf Port ${PORT}`);
  console.log(`📡 LLM Endpoint: http://localhost:${PORT}/api/llm`);
  console.log(
    `🔑 OpenAI API-Key: ${
      process.env.OPENAI_API_KEY ? "✓ Konfiguriert" : "✗ Nicht gesetzt"
    }`
  );
});
