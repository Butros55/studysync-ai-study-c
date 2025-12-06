import { useState, useEffect, useMemo } from 'react'
import { StudyNote, Script } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Note, Trash, Columns, Rows, CaretDown, CaretUp, Download, Copy, Check } from '@phosphor-icons/react'
import { formatDate } from '@/lib/utils-app'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { MarkdownRenderer } from './MarkdownRenderer'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useBulkSelection } from '@/hooks/use-bulk-selection'

interface NotesTabProps {
  notes: StudyNote[]
  scripts: Script[]
  onDeleteNote: (noteId: string) => void
  onBulkDeleteNotes: (noteIds: string[]) => void
}

export function NotesTab({ notes, scripts, onDeleteNote, onBulkDeleteNotes }: NotesTabProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [twoColumnLayout, setTwoColumnLayout] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const {
    selectedIds: selectedNotes,
    hasSelection,
    allSelected,
    toggleSelection: toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection({
    items: notes,
    getId: (note) => note.id,
  })

  // Automatisch erste Notiz expandieren
  useEffect(() => {
    if (notes.length > 0 && expandedNotes.size === 0) {
      setExpandedNotes(new Set([notes[0].id]))
    }
  }, [notes])

  const getScriptName = (scriptId: string) => {
    const script = scripts.find((s) => s.id === scriptId)
    return script?.name || 'Unbekanntes Skript'
  }

  const toggleExpand = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => {
    setExpandedNotes(new Set(notes.map((n) => n.id)))
  }

  const collapseAll = () => {
    setExpandedNotes(new Set())
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedNotes)
    if (ids.length === 0) return
    if (!confirm(`Sollen ${ids.length} Notizen gelöscht werden?`)) return
    await onBulkDeleteNotes(ids)
    clearSelection()
  }

  const copyToClipboard = async (noteId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(noteId)
      toast.success('Notizen in Zwischenablage kopiert')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  const downloadAsMarkdown = (note: StudyNote) => {
    const scriptName = getScriptName(note.scriptId)
    const filename = `${scriptName.replace(/[^a-zA-Z0-9]/g, '_')}_Notizen.md`
    const header = `# Lernnotizen: ${scriptName}\n\n_Erstellt am ${formatDate(note.generatedAt)}_\n\n---\n\n`
    const content = header + note.content
    
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Notizen heruntergeladen')
  }

  // Sortiere Notizen nach Datum (neueste zuerst)
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => 
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )
  }, [notes])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Note size={24} weight="duotone" className="text-primary" />
            Wissenschaftliche Lernnotizen
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            KI-generierte Zusammenfassungen im LaTeX-Stil mit Formeln, Tabellen und Strukturierung
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleSelectAll} 
            disabled={notes.length === 0}
          >
            {allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
          </Button>
          
          {notes.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={expandedNotes.size === notes.length ? collapseAll : expandAll}
              >
                {expandedNotes.size === notes.length ? (
                  <>
                    <CaretUp size={14} className="mr-1" />
                    Alle einklappen
                  </>
                ) : (
                  <>
                    <CaretDown size={14} className="mr-1" />
                    Alle aufklappen
                  </>
                )}
              </Button>
              
              <Button
                variant={twoColumnLayout ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTwoColumnLayout(!twoColumnLayout)}
                title="Zwei-Spalten-Layout umschalten"
              >
                {twoColumnLayout ? (
                  <>
                    <Rows size={14} className="mr-1" />
                    Einspaltig
                  </>
                ) : (
                  <>
                    <Columns size={14} className="mr-1" />
                    Zweispaltig
                  </>
                )}
              </Button>
            </>
          )}
          
          {hasSelection && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash size={14} className="mr-2" />
              {selectedNotes.size} löschen
            </Button>
          )}
        </div>
      </div>

      {/* Notizen-Liste */}
      {notes.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
            <Note size={40} className="text-primary" weight="duotone" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Noch keine Lernnotizen</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Lade Skripte hoch und generiere wissenschaftlich strukturierte Lernnotizen mit LaTeX-Formeln, Tabellen und klarer Gliederung.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedNotes.map((note) => (
            <Collapsible
              key={note.id}
              open={expandedNotes.has(note.id)}
              onOpenChange={() => toggleExpand(note.id)}
            >
              <Card className="overflow-hidden">
                {/* Note Header */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 border-b">
                  <Checkbox
                    checked={selectedNotes.has(note.id)}
                    onCheckedChange={() => toggleSelect(note.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <CollapsibleTrigger asChild>
                    <button className="flex-1 flex items-center gap-3 text-left hover:bg-muted/50 -m-2 p-2 rounded transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Note size={20} weight="duotone" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{getScriptName(note.scriptId)}</h3>
                        <p className="text-xs text-muted-foreground">
                          Erstellt am {formatDate(note.generatedAt)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {expandedNotes.has(note.id) ? (
                          <CaretUp size={18} className="text-muted-foreground" />
                        ) : (
                          <CaretDown size={18} className="text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(note.id, note.content)}
                      title="In Zwischenablage kopieren"
                    >
                      {copiedId === note.id ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => downloadAsMarkdown(note)}
                      title="Als Markdown herunterladen"
                    >
                      <Download size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Diese Notiz löschen?')) {
                          onDeleteNote(note.id)
                          toast.success('Notiz gelöscht')
                        }
                      }}
                      title="Notiz löschen"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>

                {/* Note Content */}
                <CollapsibleContent>
                  <div 
                    className={cn(
                      "p-6 bg-background",
                      twoColumnLayout && "scientific-two-column"
                    )}
                  >
                    {/* Wissenschaftlicher Header */}
                    <div className="mb-6 pb-4 border-b border-dashed">
                      <div className="text-center">
                        <h2 className="text-lg font-bold text-primary mb-1">
                          {getScriptName(note.scriptId)}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Lernnotizen • {formatDate(note.generatedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Markdown/LaTeX Content */}
                    <div className="scientific-notes">
                      <MarkdownRenderer 
                        content={note.content} 
                        className="scientific-content"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  )
}
