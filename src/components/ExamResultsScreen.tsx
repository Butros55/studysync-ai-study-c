import { ExamSession, ExamResults, ExamTaskResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Trophy,
  Target,
  TrendUp,
  TrendDown,
  CheckCircle,
  XCircle,
  Minus,
  Lightbulb,
  ChartPie,
  BookOpen,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ExamResultsScreenProps {
  session: ExamSession
  results: ExamResults
  onBack: () => void
  onRetry: () => void
}

export function ExamResultsScreen({
  session,
  results,
  onBack,
  onRetry,
}: ExamResultsScreenProps) {
  const percentage = results.percentage
  
  const getGrade = (pct: number): { grade: string; color: string; message: string } => {
    if (pct >= 90) return { grade: 'Sehr gut', color: 'text-green-600', message: 'Hervorragende Leistung!' }
    if (pct >= 75) return { grade: 'Gut', color: 'text-green-500', message: 'Gute Arbeit!' }
    if (pct >= 60) return { grade: 'Befriedigend', color: 'text-yellow-500', message: 'Solide Leistung.' }
    if (pct >= 50) return { grade: 'Ausreichend', color: 'text-orange-500', message: 'Knapp bestanden.' }
    return { grade: 'Nicht bestanden', color: 'text-red-500', message: 'Mehr Übung nötig.' }
  }

  const gradeInfo = getGrade(percentage)

  const getTaskResultIcon = (result: ExamTaskResult) => {
    if (result.isCorrect) {
      return <CheckCircle size={18} className="text-green-600" weight="fill" />
    }
    if (result.earnedPoints > 0) {
      return <Minus size={18} className="text-yellow-600" weight="bold" />
    }
    return <XCircle size={18} className="text-red-500" weight="fill" />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft size={20} />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold">Prüfungsergebnis</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(session.submittedAt || '').toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="mb-6 overflow-hidden">
            <div className={cn(
              'h-2',
              percentage >= 50 ? 'bg-green-500' : 'bg-red-500'
            )} />
            <CardContent className="pt-6">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center"
                >
                  <Trophy size={48} className={gradeInfo.color} weight="duotone" />
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className={cn('text-4xl font-bold mb-2', gradeInfo.color)}>
                    {Math.round(percentage)}%
                  </h2>
                  <p className="text-lg font-medium mb-1">{gradeInfo.grade}</p>
                  <p className="text-muted-foreground">{gradeInfo.message}</p>
                </motion.div>

                <div className="flex justify-center gap-6 mt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{results.correctCount}</div>
                    <div className="text-xs text-muted-foreground">Richtig</div>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{results.incorrectCount}</div>
                    <div className="text-xs text-muted-foreground">Falsch</div>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{results.unansweredCount}</div>
                    <div className="text-xs text-muted-foreground">Offen</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Punkte</span>
                    <span className="font-medium">{results.totalScore} / {results.maxScore}</span>
                  </div>
                  <Progress value={percentage} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Topic Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChartPie size={18} />
                Themenanalyse
              </CardTitle>
              <CardDescription>
                Deine Stärken und Schwächen nach Themen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.topicAnalysis.map((topic) => (
                  <div key={topic.topic} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {topic.isWeak ? (
                          <TrendDown size={16} className="text-red-500" />
                        ) : (
                          <TrendUp size={16} className="text-green-600" />
                        )}
                        <span className="font-medium text-sm">{topic.topic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {topic.correct}/{topic.total}
                        </span>
                        <Badge
                          variant={topic.percentage >= 50 ? 'default' : 'destructive'}
                          className={topic.percentage >= 50 ? 'bg-green-600' : ''}
                        >
                          {Math.round(topic.percentage)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress
                      value={topic.percentage}
                      className={cn('h-2', topic.isWeak ? '[&>div]:bg-red-500' : '[&>div]:bg-green-600')}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recommendations */}
        {results.recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb size={18} className="text-yellow-500" />
                  Empfehlungen
                </CardTitle>
                <CardDescription>
                  Tipps für deine nächste Lernsession
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {results.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Target size={16} className="mt-0.5 text-primary shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>

                {results.weakTopics.length > 0 && (
                  <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
                    <p className="text-sm font-medium text-red-600 mb-2">Schwächen gezielt üben:</p>
                    <div className="flex flex-wrap gap-2">
                      {results.weakTopics.map((topic) => (
                        <Badge key={topic} variant="outline" className="border-red-500/30 text-red-600">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {results.strongTopics.length > 0 && (
                  <div className="mt-3 p-3 bg-green-500/10 rounded-lg">
                    <p className="text-sm font-medium text-green-600 mb-2">Deine Stärken:</p>
                    <div className="flex flex-wrap gap-2">
                      {results.strongTopics.map((topic) => (
                        <Badge key={topic} variant="outline" className="border-green-500/30 text-green-600">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Task Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen size={18} />
                Aufgabenübersicht
              </CardTitle>
              <CardDescription>
                Detaillierte Ergebnisse für jede Aufgabe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {results.taskResults.map((result, index) => {
                    const task = session.tasks.find((t) => t.id === result.taskId)
                    return (
                      <div
                        key={result.taskId}
                        className={cn(
                          'p-3 rounded-lg border',
                          result.isCorrect
                            ? 'bg-green-500/5 border-green-500/20'
                            : result.earnedPoints > 0
                            ? 'bg-yellow-500/5 border-yellow-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {getTaskResultIcon(result)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-sm">
                                Aufgabe {index + 1}
                                {task?.topic && ` · ${task.topic}`}
                              </span>
                              <Badge variant="outline" className="shrink-0">
                                {result.earnedPoints}/{result.maxPoints} P.
                              </Badge>
                            </div>
                            {result.feedback && (
                              <p className="text-sm text-muted-foreground">
                                {result.feedback}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Zurück zum Modul
          </Button>
          <Button onClick={onRetry} className="flex-1">
            Neue Prüfung starten
          </Button>
        </div>
      </div>
    </div>
  )
}
