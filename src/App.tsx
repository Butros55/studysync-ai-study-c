import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Module, Script, StudyNote, Task, Flashcard } from './lib/types'
import { ModuleCard } from './components/ModuleCard'
import { CreateModuleDialog } from './components/CreateModuleDialog'
import { ModuleView } from './components/ModuleView'
import { TaskSolver } from './components/TaskSolver'
import { FlashcardStudy } from './components/FlashcardStudy'
import { QuizMode } from './components/QuizMode'
import { EmptyState } from './components/EmptyState'
import { NotificationCenter, PipelineTask } from './components/NotificationCenter'
import { StatisticsDashboard } from './components/StatisticsDashboard'
import { RateLimitIndicator } from './components/RateLimitIndicator'
import { RateLimitBanner } from './components/RateLimitBanner'
import { DebugModeToggle } from './components/DebugModeToggle'
import { Button } from './components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet'
import { Plus, ChartLine, List, Sparkle } from '@phosphor-icons/react'
import { generateId, getRandomColor } from './lib/utils-app'
import { calculateNextReview } from './lib/spaced-repetition'
import { toast } from 'sonner'
import { taskQueue } from './lib/task-queue'
import { llmWithRetry } from './lib/llm-utils'

function App() {
  const [modules, setModules] = useKV<Module[]>('modules', [])
  const [scripts, setScripts] = useKV<Script[]>('scripts', [])
  const [notes, setNotes] = useKV<StudyNote[]>('notes', [])
  const [tasks, setTasks] = useKV<Task[]>('tasks', [])
  const [flashcards, setFlashcards] = useKV<Flashcard[]>('flashcards', [])

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[] | null>(null)
  const [showStatistics, setShowStatistics] = useState(false)
  const [showQuizMode, setShowQuizMode] = useState(false)
  const [taskFeedback, setTaskFeedback] = useState<{
    isCorrect: boolean
    hints?: string[]
    transcription?: string
  } | null>(null)
  
  const [pipelineTasks, setPipelineTasks] = useState<PipelineTask[]>([])

  const selectedModule = modules?.find((m) => m.id === selectedModuleId)
  const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
  const moduleNotes = notes?.filter((n) => n.moduleId === selectedModuleId) || []
  const moduleTasks = tasks?.filter((t) => t.moduleId === selectedModuleId) || []
  const moduleFlashcards = flashcards?.filter((f) => f.moduleId === selectedModuleId) || []

  const handleCreateModule = (name: string, code: string) => {
    const newModule: Module = {
      id: generateId(),
      name,
      code,
      createdAt: new Date().toISOString(),
      color: getRandomColor(),
    }
    setModules((current) => [...(current || []), newModule])
    toast.success('Modul erfolgreich erstellt')
  }

  const handleUploadScript = async (content: string, name: string, fileType?: string, fileData?: string) => {
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
        }
        
        setScripts((current) => [...(current || []), newScript])
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 70 } : t))
        )
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )

        toast.success(`"${name}" erfolgreich hochgeladen`)
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

        // @ts-ignore - spark.llmPrompt template literal typing
        const prompt = spark.llmPrompt`Du bist ein Experten-Studienassistent. Analysiere das folgende Kursmaterial und erstelle umfassende Lernnotizen.

Kursmaterial:
${script.content}

Erstelle gut strukturierte Lernnotizen mit:
1. Schlüsselkonzepten und Definitionen
2. Wichtigen Formeln oder Prinzipien
3. Zusammenfassungspunkte
4. Dinge, die man sich merken sollte

Formatiere die Notizen übersichtlich und lernfreundlich AUF DEUTSCH.`

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 30 } : t))
        )

        const notesContent = await llmWithRetry(prompt, 'gpt-4o', false)

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

        setNotes((current) => [...(current || []), newNote])
        
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
          current.map((t) => (t.id === taskId ? { ...t, progress: 10 } : t))
        )

        await new Promise(resolve => setTimeout(resolve, 100))

        // @ts-ignore - spark.llmPrompt template literal typing
        const prompt = spark.llmPrompt`Du bist ein Experten-Dozent. Basierend auf dem folgenden Kursmaterial, erstelle 3-5 Übungsaufgaben mit unterschiedlichen Schwierigkeitsgraden.

Kursmaterial:
${script.content}

Erstelle Aufgaben als JSON-Objekt mit einer einzelnen Eigenschaft "tasks", die ein Array von Aufgabenobjekten enthält. Jede Aufgabe muss diese exakten Felder haben:
- question: Eine klare Aufgabenstellung AUF DEUTSCH (string)
- solution: Die vollständige Lösung mit Erklärung AUF DEUTSCH (string)
- difficulty: Muss genau einer dieser Werte sein: "easy", "medium", oder "hard"

Erstelle praxisnahe Aufgaben, die das Verständnis der Schlüsselkonzepte testen.

Beispielformat:
{
  "tasks": [
    {
      "question": "Was ist 2+2?",
      "solution": "Die Antwort ist 4, weil...",
      "difficulty": "easy"
    }
  ]
}`

        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 30 } : t))
        )

        const response = await llmWithRetry(prompt, 'gpt-4o', true)
        
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

        const newTasks: Task[] = parsed.tasks.map((t: any) => ({
          id: generateId(),
          moduleId: script.moduleId,
          scriptId: script.id,
          question: t.question,
          solution: t.solution,
          difficulty: t.difficulty || 'medium',
          createdAt: new Date().toISOString(),
          completed: false,
        }))

        setTasks((current) => [...(current || []), ...newTasks])
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )

        toast.success(`${newTasks.length} Aufgaben für "${script.name}" erstellt`)
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
          // @ts-ignore - spark.llmPrompt template literal typing
          const visionPrompt = spark.llmPrompt`Du bist ein Experte für das Lesen von Handschrift und mathematischen Notationen. 
        
Analysiere das folgende Bild einer handschriftlichen Lösung und transkribiere GENAU was du siehst.

Fragestellung war: ${activeTask.question}

Extrahiere den gesamten Text, mathematische Formeln, Gleichungen und Schritte. Bewahre die mathematische Notation und Struktur.

WICHTIG: Gib nur die reine Transkription zurück, keine Bewertung oder zusätzliche Kommentare.

Falls du mathematische Formeln siehst, nutze LaTeX-ähnliche Notation (z.B. a^2 + b^2 = c^2).`

          const visionResponse = await llmWithRetry(visionPrompt, 'gpt-4o', false)
          transcription = visionResponse.trim()
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
        // @ts-ignore - spark.llmPrompt template literal typing
        const evaluationPrompt = spark.llmPrompt`Du bist ein Dozent, der die Antwort eines Studenten bewertet.

Fragestellung: ${activeTask.question}
Musterlösung: ${activeTask.solution}
Antwort des Studenten: ${userAnswer}

Bewerte, ob die Antwort des Studenten korrekt ist. Sie müssen nicht wortwörtlich übereinstimmen, aber die Schlüsselkonzepte und die Endergebnisse sollten korrekt sein.

Gib deine Antwort als JSON zurück:
{
  "isCorrect": true/false,
  "hints": ["hinweis1", "hinweis2"] (nur falls inkorrekt, gib 2-3 hilfreiche Hinweise AUF DEUTSCH ohne die Lösung preiszugeben)
}`

        const response = await llmWithRetry(evaluationPrompt, 'gpt-4o', true)
        const evaluation = JSON.parse(response)

        toast.dismiss('task-submit')
        
        setPipelineTasks((current) =>
          current.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        )
        
        setTaskFeedback({
          ...evaluation,
          transcription: isHandwritten ? transcription : undefined
        })

        if (evaluation.isCorrect) {
          setTasks((current) =>
            (current || []).map((t) =>
              t.id === activeTask.id ? { ...t, completed: true } : t
            )
          )
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

  const handleNextTask = () => {
    const currentIndex = moduleTasks.findIndex((t) => t.id === activeTask?.id)
    const incompleteTasks = moduleTasks.filter((t) => !t.completed)
    const nextTask = incompleteTasks.find((t, idx) => {
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

  const handleDeleteScript = (scriptId: string) => {
    setScripts((current) => (current || []).filter((s) => s.id !== scriptId))
    setNotes((current) => (current || []).filter((n) => n.scriptId !== scriptId))
    setTasks((current) => (current || []).filter((t) => t.scriptId !== scriptId))
  }

  const handleDeleteNote = (noteId: string) => {
    setNotes((current) => (current || []).filter((n) => n.id !== noteId))
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks((current) => (current || []).filter((t) => t.id !== taskId))
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

        // @ts-ignore - spark.llmPrompt template literal typing
        const prompt = spark.llmPrompt`Du bist ein Experte für das Erstellen von Lernkarten. Analysiere die folgenden Notizen und erstelle daraus Karteikarten.

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

        const response = await llmWithRetry(prompt, 'gpt-4o', true)
        
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

        setFlashcards((current) => [...(current || []), ...newFlashcards])
        
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

  const handleDeleteFlashcard = (flashcardId: string) => {
    setFlashcards((current) => (current || []).filter((f) => f.id !== flashcardId))
    toast.success('Karteikarte gelöscht')
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

  const handleReviewFlashcard = (flashcardId: string, quality: number) => {
    const card = flashcards?.find((f) => f.id === flashcardId)
    if (!card) return

    const update = calculateNextReview(card, quality)
    
    setFlashcards((current) =>
      (current || []).map((f) =>
        f.id === flashcardId
          ? {
              ...f,
              ...update,
              lastReviewed: new Date().toISOString(),
            }
          : f
      )
    )
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
          // @ts-ignore - spark.llmPrompt template literal typing
          const visionPrompt = spark.llmPrompt`Du bist ein Experte für das Lesen von Handschrift und mathematischen Notationen. 
        
Analysiere das folgende Bild einer handschriftlichen Lösung und transkribiere GENAU was du siehst.

Fragestellung war: ${task.question}

Extrahiere den gesamten Text, mathematische Formeln, Gleichungen und Schritte. Bewahre die mathematische Notation und Struktur.

WICHTIG: Gib nur die reine Transkription zurück, keine Bewertung oder zusätzliche Kommentare.

Falls du mathematische Formeln siehst, nutze LaTeX-ähnliche Notation (z.B. a^2 + b^2 = c^2).`

          const visionResponse = await llmWithRetry(visionPrompt, 'gpt-4o', false)
          transcription = visionResponse.trim()
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
        // @ts-ignore - spark.llmPrompt template literal typing
        const evaluationPrompt = spark.llmPrompt`Du bist ein Dozent, der die Antwort eines Studenten bewertet.

Fragestellung: ${task.question}
Musterlösung: ${task.solution}
Antwort des Studenten: ${userAnswer}

Bewerte, ob die Antwort des Studenten korrekt ist. Sie müssen nicht wortwörtlich übereinstimmen, aber die Schlüsselkonzepte und die Endergebnisse sollten korrekt sein.

Gib deine Antwort als JSON zurück:
{
  "isCorrect": true/false,
  "hints": ["hinweis1", "hinweis2"] (nur falls inkorrekt, gib 2-3 hilfreiche Hinweise AUF DEUTSCH ohne die Lösung preiszugeben)
}`

        const response = await llmWithRetry(evaluationPrompt, 'gpt-4o', true)
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
      </>
    )
  }

  if (activeTask) {
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
          }}
          onSubmit={handleSubmitTaskAnswer}
          feedback={taskFeedback || undefined}
          onNextTask={
            moduleTasks.filter((t) => !t.completed && t.id !== activeTask.id).length > 0
              ? handleNextTask
              : undefined
          }
        />
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
          onSolveTask={(task) => {
            setActiveTask(task)
            setTaskFeedback(null)
          }}
          onDeleteTask={handleDeleteTask}
          onDeleteNote={handleDeleteNote}
          onDeleteFlashcard={handleDeleteFlashcard}
          onGenerateAllNotes={handleGenerateAllNotes}
          onGenerateAllTasks={handleGenerateAllTasks}
          onGenerateAllFlashcards={handleGenerateAllFlashcards}
          onStartFlashcardStudy={handleStartFlashcardStudy}
        />
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
      
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">StudyMate</h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                  Dein KI-gestützter Lernbegleiter für die Uni
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center gap-3">
                  <DebugModeToggle />
                  <RateLimitIndicator />
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="sm:hidden h-9 w-9 p-0">
                      <List size={16} />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px]">
                    <SheetHeader>
                      <SheetTitle>Optionen</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Debug-Modus</p>
                        <DebugModeToggle />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">API-Status</p>
                        <RateLimitIndicator />
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
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
                <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="flex-1 sm:flex-none">
                  <Plus size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">Neues Modul</span>
                  <span className="sm:hidden">Modul</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <RateLimitBanner />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
          {!modules || modules.length === 0 ? (
            <EmptyState
              title="Noch keine Module"
              description="Erstelle dein erstes Modul, um deine Kursmaterialien, Notizen und Übungsaufgaben zu organisieren."
              actionLabel="Erstes Modul erstellen"
              onAction={() => setCreateDialogOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {modules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  onClick={() => setSelectedModuleId(module.id)}
                  scriptCount={scripts?.filter((s) => s.moduleId === module.id).length || 0}
                  taskCount={tasks?.filter((t) => t.moduleId === module.id).length || 0}
                />
              ))}
            </div>
          )}
        </div>

        <CreateModuleDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreateModule={handleCreateModule}
        />
      </div>
    </>
  )
}

export default App