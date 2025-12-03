import { useState } from 'react'
import { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  X,
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Eraser,
  Keyboard,
  PencilLine,
  Info,
} from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { motion, AnimatePresence } from 'framer-motion'

interface TaskSolverProps {
  task: Task
  onClose: () => void
  onSubmit: (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => void
  feedback?: {
    isCorrect: boolean
    hints?: string[]
    transcription?: string
  }
  onNextTask?: () => void
}

export function TaskSolver({
  task,
  onClose,
  onSubmit,
  feedback,
  onNextTask,
}: TaskSolverProps) {
  const [inputMode, setInputMode] = useState<'draw' | 'type'>('draw')
  const [textAnswer, setTextAnswer] = useState('')
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [hasCanvasContent, setHasCanvasContent] = useState(false)
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>('')

  const handleSubmit = () => {
    if (inputMode === 'type' && textAnswer.trim()) {
      onSubmit(textAnswer.trim(), false)
    } else if (inputMode === 'draw' && hasCanvasContent && canvasDataUrl) {
      onSubmit('handwritten-solution', true, canvasDataUrl)
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

  const getDifficultyColor = (difficulty: Task['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-accent/10 text-accent border-accent/20'
      case 'medium':
        return 'bg-warning/10 text-warning-foreground border-warning/20'
      case 'hard':
        return 'bg-destructive/10 text-destructive border-destructive/20'
    }
  }

  const getDifficultyLabel = (difficulty: Task['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return 'Einfach'
      case 'medium':
        return 'Mittel'
      case 'hard':
        return 'Schwer'
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className={getDifficultyColor(task.difficulty)}>
              {getDifficultyLabel(task.difficulty)}
            </Badge>
            <h2 className="font-semibold">Aufgabe lösen</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="font-medium mb-4">Fragestellung</h3>
              <Card className="p-6">
                <p className="leading-relaxed whitespace-pre-wrap">{task.question}</p>
              </Card>

              <AnimatePresence mode="wait">
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-6 space-y-4"
                  >
                    {feedback.transcription && (
                      <Alert>
                        <Info size={18} />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="font-medium">KI-Transkription deiner Handschrift:</p>
                            <div className="bg-muted/50 p-3 rounded-md text-sm font-mono">
                              {feedback.transcription}
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {feedback.isCorrect ? (
                      <Card className="p-6 bg-accent/10 border-accent/20">
                        <div className="flex items-start gap-3">
                          <CheckCircle size={24} className="text-accent mt-0.5" weight="fill" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-accent mb-2">Richtig!</h4>
                            <p className="text-sm leading-relaxed mb-4">
                              Sehr gut! Deine Lösung ist korrekt.
                            </p>
                            {onNextTask && (
                              <Button onClick={onNextTask} className="bg-accent hover:bg-accent/90">
                                <ArrowRight size={18} className="mr-2" />
                                Nächste Aufgabe
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-6 bg-warning/10 border-warning/20">
                        <div className="flex items-start gap-3">
                          <Lightbulb
                            size={24}
                            className="text-warning-foreground mt-0.5"
                            weight="fill"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold mb-2">Noch nicht ganz richtig</h4>
                            {feedback.hints && feedback.hints.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Hinweise:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                  {feedback.hints.map((hint, idx) => (
                                    <li key={idx}>{hint}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <Button
                              onClick={handleClear}
                              variant="outline"
                              size="sm"
                              className="mt-4"
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
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Deine Lösung</h3>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'draw' | 'type')}>
                  <TabsList>
                    <TabsTrigger value="draw">
                      <PencilLine size={16} className="mr-2" />
                      Zeichnen
                    </TabsTrigger>
                    <TabsTrigger value="type">
                      <Keyboard size={16} className="mr-2" />
                      Tippen
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 mb-4">
                {inputMode === 'draw' ? (
                  <AdvancedDrawingCanvas
                    onContentChange={setHasCanvasContent}
                    clearTrigger={clearCanvasTrigger}
                    onCanvasDataUrl={setCanvasDataUrl}
                  />
                ) : (
                  <Textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Schreibe deine Lösung hier..."
                    className="min-h-[400px] font-mono resize-none"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="flex-1"
                  disabled={!canSubmit}
                >
                  <Eraser size={18} className="mr-2" />
                  Löschen
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || feedback?.isCorrect}
                  className="flex-1"
                >
                  Lösung einreichen
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
