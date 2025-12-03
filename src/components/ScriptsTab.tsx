import { useState, useRef } from 'react'
import { Script } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  onGenerateAllNotes: () => void
  onGenerateAllTasks: () => void
}

export function ScriptsTab({
  scripts,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onDeleteScript,
  onGenerateAllNotes,
  onGenerateAllTasks,
}: ScriptsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [previewScript, setPreviewScript] = useState<Script | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      toast.error(`Ungültige Dateien übersprungen: ${invalidFiles.join(', ')}`)
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
      toast.error(`Ungültige Dateien übersprungen: ${invalidFiles.join(', ')}`)
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
          toast.error(`Fehler beim Hochladen von "${file.name}"`)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Kursskripte</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Lade Vorlesungsnotizen und Kursmaterialien hoch
          </p>
        </div>
        <div className="flex gap-2">
          {scripts.length > 0 && (
            <>
              <Button variant="outline" onClick={onGenerateAllNotes}>
                <Sparkle size={18} className="mr-2" />
                Alle Notizen erstellen
              </Button>
              <Button variant="outline" onClick={onGenerateAllTasks}>
                <Sparkle size={18} className="mr-2" />
                Alle Aufgaben erstellen
              </Button>
            </>
          )}
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus size={18} className="mr-2" />
            Skript hochladen
          </Button>
        </div>
      </div>

      {scripts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <FileText size={32} className="text-muted-foreground" weight="duotone" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Noch keine Skripte</h3>
          <p className="text-muted-foreground mb-6 text-sm">
            Lade deine ersten Vorlesungsnotizen hoch, um mit KI-gestütztem Lernmaterial zu starten
          </p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus size={18} className="mr-2" />
            Skript hochladen
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scripts.map((script) => (
            <Card key={script.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {script.fileType === 'pdf' ? (
                      <FilePdf size={20} weight="duotone" />
                    ) : (
                      <FileText size={20} weight="duotone" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{script.name}</h3>
                      <Badge variant="secondary" className="text-xs uppercase">
                        {script.fileType}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Hochgeladen {formatDate(script.uploadedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPreviewScript(script)
                          setPreviewOpen(true)
                        }}
                      >
                        <Eye size={16} className="mr-2" />
                        Vorschau
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateNotes(script.id)}
                      >
                        <Sparkle size={16} className="mr-2" />
                        Notizen erstellen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateTasks(script.id)}
                      >
                        <Sparkle size={16} className="mr-2" />
                        Aufgaben erstellen
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm('Dieses Skript löschen?')) {
                      onDeleteScript(script.id)
                      toast.success('Skript gelöscht')
                    }
                  }}
                >
                  <Trash size={18} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Skript hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Datei(en) auswählen</label>
              <p className="text-xs text-muted-foreground mb-3">
                Lade eine oder mehrere PDF- oder PPTX-Dateien mit deinen Kursmaterialien hoch
              </p>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted/50 border-border'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.pptx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  multiple
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <UploadSimple size={24} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {isDragging ? 'Dateien hier ablegen' : 'Klicken oder Dateien hierher ziehen'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF- oder PPTX-Dateien (mehrere möglich)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Ausgewählte Dateien ({selectedFiles.length})
                </label>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="p-3 flex items-center justify-between hover:bg-muted/50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getFileExtension(file.name) === 'pdf' ? (
                            <FilePdf size={16} weight="duotone" className="text-primary" />
                          ) : (
                            <FileText size={16} weight="duotone" className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)} disabled={isUploading}>
              Abbrechen
            </Button>
            <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || isUploading}>
              {isUploading ? `Wird hochgeladen (${selectedFiles.length})...` : `${selectedFiles.length} ${selectedFiles.length === 1 ? 'Skript' : 'Skripte'} hochladen`}
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
