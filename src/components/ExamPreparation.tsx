import { useEffect, useState } from 'react'
import { Module } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sparkle, BookOpen, Brain, ClipboardText, CheckCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface ExamPreparationProps {
  module: Module
  progress: number // 0-100
  currentStep: 'style' | 'generating' | 'finalizing'
  generatedCount: number
  totalCount: number
}

const steps = [
  { id: 'style', label: 'Stilprofil extrahieren', icon: BookOpen },
  { id: 'generating', label: 'Aufgaben generieren', icon: Brain },
  { id: 'finalizing', label: 'Prüfung vorbereiten', icon: ClipboardText },
]

export function ExamPreparation({
  module,
  progress,
  currentStep,
  generatedCount,
  totalCount,
}: ExamPreparationProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="p-8 text-center">
          {/* Animated Icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkle size={40} className="text-primary" weight="duotone" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold mb-2">
            Prüfung wird vorbereitet{dots}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Die Aufgaben werden aus deinen Vorlesungsinhalten, Übungsblättern und Probeklausuren generiert.
          </p>

          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {currentStep === 'generating'
                ? `${generatedCount} von ${totalCount} Aufgaben generiert`
                : `${Math.round(progress)}%`}
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStepIndex
              const isComplete = index < currentStepIndex

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : isComplete
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  {isComplete ? (
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
