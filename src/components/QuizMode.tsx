import { useState, useEffect } from 'react'
import { Task, Module } from '@/lib/types'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { ArrowLeft, CheckCircle, XCircle, Sparkle, Trophy, Target } from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { cn } from '@/lib/utils'

interface QuizModeProps {
  tasks: Task[]
  modules: Module[]
  onClose: () => void
  onSubmit: (
    task: Task,
    answer: string,
    isHandwritten: boolean,
    canvasDataUrl?: string
  ) => Promise<void>
  feedback?: {
    isCorrect: boolean
    hints?: string[]
    transcription?: string
  }
}

export function QuizMode({
  tasks,
  modules,
  onClose,
  onSubmit,
  feedback,
}: QuizModeProps) {
  const [quizTasks, setQuizTasks] = useState<Task[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, { isCorrect: boolean }>>(new Map())
  const [textAnswer, setTextAnswer] = useState('')
  const [isHandwritten, setIsHandwritten] = useState(false)
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [clearTrigger, setClearTrigger] = useState(0)

  useEffect(() => {
    const shuffled = [...tasks].sort(() => Math.random() - 0.5)
    setQuizTasks(shuffled.slice(0, Math.min(10, shuffled.length)))
  }, [tasks])

  const currentTask = quizTasks[currentIndex]
  const progress = (currentIndex / quizTasks.length) * 100
  const correctCount = Array.from(answers.values()).filter((a) => a.isCorrect).length

  const getModuleName = (moduleId: string) => {
    return modules.find((m) => m.id === moduleId)?.name || 'Unbekannt'
  }

  const getModuleColor = (moduleId: string) => {
    return modules.find((m) => m.id === moduleId)?.color || '#888888'
  }

  const handleSubmit = async () => {
    if (!currentTask) return
    if (!textAnswer.trim() && !canvasDataUrl) return

    setIsSubmitting(true)
    setShowFeedback(false)

    try {
      await onSubmit(currentTask, textAnswer, isHandwritten, canvasDataUrl)
      setShowFeedback(true)
    } catch (error) {
      console.error('Fehler beim Einreichen der Antwort:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (feedback && currentTask) {
      setAnswers(new Map(answers.set(currentTask.id, { isCorrect: feedback.isCorrect })))
    }

    if (currentIndex < quizTasks.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setTextAnswer('')
      setCanvasDataUrl(undefined)
      setShowFeedback(false)
      setHasDrawing(false)
      setClearTrigger(prev => prev + 1)
    }
  }

  const handleFinish = () => {
    if (feedback && currentTask) {
      setAnswers(new Map(answers.set(currentTask.id, { isCorrect: feedback.isCorrect })))
    }
    onClose()
  }

  if (quizTasks.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Target size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">Keine Aufgaben verfügbar</h2>
          <p className="text-muted-foreground mb-6">
            Es gibt aktuell keine Aufgaben für das Quiz.
          </p>
          <Button onClick={onClose}>Zurück</Button>
        </Card>
      </div>
    )
  }

  if (currentIndex >= quizTasks.length) {
    const score = (correctCount / quizTasks.length) * 100

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-2xl w-full">
          <div className="text-center">
            <Trophy size={64} className="mx-auto mb-4 text-accent" />
            <h2 className="text-3xl font-bold mb-2">Quiz abgeschlossen!</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Du hast {correctCount} von {quizTasks.length} Aufgaben richtig beantwortet
            </p>

            <div className="mb-8">
              <div className="text-6xl font-bold mb-2" style={{ color: score >= 70 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171' }}>
                {score.toFixed(0)}%
              </div>
              <Progress value={score} className="h-3" />
            </div>

            <div className="grid grid-cols-1 gap-3 mb-8">
              {quizTasks.map((task, idx) => {
                const answer = answers.get(task.id)
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'p-4 rounded-lg border-2 flex items-center gap-3',
                      answer?.isCorrect
                        ? 'border-accent bg-accent/5'
                        : 'border-destructive bg-destructive/5'
                    )}
                  >
                    {answer?.isCorrect ? (
                      <CheckCircle size={24} className="text-accent flex-shrink-0" />
                    ) : (
                      <XCircle size={24} className="text-destructive flex-shrink-0" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Aufgabe {idx + 1}</div>
                      <div className="text-xs text-muted-foreground">
                        {getModuleName(task.moduleId)}
                      </div>
                    </div>
                    <Badge variant={task.difficulty === 'easy' ? 'secondary' : task.difficulty === 'medium' ? 'default' : 'destructive'}>
                      {task.difficulty === 'easy' ? 'Leicht' : task.difficulty === 'medium' ? 'Mittel' : 'Schwer'}
                    </Badge>
                  </div>
                )
              })}
            </div>

            <Button onClick={onClose} size="lg" className="w-full">
              Zurück zur Übersicht
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Beenden</span>
            </Button>
            <div className="flex items-center gap-2">
              <Sparkle size={20} className="text-primary" />
              <span className="font-semibold text-sm sm:text-base">Quiz-Modus</span>
            </div>
            <div className="text-sm font-medium">
              {currentIndex + 1} / {quizTasks.length}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-safe">
          {currentTask && (
            <div className="space-y-4 sm:space-y-6">
              <Card className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge
                    style={{
                      backgroundColor: getModuleColor(currentTask.moduleId) + '20',
                      color: getModuleColor(currentTask.moduleId),
                      borderColor: getModuleColor(currentTask.moduleId),
                    }}
                    className="border"
                  >
                    {getModuleName(currentTask.moduleId)}
                  </Badge>
                  <Badge
                    variant={
                      currentTask.difficulty === 'easy'
                        ? 'secondary'
                        : currentTask.difficulty === 'medium'
                        ? 'default'
                        : 'destructive'
                    }
                  >
                    {currentTask.difficulty === 'easy'
                      ? 'Leicht'
                      : currentTask.difficulty === 'medium'
                      ? 'Mittel'
                      : 'Schwer'}
                  </Badge>
                </div>

                <h2 className="text-lg sm:text-xl font-semibold mb-4">Aufgabe {currentIndex + 1}</h2>
                <div className="prose prose-sm sm:prose max-w-none">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">{currentTask.question}</p>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base sm:text-lg">Deine Antwort</h3>
                  <div className="flex gap-2">
                    <Button
                      variant={!isHandwritten ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsHandwritten(false)}
                      disabled={isSubmitting}
                    >
                      Text
                    </Button>
                    <Button
                      variant={isHandwritten ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsHandwritten(true)}
                      disabled={isSubmitting}
                    >
                      Zeichnen
                    </Button>
                  </div>
                </div>

                {!isHandwritten ? (
                  <Textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Gib hier deine Antwort ein..."
                    className="min-h-[200px] text-sm sm:text-base"
                    disabled={isSubmitting}
                  />
                ) : (
                  <div className={cn('relative', isSubmitting && 'opacity-50 pointer-events-none')}>
                    <AdvancedDrawingCanvas
                      onContentChange={setHasDrawing}
                      clearTrigger={clearTrigger}
                      onCanvasDataUrl={setCanvasDataUrl}
                      questionText={currentTask?.question}
                      onSubmit={handleSubmit}
                      submitDisabled={!hasDrawing || (showFeedback && feedback?.isCorrect)}
                      isSubmitting={isSubmitting}
                    />
                  </div>
                )}
              </Card>

              {showFeedback && feedback && (
                <Card className={cn(
                  'p-4 sm:p-6 border-2',
                  feedback.isCorrect ? 'border-accent bg-accent/5' : 'border-destructive bg-destructive/5'
                )}>
                  <div className="flex items-start gap-3">
                    {feedback.isCorrect ? (
                      <CheckCircle size={24} className="text-accent flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle size={24} className="text-destructive flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">
                        {feedback.isCorrect ? 'Richtig!' : 'Nicht ganz richtig'}
                      </h3>
                      
                      {feedback.transcription && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Erkannte Handschrift:</p>
                          <div className="bg-muted/50 rounded p-3 text-sm">
                            {feedback.transcription}
                          </div>
                        </div>
                      )}

                      {!feedback.isCorrect && feedback.hints && feedback.hints.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Hinweise:</p>
                          <ul className="space-y-1 text-sm">
                            {feedback.hints.map((hint, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-muted-foreground">•</span>
                                <span>{hint}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex gap-3">
                {!showFeedback ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={(!textAnswer.trim() && !canvasDataUrl) || isSubmitting}
                    className="flex-1"
                    size="lg"
                  >
                    {isSubmitting ? 'Wird überprüft...' : 'Antwort einreichen'}
                  </Button>
                ) : (
                  <>
                    {currentIndex < quizTasks.length - 1 ? (
                      <Button onClick={handleNext} className="flex-1" size="lg">
                        Nächste Aufgabe
                      </Button>
                    ) : (
                      <Button onClick={handleFinish} className="flex-1" size="lg">
                        Quiz beenden
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
