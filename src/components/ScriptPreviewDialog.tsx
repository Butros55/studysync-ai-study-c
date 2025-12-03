import { Script } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, FilePdf, X } from '@phosphor-icons/react'
import { formatDate } from '@/lib/utils-app'

interface ScriptPreviewDialogProps {
  script: Script | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScriptPreviewDialog({
  script,
  open,
  onOpenChange,
}: ScriptPreviewDialogProps) {
  if (!script) return null

  const contentLines = script.content.split('\n')
  const wordCount = script.content.split(/\s+/).filter(Boolean).length
  const charCount = script.content.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                {script.fileType === 'pdf' ? (
                  <FilePdf size={20} weight="duotone" />
                ) : (
                  <FileText size={20} weight="duotone" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl mb-2">{script.name}</DialogTitle>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="secondary" className="text-xs uppercase">
                    {script.fileType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Uploaded {formatDate(script.uploadedAt)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="flex-shrink-0"
            >
              <X size={18} />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4 border-y">
          <div className="text-center">
            <div className="text-2xl font-semibold text-primary">{wordCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Words</div>
          </div>
          <div className="text-center border-x">
            <div className="text-2xl font-semibold text-primary">{contentLines.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Lines</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-primary">{charCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Characters</div>
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pr-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Content Preview</h3>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap break-words">
                {script.content}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
