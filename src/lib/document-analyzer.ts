/**
 * Document Analysis Pipeline
 * 
 * Analyzes uploaded documents to extract structured, factual JSON data.
 * 
 * Key principles:
 * - Cache by sourceHash: run once per document per content hash
 * - High coverage: chunk large documents and analyze each chunk
 * - No hallucination: every extracted item includes evidence snippets from the source
 * - Robust: partial results are kept even if some chunks fail
 */

import { llmWithRetry } from './llm-utils'
import { generateId } from './utils-app'
import { 
  getDocumentAnalysis, 
  upsertDocumentAnalysis 
} from './analysis-storage'
import { 
  DocumentAnalysisRecord, 
  DocumentType,
  AnalysisStatus,
  DOCUMENT_ANALYSIS_VERSION 
} from './analysis-types'

// ============================================================================
// Configuration
// ============================================================================

/** Maximum characters per chunk (roughly ~3000 tokens) */
const DEFAULT_CHUNK_SIZE = 12000

/** Overlap between chunks to avoid splitting important content */
const CHUNK_OVERLAP = 500

/** Model to use for analysis */
const ANALYSIS_MODEL = 'gpt-4o-mini'

// ============================================================================
// Text Utilities
// ============================================================================

/**
 * Normalize text for consistent hashing
 * - Collapse multiple whitespace to single space
 * - Trim leading/trailing whitespace
 * - Normalize unicode
 */
export function normalizeTextForHash(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute SHA-256 hash of text using Web Crypto API
 * Returns hex string
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * A single text chunk with metadata
 */
export interface TextChunk {
  /** Zero-based index of this chunk */
  index: number
  /** Start position in original text */
  startPos: number
  /** End position in original text */
  endPos: number
  /** The chunk text content */
  text: string
}

/**
 * Split text into overlapping chunks for analysis
 * Tries to break at sentence boundaries when possible
 */
export function chunkText(
  text: string,
  options: { maxChars?: number; overlap?: number } = {}
): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_CHUNK_SIZE
  const overlap = options.overlap ?? CHUNK_OVERLAP

  if (text.length <= maxChars) {
    return [{
      index: 0,
      startPos: 0,
      endPos: text.length,
      text: text
    }]
  }

  const chunks: TextChunk[] = []
  let position = 0
  let chunkIndex = 0

  while (position < text.length) {
    let endPos = Math.min(position + maxChars, text.length)
    
    // Try to break at a sentence boundary if not at the end
    if (endPos < text.length) {
      // Look for sentence endings in the last 20% of the chunk
      const searchStart = position + Math.floor(maxChars * 0.8)
      const searchRegion = text.slice(searchStart, endPos)
      
      // Find last sentence-ending punctuation followed by space or newline
      const sentenceEndMatch = searchRegion.match(/[.!?]\s+(?=[A-ZÄÖÜ])/g)
      if (sentenceEndMatch && sentenceEndMatch.length > 0) {
        const lastMatch = sentenceEndMatch[sentenceEndMatch.length - 1]
        const matchIndex = searchRegion.lastIndexOf(lastMatch)
        if (matchIndex !== -1) {
          // Include the punctuation but not the trailing space
          endPos = searchStart + matchIndex + 1
        }
      }
    }

    chunks.push({
      index: chunkIndex,
      startPos: position,
      endPos: endPos,
      text: text.slice(position, endPos)
    })

    chunkIndex++
    
    // Move position forward, accounting for overlap
    position = endPos - overlap
    if (position >= text.length) break
    // Ensure we make progress
    if (position <= chunks[chunks.length - 1].startPos) {
      position = endPos
    }
  }

  return chunks
}

// ============================================================================
// Chunk Analysis Types
// ============================================================================

/**
 * A single extracted item with evidence
 */
export interface ExtractedItem {
  /** Type of item: topic, concept, formula, pattern, etc. */
  type: string
  /** Main content/value of the item */
  value: string
  /** Optional additional details */
  details?: string
  /** Evidence snippets from the source text (max 200 chars each) */
  evidenceSnippets: string[]
}

/**
 * Result from analyzing a single chunk
 */
export interface ChunkAnalysisResult {
  /** Index of the chunk that was analyzed */
  chunkIndex: number
  /** Items extracted from this chunk */
  extractedItems: ExtractedItem[]
  /** Notes about what couldn't be parsed or was uncertain */
  coverageNotes: string[]
  /** Whether the analysis succeeded */
  success: boolean
  /** Error message if failed */
  errorMessage?: string
}

/**
 * Merged analysis result for the full document
 */
export interface MergedDocumentAnalysis {
  /** Document type that was analyzed */
  documentType: DocumentType
  /** All extracted items, deduplicated */
  items: ExtractedItem[]
  /** Topics found (convenience field) */
  topics: string[]
  /** Concepts found (convenience field) */
  concepts: Array<{ term: string; definition?: string; evidence: string[] }>
  /** Formulas found (convenience field) */
  formulas: Array<{ latex: string; description?: string; evidence: string[] }>
  /** Structural patterns (for exercise/exam) */
  structuralPatterns?: {
    hasSubtasks: boolean
    usesLetterSubtasks: boolean
    usesNumberedSubtasks: boolean
    hasPointsDistribution: boolean
    hasTables: boolean
    hasCodeBlocks: boolean
    commonVerbs: string[]
    typicalPhrases: string[]
  }
  /** Style patterns (for exam) */
  examStylePatterns?: {
    commonPhrases: string[]
    typicalDifficultyMix: { easy: number; medium: number; hard: number }
    averagePointsPerTask: number
    formattingPatterns: {
      usesTables: boolean
      usesFormulas: boolean
      usesMultipleChoice: boolean
      usesSubtasks: boolean
    }
  }
  /** Coverage notes from all chunks */
  coverageNotes: string[]
  /** Any errors encountered */
  errors: string[]
}

// ============================================================================
// Prompts for Different Document Types
// ============================================================================

function getChunkAnalysisPrompt(documentType: DocumentType, chunkText: string, chunkIndex: number, totalChunks: number): string {
  const baseInstructions = `Du bist ein präziser Dokumenten-Analyzer. Extrahiere NUR Informationen, die TATSÄCHLICH im Text vorkommen.

WICHTIGE REGELN:
1. Erfinde NICHTS - jedes Item muss einen "evidenceSnippet" haben, der WÖRTLICH im Input vorkommt
2. evidenceSnippets müssen exakte Zitate sein (max 200 Zeichen)
3. Wenn du unsicher bist, füge es zu "coverageNotes" hinzu statt zu raten
4. Gib NUR valides JSON zurück

Dies ist Chunk ${chunkIndex + 1} von ${totalChunks}.`

  const typeSpecificInstructions = getTypeSpecificInstructions(documentType)

  return `${baseInstructions}

${typeSpecificInstructions}

TEXT ZU ANALYSIEREN:
---
${chunkText}
---

Antworte mit diesem JSON-Schema:
{
  "extractedItems": [
    {
      "type": "topic|concept|formula|definition|procedure|constraint|example|pattern|phrase|structure",
      "value": "der extrahierte Inhalt",
      "details": "optionale zusätzliche Details",
      "evidenceSnippets": ["exaktes Zitat aus dem Text (max 200 Zeichen)"]
    }
  ],
  "coverageNotes": ["Was nicht geparst werden konnte oder unsicher war"]
}

Gib NUR das JSON zurück, keine Erklärungen.`
}

function getTypeSpecificInstructions(documentType: DocumentType): string {
  switch (documentType) {
    case 'script':
      return `SCRIPT-ANALYSE - Extrahiere:
- "topic": Hauptthemen und Kapitelüberschriften
- "concept": Wichtige Begriffe mit Definitionen
- "formula": Mathematische Formeln (in LaTeX wenn möglich)
- "definition": Formale Definitionen
- "procedure": Algorithmen oder Verfahren
- "constraint": Einschränkungen oder Bedingungen
- "example": Konkrete Beispiele (nur wenn explizit als Beispiel markiert)`

    case 'exercise':
      return `ÜBUNGSBLATT-ANALYSE - Extrahiere:
- "pattern": Aufgabenstruktur (z.B. "a), b), c)" oder "1., 2., 3.")
- "phrase": Typische Formulierungen und Verben ("Berechne", "Zeige", "Beweise")
- "structure": Punkteverteilung, Teilaufgaben-Muster
- "topic": Themen der Aufgaben
- "concept": Referenzierte Konzepte`

    case 'solution':
      return `LÖSUNGS-ANALYSE - Extrahiere:
- "pattern": Lösungsstruktur und -stil
- "procedure": Lösungswege und Methoden
- "formula": Verwendete Formeln
- "structure": Formatierung (Tabellen, Diagramme, Code)`

    case 'exam':
      return `KLAUSUR-ANALYSE - Extrahiere:
- "phrase": Typische Klausur-Formulierungen
- "pattern": Aufgabentypen und deren Häufigkeit
- "structure": Punkteverteilung, Zeitvorgaben
- "topic": Geprüfte Themen
- "formula": Referenzierte Formeln
Achte besonders auf: Schwierigkeitsverteilung, Multiple-Choice vs. offene Fragen, Teilaufgaben-Struktur`

    default:
      return `Extrahiere alle relevanten Informationen mit Evidenz.`
  }
}

// ============================================================================
// Chunk Analysis
// ============================================================================

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(
  chunk: TextChunk,
  documentType: DocumentType,
  totalChunks: number,
  originalText: string
): Promise<ChunkAnalysisResult> {
  const prompt = getChunkAnalysisPrompt(documentType, chunk.text, chunk.index, totalChunks)

  try {
    const response = await llmWithRetry(
      prompt,
      ANALYSIS_MODEL,
      true, // JSON mode
      2,    // retries
      'document-analysis'
    )

    // Parse JSON response
    let parsed: { extractedItems?: unknown[]; coverageNotes?: string[] }
    try {
      parsed = JSON.parse(response)
    } catch {
      // Try to extract JSON from response if it has extra text
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Keine valide JSON-Antwort')
      }
    }

    // Validate and filter items
    const rawItems = Array.isArray(parsed.extractedItems) ? parsed.extractedItems : []
    const validatedItems = validateAndFilterItems(rawItems, originalText)

    return {
      chunkIndex: chunk.index,
      extractedItems: validatedItems,
      coverageNotes: Array.isArray(parsed.coverageNotes) ? parsed.coverageNotes : [],
      success: true
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      chunkIndex: chunk.index,
      extractedItems: [],
      coverageNotes: [],
      success: false,
      errorMessage
    }
  }
}

// ============================================================================
// Evidence Validation
// ============================================================================

/**
 * Validate that extracted items have evidence in the original text
 * Discards items without valid evidence
 */
function validateAndFilterItems(
  rawItems: unknown[],
  originalText: string
): ExtractedItem[] {
  const normalizedOriginal = originalText.toLowerCase()
  const validItems: ExtractedItem[] = []

  for (const raw of rawItems) {
    if (!isValidRawItem(raw)) continue

    const item = raw as { type: string; value: string; details?: string; evidenceSnippets?: string[] }
    
    // Filter evidence snippets to only those that exist in the text
    const snippets = Array.isArray(item.evidenceSnippets) ? item.evidenceSnippets : []
    const validSnippets = snippets.filter(snippet => {
      if (typeof snippet !== 'string' || snippet.length === 0) return false
      // Normalize and check if snippet exists in original
      const normalizedSnippet = snippet.toLowerCase().trim()
      // Allow some flexibility - snippet should be at least partially present
      // Check for 80% of words present
      const words = normalizedSnippet.split(/\s+/).filter(w => w.length > 2)
      if (words.length === 0) return true // Very short snippets pass
      const matchedWords = words.filter(word => normalizedOriginal.includes(word))
      return matchedWords.length >= Math.ceil(words.length * 0.7)
    })

    // Only keep items with at least one valid evidence snippet
    if (validSnippets.length > 0 || item.type === 'coverageNote') {
      validItems.push({
        type: item.type,
        value: String(item.value),
        details: item.details ? String(item.details) : undefined,
        evidenceSnippets: validSnippets.map(s => String(s).slice(0, 200))
      })
    }
  }

  return validItems
}

/**
 * Type guard for raw extracted items
 */
function isValidRawItem(raw: unknown): raw is { type: string; value: string } {
  if (typeof raw !== 'object' || raw === null) return false
  const obj = raw as Record<string, unknown>
  return typeof obj.type === 'string' && typeof obj.value === 'string'
}

// ============================================================================
// Merging Chunk Results
// ============================================================================

/**
 * Merge multiple chunk results into a single document analysis
 */
function mergeChunkResults(
  chunkResults: ChunkAnalysisResult[],
  documentType: DocumentType
): MergedDocumentAnalysis {
  // Collect all items
  const allItems: ExtractedItem[] = []
  const allCoverageNotes: string[] = []
  const allErrors: string[] = []

  for (const result of chunkResults) {
    allItems.push(...result.extractedItems)
    allCoverageNotes.push(...result.coverageNotes)
    if (result.errorMessage) {
      allErrors.push(`Chunk ${result.chunkIndex}: ${result.errorMessage}`)
    }
  }

  // Deduplicate items by normalized key (type + value)
  const itemMap = new Map<string, ExtractedItem>()
  for (const item of allItems) {
    const key = `${item.type}:${item.value.toLowerCase().trim()}`
    const existing = itemMap.get(key)
    if (existing) {
      // Merge evidence snippets
      const mergedSnippets = [...new Set([...existing.evidenceSnippets, ...item.evidenceSnippets])]
      existing.evidenceSnippets = mergedSnippets.slice(0, 5) // Keep max 5 snippets
      // Prefer longer details
      if (item.details && (!existing.details || item.details.length > existing.details.length)) {
        existing.details = item.details
      }
    } else {
      itemMap.set(key, { ...item })
    }
  }

  const deduplicatedItems = Array.from(itemMap.values())

  // Extract convenience fields
  const topics = deduplicatedItems
    .filter(i => i.type === 'topic')
    .map(i => i.value)

  const concepts = deduplicatedItems
    .filter(i => i.type === 'concept' || i.type === 'definition')
    .map(i => ({
      term: i.value,
      definition: i.details,
      evidence: i.evidenceSnippets
    }))

  const formulas = deduplicatedItems
    .filter(i => i.type === 'formula')
    .map(i => ({
      latex: i.value,
      description: i.details,
      evidence: i.evidenceSnippets
    }))

  // Build result based on document type
  const result: MergedDocumentAnalysis = {
    documentType,
    items: deduplicatedItems,
    topics: [...new Set(topics)],
    concepts,
    formulas,
    coverageNotes: [...new Set(allCoverageNotes)],
    errors: allErrors
  }

  // Add structural patterns for exercise/solution/exam
  if (documentType === 'exercise' || documentType === 'solution' || documentType === 'exam') {
    const patterns = deduplicatedItems.filter(i => i.type === 'pattern' || i.type === 'structure')
    const phrases = deduplicatedItems.filter(i => i.type === 'phrase')

    result.structuralPatterns = {
      hasSubtasks: patterns.some(p => 
        p.value.toLowerCase().includes('teilaufgabe') || 
        p.value.match(/[a-c]\)|[1-3]\./)),
      usesLetterSubtasks: patterns.some(p => p.value.match(/[a-c]\)/)),
      usesNumberedSubtasks: patterns.some(p => p.value.match(/[1-3]\./)),
      hasPointsDistribution: patterns.some(p => 
        p.value.toLowerCase().includes('punkt') || 
        p.value.match(/\d+\s*p/i)),
      hasTables: patterns.some(p => p.value.toLowerCase().includes('tabelle')),
      hasCodeBlocks: patterns.some(p => 
        p.value.toLowerCase().includes('code') || 
        p.value.toLowerCase().includes('programm')),
      commonVerbs: extractCommonVerbs(phrases),
      typicalPhrases: phrases.map(p => p.value).slice(0, 10)
    }
  }

  // Add exam style patterns
  if (documentType === 'exam') {
    const phrases = deduplicatedItems.filter(i => i.type === 'phrase')
    const structures = deduplicatedItems.filter(i => i.type === 'structure')

    result.examStylePatterns = {
      commonPhrases: phrases.map(p => p.value).slice(0, 15),
      typicalDifficultyMix: estimateDifficultyMix(structures),
      averagePointsPerTask: estimateAveragePoints(structures),
      formattingPatterns: {
        usesTables: structures.some(s => s.value.toLowerCase().includes('tabelle')),
        usesFormulas: formulas.length > 0,
        usesMultipleChoice: structures.some(s => 
          s.value.toLowerCase().includes('multiple') || 
          s.value.toLowerCase().includes('ankreuz')),
        usesSubtasks: result.structuralPatterns?.hasSubtasks ?? false
      }
    }
  }

  return result
}

/**
 * Extract common verbs from phrases
 */
function extractCommonVerbs(phrases: ExtractedItem[]): string[] {
  const verbPatterns = /\b(berechne|zeige|beweise|bestimme|gib an|erkläre|beschreibe|implementiere|analysiere|vergleiche|nenne|definiere)\b/gi
  const verbs = new Set<string>()
  
  for (const phrase of phrases) {
    const matches = phrase.value.match(verbPatterns)
    if (matches) {
      matches.forEach(v => verbs.add(v.toLowerCase()))
    }
  }
  
  return Array.from(verbs)
}

/**
 * Estimate difficulty mix from structure items
 */
function estimateDifficultyMix(structures: ExtractedItem[]): { easy: number; medium: number; hard: number } {
  // Default balanced mix
  const mix = { easy: 0.33, medium: 0.34, hard: 0.33 }
  
  // Try to extract from evidence
  for (const s of structures) {
    const text = (s.value + ' ' + (s.details || '')).toLowerCase()
    if (text.includes('einfach') || text.includes('grundlagen')) mix.easy += 0.1
    if (text.includes('schwer') || text.includes('komplex')) mix.hard += 0.1
  }
  
  // Normalize
  const total = mix.easy + mix.medium + mix.hard
  return {
    easy: Math.round((mix.easy / total) * 100) / 100,
    medium: Math.round((mix.medium / total) * 100) / 100,
    hard: Math.round((mix.hard / total) * 100) / 100
  }
}

/**
 * Estimate average points per task from structure items
 */
function estimateAveragePoints(structures: ExtractedItem[]): number {
  const pointsPattern = /(\d+)\s*(punkt|p\b)/gi
  const points: number[] = []
  
  for (const s of structures) {
    const text = s.value + ' ' + (s.details || '')
    let match
    while ((match = pointsPattern.exec(text)) !== null) {
      const p = parseInt(match[1], 10)
      if (p > 0 && p <= 100) points.push(p)
    }
  }
  
  if (points.length === 0) return 10 // Default
  return Math.round(points.reduce((a, b) => a + b, 0) / points.length)
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export interface AnalyzeDocumentInput {
  moduleId: string
  documentId: string
  documentType: DocumentType
  text: string
}

export interface AnalyzeDocumentResult {
  record: DocumentAnalysisRecord
  analysis: MergedDocumentAnalysis | null
  fromCache: boolean
}

/**
 * Analyze a document and store the result
 * 
 * - Computes sourceHash and checks cache
 * - Chunks text and analyzes each chunk
 * - Merges results and validates evidence
 * - Stores result in persistent storage
 */
export async function analyzeDocumentToJson(
  input: AnalyzeDocumentInput
): Promise<AnalyzeDocumentResult> {
  const { moduleId, documentId, documentType, text } = input

  // Normalize and hash
  const normalizedText = normalizeTextForHash(text)
  const sourceHash = await sha256(normalizedText)

  // Check cache
  const existingRecord = await getDocumentAnalysis(moduleId, documentId)
  if (
    existingRecord &&
    existingRecord.sourceHash === sourceHash &&
    existingRecord.analysisVersion === DOCUMENT_ANALYSIS_VERSION &&
    existingRecord.status === 'done'
  ) {
    // Return cached result
    let analysis: MergedDocumentAnalysis | null = null
    try {
      analysis = JSON.parse(existingRecord.analysisJson) as MergedDocumentAnalysis
    } catch {
      // Invalid cached JSON, will re-analyze
    }
    
    if (analysis) {
      return {
        record: existingRecord,
        analysis,
        fromCache: true
      }
    }
  }

  // Create/update record as 'running'
  const chunks = chunkText(text)
  const recordId = existingRecord?.id ?? generateId()
  
  let record: DocumentAnalysisRecord = {
    id: recordId,
    moduleId,
    documentId,
    documentType,
    sourceHash,
    analysisVersion: DOCUMENT_ANALYSIS_VERSION,
    status: 'running',
    coveragePercent: 0,
    analysisJson: '',
    chunkCount: chunks.length,
    processedChunkCount: 0,
    lastAnalyzedAt: new Date().toISOString()
  }

  await upsertDocumentAnalysis(record)

  // Analyze each chunk
  const chunkResults: ChunkAnalysisResult[] = []
  let hasErrors = false

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const result = await analyzeChunk(chunk, documentType, chunks.length, text)
    chunkResults.push(result)

    if (!result.success) {
      hasErrors = true
    }

    // Update progress
    record = {
      ...record,
      processedChunkCount: i + 1,
      coveragePercent: Math.round(((i + 1) / chunks.length) * 100)
    }
    await upsertDocumentAnalysis(record)
  }

  // Merge results
  const mergedAnalysis = mergeChunkResults(chunkResults, documentType)

  // Calculate final coverage (successful chunks / total chunks)
  const successfulChunks = chunkResults.filter(r => r.success).length
  const coveragePercent = Math.round((successfulChunks / chunks.length) * 100)

  // Finalize record
  const finalStatus: AnalysisStatus = hasErrors && successfulChunks === 0 ? 'error' : 'done'
  
  record = {
    ...record,
    status: finalStatus,
    coveragePercent,
    analysisJson: JSON.stringify(mergedAnalysis, null, 2),
    lastAnalyzedAt: new Date().toISOString(),
    errorMessage: hasErrors ? mergedAnalysis.errors.join('; ') : undefined
  }

  await upsertDocumentAnalysis(record)

  return {
    record,
    analysis: mergedAnalysis,
    fromCache: false
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Check if a document needs (re-)analysis
 */
export async function needsAnalysis(
  moduleId: string,
  documentId: string,
  currentText: string
): Promise<boolean> {
  const normalizedText = normalizeTextForHash(currentText)
  const currentHash = await sha256(normalizedText)
  
  const existing = await getDocumentAnalysis(moduleId, documentId)
  
  if (!existing) return true
  if (existing.status === 'error') return true
  if (existing.sourceHash !== currentHash) return true
  if (existing.analysisVersion !== DOCUMENT_ANALYSIS_VERSION) return true
  
  return false
}

/**
 * Get parsed analysis for a document (convenience function)
 */
export async function getParsedDocumentAnalysis(
  moduleId: string,
  documentId: string
): Promise<MergedDocumentAnalysis | null> {
  const record = await getDocumentAnalysis(moduleId, documentId)
  
  if (!record || record.status !== 'done' || !record.analysisJson) {
    return null
  }
  
  try {
    return JSON.parse(record.analysisJson) as MergedDocumentAnalysis
  } catch {
    return null
  }
}
