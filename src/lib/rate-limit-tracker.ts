export interface RateLimitInfo {
  totalCalls: number
  lastReset: string
  window: number
}

const RATE_LIMIT_WINDOW = 60 * 60 * 1000
const MAX_CALLS_PER_HOUR = 30
const STORAGE_KEY = 'rate-limit-info'

// Lokale Storage-Helfer
function getLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch {
    return null
  }
}

function setLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage setItem failed:', e)
  }
}

export class RateLimitTracker {
  private static instance: RateLimitTracker
  private listeners: Set<(info: RateLimitInfo) => void> = new Set()

  private constructor() {}

  static getInstance(): RateLimitTracker {
    if (!RateLimitTracker.instance) {
      RateLimitTracker.instance = new RateLimitTracker()
    }
    return RateLimitTracker.instance
  }

  async getInfo(): Promise<RateLimitInfo> {
    const info = getLocalStorage<RateLimitInfo>(STORAGE_KEY)
    
    if (!info) {
      const newInfo: RateLimitInfo = {
        totalCalls: 0,
        lastReset: new Date().toISOString(),
        window: RATE_LIMIT_WINDOW,
      }
      setLocalStorage(STORAGE_KEY, newInfo)
      return newInfo
    }

    const resetTime = new Date(info.lastReset).getTime()
    const now = Date.now()
    
    if (now - resetTime > RATE_LIMIT_WINDOW) {
      const resetInfo: RateLimitInfo = {
        totalCalls: 0,
        lastReset: new Date().toISOString(),
        window: RATE_LIMIT_WINDOW,
      }
      setLocalStorage(STORAGE_KEY, resetInfo)
      this.notifyListeners(resetInfo)
      return resetInfo
    }

    return info
  }

  async recordCall(): Promise<void> {
    const info = await this.getInfo()
    const updatedInfo: RateLimitInfo = {
      ...info,
      totalCalls: info.totalCalls + 1,
    }
    setLocalStorage(STORAGE_KEY, updatedInfo)
    this.notifyListeners(updatedInfo)
  }

  getRemainingCalls(info: RateLimitInfo): number {
    return Math.max(0, MAX_CALLS_PER_HOUR - info.totalCalls)
  }

  getTimeUntilReset(info: RateLimitInfo): number {
    const resetTime = new Date(info.lastReset).getTime()
    const now = Date.now()
    const elapsed = now - resetTime
    return Math.max(0, RATE_LIMIT_WINDOW - elapsed)
  }

  subscribe(callback: (info: RateLimitInfo) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners(info: RateLimitInfo): void {
    this.listeners.forEach(callback => callback(info))
  }
  
  async resetCounter(): Promise<void> {
    const resetInfo: RateLimitInfo = {
      totalCalls: 0,
      lastReset: new Date().toISOString(),
      window: RATE_LIMIT_WINDOW,
    }
    setLocalStorage(STORAGE_KEY, resetInfo)
    this.notifyListeners(resetInfo)
  }
}

export const rateLimitTracker = RateLimitTracker.getInstance()
