import { useState, useEffect, useCallback } from 'react'
import { ExamSession, ExamTask, ExamTaskStatus } from '@/lib/types'
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
} from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { MarkdownRenderer } from './MarkdownRenderer'
import { TaskAttachments } from './TaskAttachments'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ExamSessionScreenProps {
  session: ExamSession
  onUpdateTask: (taskId: string, updates: Partial<ExamTask>) => void
  onSubmitExam: () => void
  onExit: () => void
}

export function ExamSessionScreen({
  session,
  onUpdateTask,
  onSubmitExam,
  onExit,
}: ExamSessionScreenProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [inputMode, setInputMode] = useState<'draw' | 'type'>('draw')
  const [textAnswer, setTextAnswer] = useState('')
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [hasCanvasContent, setHasCanvasContent] = useState(false)
  const [canvasDataUrl, setCanvasDataUrl] = useState('')
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(session.duration * 60) // in Sekunden

  const currentTask = session.tasks[currentTaskIndex]
  const totalTasks = session.tasks.length

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
  }

  const goToPrev = () => {
    if (currentTaskIndex > 0) {
      saveAnswer()
      setCurrentTaskIndex(currentTaskIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentTaskIndex < totalTasks - 1) {
      saveAnswer()
      setCurrentTaskIndex(currentTaskIndex + 1)
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
  const isTimeWarning = timeRemaining < 300 // 5 Minuten

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
      {/* Header mit Timer */}
      <div className="border-b bg-card shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Exit & Info */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setShowExitDialog(true)}>
                <ArrowLeft size={18} />
              </Button>
              <div className="hidden sm:block">
                <p className="font-medium text-sm">Prüfungsmodus</p>
                <p className="text-xs text-muted-foreground">
                  {answeredCount}/{totalTasks} beantwortet
                </p>
              </div>
            </div>

            {/* Center: Timer */}
            <motion.div
              animate={isTimeWarning ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5, repeat: isTimeWarning ? Infinity : 0 }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold',
                isTimeWarning ? 'bg-red-500/10 text-red-600' : 'bg-muted'
              )}
            >
              <Clock size={20} weight={isTimeWarning ? 'fill' : 'regular'} />
              {formatTime(timeRemaining)}
            </motion.div>

            {/* Right: Submit */}
            <Button onClick={() => setShowSubmitDialog(true)} variant="default">
              <PaperPlaneTilt size={18} className="mr-2" />
              <span className="hidden sm:inline">Prüfung abgeben</span>
              <span className="sm:hidden">Abgeben</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task Navigation Sidebar */}
        <div className="hidden md:flex w-64 border-r bg-card flex-col">
          <div className="p-4 border-b">
            <h3 className="font-medium text-sm mb-2">Aufgaben</h3>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                <Check size={12} className="mr-1" />
                {answeredCount}
              </Badge>
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                <Flag size={12} className="mr-1" />
                {flaggedCount}
              </Badge>
              <Badge variant="secondary" className="bg-muted">
                <Question size={12} className="mr-1" />
                {unansweredCount}
              </Badge>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {session.tasks.map((task, index) => (
                <button
                  key={task.id}
                  onClick={() => goToTask(index)}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors',
                    index === currentTaskIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-xs font-medium',
                    index === currentTaskIndex ? 'bg-primary-foreground/20' : 'bg-muted'
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1 truncate">
                    {task.topic || `Aufgabe ${index + 1}`}
                  </div>
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    getDifficultyColor(task.difficulty)
                  )} />
                  {index !== currentTaskIndex && getTaskIcon(task)}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Task Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Task Navigation */}
          <div className="md:hidden border-b p-2">
            <ScrollArea className="w-full">
              <div className="flex gap-1 pb-2">
                {session.tasks.map((task, index) => (
                  <button
                    key={task.id}
                    onClick={() => goToTask(index)}
                    className={cn(
                      'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors relative',
                      index === currentTaskIndex
                        ? 'bg-primary text-primary-foreground'
                        : task.examStatus === 'answered'
                        ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                        : task.examStatus === 'flagged'
                        ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/30'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {index + 1}
                    {task.examStatus === 'flagged' && index !== currentTaskIndex && (
                      <Flag size={10} className="absolute -top-1 -right-1 text-yellow-600" weight="fill" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Task Question */}
          <div className="p-4 border-b bg-muted/30">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Aufgabe {currentTaskIndex + 1} / {totalTasks}
                  </Badge>
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    getDifficultyColor(currentTask.difficulty)
                  )} />
                  {currentTask.points && (
                    <span className="text-xs text-muted-foreground">
                      {currentTask.points} Punkte
                    </span>
                  )}
                </div>
                <Button
                  variant={currentTask.examStatus === 'flagged' ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleFlag}
                  className={currentTask.examStatus === 'flagged' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                >
                  <Flag size={14} className="mr-1" weight={currentTask.examStatus === 'flagged' ? 'fill' : 'regular'} />
                  Markieren
                </Button>
              </div>
              <Card className="bg-card">
                <CardContent className="p-4">
                  <MarkdownRenderer content={currentTask.question} />
                </CardContent>
              </Card>
              {currentTask.attachments && currentTask.attachments.length > 0 && (
                <div className="mt-3">
                  <TaskAttachments attachments={currentTask.attachments} compact />
                </div>
              )}
            </div>
          </div>

          {/* Answer Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-medium text-sm">Deine Antwort</h3>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'draw' | 'type')}>
                  <TabsList className="h-8">
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
              </div>

              <AnimatePresence mode="wait">
                {inputMode === 'draw' ? (
                  <motion.div
                    key="draw"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
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
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Textarea
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Schreibe deine Antwort hier..."
                      className="min-h-[300px] font-mono resize-none text-sm"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleClear} className="flex-1">
                  <Eraser size={16} className="mr-2" />
                  Löschen
                </Button>
                <Button variant="outline" onClick={goToPrev} disabled={currentTaskIndex === 0}>
                  <ArrowLeft size={16} className="mr-2" />
                  Zurück
                </Button>
                <Button onClick={goToNext} disabled={currentTaskIndex === totalTasks - 1}>
                  Weiter
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfung abgeben?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Möchtest du die Prüfung wirklich abgeben?</p>
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1">
                  <Check size={16} className="text-green-600" />
                  <span>{answeredCount} beantwortet</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flag size={16} className="text-yellow-600" />
                  <span>{flaggedCount} markiert</span>
                </div>
                <div className="flex items-center gap-1">
                  <Question size={16} className="text-muted-foreground" />
                  <span>{unansweredCount} offen</span>
                </div>
              </div>
              {unansweredCount > 0 && (
                <p className="text-yellow-600 flex items-center gap-1 mt-2">
                  <Warning size={16} />
                  Du hast noch {unansweredCount} unbeantwortete Aufgabe(n).
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück zur Prüfung</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmitExam}>
              Endgültig abgeben
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
              Wenn du die Prüfung jetzt verlässt, gehen alle Antworten verloren.
              Die Prüfung wird nicht gewertet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück zur Prüfung</AlertDialogCancel>
            <AlertDialogAction onClick={onExit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Prüfung abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
