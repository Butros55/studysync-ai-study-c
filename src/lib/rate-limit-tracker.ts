export interface RateLimitInfo {
  totalCalls: number
  lastReset: string
  window: number
}

const RATE_LIMIT_WINDOW = 60 * 60 * 1000
const MAX_CALLS_PER_HOUR = 30

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
    const info = await spark.kv.get<RateLimitInfo>('rate-limit-info')
    
    if (!info) {
      const newInfo: RateLimitInfo = {
        totalCalls: 0,
        lastReset: new Date().toISOString(),
        window: RATE_LIMIT_WINDOW,
      }
      await spark.kv.set('rate-limit-info', newInfo)
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
      await spark.kv.set('rate-limit-info', resetInfo)
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
    await spark.kv.set('rate-limit-info', updatedInfo)
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
    await spark.kv.set('rate-limit-info', resetInfo)
    this.notifyListeners(resetInfo)
  }
}

export const rateLimitTracker = RateLimitTracker.getInstance()
