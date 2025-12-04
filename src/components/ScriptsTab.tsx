import { useState, useRef, useEffect } from 'react'
import { Script } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileText, Sparkle, Trash, Plus, UploadSimple, FilePdf, Eye } from '@phosphor-icons/react'
import { formatDate } from '@/lib/utils-app'
import { toast } from 'sonner'
import { parseFile, isValidFileType, getFileExtension, fileToDataURL } from '@/lib/file-parser'
import { ScriptPreviewDialog } from './ScriptPreviewDialog'

interface ScriptsTabProps {
  scripts: Script[]
  onUploadScript: (content: string, name: string, fileType?: string, fileData?: string) => Promise<void>
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onDeleteScript: (scriptId: string) => void
  onBulkDeleteScripts: (ids: string[]) => void
  onGenerateAllNotes: () => void
  onGenerateAllTasks: () => void
}

export function ScriptsTab({
  scripts,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onDeleteScript,
  onBulkDeleteScripts,
  onGenerateAllNotes,
  onGenerateAllTasks,
}: ScriptsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [previewScript, setPreviewScript] = useState<Script | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedScripts((prev) => {
      const valid = new Set<string>()
      scripts.forEach((s) => {
        if (prev.has(s.id)) valid.add(s.id)
      })
      return valid
    })
  }, [scripts])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles: File[] = []
    const invalidFiles: string[] = []

    files.forEach((file) => {
      if (isValidFileType(file.name)) {
        validFiles.push(file)
      } else {
        invalidFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      toast.error(`Ungueltige Dateien uebersprungen: ${invalidFiles.join(', ')}`)
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const validFiles: File[] = []
    const invalidFiles: string[] = []

    files.forEach((file) => {
      if (isValidFileType(file.name)) {
        validFiles.push(file)
      } else {
        invalidFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      toast.error(`Ungueltige Dateien uebersprungen: ${invalidFiles.join(', ')}`)
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsUploading(true)

    try {
      for (const file of selectedFiles) {
        try {
          const content = await parseFile(file)
          const fileData = await fileToDataURL(file)
          const name = file.name.replace(/\.[^/.]+$/, '')
          const fileType = getFileExtension(file.name)
          
          await onUploadScript(content, name, fileType, fileData)
        } catch (error) {
          toast.error(`Fehler beim Hochladen von \"${file.name}\"`)
          console.error('File parsing error:', error)
        }
      }
      
      setSelectedFiles([])
      setUploadDialogOpen(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!isUploading) {
      setUploadDialogOpen(open)
      if (!open) {
        setSelectedFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }

  const toggleScriptSelection = (id: string) => {
    setSelectedScripts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedScripts((prev) => {
      const allSelected = prev.size === scripts.length && scripts.length > 0
      return allSelected ? new Set() : new Set(scripts.map((s) => s.id))
    })
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedScripts)
    if (ids.length === 0) return
    if (!confirm(`Sollen ${ids.length} Skripte geloescht werden?`)) return
    await onBulkDeleteScripts(ids)
    setSelectedScripts(new Set())
  }

  const handleDeleteSingle = async (id: string) => {
    if (!confirm('Dieses Skript geloescht werden?')) return
    await onDeleteScript(id)
    setSelectedScripts((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const hasSelection = selectedScripts.size > 0
  const allSelected = scripts.length > 0 && selectedScripts.size === scripts.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Skripte</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Kursmaterialien hochladen, ansehen und fuer KI-Generierung nutzen
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={scripts.length === 0}>
              {allSelected ? 'Auswahl aufheben' : 'Alle auswaehlen'}
            </Button>
            {hasSelection && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash size={14} className="mr-2" />
                {selectedScripts.size} loeschen
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onGenerateAllNotes} disabled={scripts.length === 0}>
            <Sparkle size={16} className="mr-2" />
            Alle Notizen generieren
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerateAllTasks} disabled={scripts.length === 0}>
            <Sparkle size={16} className="mr-2" />
            Alle Aufgaben generieren
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)} size="sm">
            <UploadSimple size={16} className="mr-2" />
            Skripte hochladen
          </Button>
        </div>
      </div>

      {scripts.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <FileText size={28} className="text-muted-foreground" weight="duotone" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Noch keine Skripte</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Lade deine PDF- oder Textdateien hoch, um Notizen und Aufgaben zu generieren.
          </p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus size={16} className="mr-2" />
            Skript hochladen
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scripts.map((script) => (
            <Card key={script.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <Checkbox
                  checked={selectedScripts.has(script.id)}
                  onCheckedChange={() => toggleScriptSelection(script.id)}
                  className="mt-1"
                />
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {script.fileType === 'pdf' ? <FilePdf size={20} /> : <FileText size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{script.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Hochgeladen am {formatDate(script.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        {script.fileType?.toUpperCase() || 'TXT'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {script.content.length.toLocaleString('de-DE')} Zeichen
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {script.content}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => onGenerateNotes(script.id)}>
                      <Sparkle size={16} className="mr-2" />
                      Notizen generieren
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onGenerateTasks(script.id)}>
                      <Sparkle size={16} className="mr-2" />
                      Aufgaben generieren
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setPreviewScript(script); setPreviewOpen(true) }}>
                      <Eye size={16} className="mr-2" />
                      Vorschau
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteSingle(script.id)}
                    >
                      <Trash size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Skripte hochladen</DialogTitle>
          </DialogHeader>

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <UploadSimple size={24} />
            </div>
            <p className="font-medium mb-1">Dateien hier ablegen oder klicken</p>
            <p className="text-sm text-muted-foreground mb-4">PDF oder Text (mehrere moeglich)</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              id="script-upload-input"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              Dateien auswaehlen
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium">Ausgewaehlte Dateien</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                      <Trash size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => handleDialogClose(false)} disabled={isUploading}>
              Abbrechen
            </Button>
            <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || isUploading}>
              {isUploading ? 'Laedt hoch...' : 'Hochladen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScriptPreviewDialog
        script={previewScript}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}
