/**
 * TutorDashboard - Personalisierter Lernplan auf der Startseite
 * 
 * Zeigt:
 * - Module mit Prüfungsterminen und Fortschrittsanzeige
 * - Lernplan unter jedem Modul mit priorisierten Aufgabenblöcken
 * - Schwache Themen pro Modul
 */

import { Module, Task, Recommendation } from '@/lib/types'
import { generateRecommendations, getWeakTopics, getModuleProgress, formatExamDate, getDaysUntilExam } from '@/lib/recommendations'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { Progress } from '@/components/ui/progress'
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { 
  GraduationCap, 
  Lightning, 
  Calendar, 
  Target,
  ArrowRight,
  Warning,
  Fire,
  PencilSimple,
  CaretDown,
  CaretUp,
  BookOpen,
  Clock,
  Exam,
  Sparkle,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TutorDashboardProps {
  modules: Module[]
  tasks: Task[]
  scripts?: { id: string; moduleId: string; name: string }[]
  onSolveTask: (task: Task) => void
  onSelectModule: (moduleId: string) => void
  onEditModule?: (module: Module) => void
  onGenerateTasks?: (moduleId: string, scriptIds: string[]) => void
  isGenerating?: boolean
}

interface TaskBlock {
  type: 'exam-priority' | 'weak-topics' | 'practice' | 'review'
  title: string
  description: string
  icon: React.ReactNode
  tasks: Task[]
  color: string
}

export function TutorDashboard({ 
  modules, 
  tasks,
  scripts = [],
  onSolveTask,
  onSelectModule,
  onEditModule,
  onGenerateTasks,
  isGenerating = false
}: TutorDashboardProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.slice(0, 2).map(m => m.id)))

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  // Generiere Aufgabenblöcke für ein Modul basierend auf Prüfungstermin und Schwächen
  const getTaskBlocks = (module: Module): TaskBlock[] => {
    const moduleTasks = tasks.filter(t => t.moduleId === module.id && !t.completed)
    const weakTopics = getWeakTopics(module.id)
    const daysUntilExam = getDaysUntilExam(module.examDate)
    const blocks: TaskBlock[] = []

    if (moduleTasks.length === 0) return blocks

    // 1. Prüfungsvorbereitung (wenn Prüfung < 14 Tage)
    if (daysUntilExam !== null && daysUntilExam <= 14) {
      const urgentTasks = moduleTasks
        .filter(t => t.difficulty === 'hard' || t.difficulty === 'medium')
        .slice(0, 5)
      
      if (urgentTasks.length > 0) {
        blocks.push({
          type: 'exam-priority',
          title: daysUntilExam <= 3 ? '🔴 Letzte Vorbereitung' : '🟠 Prüfungsrelevant',
          description: `${daysUntilExam} Tage bis zur Prüfung - diese Aufgaben solltest du priorisieren`,
          icon: <Fire size={18} className="text-red-500" weight="fill" />,
          tasks: urgentTasks,
          color: 'border-red-500/30 bg-red-500/5'
        })
      }
    }

    // 2. Schwache Themen
    if (weakTopics.length > 0) {
      const weakTasks = moduleTasks.filter(t => 
        t.tags?.some(tag => weakTopics.includes(tag))
      ).slice(0, 4)
      
      if (weakTasks.length > 0) {
        blocks.push({
          type: 'weak-topics',
          title: '⚠️ Schwächen verbessern',
          description: `Fokussiere auf: ${weakTopics.slice(0, 3).join(', ')}`,
          icon: <Warning size={18} className="text-yellow-500" />,
          tasks: weakTasks,
          color: 'border-yellow-500/30 bg-yellow-500/5'
        })
      }
    }

    // 3. Übungsaufgaben (einfache bis mittlere)
    const practiceTasks = moduleTasks
      .filter(t => !blocks.some(b => b.tasks.includes(t)))
      .filter(t => t.difficulty === 'easy' || t.difficulty === 'medium')
      .slice(0, 4)
    
    if (practiceTasks.length > 0) {
      blocks.push({
        type: 'practice',
        title: '📝 Übungsaufgaben',
        description: 'Festige dein Wissen mit diesen Aufgaben',
        icon: <BookOpen size={18} className="text-blue-500" />,
        tasks: practiceTasks,
        color: 'border-blue-500/30 bg-blue-500/5'
      })
    }

    // 4. Herausforderungen (schwere Aufgaben, wenn keine Prüfung drängt)
    if (daysUntilExam === null || daysUntilExam > 14) {
      const challengeTasks = moduleTasks
        .filter(t => !blocks.some(b => b.tasks.includes(t)))
        .filter(t => t.difficulty === 'hard')
        .slice(0, 3)
      
      if (challengeTasks.length > 0) {
        blocks.push({
          type: 'review',
          title: '🎯 Herausforderungen',
          description: 'Teste dein Verständnis mit schweren Aufgaben',
          icon: <Target size={18} className="text-purple-500" />,
          tasks: challengeTasks,
          color: 'border-purple-500/30 bg-purple-500/5'
        })
      }
    }

    return blocks
  }

  // Prüfe ob Modul neue Aufgaben braucht
  const needsNewTasks = (moduleId: string): { needed: boolean; reason: string; scriptIds: string[] } => {
    const moduleTasks = tasks.filter(t => t.moduleId === moduleId)
    const uncompletedTasks = moduleTasks.filter(t => !t.completed)
    const moduleScripts = scripts.filter(s => s.moduleId === moduleId)
    
    // Finde Skripte ohne Aufgaben
    const scriptsWithTasks = new Set(moduleTasks.map(t => t.scriptId).filter(Boolean))
    const scriptsWithoutTasks = moduleScripts.filter(s => !scriptsWithTasks.has(s.id))
    
    if (scriptsWithoutTasks.length > 0) {
      return {
        needed: true,
        reason: `${scriptsWithoutTasks.length} Skript(e) ohne Aufgaben`,
        scriptIds: scriptsWithoutTasks.map(s => s.id)
      }
    }
    
    if (uncompletedTasks.length <= 2 && moduleScripts.length > 0) {
      return {
        needed: true,
        reason: uncompletedTasks.length === 0 ? 'Alle Aufgaben erledigt!' : `Nur noch ${uncompletedTasks.length} Aufgabe(n)`,
        scriptIds: moduleScripts.map(s => s.id)
      }
    }
    
    return { needed: false, reason: '', scriptIds: [] }
  }

  const getDifficultyBadge = (difficulty: Task['difficulty']) => {
    const colors = {
      easy: 'bg-green-500/10 text-green-600 border-green-500/20',
      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      hard: 'bg-red-500/10 text-red-600 border-red-500/20'
    }
    const labels = { easy: 'Einfach', medium: 'Mittel', hard: 'Schwer' }
    return (
      <Badge variant="outline" className={`text-[10px] ${colors[difficulty]}`}>
        {labels[difficulty]}
      </Badge>
    )
  }

  // Sortiere Module nach Prüfungsdatum (nächste zuerst)
  const sortedModules = [...modules].sort((a, b) => {
    const daysA = getDaysUntilExam(a.examDate)
    const daysB = getDaysUntilExam(b.examDate)
    
    if (daysA === null && daysB === null) return 0
    if (daysA === null) return 1
    if (daysB === null) return -1
    return daysA - daysB
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GraduationCap size={24} className="text-primary" weight="fill" />
        <h2 className="text-xl font-semibold">Deine Module & Lernplan</h2>
      </div>

      {/* Module mit integriertem Lernplan */}
      <div className="space-y-4">
        {sortedModules.map(module => {
          const progress = getModuleProgress(module.id)
          const weakTopics = getWeakTopics(module.id)
          const moduleTasks = tasks.filter(t => t.moduleId === module.id)
          const completedTasks = moduleTasks.filter(t => t.completed).length
          const taskBlocks = getTaskBlocks(module)
          const isExpanded = expandedModules.has(module.id)
          const daysUntilExam = getDaysUntilExam(module.examDate)
          
          return (
            <Card key={module.id} className="overflow-hidden">
              {/* Modul-Header */}
              <div 
                className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleModule(module.id)}
              >
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: module.color }}
                >
                  <span className="font-semibold text-base sm:text-lg">
                    {module.code.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start sm:items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{module.name}</h3>
                    {daysUntilExam !== null && daysUntilExam <= 7 && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        <Clock size={10} className="mr-1" />
                        {daysUntilExam}d
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="sm:w-[14px] sm:h-[14px]" />
                      <span className="hidden sm:inline">{formatExamDate(module.examDate)}</span>
                      <span className="sm:hidden">{daysUntilExam !== null ? `${daysUntilExam}d` : '–'}</span>
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span>{completedTasks}/{moduleTasks.length}</span>
                  </div>

                  {/* Kompakter Fortschrittsbalken */}
                  <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
                    <Progress value={progress * 100} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{Math.round(progress * 100)}%</span>
                  </div>

                  {/* Schwache Themen kompakt - nur auf Desktop */}
                  {weakTopics.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-yellow-600 mt-2">
                      <Warning size={12} />
                      <span>Schwach: {weakTopics.slice(0, 2).join(', ')}{weakTopics.length > 2 && ` +${weakTopics.length - 2}`}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {onEditModule && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditModule(module)
                      }}
                    >
                      <PencilSimple size={14} className="sm:w-4 sm:h-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 sm:h-8 sm:px-3 text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectModule(module.id)
                    }}
                  >
                    <span className="hidden sm:inline">Öffnen</span>
                    <ArrowRight size={14} className="sm:hidden" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                    {isExpanded ? <CaretUp size={14} className="sm:w-4 sm:h-4" /> : <CaretDown size={14} className="sm:w-4 sm:h-4" />}
                  </Button>
                </div>
              </div>

              {/* Lernplan (ausklappbar) */}
              <AnimatePresence>
                {isExpanded && taskBlocks.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightning size={16} className="text-primary" weight="fill" />
                        <span className="text-sm font-medium">Empfohlene Aufgabenblöcke</span>
                      </div>
                      
                      <div className="grid gap-3 sm:grid-cols-2">
                        {taskBlocks.map((block, blockIdx) => (
                          <Card 
                            key={`${module.id}-block-${blockIdx}`} 
                            className={`p-3 border-l-4 ${block.color}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {block.icon}
                              <span className="font-medium text-sm">{block.title}</span>
                              <Badge variant="secondary" className="text-[10px] ml-auto">
                                {block.tasks.length} Aufgaben
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{block.description}</p>
                            
                            <div className="space-y-1.5">
                              {block.tasks.slice(0, 3).map(task => (
                                <div 
                                  key={task.id}
                                  className="flex items-center gap-2 p-2 rounded-md bg-background/50 hover:bg-background cursor-pointer group text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onSolveTask(task)
                                  }}
                                >
                                  <div className="flex-1 min-w-0 truncate font-medium">
                                    {task.title || task.question.substring(0, 50)}...
                                  </div>
                                  {getDifficultyBadge(task.difficulty)}
                                  <ArrowRight 
                                    size={12} 
                                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                                  />
                                </div>
                              ))}
                              {block.tasks.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center pt-1">
                                  +{block.tasks.length - 3} weitere
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Leerer State oder Neue Aufgaben generieren */}
              {isExpanded && taskBlocks.length === 0 && (
                <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
                  {(() => {
                    const taskStatus = needsNewTasks(module.id)
                    const moduleScripts = scripts.filter(s => s.moduleId === module.id)
                    
                    if (moduleScripts.length === 0) {
                      return (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          <Exam size={24} className="mx-auto mb-2 opacity-50" />
                          <p>Lade Skripte hoch, um Aufgaben zu generieren</p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="mt-1"
                            onClick={() => onSelectModule(module.id)}
                          >
                            Modul öffnen
                          </Button>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="text-center py-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                          <Sparkle size={24} className="text-primary" weight="fill" />
                        </div>
                        <p className="font-medium mb-1">
                          {taskStatus.needed ? taskStatus.reason : 'Alle Aufgaben erledigt! 🎉'}
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Lass die KI neue Übungsaufgaben erstellen
                        </p>
                        <Button
                          onClick={() => onGenerateTasks?.(module.id, taskStatus.scriptIds.length > 0 ? taskStatus.scriptIds : moduleScripts.map(s => s.id))}
                          disabled={isGenerating}
                          className="gap-2"
                        >
                          {isGenerating ? (
                            <>
                              <ArrowsClockwise size={16} className="animate-spin" />
                              Generiere...
                            </>
                          ) : (
                            <>
                              <Sparkle size={16} weight="fill" />
                              Neue Aufgaben generieren
                            </>
                          )}
                        </Button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Leerer State */}
      {modules.length === 0 && (
        <Card className="p-8 text-center">
          <GraduationCap size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Noch keine Module</h3>
          <p className="text-muted-foreground">
            Erstelle dein erstes Modul, um deinen Lernplan zu starten.
          </p>
        </Card>
      )}
    </div>
  )
}
