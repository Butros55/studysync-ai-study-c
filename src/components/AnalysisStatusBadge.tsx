/**
 * AnalysisStatusBadge Component
 * 
 * Shows the analysis status of a document with visual indicators:
 * - missing: grey dot
 * - queued/running: spinner
 * - done: green check + coverage percent
 * - error: red warning with tooltip
 * 
 * In debug mode, clicking the badge opens a modal with the full analysis JSON.
 */

import { useState, useEffect } from 'react'
import { 
  CircleNotch, 
  Check, 
  Warning, 
  Circle,
  X,
  Copy,
  CheckCircle
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useDebugMode } from '@/hooks/use-debug-mode'
import { getDocumentAnalysis } from '@/lib/analysis-storage'
import type { DocumentAnalysisRecord, AnalysisStatus } from '@/lib/analysis-types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface AnalysisStatusBadgeProps {
  moduleId: string
  documentId: string
  /** Optional: pre-fetched analysis record to avoid re-fetching */
  analysisRecord?: DocumentAnalysisRecord | null
  /** Size variant */
  size?: 'sm' | 'md'
  /** Show coverage percentage for 'done' status */
  showCoverage?: boolean
  /** Class name for additional styling */
  className?: string
}

export function AnalysisStatusBadge({
  moduleId,
  documentId,
  analysisRecord: propRecord,
  size = 'sm',
  showCoverage = true,
  className,
}: AnalysisStatusBadgeProps) {
  const { enabled: debugMode } = useDebugMode()
  const [record, setRecord] = useState<DocumentAnalysisRecord | null>(propRecord ?? null)
  const [loading, setLoading] = useState(!propRecord)
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch analysis record if not provided
  useEffect(() => {
    if (propRecord !== undefined) {
      setRecord(propRecord)
      setLoading(false)
      return
    }

    let mounted = true
    const fetchRecord = async () => {
      try {
        const result = await getDocumentAnalysis(moduleId, documentId)
        if (mounted) {
          setRecord(result)
          setLoading(false)
        }
      } catch (e) {
        console.warn('[AnalysisStatusBadge] Failed to fetch analysis:', e)
        if (mounted) {
          setLoading(false)
        }
      }
    }
    fetchRecord()

    return () => { mounted = false }
  }, [moduleId, documentId, propRecord])

  // Determine status
  const status: AnalysisStatus = record?.status ?? 'missing'
  const coverage = record?.coveragePercent ?? 0
  const errorMessage = record?.errorMessage

  // Icon size based on size prop
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  // Handle badge click (only in debug mode)
  const handleClick = (e: React.MouseEvent) => {
    if (debugMode && status !== 'missing') {
      e.stopPropagation()
      setModalOpen(true)
    }
  }

  // Copy JSON to clipboard
  const handleCopyJson = async () => {
    if (!record?.analysisJson) return
    
    try {
      const formatted = JSON.stringify(JSON.parse(record.analysisJson), null, 2)
      await navigator.clipboard.writeText(formatted)
      setCopied(true)
      toast.success('JSON in Zwischenablage kopiert')
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      toast.error('Fehler beim Kopieren')
    }
  }

  // Render the badge based on status
  const renderBadge = () => {
    if (loading) {
      return (
        <span className={cn('inline-flex items-center text-muted-foreground', className)}>
          <Circle className={cn(iconSize, 'animate-pulse')} weight="fill" />
        </span>
      )
    }

    switch (status) {
      case 'missing':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex items-center text-muted-foreground/50', className)}>
                  <Circle className={iconSize} weight="fill" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Nicht analysiert</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )

      case 'queued':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex items-center text-blue-500', className)}>
                  <CircleNotch className={cn(iconSize, 'animate-spin')} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>In Warteschlange</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )

      case 'running':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex items-center text-blue-500', className)}>
                  <CircleNotch className={cn(iconSize, 'animate-spin')} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Wird analysiert...</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )

      case 'done':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span 
                  className={cn(
                    'inline-flex items-center gap-1 text-green-600',
                    debugMode && 'cursor-pointer hover:opacity-80',
                    className
                  )}
                  onClick={handleClick}
                >
                  <Check className={iconSize} weight="bold" />
                  {showCoverage && coverage > 0 && (
                    <span className="text-xs font-medium">{coverage}%</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Analyse abgeschlossen ({coverage}% Abdeckung)</p>
                {debugMode && <p className="text-xs text-muted-foreground">Klicken für Details</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )

      case 'error':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span 
                  className={cn(
                    'inline-flex items-center text-destructive',
                    debugMode && 'cursor-pointer hover:opacity-80',
                    className
                  )}
                  onClick={handleClick}
                >
                  <Warning className={iconSize} weight="bold" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium">Analyse fehlgeschlagen</p>
                {errorMessage && (
                  <p className="text-xs text-muted-foreground mt-1 break-words">
                    {errorMessage.slice(0, 200)}
                    {errorMessage.length > 200 && '...'}
                  </p>
                )}
                {debugMode && <p className="text-xs text-muted-foreground mt-1">Klicken für Details</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )

      default:
        return null
    }
  }

  // Parse and format analysis JSON
  const getFormattedJson = () => {
    if (!record?.analysisJson) return 'Keine Analyse-Daten verfügbar'
    try {
      return JSON.stringify(JSON.parse(record.analysisJson), null, 2)
    } catch {
      return record.analysisJson
    }
  }

  return (
    <>
      {renderBadge()}

      {/* Debug Modal */}
      {debugMode && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Dokument-Analyse Details
                <Badge variant={status === 'done' ? 'default' : 'destructive'}>
                  {status === 'done' ? 'Erfolgreich' : 'Fehler'}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Document ID:</span>
                  <p className="font-mono text-xs break-all">{record?.documentId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Module ID:</span>
                  <p className="font-mono text-xs break-all">{record?.moduleId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Source Hash:</span>
                  <p className="font-mono text-xs break-all">{record?.sourceHash?.slice(0, 16)}...</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Version:</span>
                  <p className="font-mono text-xs">{record?.analysisVersion}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Zuletzt analysiert:</span>
                  <p className="font-mono text-xs">
                    {record?.lastAnalyzedAt 
                      ? new Date(record.lastAnalyzedAt).toLocaleString('de-DE')
                      : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Abdeckung:</span>
                  <p className="font-mono text-xs">{record?.coveragePercent ?? 0}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Chunks:</span>
                  <p className="font-mono text-xs">
                    {record?.processedChunkCount ?? 0} / {record?.chunkCount ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Document Type:</span>
                  <p className="font-mono text-xs">{record?.documentType}</p>
                </div>
              </div>

              {/* Error message if present */}
              {record?.errorMessage && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Fehler:</p>
                  <p className="text-xs text-destructive/80 mt-1 break-words">
                    {record.errorMessage}
                  </p>
                </div>
              )}

              {/* JSON Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Analyse JSON:</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyJson}
                    disabled={!record?.analysisJson}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Kopiert
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-[300px] rounded-lg border bg-muted/30">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                    {getFormattedJson()}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
