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
import { parseFile, isValidFileType, getFileExtension } from '@/lib/file-parser'
import { ScriptPreviewDialog } from './ScriptPreviewDialog'

interface ScriptsTabProps {
  scripts: Script[]
  onUploadScript: (content: string, name: string, fileType?: string) => void
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onDeleteScript: (scriptId: string) => void
}

export function ScriptsTab({
  scripts,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onDeleteScript,
}: ScriptsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewScript, setPreviewScript] = useState<Script | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!isValidFileType(file.name)) {
        toast.error('Please upload a PDF or PPTX file')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    const toastId = toast.loading('Parsing file...')

    try {
      const content = await parseFile(selectedFile)
      const name = selectedFile.name.replace(/\.[^/.]+$/, '')
      const fileType = getFileExtension(selectedFile.name)
      
      onUploadScript(content, name, fileType)
      
      setSelectedFile(null)
      setUploadDialogOpen(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      toast.dismiss(toastId)
      toast.success('Script uploaded successfully')
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('Failed to parse file. Please try again.')
      console.error('File parsing error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!isUploading) {
      setUploadDialogOpen(open)
      if (!open) {
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Course Scripts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload lecture notes and course materials
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus size={18} className="mr-2" />
          Upload Script
        </Button>
      </div>

      {scripts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <FileText size={32} className="text-muted-foreground" weight="duotone" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No scripts yet</h3>
          <p className="text-muted-foreground mb-6 text-sm">
            Upload your first lecture notes to get started with AI-powered study materials
          </p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus size={18} className="mr-2" />
            Upload Script
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
                      Uploaded {formatDate(script.uploadedAt)}
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
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateNotes(script.id)}
                      >
                        <Sparkle size={16} className="mr-2" />
                        Generate Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateTasks(script.id)}
                      >
                        <Sparkle size={16} className="mr-2" />
                        Generate Tasks
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm('Delete this script?')) {
                      onDeleteScript(script.id)
                      toast.success('Script deleted')
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
            <DialogTitle>Upload Script</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select File</label>
              <p className="text-xs text-muted-foreground mb-3">
                Upload PDF or PPTX files containing your course materials
              </p>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.pptx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  {selectedFile ? (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        {getFileExtension(selectedFile.name) === 'pdf' ? (
                          <FilePdf size={24} weight="duotone" className="text-primary" />
                        ) : (
                          <FileText size={24} weight="duotone" className="text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          setSelectedFile(null)
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                      >
                        Change File
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <UploadSimple size={24} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Click to upload</p>
                        <p className="text-sm text-muted-foreground">PDF or PPTX files</p>
                      </div>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Script'}
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
