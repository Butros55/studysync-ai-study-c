/**
 * Input Mode Settings Dialog
 * 
 * Allows users to change their preferred input mode (keyboard vs drawing)
 * at any time after the initial onboarding.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Keyboard,
  PencilLine,
  CheckCircle,
  Gear,
} from '@phosphor-icons/react'
import { usePreferredInputMode } from '@/hooks/use-preferred-input-mode'
import type { InputMode } from '@/lib/analysis-types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface InputModeSettingsProps {
  /** Optional trigger element. If not provided, a default button is rendered */
  trigger?: React.ReactNode
  /** Callback when mode is changed */
  onModeChanged?: (mode: InputMode) => void
}

export function InputModeSettings({ trigger, onModeChanged }: InputModeSettingsProps) {
  const [open, setOpen] = useState(false)
  const { mode, setMode, isLoading } = usePreferredInputMode()
  const [selectedMode, setSelectedMode] = useState<InputMode | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  // Sync selected mode with current mode when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedMode(mode)
    }
    setOpen(newOpen)
  }

  const handleSave = async () => {
    if (!selectedMode) return
    
    setIsSaving(true)
    try {
      await setMode(selectedMode)
      toast.success(
        selectedMode === 'type' 
          ? 'Eingabemethode auf Tastatur geändert' 
          : 'Eingabemethode auf Stift geändert'
      )
      onModeChanged?.(selectedMode)
      setOpen(false)
    } catch (error) {
      console.error('[InputModeSettings] Failed to save:', error)
      toast.error('Fehler beim Speichern der Einstellung')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanged = selectedMode !== mode

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-2">
            <Gear size={18} />
            Eingabemethode
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eingabemethode wählen</DialogTitle>
          <DialogDescription>
            Wie möchtest du Aufgaben lösen? Diese Einstellung kannst du jederzeit ändern.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Lade Einstellungen...
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Keyboard Option */}
            <button
              type="button"
              onClick={() => setSelectedMode('type')}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                selectedMode === 'type'
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                selectedMode === 'type' ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Keyboard size={24} weight="duotone" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium">⌨️ Tastatur (Tippen)</div>
                <div className="text-sm text-muted-foreground">
                  Antworten per Tastatur eingeben. Gut für Text und Code.
                </div>
              </div>
              {selectedMode === 'type' && (
                <CheckCircle size={24} weight="fill" className="text-primary shrink-0" />
              )}
            </button>

            {/* Drawing Option */}
            <button
              type="button"
              onClick={() => setSelectedMode('draw')}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                selectedMode === 'draw'
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                selectedMode === 'draw' ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <PencilLine size={24} weight="duotone" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium">✍️ Stift (Zeichnen)</div>
                <div className="text-sm text-muted-foreground">
                  Handschriftlich auf dem Canvas. Ideal für Formeln und Skizzen.
                </div>
              </div>
              {selectedMode === 'draw' && (
                <CheckCircle size={24} weight="fill" className="text-primary shrink-0" />
              )}
            </button>

            {/* Current mode indicator */}
            {mode && (
              <p className="text-xs text-center text-muted-foreground">
                Aktuell: {mode === 'type' ? 'Tastatur' : 'Stift'}
                {hasChanged && ' → wird geändert'}
              </p>
            )}

            {/* Save Button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSave}
                disabled={!selectedMode || !hasChanged || isSaving}
              >
                {isSaving ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Compact button to open the input mode settings.
 * Shows the current mode icon.
 */
export function InputModeSettingsButton({ className }: { className?: string }) {
  const { mode, isLoading } = usePreferredInputMode()

  if (isLoading) {
    return null
  }

  const icon = mode === 'draw' ? (
    <PencilLine size={18} weight="duotone" />
  ) : (
    <Keyboard size={18} weight="duotone" />
  )

  const label = mode === 'draw' ? 'Stift' : mode === 'type' ? 'Tastatur' : 'Eingabe'

  return (
    <InputModeSettings
      trigger={
        <Button variant="ghost" size="sm" className={cn("gap-2", className)}>
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      }
    />
  )
}
