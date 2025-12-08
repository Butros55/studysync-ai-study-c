import { useState } from 'react'
import { useDebugMode } from '@/hooks/use-debug-mode'
import { Button } from './ui/button'
import { DebugConsole } from './DebugConsole'
import { Bug } from '@phosphor-icons/react'

export function DebugModeToggle() {
  const { devMode, debugLogging } = useDebugMode()
  const [open, setOpen] = useState(false)

  if (!devMode) return null

  return (
    <>
      <Button
        variant={open ? 'default' : 'outline'}
        size="sm"
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bug size={18} className="mr-2" />
        Dev Tools
        {debugLogging && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
        )}
      </Button>

      {open && <DebugConsole open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
