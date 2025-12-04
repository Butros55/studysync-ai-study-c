import { Database, Info } from '@phosphor-icons/react'
import { Alert, AlertDescription } from './ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export function LocalStorageIndicator() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-help">
            <Database size={14} weight="duotone" className="text-primary" />
            <span className="hidden sm:inline">Daten lokal gespeichert</span>
            <span className="sm:hidden">Lokal gespeichert</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          <p className="text-sm">
            Alle deine Module, Skripte, Notizen und Aufgaben werden ausschließlich lokal in deinem Browser gespeichert. 
            Deine Daten verlassen niemals dein Gerät (außer für AI-Anfragen).
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function LocalStorageBanner() {
  return (
    <Alert className="bg-primary/5 border-primary/20">
      <Info size={16} className="text-primary" />
      <AlertDescription className="text-sm">
        <strong>Lokale Datenspeicherung:</strong> Alle deine Lerndaten (Module, Skripte, Notizen, Aufgaben, Karteikarten) 
        werden sicher in deinem Browser gespeichert. Sie bleiben vollständig privat und auf diesem Gerät.
      </AlertDescription>
    </Alert>
  )
}
