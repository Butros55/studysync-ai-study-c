export async function llmWithRetry(
  prompt: string,
  model: string = 'gpt-4o',
  jsonMode: boolean = false,
  maxRetries: number = 5
): Promise<string> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 30000)
        const jitter = Math.random() * 1000
        const totalDelay = backoffDelay + jitter
        
        console.log(`LLM retry attempt ${attempt + 1}/${maxRetries}, waiting ${Math.round(totalDelay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, totalDelay))
      }
      
      const response = await spark.llm(prompt, model, jsonMode)
      return response
      
    } catch (error) {
      lastError = error as Error
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
        console.warn(`Rate limit hit on attempt ${attempt + 1}/${maxRetries}`)
        continue
      }
      
      throw error
    }
  }
  
  throw new Error(`LLM request failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}
