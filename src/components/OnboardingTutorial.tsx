/**
 * Interaktives Onboarding Tutorial für neue Benutzer
 * Führt Schritt für Schritt durch die wichtigsten Features
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  GraduationCap,
  FolderPlus,
  FileArrowUp,
  Lightning,
  PencilSimple,
  Exam,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkle,
  Books,
  Brain,
  Target
} from '@phosphor-icons/react'

const ONBOARDING_KEY = 'studysync_onboarding_completed'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  highlight?: string // CSS-Selektor für Highlight
  position?: 'center' | 'top' | 'bottom'
  action?: string
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei StudyMate! 🎓',
    description: 'Dein KI-gestützter Lernbegleiter für die Uni. In 60 Sekunden zeige ich dir, wie du effektiv lernen kannst!',
    icon: <GraduationCap size={48} weight="duotone" />,
    position: 'center'
  },
  {
    id: 'module',
    title: '1️⃣ Modul erstellen',
    description: 'Erstelle für jedes Fach ein Modul. Klicke auf "Neues Modul" und gib Name, Kürzel und Prüfungstermin ein.',
    icon: <FolderPlus size={48} weight="duotone" />,
    highlight: '[data-onboarding="new-module"]',
    position: 'top',
    action: 'Klicke auf "Neues Modul"'
  },
  {
    id: 'files',
    title: '2️⃣ Dateien hochladen',
    description: 'Lade deine Skripte, Übungsblätter und Lösungen hoch. Die KI analysiert sie automatisch!',
    icon: <FileArrowUp size={48} weight="duotone" />,
    highlight: '[data-onboarding="files-tab"]',
    position: 'top'
  },
  {
    id: 'generate',
    title: '3️⃣ Aufgaben generieren',
    description: 'Klicke auf "Aufgaben generieren" bei einem Skript. Die KI erstellt passende Übungsaufgaben für dich!',
    icon: <Sparkle size={48} weight="duotone" />,
    position: 'center'
  },
  {
    id: 'solve',
    title: '4️⃣ Aufgaben lösen',
    description: 'Löse Aufgaben mit Stift oder Tastatur. Die KI erkennt sogar Handschrift und gibt dir Feedback!',
    icon: <PencilSimple size={48} weight="duotone" />,
    position: 'center'
  },
  {
    id: 'dashboard',
    title: '5️⃣ Dashboard nutzen',
    description: 'Das Dashboard zeigt deinen Fortschritt, schwache Themen und was du heute lernen solltest.',
    icon: <Target size={48} weight="duotone" />,
    highlight: '[data-onboarding="dashboard-tab"]',
    position: 'top'
  },
  {
    id: 'exam',
    title: '6️⃣ Prüfungsmodus',
    description: 'Simuliere echte Prüfungsbedingungen mit Timer und ohne Hilfe. Perfekt für die Vorbereitung!',
    icon: <Exam size={48} weight="duotone" />,
    highlight: '[data-onboarding="exam-mode"]',
    position: 'top'
  },
  {
    id: 'done',
    title: 'Du bist bereit! 🚀',
    description: 'Erstelle jetzt dein erstes Modul und lade ein Skript hoch. Viel Erfolg beim Lernen!',
    icon: <CheckCircle size={48} weight="duotone" />,
    position: 'center'
  }
]

interface OnboardingTutorialProps {
  onComplete: () => void
  onCreateModule?: () => void
}

export function OnboardingTutorial({ onComplete, onCreateModule }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  const step = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setIsVisible(false)
    setTimeout(onComplete, 300)
  }

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setIsVisible(false)
    setTimeout(onComplete, 300)
  }

  // Highlight-Effekt für Elemente
  useEffect(() => {
    if (step.highlight) {
      const element = document.querySelector(step.highlight)
      if (element) {
        element.classList.add('onboarding-highlight')
        return () => element.classList.remove('onboarding-highlight')
      }
    }
  }, [step.highlight])

  // Tastatur-Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'Escape') handleSkip()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStep])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Content */}
          <motion.div
            key={step.id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            <Card className="overflow-hidden shadow-2xl border-2 border-primary/20">
              {/* Header mit Icon */}
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-4"
                >
                  {step.icon}
                </motion.div>
                
                <h2 className="text-xl font-bold">{step.title}</h2>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-muted-foreground text-center mb-6">
                  {step.description}
                </p>

                {step.action && (
                  <div className="bg-primary/5 rounded-lg p-3 mb-4 text-center">
                    <span className="text-sm font-medium text-primary">
                      💡 {step.action}
                    </span>
                  </div>
                )}

                {/* Progress */}
                <div className="mb-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Schritt {currentStep + 1} von {STEPS.length}
                  </p>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="gap-1"
                  >
                    <ArrowLeft size={16} />
                    Zurück
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="text-muted-foreground"
                  >
                    Überspringen
                  </Button>

                  <Button
                    onClick={handleNext}
                    size="sm"
                    className="gap-1"
                  >
                    {currentStep === STEPS.length - 1 ? (
                      <>
                        Los geht's!
                        <CheckCircle size={16} />
                      </>
                    ) : (
                      <>
                        Weiter
                        <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </div>
              </div>

            </Card>

            {/* Step Dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {STEPS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-primary w-6'
                      : index < currentStep
                      ? 'bg-primary/50'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook um zu prüfen ob Onboarding gezeigt werden soll
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    // Prüfe ob Onboarding bereits abgeschlossen
    const completed = localStorage.getItem(ONBOARDING_KEY)
    setShowOnboarding(!completed)
    setIsChecked(true)
  }, [])

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY)
    setShowOnboarding(true)
  }

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShowOnboarding(false)
  }

  return {
    showOnboarding,
    isChecked,
    resetOnboarding,
    completeOnboarding
  }
}

// Kleiner Trigger-Button zum erneuten Anzeigen
export function OnboardingTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <GraduationCap size={18} />
      Tutorial
    </Button>
  )
}
