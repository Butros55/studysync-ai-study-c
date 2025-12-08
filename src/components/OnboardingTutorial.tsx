/**
 * Interaktives Onboarding Tutorial für neue Benutzer
 * Führt Schritt für Schritt durch die wichtigsten Features
 * 
 * Skip ist deaktiviert - Benutzer müssen alle Schritte durchlaufen
 * und einen Input-Mode wählen bevor das Onboarding abgeschlossen wird.
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
  PencilSimple,
  Exam,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkle,
  Target,
  Keyboard,
  PencilLine,
  UploadSimple,
  CloudArrowDown,
  UserCircle,
} from '@phosphor-icons/react'
import { usePreferredInputMode } from '@/hooks/use-preferred-input-mode'
import type { InputMode } from '@/lib/analysis-types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const ONBOARDING_KEY = 'studysync_onboarding_completed'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  highlight?: string // CSS-Selektor für Highlight
  position?: 'center' | 'top' | 'bottom'
  action?: string
  /** Special step type for input mode selection */
  isInputModeStep?: boolean
  /** Ask user for display name */
  isNameStep?: boolean
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
    id: 'server-import',
    title: 'Module vom Server laden',
    description: 'Lade die verfügbaren Module von deinem Team herunter. Du kannst später jederzeit weitere Module importieren.',
    icon: <CloudArrowDown size={48} weight="duotone" />,
    position: 'center',
    action: 'Module auswählen und importieren'
  },
  {
    id: 'name',
    title: 'Wie sollen wir dich nennen?',
    description: 'Dein Name erscheint in Lerngruppen. Du kannst ihn später jederzeit ändern.',
    icon: <UserCircle size={48} weight="duotone" />,
    position: 'center',
    isNameStep: true,
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
    id: 'input-mode',
    title: 'Wie möchtest du Aufgaben lösen?',
    description: 'Wähle deine bevorzugte Eingabemethode. Du kannst sie später jederzeit ändern.',
    icon: <PencilLine size={48} weight="duotone" />,
    position: 'center',
    isInputModeStep: true
  },
  {
    id: 'done',
    title: 'Du bist bereit! 🚀',
    description: 'Übernimm vorhandene Daten oder starte neu: Importiere ein Backup oder lade Module vom Server.',
    icon: <CheckCircle size={48} weight="duotone" />,
    position: 'center'
  }
]

interface OnboardingTutorialProps {
  onComplete: () => void
  onCreateModule?: () => void
  onImportBackup?: () => void
  onFetchServerBackup?: () => void
  initialDisplayName?: string
  onSetDisplayName?: (name: string) => void
}

export function OnboardingTutorial({
  onComplete,
  onCreateModule,
  onImportBackup,
  onFetchServerBackup,
  initialDisplayName,
  onSetDisplayName,
}: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [selectedInputMode, setSelectedInputMode] = useState<InputMode | undefined>(undefined)
  const [displayName, setDisplayName] = useState(initialDisplayName || '')
  const [nameError, setNameError] = useState<string | null>(null)
  
  // Use the hook to get existing preference and setter
  const { mode: existingMode, setMode, isLoading: isModeLoading } = usePreferredInputMode()

  const step = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100
  
  // Check if we're on the input mode step
  const isInputModeStep = step.isInputModeStep === true
  const isFinalStep = step.id === 'done'
  const isNameStep = step.isNameStep === true
  
  // Pre-select existing mode if available
  useEffect(() => {
    if (existingMode && !selectedInputMode) {
      setSelectedInputMode(existingMode)
    }
  }, [existingMode, selectedInputMode])

  // Pre-fill name if available
  useEffect(() => {
    if (initialDisplayName && !displayName) {
      setDisplayName(initialDisplayName)
    }
  }, [initialDisplayName, displayName])

  useEffect(() => {
    if (displayName && nameError) {
      setNameError(null)
    }
  }, [displayName, nameError])

  const handleNext = async () => {
    // If on input mode step, must have selection and persist it
    if (isInputModeStep) {
      if (!selectedInputMode) {
        // Cannot proceed without selection
        return
      }
      // Persist the choice
      await setMode(selectedInputMode)
    }

    if (isNameStep) {
      if (!displayName.trim()) {
        setNameError('Bitte gib einen Namen ein.')
        return
      }
      setNameError(null)
      onSetDisplayName?.(displayName.trim())
    }
    
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
    // Only complete if input mode was selected
    if (!selectedInputMode) {
      // Find input mode step and go there
      const inputModeStepIndex = STEPS.findIndex(s => s.isInputModeStep)
      if (inputModeStepIndex >= 0) {
        setCurrentStep(inputModeStepIndex)
        return
      }
    }

    if (!displayName.trim()) {
      const nameStepIndex = STEPS.findIndex(s => s.isNameStep)
      if (nameStepIndex >= 0) {
        setNameError('Bitte gib einen Namen ein.')
        setCurrentStep(nameStepIndex)
        return
      }
    }
    
    localStorage.setItem(ONBOARDING_KEY, 'true')
    if (displayName.trim()) {
      onSetDisplayName?.(displayName.trim())
    }
    setIsVisible(false)
    setTimeout(onComplete, 300)
  }

  const handleFinalAction = (action?: () => void) => {
    action?.()
    handleComplete()
  }

  // Tastatur-Navigation (Skip via Escape disabled)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        // Don't allow Enter to proceed on input mode step without selection
        if (isInputModeStep && !selectedInputMode) return
        if (isNameStep && !displayName.trim()) return
        handleNext()
      }
      if (e.key === 'ArrowLeft') handlePrev()
      // Escape no longer skips - onboarding is mandatory
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStep, selectedInputMode, isInputModeStep, isNameStep, displayName])

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
            className="relative z-10 w-[min(520px,calc(100%-32px))]"
          >
            <Card className="overflow-hidden shadow-2xl border border-primary/15 rounded-2xl">
              {/* Header mit Icon */}
              <div className="relative bg-gradient-to-br from-primary/12 via-primary/6 to-background p-6 text-center overflow-hidden">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.18),transparent_45%)]"
                />
                <motion.div
                  initial={{ scale: 0.9, rotate: -6 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="relative inline-flex items-center justify-center mb-3"
                >
                  <div className="absolute inset-[-10px] rounded-full bg-primary/10 blur-xl" />
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner border border-primary/20 text-primary">
                    {step.icon}
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-1"
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    Schritt {currentStep + 1} / {STEPS.length}
                  </div>
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl font-bold tracking-tight mt-1"
                >
                  {step.title}
                </motion.h2>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-muted-foreground text-center leading-relaxed">
                  {step.description}
                </p>

                {/* Optional CTA sections removed */}

                {/* Name Step */}
                {isNameStep && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dein Anzeigename</label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="z.B. Alex, Lisa, Chris…"
                    />
                    <p className="text-xs text-muted-foreground">
                      Wird in Lerngruppen und beim Online-Status angezeigt.
                    </p>
                    {nameError && (
                      <p className="text-xs text-destructive">{nameError}</p>
                    )}
                  </div>
                )}

                {/* Input Mode Selection Step */}
                {isInputModeStep && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSelectedInputMode('type')}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                        selectedInputMode === 'type'
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        selectedInputMode === 'type' ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <Keyboard size={24} weight="duotone" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-medium">⌨️ Tastatur (Tippen)</div>
                        <div className="text-sm text-muted-foreground">
                          Antworten per Tastatur eingeben
                        </div>
                      </div>
                      {selectedInputMode === 'type' && (
                        <CheckCircle size={24} weight="fill" className="text-primary" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedInputMode('draw')}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                        selectedInputMode === 'draw'
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        selectedInputMode === 'draw' ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <PencilLine size={24} weight="duotone" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-medium">✍️ Stift (Zeichnen)</div>
                        <div className="text-sm text-muted-foreground">
                          Handschriftlich auf dem Canvas zeichnen
                        </div>
                      </div>
                      {selectedInputMode === 'draw' && (
                        <CheckCircle size={24} weight="fill" className="text-primary" />
                      )}
                    </button>

                    {!selectedInputMode && (
                      <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                        Bitte wähle eine Eingabemethode aus, um fortzufahren.
                      </p>
                    )}
                  </div>
                )}

                {isFinalStep && (
                  <div className="grid gap-2">
                    <Button
                      variant="default"
                      size="lg"
                      className="justify-start gap-2"
                      onClick={() => handleFinalAction(onFetchServerBackup)}
                    >
                      <CloudArrowDown size={18} />
                      Module vom Server laden
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => handleFinalAction(onImportBackup)}
                    >
                      <UploadSimple size={18} />
                      Backup aus Datei importieren
                    </Button>
                  </div>
                )}

                {/* Progress */}
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Schritt {currentStep + 1} von {STEPS.length}
                  </p>
                </div>

                {/* Navigation - Skip button removed */}
                <div className="flex items-center justify-between gap-3 pt-2">
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

                  {/* Spacer instead of skip button */}
                  <div className="flex-1" />

                  <Button
                    onClick={handleNext}
                    size="sm"
                    className="gap-1"
                    disabled={(isInputModeStep && !selectedInputMode) || (isNameStep && !displayName.trim())}
                  >
                    {currentStep === STEPS.length - 1 ? 'Weiter ohne Import' : (
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
