import { useState, useEffect } from 'react'
import { Flashcard } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DebugModeToggle } from './DebugModeToggle'
import { X, ArrowsClockwise, CaretLeft, CaretRight, ArrowLeft } from '@phosphor-icons/react'
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
          <Card className="p-6 sm:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl sm:text-3xl">🎉</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">Session abgeschlossen!</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <div className="border-b bg-card shrink-0">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
              </Button>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm sm:text-base">Karteikarten-Modus</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Karte {currentIndex + 1} von {flashcards.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                <DebugModeToggle />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
              >
                <CaretLeft size={18} className="sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex >= flashcards.length - 1}
                className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
              >
                <CaretRight size={18} className="sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="px-3 sm:px-6 pb-2">
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-3xl">
          <div
            className="relative w-full cursor-pointer"
            onClick={() => !isFlipped && setIsFlipped(true)}
            style={{ minHeight: '300px' }}
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
                    'h-full p-6 sm:p-12 flex flex-col items-center justify-center text-center',
                    !isFlipped && 'border-primary/50'
                  )}
                >
                  {!isFlipped ? (
                    <>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">
                        <ArrowsClockwise size={14} className="sm:w-4 sm:h-4" />
                        <span>Klicken zum Umdrehen</span>
                      </div>
                      <div className="text-base sm:text-xl leading-relaxed whitespace-pre-wrap">
                        {currentCard.front}
                      </div>
                    </>
                  ) : (
                    <div className="w-full">
                      <div className="text-sm sm:text-lg leading-relaxed whitespace-pre-wrap mb-6 sm:mb-8">
                        {currentCard.back}
                      </div>
                      <div className="border-t pt-4 sm:pt-6">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                          Wie gut kanntest du die Antwort?
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                          <Button
                            variant="outline"
                            onClick={() => handleReview(1)}
                            className="flex-1 sm:max-w-32"
                            size="sm"
                          >
                            <div>
                              <div className="font-semibold text-xs sm:text-sm">Nochmal</div>
                              <div className="text-xs text-muted-foreground">Nicht gewusst</div>
                            </div>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleReview(3)}
                            className="flex-1 sm:max-w-32"
                            size="sm"
                          >
                            <div>
                              <div className="font-semibold text-xs sm:text-sm">Schwer</div>
                              <div className="text-xs text-muted-foreground">Unsicher</div>
                            </div>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleReview(4)}
                            className="flex-1 sm:max-w-32"
                            size="sm"
                          >
                            <div>
                              <div className="font-semibold text-xs sm:text-sm">Gut</div>
                              <div className="text-xs text-muted-foreground">Mit Mühe</div>
                            </div>
                          </Button>
                          <Button
                            onClick={() => handleReview(5)}
                            className="flex-1 sm:max-w-32"
                            size="sm"
                          >
                            <div>
                              <div className="font-semibold text-xs sm:text-sm">Einfach</div>
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
            <p className="text-center text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
              <span className="hidden sm:inline">Drücke <kbd className="px-2 py-1 bg-muted rounded text-xs">Leertaste</kbd> zum Umdrehen</span>
              <span className="sm:hidden">Tippen zum Umdrehen</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
