import { useEffect, useMemo, useState } from 'react'
import { useDebugLogs, useDebugMode } from '@/hooks/use-debug-mode'
import { devToolsStore, type ApiLogEntry } from '@/lib/devtools-store'
import { ModelSelector } from './ModelSelector'
import { StorageDebugPanel } from './StorageDebugPanel'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Separator } from './ui/separator'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import {
  Bug,
  Copy,
  Database,
  Lightning,
  ListBullets,
  Receipt,
  Stopwatch,
  Trash,
  Warning,
  X,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { BugReportDrawer } from './BugReportDrawer'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type DebugConsoleProps = {
  open: boolean
  onClose: () => void
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${String(
    date.getMilliseconds()
  ).padStart(3, '0')}`
}

const prettyJson = (value: any) => JSON.stringify(value, null, 2)

function extractTokens(log?: ApiLogEntry) {
  if (!log?.llm?.usage) return { input: 0, output: 0, cached: 0 }
  const usage = log.llm.usage
  const input = usage.inputTokens ?? usage.prompt_tokens ?? usage.input_tokens ?? 0
  const output = usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens ?? 0
  const cached = usage.cachedInputTokens ?? usage.cache_read_input_tokens ?? usage.input_tokens_details?.cached_tokens ?? 0
  return { input, output, cached }
}

export function DebugConsole({ open, onClose }: DebugConsoleProps) {
  const { logs, meta, clearLogs } = useDebugLogs()
  const { debugLogging, setEnabled } = useDebugMode()
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'api' | 'storage'>('api')
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [bugLogId, setBugLogId] = useState<string | undefined>(undefined)
  const [bugDrawerOpen, setBugDrawerOpen] = useState(false)

  const selectedLog = useMemo(() => {
    if (!logs.length) return undefined
    if (selectedLogId) return logs.find((l) => l.id === selectedLogId) || logs[0]
    return logs[0]
  }, [logs, selectedLogId])

  useEffect(() => {
    if (!open) return
    const loadMeta = async () => {
      if (loadingMeta) return
      setLoadingMeta(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/meta`)
        if (res.ok) {
          const data = await res.json()
          devToolsStore.setMeta(data)
        }
      } catch (e) {
        console.warn('Failed to load /api/meta', e)
      } finally {
        setLoadingMeta(false)
      }
    }
    if (!meta) {
      loadMeta()
    }
  }, [open, meta, loadingMeta])

  useEffect(() => {
    if (!logs.length) {
      setSelectedLogId(null)
      return
    }
    if (!selectedLogId) {
      setSelectedLogId(logs[0].id)
    }
  }, [logs, selectedLogId])

  const stats = useMemo(() => {
    let totalTokens = 0
    let totalCost = 0
    let errors = 0
    logs.forEach((log) => {
      const { input, output } = extractTokens(log)
      totalTokens += input + output
      totalCost += log.llm?.cost?.estimatedUsd || 0
      if (log.error || (log.response && log.response.status >= 400)) errors += 1
    })
    return {
      requests: logs.length,
      errors,
      tokens: totalTokens,
      cost: totalCost,
    }
  }, [logs])

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} kopiert`)
    } catch {
      toast.error('Konnte nicht kopieren')
    }
  }

  const renderInspector = () => {
    if (!selectedLog) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Kein Log ausgewählt
        </div>
      )
    }

    const tokens = extractTokens(selectedLog)

    return (
      <Card className="h-full overflow-hidden border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <div className="text-sm text-muted-foreground">{formatTimestamp(selectedLog.startedAt)}</div>
            <div className="text-base font-semibold">
              {selectedLog.llm?.operation || 'Unbekannte Operation'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setBugLogId(selectedLog.id)
                setBugDrawerOpen(true)
              }}
            >
              <Bug className="mr-2" size={16} />
              Bug Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(prettyJson(selectedLog), 'Log kopiert')}
            >
              <Copy size={14} className="mr-1.5" />
              Full Log
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="h-[calc(100%-56px)] flex flex-col">
          <TabsList className="h-11 rounded-none border-b px-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-auto p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium">
                  {selectedLog.response
                    ? selectedLog.response.status >= 400
                      ? `Error ${selectedLog.response.status}`
                      : `OK ${selectedLog.response.status}`
                    : selectedLog.error
                      ? 'Error'
                      : 'Unbekannt'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Dauer</div>
                <div className="font-medium">{Math.round(selectedLog.durationMs)} ms</div>
              </div>
              <div>
                <div className="text-muted-foreground">Model</div>
                <div className="font-medium">{selectedLog.llm?.model || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Normalized</div>
                <div className="font-medium">{selectedLog.llm?.normalizedModel || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tokens (in/out/cached)</div>
                <div className="font-medium">
                  {tokens.input} / {tokens.output} / {tokens.cached}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Estimated Cost (USD)</div>
                <div className="font-medium">
                  {selectedLog.llm?.cost?.estimatedUsd !== undefined
                    ? `$${selectedLog.llm.cost.estimatedUsd.toFixed(6)}`
                    : 'Unknown pricing'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Schätzung. Tatsächliche Kosten können abweichen.
                </div>
              </div>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              pricingModel: {selectedLog.llm?.cost?.pricingModelKey || 'unknown'}
            </div>
          </TabsContent>

          <TabsContent value="request" className="flex-1 overflow-auto p-4 space-y-3">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(prettyJson(selectedLog.request.body || {}), 'Request JSON')}
              >
                <Copy size={14} className="mr-1.5" />
                Copy Request JSON
              </Button>
              {selectedLog.request.body?.prompt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(selectedLog.request.body.prompt, 'Prompt')}
                >
                  <Copy size={14} className="mr-1.5" />
                  Copy Prompt Text
                </Button>
              )}
            </div>
            <pre className="bg-muted/60 border rounded-md p-3 text-xs whitespace-pre-wrap break-words">
              {prettyJson(selectedLog.request.body || {})}
            </pre>
          </TabsContent>

          <TabsContent value="response" className="flex-1 overflow-auto p-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(prettyJson(selectedLog.response?.body || {}), 'Response JSON')}
              >
                <Copy size={14} className="mr-1.5" />
                Copy Response JSON
              </Button>
              {selectedLog.response?.textPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(selectedLog.response?.textPreview, 'Output Text')}
                >
                  <Copy size={14} className="mr-1.5" />
                  Copy Output Text
                </Button>
              )}
            </div>
            <pre className="bg-muted/60 border rounded-md p-3 text-xs whitespace-pre-wrap break-words">
              {prettyJson(selectedLog.response?.body || {})}
            </pre>
          </TabsContent>

          <TabsContent value="raw" className="flex-1 overflow-auto p-4 space-y-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(prettyJson(selectedLog), 'Full Log')}
            >
              <Copy size={14} className="mr-1.5" />
              Copy Full Log
            </Button>
            <pre className="bg-muted/60 border rounded-md p-3 text-xs whitespace-pre-wrap break-words">
              {prettyJson(selectedLog)}
            </pre>
          </TabsContent>
        </Tabs>
      </Card>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[9999]">
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
        <div className="absolute left-0 right-0 bottom-0 transition-transform duration-300 translate-y-0">
          <div className="mx-auto max-w-7xl px-3 pb-3">
            <div className="bg-card border rounded-t-2xl shadow-xl h-[65vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between p-4 border-b">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bug size={16} className="text-primary" />
                    Dev Tools
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <Badge variant="outline">API: {API_BASE_URL}</Badge>
                    <Badge variant="outline">
                      Backend: {meta?.baseUrl || (loadingMeta ? 'lädt...' : 'unbekannt')}
                    </Badge>
                    <Badge variant="secondary">
                      Env: {meta?.env || (import.meta.env.PROD ? 'production' : 'development')}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X size={18} />
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 flex-1 overflow-hidden">
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'api' | 'storage')} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between pr-2">
                      <TabsList className="h-10">
                        <TabsTrigger value="api" className="gap-2">
                          <ListBullets size={16} />
                          API Logs
                        </TabsTrigger>
                        <TabsTrigger value="storage" className="gap-2">
                          <Database size={16} />
                          Storage
                        </TabsTrigger>
                      </TabsList>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                          <Switch
                            id="debug-logging"
                            checked={debugLogging}
                            onCheckedChange={(checked) => setEnabled(checked)}
                          />
                          <Label htmlFor="debug-logging" className="text-sm cursor-pointer">
                            Debug-Logging
                          </Label>
                        </div>
                        <Button variant="outline" size="sm" onClick={clearLogs}>
                          <Trash size={14} className="mr-1.5" />
                          Logs löschen
                        </Button>
                      </div>
                    </div>

                    <TabsContent value="api" className="flex-1 flex flex-col overflow-hidden pt-3">
                      {logs.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          Keine Logs vorhanden
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-3 h-full">
                          <Card className="h-full overflow-hidden border">
                            <div className="flex items-center justify-between px-4 py-3 border-b">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Lightning size={16} />
                                {logs.length} Requests
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Stopwatch size={14} />
                                Aktuell
                              </div>
                            </div>
                            <ScrollArea className="h-[calc(100%-48px)]">
                              <div className="divide-y">
                                {logs.map((log) => {
                                  const tokens = extractTokens(log)
                                  const isError = !!log.error || (log.response && log.response.status >= 400)
                                  const isActive = selectedLog?.id === log.id
                                  return (
                                    <button
                                      key={log.id}
                                      onClick={() => setSelectedLogId(log.id)}
                                      className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition ${
                                        isActive ? 'bg-muted/70' : ''
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${isError ? 'border-destructive/40 text-destructive' : 'border-green-500/40 text-green-700'}`}>
                                              {isError ? 'Error' : 'Success'}
                                            </span>
                                            <span>{formatTimestamp(log.startedAt)}</span>
                                            <span>{Math.round(log.durationMs)} ms</span>
                                          </div>
                                          <div className="text-sm font-medium">
                                            {log.llm?.operation || 'Unbekannte Operation'}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {log.llm?.model} {log.llm?.jsonMode ? '(JSON)' : ''}
                                          </div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                          <div>
                                            {tokens.input + tokens.output} tok
                                          </div>
                                          <div>
                                            {log.llm?.cost?.estimatedUsd !== undefined
                                              ? `$${log.llm.cost.estimatedUsd.toFixed(4)}`
                                              : 'n/a'}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          </Card>
                          <div className="h-full overflow-hidden">{renderInspector()}</div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="storage" className="flex-1 overflow-hidden pt-3">
                      <Card className="h-full overflow-hidden border">
                        <ScrollArea className="h-full">
                          <StorageDebugPanel />
                        </ScrollArea>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-4 overflow-auto pr-1">
                  <Card className="border">
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Receipt size={16} />
                        LLM Modelle
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Standard- und Vision-Modell konfigurieren
                      </p>
                    </div>
                    <div className="p-4">
                      <ModelSelector />
                    </div>
                  </Card>

                  <Card className="border">
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Stopwatch size={16} />
                        Session Stats
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Requests</div>
                        <div className="font-semibold">{stats.requests}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Errors</div>
                        <div className="font-semibold">{stats.errors}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tokens</div>
                        <div className="font-semibold">{stats.tokens}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Estimated Cost</div>
                        <div className="font-semibold">
                          ${stats.cost.toFixed(6)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Estimate</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="border">
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Warning size={16} />
                        Hinweise
                      </div>
                    </div>
                    <div className="p-4 text-xs text-muted-foreground space-y-2">
                      <p>Prompts und Antworten werden lokal gespeichert (max. 200 Einträge).</p>
                      <p>Kosten sind Schätzungen basierend auf Pricing-Table; echte Abrechnung kann abweichen.</p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BugReportDrawer
        open={bugDrawerOpen}
        onOpenChange={setBugDrawerOpen}
        focusLogId={bugLogId}
      />
    </>
  )
}
