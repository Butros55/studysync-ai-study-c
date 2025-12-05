/**
 * EditModuleDialog - Dialog zum Bearbeiten und Löschen von Modulen
 * 
 * Features:
 * - Modulname und Kürzel bearbeiten
 * - Prüfungstermin setzen
 * - Zusätzliche Termine hinzufügen (Abgaben, Präsentationen, etc.)
 * - Farbe ändern
 * - Modul löschen mit Loading-Indikator
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Module, CustomDeadline } from '@/lib/types'
import { Calendar, Trash, Palette, Plus, X, SpinnerGap } from '@phosphor-icons/react'
import { generateId } from '@/lib/utils-app'

interface EditModuleDialogProps {
  module: Module | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateModule: (moduleId: string, updates: Partial<Module>) => Promise<void>
  onDeleteModule: (moduleId: string) => Promise<void>
  contentCount?: {
    scripts: number
    notes: number
    tasks: number
    flashcards: number
  }
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
]

export function EditModuleDialog({
  module,
  open,
  onOpenChange,
  onUpdateModule,
  onDeleteModule,
  contentCount,
}: EditModuleDialogProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [examDate, setExamDate] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [customDeadlines, setCustomDeadlines] = useState<CustomDeadline[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Formular mit Moduldaten füllen
  useEffect(() => {
    if (module) {
      setName(module.name)
      setCode(module.code)
      setExamDate(module.examDate || '')
      setColor(module.color)
      setCustomDeadlines(module.customDeadlines || [])
    }
  }, [module])

  // Reset beim Schließen
  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false)
      setIsDeleting(false)
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!module || !name.trim() || !code.trim()) return
    
    setIsSaving(true)
    try {
      await onUpdateModule(module.id, {
        name: name.trim(),
        code: code.trim(),
        examDate: examDate || undefined,
        color,
        customDeadlines: customDeadlines.length > 0 ? customDeadlines : undefined,
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!module) return
    
    setIsDeleting(true)
    try {
      await onDeleteModule(module.id)
      setShowDeleteConfirm(false)
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  // Neuen zusätzlichen Termin hinzufügen
  const handleAddDeadline = () => {
    setCustomDeadlines(prev => [
      ...prev,
      {
        id: generateId(),
        label: '',
        date: '',
      }
    ])
  }

  // Termin aktualisieren
  const handleUpdateDeadline = (id: string, field: 'label' | 'date', value: string) => {
    setCustomDeadlines(prev => 
      prev.map(d => d.id === id ? { ...d, [field]: value } : d)
    )
  }

  // Termin entfernen
  const handleRemoveDeadline = (id: string) => {
    setCustomDeadlines(prev => prev.filter(d => d.id !== id))
  }

  const totalContent = contentCount 
    ? contentCount.scripts + contentCount.notes + contentCount.tasks + contentCount.flashcards
    : 0

  if (!module) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modul bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Eigenschaften deines Moduls oder lösche es komplett.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Modulname */}
            <div className="space-y-2">
              <Label htmlFor="edit-module-name">Modulname</Label>
              <Input
                id="edit-module-name"
                placeholder="z.B. Lineare Algebra"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            {/* Modulkürzel */}
            <div className="space-y-2">
              <Label htmlFor="edit-module-code">Modulkürzel</Label>
              <Input
                id="edit-module-code"
                placeholder="z.B. MATH101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            
            {/* Prüfungstermin */}
            <div className="space-y-2">
              <Label htmlFor="edit-exam-date" className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground" />
                Prüfungstermin
              </Label>
              <Input
                id="edit-exam-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              {examDate && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-muted-foreground"
                  onClick={() => setExamDate('')}
                >
                  Termin entfernen
                </Button>
              )}
            </div>

            {/* Zusätzliche Termine */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  Weitere Termine
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddDeadline}
                  className="h-7 text-xs"
                >
                  <Plus size={14} className="mr-1" />
                  Termin
                </Button>
              </div>
              
              {customDeadlines.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Füge weitere Termine wie Abgaben oder Präsentationen hinzu.
                </p>
              ) : (
                <div className="space-y-2">
                  {customDeadlines.map((deadline) => (
                    <div key={deadline.id} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="z.B. Hausarbeit Abgabe"
                          value={deadline.label}
                          onChange={(e) => handleUpdateDeadline(deadline.id, 'label', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          type="date"
                          value={deadline.date}
                          onChange={(e) => handleUpdateDeadline(deadline.id, 'date', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveDeadline(deadline.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Farbauswahl */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette size={16} className="text-muted-foreground" />
                Farbe
              </Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${
                      color === presetColor ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                    aria-label={`Farbe ${presetColor}`}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full sm:w-auto sm:mr-auto"
              disabled={isSaving}
            >
              <Trash size={16} className="mr-2" />
              Modul löschen
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!name.trim() || !code.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <SpinnerGap size={16} className="mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lösch-Bestätigung */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modul wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Das Modul "{module.name}" 
              wird dauerhaft gelöscht, zusammen mit:
              {contentCount && totalContent > 0 && (
                <ul className="mt-2 list-disc list-inside text-sm">
                  {contentCount.scripts > 0 && <li>{contentCount.scripts} Skript(e)</li>}
                  {contentCount.notes > 0 && <li>{contentCount.notes} Notiz(en)</li>}
                  {contentCount.tasks > 0 && <li>{contentCount.tasks} Aufgabe(n)</li>}
                  {contentCount.flashcards > 0 && <li>{contentCount.flashcards} Karteikarte(n)</li>}
                </ul>
              )}
              {totalContent === 0 && (
                <span className="block mt-2 text-sm">Das Modul enthält keine Inhalte.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <SpinnerGap size={16} className="mr-2 animate-spin" />
                  Löschen...
                </>
              ) : (
                'Ja, endgültig löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
