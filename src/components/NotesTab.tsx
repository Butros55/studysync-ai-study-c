import { useState, useEffect } from 'react'

import { StudyNote, Script } from '@/lib/types'

import { Card } from '@/components/ui/card'

import { Button } from '@/components/ui/button'

import { Note, Trash } from '@phosphor-icons/react'

import { formatDate } from '@/lib/utils-app'

import { toast } from 'sonner'

import { Checkbox } from '@/components/ui/checkbox'



interface NotesTabProps {

  notes: StudyNote[]

  scripts: Script[]

  onDeleteNote: (noteId: string) => void

  onBulkDeleteNotes: (noteIds: string[]) => void

}



export function NotesTab({ notes, scripts, onDeleteNote, onBulkDeleteNotes }: NotesTabProps) {

  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedNotes((prev) => {
      const valid = new Set<string>()
      notes.forEach((n) => {
        if (prev.has(n.id)) valid.add(n.id)
      })
      return valid
    })
  }, [notes])


  const getScriptName = (scriptId: string) => {

    const script = scripts.find((s) => s.id === scriptId)

    return script?.name || 'Unbekanntes Skript'

  }



  const toggleSelect = (id: string) => {

    setSelectedNotes((prev) => {

      const next = new Set(prev)

      next.has(id) ? next.delete(id) : next.add(id)

      return next

    })

  }



  const handleBulkDelete = async () => {

    const ids = Array.from(selectedNotes)

    if (ids.length === 0) return

    if (!confirm(`Sollen ${ids.length} Notizen gelöscht werden?`)) return

    await onBulkDeleteNotes(ids)

    setSelectedNotes(new Set())

  }



  return (

    <div className="space-y-6">

      <div>

        <h2 className="text-xl font-semibold">Lernnotizen</h2>

        <p className="text-sm text-muted-foreground mt-1">

          KI-generierte Zusammenfassungen und Schluesselkonzepte aus deinen Skripten

        </p>

        {selectedNotes.size > 0 && (

          <div className="mt-2">

            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>

              <Trash size={14} className="mr-2" />

              {selectedNotes.size} l�schen

            </Button>

          </div>

        )}

      </div>



      {notes.length === 0 ? (

        <Card className="p-12 text-center">

          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">

            <Note size={32} className="text-muted-foreground" weight="duotone" />

          </div>

          <h3 className="font-semibold text-lg mb-2">Noch keine Notizen</h3>

          <p className="text-muted-foreground text-sm">

            Erstelle Lernnotizen aus deinen hochgeladenen Skripten mit KI

          </p>

        </Card>

      ) : (

        <div className="grid gap-4">
          {notes.map((note) => (
            <Card key={note.id} className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <Checkbox
                  checked={selectedNotes.has(note.id)}
                  onCheckedChange={() => toggleSelect(note.id)}
                  className="mt-1"
                />
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Note size={20} weight="duotone" />
                </div>
                <div className="flex-1">

                  <h3 className="font-semibold mb-1">{getScriptName(note.scriptId)}</h3>

                  <p className="text-sm text-muted-foreground">

                    Erstellt {formatDate(note.generatedAt)}

                  </p>

                </div>

                <Button

                  size="icon"

                  variant="ghost"

                  className="text-destructive hover:text-destructive"

                  onClick={() => {

                    if (confirm('Diese Notiz löschen?')) {

                      onDeleteNote(note.id)

                      toast.success('Notiz gelöscht')

                    }

                  }}

                >

                  <Trash size={18} />

                </Button>

              </div>

              <div className="prose prose-sm max-w-none">

                <div className="whitespace-pre-wrap text-sm leading-relaxed">

                  {note.content}

                </div>

              </div>

            </Card>

          ))}

        </div>

      )}

    </div>

  )

}