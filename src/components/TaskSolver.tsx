import { useState } from 'react'
import { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { RateLimitIndicator } from './RateLimitIndicator'
import { DebugModeToggle } from './DebugModeToggle'
import {
  X,
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Eraser,
  Keyboard,
  PencilLine,
  Info,
  ArrowLeft,
  List,
} from '@phosphor-icons/react'
import { AdvancedDrawingCanvas } from './AdvancedDrawingCanvas'
import { motion, AnimatePresence } from 'framer-motion'

interface TaskSolverProps {
  task: Task
  onClose: () => void
  onSubmit: (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => Promise<void>
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <div className="border-b bg-card shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="h-8 w-8 sm:h-10 sm:w-10 shrink-0"
            >
              <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
            </Button>
            <Badge variant="outline" className={`${getDifficultyColor(task.difficulty)} text-xs shrink-0`}>
              {getDifficultyLabel(task.difficulty)}
            </Badge>
            <h2 className="font-semibold text-sm sm:text-base truncate">Aufgabe lösen</h2>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <DebugModeToggle />
              <RateLimitIndicator />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden">
                  <List size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Optionen</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Debug-Modus</p>
                    <DebugModeToggle />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">API-Status</p>
                    <RateLimitIndicator />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex">
              <X size={18} className="sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div>
              <h3 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Fragestellung</h3>
              <Card className="p-4 sm:p-6">
                <p className="leading-relaxed whitespace-pre-wrap text-sm sm:text-base">{task.question}</p>
              </Card>

              <AnimatePresence mode="wait">
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-4 sm:mt-6 space-y-3 sm:space-y-4"
                  >
                    {feedback.transcription && (
                      <Alert className="text-sm">
                        <Info size={16} className="sm:w-[18px] sm:h-[18px]" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="font-medium">KI-Transkription deiner Handschrift:</p>
                            <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-xs sm:text-sm font-mono overflow-x-auto">
                              {feedback.transcription}
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {feedback.isCorrect ? (
                      <Card className="p-4 sm:p-6 bg-accent/10 border-accent/20">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <CheckCircle size={20} className="text-accent mt-0.5 shrink-0 sm:w-6 sm:h-6" weight="fill" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-accent mb-2 text-sm sm:text-base">Richtig!</h4>
                            <p className="text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4">
                              Sehr gut! Deine Lösung ist korrekt.
                            </p>
                            {onNextTask && (
                              <Button onClick={onNextTask} className="bg-accent hover:bg-accent/90 w-full sm:w-auto text-sm">
                                <ArrowRight size={16} className="mr-2 sm:w-[18px] sm:h-[18px]" />
                                Nächste Aufgabe
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-4 sm:p-6 bg-warning/10 border-warning/20">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Lightbulb
                            size={20}
                            className="text-warning-foreground mt-0.5 shrink-0 sm:w-6 sm:h-6"
                            weight="fill"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold mb-2 text-sm sm:text-base">Noch nicht ganz richtig</h4>
                            {feedback.hints && feedback.hints.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs sm:text-sm font-medium">Hinweise:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
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
                              className="mt-3 sm:mt-4 w-full sm:w-auto text-xs sm:text-sm"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
                <h3 className="font-medium text-sm sm:text-base">Deine Lösung</h3>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'draw' | 'type')} className="w-full sm:w-auto">
                  <TabsList className="w-full sm:w-auto grid grid-cols-2">
                    <TabsTrigger value="draw" className="text-xs sm:text-sm">
                      <PencilLine size={14} className="mr-1.5 sm:mr-2 sm:w-4 sm:h-4" />
                      Zeichnen
                    </TabsTrigger>
                    <TabsTrigger value="type" className="text-xs sm:text-sm">
                      <Keyboard size={14} className="mr-1.5 sm:mr-2 sm:w-4 sm:h-4" />
                      Tippen
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 mb-4 relative">
                {inputMode === 'draw' ? (
                  <div className="relative">
                    <AdvancedDrawingCanvas
                      onContentChange={setHasCanvasContent}
                      clearTrigger={clearCanvasTrigger}
                      onCanvasDataUrl={setCanvasDataUrl}
                      isMobile={true}
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
                    className="min-h-[300px] sm:min-h-[400px] font-mono resize-none text-sm sm:text-base"
                    disabled={isSubmitting}
                  />
                )}
              </div>

              <div className="flex gap-2 sm:gap-3 pb-4 sm:pb-0">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="flex-1 text-xs sm:text-sm h-10 sm:h-auto"
                  disabled={!canSubmit || isSubmitting}
                >
                  <Eraser size={16} className="mr-1.5 sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Löschen</span>
                  <span className="sm:hidden">Löschen</span>
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || feedback?.isCorrect || isSubmitting}
                  className="flex-1 text-xs sm:text-sm h-10 sm:h-auto"
                >
                  {isSubmitting ? 'Prüfe...' : 'Einreichen'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
