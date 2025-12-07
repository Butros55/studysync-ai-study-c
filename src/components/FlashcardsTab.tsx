import { useState } from 'react'
import { Flashcard, StudyNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import {
  Cards,
  Trash,
  Lightning,
  Clock,
  IdentificationCard,
  Sparkle,
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { useBulkSelection } from '@/hooks/use-bulk-selection'

interface FlashcardsTabProps {
  flashcards: Flashcard[]
  notes: StudyNote[]
  onGenerateFlashcards: (noteId: string) => void
  onDeleteFlashcard: (flashcardId: string) => void
  onBulkDeleteFlashcards: (ids: string[]) => void
  onStartStudy: () => void
  onGenerateAllFlashcards: () => void
}

export function FlashcardsTab({
  flashcards,
  notes,
  onGenerateFlashcards,
  onDeleteFlashcard,
  onBulkDeleteFlashcards,
  onStartStudy,
  onGenerateAllFlashcards,
}: FlashcardsTabProps) {
  const {
    selectedIds: selectedCards,
    hasSelection,
    allSelected,
    toggleSelection: toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection({
    items: flashcards,
    getId: (card) => card.id,
  })

  const getDueFlashcards = (reference: Date) => {
    return flashcards.filter((card) => {
      if (!card.nextReview) return true
      return new Date(card.nextReview) <= reference
    })
  }

  const now = new Date()
  const dueCards = getDueFlashcards(now)
  const totalCards = flashcards.length
  const upcomingCards = Math.max(totalCards - dueCards.length, 0)
  const upcomingDates = flashcards
    .map((card) => (card.nextReview ? new Date(card.nextReview) : null))
    .filter((date): date is Date => !!date && date > now)
    .sort((a, b) => a.getTime() - b.getTime())
  const nextScheduledLabel = upcomingDates.length > 0
    ? formatDistanceToNow(upcomingDates[0], { addSuffix: true, locale: de })
    : 'Keine geplant'

  const getCardsByNote = (noteId: string) => {
    return flashcards.filter((card) => card.noteId === noteId)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedCards)
    if (ids.length === 0) return
    if (!confirm(`Sollen ${ids.length} Karteikarten geloescht werden?`)) return
    await onBulkDeleteFlashcards(ids)
    clearSelection()
  }

  if (flashcards.length === 0 && notes.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md">
          <Cards size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Noch keine Karteikarten</h3>
          <p className="text-muted-foreground">
            Erstelle zuerst Notizen aus deinen Skripten, um Karteikarten zu generieren.
          </p>
        </div>
      </div>
    )
  }

  if (flashcards.length === 0 && notes.length > 0) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center bg-muted/30">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkle size={32} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Karteikarten generieren</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Erstelle automatisch Lernkarten aus deinen vorhandenen Notizen.
          </p>
          <Button onClick={onGenerateAllFlashcards}>
            <Sparkle size={18} className="mr-2" />
            Alle Karteikarten generieren
          </Button>
        </Card>

        <div className="space-y-3">
          {notes.map((note) => {
            const noteCards = getCardsByNote(note.id)
            const hasCards = noteCards.length > 0

            return (
              <Card key={note.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <IdentificationCard size={18} className="text-muted-foreground shrink-0" />
                      <h4 className="font-medium truncate">
                        Notiz vom {new Date(note.generatedAt).toLocaleDateString('de-DE')}
                      </h4>
                    </div>
                    {hasCards ? (
                      <p className="text-sm text-muted-foreground">
                        {noteCards.length} Karteikarte{noteCards.length !== 1 ? 'n' : ''}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Noch keine Karteikarten generiert</p>
                    )}
                  </div>
                  {!hasCards && (
                    <Button onClick={() => onGenerateFlashcards(note.id)} size="sm">
                      <Sparkle size={16} className="mr-2" />
                      Generieren
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Karteikarten</h3>
          <p className="text-sm text-muted-foreground">
            {dueCards.length > 0 ? `${dueCards.length} Karten faellig` : 'Alle Karten gelernt!'}
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={flashcards.length === 0}>
              {allSelected ? 'Auswahl aufheben' : 'Alle auswaehlen'}
            </Button>
            {hasSelection && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash size={14} className="mr-2" />
                {selectedCards.size} loeschen
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {notes.some((note) => getCardsByNote(note.id).length === 0) && (
            <Button variant="outline" onClick={onGenerateAllFlashcards}>
              <Sparkle size={18} className="mr-2" />
              Fehlende generieren
            </Button>
          )}
          {dueCards.length > 0 && (
            <Button onClick={onStartStudy}>
              <Lightning size={18} className="mr-2" />
              Lernen starten ({dueCards.length})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border border-border/70 bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Cards size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalCards}</p>
              <p className="text-sm text-muted-foreground">Gesamt</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border/70 bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{dueCards.length}</p>
              <p className="text-sm text-muted-foreground">Faellig</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border/70 bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <Lightning size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{upcomingCards}</p>
              <p className="text-sm text-muted-foreground">Geplant • {nextScheduledLabel}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4">
        {flashcards.map((card) => {
          const isDue = !card.nextReview || new Date(card.nextReview) <= now
          const dueLabel = card.nextReview
            ? formatDistanceToNow(new Date(card.nextReview), { addSuffix: true, locale: de })
            : 'sofort'

          return (
            <Card
              key={card.id}
              className={`p-5 border transition-shadow ${isDue ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-card shadow-sm hover:shadow-md'}`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedCards.has(card.id)}
                  onCheckedChange={() => toggleSelect(card.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={isDue ? 'default' : 'secondary'} className="text-[11px]">
                      {isDue ? 'Faellig' : 'Geplant'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Review {dueLabel}</span>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-[11px]">Front</Badge>
                    <MarkdownRenderer content={card.front} compact className="text-sm leading-relaxed" />
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-[11px]">Back</Badge>
                    <MarkdownRenderer content={card.back} compact className="text-sm text-muted-foreground leading-relaxed" />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm('Diese Karte geloescht werden?')) {
                      onDeleteFlashcard(card.id)
                    }
                  }}
                >
                  <Trash size={18} />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
