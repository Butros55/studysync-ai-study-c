/**
 * FullscreenBottomPanel - Sticky Panel im Fullscreen-Canvas-Modus
 * 
 * Zeigt im Vollbildmodus alle relevanten Informationen in einem
 * ausklappbaren Panel am unteren Bildschirmrand:
 * - Transkription (KI-erkannte Handschrift)
 * - Hinweise (bei falscher Antwort)
 * - Musterlösung (mit Warnung)
 */

import { useState, useCallback } from 'react'
import { TaskFeedback, Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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
  CaretUp,
  CaretDown,
  TextT,
  Lightbulb,
  BookOpen,
  CheckCircle,
  Warning,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

interface FullscreenBottomPanelProps {
  feedback: TaskFeedback | null
  task: Task
  onViewSolution?: () => void
  onTaskUpdate?: (updates: Partial<Task>) => void
}

export function FullscreenBottomPanel({
  feedback,
  task,
  onViewSolution,
  onTaskUpdate,
}: FullscreenBottomPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('transcription')
  const [showSolutionWarning, setShowSolutionWarning] = useState(false)
  const [solutionVisible, setSolutionVisible] = useState(false)

  // Zähle verfügbare Tabs für Badges
  const hasTranscription = !!feedback?.transcription
  const hasHints = feedback?.hints && feedback.hints.length > 0
  const hasSolution = !!task.solution || !!task.solutionMarkdown
  const isCorrect = feedback?.isCorrect

  // Handler für Lösung anzeigen - mit Warnung wenn noch nicht angesehen
  const handleShowSolution = useCallback(() => {
    if (!task.viewedSolution && !isCorrect) {
      // Warnung zeigen
      setShowSolutionWarning(true)
    } else {
      // Direkt anzeigen
      setSolutionVisible(true)
    }
  }, [task.viewedSolution, isCorrect])

  // Bestätigung der Warnung
  const handleConfirmViewSolution = useCallback(() => {
    setShowSolutionWarning(false)
    setSolutionVisible(true)
    // Task als "Lösung angesehen" markieren
    if (onTaskUpdate) {
      onTaskUpdate({ viewedSolution: true })
    }
    if (onViewSolution) {
      onViewSolution()
    }
  }, [onTaskUpdate, onViewSolution])

  // Toggle für Lösung
  const toggleSolutionVisibility = useCallback(() => {
    if (solutionVisible) {
      setSolutionVisible(false)
    } else {
      handleShowSolution()
    }
  }, [solutionVisible, handleShowSolution])

  // Automatisch Panel öffnen wenn Feedback kommt
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (!isExpanded) {
      setIsExpanded(true)
    }
  }

  return (
    <>
      {/* Bottom Panel */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        style={{ touchAction: 'none' }} // Verhindert Canvas-Interaktion
      >
        {/* Toggle Button / Status Bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Status Badge */}
            {feedback ? (
              isCorrect ? (
                <Badge variant="default" className="bg-green-600 gap-1">
                  <CheckCircle size={14} weight="fill" />
                  Richtig
                </Badge>
              ) : (
                <Badge variant="default" className="bg-yellow-600 gap-1">
                  <Warning size={14} weight="fill" />
                  Hinweise verfügbar
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="gap-1">
                Feedback-Panel
              </Badge>
            )}

            {/* Tab Indicators */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasTranscription && (
                <span className="flex items-center gap-1">
                  <TextT size={12} />
                  Transkription
                </span>
              )}
              {hasHints && (
                <span className="flex items-center gap-1">
                  <Lightbulb size={12} />
                  {feedback?.hints?.length} Hinweise
                </span>
              )}
              {hasSolution && (
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  Lösung
                  {task.viewedSolution && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1">
                      angesehen
                    </Badge>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Expand/Collapse Icon */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isExpanded ? 'Einklappen' : 'Ausklappen'}
            </span>
            {isExpanded ? <CaretDown size={18} /> : <CaretUp size={18} />}
          </div>
        </button>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[40vh] overflow-y-auto">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <div className="px-4 border-b">
                    <TabsList className="h-9">
                      <TabsTrigger
                        value="transcription"
                        disabled={!hasTranscription}
                        className="text-xs gap-1.5"
                      >
                        <TextT size={14} />
                        Transkription
                      </TabsTrigger>
                      <TabsTrigger
                        value="hints"
                        disabled={!hasHints}
                        className="text-xs gap-1.5"
                      >
                        <Lightbulb size={14} />
                        Hinweise
                        {hasHints && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-1">
                            {feedback?.hints?.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="solution"
                        disabled={!hasSolution}
                        className="text-xs gap-1.5"
                      >
                        <BookOpen size={14} />
                        Musterlösung
                        {task.viewedSolution && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 ml-1 text-yellow-600">
                            ⚠️
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Transkription Tab */}
                  <TabsContent value="transcription" className="p-4 m-0">
                    {hasTranscription ? (
                      <Card className="p-3 bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <TextT size={16} weight="bold" className="text-muted-foreground" />
                          <span className="text-sm font-medium">KI-erkannte Handschrift:</span>
                        </div>
                        <pre className="text-sm font-mono bg-background/50 p-3 rounded-md whitespace-pre-wrap overflow-x-auto">
                          {feedback?.transcription}
                        </pre>
                      </Card>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Noch keine Transkription verfügbar. Reiche deine Lösung ein.
                      </p>
                    )}
                  </TabsContent>

                  {/* Hinweise Tab */}
                  <TabsContent value="hints" className="p-4 m-0">
                    {hasHints ? (
                      <Card className="p-3 bg-yellow-500/5 border-yellow-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb size={16} weight="fill" className="text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                            Verbesserungshinweise:
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {feedback?.hints?.map((hint, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-yellow-600 font-medium shrink-0">{idx + 1}.</span>
                              <MarkdownRenderer content={hint} compact inline className="prose-p:my-0" />
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Keine Hinweise verfügbar.
                      </p>
                    )}
                  </TabsContent>

                  {/* Musterlösung Tab */}
                  <TabsContent value="solution" className="p-4 m-0">
                    {hasSolution ? (
                      <div className="space-y-3">
                        {/* Warnung wenn Lösung angesehen */}
                        {task.viewedSolution && (
                          <Card className="p-3 bg-yellow-500/10 border-yellow-500/30">
                            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                              <Warning size={16} weight="fill" />
                              <span className="text-sm">
                                Diese Aufgabe wurde als "nicht selbstständig gelöst" markiert.
                              </span>
                            </div>
                          </Card>
                        )}

                        {/* Toggle Button */}
                        <Button
                          onClick={toggleSolutionVisibility}
                          variant={solutionVisible ? 'secondary' : 'default'}
                          size="sm"
                          className="gap-2"
                        >
                          {solutionVisible ? (
                            <>
                              <EyeSlash size={16} />
                              Lösung verbergen
                            </>
                          ) : (
                            <>
                              <Eye size={16} />
                              Lösung anzeigen
                            </>
                          )}
                        </Button>

                        {/* Lösung Content */}
                        <AnimatePresence>
                          {solutionVisible && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <Card className="p-4 bg-green-500/5 border-green-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                  <BookOpen size={16} weight="fill" className="text-green-600" />
                                  <span className="text-sm font-medium text-green-700 dark:text-green-500">
                                    Musterlösung:
                                  </span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  {task.solutionMarkdown ? (
                                    <MarkdownRenderer content={task.solutionMarkdown} />
                                  ) : (
                                    <p>{task.solution}</p>
                                  )}
                                </div>
                              </Card>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Keine Musterlösung verfügbar.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Warndialog für Lösung anzeigen */}
      <AlertDialog open={showSolutionWarning} onOpenChange={setShowSolutionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning size={20} className="text-yellow-600" weight="fill" />
              Musterlösung anzeigen?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Wenn du die Musterlösung anschaust, wird diese Aufgabe als{' '}
                <strong>"nicht selbstständig gelöst"</strong> markiert.
              </p>
              <p>
                Das beeinflusst deine Lernstatistik und das Spaced-Repetition-System.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmViewSolution}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Trotzdem anzeigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
