import { useState } from 'react'
import { Module, Script, StudyNote, Task, Flashcard } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ArrowLeft, List } from '@phosphor-icons/react'
import { ScriptsTab } from './ScriptsTab'
import { NotesTab } from './NotesTab'
import { TasksTab } from './TasksTab'
import { FlashcardsTab } from './FlashcardsTab'
import { RateLimitIndicator } from './RateLimitIndicator'
import { RateLimitBanner } from './RateLimitBanner'
import { DebugModeToggle } from './DebugModeToggle'
import { LocalStorageIndicator } from './LocalStorageIndicator'

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
  onBulkDeleteScripts: (ids: string[]) => void
  onBulkDeleteNotes: (ids: string[]) => void
  onBulkDeleteTasks: (ids: string[]) => void
  onBulkDeleteFlashcards: (ids: string[]) => void
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
  onBulkDeleteScripts,
  onBulkDeleteNotes,
  onBulkDeleteTasks,
  onBulkDeleteFlashcards,
  onGenerateAllNotes,
  onGenerateAllTasks,
  onGenerateAllFlashcards,
  onStartFlashcardStudy,
}: ModuleViewProps) {
  const [activeTab, setActiveTab] = useState('scripts')

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
              </Button>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: module.color }}
              >
                <span className="font-semibold text-base sm:text-lg">
                  {module.code.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight truncate">{module.name}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{module.code}</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <DebugModeToggle />
              <RateLimitIndicator />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden absolute top-4 right-3">
                  <List size={18} />
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
          </div>
        </div>
      </div>

      <RateLimitBanner />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 sm:mb-6 w-full grid grid-cols-4 sm:w-auto sm:inline-flex h-auto">
            <TabsTrigger value="scripts" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <span className="hidden sm:inline">Skripte ({scripts.length})</span>
              <span className="sm:hidden">Skr. {scripts.length}</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <span className="hidden sm:inline">Notizen ({notes.length})</span>
              <span className="sm:hidden">Not. {notes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <span className="hidden sm:inline">Karteikarten ({flashcards.length})</span>
              <span className="sm:hidden">Kart. {flashcards.length}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <span className="hidden sm:inline">Aufgaben ({tasks.length})</span>
              <span className="sm:hidden">Aufg. {tasks.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scripts">
            <ScriptsTab
              scripts={scripts}
              onUploadScript={onUploadScript}
              onGenerateNotes={onGenerateNotes}
              onGenerateTasks={onGenerateTasks}
              onDeleteScript={onDeleteScript}
              onBulkDeleteScripts={onBulkDeleteScripts}
              onGenerateAllNotes={onGenerateAllNotes}
              onGenerateAllTasks={onGenerateAllTasks}
            />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTab
              notes={notes}
              scripts={scripts}
              onDeleteNote={onDeleteNote}
              onBulkDeleteNotes={onBulkDeleteNotes}
            />
          </TabsContent>

          <TabsContent value="flashcards">
            <FlashcardsTab
              flashcards={flashcards}
              notes={notes}
              onGenerateFlashcards={onGenerateFlashcards}
              onDeleteFlashcard={onDeleteFlashcard}
              onBulkDeleteFlashcards={onBulkDeleteFlashcards}
              onStartStudy={onStartFlashcardStudy}
              onGenerateAllFlashcards={onGenerateAllFlashcards}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksTab 
              tasks={tasks} 
              onSolveTask={onSolveTask}
              onDeleteTask={onDeleteTask}
              onBulkDeleteTasks={onBulkDeleteTasks}
            />
          </TabsContent>
        </Tabs>
      </div>

      <footer className="border-t bg-card/50 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <LocalStorageIndicator />
            <p className="text-xs text-muted-foreground">
              StudyMate © {new Date().getFullYear()} · Deine Daten bleiben privat
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
