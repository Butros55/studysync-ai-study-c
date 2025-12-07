import { useState, useEffect, useCallback, useRef } from 'react'
import { useModules, useScripts, useNotes, useTasks, useFlashcards, migrateFromServerIfNeeded } from './hooks/use-database'
import { storageReady, downloadExportFile, importData } from './lib/storage'
import { Module, Script, StudyNote, Task, Flashcard } from './lib/types'
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
import { OnboardingTutorial, useOnboarding, OnboardingTrigger } from './components/OnboardingTutorial'
import { InputModeSettingsButton } from './components/InputModeSettings'
import { normalizeHandwritingOutput } from './components/MarkdownRenderer'
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
    
    const execute = async () => {
      setPipelineTasks((current) => [
        ...current,
        {
          id: taskId,
          type: 'generate-notes',
          name: script.name,
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
    
    const execute = async () => {
      setPipelineTasks((current) => [
        ...current,
        {
          id: taskId,
          type: 'generate-tasks',
          name: script.name,
          progress: 0,
          status: 'processing',
          timestamp: Date.now(),
        },
      ])

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

    // Generiere Tasks für jedes Script sequentiell
    for (const script of scriptsToProcess) {
      await handleGenerateTasks(script.id)
    }
  }

  const handleSubmitTaskAnswer = async (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => {
    if (!activeTask) return

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

      toast.loading('Überprüfe deine Antwort...', { id: 'task-submit' })
      
      try {
        const evaluationPrompt = `Du bist ein Dozent, der die Antwort eines Studenten bewertet.

Fragestellung: ${activeTask.question}
Musterlösung: ${activeTask.solution}
Antwort des Studenten: ${userAnswer}

Bewerte, ob die Antwort des Studenten korrekt ist. Sie müssen nicht wortwörtlich übereinstimmen, aber die Schlüsselkonzepte und die Endergebnisse sollten korrekt sein.

Gib deine Antwort als JSON zurück:
{
  "isCorrect": true/false,
  "hints": ["hinweis1", "hinweis2"] (nur falls inkorrekt, gib 2-3 hilfreiche Hinweise AUF DEUTSCH ohne die Lösung preiszugeben)
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

        // Statistiken für das Tutor-Dashboard aktualisieren
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

  const openTask = (task: Task, sequence?: Task[], startTaskId?: string) => {
    setSelectedModuleId(task.moduleId)

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

  if (activeFlashcards) {
    return (
      <>
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
      </>
    )
  }

  if (showQuizMode) {
    return (
      <>
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
      </>
    )
  }

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

    return (
      <>
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
          }}
          onSubmit={handleSubmitTaskAnswer}
          feedback={taskFeedback || undefined}
          onNextTask={hasNextTask ? handleNextTask : undefined}
          onTaskUpdate={async (updates) => {
            await updateTask(activeTask.id, updates)
            // Aktualisiere auch den lokalen State
            setActiveTask((current) => current ? { ...current, ...updates } : null)
          }}
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
      </>
    )
  }

  if (showStatistics) {
    return (
      <>
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
      </>
    )
  }

  if (showCostTracking) {
    return (
      <>
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
      </>
    )
  }

  if (selectedModule) {
    return (
      <>
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
      </>
    )
  }

  return (
    <>
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
      </div>
    </>
  )
}

export default App