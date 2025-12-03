import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Module, Script, StudyNote, Task } from './lib/types'
import { ModuleCard } from './components/ModuleCard'
import { CreateModuleDialog } from './components/CreateModuleDialog'
import { ModuleView } from './components/ModuleView'
import { TaskSolver } from './components/TaskSolver'
import { EmptyState } from './components/EmptyState'
import { Button } from './components/ui/button'
import { Plus } from '@phosphor-icons/react'
import { generateId, getRandomColor } from './lib/utils-app'
import { toast } from 'sonner'

function App() {
  const [modules, setModules] = useKV<Module[]>('modules', [])
  const [scripts, setScripts] = useKV<Script[]>('scripts', [])
  const [notes, setNotes] = useKV<StudyNote[]>('notes', [])
  const [tasks, setTasks] = useKV<Task[]>('tasks', [])

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [taskFeedback, setTaskFeedback] = useState<{
    isCorrect: boolean
    hints?: string[]
  } | null>(null)
  const [generatingNotes, setGeneratingNotes] = useState(false)
  const [generatingTasks, setGeneratingTasks] = useState(false)

  const selectedModule = modules?.find((m) => m.id === selectedModuleId)
  const moduleScripts = scripts?.filter((s) => s.moduleId === selectedModuleId) || []
  const moduleNotes = notes?.filter((n) => n.moduleId === selectedModuleId) || []
  const moduleTasks = tasks?.filter((t) => t.moduleId === selectedModuleId) || []

  const handleCreateModule = (name: string, code: string) => {
    const newModule: Module = {
      id: generateId(),
      name,
      code,
      createdAt: new Date().toISOString(),
      color: getRandomColor(),
    }
    setModules((current) => [...(current || []), newModule])
    toast.success('Module created successfully')
  }

  const handleUploadScript = (content: string, name: string, fileType?: string) => {
    if (!selectedModuleId) return

    const newScript: Script = {
      id: generateId(),
      moduleId: selectedModuleId,
      name,
      content,
      uploadedAt: new Date().toISOString(),
      fileType: fileType || 'text',
    }
    setScripts((current) => [...(current || []), newScript])
  }

  const handleGenerateNotes = async (scriptId: string) => {
    const script = scripts?.find((s) => s.id === scriptId)
    if (!script || generatingNotes) return

    setGeneratingNotes(true)
    toast.loading('Generating study notes...')

    try {
      // @ts-ignore - spark.llmPrompt template literal typing
      const prompt = spark.llmPrompt`You are an expert study assistant. Analyze the following course material and create comprehensive study notes.

Course Material:
${script.content}

Generate well-structured study notes that include:
1. Key concepts and definitions
2. Important formulas or principles
3. Summary points
4. Things to remember

Format the notes in a clear, readable way suitable for studying.`

      const notesContent = await spark.llm(prompt, 'gpt-4o')

      const newNote: StudyNote = {
        id: generateId(),
        scriptId: script.id,
        moduleId: script.moduleId,
        content: notesContent,
        generatedAt: new Date().toISOString(),
      }

      setNotes((current) => [...(current || []), newNote])
      toast.dismiss()
      toast.success('Study notes generated successfully')
    } catch (error) {
      toast.dismiss()
      toast.error('Failed to generate notes. Please try again.')
    } finally {
      setGeneratingNotes(false)
    }
  }

  const handleGenerateTasks = async (scriptId: string) => {
    const script = scripts?.find((s) => s.id === scriptId)
    if (!script || generatingTasks) return

    setGeneratingTasks(true)
    toast.loading('Generating practice tasks...')

    try {
      // @ts-ignore - spark.llmPrompt template literal typing
      const prompt = spark.llmPrompt`You are an expert educator. Based on the following course material, create 3-5 practice problems of varying difficulty.

Course Material:
${script.content}

Generate problems as a JSON object with a single property "tasks" containing an array of task objects. Each task should have:
- question: A clear problem statement
- solution: The complete solution with explanation
- difficulty: "easy", "medium", or "hard"

Make problems practical and test understanding of key concepts.`

      const response = await spark.llm(prompt, 'gpt-4o', true)
      const parsed = JSON.parse(response)

      const newTasks: Task[] = parsed.tasks.map((t: any) => ({
        id: generateId(),
        moduleId: script.moduleId,
        scriptId: script.id,
        question: t.question,
        solution: t.solution,
        difficulty: t.difficulty,
        createdAt: new Date().toISOString(),
        completed: false,
      }))

      setTasks((current) => [...(current || []), ...newTasks])
      toast.dismiss()
      toast.success(`Generated ${newTasks.length} practice tasks`)
    } catch (error) {
      toast.dismiss()
      toast.error('Failed to generate tasks. Please try again.')
    } finally {
      setGeneratingTasks(false)
    }
  }

  const handleSubmitTaskAnswer = async (answer: string, isHandwritten: boolean) => {
    if (!activeTask) return

    try {
      let userAnswer = answer

      if (isHandwritten) {
        toast.loading('Analyzing your handwriting...')
        // @ts-ignore - spark.llmPrompt template literal typing
        const prompt = spark.llmPrompt`The user has drawn a solution on a canvas for the following question:

Question: ${activeTask.question}

Since this is a handwritten solution that we cannot directly read, please provide helpful feedback assuming the user made a genuine attempt. Give 2-3 helpful hints that would guide them toward the correct solution without giving it away completely.

Return your response as JSON with:
{
  "hints": ["hint1", "hint2", "hint3"]
}`

        const response = await spark.llm(prompt, 'gpt-4o-mini', true)
        const parsed = JSON.parse(response)
        
        toast.dismiss()
        setTaskFeedback({
          isCorrect: false,
          hints: parsed.hints,
        })
        return
      }

      toast.loading('Checking your answer...')
      // @ts-ignore - spark.llmPrompt template literal typing
      const prompt = spark.llmPrompt`You are evaluating a student's answer to a question.

Question: ${activeTask.question}
Correct Solution: ${activeTask.solution}
Student's Answer: ${userAnswer}

Evaluate if the student's answer is correct. They don't need to match word-for-word, but the key concepts and final answer should be correct.

Return JSON:
{
  "isCorrect": true/false,
  "hints": ["hint1", "hint2"] (only if incorrect, provide 2-3 helpful hints without giving away the answer)
}`

      const response = await spark.llm(prompt, 'gpt-4o-mini', true)
      const evaluation = JSON.parse(response)

      toast.dismiss()
      setTaskFeedback(evaluation)

      if (evaluation.isCorrect) {
        setTasks((current) =>
          (current || []).map((t) =>
            t.id === activeTask.id ? { ...t, completed: true } : t
          )
        )
        toast.success('Correct answer!')
      }
    } catch (error) {
      toast.dismiss()
      toast.error('Failed to evaluate answer. Please try again.')
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
      toast.success('All tasks completed! Great work!')
    }
  }

  const handleDeleteScript = (scriptId: string) => {
    setScripts((current) => (current || []).filter((s) => s.id !== scriptId))
    setNotes((current) => (current || []).filter((n) => n.scriptId !== scriptId))
    setTasks((current) => (current || []).filter((t) => t.scriptId === scriptId))
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks((current) => (current || []).filter((t) => t.id !== taskId))
  }

  if (activeTask) {
    return (
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
    )
  }

  if (selectedModule) {
    return (
      <ModuleView
        module={selectedModule}
        scripts={moduleScripts}
        notes={moduleNotes}
        tasks={moduleTasks}
        onBack={() => setSelectedModuleId(null)}
        onUploadScript={handleUploadScript}
        onGenerateNotes={handleGenerateNotes}
        onGenerateTasks={handleGenerateTasks}
        onDeleteScript={handleDeleteScript}
        onSolveTask={(task) => {
          setActiveTask(task)
          setTaskFeedback(null)
        }}
        onDeleteTask={handleDeleteTask}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">StudyMate</h1>
              <p className="text-muted-foreground mt-1">
                Your AI-powered university study companion
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus size={18} className="mr-2" />
              New Module
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!modules || modules.length === 0 ? (
          <EmptyState
            title="No modules yet"
            description="Create your first module to organize your university course materials, notes, and practice tasks."
            actionLabel="Create your first module"
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
  )
}

export default App