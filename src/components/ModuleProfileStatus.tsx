/**
 * ModuleProfileStatus Component
 * 
 * Shows the status of module-level profiles at the top of the Files area:
 * - ExamStyle profile status
 * - ExerciseStyle profile status  
 * - KnowledgeIndex status
 * - Overall coverage percentage
 * 
 * In debug mode, clicking a profile opens a modal with the full JSON.
 */

import { useState, useEffect } from 'react'
import { 
  CircleNotch, 
  Check, 
  Warning, 
  Circle,
  Copy,
  CheckCircle,
  Exam,
  ClipboardText,
  BookOpen,
  ChartPie
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useDebugMode } from '@/hooks/use-debug-mode'
import { getModuleProfile } from '@/lib/analysis-storage'
import { 
  getOrBuildModuleProfiles,
  parseExamStyleProfile,
  parseExerciseStyleProfile,
  parseModuleKnowledgeIndex,
  type ExamStyleProfile,
  type ExerciseStyleProfile,
  type ModuleKnowledgeIndex
} from '@/lib/module-profile-builder'
import type { ModuleProfileRecord, AnalysisStatus } from '@/lib/analysis-types'
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
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface ModuleProfileStatusProps {
  moduleId: string
  /** Class name for additional styling */
  className?: string
}

interface ProfileItemProps {
  label: string
  icon: React.ElementType
  status: AnalysisStatus | 'empty'
  itemCount?: number
  jsonContent?: string
  debugMode: boolean
  onOpenModal: (title: string, json: string) => void
}

function ProfileItem({ 
  label, 
  icon: Icon, 
  status, 
  itemCount, 
  jsonContent,
  debugMode,
  onOpenModal 
}: ProfileItemProps) {
  const handleClick = () => {
    if (debugMode && jsonContent) {
      onOpenModal(label, jsonContent)
    }
  }

  const getStatusIndicator = () => {
    switch (status) {
      case 'missing':
      case 'empty':
        return <Circle className="w-3 h-3 text-muted-foreground/50" weight="fill" />
      case 'queued':
      case 'running':
        return <CircleNotch className="w-3 h-3 text-blue-500 animate-spin" />
      case 'done':
        return <Check className="w-3 h-3 text-green-600" weight="bold" />
      case 'error':
        return <Warning className="w-3 h-3 text-destructive" weight="bold" />
      default:
        return null
    }
  }

  const getStatusTooltip = () => {
    switch (status) {
      case 'missing':
        return 'Nicht verfügbar'
      case 'empty':
        return 'Keine Daten (0 Dokumente)'
      case 'queued':
        return 'In Warteschlange'
      case 'running':
        return 'Wird erstellt...'
      case 'done':
        return itemCount !== undefined 
          ? `Fertig (${itemCount} Einträge)` 
          : 'Fertig'
      case 'error':
        return 'Fehler beim Erstellen'
      default:
        return ''
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm',
              debugMode && status === 'done' && 'cursor-pointer hover:bg-muted'
            )}
            onClick={handleClick}
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{label}</span>
            {getStatusIndicator()}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getStatusTooltip()}</p>
          {debugMode && status === 'done' && (
            <p className="text-xs text-muted-foreground">Klicken für Details</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function ModuleProfileStatus({ moduleId, className }: ModuleProfileStatusProps) {
  const { enabled: debugMode } = useDebugMode()
  const [profile, setProfile] = useState<ModuleProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalJson, setModalJson] = useState('')
  const [copied, setCopied] = useState(false)

  // Fetch profile on mount
  useEffect(() => {
    let mounted = true

    const fetchProfile = async () => {
      try {
        const result = await getModuleProfile(moduleId)
        if (mounted) {
          setProfile(result)
          setLoading(false)
        }
      } catch (e) {
        console.warn('[ModuleProfileStatus] Failed to fetch profile:', e)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchProfile()
    return () => { mounted = false }
  }, [moduleId])

  // Parse profiles
  const examProfile = profile ? parseExamStyleProfile(profile) : null
  const exerciseProfile = profile ? parseExerciseStyleProfile(profile) : null
  const knowledgeIndex = profile ? parseModuleKnowledgeIndex(profile) : null

  // Determine statuses
  const overallStatus: AnalysisStatus = profile?.status ?? 'missing'
  const coveragePercent = profile?.coveragePercent ?? 0

  const getProfileStatus = (profileData: unknown, docCount?: number): AnalysisStatus | 'empty' => {
    if (loading) return 'running'
    if (!profile) return 'missing'
    if (profile.status === 'error') return 'error'
    if (docCount === 0) return 'empty'
    if (!profileData) return 'empty'
    return 'done'
  }

  // Get item counts for display
  const examItemCount = examProfile?.commonPhrases?.length ?? 0
  const exerciseItemCount = exerciseProfile?.commonVerbs?.length ?? 0
  const knowledgeItemCount = knowledgeIndex?.allTopics?.length ?? 0

  // Get source document counts (from the profile structure)
  const examDocCount = examProfile?.sourceDocumentCount ?? 0
  const exerciseDocCount = exerciseProfile?.sourceDocumentCount ?? 0
  const scriptDocCount = knowledgeIndex?.sourceDocumentCount ?? 0

  // Open modal with JSON
  const handleOpenModal = (title: string, json: string) => {
    setModalTitle(title)
    setModalJson(json)
    setModalOpen(true)
  }

  // Copy JSON
  const handleCopyJson = async () => {
    try {
      const formatted = JSON.stringify(JSON.parse(modalJson), null, 2)
      await navigator.clipboard.writeText(formatted)
      setCopied(true)
      toast.success('JSON in Zwischenablage kopiert')
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      toast.error('Fehler beim Kopieren')
    }
  }

  // Format JSON for display
  const formatJson = (json: string) => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2)
    } catch {
      return json
    }
  }

  if (loading) {
    return (
      <Card className={cn('mb-4', className)}>
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch className="w-4 h-4 animate-spin" />
            <span>Module Profile werden geladen...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={cn('mb-4', className)}>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Profile Status Items */}
            <ProfileItem
              label="Klausur-Stil"
              icon={Exam}
              status={getProfileStatus(examProfile, examDocCount)}
              itemCount={examItemCount}
              jsonContent={profile?.examStyleProfileJson}
              debugMode={debugMode}
              onOpenModal={handleOpenModal}
            />
            <ProfileItem
              label="Übungs-Stil"
              icon={ClipboardText}
              status={getProfileStatus(exerciseProfile, exerciseDocCount)}
              itemCount={exerciseItemCount}
              jsonContent={profile?.exerciseStyleProfileJson}
              debugMode={debugMode}
              onOpenModal={handleOpenModal}
            />
            <ProfileItem
              label="Wissens-Index"
              icon={BookOpen}
              status={getProfileStatus(knowledgeIndex, scriptDocCount)}
              itemCount={knowledgeItemCount}
              jsonContent={profile?.moduleKnowledgeIndexJson}
              debugMode={debugMode}
              onOpenModal={handleOpenModal}
            />

            {/* Overall Coverage */}
            <div className="flex-1" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <ChartPie className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Abdeckung:</span>
                    <div className="w-20">
                      <Progress value={coveragePercent} className="h-2" />
                    </div>
                    <span className="text-sm font-medium">{coveragePercent}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Gewichtete Analyse-Abdeckung</p>
                  <p className="text-xs text-muted-foreground">
                    Skripte: {scriptDocCount} | Übungen: {exerciseDocCount} | Klausuren: {examDocCount}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Debug Modal */}
      {debugMode && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {modalTitle} Profil
                <Badge variant="default">JSON</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Metadata */}
              {profile && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Module ID:</span>
                    <p className="font-mono text-xs break-all">{profile.moduleId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hash Aggregate:</span>
                    <p className="font-mono text-xs break-all">{profile.sourceHashAggregate?.slice(0, 16)}...</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <p className="font-mono text-xs">{profile.profileVersion}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zuletzt erstellt:</span>
                    <p className="font-mono text-xs">
                      {profile.lastBuiltAt 
                        ? new Date(profile.lastBuiltAt).toLocaleString('de-DE')
                        : '-'}
                    </p>
                  </div>
                </div>
              )}

              {/* JSON Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Profil JSON:</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyJson}
                    disabled={!modalJson}
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
                <ScrollArea className="h-[350px] rounded-lg border bg-muted/30">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                    {formatJson(modalJson)}
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
