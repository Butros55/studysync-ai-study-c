import { useState, useEffect } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

interface PPTXViewerProps {
  fileData: string
  content: string
}

export function PPTXViewer({ fileData, content }: PPTXViewerProps) {
  const [slides, setSlides] = useState<string[]>([])
  const [currentSlide, setCurrentSlide] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    parseSlides()
  }, [content])

  const parseSlides = () => {
    const slideTexts = content.split('--- Slide')
      .filter(Boolean)
      .map(slide => {
        const lines = slide.trim().split('\n')
        const slideNumber = lines[0].replace('---', '').trim()
        const slideContent = lines.slice(1).join('\n').trim()
        return slideContent
      })
    
    setSlides(slideTexts)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-[500px]" />
      </div>
    )
  }

  if (slides.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No slides found in presentation</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border-2 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
        <div className="w-full max-w-3xl">
          <div className="mb-4 text-sm text-muted-foreground font-medium">
            Slide {currentSlide}
          </div>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">
              {slides[currentSlide - 1]}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentSlide((p) => Math.max(1, p - 1))}
          disabled={currentSlide === 1}
        >
          <CaretLeft size={16} className="mr-1" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          Slide {currentSlide} of {slides.length}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentSlide((p) => Math.min(slides.length, p + 1))}
          disabled={currentSlide === slides.length}
        >
          Next
          <CaretRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  )
}
