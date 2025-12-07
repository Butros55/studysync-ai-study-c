import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useModules, useScripts, useNotes, useTasks, useFlashcards, migrateFromServerIfNeeded } from './hooks/use-database'
import { storageReady, downloadExportFile, importData } from './lib/storage'
import { Module, Script, StudyNote, Task, Flashcard, StudyRoom } from './lib/types'
import { ModuleCard } from './components/ModuleCard'
import { CreateModuleDialog } from './components/CreateModuleDialog'
import { EditModuleDialog } from './components/EditModuleDialog'
import { ModuleView } from './components/ModuleView'
import { TaskSolver } from './components/TaskSolver'
import { FlashcardStudy } from './components/FlashcardStudy'
import { QuizMode } from './components/QuizMode'
import { EmptyState } from './components/EmptyState'
import { NotificationCenter, PipelineTask } from './components/NotificationCenter'
import { StatisticsDashboard } from './components/StatisticsDashboard'
import { CostTrackingDashboard } from './components/CostTrackingDashboard'
import { DebugModeToggle } from './components/DebugModeToggle'
import { LocalStorageIndicator } from './components/LocalStorageIndicator'
import { TutorDashboard } from './components/TutorDashboard'
import { ExamMode, type ExamGenerationState } from './components/ExamMode'
import { ExamPreparationMinimized } from './components/ExamPreparation'
import { AIPreparation, AIPreparationMinimized, type AIActionType, type AIActionItem } from './components/AIPreparation'
import { OnboardingTutorial, useOnboarding, OnboardingTrigger } from './components/OnboardingTutorial'
import { InputModeSettingsButton } from './components/InputModeSettings'
import { normalizeHandwritingOutput } from './components/MarkdownRenderer'
import { StudyRoomView } from './components/StudyRoomView'
import { Button } from './components/ui/button'
import { Plus, ChartLine, Sparkle, CurrencyDollar, DownloadSimple } from '@phosphor-icons/react'
import { generateId, getRandomColor } from './lib/utils-app'
import { calculateNextReview } from './lib/spaced-repetition'
import { toast } from 'sonner'
import { taskQueue } from './lib/task-queue'
import { llmWithRetry } from './lib/llm-utils'
import { useLLMModel } from './hooks/use-llm-model'
import { extractTagsFromQuestion, generateTaskTitle } from './lib/task-tags'
import { updateTopicStats } from './lib/recommendations'
import { enqueueAnalysis, onAnalysisProgress, removeFromAnalysisQueue } from './lib/analysis-queue'
import { deleteDocumentAnalysis } from './lib/analysis-storage'
import { invalidateModuleProfile } from './lib/module-profile-builder'
import { buildGenerationContext, formatContextForPrompt } from './lib/generation-context'
import { getUserPreferencePreferredInputMode } from './lib/analysis-storage'
import { runValidationPipeline } from './lib/task-validator'
import { normalizeTags, getModuleAllowedTags, formatAllowedTagsForPrompt, migrateExistingTags } from './lib/tag-canonicalizer'
import { createStudyRoomApi, joinStudyRoomApi, fetchStudyRoom, setReadyState, startStudyRound, voteForExtension, submitStudyRound, endStudyRound, leaveStudyRoom, limitAnswerPreview } from './lib/study-room-api'
import { ensureStudyRoomIdentity, loadStudyRoomIdentity, updateStudyRoomNickname } from './lib/study-room-identity'
import type { DocumentType } from './lib/analysis-types'

// Key for tracking tag migration
const TAG_MIGRATION_KEY = 'studysync_tag_migration_v1'

const buildHandwritingPrompt = (question: string) => `Du bist ein Experte für das Lesen von Handschrift und die Erkennung mathematischer Notationen.

Analysiere das Bild und transkribiere EXAKT was du siehst.

WICHTIGE REGELN FÜR MATHEMATISCHE SYMBOLE:
1. Wurzelzeichen (√) IMMER als LaTeX: \\sqrt{...} 
   - Beispiel: √a → \\sqrt{a}
   - Beispiel: √(a²+b) → \\sqrt{a^2 + b}
   - Das Wurzelzeichen sieht aus wie ein Häkchen mit horizontaler Linie darüber

2. Brüche IMMER als LaTeX: \\frac{Zähler}{Nenner}
   - Beispiel: a/b → \\frac{a}{b}
   - Horizontale Linien mit Zahlen darüber und darunter sind Brüche

3. Potenzen/Hochzahlen: a^{n} oder a^n
   - Kleine Zahlen rechts oben sind Exponenten
   - Beispiel: a² → a^2, x³ → x^3

4. Indizes (tiefgestellt): a_{n}
   - Kleine Zahlen rechts unten sind Indizes

5. Griechische Buchstaben als LaTeX:
   - α → \\alpha, β → \\beta, γ → \\gamma, π → \\pi, Σ → \\sum, etc.

6. Weitere Symbole:
   - × oder · (Multiplikation) → \\cdot oder \\times
   - ÷ → \\div
   - ≠ → \\neq
   - ≤ → \\leq, ≥ → \\geq
   - ∞ → \\infty
   - ∫ → \\int

KONTEXT - Die Fragestellung war: ${question}

AUSGABEFORMAT:
- Gib mathematische Ausdrücke in LaTeX-Notation zurück
- Für komplexe Formeln nutze Display-Math: $$...$$
- Für inline Formeln nutze: $...$
- Tabellen als Markdown-Tabellen
- NUR die Transkription, keine Kommentare oder Bewertung`

function App() {
  // Datenbank-Hooks mit SQLite-Backend
  const { 
    data: modules, 
    create: createModule, 
    update: updateModule,
    remove: removeModule,
    setItems: setModules,
    loading: modulesLoading 
  } = useModules()
  
  const { 
    data: scripts, 
    create: createScript, 
    remove: removeScript,
    setItems: setScripts 
  } = useScripts()
  
  const { 
    data: notes, 
    create: createNote, 
    remove: removeNote,
    setItems: setNotes 
  } = useNotes()
  
  const { 
    data: tasks, 
    create: createTask, 
    update: updateTask,
    remove: removeTask,
    setItems: setTasks 
  } = useTasks()
  
  const { 
    data: flashcards, 
    create: createFlashcard, 
    update: updateFlashcard,
    remove: removeFlashcard,
    setItems: setFlashcards 
  } = useFlashcards()

  const { standardModel, visionModel } = useLLMModel()
  
  // Onboarding Tutorial
  const { showOnboarding, isChecked, completeOnboarding, resetOnboarding } = useOnboarding()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editModuleDialogOpen, setEditModuleDialogOpen] = useState(false)
  const [moduleToEdit, setModuleToEdit] = useState<Module | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [taskSequence, setTaskSequence] = useState<Task[] | null>(null)
  const [activeSequenceIndex, setActiveSequenceIndex] = useState<number | null>(null)
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[] | null>(null)
  const [showStatistics, setShowStatistics] = useState(false)
  const [showCostTracking, setShowCostTracking] = useState(false)
  const [showQuizMode, setShowQuizMode] = useState(false)
  const [showExamMode, setShowExamMode] = useState(false)
  const [taskFeedback, setTaskFeedback] = useState<{
    isCorrect: boolean
    hints?: string[]
    transcription?: string
  } | null>(null)
  
  const [pipelineTasks, setPipelineTasks] = useState<PipelineTask[]>([])
  const [storageInitialized, setStorageInitialized] = useState(false)
  
  // Globaler State für Exam-Generierung (damit das Widget überall sichtbar ist)
  const [examGenerationState, setExamGenerationState] = useState<ExamGenerationState | null>(null)
  
  // Globaler State für andere KI-Aktionen (Analyse, Notizen, Aufgaben, Karteikarten)
  const [aiActionState, setAiActionState] = useState<{
    type: AIActionType
    moduleName: string
    moduleId: string
    progress: number
    currentStep: number
    processedCount: number
    totalCount: number
    isComplete: boolean
    items: AIActionItem[]
    isMinimized: boolean
  } | null>(null)
  const [studyRoom, setStudyRoom] = useState<StudyRoom | null>(null)
  const [studyRoomBusy, setStudyRoomBusy] = useState(false)
  const [studyRoomError, setStudyRoomError] = useState<string | null>(null)
  const [studyRoomIdentity, setStudyRoomIdentity] = useState(() => loadStudyRoomIdentity())
  const [studyRoomSolveContext, setStudyRoomSolveContext] = useState<{
    roomId: string
    roundId: string
    taskId: string
    mode: 'collab' | 'challenge'
    roomCode: string
    roundIndex: number
  } | null>(null)
  
  // Ref für das Modul/Scripts während einer laufenden Exam-Generierung
  // Damit die Generierung weiterläuft, auch wenn der User das Modul wechselt
  const examGenerationModuleRef = useRef<{ module: Module; scripts: Script[] } | null>(null)
  
  // Ref für versteckten File-Input (Import)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Export-Handler
  const handleExportData = async () => {
    try {
      await downloadExportFile()
      toast.success('Backup erfolgreich erstellt!')
    } catch (error) {
      console.error('[Export] Failed:', error)
      toast.error('Export fehlgeschlagen')
    }
  }

  // Import-Handler
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await importData(file, 'replace')
      if (result.success) {
        toast.success(result.message)
        // Seite neu laden um die importierten Daten anzuzeigen
        window.location.reload()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('[Import] Failed:', error)
      toast.error('Import fehlgeschlagen')
    }
    
    // Input zurücksetzen
    if (importInputRef.current) {
      importInputRef.current.value = ''
    }
  }

  const triggerImportDialog = () => {
    importInputRef.current?.click()
  }

  // =========================================
  // StudyRoom (Lerngruppe) Helpers & Actions
  // =========================================

  const syncStudyRoomState = useCallback((room: StudyRoom | null) => {
    setStudyRoom(room)
  }, [])

  const refreshStudyRoom = useCallback(
    async (roomId?: string) => {
      const targetRoomId = roomId || studyRoom?.id
      if (!targetRoomId || !studyRoomIdentity?.userId) return
      try {
        const room = await fetchStudyRoom(targetRoomId, studyRoomIdentity.userId)
        syncStudyRoomState(room)
        setStudyRoomError(null)
      } catch (error) {
        console.error('[StudyRoom] Polling failed', error)
        setStudyRoomError(error instanceof Error ? error.message : String(error))
      }
    },
    [studyRoom?.id, studyRoomIdentity?.userId, syncStudyRoomState]
  )

  const handleCreateStudyRoom = async (params: { moduleId: string; topic?: string; nickname: string }) => {
    const identity = ensureStudyRoomIdentity(params.nickname)
    setStudyRoomIdentity(identity)
    updateStudyRoomNickname(identity.nickname)
    setStudyRoomBusy(true)
    try {
      const room = await createStudyRoomApi({
        moduleId: params.moduleId,
        topic: params.topic,
        nickname: identity.nickname,
        userId: identity.userId,
      })
      syncStudyRoomState(room)
      setSelectedModuleId(params.moduleId)
      setStudyRoomError(null)
      toast.success('Lerngruppe erstellt')
    } catch (error) {
      console.error('[StudyRoom] create failed', error)
      setStudyRoomError(error instanceof Error ? error.message : String(error))
      toast.error('Lerngruppe konnte nicht erstellt werden')
    } finally {
      setStudyRoomBusy(false)
    }
  }

  const handleJoinStudyRoom = async (params: { code: string; nickname: string }) => {
    const identity = ensureStudyRoomIdentity(params.nickname)
    setStudyRoomIdentity(identity)
    updateStudyRoomNickname(identity.nickname)
    setStudyRoomBusy(true)
    try {
      const room = await joinStudyRoomApi({
        code: params.code,
        nickname: identity.nickname,
        userId: identity.userId,
      })
      syncStudyRoomState(room)
      setSelectedModuleId(room.moduleId)
      setStudyRoomError(null)
      toast.success('Raum beigetreten')
    } catch (error) {
      console.error('[StudyRoom] join failed', error)
      setStudyRoomError(error instanceof Error ? error.message : String(error))
      toast.error('Beitritt fehlgeschlagen')
    } finally {
      setStudyRoomBusy(false)
    }
  }

  const handleToggleReady = async (ready: boolean) => {
    if (!studyRoom || !studyRoomIdentity) return
    setStudyRoomBusy(true)
    try {
      const room = await setReadyState(studyRoom.id, { userId: studyRoomIdentity.userId, ready })
      syncStudyRoomState(room)
      setStudyRoomError(null)
    } catch (error) {
      console.error('[StudyRoom] ready toggle failed', error)
      setStudyRoomError(error instanceof Error ? error.message : String(error))
      toast.error('Ready-Status konnte nicht gesetzt werden')
    } finally {
      setStudyRoomBusy(false)
    }
  }

  const handleStartStudyRound = async (mode: 'collab' | 'challenge') => {
    if (!studyRoom || !studyRoomIdentity) return
    setStudyRoomBusy(true)
    try {
      const { room, round } = await startStudyRound(studyRoom.id, {
        hostId: studyRoom.host.userId,
        mode,
      })
      syncStudyRoomState(room)
      setStudyRoomError(null)
      toast.success(`Runde gestartet (${mode})`)
    } catch (error) {
      console.error('[StudyRoom] start round failed', error)
      setStudyRoomError(error instanceof Error ? error.message : String(error))
      toast.error('Runde konnte nicht gestartet werden')
    } finally {
      setStudyRoomBusy(false)
    }
  }

  const handleVoteForExtension = async () => {
    if (!studyRoom || !studyRoomIdentity) return
    try {
      const room = await voteForExtension(studyRoom.id, { userId: studyRoomIdentity.userId })
      syncStudyRoomState(room)
      toast.success('Stimme für Verlängerung gezählt')
    } catch (error) {
      console.error('[StudyRoom] vote extension failed', error)
      toast.error('Konnte Verlängerung nicht senden')
    }
  }

  const handleEndStudyRound = async () => {
    if (!studyRoom) return
    setStudyRoomBusy(true)
    try {
      const { room, round } = await endStudyRound(studyRoom.id, { hostId: studyRoom.host.userId })
      syncStudyRoomState(room)
      toast.success('Runde beendet')
    } catch (error) {
      console.error('[StudyRoom] end round failed', error)
      toast.error('Runde konnte nicht beendet werden')
    } finally {
      setStudyRoomBusy(false)
    }
  }

  const handleLeaveStudyRoom = async () => {
    if (!studyRoom || !studyRoomIdentity) {
      setStudyRoom(null)
      setStudyRoomSolveContext(null)
      return
    }

    try {
      await leaveStudyRoom(studyRoom.id, { userId: studyRoomIdentity.userId })
    } catch (error) {
      console.warn('[StudyRoom] leave failed (ignored)', error)
    } finally {
      setStudyRoom(null)
      setStudyRoomSolveContext(null)
      setStudyRoomError(null)
      setActiveTask(null)
      setTaskFeedback(null)
    }
  }

  const openStudyRoomTask = () => {
    if (!studyRoom?.currentRound) {
      toast.info('Keine laufende Runde')
      return
    }

    const roundTask = studyRoom.currentRound.task
    const taskForSolver: Task = {
      id: roundTask.id || studyRoom.currentRound.id,
      moduleId: studyRoom.moduleId,
      question: roundTask.question,
      solution: roundTask.solution,
      difficulty: roundTask.difficulty,
      topic: roundTask.topic,
      tags: roundTask.tags,
      title: `Runde #${studyRoom.currentRound.roundIndex} (${studyRoom.code})`,
      createdAt: studyRoom.currentRound.startedAt,
      completed: false,
      viewedSolution: false,
    }

    setSelectedModuleId(studyRoom.moduleId)
    setTaskSequence(null)
    setActiveSequenceIndex(null)
    setActiveTask(taskForSolver)
    setTaskFeedback(null)
    setStudyRoomSolveContext({
      roomId: studyRoom.id,
      roundId: studyRoom.currentRound.id,
      taskId: taskForSolver.id,
      mode: studyRoom.currentRound.mode,
      roomCode: studyRoom.code,
      roundIndex: studyRoom.currentRound.roundIndex,
    })
  }

  // Einmalige Migration beim App-Start
  useEffect(() => {
    const initStorage = async () => {
      try {
        await storageReady
        // Versuche Daten vom lokalen Server zu migrieren (falls vorhanden)
        const migrated = await migrateFromServerIfNeeded()
        if (migrated) {
          toast.success('Daten wurden erfolgreich migriert')
          // Seite neu laden um die migrierten Daten anzuzeigen
          window.location.reload()
        }
        setStorageInitialized(true)
      } catch (e) {
        console.error('[App] Storage initialization failed:', e)
        setStorageInitialized(true) // Trotzdem fortfahren
      }
    }
    initStorage()
  }, [])

  // Einmalige Tag-Migration für bestehende Tasks
  useEffect(() => {
    const migrateTagsOnce = async () => {
      // Check if migration was already done
      const alreadyMigrated = localStorage.getItem(TAG_MIGRATION_KEY)
      if (alreadyMigrated) return
      
      // Wait for tasks to be loaded
      if (!tasks || tasks.length === 0) return
      
      console.log('[App] Starting one-time tag migration...')
      
      try {
        const result = await migrateExistingTags(
          tasks.map(t => ({ id: t.id, moduleId: t.moduleId, tags: t.tags })),
          async (taskId, updates) => {
            await updateTask(taskId, updates)
          }
        )
        
        // Mark migration as complete
        localStorage.setItem(TAG_MIGRATION_KEY, new Date().toISOString())
        
        if (result.tagsNormalized > 0) {
          console.log(`[App] Tag migration complete: ${result.tasksProcessed} tasks processed, ${result.tagsNormalized} tags normalized`)
          toast.success(`Tags normalisiert: ${result.tagsNormalized} Tags in ${result.tasksProcessed} Aufgaben`)
        } else {
          console.log('[App] Tag migration complete: No tags needed normalization')
        }
        
        if (result.errors.length > 0) {
          console.warn('[App] Tag migration errors:', result.errors)
        }
      } catch (error) {
        console.error('[App] Tag migration failed:', error)
        // Don't mark as complete so it can retry
      }
    }
    
    if (storageInitialized) {
      migrateTagsOnce()
    }
  }, [storageInitialized, tasks, updateTask])

  useEffect(() => {
    if (!studyRoom) return
    const interval = setInterval(() => {
      refreshStudyRoom(studyRoom.id)
    }, 2500)
    return () => clearInterval(interval)
  }, [studyRoom, refreshStudyRoom])

  useEffect(() => {
    if (studyRoomError) {
      toast.error(`Lerngruppe: ${studyRoomError}`)
    }
  }, [studyRoomError])

  // Subscribe to analysis queue progress updates
  useEffect(() => {
    const unsubscribe = onAnalysisProgress((job, status, progress, error) => {
      const taskId = `analyze-${job.documentId}`
      
      if (status === 'queued') {
        // Add new task to pipeline
        setPipelineTasks((current) => {
          // Don't add if already exists
          if (current.some((t) => t.id === taskId)) {
            return current.map((t) =>
              t.id === taskId ? { ...t, status: 'pending', progress: 0 } : t
            )
          }
          return [
            ...current,
            {
              id: taskId,
              type: 'analyze' as const,
              name: job.documentName,
              progress: 0,
              status: 'pending',
              timestamp: Date.now(),
            },
          ]
        })
      } else if (status === 'running') {
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { ...t, status: 'processing', progress } : t
          )
        )
      } else if (status === 'completed') {
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t
          )
        )
      } else if (status === 'error') {
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error', error: 'Analyse fehlgeschlagen', errorDetails: error }
              : t
          )
        )
      }
    })
    
    return unsubscribe
  }, [])

  // Synchronisiere pipelineTasks mit dem AI Action UI
  useEffect(() => {
    // Mapping von PipelineTask-Typen zu AIActionType
    const taskTypeToActionType: Record<string, AIActionType> = {
      'analyze': 'analyze',
      'generate-notes': 'generate-notes',
      'generate-tasks': 'generate-tasks',
      'generate-flashcards': 'generate-flashcards',
    }
    
    // Sammle alle relevanten Tasks nach Typ (nur pending/processing für neuen State)
    const tasksByType: Record<AIActionType, typeof pipelineTasks> = {
      'analyze': [],
      'generate-notes': [],
      'generate-tasks': [],
      'generate-flashcards': [],
    }
    
    for (const task of pipelineTasks) {
      const actionType = taskTypeToActionType[task.type]
      if (actionType) {
        tasksByType[actionType].push(task)
      }
    }
    
    // Finde den aktiven Action-Typ (einer mit pending/processing Tasks)
    const actionTypes: AIActionType[] = ['analyze', 'generate-notes', 'generate-tasks', 'generate-flashcards']
    let activeActionType: AIActionType | null = null
    let activeTasks: typeof pipelineTasks = []
    
    for (const actionType of actionTypes) {
      const tasks = tasksByType[actionType]
      // Nur Tasks die noch laufen (pending/processing) starten ein neues UI
      const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing')
      if (hasActive) {
        activeActionType = actionType
        activeTasks = tasks
        break
      }
    }
    
    setAiActionState(prev => {
      // Wenn keine aktiven Tasks und kein vorheriger State, nichts tun
      if (!activeActionType && !prev) return null
      
      // Wenn keine aktiven Tasks mehr aber vorher noch was lief (wurde gerade fertig)
      if (!activeActionType && prev && !prev.isComplete) {
        // Setze auf complete für die Fertig-Animation
        return { ...prev, isComplete: true, progress: 100 }
      }
      
      // Wenn bereits complete und keine aktiven Tasks, nichts ändern (wird durch Timer entfernt)
      if (!activeActionType && prev?.isComplete) {
        return prev
      }
      
      // Ab hier: Es gibt aktive Tasks
      
      // Berechne den neuen State
      const completedCount = activeTasks.filter(t => t.status === 'completed').length
      const totalProgress = activeTasks.length > 0
        ? activeTasks.reduce((sum, t) => sum + t.progress, 0) / activeTasks.length
        : 0
      const allComplete = activeTasks.every(t => t.status === 'completed' || t.status === 'error')
      
      // Berechne den aktuellen Schritt basierend auf Fortschritt
      let currentStep = 0
      if (totalProgress > 33) currentStep = 1
      if (totalProgress > 66) currentStep = 2
      
      // Finde Modul-Info
      const firstTask = activeTasks[0]
      const script = scripts?.find(s => firstTask?.name === s.name)
      const module = script ? modules?.find(m => m.id === script.moduleId) : null
      
      const newItems = activeTasks.map(t => ({
        id: t.id,
        name: t.name,
        progress: t.progress,
        status: t.status === 'pending' ? 'queued' as const : t.status as 'processing' | 'completed' | 'error',
      }))
      
      // Wenn sich nichts geändert hat, nicht updaten
      if (prev && 
          prev.type === activeActionType &&
          prev.progress === totalProgress &&
          prev.processedCount === completedCount &&
          prev.isComplete === allComplete) {
        return prev
      }
      
      // Wenn schon ein State existiert für diesen Typ, nur updaten
      // WICHTIG: totalCount nur erhöhen, nie verringern (damit die Anzeige stabil bleibt)
      if (prev && prev.type === activeActionType) {
        return {
          ...prev,
          progress: totalProgress,
          currentStep,
          processedCount: completedCount,
          totalCount: Math.max(prev.totalCount, activeTasks.length),
          isComplete: allComplete,
          items: newItems,
        }
      }
      
      // Neuen State erstellen
      return {
        type: activeActionType!,
        moduleName: module?.name || 'Dokumente',
        moduleId: module?.id || '',
        progress: totalProgress,
        currentStep,
        processedCount: completedCount,
        totalCount: activeTasks.length,
        isComplete: allComplete,
        items: newItems,
        isMinimized: false,
      }
    })
  }, [pipelineTasks, modules, scripts])

  // Auto-minimize nach Abschluss, dann Widget ausblenden
  useEffect(() => {
    if (aiActionState?.isComplete && !aiActionState.isMinimized) {
      // Nach 2 Sekunden minimieren
      const minimizeTimer = setTimeout(() => {
        setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)
      }, 2000)
      
      return () => clearTimeout(minimizeTimer)
    }
    
    // Wenn minimiert und complete, nach 3 Sekunden ausblenden
    if (aiActionState?.isComplete && aiActionState.isMinimized) {
      const closeTimer = setTimeout(() => {
        setAiActionState(null)
      }, 3000)
      
      return () => clearTimeout(closeTimer)
    }
  }, [aiActionState?.isComplete, aiActionState?.isMinimized])

  // Handler zum Öffnen des Bearbeitungsdialogs
  const handleEditModule = (module: Module) => {
    setModuleToEdit(module)
    setEditModuleDialogOpen(true)
  }

  const selectedModule = modules?.find((m) => m.id === selectedModuleId)
  const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
  const moduleNotes = notes?.filter((n) => n.moduleId === selectedModuleId) || []
  const moduleTasks = tasks?.filter((t) => t.moduleId === selectedModuleId) || []
  const moduleFlashcards = flashcards?.filter((f) => f.moduleId === selectedModuleId) || []

  const handleCreateModule = async (name: string, code: string, examDate?: string) => {
    const newModule: Module = {
      id: generateId(),
      name,
      code,
      createdAt: new Date().toISOString(),
      color: getRandomColor(),
      examDate,
    }
    try {
      await createModule(newModule)
      toast.success('Modul erfolgreich erstellt')
    } catch (error) {
      console.error('Fehler beim Erstellen des Moduls:', error)
      toast.error('Fehler beim Erstellen des Moduls')
    }
  }

  // Modul bearbeiten
  const handleUpdateModule = async (moduleId: string, updates: Partial<Module>) => {
    if (!modules) return
    
    try {
      await updateModule(moduleId, updates)
      toast.success('Modul aktualisiert')
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Moduls:', error)
      toast.error('Fehler beim Aktualisieren des Moduls')
    }
  }

  // Modul löschen mit allem Inhalt
  const handleDeleteModule = async (moduleId: string) => {
    try {
      // Alle zugehörigen Daten löschen
      const moduleScriptsToDelete = scripts?.filter(s => s.moduleId === moduleId) || []
      const moduleNotesToDelete = notes?.filter(n => n.moduleId === moduleId) || []
      const moduleTasksToDelete = tasks?.filter(t => t.moduleId === moduleId) || []
      const moduleFlashcardsToDelete = flashcards?.filter(f => f.moduleId === moduleId) || []
      
      // Alle Inhalte parallel löschen
      await Promise.all([
        ...moduleScriptsToDelete.map(s => removeScript(s.id)),
        ...moduleNotesToDelete.map(n => removeNote(n.id)),
        ...moduleTasksToDelete.map(t => removeTask(t.id)),
        ...moduleFlashcardsToDelete.map(f => removeFlashcard(f.id)),
      ])
      
      // Dann das Modul selbst löschen
      await removeModule(moduleId)
      
      // Falls gerade in diesem Modul, zurück zur Hauptseite
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null)
      }
      
      toast.success('Modul und alle Inhalte gelöscht')
    } catch (error) {
      console.error('Fehler beim Löschen des Moduls:', error)
      toast.error('Fehler beim Löschen des Moduls')
    }
  }

  const handleUploadScript = async (content: string, name: string, fileType?: string, fileData?: string, category?: string) => {
    if (!selectedModuleId) return

    const taskId = generateId()
    const moduleId = selectedModuleId
    
    const execute = async () => {
      setPipelineTasks((current) => [
        ...current,
        {
          id: taskId,
          type: 'upload',
          name,
          progress: 0,
          status: 'processing',
          timestamp: Date.now(),
        },
      ])

      try {
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 30 } : t))
        )
        
        await new Promise(resolve => setTimeout(resolve, 200))

        const newScript: Script = {
          id: generateId(),
          moduleId: moduleId,
          name,
          content,
          uploadedAt: new Date().toISOString(),
          fileType: fileType || 'text',
          fileData,
          category: (category as Script['category']) || 'script', // Kategorie speichern
        }
        
        await createScript(newScript)
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 70 } : t))
        )
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )

        toast.success(`"${name}" erfolgreich hochgeladen`)
        
        // Enqueue document analysis (runs in background)
        // Map script category to DocumentType
        const documentTypeMap: Record<string, DocumentType> = {
          'script': 'script',
          'exam': 'exam',
          'exercise': 'exercise',
          'formula-sheet': 'formula-sheet',
          'lecture-notes': 'lecture-notes',
          'summary': 'summary',
        }
        const docType: DocumentType = documentTypeMap[newScript.category || 'script'] || 'script'
        
        // Only analyze if we have text content
        if (content && content.trim().length > 0) {
          enqueueAnalysis(
            moduleId,
            newScript.id,
            docType,
            name,
            content
          ).catch((err) => {
            console.warn('[App] Failed to enqueue analysis:', err)
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: 'Upload fehlgeschlagen',
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
              timestamp: Date.now() 
            } : t
          )
        )
        toast.error(`Fehler beim Hochladen von "${name}"`)
      }
    }
    
    await taskQueue.add({ id: taskId, execute })
  }

  const handleGenerateNotes = async (scriptId: string) => {
    const script = scripts?.find((s) => s.id === scriptId)
    if (!script) return

    const taskId = generateId()
    const taskName = script.name

    // Pre-register task so the UI knows the full queue size immediately
    setPipelineTasks((current) => {
      if (current.some((t) => t.id === taskId)) return current
      return [
        ...current,
        {
          id: taskId,
          type: 'generate-notes',
          name: taskName,
          progress: 0,
          status: 'pending',
          timestamp: Date.now(),
        },
      ]
    })
    
    const execute = async () => {
      // Mark as running when the queue starts processing this job
      setPipelineTasks((current) =>
        current.map((t) =>
          t.id === taskId ? { ...t, status: 'processing', timestamp: Date.now() } : t
        )
      )

      try {
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 10 } : t))
        )

        await new Promise(resolve => setTimeout(resolve, 100))

        // Wissenschaftlicher LaTeX-Notizen-Prompt
        const prompt = `Du bist ein Experte für die Erstellung wissenschaftlicher Lernnotizen im LaTeX-Stil.

KURSMATERIAL ZUM ZUSAMMENFASSEN:
${script.content}

ERSTELLE STRUKTURIERTE LERNNOTIZEN MIT FOLGENDEN VORGABEN:

## FORMATIERUNG (WICHTIG!)

1. **Überschriften** mit Markdown:
   - # Hauptthema
   - ## Abschnitt
   - ### Unterabschnitt

2. **Mathematische Formeln** IMMER in LaTeX:
   - Inline: $a^2 + b^2 = c^2$
   - Block (für wichtige Formeln):
     $$f(x) = \\frac{a}{b} + \\sqrt{x}$$

3. **Tabellen** als Markdown:
   | Spalte 1 | Spalte 2 |
   |----------|----------|
   | Wert 1   | Wert 2   |

4. **Listen** für Aufzählungen:
   - Stichpunkt 1
   - Stichpunkt 2

5. **Hervorhebungen**:
   - **Fett** für wichtige Begriffe
   - *Kursiv* für Definitionen

## INHALTLICHE STRUKTUR

1. **Titel & Überblick**
   - Thema klar benennen
   - Kurze Einleitung (1-2 Sätze)

2. **Kernkonzepte**
   - Definitionen präzise formulieren
   - Wichtige Eigenschaften auflisten

3. **Formeln & Gesetze**
   - Alle relevanten Formeln in LaTeX
   - Kurze Erklärung jeder Formel
   - Beispiel: $E = mc^2$ (Energie-Masse-Äquivalenz)

4. **Zusammenhänge & Regeln**
   - Logische Verknüpfungen darstellen
   - Bei Bedarf Wahrheitstabellen

5. **Beispiele**
   - Mindestens ein durchgerechnetes Beispiel
   - Schritt-für-Schritt-Lösung

6. **Merksätze**
   - Wichtigste Punkte zum Einprägen
   - Kurz und prägnant

## VERBOTEN:
- Kein Inhaltsverzeichnis
- Keine Referenzen/Quellenangaben
- Kein Fließtext ohne Struktur
- Keine Wiederholungen

## BEISPIEL FÜR GUTE NOTATION:

### Quadratische Gleichung
Die allgemeine Form lautet:
$$ax^2 + bx + c = 0$$

**Lösungsformel (Mitternachtsformel):**
$$x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

**Diskriminante:** $D = b^2 - 4ac$
- $D > 0$: Zwei reelle Lösungen
- $D = 0$: Eine reelle Lösung
- $D < 0$: Keine reelle Lösung

---

Erstelle jetzt die Lernnotizen auf Deutsch. Nutze konsequent LaTeX für alle mathematischen Ausdrücke!`

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 30 } : t))
        )

        const notesContent = await llmWithRetry(prompt, standardModel, false, 1, 'generate-notes', script.moduleId)

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 85 } : t))
        )

        await new Promise(resolve => setTimeout(resolve, 100))

        const newNote: StudyNote = {
          id: generateId(),
          scriptId: script.id,
          moduleId: script.moduleId,
          content: notesContent,
          generatedAt: new Date().toISOString(),
        }

        await createNote(newNote)
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )

        toast.success(`Notizen für "${script.name}" erfolgreich erstellt`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: 'Erstellung fehlgeschlagen',
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
              timestamp: Date.now() 
            } : t
          )
        )
        toast.error(`Fehler beim Erstellen der Notizen für "${script.name}"`)
      }
    }

    await taskQueue.add({ id: taskId, execute })
  }

  const handleGenerateTasks = async (scriptId: string) => {
    const script = scripts?.find((s) => s.id === scriptId)
    if (!script) return

    const taskId = generateId()
    const taskName = script.name

    // Pre-register task so the queue size is correct before execution starts
    setPipelineTasks((current) => {
      if (current.some((t) => t.id === taskId)) return current
      return [
        ...current,
        {
          id: taskId,
          type: 'generate-tasks',
          name: taskName,
          progress: 0,
          status: 'pending',
          timestamp: Date.now(),
        },
      ]
    })
    
    const execute = async () => {
      // Switch the pre-registered task to processing when it actually runs
      setPipelineTasks((current) =>
        current.map((t) =>
          t.id === taskId ? { ...t, status: 'processing', timestamp: Date.now() } : t
        )
      )

      try {
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 5 } : t))
        )

        // Load user's preferred input mode
        const preferredInputMode = await getUserPreferencePreferredInputMode()

        // Build rich context from analyzed module data
        const contextPack = await buildGenerationContext({
          moduleId: script.moduleId,
          target: 'single-task',
          preferredInputMode,
        })

        // Load existing canonical tags for this module
        const allowedTags = await getModuleAllowedTags(script.moduleId)
        const allowedTagsSection = formatAllowedTagsForPrompt(allowedTags)

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 15 } : t))
        )

        // Format context for prompt
        const moduleContext = formatContextForPrompt(contextPack)

        // Build the prompt with analyzed context (or fallback to script content)
        const contentSection = contextPack.hasAnalyzedData
          ? moduleContext
          : `Kursmaterial:\n${script.content.substring(0, 8000)}`

        const prompt = `Du bist ein erfahrener Dozent. Erstelle 3-5 abwechslungsreiche Übungsaufgaben basierend auf dem bereitgestellten Kontext.

WICHTIG - Aufgaben sollen KURZ und PRÄZISE sein:
- easy = 1-2 Minuten Lösungszeit, sehr kurze Rechenaufgaben
- medium = 3-5 Minuten, mittlere Interpretationsaufgaben  
- hard = 5-10 Minuten, maximal 2-3 Teilaufgaben

Variation: Mische kurze Berechnungen, Verständnisfragen und ab und zu komplexere Aufgaben.

${contentSection}
${contextPack.inputModeConstraints}
${allowedTagsSection}

ANTWORTE NUR MIT VALIDEM JSON in diesem Format:
{
  "tasks": [
    {
      "question": "### Kurzer Titel\n\nKlare, präzise Aufgabenstellung auf Deutsch.",
      "solution": "Kurze, strukturierte Lösung",
      "difficulty": "easy" | "medium" | "hard",
      "topic": "Hauptthema der Aufgabe",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Regeln:
- Fragen in Markdown formatieren (### für Titel, - für Listen)
- Keine Textwüsten - maximal 3-4 Sätze pro Aufgabe
- Teilaufgaben als a), b), c) formatieren
- Alles auf DEUTSCH
- Nutze die analysierten Themen, Definitionen und Formeln aus dem Kontext`

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 30 } : t))
        )

        const response = await llmWithRetry(prompt, standardModel, true, 1, 'generate-tasks', script.moduleId)
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 70 } : t))
        )

        let parsed
        try {
          parsed = JSON.parse(response)
        } catch (parseError) {
          throw new Error('Ungültiges Antwortformat von der KI')
        }

        if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
          throw new Error('Antwort enthält kein tasks-Array')
        }

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 85 } : t))
        )

        // Modul-Informationen für Tags holen
        const moduleInfo = modules?.find(m => m.id === script.moduleId)

        // Create initial tasks from parsed response with normalized tags
        const initialTasks: Task[] = []
        for (const t of parsed.tasks) {
          // Extrahiere zusätzliche Tags wenn nicht vom LLM geliefert
          const extracted = extractTagsFromQuestion(t.question)
          const rawTags = t.tags || extracted.tags
          
          // Normalize tags using the module's tag registry
          const normalizedResult = await normalizeTags(rawTags, script.moduleId)
          
          initialTasks.push({
            id: generateId(),
            moduleId: script.moduleId,
            scriptId: script.id,
            title: generateTaskTitle(t.question),
            question: t.question,
            solution: t.solution,
            difficulty: t.difficulty || extracted.estimatedDifficulty || 'medium',
            topic: t.topic || extracted.topic,
            module: t.module || moduleInfo?.name || extracted.module,
            tags: normalizedResult.tags,
            createdAt: new Date().toISOString(),
            completed: false,
          })
        }

        // Validate each task with quality gate
        const validatedTasks: Task[] = []
        let validationStats = { passed: 0, repaired: 0, failed: 0 }

        for (const task of initialTasks) {
          const validationResult = await runValidationPipeline({
            task,
            preferredInputMode,
            contextPack,
            model: standardModel,
            moduleId: script.moduleId,
            maxRepairAttempts: 2,
            enableDebugReport: false,
            onRegenerate: async (issuesToAvoid) => {
              // Regenerate this single task with issues to avoid
              const regeneratePrompt = `Generiere EINE neue Übungsaufgabe zum Thema "${task.topic || 'Allgemein'}".

${contentSection}
${contextPack.inputModeConstraints}
${allowedTagsSection}

WICHTIG - VERMEIDE DIESE PROBLEME:
- ${issuesToAvoid.join('\n- ')}

ANTWORTE NUR MIT VALIDEM JSON:
{
  "question": "Präzise Aufgabenstellung",
  "solution": "Kurze Lösung",
  "difficulty": "${task.difficulty}",
  "topic": "${task.topic || ''}",
  "tags": ["tag1", "tag2"]
}`
              const response = await llmWithRetry(regeneratePrompt, standardModel, true, 1, 'task-regenerate', script.moduleId)
              const regenerated = JSON.parse(response)
              const extracted = extractTagsFromQuestion(regenerated.question)
              const rawTags = regenerated.tags || extracted.tags
              
              // Normalize tags for regenerated task
              const normalizedResult = await normalizeTags(rawTags, script.moduleId)
              
              return {
                ...task,
                id: generateId(),
                question: regenerated.question,
                solution: regenerated.solution,
                tags: normalizedResult.tags,
                createdAt: new Date().toISOString()
              }
            }
          })

          if (validationResult.passed) {
            if (validationResult.wasRepaired) validationStats.repaired++
            else validationStats.passed++
          } else {
            validationStats.failed++
          }

          validatedTasks.push(validationResult.task as Task)
        }

        // Log validation summary
        if (validationStats.repaired > 0 || validationStats.failed > 0) {
          console.log('[App] Task validation summary:', validationStats)
        }

        // Alle validierten Tasks in die Datenbank speichern
        await Promise.all(validatedTasks.map(task => createTask(task)))
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )

        // Show validation info in toast if repairs/failures occurred
        if (validationStats.repaired > 0 || validationStats.failed > 0) {
          toast.success(
            `${validatedTasks.length} Aufgaben für "${script.name}" erstellt` +
            (validationStats.repaired > 0 ? ` (${validationStats.repaired} repariert)` : '') +
            (validationStats.failed > 0 ? ` (${validationStats.failed} mit Warnungen)` : '')
          )
        } else {
          toast.success(`${validatedTasks.length} Aufgaben für "${script.name}" erstellt`)
        }
      } catch (error) {
        console.error('Fehler bei Aufgabenerstellung:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Erstellung fehlgeschlagen',
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
              timestamp: Date.now()
            } : t
          )
        )
        toast.error(`Fehler beim Erstellen der Aufgaben für "${script.name}"`)
      }
    }

    await taskQueue.add({ id: taskId, execute })
  }

  // Neue Funktion: Generiere Tasks für mehrere Scripts (vom Dashboard)
  const handleGenerateTasksFromDashboard = async (moduleId: string, scriptIds: string[]) => {
    // Filter scripts die zum Modul gehören
    const scriptsToProcess = scripts?.filter(s => scriptIds.includes(s.id) && s.moduleId === moduleId) || []
    
    if (scriptsToProcess.length === 0) {
      toast.info('Keine Skripte zum Generieren gefunden')
      return
    }

    // Starte alle Task-Generierungen sofort, damit die Queue-Groesse im UI stimmt
    scriptsToProcess.forEach((script) => {
      handleGenerateTasks(script.id)
    })
  }

  const handleSubmitTaskAnswer = async (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => {
    if (!activeTask) return

    const isStudyRoomAttempt = !!studyRoomSolveContext && studyRoomSolveContext.taskId === activeTask.id
    const taskId = generateId()
    
    try {
      let userAnswer = answer
      let transcription = ''

      setPipelineTasks((current) => [
        ...current,
        {
          id: taskId,
          type: 'task-submit',
          name: 'Aufgabe wird geprueft',
          progress: 0,
          status: 'processing',
          timestamp: Date.now(),
        },
      ])

      if (isHandwritten && canvasDataUrl) {
        toast.loading('Analysiere deine Handschrift...', { id: 'task-submit' })

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 10, name: 'Handschrift wird analysiert' } : t))
        )

        try {
          const visionPrompt = buildHandwritingPrompt(activeTask.question)

          const visionResponse = await llmWithRetry(
            visionPrompt,
            visionModel,
            false,
            1,
            'handwriting-analysis',
            activeTask.moduleId,
            canvasDataUrl
          )
          transcription = normalizeHandwritingOutput(visionResponse.trim())
          userAnswer = transcription
          
          console.log('=== HANDSCHRIFT TRANSKRIPTION ===')
          console.log('Frage:', activeTask.question)
          console.log('Transkribiert:', transcription)
          console.log('================================')
        } catch (transcriptionError) {
          console.error('Fehler bei Handschrift-Transkription:', transcriptionError)
          toast.dismiss('task-submit')
          
          const errorMessage = transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError)
          const errorStack = transcriptionError instanceof Error ? transcriptionError.stack : undefined
          
          setPipelineTasks((current) =>
            current.map((t) =>
              t.id === taskId ? { 
                ...t, 
                status: 'error', 
                error: 'Fehler beim Analysieren der Handschrift',
                errorDetails: `Fehler: ${errorMessage}\\n\\nStack Trace:\\n${errorStack || 'Nicht verfuegbar'}`,
                timestamp: Date.now()
              } : t
            )
          )
          
          toast.error('Fehler beim Analysieren der Handschrift. Siehe Benachrichtigungen fuer Details.')
          throw transcriptionError
        }
      }

      setPipelineTasks((current) =>
        current.map((t) => (t.id === taskId ? { ...t, progress: 50, name: 'Antwort wird bewertet' } : t))
      )

      toast.loading('Pruefe deine Antwort...', { id: 'task-submit' })
      
      try {
        const evaluationPrompt = `Du bist ein Dozent, der die Antwort eines Studenten bewertet.

Fragestellung: ${activeTask.question}
Musterloesung: ${activeTask.solution}
Antwort des Studenten: ${userAnswer}

Bewerte, ob die Antwort des Studenten korrekt ist. Sie muessen nicht wortwoertlich uebereinstimmen, aber die Schluesselkonzepte und die Endergebnisse sollten korrekt sein.

Gib deine Antwort als JSON zurueck:
{
  "isCorrect": true/false,
  "hints": ["hinweis1", "hinweis2"] (nur falls inkorrekt, gib 2-3 hilfreiche Hinweise AUF DEUTSCH ohne die Loesung preiszugeben)
}`

        const response = await llmWithRetry(evaluationPrompt, standardModel, true, 1, 'task-submit', activeTask.moduleId)
        const evaluation = JSON.parse(response)

        toast.dismiss('task-submit')
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )
        
        setTaskFeedback({
          ...evaluation,
          transcription: isHandwritten ? transcription : undefined
        })

        if (activeTask.topic) {
          updateTopicStats(activeTask.moduleId, activeTask.topic, evaluation.isCorrect)
        }

        if (isStudyRoomAttempt && studyRoom && studyRoomSolveContext) {
          try {
            const submissionResponse = await submitStudyRound(studyRoomSolveContext.roomId, {
              userId: studyRoomIdentity.userId,
              isCorrect: evaluation.isCorrect,
              answerPreview: limitAnswerPreview(userAnswer),
            })
            syncStudyRoomState(submissionResponse.room)
            toast.success('Abgabe im Lerngruppenraum gespeichert')
          } catch (submitError) {
            console.error('[StudyRoom] submit failed', submitError)
            toast.error('Abgabe konnte nicht an den Raum gesendet werden')
          }
        } else if (evaluation.isCorrect) {
          await updateTask(activeTask.id, { completed: true, completedAt: new Date().toISOString() })
          toast.success('Richtige Antwort!')
        }
      } catch (evaluationError) {
        console.error('Fehler bei Antwort-Bewertung:', evaluationError)
        toast.dismiss('task-submit')
        
        const errorMessage = evaluationError instanceof Error ? evaluationError.message : String(evaluationError)
        const errorStack = evaluationError instanceof Error ? evaluationError.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: 'Fehler beim Bewerten der Antwort',
              errorDetails: `Fehler: ${errorMessage}\\n\\nStack Trace:\\n${errorStack || 'Nicht verfuegbar'}`,
              timestamp: Date.now()
            } : t
          )
        )
        
        toast.error('Fehler beim Bewerten der Antwort. Siehe Benachrichtigungen fuer Details.')
        throw evaluationError
      }
    } catch (error) {
      console.error('Fehler bei Antwortpruefung:', error)
      toast.dismiss('task-submit')
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      
      setPipelineTasks((current) => {
        const existing = current.find(t => t.id === taskId)
        if (existing && existing.status === 'error') {
          return current
        }
        
        return current.map((t) =>
          t.id === taskId ? { 
            ...t, 
            status: 'error', 
            error: error instanceof Error 
              ? (error.message.includes('rate limit') || error.message.includes('Rate limit')
                ? 'API-Limit erreicht'
                : error.message.includes('network') || error.message.includes('fetch')
                ? 'Netzwerkfehler'
                : 'Fehler bei der Aufgabenpruefung')
              : 'Unerwarteter Fehler',
            errorDetails: `Fehler: ${errorMessage}\\n\\nStack Trace:\\n${errorStack || 'Nicht verfuegbar'}`,
            timestamp: Date.now()
          } : t
        )
      })
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
          toast.error('API-Limit erreicht. Bitte warte einen Moment.')
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Netzwerkfehler. Bitte pruefe deine Internetverbindung.')
        } else {
          toast.error(`Fehler: ${error.message}`)
        }
      } else {
        toast.error('Ein unerwarteter Fehler ist aufgetreten.')
      }
      
      throw error
    }
  }


  const openTask = (task: Task, sequence?: Task[], startTaskId?: string) => {
    setSelectedModuleId(task.moduleId)
    setStudyRoomSolveContext(null)

    if (sequence && sequence.length > 0) {
      const startIndex = startTaskId ? sequence.findIndex(t => t.id === startTaskId) : 0
      setTaskSequence(sequence)
      setActiveSequenceIndex(startIndex >= 0 ? startIndex : 0)
    } else {
      setTaskSequence(null)
      setActiveSequenceIndex(null)
    }

    setActiveTask(task)
    setTaskFeedback(null)
  }

  const startTaskSequence = (sequence: Task[], startTaskId?: string) => {
    if (sequence.length === 0) return

    const uniqueSequence = sequence.filter((task, index, self) =>
      self.findIndex(t => t.id === task.id) === index
    )

    const startTask = startTaskId
      ? uniqueSequence.find(t => t.id === startTaskId)
      : uniqueSequence[0]

    if (!startTask) return

    openTask(startTask, uniqueSequence, startTask.id)
  }

  const handleNextTask = () => {
    if (!activeTask) return

    if (taskSequence && taskSequence.length > 0 && activeSequenceIndex !== null) {
      const syncedSequence = taskSequence.map(seqTask => tasks?.find(t => t.id === seqTask.id) || seqTask)

      const nextInSequence = syncedSequence.find((t, idx) => idx > activeSequenceIndex && !t.completed)

      if (nextInSequence) {
        setTaskSequence(syncedSequence)
        setActiveSequenceIndex(syncedSequence.findIndex(t => t.id === nextInSequence.id))
        setActiveTask(nextInSequence)
        setTaskFeedback(null)
        return
      }

      const remaining = syncedSequence.find(t => !t.completed && t.id !== activeTask.id)

      if (remaining) {
        setTaskSequence(syncedSequence)
        setActiveSequenceIndex(syncedSequence.findIndex(t => t.id === remaining.id))
        setActiveTask(remaining)
        setTaskFeedback(null)
        return
      }

      setTaskSequence(null)
      setActiveSequenceIndex(null)
      setActiveTask(null)
      setTaskFeedback(null)
      toast.success('Alle Aufgaben im Block abgeschlossen! 🎉')
      return
    }

    const currentIndex = moduleTasks.findIndex((t) => t.id === activeTask.id)
    const incompleteTasks = moduleTasks.filter((t) => !t.completed)
    const nextTask = incompleteTasks.find((t) => {
      const taskIndex = moduleTasks.indexOf(t)
      return taskIndex > currentIndex
    })

    if (nextTask) {
      setActiveTask(nextTask)
      setTaskFeedback(null)
    } else {
      setActiveTask(null)
      setTaskFeedback(null)
      toast.success('Alle Aufgaben abgeschlossen! Sehr gut!')
    }
  }

  const handleDeleteScript = async (scriptId: string) => {
    try {
      // Find the script to get the moduleId
      const script = scripts?.find((s) => s.id === scriptId)
      const moduleId = script?.moduleId
      
      // Zuerst verknüpfte Daten löschen
      const relatedNotes = notes?.filter((n) => n.scriptId === scriptId) || []
      const relatedTasks = tasks?.filter((t) => t.scriptId === scriptId) || []
      const relatedFlashcards = relatedNotes.flatMap((n) => flashcards?.filter((f) => f.noteId === n.id) || [])
      
      // Remove from analysis queue and delete analysis record
      removeFromAnalysisQueue(scriptId)
      if (moduleId) {
        deleteDocumentAnalysis(moduleId, scriptId).catch((err) => {
          console.warn('[App] Failed to delete document analysis:', err)
        })
        // Invalidate module profile so it gets rebuilt
        invalidateModuleProfile(moduleId).catch((err) => {
          console.warn('[App] Failed to invalidate module profile:', err)
        })
      }
      
      await Promise.all([
        ...relatedFlashcards.map((f) => removeFlashcard(f.id)),
        ...relatedNotes.map((n) => removeNote(n.id)),
        ...relatedTasks.map((t) => removeTask(t.id)),
        removeScript(scriptId)
      ])
      
      toast.success('Skript gelöscht')
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      toast.error('Fehler beim Löschen des Skripts')
    }
  }

  const handleAnalyzeScript = async (scriptId: string) => {
    const script = scripts?.find((s) => s.id === scriptId)
    if (!script || !script.content) {
      toast.error('Skript hat keinen Inhalt zum Analysieren')
      return
    }
    
    // Map script category to DocumentType
    const documentTypeMap: Record<string, DocumentType> = {
      'script': 'script',
      'exam': 'exam',
      'exercise': 'exercise',
      'formula-sheet': 'formula-sheet',
      'lecture-notes': 'lecture-notes',
      'summary': 'summary',
    }
    const docType: DocumentType = documentTypeMap[script.category || 'script'] || 'script'
    
    try {
      await enqueueAnalysis(
        script.moduleId,
        script.id,
        docType,
        script.name,
        script.content
      )
      toast.info(`Analyse für "${script.name}" wurde gestartet`)
    } catch (error) {
      console.error('Fehler beim Starten der Analyse:', error)
      toast.error('Fehler beim Starten der Analyse')
    }
  }

  // Alle Skripte im Modul neu analysieren (vorherige Analysen löschen)
  const handleReanalyzeAllScripts = async () => {
    if (!selectedModuleId) return
    const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
    
    if (moduleScripts.length === 0) {
      toast.error('Keine Skripte zum Analysieren vorhanden')
      return
    }
    
    // Alte Analysen für dieses Modul löschen
    try {
      const { deleteModuleDocumentAnalyses } = await import('@/lib/analysis-storage')
      await deleteModuleDocumentAnalyses(selectedModuleId)
    } catch (error) {
      console.warn('Fehler beim Löschen alter Analysen:', error)
    }
    
    // Neue Analysen starten - ALLE auf einmal zur Queue hinzufügen
    const scriptsWithContent = moduleScripts.filter(s => s.content)
    
    // WICHTIG: Erst alle Tasks zur Pipeline hinzufügen, damit die UI sofort die richtige Anzahl zeigt
    const newTasks = scriptsWithContent.map(script => ({
      id: `analyze-${script.id}`,
      type: 'analyze' as const,
      name: script.name,
      progress: 0,
      status: 'pending' as const,
      timestamp: Date.now(),
    }))
    
    setPipelineTasks(current => {
      // Entferne eventuell vorhandene alte Tasks für diese Skripte
      const filtered = current.filter(t => !newTasks.some(nt => nt.id === t.id))
      return [...filtered, ...newTasks]
    })
    
    // Dann die Analysen starten (ohne await, da wir die Tasks schon hinzugefügt haben)
    scriptsWithContent.forEach(script => {
      const documentTypeMap: Record<string, DocumentType> = {
        'script': 'script',
        'exam': 'exam',
        'exercise': 'exercise',
        'formula-sheet': 'formula-sheet',
        'lecture-notes': 'lecture-notes',
        'summary': 'summary',
      }
      const docType: DocumentType = documentTypeMap[script.category || 'script'] || 'script'
      
      enqueueAnalysis(
        script.moduleId,
        script.id,
        docType,
        script.name,
        script.content!
      ).catch(err => console.error('Fehler beim Starten der Analyse:', err))
    })
    
    toast.success(`Neu-Analyse für ${scriptsWithContent.length} Skripte(n) gestartet`)
  }

  // Ausgewählte Skripte neu analysieren (vorherige Analysen löschen)
  const handleReanalyzeSelectedScripts = async (scriptIds: string[]) => {
    if (scriptIds.length === 0) {
      toast.error('Keine Skripte ausgewählt')
      return
    }
    
    const selectedScripts = scripts?.filter((s) => scriptIds.includes(s.id)) || []
    
    // Alte Analysen für die ausgewählten Skripte löschen
    try {
      const { deleteDocumentAnalysis } = await import('@/lib/analysis-storage')
      for (const script of selectedScripts) {
        await deleteDocumentAnalysis(script.moduleId, script.id)
      }
    } catch (error) {
      console.warn('Fehler beim Löschen alter Analysen:', error)
    }
    
    // Neue Analysen starten - ALLE auf einmal zur Queue hinzufügen
    const scriptsWithContent = selectedScripts.filter(s => s.content)
    
    // WICHTIG: Erst alle Tasks zur Pipeline hinzufügen, damit die UI sofort die richtige Anzahl zeigt
    const newTasks = scriptsWithContent.map(script => ({
      id: `analyze-${script.id}`,
      type: 'analyze' as const,
      name: script.name,
      progress: 0,
      status: 'pending' as const,
      timestamp: Date.now(),
    }))
    
    setPipelineTasks(current => {
      const filtered = current.filter(t => !newTasks.some(nt => nt.id === t.id))
      return [...filtered, ...newTasks]
    })
    
    // Dann die Analysen starten
    scriptsWithContent.forEach(script => {
      const documentTypeMap: Record<string, DocumentType> = {
        'script': 'script',
        'exam': 'exam',
        'exercise': 'exercise',
        'formula-sheet': 'formula-sheet',
        'lecture-notes': 'lecture-notes',
        'summary': 'summary',
      }
      const docType: DocumentType = documentTypeMap[script.category || 'script'] || 'script'
      
      enqueueAnalysis(
        script.moduleId,
        script.id,
        docType,
        script.name,
        script.content!
      ).catch(err => console.error('Fehler beim Starten der Analyse:', err))
    })
    
    toast.success(`Neu-Analyse für ${scriptsWithContent.length} Skript(e) gestartet`)
  }

  // Notizen für ausgewählte Skripte generieren
  const handleGenerateNotesForSelected = async (scriptIds: string[]) => {
    if (scriptIds.length === 0) {
      toast.error('Keine Skripte ausgewählt')
      return
    }
    
    // Alle auf einmal starten - die Tasks werden von handleGenerateNotes erstellt
    const selectedScripts = scripts?.filter((s) => scriptIds.includes(s.id)) || []
    for (const script of selectedScripts) {
      handleGenerateNotes(script.id)
    }
    
    toast.success(`Notizen-Generierung für ${scriptIds.length} Skript(e) gestartet`)
  }

  // Aufgaben für ausgewählte Skripte generieren
  const handleGenerateTasksForSelected = async (scriptIds: string[]) => {
    if (scriptIds.length === 0) {
      toast.error('Keine Skripte ausgewählt')
      return
    }
    
    // Alle auf einmal starten - die Tasks werden von handleGenerateTasks erstellt
    const selectedScripts = scripts?.filter((s) => scriptIds.includes(s.id)) || []
    for (const script of selectedScripts) {
      handleGenerateTasks(script.id)
    }
    
    toast.success(`Aufgaben-Generierung für ${scriptIds.length} Skript(e) gestartet`)
  }

  
const handleDeleteNote = async (noteId: string) => {
    try {
      const relatedFlashcards = flashcards?.filter((f) => f.noteId === noteId) || []
      await Promise.all([
        ...relatedFlashcards.map((f) => removeFlashcard(f.id)),
        removeNote(noteId),
      ])
      toast.success('Notiz gelöscht')
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      toast.error('Fehler beim Löschen der Notiz')
    }
  }

  
const handleDeleteTask = async (taskId: string) => {
    try {
      await removeTask(taskId)
      toast.success('Aufgabe gelöscht')
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      toast.error('Fehler beim Löschen der Aufgabe')
    }
  }

  const handleGenerateAllNotes = () => {
    if (!selectedModuleId) return
    const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
    
    moduleScripts.forEach((script) => {
      const hasNotes = notes?.some((n) => n.scriptId === script.id)
      if (!hasNotes) {
        handleGenerateNotes(script.id)
      }
    })
  }

  const handleGenerateAllTasks = () => {
    if (!selectedModuleId) return
    const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
    
    moduleScripts.forEach((script) => {
      const hasTasks = tasks?.some((t) => t.scriptId === script.id)
      if (!hasTasks) {
        handleGenerateTasks(script.id)
      }
    })
  }

  const handleGenerateFlashcards = async (noteId: string) => {
    const note = notes?.find((n) => n.id === noteId)
    if (!note) return

    const taskId = generateId()
    
    const execute = async () => {
      setPipelineTasks((current) => [
        ...current,
        {
          id: taskId,
          type: 'generate-flashcards',
          name: `Notiz vom ${new Date(note.generatedAt).toLocaleDateString('de-DE')}`,
          progress: 0,
          status: 'processing',
          timestamp: Date.now(),
        },
      ])

      try {
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 10 } : t))
        )

        await new Promise(resolve => setTimeout(resolve, 100))

        const prompt = `Du bist ein Experte für das Erstellen von Lernkarten. Analysiere die folgenden Notizen und erstelle daraus Karteikarten.

Notizen:
${note.content}

Erstelle 5-10 Karteikarten als JSON-Objekt mit einer einzelnen Eigenschaft "flashcards", die ein Array von Karteikarten-Objekten enthält. Jede Karteikarte muss diese exakten Felder haben:
- front: Die Frage oder das Konzept (kurz und prägnant, AUF DEUTSCH) (string)
- back: Die Antwort oder Erklärung (klar und vollständig, AUF DEUTSCH) (string)

Erstelle Karten, die Schlüsselkonzepte, Definitionen, Formeln und wichtige Zusammenhänge abdecken.

Beispielformat:
{
  "flashcards": [
    {
      "front": "Was ist die Formel für die Kreisfläche?",
      "back": "A = π × r²\n\nDabei ist:\n- A = Fläche\n- r = Radius\n- π ≈ 3,14159"
    }
  ]
}`

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 30 } : t))
        )

        const response = await llmWithRetry(prompt, standardModel, true, 1, 'generate-flashcards', note.moduleId)
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 70 } : t))
        )

        let parsed
        try {
          parsed = JSON.parse(response)
        } catch (parseError) {
          throw new Error('Ungültiges Antwortformat von der KI')
        }

        if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
          throw new Error('Antwort enthält kein flashcards-Array')
        }

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 85 } : t))
        )

        const newFlashcards: Flashcard[] = parsed.flashcards.map((f: any) => ({
          id: generateId(),
          noteId: note.id,
          moduleId: note.moduleId,
          front: f.front,
          back: f.back,
          createdAt: new Date().toISOString(),
          ease: 2.5,
          interval: 0,
          repetitions: 0,
        }))

        // Alle Flashcards in die Datenbank speichern
        await Promise.all(newFlashcards.map(flashcard => createFlashcard(flashcard)))
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )

        toast.success(`${newFlashcards.length} Karteikarten erstellt`)
      } catch (error) {
        console.error('Fehler bei Karteikarten-Erstellung:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Erstellung fehlgeschlagen',
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
              timestamp: Date.now()
            } : t
          )
        )
        toast.error('Fehler beim Erstellen der Karteikarten')
      }
    }

    await taskQueue.add({ id: taskId, execute })
  }

  const handleGenerateAllFlashcards = () => {
    if (!selectedModuleId) return
    const moduleNotes = notes?.filter((n) => n.moduleId === selectedModuleId) || []
    
    moduleNotes.forEach((note) => {
      const hasFlashcards = flashcards?.some((f) => f.noteId === note.id)
      if (!hasFlashcards) {
        handleGenerateFlashcards(note.id)
      }
    })
  }

  const handleDeleteFlashcard = async (flashcardId: string) => {
    try {
      await removeFlashcard(flashcardId)
      toast.success('Karteikarte gelöscht')
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      toast.error('Fehler beim Löschen der Karteikarte')
    }
  }

  const handleBulkDeleteScripts = async (ids: string[]) => {
    try {
      // Collect moduleIds for each script to delete analysis records
      const scriptsToDelete = scripts?.filter((s) => ids.includes(s.id)) || []
      
      const relatedNotes = notes?.filter((n) => ids.includes(n.scriptId)) || []
      const relatedTasks = tasks?.filter((t) => ids.includes(t.scriptId || '')) || []
      const relatedFlashcards = relatedNotes.flatMap((n) => flashcards?.filter((f) => f.noteId === n.id) || [])

      // Remove from analysis queue and delete analysis records
      const affectedModuleIds = new Set<string>()
      for (const script of scriptsToDelete) {
        removeFromAnalysisQueue(script.id)
        deleteDocumentAnalysis(script.moduleId, script.id).catch((err) => {
          console.warn('[App] Failed to delete document analysis:', err)
        })
        affectedModuleIds.add(script.moduleId)
      }
      
      // Invalidate module profiles for all affected modules
      for (const moduleId of affectedModuleIds) {
        invalidateModuleProfile(moduleId).catch((err) => {
          console.warn('[App] Failed to invalidate module profile:', err)
        })
      }

      await Promise.all([
        ...relatedFlashcards.map((f) => removeFlashcard(f.id)),
        ...relatedNotes.map((n) => removeNote(n.id)),
        ...relatedTasks.map((t) => removeTask(t.id)),
        ...ids.map((id) => removeScript(id)),
      ])
      toast.success(`${ids.length} Skripte gelöscht`)
    } catch (error) {
      console.error('Fehler beim Bulk-Löschen der Skripte:', error)
      toast.error('Fehler beim Löschen der Skripte')
    }
  }

  const handleBulkDeleteNotes = async (ids: string[]) => {
    try {
      const relatedFlashcards = flashcards?.filter((f) => ids.includes(f.noteId)) || []
      await Promise.all([
        ...relatedFlashcards.map((f) => removeFlashcard(f.id)),
        ...ids.map((id) => removeNote(id)),
      ])
      toast.success(`${ids.length} Notizen gelöscht`)
    } catch (error) {
      console.error('Fehler beim Bulk-Löschen der Notizen:', error)
      toast.error('Fehler beim Löschen der Notizen')
    }
  }

  const handleBulkDeleteTasks = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => removeTask(id)))
      toast.success(`${ids.length} Aufgaben gelöscht`)
    } catch (error) {
      console.error('Fehler beim Bulk-Löschen der Aufgaben:', error)
      toast.error('Fehler beim Löschen der Aufgaben')
    }
  }

  const handleBulkDeleteFlashcards = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => removeFlashcard(id)))
      toast.success(`${ids.length} Karteikarten gelöscht`)
    } catch (error) {
      console.error('Fehler beim Bulk-Löschen der Karteikarten:', error)
      toast.error('Fehler beim Löschen der Karteikarten')
    }
  }

  const handleStartFlashcardStudy = () => {
    if (!selectedModuleId) return
    const dueCards = moduleFlashcards.filter((card) => {
      if (!card.nextReview) return true
      return new Date(card.nextReview) <= new Date()
    })
    
    if (dueCards.length === 0) {
      toast.info('Keine fälligen Karteikarten zum Lernen')
      return
    }
    
    setActiveFlashcards(dueCards)
  }

  const handleReviewFlashcard = async (flashcardId: string, quality: number) => {
    const card = flashcards?.find((f) => f.id === flashcardId)
    if (!card) return

    const update = calculateNextReview(card, quality)
    
    try {
      await updateFlashcard(flashcardId, {
        ...update,
        lastReviewed: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Karteikarte:', error)
    }
  }

  const handleQuizSubmit = async (
    task: Task,
    answer: string,
    isHandwritten: boolean,
    canvasDataUrl?: string
  ) => {
    const taskId = generateId()
    
    try {
      let userAnswer = answer
      let transcription = ''

      setPipelineTasks((current) => [
        ...current,
        {
          id: taskId,
          type: 'task-submit',
          name: 'Aufgabe wird überprüft',
          progress: 0,
          status: 'processing',
          timestamp: Date.now(),
        },
      ])

      if (isHandwritten && canvasDataUrl) {
        toast.loading('Analysiere deine Handschrift...', { id: 'quiz-submit' })

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 10, name: 'Handschrift wird analysiert' } : t))
        )

        try {
          // Sende das Bild an die Vision-API für echte Handschrift-Erkennung
          const visionPrompt = buildHandwritingPrompt(task.question)

          const visionResponse = await llmWithRetry(
            visionPrompt,
            visionModel,
            false,
            1,
            'handwriting-analysis',
            task.moduleId,
            canvasDataUrl  // Das Canvas-Bild wird nun mitgesendet!
          )
          transcription = normalizeHandwritingOutput(visionResponse.trim())
          userAnswer = transcription
        } catch (transcriptionError) {
          console.error('Fehler bei Handschrift-Transkription:', transcriptionError)
          toast.dismiss('quiz-submit')
          
          const errorMessage = transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError)
          const errorStack = transcriptionError instanceof Error ? transcriptionError.stack : undefined
          
          setPipelineTasks((current) =>
            current.map((t) =>
              t.id === taskId ? { 
                ...t, 
                status: 'error', 
                error: 'Fehler beim Analysieren der Handschrift',
                errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
                timestamp: Date.now()
              } : t
            )
          )
          
          toast.error('Fehler beim Analysieren der Handschrift. Siehe Benachrichtigungen für Details.')
          throw transcriptionError
        }
      }

      setPipelineTasks((current) =>
        current.map((t) => (t.id === taskId ? { ...t, progress: 50, name: 'Antwort wird bewertet' } : t))
      )

      toast.loading('Überprüfe deine Antwort...', { id: 'quiz-submit' })
      
      try {
        const evaluationPrompt = `Du bist ein Dozent, der die Antwort eines Studenten bewertet.

Fragestellung: ${task.question}
Musterlösung: ${task.solution}
Antwort des Studenten: ${userAnswer}

Bewerte, ob die Antwort des Studenten korrekt ist. Sie müssen nicht wortwörtlich übereinstimmen, aber die Schlüsselkonzepte und die Endergebnisse sollten korrekt sein.

Gib deine Antwort als JSON zurück:
{
  "isCorrect": true/false,
  "hints": ["hinweis1", "hinweis2"] (nur falls inkorrekt, gib 2-3 hilfreiche Hinweise AUF DEUTSCH ohne die Lösung preiszugeben)
}`

        const response = await llmWithRetry(evaluationPrompt, standardModel, true, 1, 'task-submit', task.moduleId)
        const evaluation = JSON.parse(response)

        toast.dismiss('quiz-submit')
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )
        
        setTaskFeedback({
          ...evaluation,
          transcription: isHandwritten ? transcription : undefined
        })
      } catch (evaluationError) {
        console.error('Fehler bei Antwort-Bewertung:', evaluationError)
        toast.dismiss('quiz-submit')
        
        const errorMessage = evaluationError instanceof Error ? evaluationError.message : String(evaluationError)
        const errorStack = evaluationError instanceof Error ? evaluationError.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: 'Fehler beim Bewerten der Antwort',
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
              timestamp: Date.now()
            } : t
          )
        )
        
        toast.error('Fehler beim Bewerten der Antwort. Siehe Benachrichtigungen für Details.')
        throw evaluationError
      }
    } catch (error) {
      console.error('Fehler bei Antwortüberprüfung:', error)
      toast.dismiss('quiz-submit')
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      
      setPipelineTasks((current) => {
        const existing = current.find(t => t.id === taskId)
        if (existing && existing.status === 'error') {
          return current
        }
        
        return current.map((t) =>
          t.id === taskId ? { 
            ...t, 
            status: 'error', 
            error: error instanceof Error 
              ? (error.message.includes('rate limit') || error.message.includes('Rate limit')
                ? 'API-Limit erreicht'
                : error.message.includes('network') || error.message.includes('fetch')
                ? 'Netzwerkfehler'
                : 'Fehler bei der Aufgabenprüfung')
              : 'Unerwarteter Fehler',
            errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfügbar'}`,
            timestamp: Date.now()
          } : t
        )
      })
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
          toast.error('API-Limit erreicht. Bitte warte einen Moment.')
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Netzwerkfehler. Bitte überprüfe deine Internetverbindung.')
        } else {
          toast.error(`Fehler: ${error.message}`)
        }
      } else {
        toast.error('Ein unerwarteter Fehler ist aufgetreten.')
      }
      
      throw error
    }
  }

  // Speichere das Modul für die Generierung, wenn eine neue Generierung startet
  useEffect(() => {
    if (examGenerationState?.phase === 'preparing' && selectedModule) {
      examGenerationModuleRef.current = {
        module: selectedModule,
        scripts: moduleScripts,
      }
    } else if (!examGenerationState) {
      examGenerationModuleRef.current = null
    }
  }, [examGenerationState?.phase, selectedModule, moduleScripts])

  // Versteckte ExamMode-Komponente für Hintergrund-Generierung
  // Nutzt das gespeicherte Modul aus dem Ref, damit die Generierung weiterläuft
  const examGenModule = examGenerationModuleRef.current?.module || selectedModule
  const examGenScripts = examGenerationModuleRef.current?.scripts || moduleScripts
  
  const BackgroundExamGenerator = examGenerationState?.phase === 'preparing' && examGenModule && !showExamMode ? (
    <div className="fixed inset-0 -z-50 opacity-0 pointer-events-none" aria-hidden="true">
      <ExamMode
        module={examGenModule}
        scripts={examGenScripts}
        formulaSheets={examGenScripts.filter(s => s.category === 'formula')}
        onBack={() => setShowExamMode(false)}
        generationState={examGenerationState}
        onGenerationStateChange={setExamGenerationState}
        onMinimizeToBackground={() => setShowExamMode(false)}
      />
    </div>
  ) : null

  if (activeFlashcards) {
    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <FlashcardStudy
          flashcards={activeFlashcards}
          onClose={() => setActiveFlashcards(null)}
          onReview={handleReviewFlashcard}
        />
        {examGenerationState && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => {
              setActiveFlashcards(null)
              setShowExamMode(true)
            }}
          />
        )}
        {/* Großes AI Action UI */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>
      </>
    )
  }

  if (showQuizMode) {
    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <QuizMode
          tasks={tasks || []}
          modules={modules || []}
          onClose={() => {
            setShowQuizMode(false)
            setTaskFeedback(null)
          }}
          onSubmit={handleQuizSubmit}
          feedback={taskFeedback || undefined}
        />
        {examGenerationState && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => {
              setShowQuizMode(false)
              setShowExamMode(true)
            }}
          />
        )}
        {/* Großes AI Action UI */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>
      </>
    )
  }

  // ExamMode wird gerendert wenn showExamMode true ist
  if (showExamMode && selectedModule) {
    return (
      <>
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <ExamMode
          module={selectedModule}
          scripts={moduleScripts}
          formulaSheets={moduleScripts.filter(s => s.category === 'formula')}
          onBack={() => {
            // Wenn gerade generiert wird, nicht den State löschen
            if (examGenerationState?.phase === 'preparing' || examGenerationState?.phase === 'ready') {
              setShowExamMode(false)
            } else {
              setShowExamMode(false)
              setExamGenerationState(null)
            }
          }}
          generationState={examGenerationState}
          onGenerationStateChange={setExamGenerationState}
          onMinimizeToBackground={() => setShowExamMode(false)}
        />
      </>
    )
  }

  if (activeTask) {
    const hasNextTask =
      (taskSequence && taskSequence.some(t => !t.completed && t.id !== activeTask.id)) ||
      moduleTasks.filter((t) => !t.completed && t.id !== activeTask.id).length > 0
    const isStudyRoomTask = !!studyRoomSolveContext && studyRoomSolveContext.taskId === activeTask.id

    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <TaskSolver
          task={activeTask}
          onClose={() => {
            setActiveTask(null)
            setTaskFeedback(null)
            setTaskSequence(null)
            setActiveSequenceIndex(null)
            setStudyRoomSolveContext(null)
          }}
          onSubmit={handleSubmitTaskAnswer}
          feedback={taskFeedback || undefined}
          onNextTask={isStudyRoomTask ? undefined : hasNextTask ? handleNextTask : undefined}
          onTaskUpdate={
            isStudyRoomTask
              ? undefined
              : async (updates) => {
                  await updateTask(activeTask.id, updates)
                  // Aktualisiere auch den lokalen State
                  setActiveTask((current) => (current ? { ...current, ...updates } : null))
                }
          }
          formulaSheets={moduleScripts.filter(s => s.category === 'formula')}
        />
        {examGenerationState && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => {
              setActiveTask(null)
              setTaskFeedback(null)
              setTaskSequence(null)
              setActiveSequenceIndex(null)
              setShowExamMode(true)
            }}
          />
        )}
        {/* Großes AI Action UI */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>
      </>
    )
  }

  if (studyRoom) {
    const roomModule = modules?.find((m) => m.id === studyRoom.moduleId)
    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <StudyRoomView
          room={studyRoom}
          currentUserId={studyRoomIdentity.userId}
          moduleName={roomModule?.name}
          isSyncing={studyRoomBusy}
          onLeave={handleLeaveStudyRoom}
          onToggleReady={handleToggleReady}
          onStartRound={handleStartStudyRound}
          onVoteExtension={handleVoteForExtension}
          onOpenTask={openStudyRoomTask}
          onEndRound={handleEndStudyRound}
          onRefresh={() => refreshStudyRoom(studyRoom.id)}
        />
      </>
    )
  }

  if (showStatistics) {
    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <StatisticsDashboard
          modules={modules || []}
          tasks={tasks || []}
          flashcards={flashcards || []}
          scripts={scripts || []}
          notes={notes || []}
          onBack={() => setShowStatistics(false)}
          selectedModuleId={selectedModuleId || undefined}
        />
        {examGenerationState && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => {
              setShowStatistics(false)
              setShowExamMode(true)
            }}
          />
        )}
        {/* Großes AI Action UI */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>
      </>
    )
  }

  if (showCostTracking) {
    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <CostTrackingDashboard onBack={() => setShowCostTracking(false)} />
        {examGenerationState && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => {
              setShowCostTracking(false)
              setShowExamMode(true)
            }}
          />
        )}
        {/* Großes AI Action UI */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>
      </>
    )
  }

  if (selectedModule) {
    return (
      <>
        {BackgroundExamGenerator}
        <NotificationCenter
          tasks={pipelineTasks}
          onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
          onClearAll={() => setPipelineTasks([])}
        />
        <ModuleView
          module={selectedModule}
          scripts={moduleScripts}
          notes={moduleNotes}
          tasks={moduleTasks}
          flashcards={moduleFlashcards}
          onBack={() => setSelectedModuleId(null)}
          onUploadScript={handleUploadScript}
          onGenerateNotes={handleGenerateNotes}
          onGenerateTasks={handleGenerateTasks}
          onGenerateFlashcards={handleGenerateFlashcards}
          onDeleteScript={handleDeleteScript}
          onSolveTask={(task) => openTask(task)}
          onStartTaskSequence={(sequence, startTaskId) => startTaskSequence(sequence, startTaskId)}
          onDeleteTask={handleDeleteTask}
          onDeleteNote={handleDeleteNote}
          onDeleteFlashcard={handleDeleteFlashcard}
          onBulkDeleteScripts={handleBulkDeleteScripts}
          onBulkDeleteNotes={handleBulkDeleteNotes}
          onBulkDeleteTasks={handleBulkDeleteTasks}
          onBulkDeleteFlashcards={handleBulkDeleteFlashcards}
          onGenerateAllNotes={handleGenerateAllNotes}
          onGenerateAllTasks={handleGenerateAllTasks}
          onGenerateAllFlashcards={handleGenerateAllFlashcards}
          onStartFlashcardStudy={handleStartFlashcardStudy}
          onEditModule={handleEditModule}
          onStartExamMode={() => setShowExamMode(true)}
          onAnalyzeScript={handleAnalyzeScript}
          onReanalyzeAllScripts={handleReanalyzeAllScripts}
          onReanalyzeSelectedScripts={handleReanalyzeSelectedScripts}
          onGenerateNotesForSelected={handleGenerateNotesForSelected}
          onGenerateTasksForSelected={handleGenerateTasksForSelected}
          onStartStudyRoom={handleCreateStudyRoom}
          onJoinStudyRoom={handleJoinStudyRoom}
          studyRoomBusy={studyRoomBusy}
          studyRoomNickname={studyRoomIdentity.nickname}
        />

        {/* EditModuleDialog auch in ModuleView verfügbar */}
        <EditModuleDialog
          module={moduleToEdit}
          open={editModuleDialogOpen}
          onOpenChange={setEditModuleDialogOpen}
          onUpdateModule={handleUpdateModule}
          onDeleteModule={handleDeleteModule}
          contentCount={moduleToEdit ? {
            scripts: scripts?.filter(s => s.moduleId === moduleToEdit.id).length || 0,
            notes: notes?.filter(n => n.moduleId === moduleToEdit.id).length || 0,
            tasks: tasks?.filter(t => t.moduleId === moduleToEdit.id).length || 0,
            flashcards: flashcards?.filter(f => f.moduleId === moduleToEdit.id).length || 0,
          } : undefined}
        />
        {examGenerationState && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => setShowExamMode(true)}
          />
        )}
        {/* Großes AI Action UI */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        {/* Minimiertes AI Action Widget */}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      {BackgroundExamGenerator}
      <NotificationCenter
        tasks={pipelineTasks}
        onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
        onClearAll={() => setPipelineTasks([])}
      />
      
      {/* Flex-Container für Sticky Footer */}
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">StudyMate</h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                      Dein KI-gestützter Lernbegleiter für die Uni
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <InputModeSettingsButton />
                  <OnboardingTrigger onClick={resetOnboarding} />
                  <DebugModeToggle />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (!tasks || tasks.length === 0) {
                      toast.info('Erstelle zuerst Aufgaben in deinen Modulen')
                      return
                    }
                    setShowQuizMode(true)
                  }} 
                  size="sm" 
                  className="flex-1 sm:flex-none"
                >
                  <Sparkle size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Quiz-Modus</span>
                </Button>
                <Button variant="outline" onClick={() => setShowStatistics(true)} size="sm" className="flex-1 sm:flex-none">
                  <ChartLine size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Statistiken</span>
                </Button>
                <Button variant="outline" onClick={() => setShowCostTracking(true)} size="sm" className="flex-1 sm:flex-none">
                  <CurrencyDollar size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Kosten</span>
                </Button>
                {modules && modules.length > 0 && (
                  <Button variant="outline" onClick={handleExportData} size="sm" className="flex-1 sm:flex-none" title="Alle Daten exportieren">
                    <DownloadSimple size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Backup</span>
                  </Button>
                )}
                <Button 
                  onClick={() => setCreateDialogOpen(true)} 
                  size="sm" 
                  className="flex-1 sm:flex-none"
                  data-onboarding="new-module"
                >
                  <Plus size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Neues Modul</span>
                  <span className="sm:hidden">Modul</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Hauptinhalt mit flex-1 für Sticky Footer */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
            {!modules || modules.length === 0 ? (
              <>
                <EmptyState
                  title="Noch keine Module"
                  description="Erstelle dein erstes Modul, um deine Kursmaterialien, Notizen und Übungsaufgaben zu organisieren."
                  actionLabel="Erstes Modul erstellen"
                  onAction={() => setCreateDialogOpen(true)}
                  secondaryActionLabel="Backup importieren"
                  onSecondaryAction={triggerImportDialog}
                />
              </>
            ) : (
              <>
                {/* Tutor-Dashboard mit Empfehlungen und Modulen */}
                <TutorDashboard
                  modules={modules}
                  tasks={tasks || []}
                  scripts={scripts || []}
                  onGenerateTasks={handleGenerateTasksFromDashboard}
                  isGenerating={pipelineTasks.some(t => t.type === 'generate-tasks' && t.status === 'processing')}
                  onSolveTask={(task) => openTask(task)}
                  onStartTaskSequence={(sequence, startTaskId) => startTaskSequence(sequence, startTaskId)}
                  onSelectModule={setSelectedModuleId}
                  onEditModule={handleEditModule}
                />
              </>
            )}
          </div>
        </main>

        {/* Sticky Footer - immer am unteren Rand */}
        <footer className="border-t bg-card/50 backdrop-blur-sm mt-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <LocalStorageIndicator />
              <p className="text-xs text-muted-foreground">
                StudyMate © {new Date().getFullYear()} · Deine Daten bleiben privat
              </p>
            </div>
          </div>
        </footer>

        <CreateModuleDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreateModule={handleCreateModule}
        />

        <EditModuleDialog
          module={moduleToEdit}
          open={editModuleDialogOpen}
          onOpenChange={setEditModuleDialogOpen}
          onUpdateModule={handleUpdateModule}
          onDeleteModule={handleDeleteModule}
          contentCount={moduleToEdit ? {
            scripts: scripts?.filter(s => s.moduleId === moduleToEdit.id).length || 0,
            notes: notes?.filter(n => n.moduleId === moduleToEdit.id).length || 0,
            tasks: tasks?.filter(t => t.moduleId === moduleToEdit.id).length || 0,
            flashcards: flashcards?.filter(f => f.moduleId === moduleToEdit.id).length || 0,
          } : undefined}
        />

        {/* Versteckter File-Input für Import */}
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          onChange={handleImportData}
          className="hidden"
        />

        {/* Onboarding Tutorial für neue Benutzer */}
        {isChecked && showOnboarding && (
          <OnboardingTutorial 
            onComplete={completeOnboarding}
            onCreateModule={() => setCreateDialogOpen(true)}
          />
        )}
        
        {/* Globales Exam-Generation Widget - immer sichtbar während einer Generierung */}
        {examGenerationState && !showExamMode && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => setShowExamMode(true)}
          />
        )}
        
        {/* AI Preparation UI - für Analyse, Notizen, Aufgaben, Karteikarten */}
        {aiActionState && !aiActionState.isMinimized && (
          <AIPreparation
            type={aiActionState.type}
            moduleName={aiActionState.moduleName}
            progress={aiActionState.progress}
            currentStep={aiActionState.currentStep}
            processedCount={aiActionState.processedCount}
            totalCount={aiActionState.totalCount}
            isComplete={aiActionState.isComplete}
            items={aiActionState.items}
            onMinimize={() => setAiActionState(prev => prev ? { ...prev, isMinimized: true } : null)}
            onClose={() => setAiActionState(null)}
          />
        )}
        
        {/* Minimiertes AI Action Widget */}
        <AnimatePresence>
          {aiActionState && aiActionState.isMinimized && (
            <AIPreparationMinimized
              key="ai-prep-minimized"
              type={aiActionState.type}
              progress={aiActionState.progress}
              isComplete={aiActionState.isComplete}
              processedCount={aiActionState.processedCount}
              totalCount={aiActionState.totalCount}
              onClick={() => setAiActionState(prev => prev ? { ...prev, isMinimized: false } : null)}
            offsetLeft={!!examGenerationState}
          />
          )}
        </AnimatePresence>

      </div>
    </>
  )
}

export default App







