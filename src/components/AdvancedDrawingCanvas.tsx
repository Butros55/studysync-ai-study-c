import { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Eraser,
  PencilSimple,
  ArrowsOutSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface AdvancedDrawingCanvasProps {
  onContentChange: (hasContent: boolean) => void
  clearTrigger: number
  onCanvasDataUrl?: (dataUrl: string) => void
}

type Tool = 'pen' | 'eraser'

export function AdvancedDrawingCanvas({
  onContentChange,
  clearTrigger,
  onCanvasDataUrl,
}: AdvancedDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingLayerRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [tool, setTool] = useState<Tool>('pen')
  const [penSize, setPenSize] = useState(3)
  const [eraserSize, setEraserSize] = useState(20)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [isExpanded, setIsExpanded] = useState(false)
  const historyRef = useRef<ImageData[]>([])
  const historyStepRef = useRef(0)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const saveState = useCallback(() => {
    const canvas = drawingLayerRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current = historyRef.current.slice(0, historyStepRef.current + 1)
    historyRef.current.push(imageData)
    historyStepRef.current++

    if (historyRef.current.length > 50) {
      historyRef.current.shift()
      historyStepRef.current--
    }
  }, [])

  const undo = useCallback(() => {
    if (historyStepRef.current <= 0) return

    const canvas = drawingLayerRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    historyStepRef.current--
    const imageData = historyRef.current[historyStepRef.current]
    if (imageData) {
      ctx.putImageData(imageData, 0, 0)
    }
  }, [])

  const initCanvas = useCallback(() => {
    const gridCanvas = canvasRef.current
    const drawingCanvas = drawingLayerRef.current
    const container = containerRef.current
    if (!gridCanvas || !drawingCanvas || !container) return

    const gridCtx = gridCanvas.getContext('2d')
    const drawingCtx = drawingCanvas.getContext('2d')
    if (!gridCtx || !drawingCtx) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    gridCanvas.width = rect.width * dpr
    gridCanvas.height = rect.height * dpr
    gridCanvas.style.width = `${rect.width}px`
    gridCanvas.style.height = `${rect.height}px`

    drawingCanvas.width = rect.width * dpr
    drawingCanvas.height = rect.height * dpr
    drawingCanvas.style.width = `${rect.width}px`
    drawingCanvas.style.height = `${rect.height}px`

    gridCtx.scale(dpr, dpr)
    drawingCtx.scale(dpr, dpr)

    gridCtx.fillStyle = '#ffffff'
    gridCtx.fillRect(0, 0, rect.width, rect.height)

    const gridSize = 25
    gridCtx.strokeStyle = '#e8e8ea'
    gridCtx.lineWidth = 1

    for (let x = 0; x < rect.width; x += gridSize) {
      gridCtx.beginPath()
      gridCtx.moveTo(x, 0)
      gridCtx.lineTo(x, rect.height)
      gridCtx.stroke()
    }

    for (let y = 0; y < rect.height; y += gridSize) {
      gridCtx.beginPath()
      gridCtx.moveTo(0, y)
      gridCtx.lineTo(rect.width, y)
      gridCtx.stroke()
    }

    drawingCtx.lineWidth = penSize
    drawingCtx.lineCap = 'round'
    drawingCtx.lineJoin = 'round'

    saveState()
  }, [penSize, saveState])

  useEffect(() => {
    initCanvas()

    const handleResize = () => initCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [initCanvas])

  useEffect(() => {
    initCanvas()
    setHasDrawn(false)
    onContentChange(false)
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
    historyRef.current = []
    historyStepRef.current = 0
  }, [clearTrigger, onContentChange, initCanvas])

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = drawingLayerRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const x = ((clientX - rect.left) / rect.width) * canvas.width / (window.devicePixelRatio || 1)
    const y = ((clientY - rect.top) / rect.height) * canvas.height / (window.devicePixelRatio || 1)

    return { x, y }
  }

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (e.shiftKey || (e as React.MouseEvent).button === 1) {
      setIsPanning(true)
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      setLastPanPoint({ x: clientX, y: clientY })
      return
    }

    setIsDrawing(true)
    const canvas = drawingLayerRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    lastPointRef.current = { x, y }

    if (tool === 'pen') {
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = penSize
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = eraserSize
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault()

    if (isPanning) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      const deltaX = clientX - lastPanPoint.x
      const deltaY = clientY - lastPanPoint.y

      setPanOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }))

      setLastPanPoint({ x: clientX, y: clientY })
      return
    }

    if (!isDrawing) return

    const canvas = drawingLayerRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (lastPointRef.current) {
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, y)
      }
      lastPointRef.current = { x, y }

      if (!hasDrawn) {
        setHasDrawn(true)
        onContentChange(true)
      }
    })
  }

  const stopDrawing = () => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (isDrawing) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      const canvas = drawingLayerRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over'
        }
        saveState()
        
        if (onCanvasDataUrl) {
          const gridCanvas = canvasRef.current
          if (gridCanvas) {
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = canvas.width
            tempCanvas.height = canvas.height
            const tempCtx = tempCanvas.getContext('2d')
            if (tempCtx) {
              tempCtx.drawImage(gridCanvas, 0, 0)
              tempCtx.drawImage(canvas, 0, 0)
              onCanvasDataUrl(tempCanvas.toDataURL('image/png'))
            }
          }
        }
      }
      lastPointRef.current = null
    }
    setIsDrawing(false)
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)))
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-muted/30 rounded-lg border transition-all'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === 'pen' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('pen')}
          >
            <PencilSimple size={18} />
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('eraser')}
          >
            <Eraser size={18} />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {tool === 'pen' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Größe:</span>
              <input
                type="range"
                min="1"
                max="10"
                value={penSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value)
                  setPenSize(newSize)
                  const canvas = drawingLayerRef.current
                  if (canvas) {
                    const ctx = canvas.getContext('2d')
                    if (ctx && tool === 'pen') {
                      ctx.lineWidth = newSize
                    }
                  }
                }}
                className="w-20"
              />
              <Badge variant="secondary">{penSize}px</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Größe:</span>
              <input
                type="range"
                min="10"
                max="50"
                value={eraserSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value)
                  setEraserSize(newSize)
                  const canvas = drawingLayerRef.current
                  if (canvas) {
                    const ctx = canvas.getContext('2d')
                    if (ctx && tool === 'eraser') {
                      ctx.lineWidth = newSize
                    }
                  }
                }}
                className="w-20"
              />
              <Badge variant="secondary">{eraserSize}px</Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyStepRef.current <= 0}>
            <ArrowCounterClockwise size={18} />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoom <= 0.5}>
            <MagnifyingGlassMinus size={18} />
          </Button>
          <Badge variant="outline" className="min-w-[60px] justify-center">
            {Math.round(zoom * 100)}%
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoom >= 3}>
            <MagnifyingGlassPlus size={18} />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsExpanded(!isExpanded)
              setTimeout(() => initCanvas(), 100)
            }}
            title={isExpanded ? 'Verkleinern' : 'Vergrößern'}
          >
            <ArrowsOutSimple size={18} />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className={cn("flex-1 overflow-hidden bg-white relative", isExpanded ? "min-h-[calc(100vh-140px)]" : "min-h-[400px]")}>
        <canvas
          ref={canvasRef}
          className="absolute pointer-events-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        />
        <canvas
          ref={drawingLayerRef}
          className="absolute cursor-crosshair touch-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onWheel={handleWheel}
        />
      </div>

      <div className="px-4 py-2 border-t bg-card/50 text-xs text-muted-foreground">
        <span>Tipp: Shift + Ziehen zum Verschieben | Strg + Scroll zum Zoomen</span>
      </div>
    </div>
  )
}
