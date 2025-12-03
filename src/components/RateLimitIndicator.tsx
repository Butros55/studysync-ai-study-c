import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Progress } from './ui/progress'
import { Warning, Clock, CheckCircle, XCircle, ArrowClockwise } from '@phosphor-icons/react'
export function RateLimitIndicat
import { toast } from 'sonner'

    loadInfo()
    const unsubscribe = rateLimitTracker.subscribe((info) => {
    })


    if (!rateLimitInfo) return
    const interval = setInterval(() => {
      setTimeUntilReset(rema
     
      }

  }, [rateLimitInfo])
  if (!rateLimitInfo) return
  cons

  const formatTime = (
    cons

  const getStatusCo
    if (percentage > 20) retur

  const getStatusIcon = () => {
    if (percentage > 20) return <Warning className={getStatusColor()} wei
  }

    toast.success('Ratenlimi

    <Po
        <But

            "gap-2 transition-colors",
            percentag

          <span className="font-m

      </PopoverTrigger>
        <div class
            <h4 className="font-semibold mb-1"

          </div>
          <div className="space-y-2">
              <span className="text-muted-foregroun
                {remaining} / {total}
   

            />

            <div className="flex items-center 
              <span>Reset in<
   


            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3"
                <Warning size={18} className="text-destructive flex-shrink-0 mt-0.5" w
                  <p className="font-medium text-destructive mb-1
   

                </div>
            </div>

   

          
             
                    Weniger al
                
            </div>

            <p className
            </p>
              variant="outline"
              className="w-full gap-2"
            
         
          </div>
      </PopoverContent>
  )










































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
