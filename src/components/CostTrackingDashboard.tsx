import { useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { TokenUsage } from '../lib/types'
import {
  generateCostSummary,
  formatCost,
  formatTokens,
  getOperationLabel,
  getModelDisplayName,
} from '../lib/cost-tracker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { Progress } from './ui/progress'
import { ScrollArea } from './ui/scroll-area'
import {
  ArrowLeft,
  CurrencyDollar,
  Lightning,
  ChartBar,
  Trash,
  CalendarBlank,
  Clock,
} from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from './ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog'

interface CostTrackingDashboardProps {
  onBack: () => void
}

export function CostTrackingDashboard({ onBack }: CostTrackingDashboardProps) {
  const [usageRecords] = useKV<TokenUsage[]>('token-usage', [])
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')

  const filteredRecords = (usageRecords || []).filter((record) => {
    const recordDate = new Date(record.timestamp)
    const now = new Date()

    switch (timeFilter) {
      case 'today':
        return recordDate.toDateString() === now.toDateString()
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return recordDate >= weekAgo
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return recordDate >= monthAgo
      default:
        return true
    }
  })

  const summary = generateCostSummary(filteredRecords)

  const handleClearHistory = async () => {
    await spark.kv.delete('token-usage')
  }

  const getTopModel = () => {
    const entries = Object.entries(summary.costByModel)
    if (entries.length === 0) return null
    return entries.reduce((a, b) => (a[1] > b[1] ? a : b))
  }

  const getTopOperation = () => {
    const entries = Object.entries(summary.costByOperation)
    if (entries.length === 0) return null
    return entries.reduce((a, b) => (a[1] > b[1] ? a : b))
  }

  const topModel = getTopModel()
  const topOperation = getTopOperation()

  const avgCostPerRequest = summary.totalRequests > 0 ? summary.totalCost / summary.totalRequests : 0
  const avgTokensPerRequest = summary.totalRequests > 0 ? summary.totalTokens / summary.totalRequests : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft size={18} className="mr-2" />
              Zurück
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Kostenübersicht
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                OpenAI Token-Nutzung und Ausgaben
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-safe">
        {filteredRecords.length === 0 ? (
          <Alert>
            <Lightning className="h-4 w-4" />
            <AlertTitle>Noch keine Daten</AlertTitle>
            <AlertDescription>
              Es wurden noch keine API-Anfragen getrackt. Nutze die App, um Notizen, Aufgaben oder
              Karteikarten zu generieren.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={timeFilter === filter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeFilter(filter)}
                  >
                    {filter === 'all' && 'Gesamt'}
                    {filter === 'today' && 'Heute'}
                    {filter === 'week' && '7 Tage'}
                    {filter === 'month' && '30 Tage'}
                  </Button>
                ))}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash size={16} className="mr-2" />
                    Verlauf löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Verlauf wirklich löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden. Alle Nutzungsdaten werden
                      dauerhaft gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearHistory}>Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <CurrencyDollar size={16} />
                    Gesamtkosten
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCost(summary.totalCost)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ø {formatCost(avgCostPerRequest)} pro Anfrage
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Lightning size={16} />
                    Token gesamt
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatTokens(summary.totalTokens)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ø {formatTokens(Math.round(avgTokensPerRequest))} pro Anfrage
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <ChartBar size={16} />
                    Anfragen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalRequests}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Object.keys(summary.requestsByModel).length} Modell(e)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <CalendarBlank size={16} />
                    Häufigstes Modell
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold truncate">
                    {topModel ? getModelDisplayName(topModel[0]) : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {topModel ? `${formatCost(topModel[1])} gesamt` : 'Keine Daten'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Kosten nach Modell</CardTitle>
                  <CardDescription>Verteilung der Ausgaben pro KI-Modell</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(summary.costByModel)
                      .sort((a, b) => b[1] - a[1])
                      .map(([model, cost]) => {
                        const percentage = (cost / summary.totalCost) * 100
                        return (
                          <div key={model}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {getModelDisplayName(model)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatCost(cost)} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kosten nach Vorgang</CardTitle>
                  <CardDescription>Verteilung nach Funktionstyp</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(summary.costByOperation)
                      .sort((a, b) => b[1] - a[1])
                      .map(([operation, cost]) => {
                        const percentage = (cost / summary.totalCost) * 100
                        return (
                          <div key={operation}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {getOperationLabel(operation)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatCost(cost)} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Letzte Anfragen</CardTitle>
                <CardDescription>
                  Chronologische Übersicht der letzten 50 API-Aufrufe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {summary.recentUsage.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-card/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {getOperationLabel(record.operation)}
                            </span>
                            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                              {getModelDisplayName(record.model)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(record.timestamp).toLocaleString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>{formatTokens(record.totalTokens)} Token</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatCost(record.cost)}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.promptTokens}↑ {record.completionTokens}↓
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
