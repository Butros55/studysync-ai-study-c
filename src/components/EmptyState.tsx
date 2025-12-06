import { Card } from '@/components/ui/card'
import { Plus, Folder, UploadSimple } from '@phosphor-icons/react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  icon?: 'folder' | 'plus'
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'folder',
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const Icon = icon === 'folder' ? Folder : Plus

  return (
    <Card className="p-12 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
        <Icon size={32} className="text-muted-foreground" weight="duotone" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
        {description}
      </p>
      <div className="flex flex-col gap-3 items-center">
        <button
          onClick={onAction}
          className="text-primary hover:underline font-medium text-sm"
        >
          {actionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <UploadSimple size={16} />
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </Card>
  )
}
