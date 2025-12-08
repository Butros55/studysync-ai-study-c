import { devToolsStore } from './devtools-store'

let listenersRegistered = false

export function setupGlobalErrorListeners() {
  if (typeof window === 'undefined' || listenersRegistered) return
  listenersRegistered = true

  const capture = (message: string, stack: string | undefined, source: 'error' | 'promise' | 'boundary') => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    devToolsStore.captureError({
      id,
      message,
      stack,
      source,
      url: window.location.href,
      timestamp: Date.now(),
    })
  }

  const handleError = (event: ErrorEvent) => {
    const err = event.error
    const message = err?.message || event.message || 'Unknown error'
    const stack = err?.stack
    capture(message, stack, 'error')
  }

  const handlePromise = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const message = reason?.message || String(reason)
    const stack = reason?.stack
    capture(message, stack, 'promise')
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handlePromise)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handlePromise)
    listenersRegistered = false
  }
}
