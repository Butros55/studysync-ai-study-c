import { useEffect, useRef, useState } from 'react'
import { useDevToolsState } from '@/hooks/use-debug-mode'
import { toast } from 'sonner'
import { BugReportDrawer } from './BugReportDrawer'

export function BugReportListener() {
  const { lastError } = useDevToolsState()
  const [open, setOpen] = useState(false)
  const lastSeen = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (lastError && lastError.id !== lastSeen.current) {
      lastSeen.current = lastError.id
      toast.error('Fehler erkannt', {
        action: {
          label: 'Bug melden',
          onClick: () => setOpen(true),
        },
      })
    }
  }, [lastError])

  return <BugReportDrawer open={open} onOpenChange={setOpen} />
}
