import { Module, Task, Flashcard, Script, StudyNote } from '@/lib/types'
import {
  calculateOverallStats,
  calculateModuleStats,
  calculateDailyActivity,
  calculateDifficultyDistribution,
  calculateWeeklyProgress,
  getTopPerformingModules,
} from '@/lib/statistics'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ArrowLeft, TrendUp, Fire, Clock, Target, BookOpen, Lightning, Trophy, Calendar, List } from '@phosphor-icons/react'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { RateLimitIndicator } from './RateLimitIndicator'
import { DebugModeToggle } from './DebugModeToggle'
import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface StatisticsDashboardProps {
  modules: Module[]
  tasks: Task[]
  flashcards: Flashcard[]
  scripts: Script[]
  notes: StudyNote[]
  onBack: () => void
  selectedModuleId?: string
}

export function StatisticsDashboard({
  modules,
  tasks,
  flashcards,
  scripts,
  notes,
  onBack,
  selectedModuleId,
}: StatisticsDashboardProps) {
  const overallStats = calculateOverallStats(modules, tasks, flashcards, scripts, notes)
  const dailyActivity = calculateDailyActivity(tasks, flashcards, notes, scripts, 30)
  const weeklyProgress = calculateWeeklyProgress(tasks, 8)
  const difficultyDistribution = calculateDifficultyDistribution(tasks)
  const topModules = getTopPerformingModules(modules, tasks, flashcards, scripts, notes, 3)

  const moduleStats = modules.map((module) =>
    calculateModuleStats(module, tasks, flashcards, scripts, notes)
  )

  const selectedModule = selectedModuleId ? modules.find((m) => m.id === selectedModuleId) : null
  const selectedModuleStats = selectedModule
    ? calculateModuleStats(selectedModule, tasks, flashcards, scripts, notes)
    : null

  const activityChartData = dailyActivity.slice(-14).map((day) => ({
    date: format(new Date(day.date), 'dd.MM'),
    'Aufgaben': day.tasksCompleted,
    'Karteikarten': day.flashcardsReviewed,
  }))

  const pieColors = {
    easy: 'hsl(var(--accent))',
    medium: 'hsl(var(--primary))',
    hard: 'hsl(var(--destructive))',
  }

  const difficultyChartData = [
    { name: 'Leicht', value: difficultyDistribution.easy, color: pieColors.easy },
    { name: 'Mittel', value: difficultyDistribution.medium, color: pieColors.medium },
    { name: 'Schwer', value: difficultyDistribution.hard, color: pieColors.hard },
  ].filter((item) => item.value > 0)

  const hasData = tasks.length > 0 || flashcards.length > 0 || scripts.length > 0 || notes.length > 0

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-3xl font-semibold tracking-tight truncate">Statistiken</h1>
                <p className="text-muted-foreground mt-1 text-xs sm:text-base truncate">
                  {selectedModule
                    ? `Fortschritt für ${selectedModule.name}`
                    : 'Dein Lernfortschritt im Überblick'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <DebugModeToggle />
              <RateLimitIndicator />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden">
                  <List size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Optionen</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Debug-Modus</p>
                    <DebugModeToggle />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">API-Status</p>
                    <RateLimitIndicator />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-16">
          <Card className="p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center">
                <TrendUp size={32} className="text-muted-foreground sm:w-10 sm:h-10" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">Noch keine Daten</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
              Beginne mit dem Lernen, um deine Statistiken zu sehen. Lade Skripte hoch, generiere Notizen und
              löse Aufgaben, um deinen Fortschritt zu verfolgen.
            </p>
          </Card>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
          <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
            <TabsList className="w-full sm:w-auto grid grid-cols-3">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Übersicht</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs sm:text-sm">Aktivität</TabsTrigger>
              <TabsTrigger value="modules" className="text-xs sm:text-sm">Module</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Fire size={20} className="text-accent sm:w-6 sm:h-6" />
                    </div>
                    <Badge variant="secondary" className="font-semibold text-xs sm:text-sm">
                      {overallStats.currentStreak} Tage
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">Aktuelle Serie</h3>
                  <p className="text-2xl font-semibold mt-1">{overallStats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Längste Serie: {overallStats.longestStreak} Tage
                  </p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Target size={24} className="text-primary" />
                    </div>
                    <Badge variant="secondary">
                      {Math.round(overallStats.averageCompletionRate)}%
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">Abschlussrate</h3>
                  <p className="text-2xl font-semibold mt-1">
                    {overallStats.completedTasks}/{overallStats.totalTasks}
                  </p>
                  <Progress value={overallStats.averageCompletionRate} className="mt-2" />
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Lightning size={24} className="text-secondary" />
                    </div>
                    <Badge variant="secondary">{overallStats.flashcardsReviewed} wiederholt</Badge>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">Karteikarten</h3>
                  <p className="text-2xl font-semibold mt-1">{overallStats.totalFlashcards}</p>
                  <p className="text-xs text-muted-foreground mt-2">Insgesamt erstellt</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Clock size={24} className="text-warning" />
                    </div>
                    <Badge variant="secondary">{overallStats.studyTimeMinutes} min</Badge>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">Lernzeit</h3>
                  <p className="text-2xl font-semibold mt-1">
                    {Math.floor(overallStats.studyTimeMinutes / 60)}h {overallStats.studyTimeMinutes % 60}m
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Geschätzt</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendUp size={20} />
                    Wöchentlicher Fortschritt
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyProgress}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="week"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target size={20} />
                    Aufgabenschwierigkeit
                  </h3>
                  {difficultyChartData.length > 0 ? (
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={difficultyChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {difficultyChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      Noch keine Aufgaben
                    </div>
                  )}
                </Card>
              </div>

              {topModules.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Trophy size={20} />
                    Top Module
                  </h3>
                  <div className="space-y-4">
                    {topModules.map((moduleStat, index) => (
                      <div key={moduleStat.moduleId}>
                        {index > 0 && <Separator className="my-4" />}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: moduleStat.moduleColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{moduleStat.moduleName}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span>
                                {moduleStat.completedTasks}/{moduleStat.totalTasks} Aufgaben
                              </span>
                              <span>{Math.round(moduleStat.completionRate)}% abgeschlossen</span>
                            </div>
                          </div>
                          <Badge variant="secondary">{Math.round(moduleStat.completionRate)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar size={20} />
                  Tägliche Aktivität (letzte 14 Tage)
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Aufgaben"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Karteikarten"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--accent))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen size={20} className="text-primary" />
                    </div>
                    <h3 className="font-semibold">Skripte</h3>
                  </div>
                  <p className="text-3xl font-semibold">{overallStats.totalScripts}</p>
                  <p className="text-sm text-muted-foreground mt-1">Hochgeladen</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <BookOpen size={20} className="text-secondary" />
                    </div>
                    <h3 className="font-semibold">Notizen</h3>
                  </div>
                  <p className="text-3xl font-semibold">{overallStats.totalNotes}</p>
                  <p className="text-sm text-muted-foreground mt-1">Generiert</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Target size={20} className="text-accent" />
                    </div>
                    <h3 className="font-semibold">Aufgaben</h3>
                  </div>
                  <p className="text-3xl font-semibold">{overallStats.completedTasks}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Von {overallStats.totalTasks} abgeschlossen
                  </p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="modules" className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {moduleStats.map((moduleStat) => (
                  <Card key={moduleStat.moduleId} className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: moduleStat.moduleColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-3">{moduleStat.moduleName}</h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Aufgaben</p>
                            <p className="text-xl font-semibold">
                              {moduleStat.completedTasks}/{moduleStat.totalTasks}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Karteikarten</p>
                            <p className="text-xl font-semibold">{moduleStat.totalFlashcards}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Skripte</p>
                            <p className="text-xl font-semibold">{moduleStat.totalScripts}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Notizen</p>
                            <p className="text-xl font-semibold">{moduleStat.totalNotes}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Fortschritt</span>
                            <span className="font-medium">{Math.round(moduleStat.completionRate)}%</span>
                          </div>
                          <Progress value={moduleStat.completionRate} />
                        </div>

                        {moduleStat.lastActivity && (
                          <p className="text-xs text-muted-foreground mt-3">
                            Zuletzt aktiv{' '}
                            {formatDistanceToNow(new Date(moduleStat.lastActivity), {
                              addSuffix: true,
                              locale: de,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {moduleStats.length === 0 && (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">Noch keine Module erstellt</p>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
