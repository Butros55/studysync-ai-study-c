/**
 * Shared model pricing configuration
 * 
 * Centralized pricing data for LLM models to ensure consistency
 * between frontend and backend cost calculations.
 */

// Prices in dollars per token (based on $ per 1M tokens)
export const MODEL_PRICING = {
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

  // Audio (Texttoken-Billing)
  "gpt-audio": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-audio-mini": { input: 0.6 / 1_000_000, output: 2.4 / 1_000_000 },

  // Reasoning / O-Serie
  "o1": { input: 15.0 / 1_000_000, output: 60.0 / 1_000_000 },
  "o1-pro": { input: 150.0 / 1_000_000, output: 600.0 / 1_000_000 },
  "o1-mini": { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  "o1-2024-12-17": { input: 15.0 / 1_000_000, output: 60.0 / 1_000_000 },
  "o3-pro": { input: 20.0 / 1_000_000, output: 80.0 / 1_000_000 },
  "o3": { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },
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

export const DEFAULT_MODEL = "gpt-4o-mini";
export const FALLBACK_MODEL = "gpt-4o-mini";

/**
 * Calculate the cost of an LLM request
 * 
 * @param {string} model - Model name
 * @param {number} promptTokens - Input tokens used
 * @param {number} completionTokens - Output tokens generated
 * @returns {number} Cost in USD
 */
export function calculateCost(model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    console.warn(
      `Unknown model pricing for: ${model}, using ${FALLBACK_MODEL} as fallback`
    );
    const fallback = MODEL_PRICING[FALLBACK_MODEL];
    return promptTokens * fallback.input + completionTokens * fallback.output;
  }

  return promptTokens * pricing.input + completionTokens * pricing.output;
}
