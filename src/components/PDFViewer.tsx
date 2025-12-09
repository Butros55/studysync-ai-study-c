import { useState, useEffect, useRef, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from './ui/button'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Globaler Cache für geladene PDFs und gerenderte Seiten
const pdfCache = new Map<string, pdfjsLib.PDFDocumentProxy>()
const pageImageCache = new Map<string, string>()

function getCacheKey(fileData: string): string {
  // Verwende Hash der ersten 1000 Zeichen als Key für Performance
  return fileData.slice(0, 1000)
}

interface PDFViewerProps {
  fileData: string
  /** Höhere Render-Qualität für bessere Lesbarkeit */
  highQuality?: boolean
}

export function PDFViewer({ fileData, highQuality = true }: PDFViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [longLoad, setLongLoad] = useState(false)
  
  const cacheKey = useMemo(() => getCacheKey(fileData), [fileData])
  // Höhere Scale für bessere Lesbarkeit (2.5 für highQuality, 1.5 für Standard)
  const renderScale = highQuality ? 2.5 : 1.5

  useEffect(() => {
    loadPDF()
  }, [fileData])

  useEffect(() => {
    if (!loading) {
      setLongLoad(false)
      return
    }
    const timer = setTimeout(() => setLongLoad(true), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    if (pdf && currentPage) {
      renderPage(currentPage)
    }
  }, [pdf, currentPage])

  const loadPDF = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Check Cache first
      const cachedPdf = pdfCache.get(cacheKey)
      if (cachedPdf) {
        setPdf(cachedPdf)
        // Lade gecachte Seiten-Bilder
        const images: string[] = []
        for (let i = 1; i <= cachedPdf.numPages; i++) {
          const pageKey = `${cacheKey}-page-${i}-scale-${renderScale}`
          images.push(pageImageCache.get(pageKey) || '')
        }
        setPageImages(images)
        setLoading(false)
        return
      }
      
      const base64Data = fileData.split(',')[1]
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const loadedPdf = await pdfjsLib.getDocument({ data: bytes }).promise
      
      // Cache the PDF
      pdfCache.set(cacheKey, loadedPdf)
      setPdf(loadedPdf)
      
      const images: string[] = []
      for (let i = 1; i <= loadedPdf.numPages; i++) {
        // Check if page is already cached
        const pageKey = `${cacheKey}-page-${i}-scale-${renderScale}`
        images.push(pageImageCache.get(pageKey) || '')
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
    if (!pdf) return
    
    const pageKey = `${cacheKey}-page-${pageNumber}-scale-${renderScale}`
    
    // Check cache first
    const cachedImage = pageImageCache.get(pageKey)
    if (cachedImage && pageImages[pageNumber - 1] === cachedImage) {
      return // Already have this image
    }
    if (cachedImage) {
      setPageImages((prev) => {
        const newImages = [...prev]
        newImages[pageNumber - 1] = cachedImage
        return newImages
      })
      return
    }

    try {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: renderScale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise

      const imageUrl = canvas.toDataURL('image/png', 1.0)
      
      // Cache the rendered page
      pageImageCache.set(pageKey, imageUrl)
      
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
        <div className={`w-full ${longLoad ? 'h-[460px]' : 'h-[620px]'} rounded-lg border border-muted bg-gradient-to-b from-sky-50 to-slate-100 flex items-center justify-center transition-all duration-300`}>
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="h-10 w-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            <p className="text-sm font-medium">PDF wird geladen...</p>
          </div>
        </div>
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
            draggable={false}
          />
        ) : (
          <div className={`w-full ${longLoad ? 'h-[460px]' : 'h-[620px]'} rounded-lg border border-muted bg-gradient-to-b from-sky-50 to-slate-100 flex items-center justify-center transition-all duration-300`}>
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <div className="h-8 w-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
              <p className="text-sm font-medium">Seite wird geladen...</p>
            </div>
          </div>
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
