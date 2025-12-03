import { useEffect, useState } from 'react'
import { rateLimitTracker, RateLimitInfo } from '@/lib/rate-limit-tracker'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Warning, X } from '@phosphor-icons/react'
import { Button } from './ui/button'

export function RateLimitBanner() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const loadInfo = async () => {
      const info = await rateLimitTracker.getInfo()
      setRateLimitInfo(info)
    }
    loadInfo()

    const unsubscribe = rateLimitTracker.subscribe((info) => {
      setRateLimitInfo(info)
      if (rateLimitTracker.getRemainingCalls(info) > 5) {
        setDismissed(false)
      }
    })

    return unsubscribe
  }, [])

  if (!rateLimitInfo || dismissed) return null

  const remaining = rateLimitTracker.getRemainingCalls(rateLimitInfo)
  
  if (remaining > 5) return null

  const timeUntilReset = rateLimitTracker.getTimeUntilReset(rateLimitInfo)
  const minutes = Math.ceil(timeUntilReset / 60000)

  return (
    <div className="max-w-7xl mx-auto px-6 pt-4">
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
