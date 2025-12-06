import { useState } from 'react'
import { useDebugLogs } from '@/hooks/use-debug-mode'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { X, Trash, CaretDown, CaretRight, Bug, Database } from '@phosphor-icons/react'
import { Badge } from './ui/badge'
import { StorageDebugPanel } from './StorageDebugPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export function DebugConsole({ onClose }: { onClose: () => void }) {
  const { logs, clearLogs } = useDebugLogs()
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  const toggleLog = (id: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0')
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'llm-request':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'llm-response':
        return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'llm-error':
        return 'bg-destructive/10 text-destructive border-destructive/20'
      case 'task-validation':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      case 'task-repair':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'llm-request':
        return 'Anfrage'
      case 'llm-response':
        return 'Antwort'
      case 'llm-error':
        return 'Fehler'
      case 'task-validation':
        return 'Validierung'
      case 'task-repair':
        return 'Reparatur'
      default:
        return type
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm">
      <div className="h-full flex flex-col">
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bug size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Debug Konsole</h2>
                <p className="text-sm text-muted-foreground">
                  API-Anfragen, Storage & Diagnostik
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="api" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b">
            <TabsList className="h-11">
              <TabsTrigger value="api" className="gap-2">
                <Bug size={16} />
                API-Logs
              </TabsTrigger>
              <TabsTrigger value="storage" className="gap-2">
                <Database size={16} />
                Storage
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="api" className="flex-1 overflow-hidden m-0 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  API: {import.meta.env.VITE_API_URL || 'http://localhost:3001'}
                </Badge>
                <Badge variant={import.meta.env.PROD ? "default" : "secondary"} className="text-xs">
                  {import.meta.env.PROD ? 'Production' : 'Development'}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                <Trash size={16} className="mr-2" />
                Logs löschen
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-40px)]">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Bug size={48} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Noch keine API-Aufrufe aufgezeichnet
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {logs.map((log) => {
                  const isExpanded = expandedLogs.has(log.id)
                  return (
                    <Card key={log.id} className="overflow-hidden">
                      <button
                        onClick={() => toggleLog(log.id)}
                        className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {isExpanded ? (
                              <CaretDown size={16} weight="bold" />
                            ) : (
                              <CaretRight size={16} weight="bold" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className={getTypeColor(log.type)}
                              >
                                {getTypeLabel(log.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatTimestamp(log.timestamp)}
                              </span>
                              {log.data.model && (
                                <Badge variant="secondary" className="text-xs">
                                  {log.data.model}
                                </Badge>
                              )}
                              {log.data.jsonMode && (
                                <Badge variant="secondary" className="text-xs">
                                  JSON
                                </Badge>
                              )}
                              {log.data.attempt && (
                                <Badge variant="outline" className="text-xs">
                                  Versuch {log.data.attempt}/{log.data.maxRetries}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm">
                              {log.type === 'llm-request' && (
                                <p className="text-muted-foreground line-clamp-2">
                                  {log.data.prompt}
                                </p>
                              )}
                              {log.type === 'llm-response' && (
                                <p className="text-muted-foreground line-clamp-2">
                                  {log.data.response}
                                </p>
                              )}
                              {log.type === 'llm-error' && (
                                <p className="text-destructive font-medium">
                                  {log.data.error}
                                </p>
                              )}
                              {log.type === 'task-validation' && log.data.validationResult && (
                                <p className={log.data.validationResult.ok ? 'text-green-600' : 'text-orange-600'}>
                                  {log.data.validationResult.ok ? '✓ Aufgabe ist gültig' : `✗ ${log.data.issues?.length || 0} Problem(e) gefunden`}
                                  {log.data.validationResult.confidence !== undefined && 
                                    ` (${Math.round(log.data.validationResult.confidence * 100)}% Konfidenz)`}
                                </p>
                              )}
                              {log.type === 'task-repair' && (
                                <p className="text-orange-600">
                                  🔧 Reparaturversuch {log.data.totalAttempts || 1}
                                  {log.data.validationResult?.ok ? ' - Erfolgreich' : ' - Fehlgeschlagen'}
                                </p>
                              )}
                              {log.type === 'validation-pipeline' && (
                                <p className={log.data.validationResult?.ok !== false ? 'text-green-600' : 'text-destructive'}>
                                  {log.data.wasRepaired && '🔧 Repariert'}
                                  {log.data.wasRegenerated && '🔄 Neu generiert'}
                                  {!log.data.wasRepaired && !log.data.wasRegenerated && '✓ Direkt gültig'}
                                  {log.data.totalAttempts !== undefined && ` (${log.data.totalAttempts} Versuch${log.data.totalAttempts !== 1 ? 'e' : ''})`}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <>
                          <Separator />
                          <div className="p-4 bg-muted/30 space-y-4">
                            {log.data.prompt && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                                  Prompt
                                </h4>
                                <div className="text-xs bg-background p-3 rounded-md border max-w-full overflow-hidden">
                                  <pre className="whitespace-pre-wrap break-words font-mono">
                                    {log.data.prompt}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {log.data.response && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                                  Antwort
                                </h4>
                                <div className="text-xs bg-background p-3 rounded-md border max-w-full overflow-hidden">
                                  <pre className="whitespace-pre-wrap break-words font-mono">
                                    {log.data.response}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {log.data.error && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-destructive">
                                  Fehler
                                </h4>
                                <div className="text-xs bg-destructive/5 p-3 rounded-md border border-destructive/20 text-destructive max-w-full overflow-hidden">
                                  <pre className="whitespace-pre-wrap break-words font-mono">
                                    {log.data.error}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {log.data.errorStack && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-destructive">
                                  Stack Trace
                                </h4>
                                <div className="text-xs bg-destructive/5 p-3 rounded-md border border-destructive/20 text-destructive max-w-full overflow-hidden">
                                  <pre className="whitespace-pre-wrap break-words font-mono">
                                    {log.data.errorStack}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Validation-specific fields */}
                            {log.data.taskQuestion && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                                  Aufgabe
                                </h4>
                                <div className="text-xs bg-background p-3 rounded-md border max-w-full overflow-hidden">
                                  <pre className="whitespace-pre-wrap break-words font-mono">
                                    {log.data.taskQuestion}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {log.data.validationResult && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                                  Validierungsergebnis
                                </h4>
                                <div className={`text-xs p-3 rounded-md border max-w-full overflow-hidden ${
                                  log.data.validationResult.ok 
                                    ? 'bg-green-500/10 border-green-500/30' 
                                    : 'bg-destructive/10 border-destructive/30'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`font-semibold ${log.data.validationResult.ok ? 'text-green-600' : 'text-destructive'}`}>
                                      {log.data.validationResult.ok ? '✓ Gültig' : '✗ Ungültig'}
                                    </span>
                                    {log.data.validationResult.confidence !== undefined && (
                                      <span className="text-muted-foreground">
                                        (Konfidenz: {Math.round(log.data.validationResult.confidence * 100)}%)
                                      </span>
                                    )}
                                  </div>
                                  <pre className="whitespace-pre-wrap break-words font-mono text-foreground/80">
                                    {JSON.stringify(log.data.validationResult, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {log.data.issues && log.data.issues.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-orange-600">
                                  Probleme ({log.data.issues.length})
                                </h4>
                                <ul className="text-xs bg-orange-500/10 p-3 rounded-md border border-orange-500/30 space-y-1">
                                  {log.data.issues.map((issue: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-orange-600">•</span>
                                      <span>{issue}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {(log.data.wasRepaired !== undefined || log.data.wasRegenerated !== undefined) && (
                              <div className="flex flex-wrap gap-2">
                                {log.data.wasRepaired && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-600 border border-orange-500/30">
                                    🔧 Repariert
                                  </span>
                                )}
                                {log.data.wasRegenerated && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-600 border border-blue-500/30">
                                    🔄 Neu generiert
                                  </span>
                                )}
                                {log.data.totalAttempts !== undefined && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground border">
                                    Versuche: {log.data.totalAttempts}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </ScrollArea>
          </TabsContent>

          <TabsContent value="storage" className="flex-1 overflow-hidden m-0 px-6 py-4">
            <ScrollArea className="h-full">
              <StorageDebugPanel />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
