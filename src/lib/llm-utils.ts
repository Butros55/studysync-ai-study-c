import { rateLimitTracker } from './rate-limit-tracker'
import { TokenUsage } from './types'
import { generateId } from './utils-app'
import { devToolsStore } from './devtools-store'
import { estimateCost } from './model-pricing'

const RATE_LIMIT_COOLDOWN_KEY = 'llm-rate-limit-cooldown'
const RATE_LIMIT_COOLDOWN_DURATION = 5 * 60 * 1000
const TOKEN_USAGE_KEY = 'token-usage'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

function loggingEnabled() {
  const state = devToolsStore.getState()
  return state.devMode && state.debugLogging
}

function buildErrorMessage(
  responseStatus: number,
  responseStatusText: string,
  errorData?: { error?: string; details?: string }
) {
  if (errorData?.details) return errorData.details
  if (errorData?.error) return errorData.error
  return `HTTP ${responseStatus}: ${responseStatusText || 'Unknown error'}`
}

export async function llmWithRetry(
  prompt: string,
  model: string = 'gpt-4o-mini',
  jsonMode: boolean = false,
  maxRetries: number = 1,
  operation: string = 'unknown',
  moduleId?: string,
  imageBase64?: string
): Promise<string> {
  if (await isInCooldown()) {
    const remainingMs = await getRemainingCooldown()
    const remainingMin = Math.ceil(remainingMs / 60000)
    throw new Error(
      `API ist noch fuer ${remainingMin} Minute${remainingMin > 1 ? 'n' : ''} in Abkuehlung. Bitte warte, bevor du weitere Anfragen sendest.`
    )
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const startedAt = Date.now()
    const requestBody = {
      prompt,
      model,
      jsonMode,
      operation,
      moduleId,
      image: imageBase64,
      imageBase64,
      attempt: attempt + 1,
      maxRetries,
    }

    try {
      if (attempt > 0) {
        const baseDelay = 2000 * Math.pow(2, attempt)
        const jitter = Math.random() * 2000
        const totalDelay = Math.min(baseDelay + jitter, 60000)
        await new Promise((resolve) => setTimeout(resolve, totalDelay))
      }

      const info = await rateLimitTracker.getInfo()
      const remaining = rateLimitTracker.getRemainingCalls(info)

      if (remaining <= 10 && remaining > 0) {
        const delayTime = remaining <= 5 ? 5000 : 2000
        await new Promise((resolve) => setTimeout(resolve, delayTime))
      }

      await rateLimitTracker.recordCall()

      const response = await fetch(`${API_BASE_URL}/api/llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const durationMs = Date.now() - startedAt
      const rawText = await response.text().catch(() => '')

      let data: any = {}
      if (rawText) {
        try {
          data = JSON.parse(rawText)
        } catch {
          data = { response: rawText }
        }
      }

      if (!response.ok) {
        const errorMessage = buildErrorMessage(response.status, response.statusText, data)

        if (loggingEnabled()) {
          devToolsStore.addLog({
            startedAt,
            durationMs,
            request: {
              url: `${API_BASE_URL}/api/llm`,
              method: 'POST',
              body: requestBody,
            },
            response: {
              status: response.status,
              body: data,
              textPreview: rawText?.slice(0, 1200),
            },
            llm: {
              model,
              operation,
              jsonMode,
            },
            error: { message: errorMessage },
          })
        }

        if (response.status === 0) {
          throw new Error(`CORS-Fehler oder keine Verbindung zum Backend (${API_BASE_URL}). Bitte pruefe die Server-Konfiguration.`)
        }
        if (response.status === 429) {
          throw new Error(`Rate Limit erreicht: ${errorMessage}`)
        }
        if (response.status === 413) {
          throw new Error(`Token-Limit ueberschritten: ${errorMessage}`)
        }
        if (response.status === 500) {
          throw new Error(`Server-Fehler (500): ${errorMessage}`)
        }

        throw new Error(errorMessage)
      }

      const responseText: string = data.response
      const rawUsage = data.usage?.raw || data.usage || {}
      const estimation = estimateCost(data.model || model, rawUsage)
      const usageRecord: TokenUsage = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        model: data.model || model,
        promptTokens: data.usage?.promptTokens ?? rawUsage.prompt_tokens ?? 0,
        completionTokens: data.usage?.completionTokens ?? rawUsage.completion_tokens ?? 0,
        totalTokens:
          data.usage?.totalTokens ??
          rawUsage.total_tokens ??
          ((rawUsage.prompt_tokens || 0) + (rawUsage.completion_tokens || 0)),
        cost: data.cost?.estimatedUsd ?? data.usage?.cost ?? estimation.cost.estimatedUsd ?? 0,
        operation: operation,
        moduleId: moduleId,
      }

      if (data.usage) {
        const existingUsage = getLocalStorage<TokenUsage[]>(TOKEN_USAGE_KEY) || []
        setLocalStorage(TOKEN_USAGE_KEY, [...existingUsage, usageRecord])
      }

      if (loggingEnabled()) {
        devToolsStore.addLog({
          startedAt,
          durationMs,
          request: {
            url: `${API_BASE_URL}/api/llm`,
            method: 'POST',
            body: requestBody,
          },
          response: {
            status: response.status,
            body: data,
            textPreview: typeof responseText === 'string' ? responseText.slice(0, 1200) : undefined,
          },
          llm: {
            model: data.model || model,
            normalizedModel: data.normalizedModel || estimation.normalizedModel,
            operation,
            jsonMode,
            usage: rawUsage,
            cost: data.cost || estimation.cost,
          },
        })
      }

      return responseText
    } catch (error) {
      lastError = error as Error
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      const durationMs = Date.now() - startedAt

      if (loggingEnabled()) {
        devToolsStore.addLog({
          startedAt,
          durationMs,
          request: {
            url: `${API_BASE_URL}/api/llm`,
            method: 'POST',
            body: requestBody,
          },
          llm: {
            model,
            operation,
            jsonMode,
          },
          error: {
            message: errorMessage,
            stack: errorStack,
          },
        })
      }

      if (errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        await setCooldown()
        throw new Error(
          'OpenAI API-Ratenlimit erreicht (429). Die API ist fuer 5 Minuten pausiert, um weitere Fehler zu vermeiden. Bitte warte, bevor du weitere Anfragen sendest.'
        )
      }

      if (errorMessage.toLowerCase().includes('token') && errorMessage.toLowerCase().includes('limit')) {
        throw new Error('Token-Limit erreicht. Das Dokument ist zu lang. Bitte teile es in kleinere Abschnitte auf.')
      }

      if (errorMessage.toLowerCase().includes('ratenlimit erreicht') || errorMessage.toLowerCase().includes('abkuehlung')) {
        throw error
      }

      if (
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('failed to fetch') ||
        errorMessage.toLowerCase().includes('networkerror') ||
        errorMessage.toLowerCase().includes('econnrefused')
      ) {
        const isLocalhost = API_BASE_URL.includes('localhost')
        if (isLocalhost) {
          throw new Error('Verbindung zum lokalen Backend fehlgeschlagen. Starte den Server mit: npm run server')
        } else {
          throw new Error(
            `Verbindung zum Backend (${API_BASE_URL}) fehlgeschlagen. Der Dienst ist moeglicherweise nicht erreichbar oder startet gerade neu. Bitte versuche es in 30 Sekunden erneut.`
          )
        }
      }

      // other errors: retry loop continues or bubble after loop
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('LLM request failed with unknown error')
}
