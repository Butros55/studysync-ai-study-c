import { useState, useRef, useEffect, useCallback } from 'react'
import { Script, FileCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Upload,
  File,
  FileText,
  Image,
  DotsThreeVertical,
  Trash,
  Eye,
  CaretDown,
  CaretRight,
  BookOpen,
  ClipboardText,
  CheckSquare,
  Exam,
  Sparkle,
  Plus,
  FolderOpen,
  X,
  CheckSquareOffset,
  MagnifyingGlass,
  ArrowsClockwise,
  Note,
  ListChecks,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ScriptPreviewDialog } from './ScriptPreviewDialog'
import { isValidFileType, getFileExtension, parseFile, fileToDataURL } from '@/lib/file-parser'
import { getFileIcon } from '@/lib/file-utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useFileUpload } from '@/hooks/use-file-upload'
import { AnalysisStatusBadge } from './AnalysisStatusBadge'
import { ModuleProfileStatus } from './ModuleProfileStatus'
import { useDebugMode } from '@/hooks/use-debug-mode'
import { listDocumentAnalyses } from '@/lib/analysis-storage'
import type { DocumentAnalysisRecord } from '@/lib/analysis-types'

// Kategorie-Konfiguration
const CATEGORY_CONFIG: Record<FileCategory, {
  label: string
  pluralLabel: string
  icon: React.ElementType
  color: string
  description: string
}> = {
  script: {
    label: 'Skript',
    pluralLabel: 'Skripte',
    icon: BookOpen,
    color: 'text-blue-500',
    description: 'Vorlesungsskripte und Kursmaterialien',
  },
  exercise: {
    label: 'Übungsblatt',
    pluralLabel: 'Übungsblätter',
    icon: ClipboardText,
    color: 'text-orange-500',
    description: 'Übungsaufgaben und Arbeitsblätter',
  },
  solution: {
    label: 'Lösung',
    pluralLabel: 'Lösungen',
    icon: CheckSquare,
    color: 'text-green-500',
    description: 'Musterlösungen zu Übungsblättern',
  },
  exam: {
    label: 'Probeklausur',
    pluralLabel: 'Probeklausuren',
    icon: Exam,
    color: 'text-purple-500',
    description: 'Altklausuren und Übungsklausuren',
  },
  formula: {
    label: 'Formelsammlung',
    pluralLabel: 'Formelsammlungen',
    icon: BookOpen,
    color: 'text-cyan-500',
    description: 'Formelsammlungen und Nachschlagewerke für Prüfungen',
  },
}

interface FilesTabProps {
  scripts: Script[]
  onUploadScript: (content: string, name: string, fileType?: string, fileData?: string, category?: FileCategory) => Promise<void>
  onGenerateNotes: (scriptId: string) => void
  onGenerateTasks: (scriptId: string) => void
  onDeleteScript: (scriptId: string) => void
  onBulkDeleteScripts: (ids: string[]) => void
  onGenerateAllNotes: () => void
  onGenerateAllTasks: () => void
  onAnalyzeScript?: (scriptId: string) => void
  onReanalyzeAll?: () => void
  onReanalyzeSelected?: (ids: string[]) => void
  onGenerateNotesForSelected?: (ids: string[]) => void
  onGenerateTasksForSelected?: (ids: string[]) => void
}

export function FilesTab({
  scripts,
  onUploadScript,
  onGenerateNotes,
  onGenerateTasks,
  onDeleteScript,
  onBulkDeleteScripts,
  onGenerateAllNotes,
  onGenerateAllTasks,
  onAnalyzeScript,
  onReanalyzeAll,
  onReanalyzeSelected,
  onGenerateNotesForSelected,
  onGenerateTasksForSelected,
}: FilesTabProps) {
  const { enabled: debugMode } = useDebugMode()
  const [previewScript, setPreviewScript] = useState<Script | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<FileCategory>>(
    new Set(['script', 'exercise', 'solution', 'exam'])
  )
  const [uploadCategory, setUploadCategory] = useState<FileCategory>('script')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Analysis records for status badges
  const [analysisRecords, setAnalysisRecords] = useState<Map<string, DocumentAnalysisRecord>>(new Map())
  
  // Get moduleId from first script
  const moduleId = scripts[0]?.moduleId ?? ''
  
  const pollingRef = useRef<number | null>(null)

  // Load analysis records when moduleId or scripts change
  useEffect(() => {
    if (!moduleId) return

    let cancelled = false

    const loadRecords = async () => {
      try {
        const records = await listDocumentAnalyses(moduleId)
        if (cancelled) return

        const recordMap = new Map<string, DocumentAnalysisRecord>()
        for (const record of records) {
          recordMap.set(record.documentId, record)
        }

        setAnalysisRecords(prev => {
          if (prev.size === recordMap.size) {
            let isSame = true
            for (const [id, record] of recordMap) {
              const existing = prev.get(id)
              if (!existing || existing.status !== record.status || existing.documentId !== record.documentId) {
                isSame = false
                break
              }
            }
            if (isSame) return prev
          }

          console.debug('[FilesTab] Loaded', recordMap.size, 'document analyses')
          return recordMap
        })
      } catch (e) {
        console.warn('[FilesTab] Failed to load analysis records:', e)
      }
    }

    loadRecords()

    if (!pollingRef.current) {
      pollingRef.current = window.setInterval(loadRecords, 5000)
    }

    return () => {
      cancelled = true
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [moduleId, scripts.length])

  // Use custom hooks for file upload and bulk selection
  const {
    selectedFiles,
    isDragging,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeFile,
    clearFiles,
  } = useFileUpload()

  const getScriptId = useCallback((script: Script) => script.id, [])

  const {
    selectedIds,
    hasSelection: hasSelectedFiles,
    toggleSelection: toggleSelect,
    toggleMultiple,
    clearSelection,
  } = useBulkSelection({
    items: scripts,
    getId: getScriptId,
  })

  // Öffne Upload-Dialog für eine Kategorie
  const openUploadDialog = (category: FileCategory) => {
    setUploadCategory(category)
    clearFiles()
    setUploadDialogOpen(true)
  }

  // Trigger file input (öffnet auch Dialog wenn noch nicht offen)
  const triggerUpload = (category: FileCategory) => {
    setUploadCategory(category)
    if (!uploadDialogOpen) {
      setUploadDialogOpen(true)
    }
    // Kurze Verzögerung damit der Dialog sich öffnen kann
    setTimeout(() => {
      fileInputRef.current?.click()
    }, 100)
  }

  // Gruppiere Scripts nach Kategorie
  const getScriptCategory = (script: Script): FileCategory => {
    if (script.category) {
      return script.category
    }
    return 'script'
  }

  const scriptsByCategory = scripts.reduce((acc, script) => {
    const category = getScriptCategory(script)
    if (!acc[category]) acc[category] = []
    acc[category].push(script)
    return acc
  }, {} as Record<FileCategory, Script[]>)

  const toggleCategory = (category: FileCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  // ===== BULK UPLOAD FUNKTIONEN =====
  
  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsUploading(true)
    const categoryConfig = CATEGORY_CONFIG[uploadCategory]

    try {
      for (const file of selectedFiles) {
        try {
          const content = await parseFile(file)
          const fileData = await fileToDataURL(file)
          const name = file.name.replace(/\.[^/.]+$/, '')
          const fileType = getFileExtension(file.name)
          
          await onUploadScript(content, name, fileType, fileData, uploadCategory)
        } catch (error) {
          toast.error(`Fehler beim Hochladen von "${file.name}"`)
          console.error('File parsing error:', error)
        }
      }
      
      toast.success(`${selectedFiles.length} ${categoryConfig.pluralLabel} hochgeladen`)
      clearFiles()
      setUploadDialogOpen(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!isUploading) {
      setUploadDialogOpen(open)
      if (!open) {
        clearFiles()
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }

  // ===== SELEKTION FUNKTIONEN =====

  // Alle in einer Kategorie auswählen/abwählen
  const toggleSelectAllInCategory = (category: FileCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    const categoryScripts = scriptsByCategory[category] || []
    if (categoryScripts.length === 0) return

    const categoryIds = categoryScripts.map(s => s.id)
    const allSelected = categoryIds.every(id => selectedIds.has(id))

    // Use toggleMultiple for efficient bulk operation
    toggleMultiple(categoryIds, !allSelected)
  }

  // Prüfe ob alle in einer Kategorie ausgewählt sind
  const isAllSelectedInCategory = (category: FileCategory): boolean => {
    const categoryScripts = scriptsByCategory[category] || []
    if (categoryScripts.length === 0) return false
    return categoryScripts.every(s => selectedIds.has(s.id))
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    onBulkDeleteScripts(Array.from(selectedIds))
    clearSelection()
  }

  const totalFiles = scripts.length

  return (
    <div className="space-y-6">
      {/* Module Profile Status */}
      {moduleId && <ModuleProfileStatus moduleId={moduleId} />}
      
      {/* Hidden File Input für Bulk Upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.pptx,.txt,.md,image/*"
        multiple
        onChange={handleFileSelect}
      />
      
      {/* Header mit Bulk-Aktionen */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Dateien & Materialien</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalFiles} {totalFiles === 1 ? 'Datei' : 'Dateien'} insgesamt
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasSelectedFiles && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} ausgewählt
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash className="w-4 h-4 mr-1" />
                Löschen
              </Button>
            </>
          )}

          {scripts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkle className="w-4 h-4 mr-1" />
                  KI-Aktionen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Aktionen für ALLE Dateien */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Alle Dateien
                </div>
                {debugMode && (
                  <DropdownMenuItem onClick={onGenerateAllNotes}>
                    <Note className="w-4 h-4 mr-2" />
                    Alle Notizen generieren
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onGenerateAllTasks}>
                  <ListChecks className="w-4 h-4 mr-2" />
                  Alle Aufgaben generieren
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onReanalyzeAll?.()}
                  disabled={!onReanalyzeAll}
                >
                  <ArrowsClockwise className="w-4 h-4 mr-2" />
                  Alle neu analysieren
                </DropdownMenuItem>
                
                {/* Aktionen für AUSGEWÄHLTE Dateien */}
                {hasSelectedFiles && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Ausgewählt ({selectedIds.size})
                    </div>
                    {debugMode && (
                      <DropdownMenuItem 
                        onClick={() => onGenerateNotesForSelected?.(Array.from(selectedIds))}
                        disabled={!onGenerateNotesForSelected}
                      >
                        <Note className="w-4 h-4 mr-2" />
                        Notizen für Auswahl
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => onGenerateTasksForSelected?.(Array.from(selectedIds))}
                      disabled={!onGenerateTasksForSelected}
                    >
                      <ListChecks className="w-4 h-4 mr-2" />
                      Aufgaben für Auswahl
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onReanalyzeSelected?.(Array.from(selectedIds))}
                      disabled={!onReanalyzeSelected}
                    >
                      <ArrowsClockwise className="w-4 h-4 mr-2" />
                      Auswahl neu analysieren
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Kategorien */}
      <div className="space-y-4">
        {(Object.keys(CATEGORY_CONFIG) as FileCategory[]).map((category) => {
          const config = CATEGORY_CONFIG[category]
          const CategoryIcon = config.icon
          const categoryScripts = scriptsByCategory[category] || []
          const isExpanded = expandedCategories.has(category)
          const allSelectedInCategory = isAllSelectedInCategory(category)

          return (
            <Card key={category} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4 px-3 sm:px-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={cn('p-1.5 sm:p-2 rounded-lg bg-muted shrink-0', config.color)}>
                          <CategoryIcon className="w-4 h-4 sm:w-5 sm:h-5" weight="duotone" />
                        </div>
                        <div className="min-w-0">

                          <CardTitle className="text-sm sm:text-base font-medium flex items-center gap-2">
                            <span className="truncate">{config.pluralLabel}</span>
                            <Badge variant="secondary" className="font-normal shrink-0">
                              {categoryScripts.length}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                            {config.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 sm:h-8 sm:px-3 text-xs sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerUpload(category)
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Hochladen</span>
                        </Button>
                        {isExpanded ? (
                          <CaretDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        ) : (
                          <CaretRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {categoryScripts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <FolderOpen className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Noch keine {config.pluralLabel.toLowerCase()} hochgeladen
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-2"
                          onClick={() => triggerUpload(category)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          {config.label} hochladen
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Alle auswählen */}
                        <div className="flex items-center justify-between py-2 border-b mb-2">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => toggleSelectAllInCategory(category, e)}
                            onKeyDown={(e) => e.key === 'Enter' && toggleSelectAllInCategory(category, e as unknown as React.MouseEvent)}
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={allSelectedInCategory}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span>Alle auswählen ({categoryScripts.length})</span>
                          </div>
                        </div>
                        {categoryScripts.map((script) => {
                          const FileIcon = getFileIcon(script.fileType)
                          const isSelected = selectedIds.has(script.id)

                          return (
                            <div
                              key={script.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                isSelected
                                  ? 'bg-primary/5 border-primary/30'
                                  : 'hover:bg-muted/50'
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(script.id)}
                              />
                              <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">
                                    {script.name}
                                  </p>
                                  <AnalysisStatusBadge
                                    moduleId={moduleId}
                                    documentId={script.id}
                                    analysisRecord={analysisRecords.get(script.id) ?? null}
                                    size="sm"
                                    showCoverage={true}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(script.uploadedAt).toLocaleDateString('de-DE')}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <DotsThreeVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setPreviewScript(script)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Vorschau
                                  </DropdownMenuItem>
                                  {onAnalyzeScript && (
                                    <DropdownMenuItem onClick={() => onAnalyzeScript(script.id)}>
                                      <MagnifyingGlass className="w-4 h-4 mr-2" />
                                      Analyse starten
                                    </DropdownMenuItem>
                                  )}
                                  {category === 'script' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      {debugMode && (
                                        <DropdownMenuItem onClick={() => onGenerateNotes(script.id)}>
                                          <Sparkle className="w-4 h-4 mr-2" />
                                          Notizen generieren
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => onGenerateTasks(script.id)}>
                                        <Sparkle className="w-4 h-4 mr-2" />
                                        Aufgaben generieren
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onDeleteScript(script.id)}
                                    className="text-destructive"
                                  >
                                    <Trash className="w-4 h-4 mr-2" />
                                    Löschen
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>

      {/* Vorschau-Dialog */}
      {previewScript && (
        <ScriptPreviewDialog
          script={previewScript}
          open={!!previewScript}
          onOpenChange={(open) => !open && setPreviewScript(null)}
        />
      )}

      {/* Upload-Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {uploadCategory && CATEGORY_CONFIG[uploadCategory]
                ? `${CATEGORY_CONFIG[uploadCategory].pluralLabel} hochladen`
                : 'Dateien hochladen'}
            </DialogTitle>
          </DialogHeader>

          {/* Drag & Drop Zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (uploadCategory) {
                triggerUpload(uploadCategory)
              }
            }}
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              Dateien hierher ziehen oder klicken
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, PPTX, PNG, JPG werden unterstützt
            </p>
          </div>

          {/* Dateiliste */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeFile(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-4">
              <Progress value={50} className="animate-pulse" />
              <p className="text-xs text-muted-foreground text-center mt-2">
                Dateien werden hochgeladen...
              </p>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {selectedFiles.length > 0
                ? `${selectedFiles.length} Datei${selectedFiles.length > 1 ? 'en' : ''} hochladen`
                : 'Hochladen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
