import { useState, useCallback } from 'react'

export type LLMModel = string

export interface ModelInfo {
  value: LLMModel
  label: string
  description: string
  inputPrice: number // per 1M tokens
  outputPrice: number // per 1M tokens
  cachedInputPrice?: number // per 1M tokens when cached
  contextWindow: number
  supportsVision: boolean
}

function formatPriceValue(value: number): string {
  return value < 0.1 ? value.toFixed(3) : value.toFixed(2)
}

export function formatModelPrice(model: ModelInfo): string {
  const base = `$${formatPriceValue(model.inputPrice)}/$${formatPriceValue(model.outputPrice)} pro 1M`
  if (typeof model.cachedInputPrice === 'number') {
    return `${base} (cached $${formatPriceValue(model.cachedInputPrice)})`
  }
  return base
}

export const LLM_MODELS: ModelInfo[] = [
  // GPT-5.1 Familie
  {
    value: 'gpt-5.1',
    label: 'GPT-5.1',
    description: 'Neueste Generation, multimodal',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5.1-mini',
    label: 'GPT-5.1 Mini',
    description: 'Schnell & günstig, neueste Generation',
    inputPrice: 0.20,
    cachedInputPrice: 0.02,
    outputPrice: 1.5,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5',
    label: 'GPT-5',
    description: 'Leistungsstark, multimodal',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'Schneller und guenstig',
    inputPrice: 0.25,
    cachedInputPrice: 0.025,
    outputPrice: 2.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    description: 'Kosteneffizient, klein',
    inputPrice: 0.05,
    cachedInputPrice: 0.005,
    outputPrice: 0.4,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5.1-chat-latest',
    label: 'GPT-5.1 Chat (Latest)',
    description: 'Aktuelle Chat-Variante',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5-chat-latest',
    label: 'GPT-5 Chat (Latest)',
    description: 'Chat-optimiert',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5.1-codex-max',
    label: 'GPT-5.1 Codex Max',
    description: 'Code-spezialisiert, Max',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5.1-codex',
    label: 'GPT-5.1 Codex',
    description: 'Code-spezialisiert',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5-codex',
    label: 'GPT-5 Codex',
    description: 'Code-Modell',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5.1-codex-mini',
    label: 'GPT-5.1 Codex Mini',
    description: 'Code, guenstig',
    inputPrice: 0.25,
    cachedInputPrice: 0.025,
    outputPrice: 2.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5-search-api',
    label: 'GPT-5 Search API',
    description: 'Search-optimiert',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  {
    value: 'gpt-5-pro',
    label: 'GPT-5 Pro',
    description: 'High-end Reasoning',
    inputPrice: 15.0,
    outputPrice: 120.0,
    contextWindow: 200000,
    supportsVision: true,
  },
  // GPT-4.1 Familie
  {
    value: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Neues leistungsstarkes Modell',
    inputPrice: 2.0,
    cachedInputPrice: 0.5,
    outputPrice: 8.0,
    contextWindow: 1000000,
    supportsVision: true,
  },
  {
    value: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    description: 'Ausgewogene Leistung und Kosten',
    inputPrice: 0.4,
    cachedInputPrice: 0.1,
    outputPrice: 1.6,
    contextWindow: 1000000,
    supportsVision: true,
  },
  {
    value: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    description: 'Ultra-schnell, sehr guenstig',
    inputPrice: 0.1,
    cachedInputPrice: 0.025,
    outputPrice: 0.4,
    contextWindow: 1000000,
    supportsVision: true,
  },
  // GPT-4o Familie
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Flagship-Modell, multimodal, schnell',
    inputPrice: 2.5,
    cachedInputPrice: 1.25,
    outputPrice: 10.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4o-2024-05-13',
    label: 'GPT-4o (Mai 2024)',
    description: 'Spezifische Version vom Mai 2024',
    inputPrice: 5.0,
    outputPrice: 15.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Schnell und guenstig (Empfohlen)',
    inputPrice: 0.15,
    cachedInputPrice: 0.075,
    outputPrice: 0.6,
    contextWindow: 128000,
    supportsVision: true,
  },
  // Realtime und Previews
  {
    value: 'gpt-realtime',
    label: 'GPT Realtime',
    description: 'Realtime Variante',
    inputPrice: 4.0,
    cachedInputPrice: 0.4,
    outputPrice: 16.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-realtime-mini',
    label: 'GPT Realtime Mini',
    description: 'Realtime, guenstig',
    inputPrice: 0.6,
    cachedInputPrice: 0.06,
    outputPrice: 2.4,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4o-realtime-preview',
    label: 'GPT-4o Realtime Preview',
    description: 'Realtime Preview',
    inputPrice: 5.0,
    cachedInputPrice: 2.5,
    outputPrice: 20.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4o-mini-realtime-preview',
    label: 'GPT-4o Mini Realtime Preview',
    description: 'Realtime Preview, guenstig',
    inputPrice: 0.6,
    cachedInputPrice: 0.3,
    outputPrice: 2.4,
    contextWindow: 128000,
    supportsVision: true,
  },
  // Reasoning / o-Serie
  {
    value: 'o1',
    label: 'O1',
    description: 'Reasoning Modell',
    inputPrice: 15.0,
    cachedInputPrice: 7.5,
    outputPrice: 60.0,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o1-pro',
    label: 'O1 Pro',
    description: 'Reasoning Pro',
    inputPrice: 150.0,
    outputPrice: 600.0,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o1-mini',
    label: 'O1 Mini',
    description: 'Reasoning Mini',
    inputPrice: 1.1,
    cachedInputPrice: 0.55,
    outputPrice: 4.4,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o3-pro',
    label: 'O3 Pro',
    description: 'O-Serie Pro',
    inputPrice: 20.0,
    outputPrice: 80.0,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o3',
    label: 'O3',
    description: 'O-Serie Standard',
    inputPrice: 2.0,
    cachedInputPrice: 0.5,
    outputPrice: 8.0,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o3-deep-research',
    label: 'O3 Deep Research',
    description: 'Deep Research',
    inputPrice: 10.0,
    cachedInputPrice: 2.5,
    outputPrice: 40.0,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o3-mini',
    label: 'O3 Mini',
    description: 'O-Serie Mini',
    inputPrice: 1.1,
    cachedInputPrice: 0.55,
    outputPrice: 4.4,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o4-mini',
    label: 'O4 Mini',
    description: 'Neues O4 Mini',
    inputPrice: 1.1,
    cachedInputPrice: 0.275,
    outputPrice: 4.4,
    contextWindow: 200000,
    supportsVision: false,
  },
  {
    value: 'o4-mini-deep-research',
    label: 'O4 Mini Deep Research',
    description: 'O4 Deep Research',
    inputPrice: 2.0,
    cachedInputPrice: 0.5,
    outputPrice: 8.0,
    contextWindow: 200000,
    supportsVision: false,
  },
  // Suche und Tools
  {
    value: 'gpt-4o-mini-search-preview',
    label: 'GPT-4o Mini Search Preview',
    description: 'Search Preview (Mini)',
    inputPrice: 0.15,
    outputPrice: 0.6,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4o-search-preview',
    label: 'GPT-4o Search Preview',
    description: 'Search Preview',
    inputPrice: 2.5,
    outputPrice: 10.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'computer-use-preview',
    label: 'Computer Use Preview',
    description: 'Tool-gestuetzt',
    inputPrice: 3.0,
    outputPrice: 12.0,
    contextWindow: 128000,
    supportsVision: false,
  },
  {
    value: 'codex-mini-latest',
    label: 'Codex Mini Latest',
    description: 'Codex Mini',
    inputPrice: 1.5,
    cachedInputPrice: 0.375,
    outputPrice: 6.0,
    contextWindow: 128000,
    supportsVision: false,
  },
  // GPT-4 Turbo und Classic
  {
    value: 'gpt-4-turbo-2024-04-09',
    label: 'GPT-4 Turbo (Apr 2024)',
    description: 'Turbo Version Apr 2024',
    inputPrice: 10.0,
    outputPrice: 30.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'Leistungsstark, 128K Kontext',
    inputPrice: 10.0,
    outputPrice: 30.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4-turbo-preview',
    label: 'GPT-4 Turbo Preview',
    description: 'Preview-Version',
    inputPrice: 10.0,
    outputPrice: 30.0,
    contextWindow: 128000,
    supportsVision: true,
  },
  {
    value: 'gpt-4-0125-preview',
    label: 'GPT-4 (Jan 2024 Preview)',
    description: 'Preview-Modell aus Januar 2024',
    inputPrice: 10.0,
    outputPrice: 30.0,
    contextWindow: 128000,
    supportsVision: false,
  },
  {
    value: 'gpt-4-0613',
    label: 'GPT-4 (Jun 2023)',
    description: 'Stabiles Legacy-Modell',
    inputPrice: 30.0,
    outputPrice: 60.0,
    contextWindow: 8192,
    supportsVision: false,
  },
  {
    value: 'gpt-4',
    label: 'GPT-4',
    description: 'Original GPT-4, 8K Kontext',
    inputPrice: 30.0,
    outputPrice: 60.0,
    contextWindow: 8192,
    supportsVision: false,
  },
  // GPT-3.5 Familie
  {
    value: 'gpt-3.5-turbo',
    label: 'GPT-3.5 Turbo',
    description: 'Schnell, sehr guenstig',
    inputPrice: 0.5,
    outputPrice: 1.5,
    contextWindow: 16385,
    supportsVision: false,
  },
  {
    value: 'gpt-3.5-turbo-16k',
    label: 'GPT-3.5 Turbo 16K',
    description: 'Groesserer Kontext',
    inputPrice: 3.0,
    outputPrice: 4.0,
    contextWindow: 16385,
    supportsVision: false,
  },
  {
    value: 'gpt-3.5-turbo-1106',
    label: 'GPT-3.5 Turbo (Nov 2023)',
    description: 'Stabile 3.5-Version von Nov 2023',
    inputPrice: 1.0,
    outputPrice: 2.0,
    contextWindow: 16385,
    supportsVision: false,
  },
  {
    value: 'gpt-3.5-turbo-instruct',
    label: 'GPT-3.5 Instruct',
    description: 'Klassisches Instruct-Modell',
    inputPrice: 1.5,
    outputPrice: 2.0,
    contextWindow: 16385,
    supportsVision: false,
  },
  {
    value: 'gpt-3.5-turbo-instruct-0914',
    label: 'GPT-3.5 Instruct (Sep 2023)',
    description: 'Instruct Sep 2023',
    inputPrice: 1.5,
    outputPrice: 2.0,
    contextWindow: 16385,
    supportsVision: false,
  },
]

// Modelle die Vision unterstuetzen
export const VISION_MODELS = LLM_MODELS.filter((m) => m.supportsVision)

function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback((value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      setState(value)
    } catch (e) {
      console.warn('localStorage setItem failed:', e)
    }
  }, [key])

  return [state, setValue]
}

export function useLLMModel() {
  const [standardModel, setStandardModel] = useLocalStorage<LLMModel>('llm-model-standard', 'gpt-4o-mini')
  const [visionModel, setVisionModel] = useLocalStorage<LLMModel>('llm-model-vision', 'gpt-4o')

  return {
    standardModel,
    setStandardModel,
    visionModel,
    setVisionModel,
  }
}
