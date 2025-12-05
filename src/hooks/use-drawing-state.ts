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

  // GoodNotes-Style Eraser: Löscht Punkte in einem Radius und splittet Strokes
  const eraseAtPoint = useCallback((point: Point, radius: number) => {
    setStrokes(prev => {
      const newStrokes: Stroke[] = []
      let changed = false
      
      for (const stroke of prev) {
        // Finde Punkte außerhalb des Radierers
        const segments: Point[][] = []
        let currentSegment: Point[] = []
        
        for (const p of stroke.points) {
          const dx = p.x - point.x
          const dy = p.y - point.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance > radius + stroke.width / 2) {
            // Punkt ist außerhalb des Radierers
            currentSegment.push(p)
          } else {
            // Punkt wird gelöscht
            changed = true
            if (currentSegment.length >= 2) {
              segments.push(currentSegment)
            }
            currentSegment = []
          }
        }
        
        // Letztes Segment hinzufügen
        if (currentSegment.length >= 2) {
          segments.push(currentSegment)
        }
        
        // Erstelle neue Strokes aus den Segmenten
        if (segments.length === 0) {
          // Stroke komplett gelöscht
          continue
        } else if (segments.length === 1 && segments[0].length === stroke.points.length) {
          // Stroke unverändert
          newStrokes.push(stroke)
        } else {
          // Stroke wurde gesplittet
          for (const segment of segments) {
            newStrokes.push({
              ...stroke,
              id: `${stroke.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              points: segment,
            })
          }
        }
      }
      
      if (changed) {
        saveToHistory(newStrokes)
      }
      
      return changed ? newStrokes : prev
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

  const clearAll = useCallback(() => {
    setStrokes([])
    setSelectedStrokeIds(new Set())
    historyRef.current = [[]]
    historyIndexRef.current = 0
  }, [])

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
    
    // View
    pan,
    zoom,
    resetView,
    clearAll,
    
    // Koordinaten-Transformation
    screenToCanvas,
    canvasToScreen,
    
    // Konstanten
    PREDEFINED_COLORS,
  }
}

export type UseDrawingStateReturn = ReturnType<typeof useDrawingState>
