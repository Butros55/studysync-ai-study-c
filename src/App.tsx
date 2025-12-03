import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Module, Script, StudyNote, Task, Flashcard } from './lib/types'
import { ModuleCard } from './components/ModuleCard'
import { CreateModuleDialog } from './components/CreateModuleDialog'
import { ModuleView } from './components/ModuleView'
import { TaskSolver } from './components/TaskSolver'
import { FlashcardStudy } from './components/FlashcardStudy'
import { EmptyState } from './components/EmptyState'
import { NotificationCenter, PipelineTask } from './components/NotificationCenter'
import { Button } from './components/ui/button'
import { Plus } from '@phosphor-icons/react'
import { generateId, getRandomColor } from './lib/utils-app'
import { calculateNextReview } from './lib/spaced-repetition'
import { toast } from 'sonner'
import { taskQueue } from './lib/task-queue'

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

        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.success(`"${name}" erfolgreich hochgeladen`)
        }, 3000)
      } catch (error) {
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { ...t, status: 'error', error: 'Upload fehlgeschlagen', timestamp: Date.now() } : t
          )
        )
        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.error(`Fehler beim Hochladen von "${name}"`)
        }, 5000)
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

        const notesContent = await spark.llm(prompt, 'gpt-4o')

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

        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.success(`Notizen für "${script.name}" erfolgreich erstellt`)
        }, 3000)
      } catch (error) {
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { ...t, status: 'error', error: 'Erstellung fehlgeschlagen', timestamp: Date.now() } : t
          )
        )
        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.error(`Fehler beim Erstellen der Notizen für "${script.name}"`)
        }, 5000)
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

        const response = await spark.llm(prompt, 'gpt-4o', true)
        
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

        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.success(`${newTasks.length} Aufgaben für "${script.name}" erstellt`)
        }, 3000)
      } catch (error) {
        console.error('Fehler bei Aufgabenerstellung:', error)
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Erstellung fehlgeschlagen',
              timestamp: Date.now()
            } : t
          )
        )
        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.error(`Fehler beim Erstellen der Aufgaben für "${script.name}"`)
        }, 5000)
      }
    }

    await taskQueue.add({ id: taskId, execute })
  }

  const handleSubmitTaskAnswer = async (answer: string, isHandwritten: boolean, canvasDataUrl?: string) => {
    if (!activeTask) return

    try {
      let userAnswer = answer
      let transcription = ''

      if (isHandwritten && canvasDataUrl) {
        toast.loading('Analysiere deine Handschrift...')
        
        // @ts-ignore - spark.llmPrompt template literal typing
        const visionPrompt = spark.llmPrompt`Du bist ein Experte für das Lesen von Handschrift und mathematischen Notationen. 
        
Analysiere das folgende Bild einer handschriftlichen Lösung und transkribiere GENAU was du siehst.

Fragestellung war: ${activeTask.question}

Extrahiere den gesamten Text, mathematische Formeln, Gleichungen und Schritte. Bewahre die mathematische Notation und Struktur.

WICHTIG: Gib nur die reine Transkription zurück, keine Bewertung oder zusätzliche Kommentare.

Falls du mathematische Formeln siehst, nutze LaTeX-ähnliche Notation (z.B. a^2 + b^2 = c^2).`

        const visionResponse = await spark.llm(visionPrompt, 'gpt-4o', false)
        transcription = visionResponse.trim()
        userAnswer = transcription
        
        console.log('=== HANDSCHRIFT TRANSKRIPTION ===')
        console.log('Frage:', activeTask.question)
        console.log('Transkribiert:', transcription)
        console.log('================================')
      }

      toast.loading('Überprüfe deine Antwort...')
      
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

      const response = await spark.llm(evaluationPrompt, 'gpt-4o', true)
      const evaluation = JSON.parse(response)

      toast.dismiss()
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
    } catch (error) {
      console.error('Fehler bei Antwortüberprüfung:', error)
      toast.dismiss()
      toast.error('Fehler beim Überprüfen der Antwort. Bitte versuche es erneut.')
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

        const response = await spark.llm(prompt, 'gpt-4o', true)
        
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

        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.success(`${newFlashcards.length} Karteikarten erstellt`)
        }, 3000)
      } catch (error) {
        console.error('Fehler bei Karteikarten-Erstellung:', error)
        setPipelineTasks((current) =>
          current.map((t) =>
            t.id === taskId ? { 
              ...t, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Erstellung fehlgeschlagen',
              timestamp: Date.now()
            } : t
          )
        )
        setTimeout(() => {
          setPipelineTasks((current) => current.filter((t) => t.id !== taskId))
          toast.error('Fehler beim Erstellen der Karteikarten')
        }, 5000)
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
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">StudyMate</h1>
                <p className="text-muted-foreground mt-1">
                  Dein KI-gestützter Lernbegleiter für die Uni
                </p>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus size={18} className="mr-2" />
                Neues Modul
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {!modules || modules.length === 0 ? (
            <EmptyState
              title="Noch keine Module"
              description="Erstelle dein erstes Modul, um deine Kursmaterialien, Notizen und Übungsaufgaben zu organisieren."
              actionLabel="Erstes Modul erstellen"
              onAction={() => setCreateDialogOpen(true)}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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