import { useState } from 'react'
import { Module, Script, StudyNote, Task, Flashcard } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft } from '@phosphor-icons/react'
import { ScriptsTab } from './ScriptsTab'
import { NotesTab } from './NotesTab'
import { TasksTab } from './TasksTab'
import { FlashcardsTab } from './FlashcardsTab'

interface ModuleViewProps {
  module: Module
  scripts: Script[]
  notes: StudyNote[]
  tasks: Task[]
  flashcards: Flashcard[]
  onBack: () => void
  onUploadScript: (content: string, name: string, fileType?: string, fileData?: string) => Promise<void>
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onGenerateFlashcards: (noteId: string) => void
  onDeleteScript: (scriptId: string) => void
  onSolveTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onDeleteNote: (noteId: string) => void
  onDeleteFlashcard: (flashcardId: string) => void
  onGenerateAllNotes: () => void
  onGenerateAllTasks: () => void
  onGenerateAllFlashcards: () => void
  onStartFlashcardStudy: () => void
}

export function ModuleView({
  module,
  scripts,
  notes,
  tasks,
  flashcards,
  onBack,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onGenerateFlashcards,
  onDeleteScript,
  onSolveTask,
  onDeleteTask,
  onDeleteNote,
  onDeleteFlashcard,
  onGenerateAllNotes,
  onGenerateAllTasks,
  onGenerateAllFlashcards,
  onStartFlashcardStudy,
}: ModuleViewProps) {
  const [activeTab, setActiveTab] = useState('scripts')

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft size={20} />
            </Button>
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: module.color }}
            >
              <span className="font-semibold text-lg">
                {module.code.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{module.name}</h1>
              <p className="text-sm text-muted-foreground">{module.code}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="scripts">Skripte ({scripts.length})</TabsTrigger>
            <TabsTrigger value="notes">Notizen ({notes.length})</TabsTrigger>
            <TabsTrigger value="flashcards">Karteikarten ({flashcards.length})</TabsTrigger>
            <TabsTrigger value="tasks">Aufgaben ({tasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scripts">
            <ScriptsTab
              scripts={scripts}
              onUploadScript={onUploadScript}
              onGenerateNotes={onGenerateNotes}
              onGenerateTasks={onGenerateTasks}
              onDeleteScript={onDeleteScript}
              onGenerateAllNotes={onGenerateAllNotes}
              onGenerateAllTasks={onGenerateAllTasks}
            />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTab notes={notes} scripts={scripts} onDeleteNote={onDeleteNote} />
          </TabsContent>

          <TabsContent value="flashcards">
            <FlashcardsTab
              flashcards={flashcards}
              notes={notes}
              onGenerateFlashcards={onGenerateFlashcards}
              onDeleteFlashcard={onDeleteFlashcard}
              onStartStudy={onStartFlashcardStudy}
              onGenerateAllFlashcards={onGenerateAllFlashcards}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksTab 
              tasks={tasks} 
              onSolveTask={onSolveTask}
              onDeleteTask={onDeleteTask}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
