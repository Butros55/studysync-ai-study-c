import { useState, useCallback } from 'react'
import { isValidFileType } from '@/lib/file-parser'
import { toast } from 'sonner'

interface UseFileUploadOptions {
  onFilesAdded?: (files: File[]) => void
}

/**
 * A reusable hook for managing file upload with drag-and-drop support
 */
export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
      options.onFilesAdded?.(validFiles)
    }
  }, [options])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
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
      options.onFilesAdded?.(validFiles)
    }
  }, [options])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearFiles = useCallback(() => {
    setSelectedFiles([])
  }, [])

  return {
    selectedFiles,
    isDragging,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeFile,
    clearFiles,
    setSelectedFiles,
  }
}
