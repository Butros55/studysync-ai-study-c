/**
 * AI Preparation UI
 * 
 * Generisches, schönes UI für alle KI-Aktionen.
 * Basiert auf dem ExamPreparation-Design.
 * 
 * Wird verwendet für:
 * - Dokument-Analyse
 * - Notizen-Generierung
 * - Aufgaben-Generierung
 * - Karteikarten-Generierung
 */

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { 
  Sparkle, 
  CheckCircle, 
  CaretDown, 
  X,
  MagnifyingGlass,
  FileText,
  ListChecks,
  Cards,
  Brain,
  BookOpen,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================================================
// Types
// ============================================================================

export type AIActionType = 'analyze' | 'generate-notes' | 'generate-tasks' | 'generate-flashcards'

export interface AIActionItem {
  id: string
  name: string
  progress: number
  status: 'queued' | 'processing' | 'completed' | 'error'
  error?: string
}

export interface AIPreparationProps {
  /** Typ der KI-Aktion */
  type: AIActionType
  /** Modul-Name für Anzeige */
  moduleName: string
  /** Gesamtfortschritt 0-100 */
  progress: number
  /** Aktueller Schritt-Index (0-2) */
  currentStep: number
  /** Anzahl verarbeiteter Items */
  processedCount: number
  /** Gesamtanzahl Items */
  totalCount: number
  /** Ist die Aktion abgeschlossen? */
  isComplete?: boolean
  /** Einzelne Aktions-Items (für Liste) */
  items?: AIActionItem[]
  /** Callback zum Minimieren */
  onMinimize?: () => void
  /** Callback zum Schließen/Abbrechen */
  onClose?: () => void
}

// ============================================================================
// Configuration per Action Type
// ============================================================================

interface ActionConfig {
  title: string
  icon: React.ElementType
  color: string
  steps: Array<{ id: string; label: string; icon: React.ElementType }>
  loadingMessages: string[]
  completeMessage: string
}

const ACTION_CONFIG: Record<AIActionType, ActionConfig> = {
  'analyze': {
    title: 'Dokumente werden analysiert',
    icon: MagnifyingGlass,
    color: 'text-blue-500',
    steps: [
      { id: 'scan', label: 'Dokumente scannen', icon: MagnifyingGlass },
      { id: 'extract', label: 'Inhalte extrahieren', icon: BookOpen },
      { id: 'profile', label: 'Modul-Profil erstellen', icon: Brain },
    ],
    loadingMessages: [
      "Scanne Dokument-Struktur...",
      "Erkenne Themen und Konzepte...",
      "Extrahiere Definitionen...",
      "Identifiziere Formeln...",
      "Analysiere Zusammenhänge...",
      "Erstelle Themen-Hierarchie...",
      "Verarbeite mathematische Notation...",
      "Kategorisiere Inhalte...",
      "Fast fertig...",
    ],
    completeMessage: 'Analyse abgeschlossen!',
  },
  'generate-notes': {
    title: 'Notizen werden erstellt',
    icon: FileText,
    color: 'text-green-500',
    steps: [
      { id: 'analyze', label: 'Inhalte analysieren', icon: MagnifyingGlass },
      { id: 'generate', label: 'Notizen generieren', icon: FileText },
      { id: 'format', label: 'Formatieren', icon: BookOpen },
    ],
    loadingMessages: [
      "Analysiere Skript-Inhalte...",
      "Identifiziere Kernkonzepte...",
      "Strukturiere Lernmaterial...",
      "Erstelle Zusammenfassungen...",
      "Formatiere LaTeX-Formeln...",
      "Optimiere Darstellung...",
      "Fast fertig...",
    ],
    completeMessage: 'Notizen erstellt!',
  },
  'generate-tasks': {
    title: 'Aufgaben werden generiert',
    icon: ListChecks,
    color: 'text-orange-500',
    steps: [
      { id: 'context', label: 'Kontext laden', icon: BookOpen },
      { id: 'generate', label: 'Aufgaben generieren', icon: Brain },
      { id: 'validate', label: 'Qualität prüfen', icon: CheckCircle },
    ],
    loadingMessages: [
      "Lade Modul-Kontext...",
      "Analysiere Themengebiete...",
      "Generiere Übungsaufgaben...",
      "Variiere Schwierigkeitsgrade...",
      "Erstelle Musterlösungen...",
      "Prüfe mathematische Korrektheit...",
      "Validiere Aufgabenqualität...",
      "Fast fertig...",
    ],
    completeMessage: 'Aufgaben erstellt!',
  },
  'generate-flashcards': {
    title: 'Karteikarten werden erstellt',
    icon: Cards,
    color: 'text-purple-500',
    steps: [
      { id: 'analyze', label: 'Notizen analysieren', icon: MagnifyingGlass },
      { id: 'generate', label: 'Karten generieren', icon: Cards },
      { id: 'optimize', label: 'Optimieren', icon: Brain },
    ],
    loadingMessages: [
      "Analysiere Notizen...",
      "Identifiziere Schlüsselkonzepte...",
      "Erstelle Frage-Antwort-Paare...",
      "Optimiere für Spaced Repetition...",
      "Formatiere Inhalte...",
      "Fast fertig...",
    ],
    completeMessage: 'Karteikarten erstellt!',
  },
}

// ============================================================================
// Main Component
// ============================================================================

export function AIPreparation({
  type,
  moduleName,
  progress,
  currentStep,
  processedCount,
  totalCount,
  isComplete = false,
  items = [],
  onMinimize,
  onClose,
}: AIPreparationProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [isMessageVisible, setIsMessageVisible] = useState(true)
  
  const config = ACTION_CONFIG[type]
  
  // Finde das aktuell verarbeitete Item
  const currentItem = items.find(item => item.status === 'processing')

  // Step-Status pro aktuellem Item (für generate-tasks nutzen wir den Fortschritt des Items)
  const computeStepState = () => {
    // Default: nutze den aggregierten currentStep aus den Props
    const completed = new Set<number>()
    for (let i = 0; i < currentStep; i++) {
      completed.add(i)
    }
    let active = isComplete ? null : currentStep

    // Spezielle Logik: bei generate-tasks leiten wir den Step aus dem Fortschritt des aktuellen Items ab
    if (type === 'generate-tasks' && currentItem) {
      const p = currentItem.progress
      // Schwellenwerte passend zu den setPipelineTasks Fortschritten in App.tsx (5/15/30/70/85/100)
      if (p >= 100) {
        completed.add(0)
        completed.add(1)
        completed.add(2)
        active = null
      } else if (p >= 70) {
        completed.add(0)
        completed.add(1)
        active = 2 // Qualität prüfen
      } else if (p >= 15) {
        completed.add(0)
        active = 1 // Aufgaben generieren
      } else {
        active = 0 // Kontext laden
      }
    }

    return { active, completed }
  }

  const stepState = computeStepState()

  // Wechsle Nachrichten während des Ladens
  useEffect(() => {
    if (isComplete) return
    
    const interval = setInterval(() => {
      setIsMessageVisible(false)
      
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % config.loadingMessages.length)
        setIsMessageVisible(true)
      }, 300)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isComplete, config.loadingMessages.length])

  return (
    <div 
      className="min-h-screen bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 fixed inset-0 z-50"
      onClick={(e) => {
        // Schließe UI wenn außerhalb geklickt wird
        if (e.target === e.currentTarget && onMinimize) {
          onMinimize()
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()} // Verhindert Schließen wenn auf Card geklickt
      >
        <Card className="p-6 shadow-xl border-2 relative">
          {/* Minimize Button */}
          {onMinimize && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={onMinimize}
            >
              <CaretDown size={16} />
            </Button>
          )}

          {/* Animated Icon - Sparkle Icon wie beim Prüfungsmodus */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <motion.div
                className={`w-20 h-20 rounded-full border-4 ${isComplete ? 'border-green-500' : 'border-primary/30'} flex items-center justify-center bg-background`}
              >
                {isComplete ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle size={40} className="text-green-500" weight="fill" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkle size={36} className="text-primary" weight="duotone" />
                  </motion.div>
                )}
              </motion.div>
              
              {/* Progress Ring */}
              {!isComplete && (
                <svg className="absolute inset-0 w-20 h-20 -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-primary"
                    strokeDasharray={226}
                    strokeDashoffset={226 - (progress / 100) * 226}
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-center mb-2">
            {isComplete ? config.completeMessage : config.title}
          </h2>

          {/* Loading Message */}
          {!isComplete && (
            <div className="h-6 flex items-center justify-center mb-4">
              <AnimatePresence mode="wait">
                {isMessageVisible && (
                  <motion.p
                    key={messageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-sm text-muted-foreground text-center"
                  >
                    {config.loadingMessages[messageIndex]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-2">
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Progress Text / Stats when complete */}
          {isComplete ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-4"
            >
              <div className="flex items-center justify-center gap-6 py-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{totalCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalCount === 1 ? 'Dokument' : 'Dokumente'}
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">100%</p>
                  <p className="text-xs text-muted-foreground">Abgeschlossen</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <p className="text-center text-sm text-muted-foreground mb-4">
              {Math.round(progress)}%
            </p>
          )}

          {/* Steps */}
          {!isComplete && (
            <div className="space-y-3 mt-4">
              {config.steps.map((step, index) => {
                const StepIcon = step.icon
                const isActive = stepState.active === index
                const isCompleteStep = stepState.completed.has(index)

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : isCompleteStep
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isCompleteStep ? (
                      <CheckCircle size={20} weight="fill" className="text-green-600" />
                    ) : (
                      <StepIcon size={20} weight={isActive ? 'duotone' : 'regular'} />
                    )}
                    <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="ml-auto"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </motion.div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Current Item - nur aktuell verarbeitete Datei anzeigen */}
          {items.length > 0 && !isComplete && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2 text-center">
                {processedCount}/{totalCount} verarbeitet:
              </p>
              <div className="flex items-center justify-center gap-2">
                <AnimatePresence mode="wait">
                  {currentItem && (
                    <motion.div
                      key={currentItem.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 text-sm"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkle size={14} className="text-primary" />
                      </motion.div>
                      <span className="text-primary font-medium truncate max-w-[250px]">
                        {currentItem.name}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Module Info - zentriert */}
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
            <p>
              Modul: <span className="font-medium">{moduleName}</span>
            </p>
          </div>

          {/* Close Button when complete */}
          {isComplete && onClose && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              <Button 
                variant="outline"
                className="w-full"
                onClick={onClose}
              >
                Schließen
              </Button>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}

// ============================================================================
// Minimized Version - Spark Button with Badge (like Exam but with queue count)
// ============================================================================

export interface AIPreparationMinimizedProps {
  type: AIActionType
  progress: number
  isComplete: boolean
  processedCount: number
  totalCount: number
  onClick: () => void
  /** Wenn true, wird das Widget nach links verschoben (z.B. wenn ExamPreparation auch läuft) */
  offsetLeft?: boolean
}

export function AIPreparationMinimized({
  type,
  progress,
  isComplete,
  processedCount,
  totalCount,
  onClick,
  offsetLeft = false,
}: AIPreparationMinimizedProps) {
  const config = ACTION_CONFIG[type]
  
  // Calculate stroke dashoffset for progress ring
  const circumference = 2 * Math.PI * 24 // r=24
  const strokeDashoffset = circumference - (progress / 100) * circumference
  
  // Anzahl der noch zu verarbeitenden Tasks
  const remainingCount = totalCount - processedCount

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "fixed bottom-6 z-50 w-14 h-14 rounded-full bg-card border shadow-lg flex items-center justify-center group",
        offsetLeft ? "right-24" : "right-6"
      )}
    >
      {/* Progress Ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-muted/20"
        />
        <motion.circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={isComplete ? "text-green-500" : "text-primary"}
          strokeLinecap="round"
        />
      </svg>
      
      {/* Spark Icon - immer Sparkle, grün wenn fertig */}
      <div className="relative z-10 flex items-center justify-center">
        {isComplete ? (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Sparkle size={24} className="text-green-500" weight="fill" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkle size={24} className="text-primary" weight="duotone" />
          </motion.div>
        )}
      </div>
      
      {/* Badge mit Anzahl der verbleibenden Tasks */}
      {remainingCount > 0 && !isComplete && (
        <motion.div 
          key={remainingCount}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold shadow-md"
        >
          {remainingCount}
        </motion.div>
      )}
      
      {/* Hover Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
        {isComplete 
          ? `${totalCount} ${config.title.includes('analysiert') ? 'analysiert' : 'generiert'}`
          : `${remainingCount} verbleibend • ${Math.round(progress)}%`
        }
      </div>
    </motion.button>
  )
}
