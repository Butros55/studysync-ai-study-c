import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { buildBugReport, buildGithubUrl, buildMailtoUrl } from '@/lib/bug-report'
import { devToolsStore } from '@/lib/devtools-store'
import { toast } from 'sonner'
import { Bug, ClipboardText, EnvelopeSimple, GithubLogo, X } from '@phosphor-icons/react'

type BugReportDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  focusLogId?: string
}

export function BugReportDrawer({ open, onOpenChange, focusLogId }: BugReportDrawerProps) {
  const [includeLogs, setIncludeLogs] = useState(true)
  const [includeStorageInfo, setIncludeStorageInfo] = useState(true)
  const [includePromptContent, setIncludePromptContent] = useState(false)
  const [includeScreenshot, setIncludeScreenshot] = useState(false)
  const [comment, setComment] = useState('')
  const [steps, setSteps] = useState('')
  const [busy, setBusy] = useState(false)

  const statePreview = useMemo(() => {
    const state = devToolsStore.getState()
    return {
      logs: state.logs.length,
      lastError: state.lastError?.message,
      meta: state.meta?.baseUrl,
    }
  }, [open])

  const buildAndCopy = async () => {
    setBusy(true)
    try {
      const result = await buildBugReport({
        includeLogs,
        includeStorageInfo,
        includePromptContent,
        includeScreenshot,
        focusLogId,
        userComment: comment,
        reproductionSteps: steps,
      })
      await navigator.clipboard.writeText(result.markdown)
      toast.success('Bug Report kopiert – jetzt in GitHub/Email einfügen')
      return result
    } catch (e) {
      console.error('Bug report failed', e)
      toast.error('Bug Report konnte nicht erstellt werden')
      return null
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    await buildAndCopy()
  }

  const handleGithub = async () => {
    const result = await buildAndCopy()
    if (!result) return
    const url = buildGithubUrl(
      result.shortTitle,
      'Bug Report wurde in die Zwischenablage kopiert. Bitte hier einfügen:'
    )
    window.open(url, '_blank')
    onOpenChange(false)
  }

  const handleEmail = async () => {
    const result = await buildAndCopy()
    if (!result) return
    const url = buildMailtoUrl(
      result.shortTitle,
      'Bug Report wurde in die Zwischenablage kopiert. Bitte einfügen.'
    )
    window.location.href = url
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug size={18} />
            Bug melden
          </DialogTitle>
          <DialogDescription>
            Beschreibe kurz, was passiert ist. Sensible Inhalte (Prompts/Antworten) werden nur mit Opt-In hinzugefügt und gekürzt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="comment">Was ist passiert?</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Kurze Beschreibung"
              className="min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="steps">Schritte zur Reproduktion</Label>
            <Textarea
              id="steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="1) ... 2) ..."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={includeLogs} onCheckedChange={(v) => setIncludeLogs(!!v)} />
              Logs anhängen (max 20)
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={includeStorageInfo} onCheckedChange={(v) => setIncludeStorageInfo(!!v)} />
              Storage-Info anhängen
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={includePromptContent} onCheckedChange={(v) => setIncludePromptContent(!!v)} />
              Prompt/Antwort (gekürzt) anhängen
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={includeScreenshot} onCheckedChange={(v) => setIncludeScreenshot(!!v)} />
              Screenshot (optional, aktuell nicht angehängt)
            </label>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div>Logs verfügbar: {statePreview.logs}</div>
            {statePreview.lastError && <div>Letzter Fehler: {statePreview.lastError}</div>}
            <div>Backend: {statePreview.meta || 'n/a'}</div>
            <div>Sensible Inhalte werden nur mit Checkbox aufgenommen.</div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X size={16} className="mr-2" />
              Abbrechen
            </Button>
            <Button variant="secondary" onClick={handleCopy} disabled={busy}>
              <ClipboardText size={16} className="mr-2" />
              In Zwischenablage kopieren
            </Button>
            <Button variant="outline" onClick={handleGithub} disabled={busy}>
              <GithubLogo size={16} className="mr-2" />
              GitHub Issue öffnen
            </Button>
            <Button onClick={handleEmail} disabled={busy}>
              <EnvelopeSimple size={16} className="mr-2" />
              E-Mail öffnen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
