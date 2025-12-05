/**
 * TaskAttachments - Zeigt Anhänge einer Aufgabe an
 * (Wahrheitstabellen, Bilder, etc.)
 */

import { TaskAttachment } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Table, Image, FileText } from '@phosphor-icons/react'

interface TaskAttachmentsProps {
  attachments: TaskAttachment[]
  compact?: boolean
}

export function TaskAttachments({ attachments, compact = false }: TaskAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  const getIcon = (type: TaskAttachment['type']) => {
    switch (type) {
      case 'table':
        return <Table size={14} />
      case 'image':
        return <Image size={14} />
      default:
        return <FileText size={14} />
    }
  }

  const getTypeLabel = (type: TaskAttachment['type']) => {
    switch (type) {
      case 'table':
        return 'Tabelle'
      case 'image':
        return 'Bild'
      default:
        return 'Text'
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
          Gegebene Informationen
        </span>
        <div className="flex gap-1">
          {attachments.map((att) => (
            <Badge 
              key={att.id} 
              variant="secondary" 
              className={compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'}
            >
              {getIcon(att.type)}
              <span className="ml-1">{att.label || getTypeLabel(att.type)}</span>
            </Badge>
          ))}
        </div>
      </div>

      {attachments.map((attachment) => (
        <Card 
          key={attachment.id} 
          className={`overflow-hidden ${compact ? 'p-2' : 'p-3'}`}
        >
          {attachment.label && (
            <div className={`font-medium mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>
              {attachment.label}
            </div>
          )}

          {/* Tabelle als Markdown rendern */}
          {attachment.type === 'table' && attachment.markdown && (
            <div className="overflow-x-auto">
              <MarkdownRenderer 
                content={attachment.markdown} 
                compact={compact}
                className="prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1"
              />
            </div>
          )}

          {/* Bild responsiv anzeigen */}
          {attachment.type === 'image' && attachment.url && (
            <div className="flex justify-center">
              <img
                src={attachment.url}
                alt={attachment.label || 'Aufgaben-Anhang'}
                className="max-w-full max-h-64 object-contain rounded"
              />
            </div>
          )}

          {/* Text als Markdown rendern */}
          {attachment.type === 'text' && attachment.markdown && (
            <MarkdownRenderer 
              content={attachment.markdown} 
              compact={compact}
            />
          )}
        </Card>
      ))}
    </div>
  )
}

/**
 * AttachmentBadges - Kleine Badges für die Aufgabenliste
 */
interface AttachmentBadgesProps {
  attachments?: TaskAttachment[]
}

export function AttachmentBadges({ attachments }: AttachmentBadgesProps) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attachments.map((att) => (
        <Badge 
          key={att.id} 
          variant="outline" 
          className="text-[10px] px-1.5 py-0 bg-muted/50"
        >
          {att.type === 'table' && <Table size={10} className="mr-0.5" />}
          {att.type === 'image' && <Image size={10} className="mr-0.5" />}
          {att.label || (att.type === 'table' ? 'Tabelle' : att.type === 'image' ? 'Bild' : 'Anhang')}
        </Badge>
      ))}
    </div>
  )
}
