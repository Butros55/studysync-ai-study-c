import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Badge } from './ui/badge'
import { CloudArrowDown, DownloadSimple, ArrowsClockwise, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { fetchSharedBackupFromServer, filterBackupByModules, importSharedBackup } from '@/lib/shared-backup'
import type { StudySyncExportData } from '@/lib/storage'
import type { Module } from '@/lib/types'
import { toast } from 'sonner'

interface ServerBackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

export function ServerBackupDialog({ open, onOpenChange, onImported }: ServerBackupDialogProps) {
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backup, setBackup] = useState<StudySyncExportData | null>(null)
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])

  const modules = useMemo<Module[]>(() => {
    return (backup?.data.modules as Module[] | undefined) || []
  }, [backup])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchSharedBackupFromServer()
        setBackup(data)
        const availableModules = (data.data.modules as Module[] | undefined) || []
        setSelectedModuleIds(availableModules.map((m) => m.id))
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Server-Backup konnte nicht geladen werden'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  const toggleModule = (moduleId: string) => {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    )
  }

  const toggleAll = () => {
    if (selectedModuleIds.length === modules.length) {
      setSelectedModuleIds([])
    } else {
      setSelectedModuleIds(modules.map((m) => m.id))
    }
  }

  const handleImport = async () => {
    if (!backup) return
    if (selectedModuleIds.length === 0) {
      setError('Bitte mindestens ein Modul auswählen.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const filtered = filterBackupByModules(backup, selectedModuleIds)
      await importSharedBackup(filtered)
      toast.success('Server-Daten importiert. Seite wird neu geladen.')
      onOpenChange(false)
      onImported?.()
      window.location.reload()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import fehlgeschlagen'
      setError(message)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudArrowDown size={22} />
            Module aus dem Server-Backup laden
          </DialogTitle>
          <DialogDescription>
            Wähle die Module aus dem gespeicherten Server-Backup aus, die du in deinen lokalen
            Speicher übernehmen möchtest. Bestehende Fortschritte bleiben erhalten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowsClockwise className="h-4 w-4 animate-spin" />
              Server-Backup wird geladen...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive p-3 text-sm">
              <WarningCircle size={18} className="mt-0.5" />
              <div>
                <div className="font-semibold">Konnte nicht laden</div>
                <div>{error}</div>
              </div>
            </div>
          ) : modules.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Im Server-Backup wurden keine Module gefunden.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedModuleIds.length === modules.length}
                    onCheckedChange={toggleAll}
                    id="select-all-server-backup"
                  />
                  <label
                    htmlFor="select-all-server-backup"
                    className="cursor-pointer select-none text-sm font-medium"
                  >
                    Alle auswählen
                  </label>
                </div>
                <Badge variant="secondary">{selectedModuleIds.length} ausgewählt</Badge>
              </div>

              <ScrollArea className="max-h-64 rounded-md border">
                <div className="divide-y">
                  {modules.map((module) => (
                    <label
                      key={module.id}
                      className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedModuleIds.includes(module.id)}
                        onCheckedChange={() => toggleModule(module.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{module.name}</span>
                          {module.code && (
                            <Badge variant="outline" className="text-xs">
                              {module.code}
                            </Badge>
                          )}
                        </div>
                        {module.examDate && (
                          <p className="text-xs text-muted-foreground">
                            Prüfung: {new Date(module.examDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 text-green-600" weight="fill" />
                <div>
                  Der Import fügt Module hinzu und überschreibt keine vorhandenen Fortschritte in
                  deinen bestehenden Modulen.
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
              Abbrechen
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || importing || modules.length === 0}
              className="gap-2"
            >
              {importing ? (
                <>
                  <ArrowsClockwise className="h-4 w-4 animate-spin" />
                  Import läuft...
                </>
              ) : (
                <>
                  <DownloadSimple size={16} />
                  Ausgewählte Module importieren
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
