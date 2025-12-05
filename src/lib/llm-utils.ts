import { rateLimitTracker } from './rate-limit-tracker'
import { debugStore } from './debug-store'
import { TokenUsage } from './types'
import { calculateCost } from './cost-tracker'
import { generateId } from './utils-app'

const RATE_LIMIT_COOLDOWN_KEY = 'llm-rate-limit-cooldown'
const RATE_LIMIT_COOLDOWN_DURATION = 5 * 60 * 1000
const TOKEN_USAGE_KEY = 'token-usage'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Lokale Storage-Helfer (ersetzt spark.kv)
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

function deleteLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn('localStorage removeItem failed:', e)
  }
}

async function isInCooldown(): Promise<boolean> {
  const cooldownUntil = getLocalStorage<number>(RATE_LIMIT_COOLDOWN_KEY)
  if (!cooldownUntil) return false
  
  const now = Date.now()
  if (now < cooldownUntil) {
    return true
  }
  
  deleteLocalStorage(RATE_LIMIT_COOLDOWN_KEY)
  return false
}

async function setCooldown(durationMs: number = RATE_LIMIT_COOLDOWN_DURATION): Promise<void> {
  const cooldownUntil = Date.now() + durationMs
  setLocalStorage(RATE_LIMIT_COOLDOWN_KEY, cooldownUntil)
}

async function getRemainingCooldown(): Promise<number> {
  const cooldownUntil = getLocalStorage<number>(RATE_LIMIT_COOLDOWN_KEY)
  if (!cooldownUntil) return 0
  
  const remaining = cooldownUntil - Date.now()
  return Math.max(0, remaining)
}

export async function llmWithRetry(
  prompt: string,
  model: string = 'gpt-4o-mini',
  jsonMode: boolean = false,
  maxRetries: number = 1,
  operation: string = 'unknown',
  moduleId?: string,
  imageBase64?: string  // Neuer Parameter für Vision-API
): Promise<string> {
  if (await isInCooldown()) {
    const remainingMs = await getRemainingCooldown()
    const remainingMin = Math.ceil(remainingMs / 60000)
    throw new Error(`API ist noch für ${remainingMin} Minute${remainingMin > 1 ? 'n' : ''} in Abkühlung. Bitte warte, bevor du weitere Anfragen sendest.`)
  }
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const baseDelay = 2000 * Math.pow(2, attempt)
        const jitter = Math.random() * 2000
        const totalDelay = Math.min(baseDelay + jitter, 60000)
        
        console.log(`LLM retry attempt ${attempt + 1}/${maxRetries}, waiting ${Math.round(totalDelay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, totalDelay))
      }
      
      const info = await rateLimitTracker.getInfo()
      const remaining = rateLimitTracker.getRemainingCalls(info)
      
      if (remaining <= 10 && remaining > 0) {
        console.warn(`Nur noch ${remaining} API-Aufrufe verfügbar in dieser Stunde`)
        const delayTime = remaining <= 5 ? 5000 : 2000
        await new Promise(resolve => setTimeout(resolve, delayTime))
      }
      
      debugStore.addLog({
        type: 'llm-request',
        data: {
          prompt: prompt.substring(0, 500),
          model,
          jsonMode,
          attempt: attempt + 1,
          maxRetries,
          hasImage: !!imageBase64,
          imageSize: imageBase64 ? `${Math.round(imageBase64.length / 1024)}KB` : 'none',
        },
      })
      
      await rateLimitTracker.recordCall()
      
      const response = await fetch(`${API_BASE_URL}/api/llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model,
          jsonMode,
          operation,
          moduleId,
          image: imageBase64, // Bild für Vision-API mitsenden (Data URL bevorzugt)
          imageBase64, // Legacy-Feld für Abwärtskompatibilität
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Unbekannter Fehler', 
          details: response.statusText 
        }))
        
        if (response.status === 429) {
          throw new Error(`Rate Limit erreicht: ${errorData.details || 'Zu viele Anfragen'}`)
        }
        
        if (response.status === 413) {
          throw new Error(`Token-Limit überschritten: ${errorData.details || 'Text ist zu lang'}`)
        }
        
        throw new Error(errorData.details || errorData.error || 'API-Fehler')
      }

      const data = await response.json()
      const responseText = data.response
      
      if (data.usage) {
        const usageRecord: TokenUsage = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          model: data.model || model,
          promptTokens: data.usage.promptTokens || 0,
          completionTokens: data.usage.completionTokens || 0,
          totalTokens: data.usage.totalTokens || 0,
          cost: data.usage.cost || 0,
          operation: operation,
          moduleId: moduleId,
        }
        
        const existingUsage = getLocalStorage<TokenUsage[]>(TOKEN_USAGE_KEY) || []
        setLocalStorage(TOKEN_USAGE_KEY, [...existingUsage, usageRecord])
      }
      
      debugStore.addLog({
        type: 'llm-response',
        data: {
          prompt: prompt.substring(0, 200),
          model,
          jsonMode,
          response: responseText.substring(0, 1000),
          attempt: attempt + 1,
          usage: data.usage,
        },
      })
      
      return responseText
      
    } catch (error) {
      lastError = error as Error
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      
      debugStore.addLog({
        type: 'llm-error',
        data: {
          prompt: prompt.substring(0, 200),
          model,
          jsonMode,
          error: errorMessage,
          errorStack,
          attempt: attempt + 1,
          maxRetries,
        },
      })
      
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests') || errorMessage.includes('rate limit') || errorMessage.includes('Rate Limit')) {
        console.warn(`Rate limit hit on attempt ${attempt + 1}/${maxRetries}`)
        await setCooldown()
        
        throw new Error('OpenAI API-Ratenlimit erreicht (429). Die API ist für 5 Minuten pausiert, um weitere Fehler zu vermeiden. Bitte warte, bevor du weitere Anfragen sendest.')
      }
      
      if (errorMessage.includes('token') && errorMessage.includes('limit')) {
        throw new Error('Token-Limit erreicht. Das Dokument ist zu lang. Bitte teile es in kleinere Abschnitte auf.')
      }
      
      if (errorMessage.includes('Ratenlimit erreicht') || errorMessage.includes('Abkühlung')) {
        throw error
      }
      
      if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        throw new Error('Verbindung zum Backend fehlgeschlagen. Stelle sicher, dass der Server läuft (npm run server).')
      }
      
      throw error
    }
  }
  
  if (lastError) {
    throw lastError
  }
  
  throw new Error('LLM request failed with unknown error')
}
