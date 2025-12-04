import { TokenUsage, CostSummary } from './types'

// Preise in Dollar pro Token (basierend auf $ pro 1M Tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // GPT-5 Familie
  'gpt-5.1': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5-mini': { input: 0.25 / 1_000_000, output: 2.0 / 1_000_000 },
  'gpt-5-nano': { input: 0.05 / 1_000_000, output: 0.4 / 1_000_000 },
  'gpt-5.1-chat-latest': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5-chat-latest': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5.1-codex-max': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5.1-codex': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5-codex': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5.1-codex-mini': { input: 0.25 / 1_000_000, output: 2.0 / 1_000_000 },
  'gpt-5-search-api': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-5-pro': { input: 15.0 / 1_000_000, output: 120.0 / 1_000_000 },

  // GPT-4.1 Familie
  'gpt-4.1': { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },
  'gpt-4.1-mini': { input: 0.4 / 1_000_000, output: 1.6 / 1_000_000 },
  'gpt-4.1-nano': { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
  'gpt-4.1-2025-04-14': { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000 },
  'gpt-4.1-mini-2025-04-14': { input: 0.8 / 1_000_000, output: 3.2 / 1_000_000 },
  'gpt-4.1-nano-2025-04-14': { input: 0.2 / 1_000_000, output: 0.8 / 1_000_000 },

  // GPT-4o Familie
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-2024-05-13': { input: 5.0 / 1_000_000, output: 15.0 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gpt-4o-2024-11-20': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-realtime-preview': { input: 5.0 / 1_000_000, output: 20.0 / 1_000_000 },
  'gpt-4o-mini-realtime-preview': { input: 0.6 / 1_000_000, output: 2.4 / 1_000_000 },
  'gpt-4o-mini-search-preview': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gpt-4o-search-preview': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-audio-preview': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-mini-audio-preview': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },

  // Realtime
  'gpt-realtime': { input: 4.0 / 1_000_000, output: 16.0 / 1_000_000 },
  'gpt-realtime-mini': { input: 0.6 / 1_000_000, output: 2.4 / 1_000_000 },

  // Audio Modelle (Texttoken-Billing)
  'gpt-audio': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-audio-mini': { input: 0.6 / 1_000_000, output: 2.4 / 1_000_000 },

  // Reasoning / O-Serie
  'o1': { input: 15.0 / 1_000_000, output: 60.0 / 1_000_000 },
  'o1-pro': { input: 150.0 / 1_000_000, output: 600.0 / 1_000_000 },
  'o1-mini': { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  'o1-2024-12-17': { input: 15.0 / 1_000_000, output: 60.0 / 1_000_000 },
  'o3-pro': { input: 20.0 / 1_000_000, output: 80.0 / 1_000_000 },
  'o3': { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },
  'o3-deep-research': { input: 10.0 / 1_000_000, output: 40.0 / 1_000_000 },
  'o3-mini': { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  'o4-mini': { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
  'o4-mini-deep-research': { input: 2.0 / 1_000_000, output: 8.0 / 1_000_000 },

  // Tools / Suche
  'computer-use-preview': { input: 3.0 / 1_000_000, output: 12.0 / 1_000_000 },

  // GPT-4 Turbo
  'gpt-4-turbo': { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
  'gpt-4-turbo-preview': { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
  'gpt-4-turbo-2024-04-09': { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },

  // GPT-4 Classic
  'gpt-4': { input: 30.0 / 1_000_000, output: 60.0 / 1_000_000 },
  'gpt-4-0613': { input: 30.0 / 1_000_000, output: 60.0 / 1_000_000 },
  'gpt-4-0125-preview': { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },

  // GPT-3.5
  'gpt-3.5-turbo': { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
  'gpt-3.5-turbo-16k': { input: 3.0 / 1_000_000, output: 4.0 / 1_000_000 },
  'gpt-3.5-turbo-1106': { input: 1.0 / 1_000_000, output: 2.0 / 1_000_000 },
  'gpt-3.5-turbo-instruct': { input: 1.5 / 1_000_000, output: 2.0 / 1_000_000 },
  'gpt-3.5-turbo-instruct-0914': { input: 1.5 / 1_000_000, output: 2.0 / 1_000_000 },

  // Codex Mini
  'codex-mini-latest': { input: 1.5 / 1_000_000, output: 6.0 / 1_000_000 },

  // Image Tokens
  'gpt-image-1': { input: 10.0 / 1_000_000, output: 40.0 / 1_000_000 },
  'gpt-image-1-mini': { input: 2.5 / 1_000_000, output: 8.0 / 1_000_000 },
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING]

  if (!pricing) {
    console.warn(`Unknown model pricing for: ${model}, using gpt-4o-mini as fallback`)
    const fallback = MODEL_PRICING['gpt-4o-mini']
    return promptTokens * fallback.input + completionTokens * fallback.output
  }

  return promptTokens * pricing.input + completionTokens * pricing.output
}

export function generateCostSummary(usageRecords: TokenUsage[]): CostSummary {
  const summary: CostSummary = {
    totalCost: 0,
    totalTokens: 0,
    totalRequests: usageRecords.length,
    costByModel: {},
    tokensByModel: {},
    requestsByModel: {},
    costByOperation: {},
    recentUsage: usageRecords.slice(-50).reverse(),
  }

  usageRecords.forEach((record) => {
    summary.totalCost += record.cost
    summary.totalTokens += record.totalTokens

    summary.costByModel[record.model] = (summary.costByModel[record.model] || 0) + record.cost
    summary.tokensByModel[record.model] = (summary.tokensByModel[record.model] || 0) + record.totalTokens
    summary.requestsByModel[record.model] = (summary.requestsByModel[record.model] || 0) + 1

    summary.costByOperation[record.operation] = (summary.costByOperation[record.operation] || 0) + record.cost
  })

  return summary
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`
  }
  return `$${cost.toFixed(4)}`
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`
  }
  return tokens.toString()
}

export function getOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    'generate-notes': 'Notizen generieren',
    'generate-tasks': 'Aufgaben generieren',
    'generate-flashcards': 'Karteikarten generieren',
    'task-submit': 'Aufgabe pruefen',
    'handwriting-analysis': 'Handschrift analysieren',
    'upload': 'Skript hochladen',
  }
  return labels[operation] || operation
}

export function getModelDisplayName(model: string): string {
  const names: Record<string, string> = {
    // GPT-5
    'gpt-5.1': 'GPT-5.1',
    'gpt-5': 'GPT-5',
    'gpt-5-mini': 'GPT-5 Mini',
    'gpt-5-nano': 'GPT-5 Nano',
    'gpt-5.1-chat-latest': 'GPT-5.1 Chat',
    'gpt-5-chat-latest': 'GPT-5 Chat',
    'gpt-5.1-codex-max': 'GPT-5.1 Codex Max',
    'gpt-5.1-codex': 'GPT-5.1 Codex',
    'gpt-5-codex': 'GPT-5 Codex',
    'gpt-5.1-codex-mini': 'GPT-5.1 Codex Mini',
    'gpt-5-search-api': 'GPT-5 Search API',
    'gpt-5-pro': 'GPT-5 Pro',

    // GPT-4.1
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'gpt-4.1-nano': 'GPT-4.1 Nano',
    'gpt-4.1-2025-04-14': 'GPT-4.1 (Apr 2025)',
    'gpt-4.1-mini-2025-04-14': 'GPT-4.1 Mini (Apr 2025)',
    'gpt-4.1-nano-2025-04-14': 'GPT-4.1 Nano (Apr 2025)',

    // GPT-4o
    'gpt-4o': 'GPT-4o',
    'gpt-4o-2024-05-13': 'GPT-4o (Mai 2024)',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4o-2024-11-20': 'GPT-4o (Nov 2024)',
    'gpt-4o-realtime-preview': 'GPT-4o Realtime Preview',
    'gpt-4o-mini-realtime-preview': 'GPT-4o Mini Realtime Preview',
    'gpt-4o-mini-search-preview': 'GPT-4o Mini Search Preview',
    'gpt-4o-search-preview': 'GPT-4o Search Preview',
    'gpt-4o-audio-preview': 'GPT-4o Audio Preview',
    'gpt-4o-mini-audio-preview': 'GPT-4o Mini Audio Preview',

    // Realtime
    'gpt-realtime': 'GPT Realtime',
    'gpt-realtime-mini': 'GPT Realtime Mini',

    // Audio
    'gpt-audio': 'GPT Audio',
    'gpt-audio-mini': 'GPT Audio Mini',

    // O-Serie
    'o1': 'O1',
    'o1-pro': 'O1 Pro',
    'o1-mini': 'O1 Mini',
    'o1-2024-12-17': 'O1 Reasoning',
    'o3-pro': 'O3 Pro',
    'o3': 'O3',
    'o3-deep-research': 'O3 Deep Research',
    'o3-mini': 'O3 Mini',
    'o4-mini': 'O4 Mini',
    'o4-mini-deep-research': 'O4 Mini Deep Research',

    // Tools
    'computer-use-preview': 'Computer Use Preview',

    // GPT-4 Turbo
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
    'gpt-4-turbo-2024-04-09': 'GPT-4 Turbo (Apr 2024)',

    // GPT-4 Classic
    'gpt-4': 'GPT-4',
    'gpt-4-0613': 'GPT-4 (Jun 2023)',
    'gpt-4-0125-preview': 'GPT-4 Preview (Jan 2024)',

    // GPT-3.5
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
    'gpt-3.5-turbo-1106': 'GPT-3.5 Turbo (Nov 2023)',
    'gpt-3.5-turbo-instruct': 'GPT-3.5 Instruct',
    'gpt-3.5-turbo-instruct-0914': 'GPT-3.5 Instruct (Sep 2023)',

    // Codex Mini
    'codex-mini-latest': 'Codex Mini',

    // Image
    'gpt-image-1': 'GPT Image 1',
    'gpt-image-1-mini': 'GPT Image 1 Mini',
  }
  return names[model] || model
}
