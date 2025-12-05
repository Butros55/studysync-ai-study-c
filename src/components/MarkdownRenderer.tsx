import { useMemo } from 'react'
import { marked } from 'marked'

interface MarkdownRendererProps {
  content: string
  className?: string
  compact?: boolean
}

// Configure marked for clean output
marked.setOptions({
  breaks: true,
  gfm: true,
})

export function MarkdownRenderer({ content, className = '', compact = false }: MarkdownRendererProps) {
  const htmlContent = useMemo(() => {
    // Pre-process content for better formatting
    let processed = content
    
    // Convert numbered lists that might be inline
    processed = processed.replace(/(\d+)\.\s+/g, '\n$1. ')
    
    // Convert letter lists (a), b), etc.)
    processed = processed.replace(/([a-z])\)\s+/gi, '\n- **$1)** ')
    
    // Clean up multiple newlines
    processed = processed.replace(/\n{3,}/g, '\n\n')
    
    // Parse markdown
    const html = marked.parse(processed, { async: false }) as string
    
    return html
  }, [content])

  const baseStyles = compact 
    ? 'prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2'
    : 'prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:my-3'

  return (
    <div 
      className={`${baseStyles} prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-md ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}
