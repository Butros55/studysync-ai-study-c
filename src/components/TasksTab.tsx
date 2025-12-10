import { useMemo } from 'react'
import { Task } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Brain, CheckCircle, Pencil, Trash, Play, Fire, Target, Trophy, CaretRight, Sparkle, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface TasksTabProps {
  tasks: Task[]
  onSolveTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onBulkDeleteTasks: (taskIds: string[]) => void
  onGenerateAllTasks?: () => void
  isGenerating?: boolean
}

// Kompakte Aufgaben-Karte
function TaskCard({ 
  task, 
  isSelected, 
  onToggleSelect, 
  onSolve, 
  onDelete 
}: { 
  task: Task
  isSelected: boolean
  onToggleSelect: () => void
  onSolve: () => void
  onDelete: () => void
}) {
  const getDifficultyConfig = (difficulty: Task['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return { color: 'bg-green-500', textColor: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Einfach' }
      case 'medium':
        return { color: 'bg-yellow-500', textColor: 'text-yellow-600', bgColor: 'bg-yellow-500/10', label: 'Mittel' }
      case 'hard':
        return { color: 'bg-red-500', textColor: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Schwer' }
    }
  }

  const config = getDifficultyConfig(task.difficulty)
  
  // Extrahiere sauberen Titel - entferne Markdown-Formatierung
  const extractTitle = () => {
    if (task.title && task.title.trim().length > 3 && !/^\d+$/.test(task.title.trim())) {
      return task.title.replace(/^#+\s*/, '').trim()
    }
    // Fallback: Erste sinnvolle Zeile aus der Frage
    const lines = task.question.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    for (const line of lines) {
      // Bereinige Markdown-Formatierung
      const cleaned = line
        .replace(/^#+\s*/, '')  // Entferne Markdown-Überschriften
        .replace(/^\*+\s*/, '') // Entferne Markdown-Listen
        .replace(/^\d+[\.\)]\s*/, '') // Entferne Nummerierungen
        .replace(/^[a-z][\.\)]\s*/i, '') // Entferne a), b) etc.
        .replace(/^\*\*(.*)\*\*$/, '$1') // Entferne **fett**
        .trim()
      if (cleaned.length >= 10) {
        return cleaned.length > 80 ? cleaned.substring(0, 77) + '...' : cleaned
      }
    }
    return task.question.substring(0, 60).replace(/^#+\s*/, '') + '...'
  }
  
  const title = extractTitle()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card 
        className={cn(
          'p-4 border transition-all hover:shadow-md cursor-pointer group',
          task.completed 
            ? 'bg-gradient-to-r from-green-500/5 to-transparent border-green-500/20' 
            : 'bg-gradient-to-r from-card to-muted/20 hover:border-primary/30',
          `border-l-4 border-l-${config.color.replace('bg-', '')}`
        )}
        onClick={onSolve}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
          />
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={cn('text-[10px]', config.bgColor, config.textColor, 'border-0')}>
                {config.label}
              </Badge>
              {task.completed && (
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 gap-1">
                  <CheckCircle size={10} weight="fill" />
                  Gelöst
                </Badge>
              )}
              {task.tags?.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[9px]">
                  {tag}
                </Badge>
              ))}
              {task.tags && task.tags.length > 2 && (
                <span className="text-[9px] text-muted-foreground">+{task.tags.length - 2}</span>
              )}
            </div>
            
            {/* Titel/Frage */}
            <div className={cn('text-sm font-medium line-clamp-2', task.completed && 'opacity-70')}>
              {title}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Diese Aufgabe löschen?')) {
                  onDelete()
                  toast.success('Aufgabe gelöscht')
                }
              }}
            >
              <Trash size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={(e) => {
                e.stopPropagation()
                onSolve()
              }}
            >
              <CaretRight size={16} weight="bold" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export function TasksTab({ tasks, onSolveTask, onDeleteTask, onBulkDeleteTasks, onGenerateAllTasks, isGenerating }: TasksTabProps) {
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

  // Statistiken berechnen
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter(t => t.completed).length
    const incomplete = total - completed
    const easy = tasks.filter(t => t.difficulty === 'easy').length
    const medium = tasks.filter(t => t.difficulty === 'medium').length
    const hard = tasks.filter(t => t.difficulty === 'hard').length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return { total, completed, incomplete, easy, medium, hard, progress }
  }, [tasks])

  const incompleteTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedTasks)
    if (ids.length === 0) return
    if (!confirm(`Sollen ${ids.length} Aufgaben gelöscht werden?`)) return
    await onBulkDeleteTasks(ids)
    clearSelection()
  }

  // Nächste empfohlene Aufgabe (erste ungelöste, nach Schwierigkeit sortiert)
  const nextRecommended = incompleteTasks.sort((a, b) => {
    const order = { easy: 0, medium: 1, hard: 2 }
    return order[a.difficulty] - order[b.difficulty]
  })[0]

  return (
    <div className="space-y-6">
      {/* Header mit Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Übungsaufgaben</h2>
          <p className="text-sm text-muted-foreground">
            {stats.incomplete > 0 
              ? `${stats.incomplete} von ${stats.total} Aufgaben offen` 
              : 'Alle Aufgaben gelöst!'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={tasks.length === 0}>
            {allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
          </Button>
          {hasSelection && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash size={14} className="mr-2" />
              {selectedTasks.size} löschen
            </Button>
          )}
          {nextRecommended && (
            <Button onClick={() => onSolveTask(nextRecommended)}>
              <Play size={16} className="mr-2" weight="fill" />
              Jetzt üben
            </Button>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Brain size={32} className="text-primary" weight="duotone" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Noch keine Aufgaben</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            Erstelle Übungsaufgaben aus deinen hochgeladenen Skripten mit KI
          </p>
          {onGenerateAllTasks && (
            <Button 
              onClick={onGenerateAllTasks} 
              disabled={isGenerating}
              size="lg"
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <ArrowsClockwise size={18} className="animate-spin" />
                  Generiere Aufgaben...
                </>
              ) : (
                <>
                  <Sparkle size={18} weight="fill" />
                  Aufgaben generieren
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Statistik-Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 border bg-gradient-to-br from-card to-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Target size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Gesamt</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border bg-gradient-to-br from-green-500/5 to-green-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Trophy size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Gelöst</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border bg-gradient-to-br from-orange-500/5 to-orange-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <Fire size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.incomplete}</p>
                  <p className="text-xs text-muted-foreground">Offen</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fortschritt</span>
                  <span className="font-medium">{stats.progress}%</span>
                </div>
                <Progress value={stats.progress} className="h-2" />
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {stats.easy}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    {stats.medium}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {stats.hard}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Aufgaben Liste */}
          <div className="space-y-6">
            {incompleteTasks.length > 0 && (
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
                  <Pencil size={16} />
                  Zu lösen ({incompleteTasks.length})
                </h3>
                <div className="grid gap-2">
                  {incompleteTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTasks.has(task.id)}
                      onToggleSelect={() => toggleSelect(task.id)}
                      onSolve={() => onSolveTask(task)}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle size={16} weight="fill" />
                  Abgeschlossen ({completedTasks.length})
                </h3>
                <div className="grid gap-2">
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTasks.has(task.id)}
                      onToggleSelect={() => toggleSelect(task.id)}
                      onSolve={() => onSolveTask(task)}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
