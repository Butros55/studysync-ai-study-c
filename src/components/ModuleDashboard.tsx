import { useState, useMemo } from 'react'
import { Module, Task, StudyNote, Script, Flashcard, ModuleLearningBlock, TopicStats, TaskRef } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CalendarBlank,
  Lightning,
  TrendUp,
  Warning,
  Clock,
  Trophy,
  Target,
  BookOpen,
  Brain,
  CheckCircle,
  Circle,
  Sparkle,
  Fire,
  ChartBar,
  ArrowsClockwise,
  UsersThree,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { formatExamDate, getDaysUntilExam, getConsolidatedTopicStats } from '@/lib/recommendations'
import { extractTaskTags } from '@/lib/tag-utils'
import { MarkdownRenderer } from './MarkdownRenderer'

interface ModuleDashboardProps {
  module: Module
  tasks: Task[]
  notes: StudyNote[]
  scripts: Script[]
  flashcards: Flashcard[]
  onSolveTask: (task: Task) => void
  onStartFlashcardStudy: () => void
  onStartTaskSequence?: (tasks: Task[], startTaskId?: string) => void
  onBlockComplete?: (blockId: string) => void
  onGenerateAllTasks?: () => void
  isGenerating?: boolean
  onStartStudyRoom?: (params: { moduleId: string; topic?: string; nickname: string }) => void
  onJoinStudyRoom?: (params: { code: string; nickname: string }) => void
  studyRoomBusy?: boolean
  defaultNickname?: string
}

// Hilfsfunktion: Generiere Lernblöcke aus Aufgaben
function generateLearningBlocks(tasks: Task[]): ModuleLearningBlock[] {
  const blocksByTag = new Map<string, { label: string; tasks: Task[] }>()

  tasks.forEach((task) => {
    const taskTags = extractTaskTags(task)

    taskTags.forEach(({ key, label }) => {
      if (!blocksByTag.has(key)) {
        blocksByTag.set(key, { label, tasks: [] })
      }
      blocksByTag.get(key)!.tasks.push(task)
    })
  })

  const blocks: ModuleLearningBlock[] = []
  let order = 0

  blocksByTag.forEach(({ label, tasks: tagTasks }, key) => {
    const sortedTasks = [...tagTasks].sort((a, b) => {
      const diffOrder = { easy: 0, medium: 1, hard: 2 }
      return diffOrder[a.difficulty] - diffOrder[b.difficulty]
    })

    const requiredTasks: TaskRef[] = sortedTasks.map((t) => ({
      id: t.id,
      title: t.title || `${t.question.substring(0, 50)}...`,
      difficulty: t.difficulty,
      topic: t.topic,
    }))

    const completedTasks = sortedTasks.filter((t) => t.completed).map((t) => t.id)
    const isCompleted = completedTasks.length === requiredTasks.length && requiredTasks.length > 0
    const safeId = key.replace(/[^a-z0-9]+/g, '-') || 'tag'

    blocks.push({
      id: `block-${safeId}`,
      title: label,
      description: `${requiredTasks.length} Aufgaben zu ${label}`,
      topics: [label],
      requiredTasks,
      completedTasks,
      completed: isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
      order: order++,
    })
  })

  return blocks.sort((a, b) => a.order - b.order)
}

// Hilfsfunktion: Berechne Themenstatistiken
function calculateTopicStats(tasks: Task[]): TopicStats[] {
  const statsMap = new Map<string, TopicStats>()
  
  for (const task of tasks) {
    const topic = task.topic || 'Allgemein'
    
    if (!statsMap.has(topic)) {
      statsMap.set(topic, {
        topic,
        correct: 0,
        incorrect: 0,
        lastPracticed: undefined,
        difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
      })
    }
    
    const stats = statsMap.get(topic)!
    
    if (task.completed) {
      stats.correct++
      if (!stats.lastPracticed || (task.completedAt && task.completedAt > stats.lastPracticed)) {
        stats.lastPracticed = task.completedAt
      }
    }
    
    if (stats.difficultyDistribution) {
      stats.difficultyDistribution[task.difficulty]++
    }
  }
  
  return Array.from(statsMap.values())
}

export function ModuleDashboard({
  module,
  tasks,
  notes,
  scripts,
  flashcards,
  onSolveTask,
  onStartTaskSequence,
  onStartFlashcardStudy,
  onBlockComplete,
  onGenerateAllTasks,
  isGenerating = false,
  onStartStudyRoom,
  onJoinStudyRoom,
  studyRoomBusy = false,
  defaultNickname,
}: ModuleDashboardProps) {
  const [showBlockCompleteOverlay, setShowBlockCompleteOverlay] = useState<string | null>(null)
  const [studyRoomNickname, setStudyRoomNickname] = useState(defaultNickname || '')
  const [studyRoomTopic, setStudyRoomTopic] = useState('')
  const [studyRoomCode, setStudyRoomCode] = useState('')
  const [studyRoomExpanded, setStudyRoomExpanded] = useState(false)
  
  // Berechnungen
  const learningBlocks = useMemo(() => generateLearningBlocks(tasks), [tasks])
  const topicStats = useMemo(() => {
    const consolidated = getConsolidatedTopicStats(module.id)
    if (consolidated.length > 0) return consolidated
    return calculateTopicStats(tasks)
  }, [module.id, tasks])
  
  // Fortschritt
  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  
  // Schwache Themen (mehr Fehler als Erfolge oder nie geübt)
  const weakTopics = topicStats.filter(s => {
    const total = s.correct + s.incorrect
    return total > 0 && s.incorrect >= s.correct
  })
  
  // Lange nicht geübte Themen (> 7 Tage)
  const staleTopics = topicStats.filter(s => {
    if (!s.lastPracticed) return false
    const daysSince = Math.floor((Date.now() - new Date(s.lastPracticed).getTime()) / (1000 * 60 * 60 * 24))
    return daysSince > 7
  })
  const neverPracticedTopics = topicStats.filter((s) => !s.lastPracticed)
  const nextIncompleteTask = tasks.find((t) => !t.completed)
  
  // Prüfungstermin
  const daysUntilExam = module.examDate ? getDaysUntilExam(module.examDate) : null
  
  // Empfohlene Aufgaben für heute (gewichtete Auswahl nach Schwächen & Staleness)
  const todaysTasks = useMemo(() => {
    const weakTopicNames = new Set(weakTopics.map(w => w.topic))
    const staleTopicNames = new Set(staleTopics.map(s => s.topic))

    return tasks
      .filter(task => !task.completed)
      .map(task => {
        let score = 0

        if (weakTopicNames.has(task.topic || 'Allgemein')) score += 3
        if (staleTopicNames.has(task.topic || 'Allgemein')) score += 2
        if (daysUntilExam !== null && daysUntilExam <= 14) score += 2
        if (task.difficulty === 'medium') score += 0.5
        if (task.difficulty === 'hard') score += 1

        return { task, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(entry => entry.task)
  }, [daysUntilExam, staleTopics, tasks, weakTopics])
  
  const getTaskPreview = (task: Task) => {
    if (task.title?.trim()) return task.title
    const firstContentLine = task.question.split('\n').find(line => line.trim().length > 0)
    return firstContentLine || task.question
  }

  const startBlockSequence = (block: ModuleLearningBlock) => {
    if (!onStartTaskSequence) return

    const blockTasks = block.requiredTasks
      .map(ref => tasks.find(t => t.id === ref.id))
      .filter((t): t is Task => Boolean(t))

    if (blockTasks.length === 0) return

    const firstIncomplete = blockTasks.find(t => !t.completed) || blockTasks[0]
    onStartTaskSequence(blockTasks, firstIncomplete?.id)
  }

  // Nächster empfohlener Block
  const nextBlock = learningBlocks.find(b => !b.completed)

  return (
    <div className="space-y-6">
      {/* Header mit Fortschritt */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Modul-Fortschritt */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" />
              Fortschritt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold">{progressPercent}%</span>
              <span className="text-sm text-muted-foreground mb-1">
                ({completedTasks}/{totalTasks} Aufgaben)
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>

        {/* Prüfungstermin */}
        <Card className={cn(
          daysUntilExam !== null && daysUntilExam <= 7 && 'border-orange-500/50'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarBlank className="w-4 h-4" />
              Prüfungstermin
            </CardTitle>
          </CardHeader>
          <CardContent>
            {module.examDate ? (
              <div>
                <div className="text-lg font-semibold">
                  {formatExamDate(module.examDate)}
                </div>
                <div className={cn(
                  'text-sm',
                  daysUntilExam !== null && daysUntilExam <= 7 ? 'text-orange-500' : 'text-muted-foreground'
                )}>
                  {daysUntilExam !== null && (
                    daysUntilExam === 0 ? 'Heute!' :
                    daysUntilExam === 1 ? 'Morgen!' :
                    `Noch ${daysUntilExam} Tage`
                  )}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                Kein Termin festgelegt
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ChartBar className="w-4 h-4" />
              Statistiken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold">{scripts.length}</div>
                <div className="text-xs text-muted-foreground">Dateien</div>
              </div>
              <div>
                <div className="text-xl font-bold">{notes.length}</div>
                <div className="text-xs text-muted-foreground">Notizen</div>
              </div>
              <div>
                <div className="text-xl font-bold">{flashcards.length}</div>
                <div className="text-xs text-muted-foreground">Karten</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lerngruppe / StudyRoom */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setStudyRoomExpanded((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UsersThree className="w-5 h-5" />
              <div>
                <CardTitle className="text-base">Lerngruppe</CardTitle>
                <CardDescription>Gemeinsam lernen & challengen</CardDescription>
              </div>
            </div>
            <Badge variant="outline">{studyRoomExpanded ? 'Schließen' : 'Öffnen'}</Badge>
          </div>
        </CardHeader>
        {studyRoomExpanded && (
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="study-nickname">Nickname</Label>
              <Input
                id="study-nickname"
                value={studyRoomNickname}
                onChange={(e) => setStudyRoomNickname(e.target.value)}
                placeholder="Dein Anzeigename im Raum"
              />
              <Label htmlFor="study-topic" className="text-sm text-muted-foreground">
                Optionales Thema/Tag
              </Label>
              <Input
                id="study-topic"
                value={studyRoomTopic}
                onChange={(e) => setStudyRoomTopic(e.target.value)}
                placeholder="z.B. Analysis, Kostenrechnung"
              />
              <Button
                className="w-full"
                disabled={!onStartStudyRoom || studyRoomBusy}
                onClick={() =>
                  onStartStudyRoom?.({
                    moduleId: module.id,
                    topic: studyRoomTopic || undefined,
                    nickname: studyRoomNickname || defaultNickname || 'Gast',
                  })
                }
              >
                Lerngruppe starten (Host)
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="study-code">Room-Code</Label>
              <Input
                id="study-code"
                value={studyRoomCode}
                onChange={(e) => setStudyRoomCode(e.target.value.toUpperCase())}
                placeholder="Z.B. ABC123"
              />
              <div className="text-xs text-muted-foreground">
                Der Code besteht aus 6 Zeichen (A-Z, 0-9). Polling aktualisiert den Raum alle paar Sekunden.
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={!onJoinStudyRoom || !studyRoomCode || studyRoomBusy}
                onClick={() =>
                  onJoinStudyRoom?.({
                    code: studyRoomCode,
                    nickname: studyRoomNickname || defaultNickname || 'Gast',
                  })
                }
              >
                Lerngruppe beitreten
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Was du heute lernen solltest */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightning className="w-5 h-5 text-yellow-500" weight="fill" />
                Was du heute lernen solltest
              </CardTitle>
              <CardDescription>
                Basierend auf deinem Fortschritt und schwachen Themen
              </CardDescription>
            </div>
            {flashcards.length > 0 && (
              <Button variant="outline" size="sm" onClick={onStartFlashcardStudy}>
                <Brain className="w-4 h-4 mr-2" />
                Karteikarten üben
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {todaysTasks.length > 0 ? (
            <div className="space-y-2">
              {todaysTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      task.difficulty === 'easy' && 'bg-green-500',
                      task.difficulty === 'medium' && 'bg-yellow-500',
                      task.difficulty === 'hard' && 'bg-red-500'
                    )} />
                    <div className="min-w-0">
                      <MarkdownRenderer
                        content={getTaskPreview(task)}
                        compact
                        truncateLines={2}
                        className="font-medium text-sm"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {extractTaskTags(task).map((tag) => (
                          <Badge key={`${task.id}-${tag.key}`} variant="secondary" className="text-[10px]">
                            {tag.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => onSolveTask(task)}>
                    Üben
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-yellow-500" weight="duotone" />
              <p className="font-medium">Großartig! Alle Aufgaben erledigt!</p>
              <p className="text-sm text-muted-foreground mb-4">Du hast alle verfügbaren Aufgaben abgeschlossen.</p>
              {scripts.length > 0 && onGenerateAllTasks && (
                <Button
                  onClick={onGenerateAllTasks}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <ArrowsClockwise size={16} className="animate-spin" />
                      Generiere neue Aufgaben...
                    </>
                  ) : (
                    <>
                      <Sparkle size={16} weight="fill" />
                      Neue Aufgaben generieren
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schwache Themen & Lange nicht geübt */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Schwache Themen */}
        <Card className={weakTopics.length > 0 ? 'border-red-500/30' : ''}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Warning className="w-4 h-4 text-red-500" />
              Themen mit vielen Fehlern
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weakTopics.length > 0 ? (
              <div className="space-y-2">
                {weakTopics.slice(0, 5).map((topic) => (
                  <div key={topic.topic} className="flex items-center justify-between">
                    <span className="text-sm">{topic.topic}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-500">{topic.correct} ✓</span>
                      <span className="text-xs text-red-500">{topic.incorrect} ✗</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine schwachen Themen erkannt 🎉
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lange nicht geübt */}
        <Card className={staleTopics.length > 0 || neverPracticedTopics.length > 0 ? 'border-orange-500/30' : ''}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Lange nicht geübt
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleTopics.length > 0 ? (
              <div className="space-y-2">
                {staleTopics.slice(0, 5).map((topic) => (
                  <div key={topic.topic} className="flex items-center justify-between">
                    <span className="text-sm">{topic.topic}</span>
                    <span className="text-xs text-muted-foreground">
                      {topic.lastPracticed
                        ? `Vor ${Math.floor((Date.now() - new Date(topic.lastPracticed).getTime()) / (1000 * 60 * 60 * 24))} Tagen`
                        : 'Nie geübt'}
                    </span>
                  </div>
                ))}
              </div>
            ) : neverPracticedTopics.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Noch keine Uebungsdaten fuer:</p>
                <div className="flex flex-wrap gap-1">
                  {neverPracticedTopics.slice(0, 6).map((topic) => (
                    <Badge key={topic.topic} variant="secondary" className="text-[11px]">
                      {topic.topic}
                    </Badge>
                  ))}
                </div>
                {nextIncompleteTask && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSolveTask(nextIncompleteTask)}
                  >
                    Erste Aufgabe starten
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Alles auf dem neuesten Stand! 👍
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lernblöcke */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Lernblöcke
          </CardTitle>
          <CardDescription>
            Strukturiertes Lernen nach Themen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {learningBlocks.length > 0 ? (
            <div className="space-y-3">
              {learningBlocks.map((block) => {
                const progress = block.requiredTasks.length > 0
                  ? Math.round((block.completedTasks.length / block.requiredTasks.length) * 100)
                  : 0

                return (
                  <div
                    key={block.id}
                    className={cn(
                      'p-4 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
                      block.completed ? 'bg-green-500/10 border-green-500/30' : 'hover:bg-muted/50'
                    )}
                    tabIndex={0}
                    role="button"
                    onClick={() => startBlockSequence(block)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        startBlockSequence(block)
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {block.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-500" weight="fill" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <h4 className="font-medium">{block.title}</h4>
                      </div>
                      <Badge variant={block.completed ? 'default' : 'secondary'}>
                        {block.completedTasks.length}/{block.requiredTasks.length}
                      </Badge>
                    </div>
                    <Progress value={progress} className="h-1.5 mb-2" />
                    <p className="text-xs text-muted-foreground">{block.description}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkle className="w-12 h-12 mx-auto mb-3" weight="duotone" />
              <p>Noch keine Aufgaben vorhanden.</p>
              <p className="text-sm">Lade Skripte hoch und generiere Aufgaben, um Lernblöcke zu erstellen.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Complete Overlay */}
      {showBlockCompleteOverlay && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="max-w-md mx-4 text-center animate-in zoom-in-95 duration-300">
            <CardContent className="pt-8 pb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">Block abgeschlossen!</h2>
              <p className="text-muted-foreground mb-6">
                Großartig! Du hast alle Aufgaben in diesem Block gemeistert.
              </p>
              {nextBlock && (
                <p className="text-sm text-muted-foreground mb-4">
                  <strong>Empfehlung:</strong> Als nächstes solltest du den Block "{nextBlock.title}" bearbeiten.
                </p>
              )}
              <Button onClick={() => setShowBlockCompleteOverlay(null)}>
                Zurück zum Modul
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
