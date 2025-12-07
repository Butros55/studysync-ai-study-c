import { useState, useCallback, useEffect, useRef } from 'react'
import { Module, Script, ExamSession, ExamTask, ExamResults, TopicStats } from '@/lib/types'
import { ExamSetup, ExamConfig } from './ExamSetup'
import { ExamPreparation } from './ExamPreparation'
import { ExamSessionScreen } from './ExamSessionScreen'
import { ExamResultsScreen } from './ExamResultsScreen'
import { 
  extractExamStyle, 
  generateExamTasks, 
  evaluateExamAnswer 
} from '@/lib/exam-generator'
import { generateId } from '@/lib/utils-app'
import { useLLMModel } from '@/hooks/use-llm-model'
import { usePreferredInputMode } from '@/hooks/use-preferred-input-mode'
import { loadModuleStats, saveModuleStats } from '@/lib/recommendations'
import { 
  savePausedExam, 
  loadPausedExam, 
  clearPausedExam,
  type PausedExam 
} from '@/lib/exam-storage'
import { toast } from 'sonner'

// Globaler State-Typ für Exam-Generierung (wird in App.tsx verwendet)
export interface ExamGenerationState {
  moduleId: string
  moduleName: string
  phase: 'preparing' | 'ready'
  progress: number
  isComplete: boolean
  session: ExamSession | null
}

interface ExamModeProps {
  module: Module
  scripts: Script[]
  onBack: () => void
  /** Formelsammlungen für die Prüfung */
  formulaSheets?: Script[]
  /** Globaler Generierungs-State (wird von App.tsx verwaltet) */
  generationState?: ExamGenerationState | null
  /** Callback um den Generierungs-State zu aktualisieren */
  onGenerationStateChange?: (state: ExamGenerationState | null) => void
  /** Callback wenn minimiert wird - User geht zurück zur vorherigen View */
  onMinimizeToBackground?: () => void
}

type ExamPhase = 'setup' | 'preparing' | 'ready' | 'in-progress' | 'results'

export function ExamMode({ 
  module, 
  scripts, 
  onBack, 
  formulaSheets = [],
  generationState,
  onGenerationStateChange,
  onMinimizeToBackground,
}: ExamModeProps) {
  // Initialisiere Phase basierend auf externem State (falls vorhanden)
  const initialPhase: ExamPhase = generationState?.moduleId === module.id 
    ? generationState.phase 
    : 'setup'
  
  const [phase, setPhase] = useState<ExamPhase>(initialPhase)
  const [session, setSession] = useState<ExamSession | null>(generationState?.session || null)
  const [results, setResults] = useState<ExamResults | null>(null)
  const [preparationProgress, setPreparationProgress] = useState(generationState?.progress || 0)
  const [preparationStep, setPreparationStep] = useState<'style' | 'generating' | 'finalizing'>('style')
  const [generatedCount, setGeneratedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pausedExam, setPausedExam] = useState<PausedExam | null>(null)
  const [initialTimeRemaining, setInitialTimeRemaining] = useState<number | null>(null)

  // Refs für stabile Callbacks und Mounted-Status
  const isMountedRef = useRef(true)
  const onGenerationStateChangeRef = useRef(onGenerationStateChange)
  
  // Update ref wenn sich der Callback ändert
  useEffect(() => {
    onGenerationStateChangeRef.current = onGenerationStateChange
  }, [onGenerationStateChange])
  
  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const { standardModel } = useLLMModel()
  const { mode: preferredInputMode } = usePreferredInputMode()

  // Sync mit externem generationState wenn wir wieder geöffnet werden
  useEffect(() => {
    if (generationState?.moduleId === module.id) {
      if (generationState.phase === 'preparing' || generationState.phase === 'ready') {
        setPhase(generationState.phase)
        setPreparationProgress(generationState.progress)
        if (generationState.session) {
          setSession(generationState.session)
        }
      }
    }
  }, [generationState, module.id])

  // Update externen State wenn sich lokaler State ändert
  useEffect(() => {
    if (phase === 'preparing' || phase === 'ready') {
      onGenerationStateChange?.({
        moduleId: module.id,
        moduleName: module.name,
        phase,
        progress: preparationProgress,
        isComplete: phase === 'ready',
        session,
      })
    } else {
      // Wenn wir in-progress oder results sind, lösche den externen State
      if (phase === 'in-progress') {
        onGenerationStateChange?.(null)
      }
    }
  }, [phase, preparationProgress, session, module.id, module.name, onGenerationStateChange])

  // Check for paused exam on mount
  useEffect(() => {
    const paused = loadPausedExam(module.id)
    if (paused) {
      setPausedExam(paused)
    }
  }, [module.id])

  // Kategorisiere Skripte
  const categorizedScripts = {
    scripts: scripts.filter(s => s.category === 'script' || !s.category),
    exercises: scripts.filter(s => s.category === 'exercise'),
    solutions: scripts.filter(s => s.category === 'solution'),
    exams: scripts.filter(s => s.category === 'exam'),
  }

  // Lade Modul-Statistiken für Schwachstellenanalyse
  const getTopicStats = (): TopicStats[] => {
    const allStats = loadModuleStats()
    const moduleStats = allStats.find(s => s.moduleId === module.id)
    return moduleStats?.topics || []
  }

  // Starte Prüfungsvorbereitung
  const handleStartExam = useCallback(async (config: ExamConfig) => {
    // Hilfsfunktion für sichere State-Updates (nur wenn mounted)
    const safeSetState = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)) => {
      if (isMountedRef.current) {
        setter(value as T)
      }
    }
    
    // Hilfsfunktion um den globalen State zu aktualisieren (funktioniert auch wenn unmounted)
    const updateGlobalState = (update: Partial<ExamGenerationState>) => {
      onGenerationStateChangeRef.current?.({
        moduleId: module.id,
        moduleName: module.name,
        phase: 'preparing',
        progress: 0,
        isComplete: false,
        session: null,
        ...update,
      })
    }
    
    safeSetState(setPhase, 'preparing')
    safeSetState(setPreparationProgress, 0)
    safeSetState(setPreparationStep, 'style')
    updateGlobalState({ phase: 'preparing', progress: 0 })
    
    try {
      // Schritt 1: Stilprofil extrahieren
      safeSetState(setPreparationStep, 'style')
      safeSetState(setPreparationProgress, 10)
      updateGlobalState({ progress: 10 })
      
      const styleProfile = await extractExamStyle(categorizedScripts.exams, standardModel)
      safeSetState(setPreparationProgress, 25)
      updateGlobalState({ progress: 25 })

      // Schritt 2: Aufgaben generieren
      safeSetState(setPreparationStep, 'generating')
      
      const taskCount = config.taskCount === 'auto' 
        ? Math.max(3, Math.min(10, Math.floor(config.duration / 8)))
        : config.taskCount
      
      safeSetState(setTotalCount, taskCount)
      safeSetState(setGeneratedCount, 0)

      const moduleData = {
        scripts: categorizedScripts.scripts,
        exercises: categorizedScripts.exercises,
        solutions: categorizedScripts.solutions,
        exams: categorizedScripts.exams,
        topicStats: getTopicStats(),
      }

      const examTasks = await generateExamTasks(
        styleProfile,
        moduleData,
        module.id,
        taskCount,
        config.difficultyMix,
        standardModel,
        (current, total) => {
          const progress = 25 + (current / total) * 60
          safeSetState(setGeneratedCount, current)
          safeSetState(setPreparationProgress, progress)
          updateGlobalState({ progress })
        },
        preferredInputMode || undefined,
        config.duration // Pass exam duration for blueprint planning
      )

      // Schritt 3: Session finalisieren
      safeSetState(setPreparationStep, 'finalizing')
      safeSetState(setPreparationProgress, 90)
      updateGlobalState({ progress: 90 })

      const newSession: ExamSession = {
        id: generateId(),
        moduleId: module.id,
        startedAt: new Date().toISOString(),
        duration: config.duration,
        difficultyMix: config.difficultyMix,
        tasks: examTasks,
        status: 'in-progress',
      }

      safeSetState(setSession, newSession)
      safeSetState(setPreparationProgress, 100)
      
      // Wechsel zu 'ready' Phase statt sofort zu starten
      safeSetState(setPhase, 'ready')
      updateGlobalState({ phase: 'ready', progress: 100, isComplete: true, session: newSession })
      toast.success('Prüfung wurde generiert!')

    } catch (error) {
      console.error('Fehler bei Prüfungsvorbereitung:', error)
      toast.error('Fehler bei der Prüfungsvorbereitung. Bitte versuche es erneut.')
      safeSetState(setPhase, 'setup')
      onGenerationStateChangeRef.current?.(null)
    }
  }, [categorizedScripts, module.id, module.name, standardModel, preferredInputMode])

  // Tatsächlicher Start der Prüfung
  const handleActualStart = useCallback(() => {
    if (!session) return
    setPhase('in-progress')
    onGenerationStateChange?.(null) // Generierung abgeschlossen, Widget verstecken
    toast.success('Prüfung gestartet! Viel Erfolg!')
  }, [session, onGenerationStateChange])

  // Minimieren Handler - User geht zurück zur vorherigen View
  const handleMinimize = useCallback(() => {
    // Rufe den Callback auf, damit App.tsx den User zurückbringt
    onMinimizeToBackground?.()
  }, [onMinimizeToBackground])

  // Aktualisiere Task-Antwort
  const handleUpdateTask = useCallback((taskId: string, updates: Partial<ExamTask>) => {
    setSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        tasks: prev.tasks.map(t => 
          t.id === taskId ? { ...t, ...updates } : t
        ),
      }
    })
  }, [])

  // Prüfung abgeben und auswerten
  const handleSubmitExam = useCallback(async () => {
    if (!session) return

    toast.info('Prüfung wird ausgewertet...')

    const updatedSession: ExamSession = {
      ...session,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    }
    setSession(updatedSession)

    try {
      // Bewerte alle Aufgaben
      const taskResults = await Promise.all(
        session.tasks.map(async (task) => {
          if (task.examStatus === 'unanswered') {
            return {
              taskId: task.id,
              isCorrect: false,
              earnedPoints: 0,
              maxPoints: task.points || 10,
              feedback: 'Keine Antwort eingereicht.',
            }
          }

          const evaluation = await evaluateExamAnswer(task, standardModel)
          return {
            taskId: task.id,
            isCorrect: evaluation.isCorrect,
            earnedPoints: evaluation.earnedPoints,
            maxPoints: task.points || 10,
            feedback: evaluation.feedback,
          }
        })
      )

      // Berechne Gesamtergebnis
      const totalScore = taskResults.reduce((sum, r) => sum + r.earnedPoints, 0)
      const maxScore = taskResults.reduce((sum, r) => sum + r.maxPoints, 0)
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
      const correctCount = taskResults.filter(r => r.isCorrect).length
      const incorrectCount = taskResults.filter(r => !r.isCorrect && r.earnedPoints === 0).length
      const unansweredCount = session.tasks.filter(t => t.examStatus === 'unanswered').length

      // Themenanalyse
      const topicMap = new Map<string, { correct: number; total: number }>()
      session.tasks.forEach((task, index) => {
        const topic = task.topic || 'Allgemein'
        const result = taskResults[index]
        const current = topicMap.get(topic) || { correct: 0, total: 0 }
        topicMap.set(topic, {
          correct: current.correct + (result.isCorrect ? 1 : 0),
          total: current.total + 1,
        })
      })

      const topicAnalysis = Array.from(topicMap.entries()).map(([topic, stats]) => ({
        topic,
        correct: stats.correct,
        total: stats.total,
        percentage: (stats.correct / stats.total) * 100,
        isWeak: (stats.correct / stats.total) < 0.5,
      }))

      const weakTopics = topicAnalysis.filter(t => t.isWeak).map(t => t.topic)
      const strongTopics = topicAnalysis.filter(t => t.percentage >= 75).map(t => t.topic)

      // Empfehlungen generieren
      const recommendations: string[] = []
      if (weakTopics.length > 0) {
        recommendations.push(`Konzentriere dich auf diese Themen: ${weakTopics.join(', ')}`)
      }
      if (percentage < 50) {
        recommendations.push('Wiederhole die Grundlagen aus den Vorlesungsskripten.')
        recommendations.push('Löse mehr Übungsaufgaben zu den schwachen Themen.')
      } else if (percentage < 75) {
        recommendations.push('Übe besonders die mittelschweren und schweren Aufgaben.')
      } else {
        recommendations.push('Super Leistung! Vertiefe dein Wissen mit komplexeren Aufgaben.')
      }
      recommendations.push('Nutze den Karteikarten-Modus für regelmäßige Wiederholung.')

      const examResults: ExamResults = {
        totalScore,
        maxScore,
        percentage,
        correctCount,
        incorrectCount,
        unansweredCount,
        taskResults,
        topicAnalysis,
        recommendations,
        weakTopics,
        strongTopics,
      }

      // Speichere Statistiken
      const allStats = loadModuleStats()
      let moduleStats = allStats.find(s => s.moduleId === module.id)
      if (!moduleStats) {
        moduleStats = {
          moduleId: module.id,
          topics: [],
          lastUpdated: new Date().toISOString(),
        }
        allStats.push(moduleStats)
      }

      // Update topic stats
      session.tasks.forEach((task, index) => {
        const topic = task.topic || 'Allgemein'
        const result = taskResults[index]
        let topicStat = moduleStats!.topics.find(t => t.topic === topic)
        if (!topicStat) {
          topicStat = { topic, correct: 0, incorrect: 0 }
          moduleStats!.topics.push(topicStat)
        }
        if (result.isCorrect) {
          topicStat.correct++
        } else {
          topicStat.incorrect++
        }
        topicStat.lastPracticed = new Date().toISOString()
      })
      moduleStats.lastUpdated = new Date().toISOString()
      saveModuleStats(allStats)

      setResults(examResults)
      setSession({
        ...updatedSession,
        status: 'evaluated',
        results: examResults,
      })
      setPhase('results')
      
      toast.success('Auswertung abgeschlossen!')

    } catch (error) {
      console.error('Fehler bei Auswertung:', error)
      toast.error('Fehler bei der Auswertung. Ergebnisse können unvollständig sein.')
      
      // Fallback Ergebnisse
      const fallbackResults: ExamResults = {
        totalScore: 0,
        maxScore: session.tasks.reduce((sum, t) => sum + (t.points || 10), 0),
        percentage: 0,
        correctCount: 0,
        incorrectCount: session.tasks.length,
        unansweredCount: 0,
        taskResults: session.tasks.map(t => ({
          taskId: t.id,
          isCorrect: false,
          earnedPoints: 0,
          maxPoints: t.points || 10,
          feedback: 'Auswertung fehlgeschlagen.',
        })),
        topicAnalysis: [],
        recommendations: ['Bitte versuche die Prüfung erneut.'],
        weakTopics: [],
        strongTopics: [],
      }
      setResults(fallbackResults)
      setPhase('results')
    }
  }, [session, module.id, standardModel])

  // Exit handler
  const handleExit = useCallback(() => {
    clearPausedExam(module.id)
    setPhase('setup')
    setSession(null)
    setResults(null)
    setPausedExam(null)
    setInitialTimeRemaining(null)
  }, [module.id])

  // Pause handler
  const handlePauseExam = useCallback(() => {
    if (!session) return
    
    // Calculate remaining time (approximate based on session duration)
    const startTime = new Date(session.startedAt).getTime()
    const elapsed = (Date.now() - startTime) / 1000
    const remaining = Math.max(0, session.duration * 60 - elapsed)
    
    savePausedExam(module.id, session, Math.floor(remaining))
    toast.success('Prüfung pausiert und gespeichert!')
    
    setPhase('setup')
    setSession(null)
    setPausedExam(loadPausedExam(module.id))
  }, [session, module.id])

  // Resume handler
  const handleResumePausedExam = useCallback(() => {
    if (!pausedExam) return
    
    const { session: savedSession, timeRemaining } = pausedExam
    
    // Update session start time to account for pause
    const adjustedSession: ExamSession = {
      ...savedSession,
      startedAt: new Date(Date.now() - (savedSession.duration * 60 - timeRemaining) * 1000).toISOString(),
      status: 'in-progress',
    }
    
    setSession(adjustedSession)
    setInitialTimeRemaining(timeRemaining)
    clearPausedExam(module.id)
    setPausedExam(null)
    setPhase('in-progress')
    toast.success('Prüfung wird fortgesetzt!')
  }, [pausedExam, module.id])

  // Discard paused exam handler
  const handleDiscardPausedExam = useCallback(() => {
    clearPausedExam(module.id)
    setPausedExam(null)
    toast.info('Pausierte Prüfung wurde verworfen.')
  }, [module.id])

  // Retry handler
  const handleRetry = useCallback(() => {
    clearPausedExam(module.id)
    setPhase('setup')
    setSession(null)
    setResults(null)
    setInitialTimeRemaining(null)
  }, [module.id])

  // Render based on phase
  switch (phase) {
    case 'setup':
      return (
        <ExamSetup
          module={module}
          scripts={scripts}
          onBack={onBack}
          onStartExam={handleStartExam}
          pausedExam={pausedExam}
          onResumePausedExam={handleResumePausedExam}
          onDiscardPausedExam={handleDiscardPausedExam}
        />
      )

    case 'preparing':
      // Zeige den Ladescreen
      return (
        <ExamPreparation
          module={module}
          progress={preparationProgress}
          currentStep={preparationStep}
          generatedCount={generatedCount}
          totalCount={totalCount}
          isComplete={false}
          onMinimize={handleMinimize}
        />
      )

    case 'ready':
      // Prüfung ist generiert, warte auf manuellen Start
      return (
        <ExamPreparation
          module={module}
          progress={100}
          currentStep="finalizing"
          generatedCount={totalCount}
          totalCount={totalCount}
          isComplete={true}
          onStart={handleActualStart}
          onMinimize={handleMinimize}
        />
      )

    case 'in-progress':
      if (!session) return null
      return (
        <ExamSessionScreen
          session={session}
          onUpdateTask={handleUpdateTask}
          onSubmitExam={handleSubmitExam}
          onExit={handleExit}
          onPauseExam={handlePauseExam}
          formulaSheets={formulaSheets}
        />
      )

    case 'results':
      if (!session || !results) return null
      return (
        <ExamResultsScreen
          session={session}
          results={results}
          onBack={onBack}
          onRetry={handleRetry}
        />
      )

    default:
      return null
  }
}
