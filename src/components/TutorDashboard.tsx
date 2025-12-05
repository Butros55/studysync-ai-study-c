/**
 * TutorDashboard - Personalisierter Lernplan auf der Startseite
 * 
 * Zeigt:
 * - Empfohlene Aufgaben basierend auf Prüfungsterminen und Fortschritt
 * - Module mit Prüfungsterminen und Fortschrittsanzeige
 * - Schwache Themen pro Modul
 */

import { Module, Task, Recommendation } from '@/lib/types'
import { generateRecommendations, getWeakTopics, getModuleProgress, formatExamDate } from '@/lib/recommendations'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { Progress } from '@/components/ui/progress'
import { 
  GraduationCap, 
  Lightning, 
  Calendar, 
  Target,
  ArrowRight,
  Warning,
  Fire,
  PencilSimple
} from '@phosphor-icons/react'

interface TutorDashboardProps {
  modules: Module[]
  tasks: Task[]
  onSolveTask: (task: Task) => void
  onSelectModule: (moduleId: string) => void
  onEditModule?: (module: Module) => void
}

export function TutorDashboard({ 
  modules, 
  tasks, 
  onSolveTask,
  onSelectModule,
  onEditModule
}: TutorDashboardProps) {
  const recommendations = generateRecommendations(modules, tasks, 5)
  
  // Flache Liste aller empfohlenen Aufgaben
  const recommendedTasks = recommendations.flatMap(rec => 
    rec.tasks.map(task => ({
      ...task,
      moduleName: rec.moduleName,
      reason: rec.reason,
      type: rec.type
    }))
  ).slice(0, 5)

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'exam-prep':
        return <Fire size={14} className="text-red-500" weight="fill" />
      case 'weak-topic':
        return <Warning size={14} className="text-yellow-500" />
      case 'this-week':
        return <Calendar size={14} className="text-blue-500" />
      default:
        return <Target size={14} className="text-green-500" />
    }
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

  return (
    <div className="space-y-6">
      {/* Lernplan-Sektion */}
      {recommendedTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Lightning size={20} className="text-primary" weight="fill" />
            <h2 className="text-lg font-semibold">Dein Lernplan</h2>
            <Badge variant="secondary" className="ml-auto">
              {recommendedTasks.length} Empfehlungen
            </Badge>
          </div>
          
          <div className="grid gap-3">
            {recommendedTasks.map((task, idx) => (
              <Card 
                key={`${task.id}-${idx}`}
                className="p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => onSolveTask(task)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getTypeIcon(task.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">{task.moduleName}</span>
                      {getDifficultyBadge(task.difficulty)}
                    </div>
                    <div className="text-sm font-medium line-clamp-2">
                      <MarkdownRenderer 
                        content={task.title || task.question} 
                        compact 
                        truncateLines={2}
                        className="prose-p:my-0 prose-headings:my-0 prose-h3:text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.reason}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Module-Übersicht mit Prüfungsterminen */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={20} className="text-primary" weight="fill" />
          <h2 className="text-lg font-semibold">Deine Module</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(module => {
            const progress = getModuleProgress(module.id)
            const weakTopics = getWeakTopics(module.id)
            const moduleTasks = tasks.filter(t => t.moduleId === module.id)
            const completedTasks = moduleTasks.filter(t => t.completed).length
            
            return (
              <Card 
                key={module.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => onSelectModule(module.id)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: module.color }}
                  >
                    <span className="font-semibold text-sm">
                      {module.code.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{module.name}</h3>
                    <p className="text-xs text-muted-foreground">{module.code}</p>
                  </div>
                  {onEditModule && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditModule(module)
                      }}
                    >
                      <PencilSimple size={16} />
                    </Button>
                  )}
                </div>

                {/* Prüfungstermin */}
                <div className="flex items-center gap-2 text-sm mb-3">
                  <Calendar size={14} className="text-muted-foreground" />
                  <span className={module.examDate ? 'text-foreground' : 'text-muted-foreground'}>
                    {formatExamDate(module.examDate)}
                  </span>
                </div>

                {/* Fortschritt */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Fortschritt</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <Progress value={progress * 100} className="h-1.5" />
                </div>

                {/* Schwache Themen */}
                {weakTopics.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <Warning size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      Schwach: {weakTopics.slice(0, 2).join(', ')}
                      {weakTopics.length > 2 && ` +${weakTopics.length - 2}`}
                    </span>
                  </div>
                )}

                {/* Aufgaben-Zähler */}
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                  {completedTasks}/{moduleTasks.length} Aufgaben bearbeitet
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
