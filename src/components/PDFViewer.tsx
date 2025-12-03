import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface PDFViewerProps {
  fileData: string
}

export function PDFViewer({ fileData }: PDFViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPDF()
  }, [fileData])

  useEffect(() => {
    if (pdf && currentPage) {
      renderPage(currentPage)
    }
  }, [pdf, currentPage])

  const loadPDF = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const base64Data = fileData.split(',')[1]
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const loadedPdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setPdf(loadedPdf)
      
      const images: string[] = []
      for (let i = 1; i <= loadedPdf.numPages; i++) {
        images.push('')
      }
      setPageImages(images)
      
      setLoading(false)
    } catch (err) {
      console.error('Error loading PDF:', err)
      setError('Failed to load PDF')
      setLoading(false)
    }
  }

  const renderPage = async (pageNumber: number) => {
    if (!pdf || pageImages[pageNumber - 1]) return

    try {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.5 })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise

      const imageUrl = canvas.toDataURL()
      setPageImages((prev) => {
        const newImages = [...prev]
        newImages[pageNumber - 1] = imageUrl
        return newImages
      })
    } catch (err) {
      console.error('Error rendering page:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-[600px]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!pdf) return null

  return (
    <div className="space-y-4">
      <div className="bg-muted rounded-lg overflow-hidden">
        {pageImages[currentPage - 1] ? (
          <img
            src={pageImages[currentPage - 1]}
            alt={`Page ${currentPage}`}
            className="w-full h-auto"
          />
        ) : (
          <Skeleton className="w-full h-[600px]" />
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <CaretLeft size={16} className="mr-1" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {pdf.numPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p) => Math.min(pdf.numPages, p + 1))}
          disabled={currentPage === pdf.numPages}
        >
          Next
          <CaretRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  )
}
