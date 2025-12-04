import { useState } from 'react'
import { useDebugLogs } from '@/hooks/use-debug-mode'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { X, Trash, CaretDown, CaretRight, Bug } from '@phosphor-icons/react'
import { Badge } from './ui/badge'

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
                  Alle API-Anfragen und -Antworten
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearLogs}>
                <Trash size={16} className="mr-2" />
                Alle löschen
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          <ScrollArea className="h-full">
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
                                <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto border">
                                  {log.data.prompt}
                                </pre>
                              </div>
                            )}

                            {log.data.response && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                                  Antwort
                                </h4>
                                <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto border whitespace-pre-wrap">
                                  {log.data.response}
                                </pre>
                              </div>
                            )}

                            {log.data.error && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-destructive">
                                  Fehler
                                </h4>
                                <pre className="text-xs bg-destructive/5 p-3 rounded-md overflow-x-auto border border-destructive/20 text-destructive">
                                  {log.data.error}
                                </pre>
                              </div>
                            )}

                            {log.data.errorStack && (
                              <div>
                                <h4 className="text-xs font-semibold mb-2 uppercase text-destructive">
                                  Stack Trace
                                </h4>
                                <pre className="text-xs bg-destructive/5 p-3 rounded-md overflow-x-auto border border-destructive/20 text-destructive font-mono">
                                  {log.data.errorStack}
                                </pre>
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
        </div>
      </div>
    </div>
  )
}
