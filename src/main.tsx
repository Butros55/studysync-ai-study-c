import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import { setupGlobalErrorListeners } from './lib/error-monitor'
import { devToolsStore } from './lib/devtools-store'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { Toaster } from './components/ui/sonner'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

setupGlobalErrorListeners()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error) => {
      const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
      devToolsStore.captureError({
        id,
        message: error.message,
        stack: error.stack,
        source: 'boundary',
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: Date.now(),
      })
    }}
  >
    <>
      <Toaster richColors closeButton duration={2500} />
      <App />
    </>
   </ErrorBoundary>
)
