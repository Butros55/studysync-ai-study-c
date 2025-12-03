import { useState } from 'react'
import { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  X,
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Eraser,
  Keyboard,
  PencilLine,
} from '@phosphor-icons/react'
import { DrawingCanvas } from './DrawingCanvas'
import { motion, AnimatePresence } from 'framer-motion'

interface TaskSolverProps {
  task: Task
  onClose: () => void
  onSubmit: (answer: string, isHandwritten: boolean) => void
  feedback?: {
    isCorrect: boolean
    hints?: string[]
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

  const handleSubmit = () => {
    if (inputMode === 'type' && textAnswer.trim()) {
      onSubmit(textAnswer.trim(), false)
    } else if (inputMode === 'draw' && hasCanvasContent) {
      onSubmit('handwritten-solution', true)
    }
  }

  const handleClear = () => {
    if (inputMode === 'draw') {
      setClearCanvasTrigger((prev) => prev + 1)
      setHasCanvasContent(false)
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

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className={getDifficultyColor(task.difficulty)}>
              {task.difficulty}
            </Badge>
            <h2 className="font-semibold">Solve Task</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-4">Question</h3>
              <Card className="p-6">
                <p className="leading-relaxed">{task.question}</p>
              </Card>

              <AnimatePresence mode="wait">
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-6"
                  >
                    {feedback.isCorrect ? (
                      <Card className="p-6 bg-accent/10 border-accent/20">
                        <div className="flex items-start gap-3">
                          <CheckCircle size={24} className="text-accent mt-0.5" weight="fill" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-accent mb-2">Correct!</h4>
                            <p className="text-sm leading-relaxed mb-4">
                              Great job! Your solution is correct.
                            </p>
                            {onNextTask && (
                              <Button onClick={onNextTask} className="bg-accent hover:bg-accent/90">
                                <ArrowRight size={18} className="mr-2" />
                                Next Task
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-6 bg-warning/10 border-warning/20">
                        <div className="flex items-start gap-3">
                          <Lightbulb size={24} className="text-warning-foreground mt-0.5" weight="fill" />
                          <div className="flex-1">
                            <h4 className="font-semibold mb-2">Not quite right</h4>
                            {feedback.hints && feedback.hints.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Hints:</p>
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
                              Try Again
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Your Solution</h3>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'draw' | 'type')}>
                  <TabsList>
                    <TabsTrigger value="draw">
                      <PencilLine size={16} className="mr-2" />
                      Draw
                    </TabsTrigger>
                    <TabsTrigger value="type">
                      <Keyboard size={16} className="mr-2" />
                      Type
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {inputMode === 'draw' ? (
                <div className="h-[500px] mb-4">
                  <DrawingCanvas
                    onContentChange={setHasCanvasContent}
                    clearTrigger={clearCanvasTrigger}
                  />
                </div>
              ) : (
                <Textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Type your solution here..."
                  className="h-[500px] mb-4 font-mono"
                />
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="flex-1"
                  disabled={!canSubmit}
                >
                  <Eraser size={18} className="mr-2" />
                  Clear
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || feedback?.isCorrect}
                  className="flex-1"
                >
                  Submit Solution
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
