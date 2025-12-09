import { useState, useEffect, useRef, useCallback } from 'react'
import { Flashcard } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DebugModeToggle } from './DebugModeToggle'
import { X, ArrowsClockwise, CaretLeft, CaretRight, ArrowLeft, Check, XCircle, Question, Lightning } from '@phosphor-icons/react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { cn } from '@/lib/utils'

interface FlashcardStudyProps {
  flashcards: Flashcard[]
  onClose: () => void
  onReview: (flashcardId: string, quality: number) => void
}

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 100

export function FlashcardStudy({ flashcards, onClose, onReview }: FlashcardStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null)
  const constraintsRef = useRef<HTMLDivElement>(null)

  // Motion values for swipe
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15])
  const cardOpacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5])
  
  // Swipe indicators
  const leftIndicatorOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0])
  const rightIndicatorOpacity = useTransform(x, [0, 50, 150], [0, 0.5, 1])

  const currentCard = flashcards[currentIndex]
  const progress = ((reviewedCount) / flashcards.length) * 100

  const handleReview = useCallback((quality: number) => {
    onReview(currentCard.id, quality)
    setReviewedCount((prev) => prev + 1)
    
    // Animation direction based on quality
    setExitDirection(quality >= 4 ? 'right' : 'left')
    
    setTimeout(() => {
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex((prev) => prev + 1)
        setIsFlipped(false)
        x.set(0)
      }
      setExitDirection(null)
    }, 200)
  }, [currentCard, currentIndex, flashcards.length, onReview, x])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        setIsFlipped(prev => !prev)
      }
      // Arrow keys for navigation when flipped
      if (isFlipped) {
        if (e.key === 'ArrowLeft' || e.key === '1') {
          handleReview(1) // Nochmal
        } else if (e.key === 'ArrowDown' || e.key === '2') {
          handleReview(3) // Schwer
        } else if (e.key === 'ArrowUp' || e.key === '3') {
          handleReview(4) // Gut
        } else if (e.key === 'ArrowRight' || e.key === '4') {
          handleReview(5) // Einfach
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped, handleReview])

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = info.offset.x
    
    if (Math.abs(swipeDistance) > SWIPE_THRESHOLD && isFlipped) {
      // Swipe right = knew it (quality 5), swipe left = didn't know (quality 1)
      const quality = swipeDistance > 0 ? 5 : 1
      handleReview(quality)
    } else {
      // Snap back
      x.set(0)
    }
  }, [handleReview, isFlipped, x])

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

  // Completion screen
  if (reviewedCount >= flashcards.length) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
            >
              <Check size={40} weight="bold" className="text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Session abgeschlossen!</h2>
            <p className="text-muted-foreground mb-6">
              Du hast {flashcards.length} Karteikarten durchgearbeitet.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-500">{flashcards.length}</div>
                <div className="text-xs text-muted-foreground">Karten gelernt</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">100%</div>
                <div className="text-xs text-muted-foreground">Fortschritt</div>
              </div>
            </div>
            
            <Button onClick={onClose} className="w-full" size="lg">
              Fertig
            </Button>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden touch-none">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="h-10 w-10 shrink-0 touch-manipulation"
              >
                <ArrowLeft size={20} />
              </Button>
              <div className="min-w-0">
                <h2 className="font-semibold text-base truncate">Karteikarten</h2>
                <p className="text-sm text-muted-foreground">
                  {currentIndex + 1} / {flashcards.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-2">
                <DebugModeToggle />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="h-10 w-10 hidden md:flex"
              >
                <CaretLeft size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex >= flashcards.length - 1}
                className="h-10 w-10 hidden md:flex"
              >
                <CaretRight size={20} />
              </Button>
            </div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Card Area with Swipe Support */}
      <div 
        ref={constraintsRef}
        className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative"
      >
        {/* Swipe Indicators */}
        <motion.div 
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ opacity: leftIndicatorOpacity }}
        >
          <div className="bg-red-500/20 rounded-full p-4">
            <XCircle size={32} className="text-red-500" weight="fill" />
          </div>
        </motion.div>
        <motion.div 
          className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ opacity: rightIndicatorOpacity }}
        >
          <div className="bg-green-500/20 rounded-full p-4">
            <Check size={32} className="text-green-500" weight="bold" />
          </div>
        </motion.div>

        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: exitDirection === 'left' ? -300 : exitDirection === 'right' ? 300 : 0,
              }}
              exit={{ 
                scale: 0.9, 
                opacity: 0,
                x: exitDirection === 'left' ? -300 : exitDirection === 'right' ? 300 : 0,
              }}
              transition={{ duration: 0.2 }}
              style={{ x: exitDirection ? undefined : x, rotate, opacity: cardOpacity }}
              drag={isFlipped ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              className="cursor-grab active:cursor-grabbing touch-manipulation"
            >
              <Card
                className={cn(
                  'min-h-[400px] md:min-h-[450px] p-6 md:p-10 flex flex-col relative overflow-hidden',
                  'transition-shadow duration-200',
                  !isFlipped && 'border-primary/30 shadow-lg shadow-primary/5',
                  isFlipped && 'border-muted'
                )}
                onClick={() => !isFlipped && setIsFlipped(true)}
              >
                {/* Card Side Indicator */}
                <div className="absolute top-4 right-4">
                  <span className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    !isFlipped ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {isFlipped ? 'Antwort' : 'Frage'}
                  </span>
                </div>

                {/* Card Content */}
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  {!isFlipped ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                        <ArrowsClockwise size={16} />
                        <span>Tippen zum Umdrehen</span>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl md:text-2xl font-medium leading-relaxed"
                      >
                        {currentCard.front}
                      </motion.div>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, rotateY: 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ duration: 0.3 }}
                      className="w-full"
                    >
                      <div className="text-lg md:text-xl leading-relaxed whitespace-pre-wrap mb-8">
                        {currentCard.back}
                      </div>
                      
                      {/* Swipe Hint on Touch Devices */}
                      <div className="md:hidden text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          ← Wische links (falsch) oder rechts (richtig) →
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Rating Buttons (visible when flipped) */}
                {isFlipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="border-t pt-6 mt-4"
                  >
                    <p className="text-sm text-muted-foreground mb-4 text-center hidden md:block">
                      Wie gut kanntest du die Antwort?
                    </p>
                    
                    {/* Desktop: All 4 buttons */}
                    <div className="hidden md:grid grid-cols-4 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleReview(1)}
                        className="flex-col h-auto py-3 hover:bg-red-500/10 hover:border-red-500/50"
                      >
                        <XCircle size={24} className="text-red-500 mb-1" weight="fill" />
                        <div className="font-semibold text-sm">Nochmal</div>
                        <div className="text-xs text-muted-foreground">Nicht gewusst</div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReview(3)}
                        className="flex-col h-auto py-3 hover:bg-orange-500/10 hover:border-orange-500/50"
                      >
                        <Question size={24} className="text-orange-500 mb-1" weight="fill" />
                        <div className="font-semibold text-sm">Schwer</div>
                        <div className="text-xs text-muted-foreground">Unsicher</div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReview(4)}
                        className="flex-col h-auto py-3 hover:bg-blue-500/10 hover:border-blue-500/50"
                      >
                        <Lightning size={24} className="text-blue-500 mb-1" weight="fill" />
                        <div className="font-semibold text-sm">Gut</div>
                        <div className="text-xs text-muted-foreground">Mit Mühe</div>
                      </Button>
                      <Button
                        onClick={() => handleReview(5)}
                        className="flex-col h-auto py-3 bg-green-500 hover:bg-green-600"
                      >
                        <Check size={24} className="text-white mb-1" weight="bold" />
                        <div className="font-semibold text-sm">Einfach</div>
                        <div className="text-xs text-white/80">Sofort gewusst</div>
                      </Button>
                    </div>

                    {/* Mobile: 2 big buttons */}
                    <div className="grid grid-cols-2 gap-3 md:hidden">
                      <Button
                        variant="outline"
                        onClick={() => handleReview(1)}
                        className="flex-col h-auto py-4 hover:bg-red-500/10 border-red-500/30"
                        size="lg"
                      >
                        <XCircle size={32} className="text-red-500 mb-2" weight="fill" />
                        <div className="font-semibold">Nochmal</div>
                      </Button>
                      <Button
                        onClick={() => handleReview(5)}
                        className="flex-col h-auto py-4 bg-green-500 hover:bg-green-600"
                        size="lg"
                      >
                        <Check size={32} className="text-white mb-2" weight="bold" />
                        <div className="font-semibold">Gewusst!</div>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Keyboard Hints (Desktop) */}
          {!isFlipped && (
            <p className="text-center text-sm text-muted-foreground mt-4 hidden md:block">
              Drücke <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Leertaste</kbd> zum Umdrehen
            </p>
          )}
        </div>
      </div>

      {/* Mobile Navigation Footer */}
      <div className="md:hidden border-t bg-card/80 backdrop-blur-sm p-4">
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex-1 max-w-[150px]"
          >
            <CaretLeft size={20} className="mr-2" />
            Zurück
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleNext}
            disabled={currentIndex >= flashcards.length - 1}
            className="flex-1 max-w-[150px]"
          >
            Weiter
            <CaretRight size={20} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
