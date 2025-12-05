/**
 * TaskFeedbackPanel - Wiederverwendbare Feedback-Anzeige für Aufgaben
 * 
 * Wird sowohl im normalen TaskSolver als auch im Fullscreen-Modus verwendet.
 * Zeigt:
 * - KI-Transkription der Handschrift
 * - Bewertungsstatus (Richtig/Falsch)
 * - Hinweise bei falscher Antwort
 */

import { TaskFeedback } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import {
  CheckCircle,
  Lightbulb,
  ArrowRight,
  Info,
  TextT,
  Warning,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface TaskFeedbackPanelProps {
  feedback: TaskFeedback
  onNextTask?: () => void
  onRetry?: () => void
  compact?: boolean
  showTranscription?: boolean
}

export function TaskFeedbackPanel({
  feedback,
  onNextTask,
  onRetry,
  compact = false,
  showTranscription = true,
}: TaskFeedbackPanelProps) {
  const padding = compact ? 'p-3' : 'p-3 sm:p-4'
  const textSize = compact ? 'text-xs sm:text-sm' : 'text-sm'
  const iconSize = compact ? 18 : 20

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* KI-Transkription */}
      {showTranscription && feedback.transcription && (
        <Alert className={textSize}>
          <TextT size={16} weight="bold" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">KI-Transkription:</span>
                <Badge variant="secondary" className="text-[10px]">Debug</Badge>
              </div>
              <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-xs sm:text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                {feedback.transcription}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Bewertungsstatus */}
      {feedback.isCorrect ? (
        <Card className={`${padding} bg-green-500/10 border-green-500/20`}>
          <div className="flex items-start gap-2 sm:gap-3">
            <CheckCircle size={iconSize} className="text-green-600 mt-0.5 shrink-0" weight="fill" />
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-green-600 mb-1 ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>
                Richtig!
              </h4>
              <p className={`${textSize} leading-relaxed mb-3`}>
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
        <Card className={`${padding} bg-yellow-500/10 border-yellow-500/20`}>
          <div className="flex items-start gap-2 sm:gap-3">
            <Lightbulb size={iconSize} className="text-yellow-600 mt-0.5 shrink-0" weight="fill" />
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-yellow-700 dark:text-yellow-500 mb-1 ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>
                Noch nicht ganz richtig
              </h4>
              {feedback.hints && feedback.hints.length > 0 && (
                <div className="space-y-1.5">
                  <p className={`${textSize} font-medium`}>Hinweise:</p>
                  <ul className={`list-disc list-inside space-y-0.5 ${textSize}`}>
                    {feedback.hints.map((hint, idx) => (
                      <li key={idx}>
                        <MarkdownRenderer content={hint} compact inline className="inline prose-p:inline prose-p:my-0" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {onRetry && (
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Nochmal versuchen
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </motion.div>
  )
}

/**
 * Kompakte Variante für das Bottom-Panel im Fullscreen
 */
export function TaskFeedbackSummary({ feedback }: { feedback: TaskFeedback }) {
  if (feedback.isCorrect) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle size={18} weight="fill" />
        <span className="text-sm font-medium">Richtig!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-yellow-600">
      <Warning size={18} weight="fill" />
      <span className="text-sm font-medium">Nicht ganz richtig</span>
      {feedback.hints && feedback.hints.length > 0 && (
        <Badge variant="secondary" className="text-[10px]">
          {feedback.hints.length} Hinweise
        </Badge>
      )}
    </div>
  )
}
