import { useKV } from '@github/spark/hooks'
import { useEffect, useState } from 'react'
import { debugStore, DebugLogEntry } from '@/lib/debug-store'

export function useDebugMode() {
  const [enabled, setEnabled] = useKV<boolean>('debug-mode-enabled', false)
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
