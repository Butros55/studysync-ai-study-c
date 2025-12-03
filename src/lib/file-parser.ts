import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
  let fullText = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
    fullText += pageText + '\n\n'
  }
  
  return fullText.trim()
}

export async function parsePPTX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  
  try {
    const PPTXParser = (await import('pptx-parser')).default
    const parser = new PPTXParser()
    const result = await parser.parse(arrayBuffer)
    
    let fullText = ''
    
    if (result && result.slides) {
      result.slides.forEach((slide: any, index: number) => {
        fullText += `--- Slide ${index + 1} ---\n`
        
        if (slide.text) {
          fullText += slide.text + '\n'
        }
        
        if (slide.title) {
          fullText += slide.title + '\n'
        }
        
        if (slide.content) {
          fullText += slide.content + '\n'
        }
        
        fullText += '\n'
      })
    }
    
    return fullText.trim()
  } catch (error) {
    throw new Error('Failed to parse PPTX file')
  }
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export function isValidFileType(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['pdf', 'pptx'].includes(ext)
}

export async function parseFile(file: File): Promise<string> {
  const ext = getFileExtension(file.name)
  
  switch (ext) {
    case 'pdf':
      return await parsePDF(file)
    case 'pptx':
      return await parsePPTX(file)
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }
}
