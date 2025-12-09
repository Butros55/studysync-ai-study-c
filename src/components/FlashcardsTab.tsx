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
  Sparkle,
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { cn } from '@/lib/utils'

interface FlashcardsTabProps {
  flashcards: Flashcard[]
  onDeleteFlashcard: (flashcardId: string) => void
  onBulkDeleteFlashcards: (ids: string[]) => void
  onStartStudy: () => void
  onGenerateAllFlashcards: () => void
  // Legacy-Props (optional, für Debug-Modus)
  notes?: StudyNote[]
  onGenerateFlashcards?: (noteId: string) => void
}

export function FlashcardsTab({
  flashcards,
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedCards)
    if (ids.length === 0) return
    if (!confirm(`Sollen ${ids.length} Karteikarten geloescht werden?`)) return
    await onBulkDeleteFlashcards(ids)
    clearSelection()
  }

  if (flashcards.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Cards size={20} weight="duotone" />
              Lernkarteikarten
            </h2>
            <p className="text-sm text-muted-foreground">
              KI-generierte Karteikarten zum aktiven Lernen
            </p>
          </div>
        </div>

        {/* Empty State ohne Box */}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Cards size={32} className="text-muted-foreground" weight="duotone" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Noch keine Karteikarten</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            Lade Skripte hoch und generiere automatisch Karteikarten zum Lernen.
          </p>
          <Button onClick={onGenerateAllFlashcards}>
            <Sparkle size={18} className="mr-2" weight="fill" />
            Karteikarten generieren
          </Button>
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
          <Button variant="outline" onClick={onGenerateAllFlashcards}>
            <Sparkle size={18} className="mr-2" />
            Mehr generieren
          </Button>
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
          
          // Lernstatus basierend auf ease und repetitions berechnen
          const repetitions = card.repetitions || 0
          const ease = card.ease || 2.5
          const isNew = repetitions === 0
          const isStruggling = ease < 2.0 // Niedrige ease = oft falsch
          const isMastered = ease >= 2.8 && repetitions >= 3 // Hohe ease + viele Wiederholungen
          const isLearning = !isNew && !isStruggling && !isMastered

          return (
            <Card
              key={card.id}
              className={cn(
                'p-5 border transition-shadow',
                isDue ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-card shadow-sm hover:shadow-md',
                isStruggling && 'border-l-4 border-l-red-500',
                isMastered && 'border-l-4 border-l-green-500'
              )}
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
                    
                    {/* Lernstatus-Indikator */}
                    {isNew && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                        Neu
                      </Badge>
                    )}
                    {isStruggling && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                        Schwierig
                      </Badge>
                    )}
                    {isMastered && (
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                        Gemeistert
                      </Badge>
                    )}
                    {isLearning && repetitions > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        Lernend ({repetitions}x)
                      </Badge>
                    )}
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
