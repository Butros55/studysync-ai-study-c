export type Pricing = { input: number; output: number; cachedInput?: number };

export type CostBreakdown = {
  inputUsd?: number;
  cachedInputUsd?: number;
  outputUsd?: number;
};

export type CostEstimate = {
  estimatedUsd?: number;
  breakdown: CostBreakdown;
  pricingModelKey?: string;
  note?: string;
};

export type UsageSummary = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
};

export const MODEL_PRICING: Record<string, Pricing> = {
  // GPT-5 Familie
  "gpt-5.1": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5.1-mini": { input: 0.20, cachedInput: 0.02, output: 1.5 },
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2.0 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-5.1-chat-latest": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5-chat-latest": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5.1-codex-max": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5.1-codex": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5-codex": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5.1-codex-mini": { input: 0.25, cachedInput: 0.025, output: 2.0 },
  "gpt-5-search-api": { input: 1.25, cachedInput: 0.125, output: 10.0 },
  "gpt-5-pro": { input: 15.0, output: 120.0 },

  // GPT-4.1 Familie
  "gpt-4.1": { input: 2.0, cachedInput: 0.5, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gpt-4.1-2025-04-14": { input: 3.0, output: 12.0 },
  "gpt-4.1-mini-2025-04-14": {
    input: 0.8,
    output: 3.2,
  },
  "gpt-4.1-nano-2025-04-14": {
    input: 0.2,
    output: 0.8,
  },

  // GPT-4o Familie
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10.0 },
  "gpt-4o-2024-05-13": { input: 5.0, output: 15.0 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-4o-2024-11-20": { input: 2.5, output: 10.0 },
  "gpt-4o-realtime-preview": {
    input: 5.0,
    output: 20.0,
  },
  "gpt-4o-mini-realtime-preview": {
    input: 0.6,
    output: 2.4,
  },
  "gpt-4o-mini-search-preview": {
    input: 0.15,
    output: 0.6,
  },
  "gpt-4o-search-preview": { input: 2.5, output: 10.0 },
  "gpt-4o-audio-preview": { input: 2.5, output: 10.0 },
  "gpt-4o-mini-audio-preview": {
    input: 0.15,
    output: 0.6,
  },

  // Realtime
  "gpt-realtime": { input: 4.0, output: 16.0 },
  "gpt-realtime-mini": { input: 0.6, output: 2.4 },

  // Audio
  "gpt-audio": { input: 2.5, output: 10.0 },
  "gpt-audio-mini": { input: 0.6, output: 2.4 },

  // Reasoning / O-Serie
  o1: { input: 15.0, output: 60.0 },
  "o1-pro": { input: 150.0, output: 600.0 },
  "o1-mini": { input: 1.1, output: 4.4 },
  "o1-2024-12-17": { input: 15.0, output: 60.0 },
  "o3-pro": { input: 20.0, output: 80.0 },
  o3: { input: 2.0, output: 8.0 },
  "o3-deep-research": { input: 10.0, output: 40.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "o4-mini-deep-research": { input: 2.0, output: 8.0 },

  // Tools / Suche
  "computer-use-preview": { input: 3.0, output: 12.0 },

  // GPT-4 Turbo
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-4-turbo-preview": { input: 10.0, output: 30.0 },
  "gpt-4-turbo-2024-04-09": {
    input: 10.0,
    output: 30.0,
  },

  // GPT-4 Classic
  "gpt-4": { input: 30.0, output: 60.0 },
  "gpt-4-0613": { input: 30.0, output: 60.0 },
  "gpt-4-0125-preview": { input: 10.0, output: 30.0 },

  // GPT-3.5
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "gpt-3.5-turbo-16k": { input: 3.0, output: 4.0 },
  "gpt-3.5-turbo-1106": { input: 1.0, output: 2.0 },
  "gpt-3.5-turbo-instruct": { input: 1.5, output: 2.0 },
  "gpt-3.5-turbo-instruct-0914": {
    input: 1.5,
    output: 2.0,
  },

  // Codex Mini
  "codex-mini-latest": { input: 1.5, output: 6.0 },

  // Image Tokens
  "gpt-image-1": { input: 10.0, output: 40.0 },
  "gpt-image-1-mini": { input: 2.5, output: 8.0 },
};

export function normalizeModelName(model: string): string {
  if (!model) return "";
  const withoutDate = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (withoutDate.endsWith("-chat-latest")) {
    return withoutDate.replace(/-chat-latest$/, "");
  }
  return withoutDate;
}

function getPricingKey(model: string): string | undefined {
  const normalized = normalizeModelName(model);
  if (MODEL_PRICING[model]) return model;
  if (MODEL_PRICING[normalized]) return normalized;
  return normalized;
}

export function estimateCost(
  model: string,
  usage?: {
    input_tokens?: number;
    prompt_tokens?: number;
    output_tokens?: number;
    completion_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    cache_read_input_tokens?: number;
  }
): { normalizedModel: string; pricingModelKey?: string; usage: UsageSummary; cost: CostEstimate } {
  const normalizedModel = normalizeModelName(model);
  const pricingModelKey = getPricingKey(model);
  const pricing = pricingModelKey ? MODEL_PRICING[pricingModelKey] : undefined;

  const inputTokens = usage?.input_tokens ?? usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? usage?.completion_tokens ?? 0;
  const cachedInputTokens =
    usage?.input_tokens_details?.cached_tokens ??
    usage?.cache_read_input_tokens ??
    0;

  const nonCachedInput = Math.max(0, inputTokens - cachedInputTokens);
  const costInput =
    pricing !== undefined ? (nonCachedInput / 1_000_000) * pricing.input : undefined;
  const costCached =
    pricing?.cachedInput !== undefined
      ? (cachedInputTokens / 1_000_000) * pricing.cachedInput
      : undefined;
  const costOutput =
    pricing !== undefined ? (outputTokens / 1_000_000) * pricing.output : undefined;

  const estimatedUsd =
    costInput !== undefined ||
    costCached !== undefined ||
    costOutput !== undefined
      ? (costInput || 0) + (costCached || 0) + (costOutput || 0)
      : undefined;

  return {
    normalizedModel,
    pricingModelKey: pricing ? pricingModelKey : undefined,
    usage: {
      inputTokens,
      outputTokens,
      cachedInputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    cost: {
      estimatedUsd,
      breakdown: {
        inputUsd: costInput,
        cachedInputUsd: costCached,
        outputUsd: costOutput,
      },
      pricingModelKey: pricing ? pricingModelKey : undefined,
      note: pricing ? undefined : "Unknown pricing",
    },
  };
}
