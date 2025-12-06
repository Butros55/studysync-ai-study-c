import { useState } from 'react'
import { Task } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, CheckCircle, Pencil, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { useBulkSelection } from '@/hooks/use-bulk-selection'

interface TasksTabProps {
  tasks: Task[]
  onSolveTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onBulkDeleteTasks: (taskIds: string[]) => void
}

export function TasksTab({ tasks, onSolveTask, onDeleteTask, onBulkDeleteTasks }: TasksTabProps) {
  const {
    selectedIds: selectedTasks,
    hasSelection,
    allSelected,
    toggleSelection: toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection({
    items: tasks,
    getId: (task) => task.id,
  })

  const getDifficultyColor = (difficulty: Task['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-accent/10 text-accent border-accent/20'
      case 'medium':
        return 'bg-warning/10 text-warning-foreground border-warning/20'
      case 'hard':
        return 'bg-destructive/10 text-destructive border-destructive/20'
    }
  }

  const getDifficultyLabel = (difficulty: Task['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return 'Einfach'
      case 'medium':
        return 'Mittel'
      case 'hard':
        return 'Schwer'
    }
  }

  const incompleteTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedTasks)
    if (ids.length === 0) return
    if (!confirm(`Sollen ${ids.length} Aufgaben geloescht werden?`)) return
    await onBulkDeleteTasks(ids)
    clearSelection()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Uebungsaufgaben</h2>
          <p className="text-sm text-muted-foreground mt-1">
            KI-generierte Aufgaben zum Testen deines Verstaendnisses
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={tasks.length === 0}>
              {allSelected ? 'Auswahl aufheben' : 'Alle auswaehlen'}
            </Button>
            {hasSelection && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash size={14} className="mr-2" />
                {selectedTasks.size} loeschen
              </Button>
            )}
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Brain size={32} className="text-muted-foreground" weight="duotone" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Noch keine Aufgaben</h3>
          <p className="text-muted-foreground text-sm">
            Erstelle Uebungsaufgaben aus deinen hochgeladenen Skripten mit KI
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {incompleteTasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Pencil size={18} />
                Zu loesen ({incompleteTasks.length})
              </h3>
              <div className="grid gap-4">
                {incompleteTasks.map((task) => (
                  <Card key={task.id} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleSelect(task.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className={getDifficultyColor(task.difficulty)}>
                            {getDifficultyLabel(task.difficulty)}
                          </Badge>
                        </div>
                        <MarkdownRenderer content={task.question} compact className="mb-4" />
                        <Button onClick={() => onSolveTask(task)}>
                          <Pencil size={16} className="mr-2" />
                          Aufgabe loesen
                        </Button>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Diese Aufgabe geloescht werden?')) {
                            onDeleteTask(task.id)
                            toast.success('Aufgabe geloescht')
                          }
                        }}
                      >
                        <Trash size={18} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2 text-accent">
                <CheckCircle size={18} weight="fill" />
                Abgeschlossen ({completedTasks.length})
              </h3>
              <div className="grid gap-4">
                {completedTasks.map((task) => (
                  <Card key={task.id} className="p-6 bg-accent/5 border-accent/20">
                    <div className="flex items-start justify-between gap-4">
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleSelect(task.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className={getDifficultyColor(task.difficulty)}>
                            {getDifficultyLabel(task.difficulty)}
                          </Badge>
                          <CheckCircle size={18} className="text-accent" weight="fill" />
                        </div>
                        <MarkdownRenderer content={task.question} compact className="opacity-75" />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Diese Aufgabe geloescht werden?')) {
                            onDeleteTask(task.id)
                            toast.success('Aufgabe geloescht')
                          }
                        }}
                      >
                        <Trash size={18} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
