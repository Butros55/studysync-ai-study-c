import { useEffect, useState } from 'react'
import { devToolsStore, type ApiLogEntry, type BackendMeta, type CapturedError } from '@/lib/devtools-store'

type DevToolsSlice = {
  devMode: boolean
  debugLogging: boolean
  logs: ApiLogEntry[]
  meta?: BackendMeta
  lastError?: CapturedError
}

function useDevToolsSlice(): DevToolsSlice {
  const [state, setState] = useState<DevToolsSlice>(() => devToolsStore.getState())

  useEffect(() => {
    return devToolsStore.subscribe((next) => setState(next))
  }, [])

  return state
}

export function useDebugMode() {
  const state = useDevToolsSlice()
  return {
    enabled: state.devMode && state.debugLogging,
    devMode: state.devMode,
    debugLogging: state.debugLogging,
    setEnabled: (value: boolean) => devToolsStore.setDebugLogging(value),
    setDevMode: (value: boolean) => devToolsStore.setDevMode(value),
  }
}

export function useDebugLogs() {
  const state = useDevToolsSlice()

  return {
    logs: state.logs,
    meta: state.meta,
    clearLogs: () => devToolsStore.clearLogs(),
  }
}

export function useDevToolsState() {
  return useDevToolsSlice()
}
