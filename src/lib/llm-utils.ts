import { rateLimitTracker } from './rate-limit-tracker'
import { debugStore } from './debug-store'

export async function llmWithRetry(
  prompt: string,
  model: string = 'gpt-5',
  jsonMode: boolean = false,
  maxRetries: number = 1
): Promise<string> {
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
      
      if (remaining <= 5) {
        console.warn(`Nur noch ${remaining} API-Aufrufe verfügbar in dieser Stunde`)
        await new Promise(resolve => setTimeout(resolve, 3000))
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
      
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
        console.warn(`Rate limit hit on attempt ${attempt + 1}/${maxRetries}`)
        
        if (attempt === maxRetries - 1) {
          throw new Error('GitHub API-Ratenlimit erreicht. Bitte warte einige Minuten, bevor du weitere Anfragen sendest.')
        }
        continue
      }
      
      if (errorMessage.includes('Ratenlimit erreicht')) {
        throw error
      }
      
      throw error
    }
  }
  
  throw new Error(`LLM request failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}
