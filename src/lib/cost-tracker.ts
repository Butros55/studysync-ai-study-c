import { TokenUsage, CostSummary } from './types'
import { MODEL_PRICING, FALLBACK_MODEL, calculateCost as sharedCalculateCost } from '../../shared/model-pricing.js'

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  return sharedCalculateCost(model, promptTokens, completionTokens)
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
