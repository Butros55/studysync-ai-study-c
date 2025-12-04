import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Progress } from './ui/progress'
import { Warning, Clock, CheckCircle, XCircle, ArrowClockwise, FireExtinguisher } from '@phosphor-icons/react'
import { rateLimitTracker, RateLimitInfo } from '@/lib/rate-limit-tracker'
import { toast } from 'sonner'

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

export function RateLimitIndicator() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)
  const [timeUntilReset, setTimeUntilReset] = useState<number>(0)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  useEffect(() => {
    const loadInfo = async () => {
      const info = await rateLimitTracker.getInfo()
      setRateLimitInfo(info)
      setTimeUntilReset(rateLimitTracker.getTimeUntilReset(info))
      
      const cooldown = getLocalStorage<number>(RATE_LIMIT_COOLDOWN_KEY)
      setCooldownUntil(cooldown || null)
    }

    loadInfo()
    const unsubscribe = rateLimitTracker.subscribe((info) => {
      setRateLimitInfo(info)
      setTimeUntilReset(rateLimitTracker.getTimeUntilReset(info))
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!rateLimitInfo) return
    const interval = setInterval(async () => {
      const remaining = rateLimitTracker.getTimeUntilReset(rateLimitInfo)
      setTimeUntilReset(remaining)
      
      const cooldown = getLocalStorage<number>(RATE_LIMIT_COOLDOWN_KEY)
      setCooldownUntil(cooldown || null)
      
      if (cooldown) {
        const cooldownRem = cooldown - Date.now()
        setCooldownRemaining(Math.max(0, cooldownRem))
        
        if (cooldownRem <= 0) {
          deleteLocalStorage(RATE_LIMIT_COOLDOWN_KEY)
          setCooldownUntil(null)
        }
      }
      
      if (remaining <= 0) {
        rateLimitTracker.getInfo().then(info => {
          setRateLimitInfo(info)
          setTimeUntilReset(rateLimitTracker.getTimeUntilReset(info))
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [rateLimitInfo])

  if (!rateLimitInfo) return null

  const remaining = rateLimitTracker.getRemainingCalls(rateLimitInfo)
  const total = 30
  const percentage = (remaining / total) * 100

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const inCooldown = cooldownUntil && cooldownUntil > Date.now()

  const getStatusColor = () => {
    if (inCooldown) return 'text-destructive'
    if (percentage > 50) return 'text-accent'
    if (percentage > 20) return 'text-warning'
    return 'text-destructive'
  }

  const getStatusIcon = () => {
    if (inCooldown) return <FireExtinguisher className={getStatusColor()} weight="fill" />
    if (percentage > 50) return <CheckCircle className={getStatusColor()} weight="fill" />
    if (percentage > 20) return <Warning className={getStatusColor()} weight="fill" />
    return <XCircle className={getStatusColor()} weight="fill" />
  }

  const handleReset = async () => {
    await rateLimitTracker.resetCounter()
    deleteLocalStorage(RATE_LIMIT_COOLDOWN_KEY)
    setCooldownUntil(null)
    toast.success('Ratenlimit-Zähler und Cooldown zurückgesetzt')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={inCooldown || percentage <= 20 ? 'destructive' : percentage <= 50 ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2 transition-colors"
        >
          {getStatusIcon()}
          <span className="font-medium">{inCooldown ? '🔥' : remaining}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1">API-Status</h4>
            <p className="text-sm text-muted-foreground">
              {inCooldown ? 'Abkühlphase aktiv' : 'Verbleibende Anfragen in diesem Zeitfenster'}
            </p>
          </div>

          {inCooldown ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <div className="flex gap-2">
                <FireExtinguisher size={18} className="text-destructive flex-shrink-0 mt-0.5" weight="fill" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive mb-1 text-sm">
                    API in Abkühlphase
                  </p>
                  <p className="text-xs text-destructive/90">
                    Wegen 429-Fehler pausiert. Noch <strong>{formatTime(cooldownRemaining)}</strong> Wartezeit.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Verfügbar</span>
                <span className="font-medium">
                  {remaining} / {total}
                </span>
              </div>
              <Progress 
                value={percentage} 
                className="h-2"
              />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock size={14} />
                  Reset in
                </span>
                <span className="font-medium">{formatTime(timeUntilReset)}</span>
              </div>
            </div>
          )}

          {!inCooldown && percentage <= 20 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <div className="flex gap-2">
                <Warning size={18} className="text-destructive flex-shrink-0 mt-0.5" weight="fill" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive mb-1 text-sm">
                    Kritisch wenige Anfragen
                  </p>
                  <p className="text-xs text-destructive/90">
                    Bitte warte bis zum Reset oder nutze die API sehr sparsam.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!inCooldown && percentage > 20 && percentage <= 50 && (
            <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
              <div className="flex gap-2">
                <Warning size={18} className="text-warning flex-shrink-0 mt-0.5" weight="fill" />
                <div className="space-y-1">
                  <p className="font-medium text-warning mb-1 text-sm">
                    Aufmerksamkeit erforderlich
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Weniger als die Hälfte der Anfragen verfügbar. Nutze die API sparsam.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Hinweis: Das Limit wird bei 30 Anfragen/Stunde gesetzt. Zwischen Anfragen werden mindestens 15 Sekunden gewartet. Bei 429-Fehlern wird eine 5-minütige Abkühlphase aktiviert.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleReset}
            >
              <ArrowClockwise size={16} />
              {inCooldown ? 'Cooldown & Zähler zurücksetzen' : 'Zähler zurücksetzen'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
