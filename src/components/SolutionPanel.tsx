/**
 * SolutionPanel - Zeigt die Musterlösung einer Aufgabe an
 * 
 * Features:
 * - Lösung standardmäßig ausgeblendet
 * - Button zum Einblenden
 * - Optional: Bestätigungsdialog (als Kommentar dokumentiert)
 * - Markdown-Rendering der Lösung
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Eye, EyeSlash, Lightbulb } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface SolutionPanelProps {
  solution: string
  compact?: boolean
}

export function SolutionPanel({ solution, compact = false }: SolutionPanelProps) {
  const [isVisible, setIsVisible] = useState(false)

  const handleShowSolution = () => {
    // OPTIONAL: Bestätigungsdialog
    // Hier könnte ein Dialog implementiert werden:
    // "Bist du sicher? Danach zählt die Aufgabe nicht mehr als ungestützt gelöst."
    // Für bessere UX wird aktuell direkt angezeigt.
    setIsVisible(true)
  }

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      {!isVisible ? (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={handleShowSolution}
          className="w-full sm:w-auto"
        >
          <Eye size={16} className="mr-2" />
          Musterlösung anzeigen
        </Button>
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
  )
}
