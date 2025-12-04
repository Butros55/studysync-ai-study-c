import { useState, useEffect, useCallback } from 'react'

export type LLMModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-3.5-turbo'

export const LLM_MODELS: { value: LLMModel; label: string; description: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Neuestes Modell, am leistungsfähigsten' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Schnell und günstig (Standard)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Leistungsstark, größerer Kontext' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Am günstigsten, schnell' },
]

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
