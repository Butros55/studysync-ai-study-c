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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, FilePdf, X } from '@phosphor-icons/react'
import { formatDate } from '@/lib/utils-app'
import { PDFViewer } from './PDFViewer'
import { PPTXViewer } from './PPTXViewer'

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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
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

        <Tabs defaultValue="document" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="document">Document View</TabsTrigger>
            <TabsTrigger value="text">Text Content</TabsTrigger>
          </TabsList>

          <TabsContent value="document" className="flex-1 mt-4 overflow-hidden">
            <ScrollArea className="h-[calc(90vh-300px)]">
              <div className="pr-4">
                {script.fileData ? (
                  script.fileType === 'pdf' ? (
                    <PDFViewer fileData={script.fileData} />
                  ) : script.fileType === 'pptx' ? (
                    <PPTXViewer fileData={script.fileData} content={script.content} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Document preview not available</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Original file not stored. Only text content is available.</p>
                    <p className="text-xs text-muted-foreground mt-2">Re-upload the file to enable document preview.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="text" className="flex-1 mt-4 overflow-hidden">
            <ScrollArea className="h-[calc(90vh-300px)]">
              <div className="pr-4">
                <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap break-words">
                  {script.content}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
