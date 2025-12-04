import { useEffect, useState } from 'react'
import { rateLimitTracker, RateLimitInfo } from '@/lib/rate-limit-tracker'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Warning, X, FireExtinguisher } from '@phosphor-icons/react'
import { Button } from './ui/button'

const RATE_LIMIT_COOLDOWN_KEY = 'llm-rate-limit-cooldown'

// Lokale Storage-Helfer
function getLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch {
    return null
  }
}

function deleteLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn('localStorage removeItem failed:', e)
  }
}

export function RateLimitBanner() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [cooldownMinutes, setCooldownMinutes] = useState(0)

  useEffect(() => {
    const loadInfo = async () => {
      const info = await rateLimitTracker.getInfo()
      setRateLimitInfo(info)
      
      const cooldown = getLocalStorage<number>(RATE_LIMIT_COOLDOWN_KEY)
      setCooldownUntil(cooldown || null)
    }
    loadInfo()

    const unsubscribe = rateLimitTracker.subscribe((info) => {
      setRateLimitInfo(info)
      if (rateLimitTracker.getRemainingCalls(info) > 5) {
        setDismissed(false)
      }
    })

    const interval = setInterval(() => {
      const cooldown = getLocalStorage<number>(RATE_LIMIT_COOLDOWN_KEY)
      setCooldownUntil(cooldown || null)
      
      if (cooldown) {
        const remaining = cooldown - Date.now()
        setCooldownMinutes(Math.ceil(Math.max(0, remaining) / 60000))
        
        if (remaining <= 0) {
          deleteLocalStorage(RATE_LIMIT_COOLDOWN_KEY)
          setCooldownUntil(null)
        }
      }
    }, 1000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  if (dismissed) return null

  if (cooldownUntil && cooldownUntil > Date.now()) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        <Alert variant="destructive" className="relative">
          <FireExtinguisher className="h-5 w-5" weight="fill" />
          <AlertTitle className="flex items-center justify-between">
            <span>API-Abkühlphase aktiv</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 hover:bg-transparent"
              onClick={() => setDismissed(true)}
            >
              <X size={16} />
            </Button>
          </AlertTitle>
          <AlertDescription className="text-sm">
            Die API wurde wegen zu vieler Anfragen (429-Fehler) pausiert. 
            <strong> Noch {cooldownMinutes} Minute{cooldownMinutes !== 1 ? 'n' : ''}</strong> Wartezeit. 
            Danach kannst du wieder Anfragen senden.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!rateLimitInfo) return null

  const remaining = rateLimitTracker.getRemainingCalls(rateLimitInfo)
  
  if (remaining > 5) return null

  const timeUntilReset = rateLimitTracker.getTimeUntilReset(rateLimitInfo)
  const minutes = Math.ceil(timeUntilReset / 60000)

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
      <Alert variant="destructive" className="relative">
        <Warning className="h-5 w-5" weight="fill" />
        <AlertTitle className="flex items-center justify-between">
          <span>Ratenlimit-Warnung</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 hover:bg-transparent"
            onClick={() => setDismissed(true)}
          >
            <X size={16} />
          </Button>
        </AlertTitle>
        <AlertDescription className="text-sm">
          {remaining === 0 ? (
            <>
              Das API-Limit wurde erreicht. Bitte warte <strong>{minutes} Minuten</strong> oder nutze den Reset-Button im Ratenlimit-Indikator oben rechts, bevor du weitere Aktionen durchführst.
            </>
          ) : (
            <>
              Nur noch <strong>{remaining} API-Anfragen</strong> in dieser Stunde verfügbar. 
              Automatisches Reset in <strong>{minutes} Minuten</strong>. 
              Nutze die API sparsam, um 429-Fehler zu vermeiden.
            </>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
