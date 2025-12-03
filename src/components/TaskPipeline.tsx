import { X } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

export interface PipelineTask {
  id: string
  type: 'upload' | 'generate-notes' | 'generate-tasks'
  name: string
  progress: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
}

interface TaskPipelineProps {
  tasks: PipelineTask[]
  onDismiss: (taskId: string) => void
}

export function TaskPipeline({ tasks, onDismiss }: TaskPipelineProps) {
  const activeTasks = tasks.filter(t => t.status === 'processing' || t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const errorTasks = tasks.filter(t => t.status === 'error')

  const groupedTasks: { [key: string]: PipelineTask[] } = {}
  activeTasks.forEach(task => {
    if (!groupedTasks[task.type]) {
      groupedTasks[task.type] = []
    }
    groupedTasks[task.type].push(task)
  })

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'upload': return 'Uploading'
      case 'generate-notes': return 'Generating Notes'
      case 'generate-tasks': return 'Generating Tasks'
      default: return 'Processing'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'upload': return 'bg-primary'
      case 'generate-notes': return 'bg-accent'
      case 'generate-tasks': return 'bg-secondary'
      default: return 'bg-muted'
    }
  }

  if (tasks.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 w-80 space-y-2">
      <AnimatePresence mode="popLayout">
        {Object.entries(groupedTasks).map(([type, typeTasks]) => {
          const count = typeTasks.length
          const avgProgress = typeTasks.reduce((sum, t) => sum + t.progress, 0) / count
          
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-4 shadow-lg border-2">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getTypeColor(type)} animate-pulse`} />
                      <span className="font-medium text-sm">{getTypeLabel(type)}</span>
                      {count > 1 && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
                          {count}
                        </span>
                      )}
                    </div>
                    {count === 1 ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {typeTasks[0].name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {count} items in progress
                      </p>
                    )}
                  </div>
                  {count === 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 -mt-1"
                      onClick={() => onDismiss(typeTasks[0].id)}
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <Progress value={avgProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {Math.round(avgProgress)}%
                  </p>
                </div>
              </Card>
            </motion.div>
          )
        })}

        {completedTasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4 shadow-lg border-2 border-accent bg-accent/5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="font-medium text-sm">Completed</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{task.name}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 -mt-1"
                  onClick={() => onDismiss(task.id)}
                >
                  <X size={14} />
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}

        {errorTasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4 shadow-lg border-2 border-destructive bg-destructive/5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="font-medium text-sm">Error</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{task.name}</p>
                  {task.error && (
                    <p className="text-xs text-destructive mt-1">{task.error}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 -mt-1"
                  onClick={() => onDismiss(task.id)}
                >
                  <X size={14} />
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
