import { useState } from 'react'
import { Task, TaskFeedback } from '@/lib/types'
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
import {
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Eraser,
  Keyboard,
  PencilLine,
  Info,
  ArrowLeft,
} from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { motion, AnimatePresence } from 'framer-motion'

interface TaskSolverProps {
  task: Task
  onClose: () => void
  onSubmit: (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => Promise<void>
  feedback?: TaskFeedback
  onNextTask?: () => void
  onTaskUpdate?: (updates: Partial<Task>) => void
}

export function TaskSolver({
  task,
  onClose,
  onSubmit,
  feedback,
  onNextTask,
  onTaskUpdate,
}: TaskSolverProps) {
  const [inputMode, setInputMode] = useState<'draw' | 'type'>('draw')
  const [textAnswer, setTextAnswer] = useState('')
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [hasCanvasContent, setHasCanvasContent] = useState(false)
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <DebugModeToggle />
          </div>
        </div>
      </div>

      {/* Collapsible Question Panel */}
      <TaskQuestionPanel task={task} isFullscreen={true} defaultExpanded={!feedback} />

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
              </div>

              <div className="flex-1 mb-3 relative">
                {inputMode === 'draw' ? (
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

            {/* Musterlösung anzeigen - sowohl im Zeichnen- als auch Tippen-Modus verfügbar */}
            {task.solution && (
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
