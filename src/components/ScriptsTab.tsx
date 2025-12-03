import { useState } from 'react'
import { Script } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileText, Sparkle, Trash, Plus } from '@phosphor-icons/react'
import { formatDate } from '@/lib/utils-app'
import { toast } from 'sonner'

interface ScriptsTabProps {
  scripts: Script[]
  onUploadScript: (content: string, name: string) => void
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onDeleteScript: (scriptId: string) => void
}

export function ScriptsTab({
  scripts,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onDeleteScript,
}: ScriptsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [scriptName, setScriptName] = useState('')
  const [scriptContent, setScriptContent] = useState('')

  const handleUpload = () => {
    if (scriptName.trim() && scriptContent.trim()) {
      onUploadScript(scriptContent.trim(), scriptName.trim())
      setScriptName('')
      setScriptContent('')
      setUploadDialogOpen(false)
      toast.success('Script uploaded successfully')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Course Scripts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload lecture notes and course materials
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus size={18} className="mr-2" />
          Upload Script
        </Button>
      </div>

      {scripts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <FileText size={32} className="text-muted-foreground" weight="duotone" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No scripts yet</h3>
          <p className="text-muted-foreground mb-6 text-sm">
            Upload your first lecture notes to get started with AI-powered study materials
          </p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus size={18} className="mr-2" />
            Upload Script
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scripts.map((script) => (
            <Card key={script.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileText size={20} weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">{script.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Uploaded {formatDate(script.uploadedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateNotes(script.id)}
                      >
                        <Sparkle size={16} className="mr-2" />
                        Generate Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateTasks(script.id)}
                      >
                        <Sparkle size={16} className="mr-2" />
                        Generate Tasks
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm('Delete this script?')) {
                      onDeleteScript(script.id)
                      toast.success('Script deleted')
                    }
                  }}
                >
                  <Trash size={18} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Script</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Script Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Chapter 3 - Matrix Operations"
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder="Paste your lecture notes or course content here..."
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!scriptName.trim() || !scriptContent.trim()}>
              Upload Script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
