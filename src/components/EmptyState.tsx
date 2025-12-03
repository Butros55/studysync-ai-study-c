import { Card } from '@/components/ui/card'
import { Plus, Folder } from '@phosphor-icons/react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  icon?: 'folder' | 'plus'
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'folder',
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
      <button
        onClick={onAction}
        className="text-primary hover:underline font-medium text-sm"
      >
        {actionLabel}
      </button>
    </Card>
  )
}
