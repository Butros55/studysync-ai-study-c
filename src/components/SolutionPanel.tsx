/**
 * SolutionPanel - Zeigt die Musterlösung einer Aufgabe an
 * 
 * Features:
 * - Lösung standardmäßig ausgeblendet
 * - Button zum Einblenden
 * - Warnungsdialog beim ersten Anzeigen (markiert Aufgabe als "nicht selbstständig gelöst")
 * - Markdown-Rendering der Lösung
 */

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { MarkdownRenderer } from './MarkdownRenderer'
import { Eye, EyeSlash, Lightbulb, Warning } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface SolutionPanelProps {
  solution: string
  compact?: boolean
  /** Ob die Aufgabe bereits als korrekt bewertet wurde */
  isCorrect?: boolean
  /** Ob die Lösung bereits angesehen wurde */
  viewedSolution?: boolean
  /** Callback wenn Lösung angesehen wird */
  onViewSolution?: () => void
}

export function SolutionPanel({ 
  solution, 
  compact = false,
  isCorrect = false,
  viewedSolution = false,
  onViewSolution,
}: SolutionPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showWarning, setShowWarning] = useState(false)

  const handleShowSolution = useCallback(() => {
    // Keine Warnung wenn korrekt gelöst oder bereits angesehen
    if (isCorrect || viewedSolution) {
      setIsVisible(true)
      return
    }
    // Warnung zeigen
    setShowWarning(true)
  }, [isCorrect, viewedSolution])

  const handleConfirmView = useCallback(() => {
    setShowWarning(false)
    setIsVisible(true)
    onViewSolution?.()
  }, [onViewSolution])

  return (
    <>
      <div className={compact ? 'mt-3' : 'mt-4'}>
        {!isVisible ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              onClick={handleShowSolution}
              className="flex-1 sm:flex-none"
            >
              <Eye size={16} className="mr-2" />
              Musterlösung anzeigen
            </Button>
            {viewedSolution && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                <Warning size={12} className="mr-1" />
                bereits angesehen
              </Badge>
            )}
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`bg-blue-500/5 border-blue-500/20 ${compact ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={18} className="text-blue-600" weight="fill" />
                    <span className={`font-semibold text-blue-700 dark:text-blue-400 ${compact ? 'text-sm' : ''}`}>
                      Musterlösung
                    </span>
                    {viewedSolution && !isCorrect && (
                      <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-300 py-0">
                        nicht selbst gelöst
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsVisible(false)}
                    className="h-7 px-2"
                  >
                    <EyeSlash size={14} className="mr-1" />
                    <span className="text-xs">Ausblenden</span>
                  </Button>
                </div>
                
                <div className={`${compact ? 'text-sm' : ''}`}>
                  <MarkdownRenderer content={solution} compact={compact} />
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Warnungsdialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
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
              onClick={handleConfirmView}
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
