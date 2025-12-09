/**
 * FormulaSheetPanel - Ausklappbare Seitenleiste für Formelsammlungen
 * 
 * Zeigt Formelsammlungen aus dem aktuellen Modul an.
 * Kann im TaskSolver, ExamMode und QuizMode verwendet werden.
 * 
 * Features:
 * - Automatische Anzeige des Dokuments bei nur 1 Formelsammlung
 * - Multi-PDF-Auswahl bei mehreren Dokumenten
 * - Touch Pinch-Zoom und Pan für bessere Lesbarkeit
 * - Resize-Drag zum Anpassen der Panel-Breite
 * - Lokale Speicherung der benutzerdefinierten Panel-Breite
 * - Zentrierter Toggle-Button (nicht ganz oben/unten)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Script } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Book, 
  CaretLeft, 
  CaretRight, 
  FilePdf,
  FileText,
  Image,
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutLineHorizontal,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { PDFViewer } from './PDFViewer'
import { cn } from '@/lib/utils'

// LocalStorage Keys
const PANEL_WIDTH_KEY = 'formula-sheet-panel-width'
const MIN_PANEL_WIDTH = 400
const MAX_PANEL_WIDTH = 900
const DEFAULT_PANEL_WIDTH = 520

interface FormulaSheetPanelProps {
  /** Formelsammlungen aus dem aktuellen Modul */
  formulaSheets: Script[]
  /** Ob Panel initial offen ist */
  defaultOpen?: boolean
  /** Zusätzliche CSS-Klassen */
  className?: string
}

// Hook für gespeicherte Panel-Breite
function useSavedPanelWidth() {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(PANEL_WIDTH_KEY)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH && parsed <= MAX_PANEL_WIDTH) {
          return parsed
        }
      }
    } catch {}
    return DEFAULT_PANEL_WIDTH
  })

  const saveWidth = useCallback((newWidth: number) => {
    const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth))
    setWidth(clampedWidth)
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(clampedWidth))
    } catch {}
  }, [])

  return [width, saveWidth] as const
}

export function FormulaSheetPanel({
  formulaSheets,
  defaultOpen = false,
  className,
}: FormulaSheetPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [selectedSheet, setSelectedSheet] = useState<Script | null>(null)
  const [panelWidth, setPanelWidth] = useSavedPanelWidth()
  
  // Touch Zoom & Pan State
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)
  const lastTouchesRef = useRef<{ x: number; y: number; dist: number } | null>(null)
  const isPinchingRef = useRef(false)
  
  // Resize Drag State
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null)

  // Automatisch das Dokument auswählen wenn nur 1 Formelsammlung vorhanden
  useEffect(() => {
    if (formulaSheets.length === 1 && isOpen && !selectedSheet) {
      setSelectedSheet(formulaSheets[0])
      setViewTransform({ scale: 1, x: 0, y: 0 })
    }
  }, [formulaSheets, isOpen, selectedSheet])

  // Reset selectedSheet wenn Panel geschlossen wird und es mehr als 1 Dokument gibt
  useEffect(() => {
    if (!isOpen && formulaSheets.length > 1) {
      setSelectedSheet(null)
      setViewTransform({ scale: 1, x: 0, y: 0 })
    }
  }, [isOpen, formulaSheets.length])

  const handleSelectSheet = (sheet: Script) => {
    setSelectedSheet(sheet)
    setViewTransform({ scale: 1, x: 0, y: 0 })
  }

  // Touch handlers für Pinch-Zoom und Pan
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      isPinchingRef.current = true
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const centerX = (touch1.clientX + touch2.clientX) / 2
      const centerY = (touch1.clientY + touch2.clientY) / 2
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      lastTouchesRef.current = { x: centerX, y: centerY, dist }
    } else if (e.touches.length === 1 && viewTransform.scale > 1) {
      // Pan only when zoomed in
      const touch = e.touches[0]
      lastTouchesRef.current = { x: touch.clientX, y: touch.clientY, dist: 0 }
    }
  }, [viewTransform.scale])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchesRef.current) {
      e.preventDefault()
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const centerX = (touch1.clientX + touch2.clientX) / 2
      const centerY = (touch1.clientY + touch2.clientY) / 2
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      
      const scaleDelta = dist / lastTouchesRef.current.dist
      const panDeltaX = centerX - lastTouchesRef.current.x
      const panDeltaY = centerY - lastTouchesRef.current.y
      
      setViewTransform(prev => ({
        scale: Math.max(0.5, Math.min(4, prev.scale * scaleDelta)),
        x: prev.x + panDeltaX,
        y: prev.y + panDeltaY,
      }))
      
      lastTouchesRef.current = { x: centerX, y: centerY, dist }
    } else if (e.touches.length === 1 && lastTouchesRef.current && viewTransform.scale > 1 && !isPinchingRef.current) {
      // Pan when zoomed in
      const touch = e.touches[0]
      const panDeltaX = touch.clientX - lastTouchesRef.current.x
      const panDeltaY = touch.clientY - lastTouchesRef.current.y
      
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + panDeltaX,
        y: prev.y + panDeltaY,
      }))
      
      lastTouchesRef.current = { x: touch.clientX, y: touch.clientY, dist: 0 }
    }
  }, [viewTransform.scale])

  const handleTouchEnd = useCallback(() => {
    lastTouchesRef.current = null
    isPinchingRef.current = false
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setViewTransform(prev => ({
        ...prev,
        scale: Math.max(0.5, Math.min(4, prev.scale * delta)),
      }))
    }
  }, [])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    resizeStartRef.current = { x: clientX, width: panelWidth }
    
    const handleResizeMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!resizeStartRef.current) return
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const delta = resizeStartRef.current.x - currentX
      const newWidth = resizeStartRef.current.width + delta
      setPanelWidth(newWidth)
    }
    
    const handleResizeEnd = () => {
      setIsResizing(false)
      resizeStartRef.current = null
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      document.removeEventListener('touchmove', handleResizeMove)
      document.removeEventListener('touchend', handleResizeEnd)
    }
    
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
    document.addEventListener('touchmove', handleResizeMove)
    document.addEventListener('touchend', handleResizeEnd)
  }, [panelWidth, setPanelWidth])

  // Zoom controls
  const zoomIn = useCallback(() => {
    setViewTransform(prev => ({
      ...prev,
      scale: Math.min(4, prev.scale * 1.25),
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setViewTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, prev.scale * 0.8),
    }))
  }, [])

  const resetView = useCallback(() => {
    setViewTransform({ scale: 1, x: 0, y: 0 })
  }, [])

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case 'pdf':
        return <FilePdf size={16} className="text-red-500" />
      case 'image':
        return <Image size={16} className="text-blue-500" />
      default:
        return <FileText size={16} className="text-muted-foreground" />
    }
  }

  if (formulaSheets.length === 0) {
    return null
  }

  const showBackButton = formulaSheets.length > 1

  return (
    <>
      {/* Toggle-Button am rechten Rand - ZENTRIERT, nicht ganz oben/unten */}
      <motion.div
        className={cn(
          "fixed right-0 z-40",
          // Zentriert mit etwas Abstand von oben und unten
          "top-1/2 -translate-y-1/2",
          className
        )}
        initial={false}
        animate={{ x: isOpen ? -panelWidth : 0 }}
        // Beim Resize keine Animation (instant snap), sonst schöne Spring-Animation
        transition={isResizing ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }}
      >
        <Button
          variant="secondary"
          size="sm"
          className="rounded-l-lg rounded-r-none h-20 px-1.5 shadow-lg border-r-0"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-col items-center gap-1">
            {isOpen ? (
              <CaretRight size={16} />
            ) : (
              <CaretLeft size={16} />
            )}
            <Book size={18} className="text-cyan-500" weight="duotone" />
            <span className="text-[10px] writing-mode-vertical">
              Formeln
            </span>
          </div>
        </Button>
      </motion.div>

      {/* Panel - Dynamische Breite, NICHT von ganz oben bis unten */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed right-0 bg-background border-l border-t border-b rounded-l-xl shadow-2xl z-50 flex flex-col",
              // Zentriert vertikal mit Abstand
              "top-16 bottom-16",
              className
            )}
            style={{ width: panelWidth }}
          >
            {/* Resize Handle - linker Rand */}
            <div
              className={cn(
                "absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group",
                "hover:bg-cyan-500/20 active:bg-cyan-500/30 transition-colors",
                isResizing && "bg-cyan-500/30"
              )}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            >
              <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-12 bg-muted-foreground/30 rounded-full group-hover:bg-cyan-500/50" />
            </div>

            {/* Header */}
            <div className="border-b p-3 flex items-center justify-between shrink-0 rounded-tl-xl pl-4">
              <div className="flex items-center gap-2">
                <Book size={20} className="text-cyan-500" weight="duotone" />
                <h3 className="font-semibold">Formelsammlungen</h3>
                <Badge variant="secondary" className="text-xs">
                  {formulaSheets.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
              {!selectedSheet ? (
                // Dateiliste - nur wenn mehr als 1 Dokument
                <ScrollArea className="flex-1">
                  <div className="p-3 pl-4 space-y-2">
                    {formulaSheets.map((sheet) => (
                      <Card
                        key={sheet.id}
                        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectSheet(sheet)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getFileIcon(sheet.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {sheet.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(sheet.uploadedAt).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                // Viewer
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Viewer Header */}
                  <div className="border-b p-2 pl-4 flex items-center justify-between shrink-0">
                    {showBackButton ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSheet(null)
                          setViewTransform({ scale: 1, x: 0, y: 0 })
                        }}
                      >
                        <CaretLeft size={16} className="mr-1" />
                        Zurück
                      </Button>
                    ) : (
                      <span className="text-sm font-medium truncate max-w-[180px] px-2">
                        {selectedSheet.name}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={zoomOut}
                        title="Verkleinern"
                      >
                        <MagnifyingGlassMinus size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs min-w-[50px]"
                        onClick={resetView}
                        title="Ansicht zurücksetzen"
                      >
                        {Math.round(viewTransform.scale * 100)}%
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={zoomIn}
                        title="Vergrößern"
                      >
                        <MagnifyingGlassPlus size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Content Viewer - Touch Zoom & Pan */}
                  <div 
                    ref={contentRef}
                    className="flex-1 overflow-hidden touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                  >
                    <div 
                      className="p-4 pl-5 min-h-full"
                      style={{ 
                        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
                        transformOrigin: 'top center',
                        transition: lastTouchesRef.current ? 'none' : 'transform 0.1s ease-out',
                      }}
                    >
                      {selectedSheet.fileType === 'pdf' && selectedSheet.fileData ? (
                        <PDFViewer
                          fileData={selectedSheet.fileData}
                          highQuality={true}
                        />
                      ) : selectedSheet.fileType === 'image' && selectedSheet.fileData ? (
                        <img
                          src={selectedSheet.fileData}
                          alt={selectedSheet.name}
                          className="w-full rounded-lg shadow-sm"
                          draggable={false}
                        />
                      ) : (
                        <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-full overflow-auto">
                          {selectedSheet.content}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Touch hint */}
                  <div className="border-t px-3 py-1.5 text-center shrink-0 bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">
                      👆 2 Finger: Zoomen & Verschieben | Klick auf % zum Zurücksetzen
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Hint */}
            <div className="border-t p-2 pl-4 text-center shrink-0 rounded-bl-xl flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowsOutLineHorizontal size={12} />
                <span>Ziehen zum Anpassen</span>
              </div>
              <p className="text-xs text-muted-foreground">
                📚 Wie in der echten Prüfung!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
