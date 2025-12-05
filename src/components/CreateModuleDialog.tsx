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
import { Calendar } from '@phosphor-icons/react'

interface CreateModuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateModule: (name: string, code: string, examDate?: string) => void
}

export function CreateModuleDialog({
  open,
  onOpenChange,
  onCreateModule,
}: CreateModuleDialogProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [examDate, setExamDate] = useState('')

  const handleSubmit = () => {
    if (name.trim() && code.trim()) {
      onCreateModule(name.trim(), code.trim(), examDate || undefined)
      setName('')
      setCode('')
      setExamDate('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Modul erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Modulname</Label>
            <Input
              id="module-name"
              placeholder="z.B. Lineare Algebra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-code">Modulkürzel</Label>
            <Input
              id="module-code"
              placeholder="z.B. MATH101"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam-date" className="flex items-center gap-2">
              <Calendar size={16} className="text-muted-foreground" />
              Prüfungstermin (optional)
            </Label>
            <Input
              id="exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              Der Prüfungstermin wird für personalisierte Lernempfehlungen verwendet.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !code.trim()}>
            Modul erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
