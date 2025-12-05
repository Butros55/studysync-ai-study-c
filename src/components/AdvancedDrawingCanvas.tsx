import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { DrawingToolbar } from './DrawingToolbar'
import { useDrawingState, Point, DrawingTool } from '@/hooks/use-drawing-state'
import { Button } from '@/components/ui/button'
import { X, PaperPlaneTilt } from '@phosphor-icons/react'

interface AdvancedDrawingCanvasProps {
  onContentChange: (hasContent: boolean) => void
  clearTrigger: number
  onCanvasDataUrl?: (dataUrl: string) => void
  isMobile?: boolean
  /** Fragestellung die als "Sticky Note" angezeigt wird */
  questionText?: string
  /** Callback für Submit im Fullscreen-Modus */
  onSubmit?: () => void
  /** Ob Submit disabled ist */
  submitDisabled?: boolean
  /** Ob gerade submitted wird */
  isSubmitting?: boolean
}

export function AdvancedDrawingCanvas({
  onContentChange,
  clearTrigger,
  onCanvasDataUrl,
  isMobile = false,
  questionText,
  onSubmit,
  submitDisabled = false,
  isSubmitting = false,
}: AdvancedDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Drawing State Hook
  const drawing = useDrawingState()
  
  // Lokaler UI-State
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  
  // Eraser-Cursor Position (für visuelles Feedback)
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null)
  
  // Pointer-Tracking für Multi-Touch und Palm Rejection
  const activePointersRef = useRef<Map<number, { type: string; startX: number; startY: number }>>(new Map())
  const isPenActiveRef = useRef(false)
  const currentStrokeIdRef = useRef<string | null>(null)
  const currentStrokePointsRef = useRef<Point[]>([])
  const lastPinchDistanceRef = useRef<number | null>(null)
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null)
  const isShiftPanningRef = useRef(false) // Shift+Maus Pan-Modus
  
  // Selection State
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectionStartRef = useRef<Point | null>(null)
  const isDraggingSelectionRef = useRef(false)
  const dragStartRef = useRef<Point | null>(null)

  // Temporärer Tool-Wechsel für Pen-Button-Eraser
  const originalToolRef = useRef<DrawingTool | null>(null)

  // Initialisiere Canvas-Größe
  const updateCanvasSize = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    setCanvasSize({ width: rect.width, height: rect.height })
  }, [])

  useEffect(() => {
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [updateCanvasSize, isFullscreen])

  // Clear bei clearTrigger
  useEffect(() => {
    drawing.clearAll()
    drawing.resetView()
    onContentChange(false)
  }, [clearTrigger])

  // Informiere Parent über Content-Änderungen
  useEffect(() => {
    onContentChange(drawing.strokes.length > 0)
  }, [drawing.strokes.length, onContentChange])

  // Automatisch Canvas als DataURL exportieren wenn Strokes sich ändern
  useEffect(() => {
    if (drawing.strokes.length > 0 && onCanvasDataUrl) {
      // Debounce um nicht bei jedem Punkt zu exportieren
      const timer = setTimeout(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Temporäres Canvas für Export erstellen
        const exportCanvas = document.createElement('canvas')
        const dpr = window.devicePixelRatio || 1
        exportCanvas.width = canvas.width
        exportCanvas.height = canvas.height
        const ctx = exportCanvas.getContext('2d')
        if (!ctx) return

        // Weißer Hintergrund
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

        // Strokes zeichnen
        for (const stroke of drawing.strokes) {
          if (stroke.points.length < 2) continue
          ctx.beginPath()
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.width * dpr
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          const firstPoint = stroke.points[0]
          ctx.moveTo(firstPoint.x * dpr, firstPoint.y * dpr)
          for (let i = 1; i < stroke.points.length; i++) {
            const point = stroke.points[i]
            ctx.lineTo(point.x * dpr, point.y * dpr)
          }
          ctx.stroke()
        }

        onCanvasDataUrl(exportCanvas.toDataURL('image/png'))
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [drawing.strokes, onCanvasDataUrl])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          if (e.shiftKey) {
            drawing.redo()
          } else {
            drawing.undo()
          }
        } else if (e.key === 'y') {
          e.preventDefault()
          drawing.redo()
        }
      } else if (e.key === 'p' || e.key === 'P') {
        drawing.setTool('pen')
      } else if (e.key === 'e' || e.key === 'E') {
        drawing.setTool('eraser')
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey) {
          drawing.setTool('select')
        }
      } else if (e.key === 'Escape') {
        drawing.clearSelection()
        setSelectionRect(null)
        if (isFullscreen) {
          setIsFullscreen(false)
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (drawing.selectedStrokeIds.size > 0) {
          drawing.removeStrokes(Array.from(drawing.selectedStrokeIds))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawing, isFullscreen])

  // Berechne Koordinaten aus Pointer Event
  const getCanvasCoordinates = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    
    return drawing.screenToCanvas(screenX, screenY)
  }, [drawing])

  // Berechne Distanz zwischen zwei Pointern
  const getPinchDistance = useCallback((pointers: Map<number, { type: string; startX: number; startY: number }>) => {
    const points = Array.from(pointers.values())
    if (points.length < 2) return null
    
    const dx = points[1].startX - points[0].startX
    const dy = points[1].startY - points[0].startY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // Finde Strokes innerhalb eines Rechtecks
  const findStrokesInRect = useCallback((rect: { x: number; y: number; width: number; height: number }): string[] => {
    const hitStrokes: string[] = []
    const minX = Math.min(rect.x, rect.x + rect.width)
    const maxX = Math.max(rect.x, rect.x + rect.width)
    const minY = Math.min(rect.y, rect.y + rect.height)
    const maxY = Math.max(rect.y, rect.y + rect.height)
    
    for (const stroke of drawing.strokes) {
      const hasPointInRect = stroke.points.some(p => 
        p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
      )
      if (hasPointInRect) {
        hitStrokes.push(stroke.id)
      }
    }
    
    return hitStrokes
  }, [drawing.strokes])

  // Berechne Bounding Box für selektierte Strokes
  const getSelectionBoundingBox = useCallback(() => {
    if (drawing.selectedStrokeIds.size === 0) return null
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    for (const stroke of drawing.strokes) {
      if (drawing.selectedStrokeIds.has(stroke.id)) {
        for (const p of stroke.points) {
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        }
      }
    }
    
    if (minX === Infinity) return null
    
    const padding = 10
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }, [drawing.strokes, drawing.selectedStrokeIds])

  // Pointer Event Handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    // Capture pointer für besseres Tracking
    canvas.setPointerCapture(e.pointerId)

    const pointerInfo = { 
      type: e.pointerType, 
      startX: e.clientX, 
      startY: e.clientY 
    }
    activePointersRef.current.set(e.pointerId, pointerInfo)

    const point = getCanvasCoordinates(e)

    // Pen-Button als Radierer erkennen
    // Hinweis: Das ist browserabhängig. Bei den meisten Stiften ist buttons === 32 der Seitenknopf
    // oder buttons === 2 für den "Radierer-Button" am Stiftende
    if (e.pointerType === 'pen' && (e.buttons === 32 || e.buttons === 2)) {
      originalToolRef.current = drawing.tool
      drawing.setTool('eraser')
    }

    // Pointer-Typ-spezifisches Verhalten
    if (e.pointerType === 'pen') {
      // Pen: Immer zeichnen (außer wenn Select-Tool aktiv)
      isPenActiveRef.current = true
      
      if (drawing.tool === 'select') {
        // Selection starten
        selectionStartRef.current = point
        setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
      } else if (drawing.tool === 'pen') {
        // Neuen Stroke starten
        currentStrokePointsRef.current = [{ ...point, pressure: e.pressure }]
        const strokeId = drawing.addStroke({
          points: currentStrokePointsRef.current,
          color: drawing.penColor,
          width: drawing.penWidth,
          tool: 'pen',
        })
        currentStrokeIdRef.current = strokeId
      } else if (drawing.tool === 'eraser') {
        // GoodNotes-Style: Lösche Punkte in einem Radius
        drawing.eraseAtPoint(point, drawing.eraserWidth / 2)
      }
    } else if (e.pointerType === 'touch') {
      // Touch: Nur Pan/Zoom, KEIN Zeichnen
      // Ignoriere Touch wenn Pen aktiv ist (Palm Rejection)
      if (isPenActiveRef.current) return

      if (activePointersRef.current.size === 1) {
        // Ein Finger: Pan
        lastPanPointRef.current = { x: e.clientX, y: e.clientY }
      } else if (activePointersRef.current.size === 2) {
        // Zwei Finger: Zoom vorbereiten
        lastPinchDistanceRef.current = getPinchDistance(activePointersRef.current)
      }
    } else if (e.pointerType === 'mouse') {
      // Shift+Linksklick = Pan (wie bei Figma/Miro)
      if (e.shiftKey && e.buttons === 1) {
        isShiftPanningRef.current = true
        lastPanPointRef.current = { x: e.clientX, y: e.clientY }
        return
      }
      
      // Mouse: Wie Pen behandeln (zum Testen)
      if (drawing.tool === 'select') {
        // Prüfe ob wir auf eine selektierte Stroke klicken (zum Verschieben)
        const boundingBox = getSelectionBoundingBox()
        if (boundingBox && 
            point.x >= boundingBox.x && 
            point.x <= boundingBox.x + boundingBox.width &&
            point.y >= boundingBox.y && 
            point.y <= boundingBox.y + boundingBox.height) {
          isDraggingSelectionRef.current = true
          dragStartRef.current = point
          return
        }
        
        // Neue Selection starten
        selectionStartRef.current = point
        setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
      } else if (drawing.tool === 'pen') {
        currentStrokePointsRef.current = [{ ...point, pressure: e.pressure || 0.5 }]
        const strokeId = drawing.addStroke({
          points: currentStrokePointsRef.current,
          color: drawing.penColor,
          width: drawing.penWidth,
          tool: 'pen',
        })
        currentStrokeIdRef.current = strokeId
      } else if (drawing.tool === 'eraser') {
        // GoodNotes-Style: Lösche Punkte in einem Radius
        drawing.eraseAtPoint(point, drawing.eraserWidth / 2)
      }
    }
  }, [drawing, getCanvasCoordinates, getPinchDistance, getSelectionBoundingBox])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    const pointerInfo = activePointersRef.current.get(e.pointerId)
    if (pointerInfo) {
      pointerInfo.startX = e.clientX
      pointerInfo.startY = e.clientY
    }

    const point = getCanvasCoordinates(e)

    // Shift+Maus Pan-Modus
    if (e.pointerType === 'mouse' && isShiftPanningRef.current && lastPanPointRef.current) {
      const deltaX = e.clientX - lastPanPointRef.current.x
      const deltaY = e.clientY - lastPanPointRef.current.y
      drawing.pan(deltaX, deltaY)
      lastPanPointRef.current = { x: e.clientX, y: e.clientY }
      return
    }

    if (e.pointerType === 'pen' || e.pointerType === 'mouse') {
      // Zeichnen/Radieren/Selektieren
      if (drawing.tool === 'select') {
        if (isDraggingSelectionRef.current && dragStartRef.current) {
          // Selection verschieben
          const deltaX = point.x - dragStartRef.current.x
          const deltaY = point.y - dragStartRef.current.y
          drawing.moveSelectedStrokes(deltaX, deltaY)
          dragStartRef.current = point
        } else if (selectionStartRef.current) {
          // Selection-Rechteck aktualisieren
          setSelectionRect({
            x: selectionStartRef.current.x,
            y: selectionStartRef.current.y,
            width: point.x - selectionStartRef.current.x,
            height: point.y - selectionStartRef.current.y,
          })
        }
      } else if (drawing.tool === 'pen' && currentStrokeIdRef.current) {
        // Stroke fortsetzen
        currentStrokePointsRef.current.push({ ...point, pressure: e.pressure || 0.5 })
        drawing.updateStroke(currentStrokeIdRef.current, [...currentStrokePointsRef.current])
      } else if (drawing.tool === 'eraser' && activePointersRef.current.size > 0) {
        // GoodNotes-Style: Kontinuierlich Punkte in einem Radius löschen
        drawing.eraseAtPoint(point, drawing.eraserWidth / 2)
        // Eraser-Cursor Position aktualisieren
        setEraserCursorPos(point)
      }
      
      // Eraser-Cursor bei Hover anzeigen
      if (drawing.tool === 'eraser') {
        setEraserCursorPos(point)
      }
    } else if (e.pointerType === 'touch') {
      // Touch: Pan/Zoom
      if (isPenActiveRef.current) return // Palm Rejection

      if (activePointersRef.current.size === 1 && lastPanPointRef.current) {
        // Pan
        const deltaX = e.clientX - lastPanPointRef.current.x
        const deltaY = e.clientY - lastPanPointRef.current.y
        drawing.pan(deltaX, deltaY)
        lastPanPointRef.current = { x: e.clientX, y: e.clientY }
      } else if (activePointersRef.current.size === 2) {
        // Pinch Zoom
        const newDistance = getPinchDistance(activePointersRef.current)
        if (newDistance && lastPinchDistanceRef.current) {
          const scaleFactor = newDistance / lastPinchDistanceRef.current
          const newScale = drawing.scale * scaleFactor
          
          // Zoom um den Mittelpunkt zwischen den Fingern
          const pointers = Array.from(activePointersRef.current.values())
          const centerX = (pointers[0].startX + pointers[1].startX) / 2
          const centerY = (pointers[0].startY + pointers[1].startY) / 2
          
          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            drawing.zoom(newScale, centerX - rect.left, centerY - rect.top)
          }
        }
        lastPinchDistanceRef.current = newDistance
      }
    }
  }, [drawing, getCanvasCoordinates, getPinchDistance])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }

    activePointersRef.current.delete(e.pointerId)
    
    // Eraser-Cursor ausblenden
    setEraserCursorPos(null)

    // Pen-Button Radierer zurücksetzen
    if (originalToolRef.current !== null) {
      drawing.setTool(originalToolRef.current)
      originalToolRef.current = null
    }

    // Shift-Pan-Modus beenden
    if (isShiftPanningRef.current) {
      isShiftPanningRef.current = false
      lastPanPointRef.current = null
    }

    if (e.pointerType === 'pen') {
      isPenActiveRef.current = false
      
      if (drawing.tool === 'select' && selectionStartRef.current && selectionRect) {
        // Selection abschließen
        const selectedIds = findStrokesInRect(selectionRect)
        drawing.selectStrokes(selectedIds)
        selectionStartRef.current = null
        setSelectionRect(null)
      }
    } else if (e.pointerType === 'mouse') {
      if (drawing.tool === 'select') {
        if (isDraggingSelectionRef.current) {
          isDraggingSelectionRef.current = false
          dragStartRef.current = null
        } else if (selectionStartRef.current && selectionRect) {
          const selectedIds = findStrokesInRect(selectionRect)
          drawing.selectStrokes(selectedIds)
          selectionStartRef.current = null
          setSelectionRect(null)
        }
      }
    }

    // Stroke beenden
    currentStrokeIdRef.current = null
    currentStrokePointsRef.current = []
    
    // Pan/Zoom Reset
    lastPanPointRef.current = null
    lastPinchDistanceRef.current = null

    // Canvas-Daten exportieren
    if (onCanvasDataUrl && drawing.strokes.length > 0) {
      exportCanvasToDataUrl()
    }
  }, [drawing, selectionRect, findStrokesInRect, onCanvasDataUrl])

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    handlePointerUp(e)
  }, [handlePointerUp])

  // Wheel für Zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = drawing.scale * delta
      
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        drawing.zoom(newScale, e.clientX - rect.left, e.clientY - rect.top)
      }
    }
  }, [drawing])

  // Canvas als DataURL exportieren
  const exportCanvasToDataUrl = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Temporäres Canvas für Export erstellen
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    // Hintergrund
    ctx.fillStyle = '#faf9f6'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Grid zeichnen
    const dpr = window.devicePixelRatio || 1
    const gridSize = 25 * dpr
    ctx.strokeStyle = '#e8e8ea'
    ctx.lineWidth = 1

    for (let x = 0; x < exportCanvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, exportCanvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < exportCanvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(exportCanvas.width, y)
      ctx.stroke()
    }

    // Strokes zeichnen
    for (const stroke of drawing.strokes) {
      if (stroke.points.length < 2) continue

      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width * dpr
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const firstPoint = stroke.points[0]
      ctx.moveTo(firstPoint.x * dpr, firstPoint.y * dpr)

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        ctx.lineTo(point.x * dpr, point.y * dpr)
      }

      ctx.stroke()
    }

    onCanvasDataUrl?.(exportCanvas.toDataURL('image/png'))
  }, [drawing.strokes, onCanvasDataUrl])

  // Canvas rendern
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvasSize.width * dpr
    const height = canvasSize.height * dpr

    canvas.width = width
    canvas.height = height
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    ctx.save()
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = '#faf9f6' // Off-white Papier-Farbe
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

    // Transformation anwenden
    ctx.translate(drawing.offsetX, drawing.offsetY)
    ctx.scale(drawing.scale, drawing.scale)

    // Grid zeichnen
    const gridSize = 25
    ctx.strokeStyle = '#e5e5e5'
    ctx.lineWidth = 1 / drawing.scale

    // Berechne sichtbaren Bereich für Grid-Optimierung
    const visibleStartX = -drawing.offsetX / drawing.scale
    const visibleStartY = -drawing.offsetY / drawing.scale
    const visibleWidth = canvasSize.width / drawing.scale
    const visibleHeight = canvasSize.height / drawing.scale

    const startX = Math.floor(visibleStartX / gridSize) * gridSize
    const startY = Math.floor(visibleStartY / gridSize) * gridSize
    const endX = visibleStartX + visibleWidth + gridSize
    const endY = visibleStartY + visibleHeight + gridSize

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }

    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }

    // Strokes zeichnen
    for (const stroke of drawing.strokes) {
      if (stroke.points.length < 2) continue

      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const firstPoint = stroke.points[0]
      ctx.moveTo(firstPoint.x, firstPoint.y)

      // Smoothing mit quadratischen Bezier-Kurven
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const p0 = stroke.points[i]
        const p1 = stroke.points[i + 1]
        const midX = (p0.x + p1.x) / 2
        const midY = (p0.y + p1.y) / 2
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY)
      }

      // Letzter Punkt
      const lastPoint = stroke.points[stroke.points.length - 1]
      ctx.lineTo(lastPoint.x, lastPoint.y)

      ctx.stroke()

      // Highlight für selektierte Strokes
      if (drawing.selectedStrokeIds.has(stroke.id)) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
        ctx.lineWidth = stroke.width + 4
        ctx.stroke()
      }
    }

    // Selection Bounding Box zeichnen
    const boundingBox = getSelectionBoundingBox()
    if (boundingBox) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2 / drawing.scale
      ctx.setLineDash([5 / drawing.scale, 5 / drawing.scale])
      ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height)
      ctx.setLineDash([])

      // Resize-Handles
      const handleSize = 8 / drawing.scale
      ctx.fillStyle = '#3b82f6'
      const corners = [
        { x: boundingBox.x, y: boundingBox.y },
        { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
        { x: boundingBox.x, y: boundingBox.y + boundingBox.height },
        { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height },
      ]
      for (const corner of corners) {
        ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
      }
    }

    // Selection-Rechteck während des Ziehens
    if (selectionRect) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1 / drawing.scale
      ctx.setLineDash([4 / drawing.scale, 4 / drawing.scale])
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      ctx.setLineDash([])
    }

    // Eraser-Cursor zeichnen (GoodNotes-Style)
    if (eraserCursorPos && drawing.tool === 'eraser') {
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)'
      ctx.lineWidth = 2 / drawing.scale
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(eraserCursorPos.x, eraserCursorPos.y, drawing.eraserWidth / 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 100, 100, 0.15)'
      ctx.fill()
    }

    ctx.restore()
  }, [canvasSize, drawing, selectionRect, getSelectionBoundingBox, eraserCursorPos])

  // Render bei Änderungen
  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  // Fullscreen Toggle
  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  // Cursor basierend auf Tool
  const getCursor = () => {
    switch (drawing.tool) {
      case 'pen':
        return 'crosshair'
      case 'eraser':
        return 'cell'
      case 'select':
        return isDraggingSelectionRef.current ? 'grabbing' : 'default'
      default:
        return 'default'
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-muted/30 rounded-lg border transition-all',
        isFullscreen && 'fixed inset-0 z-50 rounded-none bg-background'
      )}
    >
      {/* Header im Fullscreen - einheitliches Design */}
      {isFullscreen && (
        <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              {/* Fragestellung */}
              <div className="flex-1">
                {questionText && (
                  <div className="relative bg-muted/50 rounded-lg px-4 py-3 border">
                    <div className="absolute -top-2.5 left-3 bg-primary px-2.5 py-0.5 rounded text-[11px] font-medium text-primary-foreground">
                      Aufgabe
                    </div>
                    <p className="text-sm text-foreground leading-relaxed pt-1">
                      {questionText}
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons: Submit & Schließen */}
              <div className="flex items-center gap-2 shrink-0">
                {onSubmit && (
                  <Button
                    onClick={onSubmit}
                    disabled={submitDisabled || isSubmitting}
                    size="sm"
                  >
                    <PaperPlaneTilt className="w-4 h-4 mr-1.5" weight="fill" />
                    {isSubmitting ? 'Prüfe...' : 'Einreichen'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFullscreenToggle}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-hidden relative touch-none',
          isFullscreen 
            ? 'h-[calc(100vh-60px)]' 
            : isMobile 
              ? 'min-h-[350px]' 
              : 'min-h-[400px]'
        )}
      >
        {/* Toolbar */}
        <DrawingToolbar
          tool={drawing.tool}
          onToolChange={drawing.setTool}
          penColor={drawing.penColor}
          onPenColorChange={drawing.setPenColor}
          penWidth={drawing.penWidth}
          onPenWidthChange={drawing.setPenWidth}
          eraserWidth={drawing.eraserWidth}
          onEraserWidthChange={drawing.setEraserWidth}
          onUndo={drawing.undo}
          onRedo={drawing.redo}
          canUndo={drawing.canUndo}
          canRedo={drawing.canRedo}
          isFullscreen={isFullscreen}
          onFullscreenToggle={handleFullscreenToggle}
          onResetView={drawing.resetView}
          scale={drawing.scale}
          predefinedColors={drawing.PREDEFINED_COLORS}
        />

        {/* Haupt-Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: getCursor() }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        />
      </div>

      {/* Footer mit Tipps (nicht im Fullscreen) */}
      {!isFullscreen && (
        <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t bg-card/50 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">P</kbd> Stift
            <span className="mx-2">|</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">E</kbd> Radierer
            <span className="mx-2">|</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">S</kbd> Auswahl
          </span>
          <span>
            Touch: Pan/Zoom | Stift: Zeichnen
          </span>
        </div>
      )}
    </div>
  )
}
