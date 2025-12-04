import { useState, useEffect } from 'react'
import { Bell, X, Check, Warning, Upload, FileText, ListChecks, Cards } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface PipelineTask {
  id: string
  type: 'upload' | 'generate-notes' | 'generate-tasks' | 'generate-flashcards' | 'task-submit'
  name: string
  progress: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  errorDetails?: string
  timestamp: number
}

interface NotificationCenterProps {
  tasks: PipelineTask[]
  onDismiss: (taskId: string) => void
  onClearAll: () => void
}

export function NotificationCenter({ tasks, onDismiss, onClearAll }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasNewNotifications, setHasNewNotifications] = useState(false)
  const [autoDismissedIds, setAutoDismissedIds] = useState<Set<string>>(new Set())
  const [expandedErrorIds, setExpandedErrorIds] = useState<Set<string>>(new Set())

  const activeTasks = tasks.filter(t => t.status === 'processing' || t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const errorTasks = tasks.filter(t => t.status === 'error')
  const recentTasks = [...completedTasks, ...errorTasks].sort((a, b) => b.timestamp - a.timestamp)

  useEffect(() => {
    if (completedTasks.length > 0 || errorTasks.length > 0) {
      setHasNewNotifications(true)
    }
  }, [completedTasks.length, errorTasks.length])

  useEffect(() => {
    const completedOrErrorTasks = [...completedTasks, ...errorTasks]
    completedOrErrorTasks.forEach((task) => {
      if (!autoDismissedIds.has(task.id)) {
        const timer = setTimeout(() => {
          setAutoDismissedIds((prev) => new Set(prev).add(task.id))
        }, 5000)
        return () => clearTimeout(timer)
      }
    })
  }, [completedTasks, errorTasks, autoDismissedIds])

  const handleOpen = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setHasNewNotifications(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'upload': return Upload
      case 'generate-notes': return FileText
      case 'generate-tasks': return ListChecks
      case 'generate-flashcards': return Cards
      case 'task-submit': return Check
      default: return FileText
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'upload': return 'Upload'
      case 'generate-notes': return 'Notizen generieren'
      case 'generate-tasks': return 'Aufgaben generieren'
      case 'generate-flashcards': return 'Karteikarten generieren'
      case 'task-submit': return 'Aufgabe einreichen'
      default: return 'Verarbeitung'
    }
  }

  const toggleErrorDetails = (taskId: string) => {
    setExpandedErrorIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const totalNotifications = activeTasks.length + recentTasks.length
  const visiblePopupTasks = activeTasks.concat(
    [...completedTasks, ...errorTasks].filter(t => !autoDismissedIds.has(t.id))
  )

  const getCategoryInfo = (task: PipelineTask) => {
    const statusLabel = task.status === 'completed'
      ? 'Erfolg'
      : task.status === 'error'
      ? 'Fehler'
      : 'Laufend'

    return {
      id: `${task.status}-${task.type}`,
      label: `${statusLabel}: ${getTypeLabel(task.type)}`,
    }
  }

  const groupedPopupTasks = (() => {
    const groups: { categoryId: string; label: string; tasks: PipelineTask[] }[] = []
    visiblePopupTasks.forEach((task) => {
      const { id, label } = getCategoryInfo(task)
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.categoryId === id) {
        lastGroup.tasks.push(task)
      } else {
        groups.push({ categoryId: id, label, tasks: [task] })
      }
    })
    return groups
  })()

  return (
    <div className="fixed top-4 right-4 z-[100]">
      <div className="flex flex-col items-end gap-3">
        <motion.div
          initial={false}
          animate={{ scale: hasNewNotifications ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            size="icon"
            variant={isOpen ? "default" : "outline"}
            className={cn(
              "relative h-11 w-11 rounded-full shadow-lg transition-all",
              isOpen && "shadow-xl"
            )}
            onClick={handleOpen}
          >
            <Bell size={20} weight={isOpen ? "fill" : "regular"} />
            {totalNotifications > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full min-w-[20px] h-5 flex items-center justify-center text-xs font-semibold px-1"
              >
                {totalNotifications > 9 ? '9+' : totalNotifications}
              </motion.div>
            )}
          </Button>
        </motion.div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.3 }}
            >
              <Card className="w-96 shadow-2xl border-2 overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Benachrichtigungen</h3>
                    {recentTasks.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onClearAll}
                        className="text-xs h-7"
                      >
                        Alle löschen
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="p-2">
                    {activeTasks.length === 0 && recentTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Bell size={48} className="text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                          >
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                  {(() => {
                                    const Icon = getTypeIcon(task.type)
                                    return <Icon size={16} className="text-primary" />
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium mb-1">
                                    {getTypeLabel(task.type)}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate mb-2">
                                    {task.name}
                                  </p>
                                  <Progress value={task.progress} className="h-1.5" />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {Math.round(task.progress)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}

                        {recentTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                          >
                            <div
                              className={cn(
                                "p-3 rounded-lg border relative group",
                                task.status === 'completed'
                                  ? "bg-accent/5 border-accent/20"
                                  : "bg-destructive/5 border-destructive/20"
                              )}
                            >
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-2 right-2 h-6 w-6"
                                onClick={() => onDismiss(task.id)}
                              >
                                <X size={14} />
                              </Button>
                              <div className="flex items-start gap-3 pr-8">
                                <div className="mt-0.5">
                                  {task.status === 'completed' ? (
                                    <Check size={16} className="text-accent" weight="bold" />
                                  ) : (
                                    <Warning size={16} className="text-destructive" weight="bold" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium mb-1">
                                    {task.status === 'completed' ? 'Abgeschlossen' : 'Fehlgeschlagen'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {task.name}
                                  </p>
                                  {task.error && (
                                    <p className="text-xs text-destructive mt-1">
                                      {task.error}
                                    </p>
                                  )}
                                  {task.errorDetails && (
                                    <div className="mt-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => toggleErrorDetails(task.id)}
                                      >
                                        {expandedErrorIds.has(task.id) ? 'Details verbergen' : 'Details anzeigen'}
                                      </Button>
                                      <AnimatePresence>
                                        {expandedErrorIds.has(task.id) && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                              {task.errorDetails}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground/60 mt-2">
                                    {new Date(task.timestamp).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {groupedPopupTasks.map((group, index) => {
            const latest = group.tasks[group.tasks.length - 1]
            const count = group.tasks.length
            return (
              <motion.div
                key={`${group.categoryId}-${group.tasks[0].id}`}
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  x: 0, 
                  scale: 1,
                  y: isOpen ? index * 10 : 0
                }}
                exit={{ opacity: 0, x: 100, scale: 0.8 }}
                transition={{ type: "spring", duration: 0.4 }}
                style={{ zIndex: 50 - index }}
              >
                <Card className="w-80 p-4 shadow-lg border-2 bg-card relative">
                  {count > 1 && (
                    <div className="absolute -top-2 -right-2 rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-1 shadow-md">
                      {count}x
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {latest.status === 'processing' || latest.status === 'pending' ? (
                          (() => {
                            const Icon = getTypeIcon(latest.type)
                            return <Icon size={18} className="text-primary" />
                          })()
                        ) : latest.status === 'completed' ? (
                          <Check size={18} className="text-accent" weight="bold" />
                        ) : (
                          <Warning size={18} className="text-destructive" weight="bold" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm mb-0.5">
                          {group.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {latest.name}
                        </p>
                        {latest.error && (
                          <p className="text-xs text-destructive mt-1">{latest.error}</p>
                        )}
                        {count > 1 && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            + {count - 1} weitere in diesem Stapel
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {(latest.status === 'processing' || latest.status === 'pending') && (
                    <div className="space-y-2">
                      <Progress value={latest.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round(latest.progress)}%
                      </p>
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
