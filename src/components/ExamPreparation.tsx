import { useEffect, useState, useCallback } from 'react'
import { Module } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Sparkle, BookOpen, Brain, ClipboardText, CheckCircle, CaretDown, Play } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface ExamPreparationProps {
  module: Module
  progress: number // 0-100
  currentStep: 'style' | 'generating' | 'finalizing'
  generatedCount: number
  totalCount: number
  isComplete?: boolean
  onStart?: () => void
  onMinimize?: () => void
}

const steps = [
  { id: 'style', label: 'Stilprofil extrahieren', icon: BookOpen },
  { id: 'generating', label: 'Aufgaben generieren', icon: Brain },
  { id: 'finalizing', label: 'Prüfung vorbereiten', icon: ClipboardText },
]

// Motivierende/informative Texte während des Ladens
const loadingMessages = [
  "Analysiere deine Vorlesungsinhalte...",
  "Identifiziere wichtige Konzepte...",
  "Erkenne Aufgabenmuster aus Übungsblättern...",
  "Generiere prüfungsrelevante Fragen...",
  "Berücksichtige deine Schwachstellen...",
  "Optimiere Schwierigkeitsverteilung...",
  "Erstelle abwechslungsreiche Aufgaben...",
  "Formuliere präzise Fragestellungen...",
  "Prüfe mathematische Notation...",
  "Bereite Lösungshinweise vor...",
  "Fast geschafft – letzte Überprüfung...",
  "Finalisiere deine Prüfung...",
]

export function ExamPreparation({
  module,
  progress,
  currentStep,
  generatedCount,
  totalCount,
  isComplete = false,
  onStart,
  onMinimize,
}: ExamPreparationProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [isMessageVisible, setIsMessageVisible] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Wechsle Nachrichten während des Ladens
  useEffect(() => {
    if (isComplete) return
    
    const interval = setInterval(() => {
      setIsMessageVisible(false)
      
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length)
        setIsMessageVisible(true)
      }, 300)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isComplete])

  // Countdown-Logik
  const handleStart = useCallback(() => {
    setCountdown(3)
  }, [])

  useEffect(() => {
    if (countdown === null) return
    
    if (countdown === 0) {
      onStart?.()
      return
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [countdown, onStart])

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  // Countdown-Overlay
  if (countdown !== null && countdown > 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          key={countdown}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-9xl font-bold text-primary"
        >
          {countdown}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="p-8 text-center relative">
          {/* Minimize Button */}
          {onMinimize && !isComplete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMinimize}
              className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Im Hintergrund weiter generieren"
            >
              <CaretDown size={18} />
            </Button>
          )}

          {/* Animated Icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            {isComplete ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle size={48} className="text-green-500" weight="fill" />
                </div>
              </motion.div>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkle size={40} className="text-primary" weight="duotone" />
                </div>
              </>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold mb-2">
            {isComplete ? 'Prüfung bereit!' : 'Prüfung wird vorbereitet'}
          </h2>
          
          {/* Animated Loading Message */}
          <div className="h-12 flex items-center justify-center mb-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={isComplete ? 'complete' : messageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-muted-foreground"
              >
                {isComplete 
                  ? `${totalCount} Aufgaben wurden für dich erstellt. Viel Erfolg!`
                  : loadingMessages[messageIndex]
                }
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {isComplete 
                ? 'Bereit zum Starten'
                : currentStep === 'generating'
                  ? `${generatedCount} von ${totalCount} Aufgaben generiert`
                  : `${Math.round(progress)}%`
              }
            </p>
          </div>

          {/* Start Button (only when complete) */}
          {isComplete && onStart && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button 
                size="lg" 
                onClick={handleStart}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Play size={20} className="mr-2" weight="fill" />
                Prüfung starten
              </Button>
            </motion.div>
          )}

          {/* Steps (only during preparation) */}
          {!isComplete && (
            <div className="space-y-3 mt-4">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isActive = index === currentStepIndex
                const isCompleteStep = index < currentStepIndex

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
                      <Icon size={20} weight={isActive ? 'duotone' : 'regular'} />
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

          {/* Module Info */}
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
            <p>
              Modul: <span className="font-medium">{module.name}</span>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

// Minimierte Version - schwebendes Widget
export function ExamPreparationMinimized({
  progress,
  isComplete,
  onClick,
}: {
  progress: number
  isComplete: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-card border shadow-lg flex items-center justify-center overflow-hidden group"
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
          strokeDasharray={150}
          strokeDashoffset={150 - (progress / 100) * 150}
          className={isComplete ? "text-green-500" : "text-primary"}
          strokeLinecap="round"
        />
      </svg>
      
      {/* Icon */}
      <div className="relative z-10">
        {isComplete ? (
          <CheckCircle size={24} className="text-green-500" weight="fill" />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkle size={24} className="text-primary" weight="duotone" />
          </motion.div>
        )}
      </div>
      
      {/* Hover Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {isComplete ? 'Prüfung bereit!' : `${Math.round(progress)}% generiert`}
      </div>
    </motion.button>
  )
}
