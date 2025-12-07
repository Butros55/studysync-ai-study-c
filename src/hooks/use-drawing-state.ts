import { useState, useCallback, useRef } from 'react'

// Types für das Zeichensystem
export interface Point {
  x: number
  y: number
  pressure?: number
}

export interface Stroke {
  id: string
  points: Point[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
}

export interface DrawingState {
  strokes: Stroke[]
  selectedStrokeIds: Set<string>
  scale: number
  offsetX: number
  offsetY: number
}

export type DrawingTool = 'pen' | 'eraser' | 'select'

export interface DrawingSettings {
  tool: DrawingTool
  penColor: string
  penWidth: number
  eraserWidth: number
}

const PREDEFINED_COLORS = [
  '#1a1a2e', // Dark (Default)
  '#e63946', // Red
  '#2a9d8f', // Teal
  '#3b82f6', // Blue
  '#f59e0b', // Orange
]

export function useDrawingState() {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set())
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  
  // Settings
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [penColor, setPenColor] = useState(PREDEFINED_COLORS[0])
  const [penWidth, setPenWidth] = useState(3)
  const [eraserWidth, setEraserWidth] = useState(20)
  
  // History für Undo/Redo
  const historyRef = useRef<Stroke[][]>([])
  const historyIndexRef = useRef(-1)
  const maxHistoryLength = 50

  const generateStrokeId = useCallback(() => {
    return `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const saveToHistory = useCallback((newStrokes: Stroke[]) => {
    // Schneide History ab wenn wir in der Mitte sind
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push([...newStrokes])
    historyIndexRef.current++
    
    // Begrenze History-Länge
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift()
      historyIndexRef.current--
    }
  }, [])

  const addStroke = useCallback((stroke: Omit<Stroke, 'id'>) => {
    const newStroke: Stroke = {
      ...stroke,
      id: generateStrokeId(),
    }
    setStrokes(prev => {
      const newStrokes = [...prev, newStroke]
      saveToHistory(newStrokes)
      return newStrokes
    })
    return newStroke.id
  }, [generateStrokeId, saveToHistory])

  const updateStroke = useCallback((id: string, points: Point[]) => {
    setStrokes(prev => prev.map(s => 
      s.id === id ? { ...s, points } : s
    ))
  }, [])

  const removeStrokes = useCallback((ids: string[]) => {
    setStrokes(prev => {
      const newStrokes = prev.filter(s => !ids.includes(s.id))
      saveToHistory(newStrokes)
      return newStrokes
    })
    setSelectedStrokeIds(prev => {
      const newSet = new Set(prev)
      ids.forEach(id => newSet.delete(id))
      return newSet
    })
  }, [saveToHistory])

  // GoodNotes-Style Eraser: schneidet Stroke in Segmente anhand des Abstands zu einem Segment
  const eraseAtPoint = useCallback((point: Point, radius: number) => {
    const lineRadius = radius
    const distPoint = (a: Point, b: Point) => {
      const dx = a.x - b.x
      const dy = a.y - b.y
      return Math.sqrt(dx * dx + dy * dy)
    }
    const distToSegment = (c: Point, a: Point, b: Point) => {
      const abx = b.x - a.x
      const aby = b.y - a.y
      const acx = c.x - a.x
      const acy = c.y - a.y
      const abLenSq = abx * abx + aby * aby
      if (abLenSq === 0) return distPoint(c, a)
      const t = Math.max(0, Math.min(1, (acx * abx + acy * aby) / abLenSq))
      const projX = a.x + abx * t
      const projY = a.y + aby * t
      const dx = c.x - projX
      const dy = c.y - projY
      return Math.sqrt(dx * dx + dy * dy)
    }

    setStrokes(prev => {
      const updated: Stroke[] = []
      let anyChanged = false

      for (const stroke of prev) {
        const segments: Point[][] = []
        let current: Point[] = []
        const eraseThreshold = lineRadius + stroke.width / 2
        let strokeChanged = false

        if (stroke.points.length === 0) continue
        current.push(stroke.points[0])

        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i]
          const p2 = stroke.points[i + 1]
          const hit =
            distToSegment(point, p1, p2) <= eraseThreshold ||
            distPoint(point, p2) <= eraseThreshold

          if (hit) {
            strokeChanged = true
            if (current.length >= 2) segments.push(current)
            current = []
            // starte ein neues Segment nur, wenn das Endstck auáerhalb des Radierbereichs liegt
            if (distPoint(point, p2) > eraseThreshold) {
              current = [p2]
            }
          } else {
            current.push(p2)
          }
        }

        if (current.length >= 2) {
          segments.push(current)
        }

        if (segments.length === 0) {
          if (strokeChanged) anyChanged = true
          continue
        }

        if (strokeChanged) {
          anyChanged = true
          segments.forEach(seg => {
            updated.push({
              ...stroke,
              id: `${stroke.id}-${Math.random().toString(36).slice(2, 7)}`,
              points: seg,
            })
          })
        } else {
          updated.push(stroke)
        }
      }

      if (anyChanged) {
        saveToHistory(updated)
        return updated
      }
      return prev
    })
  }, [saveToHistory])

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      const previousState = historyRef.current[historyIndexRef.current]
      setStrokes(previousState ? [...previousState] : [])
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      const nextState = historyRef.current[historyIndexRef.current]
      setStrokes(nextState ? [...nextState] : [])
    }
  }, [])

  const canUndo = historyIndexRef.current > 0
  const canRedo = historyIndexRef.current < historyRef.current.length - 1

  // Clear All - aber speichere vorher den aktuellen Zustand für Undo
  const clearAll = useCallback(() => {
    // Nur speichern wenn es etwas zu speichern gibt
    if (strokes.length > 0) {
      saveToHistory([]) // Speichere leeren Zustand in History
    }
    setStrokes([])
    setSelectedStrokeIds(new Set())
  }, [strokes.length, saveToHistory])

  const selectStrokes = useCallback((ids: string[]) => {
    setSelectedStrokeIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedStrokeIds(new Set())
  }, [])

  const moveSelectedStrokes = useCallback((deltaX: number, deltaY: number) => {
    setStrokes(prev => prev.map(stroke => {
      if (selectedStrokeIds.has(stroke.id)) {
        return {
          ...stroke,
          points: stroke.points.map(p => ({
            ...p,
            x: p.x + deltaX,
            y: p.y + deltaY,
          })),
        }
      }
      return stroke
    }))
  }, [selectedStrokeIds])

  // Skaliere selektierte Strokes um einen Pivot-Punkt
  const scaleSelectedStrokes = useCallback((
    scaleX: number, 
    scaleY: number, 
    pivotX: number, 
    pivotY: number
  ) => {
    // clamp per-gesture scaling to avoid jumps/explosions
    const clampedX = Math.min(2.5, Math.max(0.25, scaleX))
    const clampedY = Math.min(2.5, Math.max(0.25, scaleY))
    const widthFactor = Math.min(1.75, Math.max(0.6, (clampedX + clampedY) / 2))

    setStrokes(prev => prev.map(stroke => {
      if (selectedStrokeIds.has(stroke.id)) {
        return {
          ...stroke,
          points: stroke.points.map(p => ({
            ...p,
            x: pivotX + (p.x - pivotX) * clampedX,
            y: pivotY + (p.y - pivotY) * clampedY,
          })),
          width: Math.min(24, Math.max(0.5, stroke.width * widthFactor)),
        }
      }
      return stroke
    }))
  }, [selectedStrokeIds])

  // Transform-Funktionen für Pan/Zoom
  const pan = useCallback((deltaX: number, deltaY: number) => {
    setOffsetX(prev => prev + deltaX)
    setOffsetY(prev => prev + deltaY)
  }, [])

  const zoom = useCallback((newScale: number, centerX?: number, centerY?: number) => {
    const clampedScale = Math.max(0.25, Math.min(4, newScale))
    
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom um den Mittelpunkt
      const scaleChange = clampedScale / scale
      setOffsetX(prev => centerX - (centerX - prev) * scaleChange)
      setOffsetY(prev => centerY - (centerY - prev) * scaleChange)
    }
    
    setScale(clampedScale)
  }, [scale])

  const resetView = useCallback(() => {
    setScale(1)
    setOffsetX(0)
    setOffsetY(0)
  }, [])

  // Lade Strokes (für Persistenz)
  const loadStrokes = useCallback((newStrokes: Stroke[]) => {
    setStrokes(newStrokes)
    // History zurücksetzen
    historyRef.current = [newStrokes]
    historyIndexRef.current = 0
  }, [])

  // Konvertiere Screen-Koordinaten zu Canvas-Koordinaten
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - offsetX) / scale,
      y: (screenY - offsetY) / scale,
    }
  }, [scale, offsetX, offsetY])

  // Konvertiere Canvas-Koordinaten zu Screen-Koordinaten
  const canvasToScreen = useCallback((canvasX: number, canvasY: number): Point => {
    return {
      x: canvasX * scale + offsetX,
      y: canvasY * scale + offsetY,
    }
  }, [scale, offsetX, offsetY])

  return {
    // State
    strokes,
    selectedStrokeIds,
    scale,
    offsetX,
    offsetY,
    
    // Settings
    tool,
    setTool,
    penColor,
    setPenColor,
    penWidth,
    setPenWidth,
    eraserWidth,
    setEraserWidth,
    
    // Stroke-Operationen
    addStroke,
    updateStroke,
    removeStrokes,
    eraseAtPoint,
    
    // History
    undo,
    redo,
    canUndo,
    canRedo,
    
    // Selection
    selectStrokes,
    clearSelection,
    moveSelectedStrokes,
    scaleSelectedStrokes,
    
    // View
    pan,
    zoom,
    resetView,
    clearAll,
    loadStrokes,
    
    // Koordinaten-Transformation
    screenToCanvas,
    canvasToScreen,
    
    // Konstanten
    PREDEFINED_COLORS,
  }
}

export type UseDrawingStateReturn = ReturnType<typeof useDrawingState>
