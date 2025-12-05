/**
 * FormulaSheetPanel - Ausklappbare Seitenleiste für Formelsammlungen
 * 
 * Zeigt Formelsammlungen aus dem aktuellen Modul an.
 * Kann im TaskSolver, ExamMode und QuizMode verwendet werden.
 */

import { useState } from 'react'
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
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { PDFViewer } from './PDFViewer'
import { cn } from '@/lib/utils'

interface FormulaSheetPanelProps {
  /** Formelsammlungen aus dem aktuellen Modul */
  formulaSheets: Script[]
  /** Ob Panel initial offen ist */
  defaultOpen?: boolean
  /** Zusätzliche CSS-Klassen */
  className?: string
}

export function FormulaSheetPanel({
  formulaSheets,
  defaultOpen = false,
  className,
}: FormulaSheetPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [selectedSheet, setSelectedSheet] = useState<Script | null>(null)
  const [pdfScale, setPdfScale] = useState(1)

  const handleSelectSheet = (sheet: Script) => {
    setSelectedSheet(sheet)
    setPdfScale(1)
  }

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

  return (
    <>
      {/* Toggle-Button am rechten Rand */}
      <motion.div
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40",
          className
        )}
        initial={false}
        animate={{ x: isOpen ? -320 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <Button
          variant="secondary"
          size="sm"
          className="rounded-l-lg rounded-r-none h-24 px-1.5 shadow-lg border-r-0"
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

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-80 bg-background border-l shadow-2xl z-50 flex flex-col",
              className
            )}
          >
            {/* Header */}
            <div className="border-b p-3 flex items-center justify-between shrink-0">
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
                // Dateiliste
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
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
                  <div className="border-b p-2 flex items-center justify-between shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSheet(null)}
                    >
                      <CaretLeft size={16} className="mr-1" />
                      Zurück
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))}
                      >
                        <MagnifyingGlassMinus size={14} />
                      </Button>
                      <span className="text-xs w-12 text-center">
                        {Math.round(pdfScale * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPdfScale(s => Math.min(3, s + 0.25))}
                      >
                        <MagnifyingGlassPlus size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Content Viewer */}
                  <ScrollArea className="flex-1">
                    <div className="p-2" style={{ transform: `scale(${pdfScale})`, transformOrigin: 'top left' }}>
                      {selectedSheet.fileType === 'pdf' && selectedSheet.fileData ? (
                        <PDFViewer
                          fileData={selectedSheet.fileData}
                        />
                      ) : selectedSheet.fileType === 'image' && selectedSheet.fileData ? (
                        <img
                          src={selectedSheet.fileData}
                          alt={selectedSheet.name}
                          className="w-full rounded-lg"
                        />
                      ) : (
                        <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-full overflow-auto">
                          {selectedSheet.content}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Footer Hint */}
            <div className="border-t p-2 text-center shrink-0">
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
