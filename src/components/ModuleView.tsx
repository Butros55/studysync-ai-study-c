import { useState } from 'react'
import { Module, Script, StudyNote, Task, Flashcard, FileCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ArrowLeft, PencilSimple, Calendar, House, FolderOpen, Note, Cards, ClipboardText, Exam } from '@phosphor-icons/react'
import { ModuleDashboard } from './ModuleDashboard'
import { FilesTab } from './FilesTab'
import { NotesTab } from './NotesTab'
import { TasksTab } from './TasksTab'
import { FlashcardsTab } from './FlashcardsTab'
import { DebugModeToggle } from './DebugModeToggle'
import { LocalStorageIndicator } from './LocalStorageIndicator'
import { formatExamDate } from '@/lib/recommendations'

interface ModuleViewProps {
  module: Module
  scripts: Script[]
  notes: StudyNote[]
  tasks: Task[]
  flashcards: Flashcard[]
  onBack: () => void
  onUploadScript: (content: string, name: string, fileType?: string, fileData?: string, category?: FileCategory) => Promise<void>
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onGenerateFlashcards: (noteId: string) => void
  onDeleteScript: (scriptId: string) => void
  onSolveTask: (task: Task) => void
  onStartTaskSequence?: (tasks: Task[], startTaskId?: string) => void
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
  onEditModule?: (module: Module) => void
  onStartExamMode?: () => void
  onAnalyzeScript?: (scriptId: string) => void
  // Neue Props für Bulk-Aktionen
  onReanalyzeAllScripts?: () => void
  onReanalyzeSelectedScripts?: (scriptIds: string[]) => void
  onGenerateNotesForSelected?: (scriptIds: string[]) => void
  onGenerateTasksForSelected?: (scriptIds: string[]) => void
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
  onStartTaskSequence,
  onEditModule,
  onStartExamMode,
  onAnalyzeScript,
  onReanalyzeAllScripts,
  onReanalyzeSelectedScripts,
  onGenerateNotesForSelected,
  onGenerateTasksForSelected,
}: ModuleViewProps) {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-semibold tracking-tight truncate">{module.name}</h1>
                  {onEditModule && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => onEditModule(module)}
                    >
                      <PencilSimple size={14} />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="truncate">{module.code}</span>
                  {module.examDate && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatExamDate(module.examDate)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {onStartExamMode && (
                <Button variant="outline" size="sm" onClick={onStartExamMode}>
                  <Exam size={16} className="mr-2" weight="duotone" />
                  Prüfungsmodus
                </Button>
              )}
              <DebugModeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Hauptinhalt mit flex-1 für Sticky Footer */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 sm:mb-6 w-full grid grid-cols-5 sm:w-auto sm:inline-flex h-auto">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <House className="w-4 h-4 sm:mr-1.5" weight="duotone" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <FolderOpen className="w-4 h-4 sm:mr-1.5" weight="duotone" />
              <span className="hidden sm:inline">Dateien ({scripts.length})</span>
              <span className="sm:hidden">{scripts.length}</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Note className="w-4 h-4 sm:mr-1.5" weight="duotone" />
              <span className="hidden sm:inline">Notizen ({notes.length})</span>
              <span className="sm:hidden">{notes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Cards className="w-4 h-4 sm:mr-1.5" weight="duotone" />
              <span className="hidden sm:inline">Karteikarten ({flashcards.length})</span>
              <span className="sm:hidden">{flashcards.length}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
              <ClipboardText className="w-4 h-4 sm:mr-1.5" weight="duotone" />
              <span className="hidden sm:inline">Aufgaben ({tasks.length})</span>
              <span className="sm:hidden">{tasks.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ModuleDashboard
              module={module}
              tasks={tasks}
              notes={notes}
              scripts={scripts}
              flashcards={flashcards}
              onSolveTask={onSolveTask}
              onStartTaskSequence={onStartTaskSequence}
              onStartFlashcardStudy={onStartFlashcardStudy}
              onGenerateAllTasks={onGenerateAllTasks}
            />
          </TabsContent>

          <TabsContent value="files">
            <FilesTab
              scripts={scripts}
              onUploadScript={onUploadScript}
              onGenerateNotes={onGenerateNotes}
              onGenerateTasks={onGenerateTasks}
              onDeleteScript={onDeleteScript}
              onBulkDeleteScripts={onBulkDeleteScripts}
              onGenerateAllNotes={onGenerateAllNotes}
              onGenerateAllTasks={onGenerateAllTasks}
              onAnalyzeScript={onAnalyzeScript}
              onReanalyzeAll={onReanalyzeAllScripts}
              onReanalyzeSelected={onReanalyzeSelectedScripts}
              onGenerateNotesForSelected={onGenerateNotesForSelected}
              onGenerateTasksForSelected={onGenerateTasksForSelected}
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
      </main>

      {/* Sticky Footer */}
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
    </div>
  )
}
