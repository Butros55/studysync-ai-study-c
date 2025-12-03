import { useState } from 'react'
import { Module, Script, StudyNote, Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft } from '@phosphor-icons/react'
import { ScriptsTab } from './ScriptsTab'
import { NotesTab } from './NotesTab'
import { TasksTab } from './TasksTab'

interface ModuleViewProps {
  module: Module
  scripts: Script[]
  notes: StudyNote[]
  tasks: Task[]
  onBack: () => void
  onUploadScript: (content: string, name: string, fileType?: string, fileData?: string) => Promise<void>
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onDeleteScript: (scriptId: string) => void
  onSolveTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

export function ModuleView({
  module,
  scripts,
  notes,
  tasks,
  onBack,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onDeleteScript,
  onSolveTask,
  onDeleteTask,
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
            <TabsTrigger value="scripts">Scripts ({scripts.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scripts">
            <ScriptsTab
              scripts={scripts}
              onUploadScript={onUploadScript}
              onGenerateNotes={onGenerateNotes}
              onGenerateTasks={onGenerateTasks}
              onDeleteScript={onDeleteScript}
            />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTab notes={notes} scripts={scripts} />
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
