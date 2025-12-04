export interface DebugLogEntry {
  id: string
  timestamp: number
  type: 'llm-request' | 'llm-response' | 'llm-error'
  data: {
    prompt?: string
    model?: string
    jsonMode?: boolean
    response?: string
    error?: string
    errorStack?: string
    attempt?: number
    maxRetries?: number
  }
}

class DebugStore {
  private listeners: Set<(logs: DebugLogEntry[]) => void> = new Set()
  private logs: DebugLogEntry[] = []
  private maxLogs = 100

  subscribe(listener: (logs: DebugLogEntry[]) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  addLog(entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) {
    const newEntry: DebugLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    }

    this.logs.unshift(newEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    this.notifyListeners()
  }

  getLogs() {
    return [...this.logs]
  }

  clearLogs() {
    this.logs = []
    this.notifyListeners()
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]))
  }
}

export const debugStore = new DebugStore()
