import { FilePdf, FileText, Image, File as FileIcon } from '@phosphor-icons/react'

/**
 * Get the appropriate icon component for a file type
 */
export function getFileIcon(fileType?: string) {
  if (fileType === 'pdf') return FilePdf
  if (fileType?.startsWith('image/')) return Image
  if (fileType === 'pptx') return FileIcon
  return FileText
}
