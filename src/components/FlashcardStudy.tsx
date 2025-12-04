import { useState, useEffect } from 'react'
import { Flashcard } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RateLimitIndicator } from './RateLimitIndicator'
import { DebugModeToggle } from './DebugModeToggle'
import { X, ArrowsClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface FlashcardStudyProps {
  flashcards: Flashcard[]
  onClose: () => void
  onReview: (flashcardId: string, quality: number) => void
}

export function FlashcardStudy({ flashcards, onClose, onReview }: FlashcardStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  const currentCard = flashcards[currentIndex]
  const progress = ((reviewedCount) / flashcards.length) * 100

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isFlipped) {
        e.preventDefault()
        setIsFlipped(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped])

  const handleReview = (quality: number) => {
    onReview(currentCard.id, quality)
    setReviewedCount((prev) => prev + 1)
    
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsFlipped(false)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setIsFlipped(false)
      setReviewedCount((prev) => Math.max(0, prev - 1))
    }
  }

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsFlipped(false)
    }
  }

  if (reviewedCount >= flashcards.length) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-2xl font-semibold mb-2">Session abgeschlossen!</h2>
            <p className="text-muted-foreground mb-6">
              Du hast {flashcards.length} Karteikarten durchgearbeitet.
            </p>
            <Button onClick={onClose} className="w-full">
              Fertig
            </Button>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={20} />
              </Button>
              <div>
                <h2 className="font-semibold">Karteikarten-Modus</h2>
                <p className="text-sm text-muted-foreground">
                  Karte {currentIndex + 1} von {flashcards.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DebugModeToggle />
              <RateLimitIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <CaretLeft size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex >= flashcards.length - 1}
              >
                <CaretRight size={20} />
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 pb-2">
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div
            className="relative w-full cursor-pointer"
            onClick={() => !isFlipped && setIsFlipped(true)}
            style={{ minHeight: '400px' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isFlipped ? 'back' : 'front'}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Card
                  className={cn(
                    'h-full p-12 flex flex-col items-center justify-center text-center',
                    !isFlipped && 'border-primary/50'
                  )}
                >
                  {!isFlipped ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
                        <ArrowsClockwise size={16} />
                        <span>Klicken zum Umdrehen</span>
                      </div>
                      <div className="text-xl leading-relaxed whitespace-pre-wrap">
                        {currentCard.front}
                      </div>
                    </>
                  ) : (
                    <div className="w-full">
                      <div className="text-lg leading-relaxed whitespace-pre-wrap mb-8">
                        {currentCard.back}
                      </div>
                      <div className="border-t pt-6">
                        <p className="text-sm text-muted-foreground mb-4">
                          Wie gut kanntest du die Antwort?
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button
                            variant="outline"
                            onClick={() => handleReview(1)}
                            className="flex-1 max-w-32"
                          >
                            <div>
                              <div className="font-semibold">Nochmal</div>
                              <div className="text-xs text-muted-foreground">Nicht gewusst</div>
                            </div>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleReview(3)}
                            className="flex-1 max-w-32"
                          >
                            <div>
                              <div className="font-semibold">Schwer</div>
                              <div className="text-xs text-muted-foreground">Unsicher</div>
                            </div>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleReview(4)}
                            className="flex-1 max-w-32"
                          >
                            <div>
                              <div className="font-semibold">Gut</div>
                              <div className="text-xs text-muted-foreground">Mit Mühe</div>
                            </div>
                          </Button>
                          <Button
                            onClick={() => handleReview(5)}
                            className="flex-1 max-w-32"
                          >
                            <div>
                              <div className="font-semibold">Einfach</div>
                              <div className="text-xs text-muted-foreground">Sofort gewusst</div>
                            </div>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          {!isFlipped && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Drücke <kbd className="px-2 py-1 bg-muted rounded text-xs">Leertaste</kbd> zum
              Umdrehen
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
