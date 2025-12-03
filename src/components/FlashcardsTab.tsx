import { Flashcard, StudyNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from './EmptyState'
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

interface FlashcardsTabProps {
  flashcards: Flashcard[]
  notes: StudyNote[]
  onGenerateFlashcards: (noteId: string) => void
  onDeleteFlashcard: (flashcardId: string) => void
  onStartStudy: () => void
  onGenerateAllFlashcards: () => void
}

export function FlashcardsTab({
  flashcards,
  notes,
  onGenerateFlashcards,
  onDeleteFlashcard,
  onStartStudy,
  onGenerateAllFlashcards,
}: FlashcardsTabProps) {
  const getDueFlashcards = () => {
    const now = new Date()
    return flashcards.filter((card) => {
      if (!card.nextReview) return true
      return new Date(card.nextReview) <= now
    })
  }

  const dueCards = getDueFlashcards()
  const totalCards = flashcards.length

  const getCardsByNote = (noteId: string) => {
    return flashcards.filter((card) => card.noteId === noteId)
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
          <h3 className="text-lg font-semibold mb-2">
            Generiere Karteikarten aus deinen Notizen
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Erstelle automatisch interaktive Lernkarten aus deinen vorhandenen Notizen, um mit dem
            Lernen zu beginnen.
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
                      <h4 className="font-medium truncate">Notiz vom {new Date(note.generatedAt).toLocaleDateString('de-DE')}</h4>
                    </div>
                    {hasCards ? (
                      <p className="text-sm text-muted-foreground">
                        {noteCards.length} Karteikarte{noteCards.length !== 1 ? 'n' : ''}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Noch keine Karteikarten generiert
                      </p>
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Karteikarten</h3>
          <p className="text-sm text-muted-foreground">
            {dueCards.length > 0 ? (
              <>
                {dueCards.length} Karte{dueCards.length !== 1 ? 'n' : ''} fällig
              </>
            ) : (
              'Alle Karten gelernt!'
            )}
          </p>
        </div>
        <div className="flex gap-2">
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
        <Card className="p-4">
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

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <Lightning size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{dueCards.length}</p>
              <p className="text-sm text-muted-foreground">Fällig</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalCards - dueCards.length}</p>
              <p className="text-sm text-muted-foreground">Gelernt</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {flashcards.map((card) => {
          const isDue = !card.nextReview || new Date(card.nextReview) <= new Date()

          return (
            <Card key={card.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {isDue && (
                      <Badge variant="default" className="shrink-0">
                        Fällig
                      </Badge>
                    )}
                    {!isDue && card.nextReview && (
                      <Badge variant="secondary" className="shrink-0">
                        <Clock size={14} className="mr-1" />
                        {formatDistanceToNow(new Date(card.nextReview), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </Badge>
                    )}
                    {card.repetitions > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {card.repetitions}x wiederholt
                      </span>
                    )}
                  </div>
                  <p className="font-medium mb-1 line-clamp-2">{card.front}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{card.back}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteFlashcard(card.id)}
                  className="shrink-0"
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
