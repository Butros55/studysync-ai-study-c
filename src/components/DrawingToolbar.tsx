import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Eraser,
  PencilSimple,
  ArrowsOutSimple,
  ArrowsInSimple,
  ArrowCounterClockwise,
  ArrowClockwise,
  SelectionAll,
  CaretUp,
  CaretDown,
  Palette,
  ArrowsOut,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { DrawingTool } from '@/hooks/use-drawing-state'
import { useState } from 'react'

interface DrawingToolbarProps {
  tool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  penColor: string
  onPenColorChange: (color: string) => void
  penWidth: number
  onPenWidthChange: (width: number) => void
  eraserWidth: number
  onEraserWidthChange: (width: number) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  isFullscreen: boolean
  onFullscreenToggle: () => void
  onResetView: () => void
  scale: number
  predefinedColors: string[]
}

export function DrawingToolbar({
  tool,
  onToolChange,
  penColor,
  onPenColorChange,
  penWidth,
  onPenWidthChange,
  eraserWidth,
  onEraserWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isFullscreen,
  onFullscreenToggle,
  onResetView,
  scale,
  predefinedColors,
}: DrawingToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (isCollapsed) {
    return (
      <div className="absolute top-2 right-2 z-20">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          className="h-8 w-8 p-0 shadow-md bg-white/90 backdrop-blur-sm border"
        >
          <CaretDown size={16} />
        </Button>
      </div>
    )
  }

  return (
    <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
      {/* Haupttoolbar */}
      <div className="flex items-center gap-1 p-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border">
        {/* Tool-Auswahl */}
        <div className="flex items-center gap-0.5">
          <Button
            variant={tool === 'pen' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToolChange('pen')}
            className="h-8 w-8 p-0"
            title="Stift (P)"
          >
            <PencilSimple size={18} />
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToolChange('eraser')}
            className="h-8 w-8 p-0"
            title="Radierer (E)"
          >
            <Eraser size={18} />
          </Button>
          <Button
            variant={tool === 'select' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToolChange('select')}
            className="h-8 w-8 p-0"
            title="Auswahl (S)"
          >
            <SelectionAll size={18} />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Farbe (nur bei Stift) */}
        {tool === 'pen' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Farbe"
                >
                  <div
                    className="w-5 h-5 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: penColor }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="flex gap-1">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => onPenColorChange(color)}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                        penColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-1" />
          </>
        )}

        {/* Größe */}
        <div className="flex items-center gap-1.5 px-1">
          <input
            type="range"
            min={tool === 'eraser' ? 10 : 1}
            max={tool === 'eraser' ? 50 : 15}
            value={tool === 'eraser' ? eraserWidth : penWidth}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (tool === 'eraser') {
                onEraserWidthChange(value)
              } else {
                onPenWidthChange(value)
              }
            }}
            className="w-16 h-1 accent-primary"
          />
          <Badge variant="secondary" className="text-xs min-w-[36px] justify-center">
            {tool === 'eraser' ? eraserWidth : penWidth}px
          </Badge>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-8 w-8 p-0"
            title="Rückgängig (Strg+Z)"
          >
            <ArrowCounterClockwise size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-8 w-8 p-0"
            title="Wiederholen (Strg+Y)"
          >
            <ArrowClockwise size={18} />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* View-Kontrollen */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetView}
            className="h-8 px-2"
            title="Ansicht zurücksetzen"
          >
            <ArrowsOut size={16} className="mr-1" />
            <span className="text-xs">{Math.round(scale * 100)}%</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullscreenToggle}
            className="h-8 w-8 p-0"
            title={isFullscreen ? 'Vollbild beenden' : 'Vollbild'}
          >
            {isFullscreen ? <ArrowsInSimple size={18} /> : <ArrowsOutSimple size={18} />}
          </Button>
        </div>

        {/* Einklappen-Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(true)}
          className="h-8 w-8 p-0 ml-1"
          title="Toolbar einklappen"
        >
          <CaretUp size={16} />
        </Button>
      </div>
    </div>
  )
}
