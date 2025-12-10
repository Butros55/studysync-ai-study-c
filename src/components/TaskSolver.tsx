import { useState, useEffect } from 'react'
import { Task, TaskFeedback, Script } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DebugModeToggle } from './DebugModeToggle'
import { TaskQuestionPanel } from './TaskQuestionPanel'
import { TaskAttachments } from './TaskAttachments'
import { SolutionPanel } from './SolutionPanel'
import { MarkdownRenderer } from './MarkdownRenderer'
import { FormulaSheetPanel } from './FormulaSheetPanel'
import { Badge } from './ui/badge'
import {
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Eraser,
  Keyboard,
  PencilLine,
  Info,
  ArrowLeft,
  Confetti,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { motion, AnimatePresence } from 'framer-motion'
import { usePreferredInputMode } from '@/hooks/use-preferred-input-mode'

interface TaskSolverProps {
  task: Task
  onClose: () => void
  onSubmit: (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => Promise<void>
  feedback?: TaskFeedback
  onNextTask?: () => void
  onPrevTask?: () => void
  /** Aktuelle Position und Gesamtanzahl für Navigation */
  taskIndex?: number
  totalTasks?: number
  onTaskUpdate?: (updates: Partial<Task>) => void
  /** Formelsammlungen aus dem aktuellen Modul */
  formulaSheets?: Script[]
  /** Hide solution block (e.g. in StudyRoom challenge) */
  hideSolution?: boolean
  studyRoomHud?: {
    roomCode: string
    roundIndex: number
    mode: 'collab' | 'challenge'
    endsAt?: string
    extensionVotes?: number
    memberCount?: number
    submittedCount?: number
    phase?: string
    lockCountdownStartAt?: string
  }
}

// Prominentes Feedback-Overlay
function FeedbackOverlay({ 
  feedback, 
  onDismiss,
  onNextTask 
}: { 
  feedback: TaskFeedback
  onDismiss: () => void
  onNextTask?: () => void
}) {
  useEffect(() => {
    // Auto-Dismiss nach 3 Sekunden, wenn korrekt
    if (feedback.isCorrect) {
      const timer = setTimeout(onDismiss, 3000)
      return () => clearTimeout(timer)
    }
  }, [feedback.isCorrect, onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: -20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {feedback.isCorrect ? (
          <Card className="p-6 bg-green-500/20 border-green-500/40 shadow-2xl shadow-green-500/20">
            <div className="flex flex-col items-center text-center gap-4">
              <motion.div
                initial={{ rotate: -10, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              >
                <div className="w-20 h-20 rounded-full bg-green-500/30 flex items-center justify-center">
                  <Confetti size={48} className="text-green-500" weight="fill" />
                </div>
              </motion.div>
              <div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                  Richtig!
                </h3>
                <p className="text-muted-foreground">
                  Sehr gut! Deine Lösung ist korrekt.
                </p>
              </div>
              {onNextTask && (
                <Button 
                  onClick={() => {
                    onDismiss()
                    onNextTask()
                  }}
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700 mt-2"
                >
                  <ArrowRight size={18} className="mr-2" />
                  Nächste Aufgabe
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6 bg-yellow-500/20 border-yellow-500/40 shadow-2xl shadow-yellow-500/20">
            <div className="flex flex-col items-center text-center gap-4">
              <motion.div
                initial={{ x: -5 }}
                animate={{ x: [0, -5, 5, -3, 3, 0] }}
                transition={{ duration: 0.4 }}
              >
                <div className="w-20 h-20 rounded-full bg-yellow-500/30 flex items-center justify-center">
                  <Lightbulb size={48} className="text-yellow-500" weight="fill" />
                </div>
              </motion.div>
              <div>
                <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                  Noch nicht ganz
                </h3>
                <p className="text-muted-foreground mb-3">
                  Schau dir die Hinweise an und versuch es nochmal.
                </p>
                {feedback.hints && feedback.hints.length > 0 && (
                  <div className="text-left bg-background/50 rounded-lg p-3 text-sm">
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.hints.slice(0, 2).map((hint, idx) => (
                        <li key={idx} className="text-muted-foreground">{hint}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button 
                onClick={onDismiss}
                variant="outline"
                size="lg"
                className="mt-2"
              >
                Nochmal versuchen
              </Button>
            </div>
          </Card>
        )}
      </motion.div>
    </motion.div>
  )
}

export function TaskSolver({
  task,
  onClose,
  onSubmit,
  feedback,
  onNextTask,
  onPrevTask,
  taskIndex,
  totalTasks,
  onTaskUpdate,
  formulaSheets = [],
  hideSolution = false,
  studyRoomHud,
}: TaskSolverProps) {
  // Get user's preferred input mode
  const { mode: preferredInputMode, isLoading: isPreferenceLoading } = usePreferredInputMode()
  
  // Initialize inputMode based on preference (default to 'draw' if not set)
  const [inputMode, setInputMode] = useState<'draw' | 'type'>('draw')
  const [textAnswer, setTextAnswer] = useState('')
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [hasCanvasContent, setHasCanvasContent] = useState(false)
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right')
  
  // Touch/Swipe State
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const minSwipeDistance = 50
  
  // Navigation erlaubt? (NICHT im StudyRoom/Multiplayer!)
  const canNavigate = !studyRoomHud && (onNextTask || onPrevTask)
  // onNextTask/onPrevTask werden nur übergeben, wenn Navigation möglich ist
  const hasPrev = !!onPrevTask
  const hasNext = !!onNextTask

  // Reset Input State - definiert vor den Navigation-Handlern
  const resetInputState = () => {
    setTextAnswer('')
    setHasCanvasContent(false)
    setCanvasDataUrl('')
    setClearCanvasTrigger(prev => prev + 1)
    setShowFeedbackOverlay(false)
  }
  
  // Touch Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (!canNavigate) return
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const onTouchMove = (e: React.TouchEvent) => {
    if (!canNavigate) return
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const onTouchEnd = () => {
    if (!canNavigate || !touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe && hasNext) {
      handleNextWithAnimation()
    } else if (isRightSwipe && hasPrev) {
      handlePrevWithAnimation()
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }
  
  const handleNextWithAnimation = () => {
    if (!onNextTask) return
    setSlideDirection('left')
    // Kurzer Delay für Animation
    setTimeout(() => {
      onNextTask()
      resetInputState()
    }, 50)
  }
  
  const handlePrevWithAnimation = () => {
    if (!onPrevTask) return
    setSlideDirection('right')
    setTimeout(() => {
      onPrevTask()
      resetInputState()
    }, 50)
  }
  
  const [hudRemaining, setHudRemaining] = useState<string>('00:00')
  const [lockCountdown, setLockCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (!studyRoomHud?.endsAt && !studyRoomHud?.lockCountdownStartAt) return
    const interval = setInterval(() => {
      if (studyRoomHud?.lockCountdownStartAt) {
        const diff = 5000 - (Date.now() - new Date(studyRoomHud.lockCountdownStartAt).getTime())
        setLockCountdown(diff > 0 ? Math.ceil(diff / 1000) : 0)
      } else {
        setLockCountdown(null)
      }
      if (studyRoomHud?.endsAt) {
        const remainingMs = Math.max(0, new Date(studyRoomHud.endsAt).getTime() - Date.now())
        const totalSeconds = Math.floor(remainingMs / 1000)
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
        const seconds = String(totalSeconds % 60).padStart(2, '0')
        setHudRemaining(`${minutes}:${seconds}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [studyRoomHud?.endsAt, studyRoomHud?.lockCountdownStartAt])
  
  // Sync inputMode with user preference when it loads
  useEffect(() => {
    if (!isPreferenceLoading && preferredInputMode) {
      setInputMode(preferredInputMode)
    }
  }, [preferredInputMode, isPreferenceLoading])
  
  // Determine if we should show tabs (only in draw mode preference)
  // In type mode preference, only typing is available
  const showInputModeTabs = preferredInputMode !== 'type'
  
  // Zeige Overlay wenn neues Feedback kommt
  useEffect(() => {
    if (feedback && !showFeedbackOverlay) {
      setShowFeedbackOverlay(true)
    }
  }, [feedback])

  // Nach erfolgreicher Aufgabe automatisch zur nächsten wechseln (nach kurzer Verzögerung)
  useEffect(() => {
    if (feedback?.isCorrect && hasNext) {
      const timer = setTimeout(() => {
        handleNextWithAnimation()
      }, 1500) // 1.5 Sekunden warten, damit User das Ergebnis sieht
      return () => clearTimeout(timer)
    }
  }, [feedback?.isCorrect, hasNext])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (inputMode === 'type' && textAnswer.trim()) {
        await onSubmit(textAnswer.trim(), false)
      } else if (inputMode === 'draw' && hasCanvasContent && canvasDataUrl) {
        await onSubmit('handwritten-solution', true, canvasDataUrl)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClear = () => {
    if (inputMode === 'draw') {
      setClearCanvasTrigger((prev) => prev + 1)
      setHasCanvasContent(false)
      setCanvasDataUrl('')
    } else {
      setTextAnswer('')
    }
  }

  const canSubmit = inputMode === 'type' ? textAnswer.trim().length > 0 : hasCanvasContent

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Formelsammlung-Panel (rechte Seite) */}
      {formulaSheets.length > 0 && (
        <FormulaSheetPanel formulaSheets={formulaSheets} />
      )}

      {/* Prominentes Feedback-Overlay */}
      <AnimatePresence>
        {feedback && showFeedbackOverlay && (
          <FeedbackOverlay 
            feedback={feedback} 
            onDismiss={() => setShowFeedbackOverlay(false)}
            onNextTask={onNextTask}
          />
        )}
      </AnimatePresence>

      {/* Compact Header - API-Status Widget entfernt */}
      <div className="border-b bg-card shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="h-8 w-8 shrink-0"
            >
              <ArrowLeft size={18} />
            </Button>
            <h2 className="font-semibold text-sm sm:text-base truncate">Aufgabe lösen</h2>
            
            {/* Aufgaben-Counter (nur wenn Navigation möglich) */}
            {canNavigate && taskIndex !== undefined && totalTasks !== undefined && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{taskIndex + 1}</span>
                <span>/</span>
                <span>{totalTasks}</span>
              </div>
            )}
            
            {/* Mini Feedback Badge im Header */}
            {feedback && !showFeedbackOverlay && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="cursor-pointer"
                onClick={() => setShowFeedbackOverlay(true)}
              >
                {feedback.isCorrect ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-600 text-xs font-medium">
                    <CheckCircle size={14} weight="fill" />
                    <span className="hidden sm:inline">Richtig</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-600 text-xs font-medium">
                    <Lightbulb size={14} weight="fill" />
                    <span className="hidden sm:inline">Hinweise</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Navigation Buttons (nur wenn erlaubt) */}
            {canNavigate && (
              <div className="flex items-center gap-1 mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!hasPrev}
                  onClick={handlePrevWithAnimation}
                  title="Vorherige Aufgabe"
                >
                  <CaretLeft size={18} weight="bold" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!hasNext}
                  onClick={handleNextWithAnimation}
                  title="Nächste Aufgabe"
                >
                  <CaretRight size={18} weight="bold" />
                </Button>
              </div>
            )}
            <DebugModeToggle />
          </div>
        </div>
      </div>

      {studyRoomHud && (
        <div className="border-b bg-card/60">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Room {studyRoomHud.roomCode}</Badge>
            <Badge variant="secondary">Runde #{studyRoomHud.roundIndex} • {studyRoomHud.mode}</Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700">
              Timer {hudRemaining}
            </Badge>
            <Badge variant="outline">
              Submits {studyRoomHud.submittedCount || 0}/{studyRoomHud.memberCount || 0}
            </Badge>
            <Badge variant="outline">
              Votes {studyRoomHud.extensionVotes || 0}/{studyRoomHud.memberCount || 0}
            </Badge>
            {lockCountdown !== null && (
              <Badge variant="destructive">Endet in {lockCountdown}s (alle abgegeben)</Badge>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Question Panel mit Touch-Navigation */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={task.id}
            initial={{ 
              x: slideDirection === 'left' ? 100 : -100, 
              opacity: 0 
            }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ 
              x: slideDirection === 'left' ? -100 : 100, 
              opacity: 0 
            }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <TaskQuestionPanel task={task} isFullscreen={true} defaultExpanded={!feedback} />
          </motion.div>
        </AnimatePresence>
        
        {/* Swipe-Hinweise an den Seiten (nur wenn Navigation möglich) */}
        {canNavigate && (
          <>
            {hasPrev && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-16 flex items-center justify-center opacity-20 hover:opacity-60 transition-opacity pointer-events-none">
                <CaretLeft size={24} className="text-muted-foreground" />
              </div>
            )}
            {hasNext && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-16 flex items-center justify-center opacity-20 hover:opacity-60 transition-opacity pointer-events-none">
                <CaretRight size={24} className="text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-6 pb-safe">
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* Attachments Section - Wahrheitstabellen, Bilder, etc. */}
            {task.attachments && task.attachments.length > 0 && (
              <TaskAttachments attachments={task.attachments} compact />
            )}

            {/* Feedback Section */}
            <AnimatePresence mode="wait">
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-3"
                >
                  {feedback.transcription && (
                    <Alert className="text-sm">
                      <Info size={16} />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">KI-Transkription deiner Handschrift:</p>
                          <div className="bg-muted/50 p-2 sm:p-3 rounded-md overflow-x-auto">
                            <MarkdownRenderer content={feedback.transcription} compact />
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {feedback.isCorrect ? (
                    <Card className="p-3 sm:p-4 bg-green-500/10 border-green-500/20">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" weight="fill" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-green-600 mb-1 text-sm sm:text-base">Richtig!</h4>
                          <p className="text-xs sm:text-sm leading-relaxed mb-3">
                            Sehr gut! Deine Lösung ist korrekt.
                          </p>
                          {onNextTask && (
                            <Button onClick={onNextTask} size="sm" className="bg-green-600 hover:bg-green-700">
                              <ArrowRight size={16} className="mr-1.5" />
                              Nächste Aufgabe
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <Card className="p-3 sm:p-4 bg-yellow-500/10 border-yellow-500/20">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Lightbulb size={20} className="text-yellow-600 mt-0.5 shrink-0" weight="fill" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-yellow-700 dark:text-yellow-500 mb-1 text-sm sm:text-base">Noch nicht ganz richtig</h4>
                          {feedback.hints && feedback.hints.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs sm:text-sm font-medium">Hinweise:</p>
                              <ul className="list-disc list-inside space-y-0.5 text-xs sm:text-sm">
                                {feedback.hints.map((hint, idx) => (
                                  <li key={idx}>
                                    <MarkdownRenderer content={hint} compact inline className="inline prose-p:inline prose-p:my-0" />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <Button
                            onClick={handleClear}
                            variant="outline"
                            size="sm"
                            className="mt-2"
                          >
                            Nochmal versuchen
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Solution Input */}
            <div className="flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h3 className="font-medium text-sm sm:text-base">Deine Lösung</h3>
                {/* Only show tabs if preference is 'draw' or not set */}
                {showInputModeTabs ? (
                  <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'draw' | 'type')} className="w-full sm:w-auto">
                    <TabsList className="w-full sm:w-auto grid grid-cols-2 h-8">
                      <TabsTrigger value="draw" className="text-xs h-7">
                        <PencilLine size={14} className="mr-1.5" />
                        Zeichnen
                      </TabsTrigger>
                      <TabsTrigger value="type" className="text-xs h-7">
                        <Keyboard size={14} className="mr-1.5" />
                        Tippen
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : (
                  /* Type-only mode indicator */
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Keyboard size={14} />
                    <span>Tastatureingabe</span>
                  </div>
                )}
              </div>

              <div className="flex-1 mb-3 relative">
                {/* Only render canvas if inputMode is 'draw' AND preference allows drawing */}
                {inputMode === 'draw' && showInputModeTabs ? (
                  <div className="relative">
                    <AdvancedDrawingCanvas
                      onContentChange={setHasCanvasContent}
                      clearTrigger={clearCanvasTrigger}
                      onCanvasDataUrl={setCanvasDataUrl}
                      isMobile={true}
                      questionText={task.question}
                      onSubmit={handleSubmit}
                      submitDisabled={!hasCanvasContent || feedback?.isCorrect}
                      isSubmitting={isSubmitting}
                      feedback={feedback}
                      task={task}
                      onNextTask={onNextTask}
                      onTaskUpdate={onTaskUpdate}
                      onClear={handleClear}
                      initialStrokes={task.savedStrokes}
                      onStrokesChange={(strokes) => {
                        // Speichere Strokes bei jeder Änderung
                        onTaskUpdate?.({ savedStrokes: strokes })
                      }}
                      formulaSheets={formulaSheets}
                    />
                    {isSubmitting && (
                      <div className="absolute inset-0 bg-background/60 rounded-lg pointer-events-none z-10" />
                    )}
                  </div>
                ) : (
                  <Textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Schreibe deine Lösung hier..."
                    className="min-h-[250px] sm:min-h-[350px] font-mono resize-none text-sm"
                    disabled={isSubmitting}
                  />
                )}
              </div>

              <div className="flex gap-2 pb-3">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="flex-1 h-9 text-xs"
                  disabled={!canSubmit || isSubmitting}
                >
                  <Eraser size={14} className="mr-1.5" />
                  Löschen
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || feedback?.isCorrect || isSubmitting}
                  className="flex-1 h-9 text-xs"
                >
                  {isSubmitting ? 'Prüfe...' : 'Einreichen'}
                </Button>
              </div>
            </div>

            {/* Musterlösung anzeigen - optional ausblendbar für StudyRoom */}
            {!hideSolution && task.solution && (
              <SolutionPanel 
                solution={task.solutionMarkdown || task.solution} 
                compact 
                isCorrect={feedback?.isCorrect}
                viewedSolution={task.viewedSolution}
                onViewSolution={() => onTaskUpdate?.({ viewedSolution: true })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
