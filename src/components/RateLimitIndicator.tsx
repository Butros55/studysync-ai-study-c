import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Progress } from './ui/progress'
import { Warning, Clock, CheckCircle, XCircle, ArrowClockwise } from '@phosphor-icons/react'
import { rateLimitTracker, RateLimitInfo } from '@/lib/rate-limit-tracker'
import { toast } from 'sonner'

export function RateLimitIndicator() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)
  const [timeUntilReset, setTimeUntilReset] = useState<number>(0)

  useEffect(() => {
    const loadInfo = async () => {
      const info = await rateLimitTracker.getInfo()
      setRateLimitInfo(info)
      setTimeUntilReset(rateLimitTracker.getTimeUntilReset(info))
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
    const interval = setInterval(() => {
      const remaining = rateLimitTracker.getTimeUntilReset(rateLimitInfo)
      setTimeUntilReset(remaining)
      
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
  const total = 40
  const percentage = (remaining / total) * 100

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const getStatusColor = () => {
    if (percentage > 50) return 'text-accent'
    if (percentage > 20) return 'text-warning'
    return 'text-destructive'
  }

  const getStatusIcon = () => {
    if (percentage > 50) return <CheckCircle className={getStatusColor()} weight="fill" />
    if (percentage > 20) return <Warning className={getStatusColor()} weight="fill" />
    return <XCircle className={getStatusColor()} weight="fill" />
  }

  const handleReset = async () => {
    await rateLimitTracker.resetCounter()
    toast.success('Ratenlimit-Zähler zurückgesetzt')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={percentage <= 20 ? 'destructive' : percentage <= 50 ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2 transition-colors"
        >
          {getStatusIcon()}
          <span className="font-medium">{remaining}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1">API-Anfragen</h4>
            <p className="text-sm text-muted-foreground">
              Verbleibende Anfragen in diesem Zeitfenster
            </p>
          </div>
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

          {percentage <= 20 && (
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

          {percentage > 20 && percentage <= 50 && (
            <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
              <div className="flex gap-2">
                <Warning size={18} className="text-warning flex-shrink-0 mt-0.5" weight="fill" />
                <div className="space-y-1">
                  <p className="font-medium text-warning mb-1 text-sm">
                    Aufmerksamkeit erforderlich
                  </p>
                  <p className="text-muted-foreground">
                    Weniger als die Hälfte der Anfragen verfügbar. Nutze die API sparsam.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Hinweis: Das Limit wird konservativ bei 40 Anfragen/Stunde gesetzt, um 429-Fehler zu vermeiden. Zwischen Anfragen werden mindestens 8 Sekunden gewartet.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleReset}
            >
              <ArrowClockwise size={16} />
              Zähler zurücksetzen
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
