import { useState, useMemo } from 'react'
import { Module, Task, StudyNote, Script, Flashcard, TopicStats } from '@/lib/types'
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
  CaretRight,
  Play,
  Cards,
  GraduationCap,
  Lightbulb,
  ArrowRight,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { formatExamDate, getDaysUntilExam, getConsolidatedTopicStats } from '@/lib/recommendations'
import { extractTaskTags } from '@/lib/tag-utils'
import { motion, AnimatePresence } from 'framer-motion'

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
  onStartTopicStudy?: (topic: string, tasks: Task[]) => void
}

interface TopicData {
  key: string
  label: string
  tasks: Task[]
  completedCount: number
  totalCount: number
  progress: number
  isWeak: boolean
  isStale: boolean
  stats?: TopicStats
  difficulties: { easy: number; medium: number; hard: number }
}

// Hilfsfunktion: Gruppiere Tasks nach Thema
function groupTasksByTopic(tasks: Task[], topicStats: TopicStats[]): TopicData[] {
  const topicMap = new Map<string, TopicData>()
  
  for (const task of tasks) {
    const taskTags = extractTaskTags(task)
    
    for (const { key, label } of taskTags) {
      if (!topicMap.has(key)) {
        const stats = topicStats.find(s => s.topic.toLowerCase() === label.toLowerCase())
        topicMap.set(key, {
          key,
          label,
          tasks: [],
          completedCount: 0,
          totalCount: 0,
          progress: 0,
          isWeak: false,
          isStale: false,
          stats,
          difficulties: { easy: 0, medium: 0, hard: 0 }
        })
      }
      
      const topic = topicMap.get(key)!
      topic.tasks.push(task)
      topic.totalCount++
      if (task.completed) topic.completedCount++
      topic.difficulties[task.difficulty]++
    }
  }
  
  // Berechne Fortschritt und Status
  for (const topic of topicMap.values()) {
    topic.progress = topic.totalCount > 0 
      ? Math.round((topic.completedCount / topic.totalCount) * 100) 
      : 0
    
    // Schwach wenn < 50% korrekt
    if (topic.stats) {
      const total = topic.stats.correct + topic.stats.incorrect
      topic.isWeak = total > 0 && topic.stats.incorrect >= topic.stats.correct
    }
    
    // Stale wenn > 7 Tage nicht geübt
    if (topic.stats?.lastPracticed) {
      const daysSince = Math.floor(
        (Date.now() - new Date(topic.stats.lastPracticed).getTime()) / (1000 * 60 * 60 * 24)
      )
      topic.isStale = daysSince > 7
    }
  }
  
  return Array.from(topicMap.values()).sort((a, b) => {
    // Schwache Themen zuerst
    if (a.isWeak !== b.isWeak) return a.isWeak ? -1 : 1
    // Dann stale
    if (a.isStale !== b.isStale) return a.isStale ? -1 : 1
    // Dann nach Fortschritt (weniger zuerst)
    return a.progress - b.progress
  })
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
  onStartTopicStudy,
}: ModuleDashboardProps) {
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null)
  const [studyRoomNickname, setStudyRoomNickname] = useState(defaultNickname || '')
  const [studyRoomTopic, setStudyRoomTopic] = useState('')
  const [studyRoomCode, setStudyRoomCode] = useState('')
  const [studyRoomExpanded, setStudyRoomExpanded] = useState(false)
  
  // Berechnungen
  const topicStats = useMemo(() => getConsolidatedTopicStats(module.id), [module.id])
  const topicsData = useMemo(() => groupTasksByTopic(tasks, topicStats), [tasks, topicStats])
  
  // Fortschritt
  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  
  // Schwache und stale Themen
  const weakTopics = topicsData.filter(t => t.isWeak)
  const staleTopics = topicsData.filter(t => t.isStale)
  
  // Prüfungstermin
  const daysUntilExam = module.examDate ? getDaysUntilExam(module.examDate) : null
  
  // Smart Empfehlung: Was sollte man als nächstes lernen?
  const recommendedTopic = useMemo(() => {
    // Priorität: Schwach > Stale > Niedrigster Fortschritt
    if (weakTopics.length > 0) return weakTopics[0]
    if (staleTopics.length > 0) return staleTopics[0]
    const incomplete = topicsData.filter(t => t.progress < 100)
    return incomplete[0] || null
  }, [weakTopics, staleTopics, topicsData])

  const startTopicSequence = (topic: TopicData) => {
    if (!onStartTaskSequence) return
    const sortedTasks = [...topic.tasks].sort((a, b) => {
      const diffOrder = { easy: 0, medium: 1, hard: 2 }
      return diffOrder[a.difficulty] - diffOrder[b.difficulty]
    })
    const firstIncomplete = sortedTasks.find(t => !t.completed) || sortedTasks[0]
    onStartTaskSequence(sortedTasks, firstIncomplete?.id)
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - Lernstatus */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6 md:p-8">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{module.name}</h1>
              <p className="text-muted-foreground mb-4">{module.code}</p>
              
              {/* Progress Ring */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-muted/20"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-primary"
                      strokeDasharray={`${progressPercent * 2.2} 220`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{progressPercent}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Fortschritt</div>
                  <div className="font-semibold">{completedTasks} / {totalTasks} Aufgaben</div>
                  {topicsData.length > 0 && (
                    <div className="text-sm text-muted-foreground">{topicsData.length} Themen</div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              {recommendedTopic && (
                <Button 
                  size="lg" 
                  className="gap-2 text-base"
                  onClick={() => startTopicSequence(recommendedTopic)}
                >
                  <Play size={20} weight="fill" />
                  Lernen starten
                </Button>
              )}
              {flashcards.length > 0 && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="gap-2"
                  onClick={onStartFlashcardStudy}
                >
                  <Cards size={20} />
                  {flashcards.length} Karteikarten
                </Button>
              )}
            </div>
          </div>
          
          {/* Exam Warning */}
          {daysUntilExam !== null && daysUntilExam <= 14 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'mt-6 p-4 rounded-lg flex items-center gap-3',
                daysUntilExam <= 3 ? 'bg-red-500/10 border border-red-500/30' : 'bg-orange-500/10 border border-orange-500/30'
              )}
            >
              <CalendarBlank size={24} className={daysUntilExam <= 3 ? 'text-red-500' : 'text-orange-500'} weight="fill" />
              <div>
                <div className="font-semibold">
                  {daysUntilExam === 0 ? 'Prüfung HEUTE!' :
                   daysUntilExam === 1 ? 'Prüfung MORGEN!' :
                   `Noch ${daysUntilExam} Tage bis zur Prüfung`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatExamDate(module.examDate!)}
                </div>
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Smart Recommendation Card */}
      {recommendedTopic && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb size={20} className="text-yellow-500" weight="fill" />
                Empfehlung für dich
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-lg">{recommendedTopic.label}</span>
                    {recommendedTopic.isWeak && (
                      <Badge variant="destructive" className="text-xs">Schwach</Badge>
                    )}
                    {recommendedTopic.isStale && (
                      <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">Lange nicht geübt</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{recommendedTopic.completedCount}/{recommendedTopic.totalCount} Aufgaben</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> {recommendedTopic.difficulties.easy}
                      <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" /> {recommendedTopic.difficulties.medium}
                      <span className="w-2 h-2 rounded-full bg-red-500 ml-2" /> {recommendedTopic.difficulties.hard}
                    </span>
                  </div>
                  <Progress value={recommendedTopic.progress} className="h-2 mt-3" />
                </div>
                <Button onClick={() => startTopicSequence(recommendedTopic)} className="gap-2">
                  <ArrowRight size={18} />
                  Jetzt üben
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Themen-Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen size={22} />
            Themen
          </h2>
          {tasks.length === 0 && scripts.length > 0 && onGenerateAllTasks && (
            <Button onClick={onGenerateAllTasks} disabled={isGenerating} className="gap-2">
              {isGenerating ? (
                <ArrowsClockwise size={18} className="animate-spin" />
              ) : (
                <Sparkle size={18} weight="fill" />
              )}
              Aufgaben generieren
            </Button>
          )}
        </div>

        {topicsData.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {topicsData.map((topic, index) => (
                <motion.div
                  key={topic.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group',
                      topic.progress === 100 && 'bg-green-500/5 border-green-500/30',
                      topic.isWeak && 'border-red-500/30',
                      topic.isStale && !topic.isWeak && 'border-orange-500/30'
                    )}
                    onClick={() => startTopicSequence(topic)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                            {topic.label}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {topic.completedCount}/{topic.totalCount} Aufgaben
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {topic.progress === 100 ? (
                            <CheckCircle size={24} className="text-green-500" weight="fill" />
                          ) : topic.isWeak ? (
                            <Warning size={24} className="text-red-500" weight="fill" />
                          ) : topic.isStale ? (
                            <Clock size={24} className="text-orange-500" weight="fill" />
                          ) : (
                            <CaretRight size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                          )}
                        </div>
                      </div>
                      
                      <Progress value={topic.progress} className="h-1.5 mb-3" />
                      
                      {/* Difficulty Distribution */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {topic.difficulties.easy}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          {topic.difficulties.medium}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          {topic.difficulties.hard}
                        </div>
                        {topic.stats && (
                          <span className="ml-auto">
                            {topic.stats.correct}✓ {topic.stats.incorrect}✗
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <GraduationCap size={48} className="mx-auto mb-4 text-muted-foreground" weight="duotone" />
            <h3 className="font-semibold mb-2">Noch keine Aufgaben</h3>
            <p className="text-muted-foreground mb-4">
              Lade Skripte hoch und generiere Aufgaben, um mit dem Lernen zu beginnen.
            </p>
            {scripts.length > 0 && onGenerateAllTasks && (
              <Button onClick={onGenerateAllTasks} disabled={isGenerating}>
                <Sparkle size={18} className="mr-2" weight="fill" />
                Aufgaben generieren
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target size={20} className="text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <div className="text-xs text-muted-foreground">Aufgaben gesamt</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedTasks}</div>
              <div className="text-xs text-muted-foreground">Abgeschlossen</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Cards size={20} className="text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{flashcards.length}</div>
              <div className="text-xs text-muted-foreground">Karteikarten</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BookOpen size={20} className="text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{scripts.length}</div>
              <div className="text-xs text-muted-foreground">Dateien</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Lerngruppe / StudyRoom (Collapsed by default) */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
          onClick={() => setStudyRoomExpanded((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <UsersThree size={20} className="text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-base">Lerngruppe</CardTitle>
                <CardDescription>Gemeinsam lernen & challengen</CardDescription>
              </div>
            </div>
            <CaretRight 
              size={20} 
              className={cn(
                'text-muted-foreground transition-transform',
                studyRoomExpanded && 'rotate-90'
              )} 
            />
          </div>
        </CardHeader>
        <AnimatePresence>
          {studyRoomExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="grid md:grid-cols-2 gap-4 pt-0">
                <div className="space-y-3">
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
                    Lerngruppe starten
                  </Button>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="study-code">Room-Code</Label>
                  <Input
                    id="study-code"
                    value={studyRoomCode}
                    onChange={(e) => setStudyRoomCode(e.target.value.toUpperCase())}
                    placeholder="Z.B. ABC123"
                  />
                  <div className="text-xs text-muted-foreground">
                    Der Code besteht aus 6 Zeichen (A-Z, 0-9).
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
                    Beitreten
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}
