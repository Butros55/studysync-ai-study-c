import { useEffect, useState, useCallback } from 'react'
import { debugStore, DebugLogEntry } from '@/lib/debug-store'

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

export function useDebugMode() {
  const [enabled, setEnabled] = useLocalStorage<boolean>('debug-mode-enabled', false)
  return { enabled, setEnabled }
}

export function useDebugLogs() {
  const [logs, setLogs] = useState<DebugLogEntry[]>(() => debugStore.getLogs())

  useEffect(() => {
    return debugStore.subscribe(setLogs)
  }, [])

  return {
    logs,
    clearLogs: () => debugStore.clearLogs(),
  }
}
