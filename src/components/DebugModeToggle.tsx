import { useState } from 'react'
import { useDebugMode } from '@/hooks/use-debug-mode'
import { Button } from './ui/button'
import { DebugConsole } from './DebugConsole'
import { Bug } from '@phosphor-icons/react'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover'

export function DebugModeToggle() {
  const { enabled, setEnabled } = useDebugMode()
  const [showConsole, setShowConsole] = useState(false)

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            className="relative"
          >
            <Bug size={18} className="mr-2" />
            Debug
            {enabled && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">Debug Modus</h4>
              <p className="text-sm text-muted-foreground">
                Zeichnet alle API-Anfragen und -Antworten auf
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="debug-mode" className="cursor-pointer">
                Debug Modus {enabled ? 'aktiviert' : 'deaktiviert'}
              </Label>
              <Switch
                id="debug-mode"
                checked={enabled || false}
                onCheckedChange={(checked) => setEnabled(checked)}
              />
            </div>

            {enabled && (
              <Button
                onClick={() => setShowConsole(true)}
                variant="secondary"
                className="w-full"
              >
                <Bug size={18} className="mr-2" />
                Debug Konsole öffnen
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {showConsole && <DebugConsole onClose={() => setShowConsole(false)} />}
    </>
  )
}
