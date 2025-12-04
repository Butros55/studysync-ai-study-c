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

  const handleBulkDelete = async () => {