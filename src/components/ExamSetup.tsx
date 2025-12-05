import { useState } from 'react'
import { Module, Script, ExamSession } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Clock,
  Exam,
  Lightning,
  Warning,
  Sparkle,
  ChartBar,
  BookOpen,
  ClipboardText,
  Play,
  Trash,
  Pause,
} from '@phosphor-icons/react'

interface PausedExam {
  session: ExamSession
  timeRemaining: number
  pausedAt: string
}

interface ExamSetupProps {
  module: Module
  scripts: Script[]
  onBack: () => void
  onStartExam: (config: ExamConfig) => void
  pausedExam?: PausedExam | null
  onResumePausedExam?: () => void
  onDiscardPausedExam?: () => void
}

export interface ExamConfig {
  duration: number // in Minuten
  difficultyMix: { easy: number; medium: number; hard: number }
  taskCount: number | 'auto'
}

export function ExamSetup({ 
  module, 
  scripts, 
  onBack, 
  onStartExam,
  pausedExam,
  onResumePausedExam,
  onDiscardPausedExam,
}: ExamSetupProps) {
  const [duration, setDuration] = useState<number>(45)
  const [taskCountMode, setTaskCountMode] = useState<'auto' | 'fixed'>('auto')
  const [fixedTaskCount, setFixedTaskCount] = useState<number>(5)
  const [difficultyMix, setDifficultyMix] = useState({
    easy: 40,
    medium: 40,
    hard: 20,
  })

  // Kategorisierte Skripte
  const scriptsByCategory = {
    scripts: scripts.filter(s => s.category === 'script' || !s.category),
    exercises: scripts.filter(s => s.category === 'exercise'),
    solutions: scripts.filter(s => s.category === 'solution'),
    exams: scripts.filter(s => s.category === 'exam'),
  }

  const hasEnoughContent = scriptsByCategory.scripts.length > 0

  const handleDifficultyChange = (type: 'easy' | 'medium' | 'hard', value: number) => {
    const newMix = { ...difficultyMix }
    const oldValue = newMix[type]
    const diff = value - oldValue
    
    // Verteile die Differenz auf die anderen beiden
    const others = (['easy', 'medium', 'hard'] as const).filter(t => t !== type)
    const otherTotal = others.reduce((sum, t) => sum + newMix[t], 0)
    
    if (otherTotal > 0) {
      others.forEach(t => {
        const ratio = newMix[t] / otherTotal
        newMix[t] = Math.max(0, Math.round(newMix[t] - diff * ratio))
      })
    }
    
    newMix[type] = value
    
    // Normalisiere auf 100%
    const total = newMix.easy + newMix.medium + newMix.hard
    if (total !== 100) {
      const scale = 100 / total
      newMix.easy = Math.round(newMix.easy * scale)
      newMix.medium = Math.round(newMix.medium * scale)
      newMix.hard = 100 - newMix.easy - newMix.medium
    }
    
    setDifficultyMix(newMix)
  }

  const handleStartExam = () => {
    const config: ExamConfig = {
      duration,
      difficultyMix: {
        easy: difficultyMix.easy / 100,
        medium: difficultyMix.medium / 100,
        hard: difficultyMix.hard / 100,
      },
      taskCount: taskCountMode === 'auto' ? 'auto' : fixedTaskCount,
    }
    onStartExam(config)
  }

  // Berechne automatische Aufgabenanzahl basierend auf Dauer
  const autoTaskCount = Math.max(3, Math.min(10, Math.floor(duration / 8)))

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft size={20} />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Exam size={24} className="text-primary" weight="duotone" />
                <h1 className="text-xl sm:text-2xl font-semibold">Prüfungsmodus</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {module.name} · {module.code}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {!hasEnoughContent ? (
            <Alert variant="destructive" className="mb-6">
              <Warning size={16} />
              <AlertDescription>
                Für den Prüfungsmodus benötigst du mindestens ein Skript in diesem Modul.
                Lade zuerst Vorlesungsskripte hoch, um Prüfungsaufgaben generieren zu können.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-6 bg-primary/5 border-primary/20">
              <Sparkle size={16} className="text-primary" />
              <AlertDescription className="text-sm">
                <strong>Prüfungssimulation:</strong> Die KI generiert Aufgaben basierend auf deinen 
                Vorlesungsskripten und passt den Stil an deine Probeklausuren an (falls vorhanden).
              </AlertDescription>
            </Alert>
          )}

          {/* Material-Übersicht */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen size={18} />
                Verfügbare Materialien
              </CardTitle>
              <CardDescription>
                Diese Materialien werden für die Aufgabengenerierung verwendet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-500">{scriptsByCategory.scripts.length}</div>
                  <div className="text-xs text-muted-foreground">Skripte</div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">Wissensquelle</Badge>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-500">{scriptsByCategory.exercises.length}</div>
                  <div className="text-xs text-muted-foreground">Übungsblätter</div>
                  <Badge variant="outline" className="mt-1 text-[10px]">Struktur</Badge>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-500">{scriptsByCategory.solutions.length}</div>
                  <div className="text-xs text-muted-foreground">Lösungen</div>
                  <Badge variant="outline" className="mt-1 text-[10px]">Stil</Badge>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-500">{scriptsByCategory.exams.length}</div>
                  <div className="text-xs text-muted-foreground">Probeklausuren</div>
                  <Badge variant="outline" className="mt-1 text-[10px]">Stil</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pausierte Prüfung */}
          {pausedExam && (
            <Card className="mb-6 border-yellow-500/50 bg-yellow-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
                  <Pause size={18} weight="fill" />
                  Pausierte Prüfung
                </CardTitle>
                <CardDescription>
                  Du hast eine laufende Prüfung pausiert. Möchtest du sie fortsetzen?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Pausiert am:</span>
                      <span className="font-medium">
                        {new Date(pausedExam.pausedAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Verbleibende Zeit:</span>
                      <Badge variant="secondary">
                        {Math.floor(pausedExam.timeRemaining / 60)}:{(pausedExam.timeRemaining % 60).toString().padStart(2, '0')} Min
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Aufgaben:</span>
                      <span className="font-medium">
                        {pausedExam.session.tasks.filter(t => t.examStatus === 'answered').length} / {pausedExam.session.tasks.length} beantwortet
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={onDiscardPausedExam}
                      className="flex-1 sm:flex-initial"
                    >
                      <Trash size={14} className="mr-1.5" />
                      Verwerfen
                    </Button>
                    <Button 
                      size="sm"
                      onClick={onResumePausedExam}
                      className="flex-1 sm:flex-initial bg-yellow-500 hover:bg-yellow-600 text-white"
                    >
                      <Play size={14} className="mr-1.5" />
                      Fortsetzen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prüfungsdauer */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock size={18} />
                Prüfungsdauer
              </CardTitle>
              <CardDescription>
                Wähle die Dauer für deine Prüfungssimulation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
                className="grid grid-cols-3 gap-4"
              >
                {[30, 45, 60, 90, 120].map((mins) => (
                  <div key={mins}>
                    <RadioGroupItem
                      value={String(mins)}
                      id={`duration-${mins}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`duration-${mins}`}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                    >
                      <span className="text-2xl font-bold">{mins}</span>
                      <span className="text-xs text-muted-foreground">Minuten</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Aufgabenanzahl */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardText size={18} />
                Aufgabenanzahl
              </CardTitle>
              <CardDescription>
                Automatisch basierend auf Dauer oder feste Anzahl
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={taskCountMode}
                onValueChange={(v) => setTaskCountMode(v as 'auto' | 'fixed')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="auto" />
                  <Label htmlFor="auto" className="cursor-pointer">
                    Automatisch ({autoTaskCount} Aufgaben für {duration} Min.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="cursor-pointer">
                    Feste Anzahl
                  </Label>
                </div>
              </RadioGroup>

              {taskCountMode === 'fixed' && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span>Anzahl Aufgaben</span>
                    <span className="font-medium">{fixedTaskCount}</span>
                  </div>
                  <Slider
                    value={[fixedTaskCount]}
                    onValueChange={([v]) => setFixedTaskCount(v)}
                    min={3}
                    max={15}
                    step={1}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schwierigkeitsmix */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChartBar size={18} />
                Schwierigkeitsmix
              </CardTitle>
              <CardDescription>
                Verteilung der Schwierigkeitsstufen (Standard: 40% / 40% / 20%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Einfach
                  </span>
                  <span className="font-medium">{difficultyMix.easy}%</span>
                </div>
                <Slider
                  value={[difficultyMix.easy]}
                  onValueChange={([v]) => handleDifficultyChange('easy', v)}
                  min={0}
                  max={100}
                  step={5}
                  className="[&>span:first-child]:bg-green-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    Mittel
                  </span>
                  <span className="font-medium">{difficultyMix.medium}%</span>
                </div>
                <Slider
                  value={[difficultyMix.medium]}
                  onValueChange={([v]) => handleDifficultyChange('medium', v)}
                  min={0}
                  max={100}
                  step={5}
                  className="[&>span:first-child]:bg-yellow-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    Schwer
                  </span>
                  <span className="font-medium">{difficultyMix.hard}%</span>
                </div>
                <Slider
                  value={[difficultyMix.hard]}
                  onValueChange={([v]) => handleDifficultyChange('hard', v)}
                  min={0}
                  max={100}
                  step={5}
                  className="[&>span:first-child]:bg-red-500"
                />
              </div>

              {/* Vorschau */}
              <div className="flex h-3 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${difficultyMix.easy}%` }}
                />
                <div
                  className="bg-yellow-500 transition-all"
                  style={{ width: `${difficultyMix.medium}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${difficultyMix.hard}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Start Button */}
          <Button
            onClick={handleStartExam}
            disabled={!hasEnoughContent}
            size="lg"
            className="w-full"
          >
            <Lightning size={20} className="mr-2" weight="fill" />
            Prüfung starten
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Die Prüfung läuft unter echten Bedingungen: Keine Hinweise, keine Musterlösungen während der Bearbeitung.
          </p>
        </div>
      </main>
    </div>
  )
}
