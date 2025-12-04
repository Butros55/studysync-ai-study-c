import { TokenUsage, CostSummary } from './types'

const MODEL_PRICING = {
  'gpt-4o': {
    input: 2.50 / 1_000_000,
    output: 10.00 / 1_000_000,
  },
  'gpt-4o-mini': {
    input: 0.150 / 1_000_000,
    output: 0.600 / 1_000_000,
  },
  'gpt-4o-2024-11-20': {
    input: 2.50 / 1_000_000,
    output: 10.00 / 1_000_000,
  },
  'gpt-4-turbo': {
    input: 10.00 / 1_000_000,
    output: 30.00 / 1_000_000,
  },
  'gpt-4': {
    input: 30.00 / 1_000_000,
    output: 60.00 / 1_000_000,
  },
  'gpt-3.5-turbo': {
    input: 0.50 / 1_000_000,
    output: 1.50 / 1_000_000,
  },
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
    return `$${(cost * 100).toFixed(4)}¢`
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
    'task-submit': 'Aufgabe prüfen',
    'handwriting-analysis': 'Handschrift analysieren',
    'upload': 'Skript hochladen',
  }
  return labels[operation] || operation
}

export function getModelDisplayName(model: string): string {
  const names: Record<string, string> = {
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4o-2024-11-20': 'GPT-4o (Nov 2024)',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  }
  return names[model] || model
}
