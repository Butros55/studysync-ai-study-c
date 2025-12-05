import { useMemo } from 'react'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  compact?: boolean
  /** Begrenzt die Anzahl der sichtbaren Zeilen (für Kartenansichten) */
  truncateLines?: number
  /** Inline-Modus: Keine Block-Elemente, nur Inline-Formatting */
  inline?: boolean
}

// Configure marked for clean output
marked.setOptions({
  breaks: true,
  gfm: true,
})

export function MarkdownRenderer({ 
  content, 
  className = '', 
  compact = false,
  truncateLines,
  inline = false,
}: MarkdownRendererProps) {
  const htmlContent = useMemo(() => {
    if (!content) return ''
    
    // Pre-process content for better formatting
    let processed = content
    
    // Convert numbered lists that might be inline
    processed = processed.replace(/(\d+)\.\s+/g, '\n$1. ')
    
    // Convert letter lists (a), b), etc.)
    processed = processed.replace(/([a-z])\)\s+/gi, '\n- **$1)** ')
    
    // Clean up multiple newlines
    processed = processed.replace(/\n{3,}/g, '\n\n')
    
    // Parse markdown
    if (inline) {
      // Für Inline-Modus: parseInline verhindert <p> Tags
      return marked.parseInline(processed, { async: false }) as string
    }
    
    const html = marked.parse(processed, { async: false }) as string
    
    return html
  }, [content, inline])

  const baseStyles = compact 
    ? 'prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-h3:text-sm prose-h3:font-semibold'
    : 'prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:my-3'

  // Truncate-Styles für Kartenansichten
  const truncateStyles = truncateLines 
    ? `line-clamp-${truncateLines} overflow-hidden` 
    : ''

  return (
    <div 
      className={cn(
        baseStyles,
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-md',
        truncateStyles,
        className
      )}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}

/**
 * MarkdownText - Alias für MarkdownRenderer mit erweitertem Interface
 * Für konsistente Verwendung in der gesamten App
 */
export const MarkdownText = MarkdownRenderer
