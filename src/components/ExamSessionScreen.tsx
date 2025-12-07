import { useState, useEffect, useCallback } from 'react'
import { ExamSession, ExamTask, ExamTaskStatus, Script } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Clock,
  Flag,
  Check,
  Question,
  ArrowLeft,
  ArrowRight,
  PaperPlaneTilt,
  Keyboard,
  PencilLine,
  Eraser,
  Warning,
  CaretDown,
  CaretUp,
  Pause,
} from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { MarkdownRenderer } from './MarkdownRenderer'
import { TaskAttachments } from './TaskAttachments'
import { FormulaSheetPanel } from './FormulaSheetPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { usePreferredInputMode } from '@/hooks/use-preferred-input-mode'

interface ExamSessionScreenProps {
  session: ExamSession
  onUpdateTask: (taskId: string, updates: Partial<ExamTask>) => void
  onSubmitExam: () => void
  onExit: () => void
  onPauseExam?: () => void
  formulaSheets?: Script[]
}

export function ExamSessionScreen({
  session,
  onUpdateTask,
  onSubmitExam,
  onExit,
  onPauseExam,
  formulaSheets = [],
}: ExamSessionScreenProps) {
  // Get user's preferred input mode
  const { mode: preferredInputMode, isLoading: isPreferenceLoading } = usePreferredInputMode()
  
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [inputMode, setInputMode] = useState<'draw' | 'type'>('draw')
  const [textAnswer, setTextAnswer] = useState('')
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [hasCanvasContent, setHasCanvasContent] = useState(false)
  const [canvasDataUrl, setCanvasDataUrl] = useState('')
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showPauseDialog, setShowPauseDialog] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(session.duration * 60)
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(true)

  const currentTask = session.tasks[currentTaskIndex]
  const totalTasks = session.tasks.length
  
  // Sync inputMode with user preference when it loads
  useEffect(() => {
    if (!isPreferenceLoading && preferredInputMode) {
      setInputMode(preferredInputMode)
    }
  }, [preferredInputMode, isPreferenceLoading])
  
  // Determine if we should show tabs (only in draw mode preference)
  // In type mode preference, only typing is available
  const showInputModeTabs = preferredInputMode !== 'type'

  // Timer Effect
  useEffect(() => {
    if (session.status !== 'in-progress') return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Zeit abgelaufen - automatisch abgeben
          clearInterval(interval)
          onSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [session.status, onSubmitExam])

  // Lade vorhandene Antwort beim Taskwechsel
  useEffect(() => {
    if (currentTask) {
      setTextAnswer(currentTask.userAnswer || '')
      if (currentTask.canvasDataUrl) {
        setCanvasDataUrl(currentTask.canvasDataUrl)
        setHasCanvasContent(true)
      } else {
        setCanvasDataUrl('')
        setHasCanvasContent(false)
      }
      // Reset canvas trigger bei neuem Task
      setClearCanvasTrigger((prev) => prev + 1)
    }
  }, [currentTaskIndex, currentTask])

  // Speichere Antwort
  const saveAnswer = useCallback(() => {
    if (!currentTask) return

    let updates: Partial<ExamTask> = {}

    if (inputMode === 'type' && textAnswer.trim()) {
      updates = {
        userAnswer: textAnswer.trim(),
        isHandwritten: false,
        examStatus: 'answered' as ExamTaskStatus,
      }
    } else if (inputMode === 'draw' && hasCanvasContent && canvasDataUrl) {
      updates = {
        canvasDataUrl,
        isHandwritten: true,
        examStatus: 'answered' as ExamTaskStatus,
      }
    }

    if (Object.keys(updates).length > 0) {
      onUpdateTask(currentTask.id, updates)
    }
  }, [currentTask, inputMode, textAnswer, hasCanvasContent, canvasDataUrl, onUpdateTask])

  // Auto-save bei Texteingabe
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (inputMode === 'type' && textAnswer.trim()) {
        saveAnswer()
      }
    }, 1000)
    return () => clearTimeout(timeout)
  }, [textAnswer, inputMode, saveAnswer])

  // Navigation
  const goToTask = (index: number) => {
    saveAnswer()
    setCurrentTaskIndex(index)
    setIsQuestionExpanded(true)
  }

  const goToPrev = () => {
    if (currentTaskIndex > 0) {
      saveAnswer()
      setCurrentTaskIndex(currentTaskIndex - 1)
      setIsQuestionExpanded(true)
    }
  }

  const goToNext = () => {
    if (currentTaskIndex < totalTasks - 1) {
      saveAnswer()
      setCurrentTaskIndex(currentTaskIndex + 1)
      setIsQuestionExpanded(true)
    }
  }

  // Markieren
  const toggleFlag = () => {
    if (!currentTask) return
    const newStatus: ExamTaskStatus = currentTask.examStatus === 'flagged' ? 
      (currentTask.userAnswer || currentTask.canvasDataUrl ? 'answered' : 'unanswered') : 
      'flagged'
    onUpdateTask(currentTask.id, { examStatus: newStatus })
  }

  // Löschen
  const handleClear = () => {
    if (inputMode === 'draw') {
      setClearCanvasTrigger((prev) => prev + 1)
      setHasCanvasContent(false)
      setCanvasDataUrl('')
      onUpdateTask(currentTask.id, { 
        canvasDataUrl: undefined, 
        examStatus: 'unanswered' 
      })
    } else {
      setTextAnswer('')
      onUpdateTask(currentTask.id, { 
        userAnswer: undefined, 
        examStatus: 'unanswered' 
      })
    }
  }

  // Timer formatieren
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Statistiken
  const answeredCount = session.tasks.filter(t => t.examStatus === 'answered').length
  const flaggedCount = session.tasks.filter(t => t.examStatus === 'flagged').length
  const unansweredCount = session.tasks.filter(t => t.examStatus === 'unanswered').length

  // Timer-Warnung wenn unter 5 Minuten
  const isTimeWarning = timeRemaining < 300

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Einfach'
      case 'medium': return 'Mittel'
      case 'hard': return 'Schwer'
      default: return difficulty
    }
  }

  const getTaskIcon = (task: ExamTask) => {
    switch (task.examStatus) {
      case 'answered':
        return <Check size={14} className="text-green-600" weight="bold" />
      case 'flagged':
        return <Flag size={14} className="text-yellow-600" weight="fill" />
      default:
        return <Question size={14} className="text-muted-foreground" />
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'hard':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (!currentTask) {
    return <div>Keine Aufgaben verfügbar</div>
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Formelsammlung-Panel (rechte Seite) */}
      {formulaSheets.length > 0 && (
        <FormulaSheetPanel formulaSheets={formulaSheets} />
      )}

      {/* Kompakter Header */}
      <div className="border-b bg-card/95 backdrop-blur-sm shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowExitDialog(true)}
                className="h-8 w-8"
              >
                <ArrowLeft size={16} />
              </Button>
              
              {/* Task Pills - Kompakt Desktop */}
              <div className="hidden sm:flex items-center gap-1">
                {session.tasks.map((task, index) => (
                  <button
                    key={task.id}
                    onClick={() => goToTask(index)}
                    className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium transition-all',
                      index === currentTaskIndex
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : task.examStatus === 'answered'
                        ? 'bg-green-500/15 text-green-600 hover:bg-green-500/25'
                        : task.examStatus === 'flagged'
                        ? 'bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              {/* Mobile: Aktuelle Aufgabe */}
              <div className="sm:hidden flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs h-6">
                  {currentTaskIndex + 1}/{totalTasks}
                </Badge>
              </div>
            </div>

            {/* Center: Timer */}
            <motion.div
              animate={isTimeWarning ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.5, repeat: isTimeWarning ? Infinity : 0 }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-sm font-semibold',
                isTimeWarning 
                  ? 'bg-red-500/10 text-red-600 ring-1 ring-red-500/20' 
                  : 'bg-muted/80'
              )}
            >
              <Clock size={14} weight={isTimeWarning ? 'fill' : 'regular'} />
              {formatTime(timeRemaining)}
            </motion.div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              {/* Status Badges - nur Desktop */}
              <div className="hidden lg:flex items-center gap-1 mr-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs h-6">
                  <Check size={10} className="mr-0.5" />{answeredCount}
                </Badge>
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 text-xs h-6">
                  <Flag size={10} className="mr-0.5" />{flaggedCount}
                </Badge>
              </div>

              {onPauseExam && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowPauseDialog(true)}
                  className="h-8"
                >
                  <Pause size={14} className="sm:mr-1.5" />
                  <span className="hidden sm:inline">Pausieren</span>
                </Button>
              )}
              
              <Button 
                onClick={() => setShowSubmitDialog(true)} 
                size="sm"
                className="h-8"
              >
                <PaperPlaneTilt size={14} className="sm:mr-1.5" />
                <span className="hidden sm:inline">Abgeben</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Task Pills */}
      <div className="sm:hidden border-b bg-card/50 px-2 py-1.5 overflow-x-auto">
        <div className="flex gap-1">
          {session.tasks.map((task, index) => (
            <button
              key={task.id}
              onClick={() => goToTask(index)}
              className={cn(
                'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all',
                index === currentTaskIndex
                  ? 'bg-primary text-primary-foreground'
                  : task.examStatus === 'answered'
                  ? 'bg-green-500/15 text-green-600'
                  : task.examStatus === 'flagged'
                  ? 'bg-yellow-500/15 text-yellow-600'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Komplett scrollbar */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4">
          {/* Aufgaben-Karte - Collapsible */}
          <Collapsible open={isQuestionExpanded} onOpenChange={setIsQuestionExpanded}>
            <Card className="mb-4 overflow-hidden">
              {/* Aufgaben-Header */}
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      Aufgabe {currentTaskIndex + 1}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs',
                        currentTask.difficulty === 'easy' && 'border-green-500/50 text-green-600 bg-green-500/5',
                        currentTask.difficulty === 'medium' && 'border-yellow-500/50 text-yellow-600 bg-yellow-500/5',
                        currentTask.difficulty === 'hard' && 'border-red-500/50 text-red-600 bg-red-500/5'
                      )}
                    >
                      {getDifficultyLabel(currentTask.difficulty)}
                    </Badge>
                    {currentTask.topic && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">{currentTask.topic}</span>
                    )}
                    {currentTask.points && (
                      <Badge variant="secondary" className="text-xs">
                        {currentTask.points} Pkt.
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={currentTask.examStatus === 'flagged' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFlag()
                      }}
                      className={cn(
                        'h-7 text-xs',
                        currentTask.examStatus === 'flagged' && 'bg-yellow-500 hover:bg-yellow-600'
                      )}
                    >
                      <Flag size={12} weight={currentTask.examStatus === 'flagged' ? 'fill' : 'regular'} className="mr-1" />
                      <span className="hidden sm:inline">Markieren</span>
                    </Button>
                    {isQuestionExpanded ? (
                      <CaretUp size={16} className="text-muted-foreground" />
                    ) : (
                      <CaretDown size={16} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              {/* Aufgaben-Inhalt */}
              <CollapsibleContent>
                <CardContent className="p-4 pt-3">
                  <div className="prose-container">
                    <MarkdownRenderer 
                      content={currentTask.question} 
                      className="scientific-content text-sm leading-relaxed"
                    />
                  </div>
                  {currentTask.attachments && currentTask.attachments.length > 0 && (
                    <div className="mt-4 pt-3 border-t">
                      <TaskAttachments attachments={currentTask.attachments} compact />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>

              {/* Collapsed Preview */}
              {!isQuestionExpanded && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {currentTask.question.substring(0, 150)}...
                  </p>
                </div>
              )}
            </Card>
          </Collapsible>

          {/* Antwort-Bereich */}
          <Card className="flex-1 flex flex-col min-h-[400px]">
            <CardContent className="p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-medium text-sm">Deine Antwort</h3>
                {/* Only show tabs if preference is 'draw' or not set */}
                {showInputModeTabs ? (
                  <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'draw' | 'type')}>
                    <TabsList className="h-8 p-0.5">
                      <TabsTrigger value="draw" className="text-xs h-7 px-3">
                        <PencilLine size={14} className="mr-1.5" />
                        Zeichnen
                      </TabsTrigger>
                      <TabsTrigger value="type" className="text-xs h-7 px-3">
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

              <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait">
                  {/* Only render canvas if inputMode is 'draw' AND preference allows drawing */}
                  {inputMode === 'draw' && showInputModeTabs ? (
                    <motion.div
                      key="draw"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <AdvancedDrawingCanvas
                        onContentChange={setHasCanvasContent}
                        clearTrigger={clearCanvasTrigger}
                      onCanvasDataUrl={(url) => {
                        setCanvasDataUrl(url)
                        if (url) {
                          onUpdateTask(currentTask.id, {
                            canvasDataUrl: url,
                            isHandwritten: true,
                            examStatus: 'answered',
                          })
                        }
                      }}
                      isMobile={true}
                      questionText={currentTask.question}
                      examMode={true}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="type"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <Textarea
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Schreibe deine Antwort hier..."
                      className="min-h-[250px] sm:min-h-[300px] h-full font-mono resize-none text-sm"
                    />
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClear}
                  className="text-muted-foreground"
                >
                  <Eraser size={14} className="mr-1.5" />
                  Löschen
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={goToPrev} 
                    disabled={currentTaskIndex === 0}
                  >
                    <ArrowLeft size={14} className="sm:mr-1" />
                    <span className="hidden sm:inline">Zurück</span>
                  </Button>
                  <Button 
                    size="sm"
                    onClick={goToNext} 
                    disabled={currentTaskIndex === totalTasks - 1}
                  >
                    <span className="hidden sm:inline">Weiter</span>
                    <ArrowRight size={14} className="sm:ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfung abgeben?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Möchtest du die Prüfung wirklich abgeben?</p>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Check size={16} className="text-green-600" />
                    <span>{answeredCount} beantwortet</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flag size={16} className="text-yellow-600" />
                    <span>{flaggedCount} markiert</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Question size={16} className="text-muted-foreground" />
                    <span>{unansweredCount} offen</span>
                  </div>
                </div>
                {unansweredCount > 0 && (
                  <div className="flex items-center gap-1.5 text-yellow-600 text-sm">
                    <Warning size={16} />
                    <span>Du hast noch {unansweredCount} unbeantwortete Aufgabe(n).</span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmitExam}>
              Endgültig abgeben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pause Dialog */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfung pausieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Prüfung wird gespeichert und du kannst sie später fortsetzen.
              Die verbleibende Zeit wird gespeichert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowPauseDialog(false)
              onPauseExam?.()
            }}>
              Pausieren & Speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfung verlassen?</AlertDialogTitle>
            <AlertDialogDescription>
              {onPauseExam 
                ? 'Möchtest du die Prüfung pausieren oder abbrechen?'
                : 'Wenn du die Prüfung jetzt verlässt, gehen alle Antworten verloren.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            {onPauseExam && (
              <Button variant="outline" onClick={() => {
                setShowExitDialog(false)
                onPauseExam()
              }}>
                <Pause size={14} className="mr-1.5" />
                Pausieren
              </Button>
            )}
            <AlertDialogAction 
              onClick={onExit} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
