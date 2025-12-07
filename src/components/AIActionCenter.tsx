/**
 * AI Action Center
 * 
 * Schönes, animiertes UI für alle KI-Aktionen mit:
 * - Stack-basierte Anzeige
 * - Animierter Fortschritt
 * - Ergebnis-Zusammenfassungen
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkle, 
  X, 
  CaretDown, 
  CaretUp,
  Check,
  Warning,
  MagnifyingGlass,
  FileText,
  ListChecks,
  Cards,
  Exam,
  CircleNotch,
  Queue,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  type AIActionType,
  type AIAction,
  type AIActionStack,
  subscribeToQueue,
  getActiveStacks,
  clearCompletedActions,
  STACK_CONFIG,
} from '@/lib/ai-action-queue'

// ============================================================================
// Icon Mapping
// ============================================================================

const ICON_MAP: Record<string, React.ElementType> = {
  MagnifyingGlass,
  FileText,
  ListChecks,
  Cards,
  Exam,
}

function getStackIcon(iconName: string) {
  return ICON_MAP[iconName] || Sparkle
}

// ============================================================================
// Stack Result Components
// ============================================================================

interface StackResultsProps {
  stack: AIActionStack
  onDismiss: () => void
}

function AnalysisResults({ stack, onDismiss }: StackResultsProps) {
  const completedActions = stack.actions.filter(a => a.status === 'completed')
  const allTopics = completedActions.flatMap(a => a.result?.topics || [])
  const uniqueTopics = [...new Set(allTopics)]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-green-600">
          ✓ {completedActions.length} Dokument{completedActions.length !== 1 ? 'e' : ''} analysiert
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Schließen
        </Button>
      </div>
      
      {uniqueTopics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Erkannte Themen:</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueTopics.slice(0, 8).map((topic, i) => (
              <motion.span
                key={topic}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
              >
                {topic}
              </motion.span>
            ))}
            {uniqueTopics.length > 8 && (
              <span className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                +{uniqueTopics.length - 8} mehr
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function TaskResults({ stack, onDismiss }: StackResultsProps) {
  const completedActions = stack.actions.filter(a => a.status === 'completed')
  const totalTasks = completedActions.reduce((sum, a) => sum + (a.result?.count || 0), 0)
  const allItems = completedActions.flatMap(a => a.result?.items || [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-green-600">
          ✓ {totalTasks} Aufgabe{totalTasks !== 1 ? 'n' : ''} generiert
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Schließen
        </Button>
      </div>
      
      {allItems.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {allItems.slice(0, 5).map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="truncate flex-1">{item.title}</span>
              {item.subtitle && (
                <span className="text-xs text-muted-foreground">{item.subtitle}</span>
              )}
            </motion.div>
          ))}
          {allItems.length > 5 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              +{allItems.length - 5} weitere Aufgaben
            </p>
          )}
        </div>
      )}
    </motion.div>
  )
}

function NotesResults({ stack, onDismiss }: StackResultsProps) {
  const completedActions = stack.actions.filter(a => a.status === 'completed')

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-green-600">
          ✓ {completedActions.length} Notiz{completedActions.length !== 1 ? 'en' : ''} erstellt
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Schließen
        </Button>
      </div>
      
      <div className="space-y-1.5">
        {completedActions.slice(0, 4).map((action, i) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
          >
            <FileText size={14} className="text-green-500" />
            <span className="truncate">{action.name}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function FlashcardResults({ stack, onDismiss }: StackResultsProps) {
  const completedActions = stack.actions.filter(a => a.status === 'completed')
  const totalCards = completedActions.reduce((sum, a) => sum + (a.result?.count || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Cards size={24} className="text-purple-500" weight="duotone" />
          </motion.div>
          <p className="text-sm font-medium text-green-600">
            {totalCards} Karteikarte{totalCards !== 1 ? 'n' : ''} erstellt
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Schließen
        </Button>
      </div>
      
      <motion.div 
        className="flex justify-center py-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex -space-x-3">
          {Array.from({ length: Math.min(5, totalCards) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0, rotate: -10 }}
              animate={{ y: 0, opacity: 1, rotate: (i - 2) * 5 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="w-12 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 rounded-lg border border-purple-300 dark:border-purple-700 shadow-sm"
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ExamResults({ stack, onDismiss }: StackResultsProps) {
  const completedActions = stack.actions.filter(a => a.status === 'completed')
  const taskCount = completedActions[0]?.result?.count || 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-green-600">
          ✓ Prüfung mit {taskCount} Aufgaben bereit
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Schließen
        </Button>
      </div>
      
      <motion.div 
        className="flex justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring" }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50 flex items-center justify-center">
          <Check size={32} className="text-green-600" weight="bold" />
        </div>
      </motion.div>
    </motion.div>
  )
}

function StackResults({ stack, onDismiss }: StackResultsProps) {
  switch (stack.type) {
    case 'analyze':
      return <AnalysisResults stack={stack} onDismiss={onDismiss} />
    case 'generate-tasks':
      return <TaskResults stack={stack} onDismiss={onDismiss} />
    case 'generate-notes':
      return <NotesResults stack={stack} onDismiss={onDismiss} />
    case 'generate-flashcards':
      return <FlashcardResults stack={stack} onDismiss={onDismiss} />
    case 'generate-exam':
      return <ExamResults stack={stack} onDismiss={onDismiss} />
    default:
      return null
  }
}

// ============================================================================
// Stack Card Component
// ============================================================================

interface StackCardProps {
  stack: AIActionStack
  isExpanded: boolean
  onToggle: () => void
  onDismiss: () => void
}

function StackCard({ stack, isExpanded, onToggle, onDismiss }: StackCardProps) {
  const config = STACK_CONFIG[stack.type]
  const Icon = getStackIcon(config.icon)
  
  const activeCount = stack.actions.filter(a => a.status === 'processing' || a.status === 'queued').length
  const completedCount = stack.actions.filter(a => a.status === 'completed').length
  const errorCount = stack.actions.filter(a => a.status === 'error').length
  
  const isComplete = stack.showResults && errorCount === 0
  const hasErrors = errorCount > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="overflow-hidden"
    >
      <Card className={cn(
        "transition-all duration-300",
        isComplete && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
        hasErrors && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
      )}>
        {/* Header */}
        <button
          onClick={onToggle}
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
        >
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isComplete ? "bg-green-100 dark:bg-green-900/30" : 
            hasErrors ? "bg-red-100 dark:bg-red-900/30" :
            "bg-primary/10"
          )}>
            {stack.isActive ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <CircleNotch size={20} className={config.color} />
              </motion.div>
            ) : isComplete ? (
              <Check size={20} className="text-green-600" weight="bold" />
            ) : hasErrors ? (
              <Warning size={20} className="text-red-600" weight="bold" />
            ) : (
              <Icon size={20} className={config.color} weight="duotone" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{config.label}</span>
              {activeCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({activeCount} aktiv)
                </span>
              )}
            </div>
            
            {/* Progress Bar */}
            {stack.isActive && (
              <div className="mt-1.5">
                <Progress value={stack.totalProgress} className="h-1.5" />
              </div>
            )}
            
            {/* Completion Info */}
            {!stack.isActive && completedCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedCount} abgeschlossen
                {errorCount > 0 && `, ${errorCount} Fehler`}
              </p>
            )}
          </div>
          
          {/* Expand Icon */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown size={16} className="text-muted-foreground" />
          </motion.div>
        </button>
        
        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t"
            >
              <div className="p-4">
                {stack.showResults ? (
                  <StackResults stack={stack} onDismiss={onDismiss} />
                ) : (
                  <div className="space-y-2">
                    {stack.actions.map((action, i) => (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2 text-sm"
                      >
                        {action.status === 'processing' ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <CircleNotch size={14} className="text-primary" />
                          </motion.div>
                        ) : action.status === 'completed' ? (
                          <Check size={14} className="text-green-600" />
                        ) : action.status === 'error' ? (
                          <Warning size={14} className="text-red-600" />
                        ) : (
                          <Queue size={14} className="text-muted-foreground" />
                        )}
                        <span className={cn(
                          "truncate flex-1",
                          action.status === 'queued' && "text-muted-foreground"
                        )}>
                          {action.name}
                        </span>
                        {action.status === 'processing' && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(action.progress)}%
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface AIActionCenterProps {
  className?: string
}

export function AIActionCenter({ className }: AIActionCenterProps) {
  const [stacks, setStacks] = useState<AIActionStack[]>([])
  const [expandedStack, setExpandedStack] = useState<AIActionType | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)

  // Subscribe to queue updates
  useEffect(() => {
    return subscribeToQueue(() => {
      setStacks(getActiveStacks())
    })
  }, [])

  // Auto-expand new active stacks
  useEffect(() => {
    const activeStack = stacks.find(s => s.isActive)
    if (activeStack && !expandedStack) {
      setExpandedStack(activeStack.type)
    }
  }, [stacks, expandedStack])

  const handleDismissStack = useCallback((type: AIActionType) => {
    clearCompletedActions(type)
    if (expandedStack === type) {
      setExpandedStack(null)
    }
  }, [expandedStack])

  // Calculate overall progress
  const hasActiveStacks = stacks.some(s => s.isActive)
  const overallProgress = hasActiveStacks
    ? stacks.filter(s => s.isActive).reduce((sum, s) => sum + s.totalProgress, 0) / stacks.filter(s => s.isActive).length
    : 0

  if (stacks.length === 0) {
    return null
  }

  // Minimized View
  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMinimized(false)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-card border shadow-lg flex items-center justify-center overflow-hidden group",
          className
        )}
      >
        {/* Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted/20"
          />
          <motion.circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={150}
            animate={{ strokeDashoffset: 150 - (overallProgress / 100) * 150 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={hasActiveStacks ? "text-primary" : "text-green-500"}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Icon */}
        <div className="relative z-10">
          {hasActiveStacks ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkle size={24} className="text-primary" weight="duotone" />
            </motion.div>
          ) : (
            <Check size={24} className="text-green-500" weight="bold" />
          )}
        </div>
        
        {/* Badge */}
        {stacks.length > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
            {stacks.length}
          </div>
        )}
        
        {/* Hover Tooltip */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {hasActiveStacks ? `${Math.round(overallProgress)}% - KI arbeitet...` : 'Fertig!'}
        </div>
      </motion.button>
    )
  }

  // Full View
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className={cn(
        "fixed bottom-6 right-6 z-50 w-80 max-h-[70vh]",
        className
      )}
    >
      <Card className="shadow-xl border-2 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <motion.div
              animate={hasActiveStacks ? { rotate: 360 } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkle size={20} className="text-primary" weight="duotone" />
            </motion.div>
            <span className="font-medium text-sm">KI-Aktionen</span>
            {hasActiveStacks && (
              <span className="text-xs text-muted-foreground">
                ({Math.round(overallProgress)}%)
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(true)}
            >
              <CaretDown size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => stacks.forEach(s => handleDismissStack(s.type))}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <ScrollArea className="max-h-[calc(70vh-60px)]">
          <div className="p-3 space-y-3">
            <AnimatePresence mode="popLayout">
              {stacks.map((stack) => (
                <StackCard
                  key={stack.type}
                  stack={stack}
                  isExpanded={expandedStack === stack.type}
                  onToggle={() => setExpandedStack(
                    expandedStack === stack.type ? null : stack.type
                  )}
                  onDismiss={() => handleDismissStack(stack.type)}
                />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// Minimized Button (alternative export)
// ============================================================================

export function AIActionButton({ onClick }: { onClick: () => void }) {
  const [stacks, setStacks] = useState<AIActionStack[]>([])

  useEffect(() => {
    return subscribeToQueue(() => {
      setStacks(getActiveStacks())
    })
  }, [])

  const hasActiveStacks = stacks.some(s => s.isActive)
  const overallProgress = hasActiveStacks
    ? stacks.filter(s => s.isActive).reduce((sum, s) => sum + s.totalProgress, 0) / stacks.filter(s => s.isActive).length
    : 0

  if (stacks.length === 0) {
    return null
  }

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-card border shadow-lg flex items-center justify-center overflow-hidden group"
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
        <motion.circle
          cx="28" cy="28" r="24"
          fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray={150}
          animate={{ strokeDashoffset: 150 - (overallProgress / 100) * 150 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={hasActiveStacks ? "text-primary" : "text-green-500"}
          strokeLinecap="round"
        />
      </svg>
      
      <div className="relative z-10">
        {hasActiveStacks ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkle size={24} className="text-primary" weight="duotone" />
          </motion.div>
        ) : (
          <Check size={24} className="text-green-500" weight="bold" />
        )}
      </div>
      
      {stacks.length > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
          {stacks.length}
        </div>
      )}
    </motion.button>
  )
}
