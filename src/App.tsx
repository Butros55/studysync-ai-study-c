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
import { ServerBackupDialog } from './components/ServerBackupDialog'
import { InputModeSettingsButton } from './components/InputModeSettings'
import { normalizeHandwritingOutput } from './components/MarkdownRenderer'
import { StudyRoomView } from './components/StudyRoomView'
import { Button } from './components/ui/button'
import { Plus, ChartLine, Sparkle, CurrencyDollar, DownloadSimple, CloudArrowDown, UploadSimple } from '@phosphor-icons/react'
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
import { createStudyRoomApi, joinStudyRoomApi, fetchStudyRoom, setReadyState, startStudyRound, voteForExtension, submitStudyRound, endStudyRound, leaveStudyRoom, limitAnswerPreview, unsubmitStudyRound } from './lib/study-room-api'
import { StudyRoomProvider, useStudyRoom } from './studyroom/StudyRoomProvider'
import { StudyRoomHUD } from './studyroom/StudyRoomHUD'
import { ensureStudyRoomIdentity, loadStudyRoomIdentity, updateStudyRoomNickname } from './lib/study-room-identity'
import type { DocumentType } from './lib/analysis-types'
import { useDebugMode } from './hooks/use-debug-mode'
import { BugReportListener } from './components/BugReportListener'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'

// Key for tracking tag migration
const TAG_MIGRATION_KEY = 'studysync_tag_migration_v1'

const buildHandwritingPrompt = (question: string) => `Du bist ein Experte fÃ¼r das Lesen von Handschrift und die Erkennung mathematischer Notationen.

Analysiere das Bild und transkribiere EXAKT was du siehst.

WICHTIGE REGELN FÃœR MATHEMATISCHE SYMBOLE:
1. Wurzelzeichen (âˆš) IMMER als LaTeX: \\sqrt{...} 
   - Beispiel: âˆša â†’ \\sqrt{a}
   - Beispiel: âˆš(aÂ²+b) â†’ \\sqrt{a^2 + b}
   - Das Wurzelzeichen sieht aus wie ein HÃ¤kchen mit horizontaler Linie darÃ¼ber

2. BrÃ¼che IMMER als LaTeX: \\frac{ZÃ¤hler}{Nenner}
   - Beispiel: a/b â†’ \\frac{a}{b}
   - Horizontale Linien mit Zahlen darÃ¼ber und darunter sind BrÃ¼che

3. Potenzen/Hochzahlen: a^{n} oder a^n
   - Kleine Zahlen rechts oben sind Exponenten
   - Beispiel: aÂ² â†’ a^2, xÂ³ â†’ x^3

4. Indizes (tiefgestellt): a_{n}
   - Kleine Zahlen rechts unten sind Indizes

5. Griechische Buchstaben als LaTeX:
   - Î± â†’ \\alpha, Î² â†’ \\beta, Î³ â†’ \\gamma, Ï€ â†’ \\pi, Î£ â†’ \\sum, etc.

6. Weitere Symbole:
   - Ã— oder Â· (Multiplikation) â†’ \\cdot oder \\times
   - Ã· â†’ \\div
   - â‰  â†’ \\neq
   - â‰¤ â†’ \\leq, â‰¥ â†’ \\geq
   - âˆž â†’ \\infty
   - âˆ« â†’ \\int

KONTEXT - Die Fragestellung war: ${question}

AUSGABEFORMAT:
- Gib mathematische AusdrÃ¼cke in LaTeX-Notation zurÃ¼ck
- FÃ¼r komplexe Formeln nutze Display-Math: $$...$$
- FÃ¼r inline Formeln nutze: $...$
- Tabellen als Markdown-Tabellen
- NUR die Transkription, keine Kommentare oder Bewertung`

function AppContent() {
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

  const { devMode, setDevMode } = useDebugMode()
  const [devUnlockOpen, setDevUnlockOpen] = useState(false)
  const [devPasswordInput, setDevPasswordInput] = useState('')
  const logoClicksRef = useRef<{ count: number; timer?: number }>({ count: 0 })
  const devPassword = import.meta.env.VITE_DEV_MODE_PASSWORD || 'studysync'

  const handleLogoClick = () => {
    const ref = logoClicksRef.current
    if (!ref.timer) {
      ref.timer = window.setTimeout(() => {
        logoClicksRef.current.count = 0
        logoClicksRef.current.timer = undefined
      }, 3500)
    }
    ref.count += 1
    if (ref.count >= 5) {
      ref.count = 0
      if (ref.timer) {
        clearTimeout(ref.timer)
        ref.timer = undefined
      }
      setDevUnlockOpen(true)
    }
  }

  const handleUnlockDevMode = () => {
    if (devPasswordInput === devPassword) {
      setDevMode(true)
      toast.success('Dev Mode aktiviert')
      setDevUnlockOpen(false)
      setDevPasswordInput('')
    } else {
      toast.error('Falsches Passwort')
    }
  }

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
  const [serverBackupOpen, setServerBackupOpen] = useState(false)
  const [showQuizMode, setShowQuizMode] = useState(false)
  const [showExamMode, setShowExamMode] = useState(false)
  const [taskFeedback, setTaskFeedback] = useState<{
    isCorrect: boolean
    hints?: string[]
    transcription?: string
  } | null>(null)
  
  const [pipelineTasks, setPipelineTasks] = useState<PipelineTask[]>([])
  const [storageInitialized, setStorageInitialized] = useState(false)
  const notificationsEnabled = false
  const renderNotificationCenter = () => {
    if (!notificationsEnabled) return null
    return (
      <NotificationCenter
        tasks={pipelineTasks}
        onDismiss={(taskId) => setPipelineTasks((current) => current.filter((t) => t.id !== taskId))}
        onClearAll={() => setPipelineTasks([])}
      />
    )
  }
  
  // Globaler State fÃ¼r Exam-Generierung (damit das Widget Ã¼berall sichtbar ist)
  const [examGenerationState, setExamGenerationState] = useState<ExamGenerationState | null>(null)
  
  // Globaler State fÃ¼r andere KI-Aktionen (Analyse, Notizen, Aufgaben, Karteikarten)
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

  // Prevent leaving the app with browser back (global guard)
  useEffect(() => {
    const guard = () => {
      try {
        window.history.pushState({ guard: true }, '')
      } catch {
        // ignore
      }
    }
    guard()
    const onPopState = (e: PopStateEvent) => {
      e.preventDefault()
      guard()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Prevent browser back from exiting the app while a task modal is open
  useEffect(() => {
    if (!activeTask) return

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault()
      setActiveTask(null)
      setTaskFeedback(null)
      setTaskSequence(null)
      setActiveSequenceIndex(null)
      setStudyRoomSolveContext(null)
    }

    window.history.pushState({ modal: 'task' }, '')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeTask])
  
  // Ref fÃ¼r das Modul/Scripts wÃ¤hrend einer laufenden Exam-Generierung
  // Damit die Generierung weiterlÃ¤uft, auch wenn der User das Modul wechselt
  const examGenerationModuleRef = useRef<{ module: Module; scripts: Script[] } | null>(null)
  
  // Ref fÃ¼r versteckten File-Input (Import)
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
    
    // Input zurÃ¼cksetzen
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

  const buildModuleMeta = useCallback((moduleId?: string, topic?: string) => {
    const mod = modules?.find((m) => m.id === moduleId)
    const moduleTasks = tasks?.filter((t) => t.moduleId === moduleId) || []
    const sampleTasks = moduleTasks.slice(0, 3).map((t) => ({
      question: t.question.slice(0, 800),
      difficulty: t.difficulty,
      tags: t.tags,
    }))
    return {
      moduleTitle: mod?.name,
      moduleTags: Array.from(
        new Set(
          moduleTasks
            .flatMap((t) => t.tags || [])
            .filter(Boolean)
        )
      ).slice(0, 8),
      topic: topic || undefined,
      sampleTasks,
    }
  }, [modules, tasks])

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
        moduleMeta: buildModuleMeta(params.moduleId, params.topic),
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
        moduleMeta: selectedModuleId ? buildModuleMeta(selectedModuleId) : undefined,
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
        moduleMeta: buildModuleMeta(studyRoom.moduleId, studyRoom.topic),
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
      toast.success('Stimme fÃ¼r VerlÃ¤ngerung gezÃ¤hlt')
    } catch (error) {
      console.error('[StudyRoom] vote extension failed', error)
      toast.error('Konnte VerlÃ¤ngerung nicht senden')
    }
  }


  const handleUnsubmit = async () => {
    if (!studyRoom || !studyRoomIdentity) return
    try {
      await unsubmitStudyRound(studyRoom.id, { userId: studyRoomIdentity.userId })
      await refreshStudyRoom(studyRoom.id)
      toast.info('Antwort wieder bearbeitbar')
      openStudyRoomTask()
    } catch (error) {
      console.error('[StudyRoom] unsubmit failed', error)
      toast.error('Konnte Antwort nicht freigeben')
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

  // Einmalige Tag-Migration fÃ¼r bestehende Tasks
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

  useEffect(() => {
    const round = studyRoom?.currentRound
    if (!round) return
    const isStudySolverOpen = !!studyRoomSolveContext && activeTask
    if ((round.phase === 'starting' || round.phase === 'running') && !isStudySolverOpen) {
      openStudyRoomTask()
    }
    if (round.phase === 'review') {
      setActiveTask(null)
      setStudyRoomSolveContext(null)
    }
  }, [studyRoom?.currentRound?.id, studyRoom?.currentRound?.phase])

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
    
    // Sammle alle relevanten Tasks nach Typ (nur pending/processing fÃ¼r neuen State)
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
        // Setze auf complete fÃ¼r die Fertig-Animation
        return { ...prev, isComplete: true, progress: 100 }
      }
      
      // Wenn bereits complete und keine aktiven Tasks, nichts Ã¤ndern (wird durch Timer entfernt)
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
      
      // Wenn sich nichts geÃ¤ndert hat, nicht updaten
      if (prev && 
          prev.type === activeActionType &&
          prev.progress === totalProgress &&
          prev.processedCount === completedCount &&
          prev.isComplete === allComplete) {
        return prev
      }
      
      // Wenn schon ein State existiert fÃ¼r diesen Typ, nur updaten
      // WICHTIG: totalCount nur erhÃ¶hen, nie verringern (damit die Anzeige stabil bleibt)
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

  // Handler zum Ã–ffnen des Bearbeitungsdialogs
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

  // Modul lÃ¶schen mit allem Inhalt
  const handleDeleteModule = async (moduleId: string) => {
    try {
      // Alle zugehÃ¶rigen Daten lÃ¶schen
      const moduleScriptsToDelete = scripts?.filter(s => s.moduleId === moduleId) || []
      const moduleNotesToDelete = notes?.filter(n => n.moduleId === moduleId) || []
      const moduleTasksToDelete = tasks?.filter(t => t.moduleId === moduleId) || []
      const moduleFlashcardsToDelete = flashcards?.filter(f => f.moduleId === moduleId) || []
      
      // Alle Inhalte parallel lÃ¶schen
      await Promise.all([
        ...moduleScriptsToDelete.map(s => removeScript(s.id)),
        ...moduleNotesToDelete.map(n => removeNote(n.id)),
        ...moduleTasksToDelete.map(t => removeTask(t.id)),
        ...moduleFlashcardsToDelete.map(f => removeFlashcard(f.id)),
      ])
      
      // Dann das Modul selbst lÃ¶schen
      await removeModule(moduleId)
      
      // Falls gerade in diesem Modul, zurÃ¼ck zur Hauptseite
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null)
      }
      
      toast.success('Modul und alle Inhalte gelÃ¶scht')
    } catch (error) {
      console.error('Fehler beim LÃ¶schen des Moduls:', error)
      toast.error('Fehler beim LÃ¶schen des Moduls')
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
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
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
        const prompt = `Du bist ein Experte fÃ¼r die Erstellung wissenschaftlicher Lernnotizen im LaTeX-Stil.

KURSMATERIAL ZUM ZUSAMMENFASSEN:
${script.content}

ERSTELLE STRUKTURIERTE LERNNOTIZEN MIT FOLGENDEN VORGABEN:

## FORMATIERUNG (WICHTIG!)

1. **Ãœberschriften** mit Markdown:
   - # Hauptthema
   - ## Abschnitt
   - ### Unterabschnitt

2. **Mathematische Formeln** IMMER in LaTeX:
   - Inline: $a^2 + b^2 = c^2$
   - Block (fÃ¼r wichtige Formeln):
     $$f(x) = \\frac{a}{b} + \\sqrt{x}$$

3. **Tabellen** als Markdown:
   | Spalte 1 | Spalte 2 |
   |----------|----------|
   | Wert 1   | Wert 2   |

4. **Listen** fÃ¼r AufzÃ¤hlungen:
   - Stichpunkt 1
   - Stichpunkt 2

5. **Hervorhebungen**:
   - **Fett** fÃ¼r wichtige Begriffe
   - *Kursiv* fÃ¼r Definitionen

## INHALTLICHE STRUKTUR

1. **Titel & Ãœberblick**
   - Thema klar benennen
   - Kurze Einleitung (1-2 SÃ¤tze)

2. **Kernkonzepte**
   - Definitionen prÃ¤zise formulieren
   - Wichtige Eigenschaften auflisten

3. **Formeln & Gesetze**
   - Alle relevanten Formeln in LaTeX
   - Kurze ErklÃ¤rung jeder Formel
   - Beispiel: $E = mc^2$ (Energie-Masse-Ã„quivalenz)

4. **ZusammenhÃ¤nge & Regeln**
   - Logische VerknÃ¼pfungen darstellen
   - Bei Bedarf Wahrheitstabellen

5. **Beispiele**
   - Mindestens ein durchgerechnetes Beispiel
   - Schritt-fÃ¼r-Schritt-LÃ¶sung

6. **MerksÃ¤tze**
   - Wichtigste Punkte zum EinprÃ¤gen
   - Kurz und prÃ¤gnant

## VERBOTEN:
- Kein Inhaltsverzeichnis
- Keine Referenzen/Quellenangaben
- Kein FlieÃŸtext ohne Struktur
- Keine Wiederholungen

## BEISPIEL FÃœR GUTE NOTATION:

### Quadratische Gleichung
Die allgemeine Form lautet:
$$ax^2 + bx + c = 0$$

**LÃ¶sungsformel (Mitternachtsformel):**
$$x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

**Diskriminante:** $D = b^2 - 4ac$
- $D > 0$: Zwei reelle LÃ¶sungen
- $D = 0$: Eine reelle LÃ¶sung
- $D < 0$: Keine reelle LÃ¶sung

---

Erstelle jetzt die Lernnotizen auf Deutsch. Nutze konsequent LaTeX fÃ¼r alle mathematischen AusdrÃ¼cke!`

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

        toast.success(`Notizen fÃ¼r "${script.name}" erfolgreich erstellt`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: 'Erstellung fehlgeschlagen',
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
              timestamp: Date.now() 
            } : t
          )
        )
        toast.error(`Fehler beim Erstellen der Notizen fÃ¼r "${script.name}"`)
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

        const prompt = `Du bist ein erfahrener Dozent. Erstelle 3-5 abwechslungsreiche Ãœbungsaufgaben basierend auf dem bereitgestellten Kontext.

WICHTIG - Aufgaben sollen KURZ und PRÃ„ZISE sein:
- easy = 1-2 Minuten LÃ¶sungszeit, sehr kurze Rechenaufgaben
- medium = 3-5 Minuten, mittlere Interpretationsaufgaben  
- hard = 5-10 Minuten, maximal 2-3 Teilaufgaben

Variation: Mische kurze Berechnungen, VerstÃ¤ndnisfragen und ab und zu komplexere Aufgaben.

${contentSection}
${contextPack.inputModeConstraints}
${allowedTagsSection}

ANTWORTE NUR MIT VALIDEM JSON in diesem Format:
{
  "tasks": [
    {
      "question": "### Kurzer Titel\n\nKlare, prÃ¤zise Aufgabenstellung auf Deutsch.",
      "solution": "Kurze, strukturierte LÃ¶sung",
      "difficulty": "easy" | "medium" | "hard",
      "topic": "Hauptthema der Aufgabe",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Regeln:
- Fragen in Markdown formatieren (### fÃ¼r Titel, - fÃ¼r Listen)
- Keine TextwÃ¼sten - maximal 3-4 SÃ¤tze pro Aufgabe
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
          throw new Error('UngÃ¼ltiges Antwortformat von der KI')
        }

        if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
          throw new Error('Antwort enthÃ¤lt kein tasks-Array')
        }

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 85 } : t))
        )

        // Modul-Informationen fÃ¼r Tags holen
        const moduleInfo = modules?.find(m => m.id === script.moduleId)

        // Create initial tasks from parsed response with normalized tags
        const initialTasks: Task[] = []
        for (const t of parsed.tasks) {
          // Extrahiere zusÃ¤tzliche Tags wenn nicht vom LLM geliefert
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
              const regeneratePrompt = `Generiere EINE neue Ãœbungsaufgabe zum Thema "${task.topic || 'Allgemein'}".

${contentSection}
${contextPack.inputModeConstraints}
${allowedTagsSection}

WICHTIG - VERMEIDE DIESE PROBLEME:
- ${issuesToAvoid.join('\n- ')}

ANTWORTE NUR MIT VALIDEM JSON:
{
  "question": "PrÃ¤zise Aufgabenstellung",
  "solution": "Kurze LÃ¶sung",
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
            `${validatedTasks.length} Aufgaben fÃ¼r "${script.name}" erstellt` +
            (validationStats.repaired > 0 ? ` (${validationStats.repaired} repariert)` : '') +
            (validationStats.failed > 0 ? ` (${validationStats.failed} mit Warnungen)` : '')
          )
        } else {
          toast.success(`${validatedTasks.length} Aufgaben fÃ¼r "${script.name}" erstellt`)
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
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
              timestamp: Date.now()
            } : t
          )
        )
        toast.error(`Fehler beim Erstellen der Aufgaben fÃ¼r "${script.name}"`)
      }
    }

    await taskQueue.add({ id: taskId, execute })
  }

  // Neue Funktion: Generiere Tasks fÃ¼r mehrere Scripts (vom Dashboard)
  const handleGenerateTasksFromDashboard = async (moduleId: string, scriptIds: string[]) => {
    // Filter scripts die zum Modul gehÃ¶ren
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

      if (!isStudyRoomAttempt) {
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
      }

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

      if (isStudyRoomAttempt) {
        // StudyRoom: submit without evaluation, lock submission and go back to lobby
        try {
          await submitStudyRound(studyRoomSolveContext.roomId, {
            userId: studyRoomIdentity.userId,
            answerPreview: limitAnswerPreview(userAnswer),
            answerText: userAnswer,
          })
          await refreshStudyRoom(studyRoomSolveContext.roomId)
          setActiveTask(null)
          setStudyRoomSolveContext(null)
          setTaskFeedback(null)
          toast.success('Abgabe gesperrt â€“ zurÃ¼ck zur Lobby')
          return
        } catch (submitError) {
          console.error('[StudyRoom] submit failed', submitError)
          toast.error('Abgabe konnte nicht gesendet werden')
          throw submitError
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

        if (evaluation.isCorrect) {
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

    // Stelle sicher, dass der Aufgaben-Tab aktiv bleibt, wenn wir zurückgehen
    try {
      localStorage.setItem(`module-active-tab:${task.moduleId}`, 'tasks')
    } catch {
      // ignore
    }

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
      toast.success('Alle Aufgaben im Block abgeschlossen! ðŸŽ‰')
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
      
      // Zuerst verknÃ¼pfte Daten lÃ¶schen
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
      
      toast.success('Skript gelÃ¶scht')
    } catch (error) {
      console.error('Fehler beim LÃ¶schen:', error)
      toast.error('Fehler beim LÃ¶schen des Skripts')
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
      toast.info(`Analyse fÃ¼r "${script.name}" wurde gestartet`)
    } catch (error) {
      console.error('Fehler beim Starten der Analyse:', error)
      toast.error('Fehler beim Starten der Analyse')
    }
  }

  // Alle Skripte im Modul neu analysieren (vorherige Analysen lÃ¶schen)
  const handleReanalyzeAllScripts = async () => {
    if (!selectedModuleId) return
    const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
    
    if (moduleScripts.length === 0) {
      toast.error('Keine Skripte zum Analysieren vorhanden')
      return
    }
    
    // Alte Analysen fÃ¼r dieses Modul lÃ¶schen
    try {
      const { deleteModuleDocumentAnalyses } = await import('@/lib/analysis-storage')
      await deleteModuleDocumentAnalyses(selectedModuleId)
    } catch (error) {
      console.warn('Fehler beim LÃ¶schen alter Analysen:', error)
    }
    
    // Neue Analysen starten - ALLE auf einmal zur Queue hinzufÃ¼gen
    const scriptsWithContent = moduleScripts.filter(s => s.content)
    
    // WICHTIG: Erst alle Tasks zur Pipeline hinzufÃ¼gen, damit die UI sofort die richtige Anzahl zeigt
    const newTasks = scriptsWithContent.map(script => ({
      id: `analyze-${script.id}`,
      type: 'analyze' as const,
      name: script.name,
      progress: 0,
      status: 'pending' as const,
      timestamp: Date.now(),
    }))
    
    setPipelineTasks(current => {
      // Entferne eventuell vorhandene alte Tasks fÃ¼r diese Skripte
      const filtered = current.filter(t => !newTasks.some(nt => nt.id === t.id))
      return [...filtered, ...newTasks]
    })
    
    // Dann die Analysen starten (ohne await, da wir die Tasks schon hinzugefÃ¼gt haben)
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
    
    toast.success(`Neu-Analyse fÃ¼r ${scriptsWithContent.length} Skripte(n) gestartet`)
  }

  // AusgewÃ¤hlte Skripte neu analysieren (vorherige Analysen lÃ¶schen)
  const handleReanalyzeSelectedScripts = async (scriptIds: string[]) => {
    if (scriptIds.length === 0) {
      toast.error('Keine Skripte ausgewÃ¤hlt')
      return
    }
    
    const selectedScripts = scripts?.filter((s) => scriptIds.includes(s.id)) || []
    
    // Alte Analysen fÃ¼r die ausgewÃ¤hlten Skripte lÃ¶schen
    try {
      const { deleteDocumentAnalysis } = await import('@/lib/analysis-storage')
      for (const script of selectedScripts) {
        await deleteDocumentAnalysis(script.moduleId, script.id)
      }
    } catch (error) {
      console.warn('Fehler beim LÃ¶schen alter Analysen:', error)
    }
    
    // Neue Analysen starten - ALLE auf einmal zur Queue hinzufÃ¼gen
    const scriptsWithContent = selectedScripts.filter(s => s.content)
    
    // WICHTIG: Erst alle Tasks zur Pipeline hinzufÃ¼gen, damit die UI sofort die richtige Anzahl zeigt
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
    
    toast.success(`Neu-Analyse fÃ¼r ${scriptsWithContent.length} Skript(e) gestartet`)
  }

  // Notizen fÃ¼r ausgewÃ¤hlte Skripte generieren
  const handleGenerateNotesForSelected = async (scriptIds: string[]) => {
    if (scriptIds.length === 0) {
      toast.error('Keine Skripte ausgewÃ¤hlt')
      return
    }
    
    // Alle auf einmal starten - die Tasks werden von handleGenerateNotes erstellt
    const selectedScripts = scripts?.filter((s) => scriptIds.includes(s.id)) || []
    for (const script of selectedScripts) {
      handleGenerateNotes(script.id)
    }
    
    toast.success(`Notizen-Generierung fÃ¼r ${scriptIds.length} Skript(e) gestartet`)
  }

  // Aufgaben fÃ¼r ausgewÃ¤hlte Skripte generieren
  const handleGenerateTasksForSelected = async (scriptIds: string[]) => {
    if (scriptIds.length === 0) {
      toast.error('Keine Skripte ausgewÃ¤hlt')
      return
    }
    
    // Alle auf einmal starten - die Tasks werden von handleGenerateTasks erstellt
    const selectedScripts = scripts?.filter((s) => scriptIds.includes(s.id)) || []
    for (const script of selectedScripts) {
      handleGenerateTasks(script.id)
    }
    
    toast.success(`Aufgaben-Generierung fÃ¼r ${scriptIds.length} Skript(e) gestartet`)
  }

  
const handleDeleteNote = async (noteId: string) => {
    try {
      const relatedFlashcards = flashcards?.filter((f) => f.noteId === noteId) || []
      await Promise.all([
        ...relatedFlashcards.map((f) => removeFlashcard(f.id)),
        removeNote(noteId),
      ])
      toast.success('Notiz gelÃ¶scht')
    } catch (error) {
      console.error('Fehler beim LÃ¶schen:', error)
      toast.error('Fehler beim LÃ¶schen der Notiz')
    }
  }

  
const handleDeleteTask = async (taskId: string) => {
    try {
      await removeTask(taskId)
      toast.success('Aufgabe gelÃ¶scht')
    } catch (error) {
      console.error('Fehler beim LÃ¶schen:', error)
      toast.error('Fehler beim LÃ¶schen der Aufgabe')
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

        const prompt = `Du bist ein Experte fÃ¼r das Erstellen von Lernkarten. Analysiere die folgenden Notizen und erstelle daraus Karteikarten.

Notizen:
${note.content}

Erstelle 5-10 Karteikarten als JSON-Objekt mit einer einzelnen Eigenschaft "flashcards", die ein Array von Karteikarten-Objekten enthÃ¤lt. Jede Karteikarte muss diese exakten Felder haben:
- front: Die Frage oder das Konzept (kurz und prÃ¤gnant, AUF DEUTSCH) (string)
- back: Die Antwort oder ErklÃ¤rung (klar und vollstÃ¤ndig, AUF DEUTSCH) (string)

Erstelle Karten, die SchlÃ¼sselkonzepte, Definitionen, Formeln und wichtige ZusammenhÃ¤nge abdecken.

Beispielformat:
{
  "flashcards": [
    {
      "front": "Was ist die Formel fÃ¼r die KreisflÃ¤che?",
      "back": "A = Ï€ Ã— rÂ²\n\nDabei ist:\n- A = FlÃ¤che\n- r = Radius\n- Ï€ â‰ˆ 3,14159"
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
          throw new Error('UngÃ¼ltiges Antwortformat von der KI')
        }

        if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
          throw new Error('Antwort enthÃ¤lt kein flashcards-Array')
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
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
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
      toast.success('Karteikarte gelÃ¶scht')
    } catch (error) {
      console.error('Fehler beim LÃ¶schen:', error)
      toast.error('Fehler beim LÃ¶schen der Karteikarte')
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
      toast.success(`${ids.length} Skripte gelÃ¶scht`)
    } catch (error) {
      console.error('Fehler beim Bulk-LÃ¶schen der Skripte:', error)
      toast.error('Fehler beim LÃ¶schen der Skripte')
    }
  }

  const handleBulkDeleteNotes = async (ids: string[]) => {
    try {
      const relatedFlashcards = flashcards?.filter((f) => ids.includes(f.noteId)) || []
      await Promise.all([
        ...relatedFlashcards.map((f) => removeFlashcard(f.id)),
        ...ids.map((id) => removeNote(id)),
      ])
      toast.success(`${ids.length} Notizen gelÃ¶scht`)
    } catch (error) {
      console.error('Fehler beim Bulk-LÃ¶schen der Notizen:', error)
      toast.error('Fehler beim LÃ¶schen der Notizen')
    }
  }

  const handleBulkDeleteTasks = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => removeTask(id)))
      toast.success(`${ids.length} Aufgaben gelÃ¶scht`)
    } catch (error) {
      console.error('Fehler beim Bulk-LÃ¶schen der Aufgaben:', error)
      toast.error('Fehler beim LÃ¶schen der Aufgaben')
    }
  }

  const handleBulkDeleteFlashcards = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => removeFlashcard(id)))
      toast.success(`${ids.length} Karteikarten gelÃ¶scht`)
    } catch (error) {
      console.error('Fehler beim Bulk-LÃ¶schen der Karteikarten:', error)
      toast.error('Fehler beim LÃ¶schen der Karteikarten')
    }
  }

  const handleStartFlashcardStudy = () => {
    if (!selectedModuleId) return
    const dueCards = moduleFlashcards.filter((card) => {
      if (!card.nextReview) return true
      return new Date(card.nextReview) <= new Date()
    })
    
    if (dueCards.length === 0) {
      toast.info('Keine fÃ¤lligen Karteikarten zum Lernen')
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
          name: 'Aufgabe wird Ã¼berprÃ¼ft',
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
          // Sende das Bild an die Vision-API fÃ¼r echte Handschrift-Erkennung
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
                errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
                timestamp: Date.now()
              } : t
            )
          )
          
          toast.error('Fehler beim Analysieren der Handschrift. Siehe Benachrichtigungen fÃ¼r Details.')
          throw transcriptionError
        }
      }

      setPipelineTasks((current) =>
        current.map((t) => (t.id === taskId ? { ...t, progress: 50, name: 'Antwort wird bewertet' } : t))
      )

      toast.loading('ÃœberprÃ¼fe deine Antwort...', { id: 'quiz-submit' })
      
      try {
        const evaluationPrompt = `Du bist ein Dozent, der die Antwort eines Studenten bewertet.

Fragestellung: ${task.question}
MusterlÃ¶sung: ${task.solution}
Antwort des Studenten: ${userAnswer}

Bewerte, ob die Antwort des Studenten korrekt ist. Sie mÃ¼ssen nicht wortwÃ¶rtlich Ã¼bereinstimmen, aber die SchlÃ¼sselkonzepte und die Endergebnisse sollten korrekt sein.

Gib deine Antwort als JSON zurÃ¼ck:
{
  "isCorrect": true/false,
  "hints": ["hinweis1", "hinweis2"] (nur falls inkorrekt, gib 2-3 hilfreiche Hinweise AUF DEUTSCH ohne die LÃ¶sung preiszugeben)
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
              errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
              timestamp: Date.now()
            } : t
          )
        )
        
        toast.error('Fehler beim Bewerten der Antwort. Siehe Benachrichtigungen fÃ¼r Details.')
        throw evaluationError
      }
    } catch (error) {
      console.error('Fehler bei AntwortÃ¼berprÃ¼fung:', error)
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
                : 'Fehler bei der AufgabenprÃ¼fung')
              : 'Unerwarteter Fehler',
            errorDetails: `Fehler: ${errorMessage}\n\nStack Trace:\n${errorStack || 'Nicht verfÃ¼gbar'}`,
            timestamp: Date.now()
          } : t
        )
      })
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
          toast.error('API-Limit erreicht. Bitte warte einen Moment.')
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Netzwerkfehler. Bitte Ã¼berprÃ¼fe deine Internetverbindung.')
        } else {
          toast.error(`Fehler: ${error.message}`)
        }
      } else {
        toast.error('Ein unerwarteter Fehler ist aufgetreten.')
      }
      
      throw error
    }
  }

  // Speichere das Modul fÃ¼r die Generierung, wenn eine neue Generierung startet
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

  // Versteckte ExamMode-Komponente fÃ¼r Hintergrund-Generierung
  // Nutzt das gespeicherte Modul aus dem Ref, damit die Generierung weiterlÃ¤uft
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
        {renderNotificationCenter()}
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
        {/* GroÃŸes AI Action UI */}
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
        {renderNotificationCenter()}
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
        {/* GroÃŸes AI Action UI */}
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
        {renderNotificationCenter()}
        <ExamMode
          module={selectedModule}
          scripts={moduleScripts}
          formulaSheets={moduleScripts.filter(s => s.category === 'formula')}
          onBack={() => {
            // Wenn gerade generiert wird, nicht den State lÃ¶schen
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
    const hudRound = isStudyRoomTask ? studyRoom?.currentRound : null
    const hudData = hudRound && studyRoom ? {
      roomCode: studyRoom.code,
      roundIndex: hudRound.roundIndex,
      mode: hudRound.mode,
      endsAt: hudRound.endsAt,
      extensionVotes: hudRound.extensionVotes.length,
      memberCount: studyRoom.members.length,
      submittedCount: hudRound.submissions.length,
      phase: hudRound.phase,
      lockCountdownStartAt: hudRound.lockCountdownStartAt,
    } : undefined

    return (
      <>
        {BackgroundExamGenerator}
        {renderNotificationCenter()}
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
          hideSolution={isStudyRoomTask}
          studyRoomHud={hudData}
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
        {/* GroÃŸes AI Action UI */}
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
        {renderNotificationCenter()}
        <BugReportListener />
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
          onUnsubmit={handleUnsubmit}
        />
      </>
    )
  }

  if (showStatistics) {
    return (
      <>
        {BackgroundExamGenerator}
        {renderNotificationCenter()}
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
        {/* GroÃŸes AI Action UI */}
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
        {renderNotificationCenter()}
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
        {/* GroÃŸes AI Action UI */}
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
        {renderNotificationCenter()}
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

        {/* EditModuleDialog auch in ModuleView verfÃ¼gbar */}
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
        {/* GroÃŸes AI Action UI */}
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
      {renderNotificationCenter()}
      
      <BugReportListener />
      {/* Flex-Container fuer Sticky Footer */}
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <h1
                      className="text-2xl sm:text-3xl font-semibold tracking-tight cursor-pointer select-none"
                      onClick={handleLogoClick}
                      title="StudyMate"
                    >
                      StudyMate
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                      Dein KI-gestuetzter Lernbegleiter fuer die Uni
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      title="Backup & Sync"
                    >
                      <DownloadSimple size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                      <span className="hidden sm:inline">Backup & Sync</span>
                      <span className="sm:hidden">Backup</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Backup & Datenabgleich</DropdownMenuLabel>
                    <DropdownMenuItem onClick={triggerImportDialog} className="gap-2">
                      <UploadSimple size={16} />
                      Backup aus Datei importieren
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setServerBackupOpen(true)} className="gap-2">
                      <CloudArrowDown size={16} />
                      Module vom Server laden
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleExportData}
                      disabled={!modules || modules.length === 0}
                      className="gap-2"
                    >
                      <DownloadSimple size={16} />
                      Backup exportieren
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

        {/* Hauptinhalt mit flex-1 fÃ¼r Sticky Footer */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
            {!modules || modules.length === 0 ? (
              <>
                <EmptyState
                  title="Noch keine Module"
                  description="Erstelle dein erstes Modul, um deine Kursmaterialien, Notizen und Ãœbungsaufgaben zu organisieren."
                  actionLabel="Erstes Modul erstellen"
                  onAction={() => setCreateDialogOpen(true)}
                  secondaryActionLabel="Backup aus Datei importieren"
                  onSecondaryAction={triggerImportDialog}
                  tertiaryActionLabel="Module vom Server laden"
                  onTertiaryAction={() => setServerBackupOpen(true)}
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
                StudyMate Â© {new Date().getFullYear()} Â· Deine Daten bleiben privat
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


        <Dialog open={devUnlockOpen} onOpenChange={setDevUnlockOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Dev Mode freischalten</DialogTitle>
              <DialogDescription>
                5 Klicks auf das Logo innerhalb weniger Sekunden oeffnen diese Abfrage. Passwort eingeben, um Dev Mode zu aktivieren.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="dev-password">Passwort</Label>
              <Input
                id="dev-password"
                type="password"
                value={devPasswordInput}
                onChange={(e) => setDevPasswordInput(e.target.value)}
              />
              <Button onClick={handleUnlockDevMode} className="w-full">
                Entsperren
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ServerBackupDialog
          open={serverBackupOpen}
          onOpenChange={setServerBackupOpen}
        />

        {/* Versteckter File-Input fuer Import */}
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          onChange={handleImportData}
          className="hidden"
        />

        {/* Onboarding Tutorial fÃ¼r neue Benutzer */}
        {isChecked && showOnboarding && (
          <OnboardingTutorial 
            onComplete={completeOnboarding}
            onCreateModule={() => setCreateDialogOpen(true)}
            onImportBackup={triggerImportDialog}
            onFetchServerBackup={() => setServerBackupOpen(true)}
          />
        )}
        
        {/* Globales Exam-Generation Widget - immer sichtbar wÃ¤hrend einer Generierung */}
        {examGenerationState && !showExamMode && (
          <ExamPreparationMinimized
            progress={examGenerationState.progress}
            isComplete={examGenerationState.isComplete}
            onClick={() => setShowExamMode(true)}
          />
        )}
        
        {/* AI Preparation UI - fÃ¼r Analyse, Notizen, Aufgaben, Karteikarten */}
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


function App() {
  return (
    <StudyRoomProvider>
      <AppContent />
    </StudyRoomProvider>
  )
}

export default App













