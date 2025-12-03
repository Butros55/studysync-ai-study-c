import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateModuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateModule: (name: string, code: string) => void
}

export function CreateModuleDialog({
  open,
  onOpenChange,
  onCreateModule,
}: CreateModuleDialogProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const handleSubmit = () => {
    if (name.trim() && code.trim()) {
      onCreateModule(name.trim(), code.trim())
      setName('')
      setCode('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Module</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Module Name</Label>
            <Input
              id="module-name"
              placeholder="e.g., Linear Algebra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-code">Module Code</Label>
            <Input
              id="module-code"
              placeholder="e.g., MATH101"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !code.trim()}>
            Create Module
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
