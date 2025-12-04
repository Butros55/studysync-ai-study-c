import { rateLimitTracker } from './rate-limit-tracker'
import { debugStore } from './debug-store'

const RATE_LIMIT_COOLDOWN_KEY = 'llm-rate-limit-cooldown'
const RATE_LIMIT_COOLDOWN_DURATION = 5 * 60 * 1000

async function isInCooldown(): Promise<boolean> {
  const cooldownUntil = await spark.kv.get<number>(RATE_LIMIT_COOLDOWN_KEY)
  if (!cooldownUntil) return false
  
  const now = Date.now()
  if (now < cooldownUntil) {
    return true
  }
  
  await spark.kv.delete(RATE_LIMIT_COOLDOWN_KEY)
  return false
}

async function setCooldown(durationMs: number = RATE_LIMIT_COOLDOWN_DURATION): Promise<void> {
  const cooldownUntil = Date.now() + durationMs
  await spark.kv.set(RATE_LIMIT_COOLDOWN_KEY, cooldownUntil)
}

async function getRemainingCooldown(): Promise<number> {
  const cooldownUntil = await spark.kv.get<number>(RATE_LIMIT_COOLDOWN_KEY)
  if (!cooldownUntil) return 0
  
  const remaining = cooldownUntil - Date.now()
  return Math.max(0, remaining)
}

export async function llmWithRetry(
  prompt: string,
  model: string = 'gpt-4o',
  jsonMode: boolean = false,
  maxRetries: number = 1
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
      
      if (remaining <= 0) {
        const timeUntilReset = rateLimitTracker.getTimeUntilReset(info)
        throw new Error(`Ratenlimit erreicht. Reset in ${Math.ceil(timeUntilReset / 60000)} Minuten. Bitte warte, bevor du weitere Anfragen sendest.`)
      }
      
      if (remaining <= 10) {
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
        },
      })
      
      await rateLimitTracker.recordCall()
      const response = await spark.llm(prompt, model, jsonMode)
      
      debugStore.addLog({
        type: 'llm-response',
        data: {
          prompt: prompt.substring(0, 200),
          model,
          jsonMode,
          response: response.substring(0, 1000),
          attempt: attempt + 1,
        },
      })
      
      return response
      
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
      
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) {
        console.warn(`Rate limit hit on attempt ${attempt + 1}/${maxRetries}`)
        await setCooldown()
        
        throw new Error('GitHub API-Ratenlimit erreicht (429). Die API ist für 5 Minuten pausiert, um weitere Fehler zu vermeiden. Bitte warte, bevor du weitere Anfragen sendest.')
      }
      
      if (errorMessage.includes('token') && errorMessage.includes('limit')) {
        throw new Error('Token-Limit erreicht. Das Dokument ist zu lang. Bitte teile es in kleinere Abschnitte auf.')
      }
      
      if (errorMessage.includes('Ratenlimit erreicht') || errorMessage.includes('Abkühlung')) {
        throw error
      }
      
      throw error
    }
  }
  
  if (lastError) {
    throw lastError
  }
  
  throw new Error('LLM request failed with unknown error')
}
