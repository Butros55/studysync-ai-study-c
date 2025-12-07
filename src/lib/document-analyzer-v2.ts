/**
 * Document Analyzer V2
 * 
 * Enhanced document analysis with:
 * - Strict content separation (concepts vs formulas vs procedures vs examples)
 * - Evidence-based extraction with confidence levels
 * - Topic normalization integration
 * - Improved prompts for each document type
 * - Task archetype detection
 */

import { llmWithRetry } from './llm-utils'
import { generateId } from './utils-app'
import { DocumentType } from './analysis-types'
import { 
  DocumentAnalysisV2,
  ExtractedConceptV2,
  ExtractedFormulaV2,
  ExtractedProcedureV2,
  ExtractedWorkedExampleV2,
  ExtractedExerciseV2,
  DocumentStructuralSignals,
  DocumentStyleSignals,
  ANALYSIS_SCHEMA_VERSION,
  generateExtractedItemId,
  isValidLatex
} from './analysis-types-v2'
import {
  normalizeTopicKey,
  findCanonicalTopic,
  isNoiseTopic,
  detectExpectedAnswerFormat,
  detectSubtasks,
  detectPoints,
  estimateDifficulty
} from './topic-normalizer'
import { chunkText, sha256, normalizeTextForHash, TextChunk } from './document-analyzer'

// ============================================================================
// Configuration
// ============================================================================

const ANALYSIS_MODEL = 'gpt-4o-mini'

// ============================================================================
// V2 Prompts with Strict Separation
// ============================================================================

/**
 * Get the analysis prompt for a specific document type (V2)
 */
function getV2ChunkPrompt(
  documentType: DocumentType, 
  chunkText: string, 
  chunkIndex: number, 
  totalChunks: number
): string {
  const baseInstructions = `Du bist ein präziser Dokumenten-Analyzer für Universitätsmaterial. 
  
KRITISCHE REGELN:
1. Extrahiere NUR Informationen, die WÖRTLICH im Text vorkommen
2. Jedes Item braucht einen "evidenceSnippet" - ein EXAKTES Zitat (max 200 Zeichen)
3. TRENNE strikt zwischen Kategorien:
   - "concepts": Begriffe MIT Definition (beide müssen vorhanden sein)
   - "formulas": NUR echte mathematische Formeln in LaTeX (KEINE Textbeschreibungen, KEINE Beispielrechnungen)
   - "procedures": Algorithmen/Verfahren MIT Schritten
   - "workedExamples": Durchgerechnete Beispiele (Aufgabe + Lösung zusammen)
   - "exercises": Übungsaufgaben zur Bearbeitung (ohne Lösung oder mit separater Lösung)
4. Wenn unsicher, WEGLASSEN statt raten
5. Gib NUR valides JSON zurück

Dies ist Chunk ${chunkIndex + 1} von ${totalChunks}.`

  const typePrompt = getV2TypeSpecificPrompt(documentType)

  return `${baseInstructions}

${typePrompt}

TEXT ZU ANALYSIEREN:
---
${chunkText}
---

Antworte mit diesem JSON-Schema:
{
  "topics": ["Thema1", "Thema2"],
  "concepts": [
    {
      "term": "Begriff",
      "definition": "Definition des Begriffs (MUSS vorhanden sein)",
      "relatedTerms": ["Synonym1"],
      "evidenceSnippet": "exaktes Zitat aus Text"
    }
  ],
  "formulas": [
    {
      "latex": "\\\\frac{a}{b}",
      "description": "Was die Formel berechnet",
      "variables": {"a": "Zähler", "b": "Nenner"},
      "evidenceSnippet": "exaktes Zitat"
    }
  ],
  "procedures": [
    {
      "name": "Verfahrensname",
      "steps": ["Schritt 1", "Schritt 2"],
      "whenToUse": "Wann anwenden",
      "evidenceSnippet": "exaktes Zitat"
    }
  ],
  "workedExamples": [
    {
      "problem": "Aufgabenstellung",
      "solutionSteps": ["Schritt 1", "Schritt 2"],
      "result": "Endergebnis",
      "topics": ["Thema"],
      "evidenceSnippet": "exaktes Zitat"
    }
  ],
  "exercises": [
    {
      "questionText": "Aufgabenstellung",
      "subtasks": ["a)", "b)"],
      "topics": ["Thema"],
      "hasSolution": false,
      "evidenceSnippet": "exaktes Zitat"
    }
  ],
  "structuralSignals": {
    "taskNumberingPatterns": ["Aufgabe N", "N."],
    "subtaskPatterns": ["a)", "(1)"],
    "pointsPatterns": ["(10P)", "10 Punkte"],
    "taskStartPhrases": ["Berechne", "Zeige"],
    "usesTables": false,
    "usesCodeBlocks": false
  },
  "styleSignals": {
    "imperativeVerbs": ["berechne", "zeige"],
    "questionPhrases": ["Wie lautet", "Bestimme"],
    "notationConventions": {
      "booleanOperators": ["∧", "∨", "¬"],
      "numberPrefixes": ["0x", "0b"]
    }
  },
  "coverageNotes": ["Was nicht geparst werden konnte"]
}

Gib NUR das JSON zurück.`
}

/**
 * Type-specific extraction instructions
 */
function getV2TypeSpecificPrompt(documentType: DocumentType): string {
  switch (documentType) {
    case 'script':
      return `SKRIPT-ANALYSE - Fokus auf Wissensbasis:

CONCEPTS (NUR mit vollständiger Definition):
✓ "Ein Karnaugh-Diagramm ist eine grafische Methode zur Minimierung boolescher Funktionen"
✗ "Karnaugh-Diagramm" ohne Definition

FORMULAS (NUR echte Formeln, KEIN Text):
✓ "y = \\overline{a \\cdot b}" 
✗ "Die Formel zur Berechnung ist im Skript erklärt"
✗ "Beispiel: 42₁₀ = 101010₂" (das ist ein Beispiel, keine Formel)

PROCEDURES (MIT Schritten):
✓ Quine-McCluskey mit allen 4 Schritten
✗ "Das Quine-McCluskey-Verfahren" ohne Schritte

WORKED EXAMPLES:
- Durchgerechnete Beispiele mit Aufgabe UND Lösung
- NICHT Formeln, NICHT Definitionen`

    case 'exercise':
      return `ÜBUNGSBLATT-ANALYSE - Fokus auf Aufgabenstruktur:

EXERCISES (Hauptfokus):
- Extrahiere jede Aufgabe als eigenes Item
- Erkenne Teilaufgaben (a, b, c oder 1, 2, 3)
- Notiere Punktzahlen wenn angegeben
- hasSolution = false wenn keine Lösung dabei ist

STRUCTURAL SIGNALS (wichtig!):
- Wie werden Aufgaben nummeriert?
- Welche Verben werden verwendet?
- Welche Notation wird verwendet (Boolesch, Zahlen)?

STYLE SIGNALS:
- Typische Formulierungen
- Antwortformate (Tabelle, Formel, Text)`

    case 'solution':
      return `LÖSUNGS-ANALYSE - Fokus auf Lösungswege:

WORKED EXAMPLES (Hauptfokus):
- Jede Lösung als durchgerechnetes Beispiel
- Alle Zwischenschritte erfassen
- Endergebnis notieren

PROCEDURES:
- Allgemeine Lösungsmethoden ableiten
- Schritte abstrahieren für Wiederverwendung

FORMULAS:
- NUR verwendete mathematische Formeln
- NICHT die konkreten Zahlenbeispiele`

    case 'exam':
      return `KLAUSUR-ANALYSE - Fokus auf Prüfungsformat:

EXERCISES (Hauptfokus):
- Jede Klausuraufgabe einzeln erfassen
- Punktzahlen sind hier besonders wichtig
- Schwierigkeit einschätzen (easy/medium/hard)

STRUCTURAL SIGNALS (kritisch für Generierung):
- Exakte Nummerierung und Format
- Zeitangaben wenn vorhanden
- Punkteverteilung

STYLE SIGNALS:
- Klausur-typische Formulierungen
- Multiple-Choice vs. offene Fragen erkennen`

    default:
      return `Extrahiere alle strukturierten Informationen mit Evidenz.`
  }
}

// ============================================================================
// V2 Chunk Analysis
// ============================================================================

interface V2ChunkResult {
  chunkIndex: number
  topics: string[]
  concepts: Array<{
    term: string
    definition: string
    relatedTerms?: string[]
    evidenceSnippet: string
  }>
  formulas: Array<{
    latex: string
    description?: string
    variables?: Record<string, string>
    evidenceSnippet: string
  }>
  procedures: Array<{
    name: string
    steps: string[]
    whenToUse?: string
    evidenceSnippet: string
  }>
  workedExamples: Array<{
    problem: string
    solutionSteps: string[]
    result?: string
    topics: string[]
    evidenceSnippet: string
  }>
  exercises: Array<{
    questionText: string
    subtasks?: string[]
    topics: string[]
    hasSolution: boolean
    solution?: string
    evidenceSnippet: string
  }>
  structuralSignals: Partial<DocumentStructuralSignals>
  styleSignals: Partial<DocumentStyleSignals>
  coverageNotes: string[]
  success: boolean
  errorMessage?: string
}

/**
 * Analyze a single chunk with V2 extraction
 */
async function analyzeChunkV2(
  chunk: TextChunk,
  documentType: DocumentType,
  totalChunks: number,
  originalText: string,
  documentId: string
): Promise<V2ChunkResult> {
  const prompt = getV2ChunkPrompt(documentType, chunk.text, chunk.index, totalChunks)

  try {
    const response = await llmWithRetry(
      prompt,
      ANALYSIS_MODEL,
      true, // JSON mode
      2,    // retries
      'document-analysis-v2'
    )

    // Parse JSON
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(response)
    } catch {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Keine valide JSON-Antwort')
      }
    }

    // Validate and enhance extracted items
    return validateAndEnhanceChunkResult(parsed, chunk.index, originalText, documentId)
  } catch (error) {
    return {
      chunkIndex: chunk.index,
      topics: [],
      concepts: [],
      formulas: [],
      procedures: [],
      workedExamples: [],
      exercises: [],
      structuralSignals: {},
      styleSignals: {},
      coverageNotes: [],
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Validate evidence exists in source and enhance items
 */
function validateAndEnhanceChunkResult(
  parsed: Record<string, unknown>,
  chunkIndex: number,
  originalText: string,
  documentId: string
): V2ChunkResult {
  const normalizedText = originalText.toLowerCase()

  // Helper to validate evidence
  const hasValidEvidence = (snippet: string): boolean => {
    if (!snippet || typeof snippet !== 'string') return false
    const words = snippet.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    if (words.length === 0) return true
    const matched = words.filter(w => normalizedText.includes(w))
    return matched.length >= Math.ceil(words.length * 0.6)
  }

  // Validate concepts (must have both term AND definition)
  const concepts = (Array.isArray(parsed.concepts) ? parsed.concepts : [])
    .filter((c: unknown) => {
      if (!c || typeof c !== 'object') return false
      const obj = c as Record<string, unknown>
      return obj.term && obj.definition && hasValidEvidence(String(obj.evidenceSnippet || ''))
    })
    .map((c: unknown) => {
      const obj = c as Record<string, unknown>
      return {
        term: String(obj.term),
        definition: String(obj.definition),
        relatedTerms: Array.isArray(obj.relatedTerms) ? obj.relatedTerms.map(String) : undefined,
        evidenceSnippet: String(obj.evidenceSnippet || '').slice(0, 200)
      }
    })

  // Validate formulas (must be valid LaTeX, not worked examples)
  const formulas = (Array.isArray(parsed.formulas) ? parsed.formulas : [])
    .filter((f: unknown) => {
      if (!f || typeof f !== 'object') return false
      const obj = f as Record<string, unknown>
      const latex = String(obj.latex || '')
      // Must look like LaTeX and not be a worked example
      return isValidLatex(latex) && hasValidEvidence(String(obj.evidenceSnippet || ''))
    })
    .map((f: unknown) => {
      const obj = f as Record<string, unknown>
      return {
        latex: String(obj.latex),
        description: obj.description ? String(obj.description) : undefined,
        variables: obj.variables as Record<string, string> | undefined,
        evidenceSnippet: String(obj.evidenceSnippet || '').slice(0, 200)
      }
    })

  // Validate procedures (must have steps)
  const procedures = (Array.isArray(parsed.procedures) ? parsed.procedures : [])
    .filter((p: unknown) => {
      if (!p || typeof p !== 'object') return false
      const obj = p as Record<string, unknown>
      return obj.name && Array.isArray(obj.steps) && obj.steps.length > 0
    })
    .map((p: unknown) => {
      const obj = p as Record<string, unknown>
      return {
        name: String(obj.name),
        steps: (obj.steps as unknown[]).map(String),
        whenToUse: obj.whenToUse ? String(obj.whenToUse) : undefined,
        evidenceSnippet: String(obj.evidenceSnippet || '').slice(0, 200)
      }
    })

  // Validate worked examples
  const workedExamples = (Array.isArray(parsed.workedExamples) ? parsed.workedExamples : [])
    .filter((e: unknown) => {
      if (!e || typeof e !== 'object') return false
      const obj = e as Record<string, unknown>
      return obj.problem && Array.isArray(obj.solutionSteps) && obj.solutionSteps.length > 0
    })
    .map((e: unknown) => {
      const obj = e as Record<string, unknown>
      return {
        problem: String(obj.problem),
        solutionSteps: (obj.solutionSteps as unknown[]).map(String),
        result: obj.result ? String(obj.result) : undefined,
        topics: Array.isArray(obj.topics) ? obj.topics.map(String) : [],
        evidenceSnippet: String(obj.evidenceSnippet || '').slice(0, 200)
      }
    })

  // Extract exercises
  const exercises = (Array.isArray(parsed.exercises) ? parsed.exercises : [])
    .filter((e: unknown) => {
      if (!e || typeof e !== 'object') return false
      const obj = e as Record<string, unknown>
      return obj.questionText && typeof obj.questionText === 'string'
    })
    .map((e: unknown) => {
      const obj = e as Record<string, unknown>
      const questionText = String(obj.questionText)
      
      // Use heuristics to enhance exercise data
      const detectedSubtasks = detectSubtasks(questionText)
      const detectedPoints = detectPoints(questionText)
      
      return {
        questionText,
        subtasks: Array.isArray(obj.subtasks) ? obj.subtasks.map(String) : 
                  detectedSubtasks.length > 0 ? detectedSubtasks : undefined,
        topics: Array.isArray(obj.topics) ? obj.topics.map(String) : [],
        hasSolution: Boolean(obj.hasSolution),
        solution: obj.solution ? String(obj.solution) : undefined,
        evidenceSnippet: String(obj.evidenceSnippet || '').slice(0, 200)
      }
    })

  // Extract topics
  const topics = Array.isArray(parsed.topics) ? parsed.topics.map(String) : []

  // Extract signals
  const structuralSignals = parsed.structuralSignals as Partial<DocumentStructuralSignals> || {}
  const styleSignals = parsed.styleSignals as Partial<DocumentStyleSignals> || {}
  const coverageNotes = Array.isArray(parsed.coverageNotes) ? parsed.coverageNotes.map(String) : []

  return {
    chunkIndex,
    topics,
    concepts,
    formulas,
    procedures,
    workedExamples,
    exercises,
    structuralSignals,
    styleSignals,
    coverageNotes,
    success: true
  }
}

// ============================================================================
// Merge Chunk Results into V2 Analysis
// ============================================================================

/**
 * Merge multiple chunk results into a DocumentAnalysisV2
 */
function mergeV2ChunkResults(
  chunkResults: V2ChunkResult[],
  documentType: DocumentType,
  documentId: string
): DocumentAnalysisV2 {
  const now = new Date().toISOString()
  
  // Collect all items
  const allTopics: string[] = []
  const allConcepts: ExtractedConceptV2[] = []
  const allFormulas: ExtractedFormulaV2[] = []
  const allProcedures: ExtractedProcedureV2[] = []
  const allWorkedExamples: ExtractedWorkedExampleV2[] = []
  const allExercises: ExtractedExerciseV2[] = []
  const allCoverageNotes: string[] = []
  const allErrors: string[] = []

  // Aggregate structural signals
  const taskNumberingPatterns = new Set<string>()
  const subtaskPatterns = new Set<string>()
  const pointsPatterns = new Set<string>()
  const taskStartPhrases = new Set<string>()
  let usesTables = false
  let usesCodeBlocks = false
  let usesFormulaEnv = false

  // Aggregate style signals
  const verbFrequency: Record<string, number> = {}
  const questionPhrases = new Set<string>()
  const notationBoolOps = new Set<string>()
  const notationNumPrefixes = new Set<string>()

  for (const result of chunkResults) {
    if (result.errorMessage) {
      allErrors.push(`Chunk ${result.chunkIndex}: ${result.errorMessage}`)
    }

    allTopics.push(...result.topics)
    allCoverageNotes.push(...result.coverageNotes)

    // Add concepts with IDs
    for (const c of result.concepts) {
      allConcepts.push({
        id: generateExtractedItemId('concept'),
        term: c.term,
        definition: c.definition,
        relatedTerms: c.relatedTerms,
        evidence: {
          documentId,
          snippet: c.evidenceSnippet
        },
        confidence: 'high'
      })
    }

    // Add formulas
    for (const f of result.formulas) {
      allFormulas.push({
        id: generateExtractedItemId('formula'),
        latex: f.latex,
        description: f.description,
        variables: f.variables,
        evidence: {
          documentId,
          snippet: f.evidenceSnippet
        },
        confidence: 'high'
      })
    }

    // Add procedures
    for (const p of result.procedures) {
      allProcedures.push({
        id: generateExtractedItemId('procedure'),
        name: p.name,
        steps: p.steps,
        whenToUse: p.whenToUse,
        evidence: {
          documentId,
          snippet: p.evidenceSnippet
        },
        confidence: 'high'
      })
    }

    // Add worked examples
    for (const e of result.workedExamples) {
      allWorkedExamples.push({
        id: generateExtractedItemId('example'),
        problem: e.problem,
        solutionSteps: e.solutionSteps,
        result: e.result,
        topics: e.topics,
        evidence: {
          documentId,
          snippet: e.evidenceSnippet
        }
      })
    }

    // Add exercises
    for (const e of result.exercises) {
      const formats = detectExpectedAnswerFormat(e.questionText)
      const difficulty = estimateDifficulty(e.questionText)
      const points = detectPoints(e.questionText)
      
      allExercises.push({
        id: generateExtractedItemId('exercise'),
        questionText: e.questionText,
        subtasks: e.subtasks,
        expectedAnswerFormat: formats.length > 0 ? formats : ['text'],
        difficulty: difficulty || 'unknown',
        points: points || undefined,
        topics: e.topics,
        hasSolution: e.hasSolution,
        solution: e.solution,
        evidence: {
          documentId,
          snippet: e.evidenceSnippet
        }
      })
    }

    // Merge structural signals
    const ss = result.structuralSignals
    if (ss.taskNumberingPatterns) ss.taskNumberingPatterns.forEach(p => taskNumberingPatterns.add(p))
    if (ss.subtaskPatterns) ss.subtaskPatterns.forEach(p => subtaskPatterns.add(p))
    if (ss.pointsPatterns) ss.pointsPatterns.forEach(p => pointsPatterns.add(p))
    if (ss.taskStartPhrases) ss.taskStartPhrases.forEach(p => taskStartPhrases.add(p))
    if (ss.usesTables) usesTables = true
    if (ss.usesCodeBlocks) usesCodeBlocks = true
    if (ss.usesFormulaEnvironments) usesFormulaEnv = true

    // Merge style signals
    const sty = result.styleSignals
    if (sty.imperativeVerbs) {
      for (const v of sty.imperativeVerbs) {
        verbFrequency[v] = (verbFrequency[v] || 0) + 1
      }
    }
    if (sty.questionPhrases) sty.questionPhrases.forEach(p => questionPhrases.add(p))
    if (sty.notationConventions?.booleanOperators) {
      sty.notationConventions.booleanOperators.forEach(o => notationBoolOps.add(o))
    }
    if (sty.notationConventions?.numberPrefixes) {
      sty.notationConventions.numberPrefixes.forEach(p => notationNumPrefixes.add(p))
    }
  }

  // Deduplicate and normalize topics
  const rawTopics = [...new Set(allTopics)].filter(t => !isNoiseTopic(t))
  const topicMapping: Record<string, string> = {}
  const canonicalTopics: string[] = []

  for (const raw of rawTopics) {
    const canonical = findCanonicalTopic(raw) || normalizeTopicKey(raw)
    topicMapping[raw] = canonical
    if (!canonicalTopics.includes(canonical)) {
      canonicalTopics.push(canonical)
    }
  }

  // Deduplicate concepts by normalized term
  const conceptMap = new Map<string, ExtractedConceptV2>()
  for (const c of allConcepts) {
    const key = c.term.toLowerCase().trim()
    if (!conceptMap.has(key) || c.definition.length > (conceptMap.get(key)?.definition.length || 0)) {
      conceptMap.set(key, c)
    }
  }

  // Deduplicate formulas by normalized latex
  const formulaMap = new Map<string, ExtractedFormulaV2>()
  for (const f of allFormulas) {
    const key = f.latex.replace(/\s+/g, '')
    if (!formulaMap.has(key)) {
      formulaMap.set(key, f)
    }
  }

  // Deduplicate procedures by name
  const procedureMap = new Map<string, ExtractedProcedureV2>()
  for (const p of allProcedures) {
    const key = p.name.toLowerCase().trim()
    if (!procedureMap.has(key) || p.steps.length > (procedureMap.get(key)?.steps.length || 0)) {
      procedureMap.set(key, p)
    }
  }

  // Calculate processing metadata
  const successfulChunks = chunkResults.filter(r => r.success).length
  const coveragePercent = Math.round((successfulChunks / chunkResults.length) * 100)

  // Build result
  return {
    schemaVersion: '2.0.0',
    documentType,
    canonicalTopics,
    rawTopics,
    topicMapping,
    concepts: Array.from(conceptMap.values()),
    formulas: Array.from(formulaMap.values()),
    procedures: Array.from(procedureMap.values()),
    workedExamples: allWorkedExamples,
    embeddedExercises: allExercises,
    structuralSignals: {
      usesTables,
      usesCodeBlocks,
      usesFormulaEnvironments: usesFormulaEnv || allFormulas.length > 0,
      taskNumberingPatterns: Array.from(taskNumberingPatterns),
      subtaskPatterns: Array.from(subtaskPatterns),
      pointsPatterns: Array.from(pointsPatterns),
      sectionPatterns: [],
      taskStartPhrases: Array.from(taskStartPhrases)
    },
    styleSignals: {
      imperativeVerbs: Object.keys(verbFrequency).sort((a, b) => verbFrequency[b] - verbFrequency[a]),
      verbFrequency,
      questionPhrases: Array.from(questionPhrases),
      notationConventions: {
        booleanOperators: Array.from(notationBoolOps),
        numberPrefixes: Array.from(notationNumPrefixes)
      },
      preferredAnswerFormats: derivePreferredFormats(allExercises)
    },
    processingMetadata: {
      chunksProcessed: successfulChunks,
      totalChunks: chunkResults.length,
      coveragePercent,
      errors: allErrors,
      coverageNotes: [...new Set(allCoverageNotes)],
      processedAt: now
    }
  }
}

/**
 * Derive preferred answer formats from exercises
 */
function derivePreferredFormats(exercises: ExtractedExerciseV2[]): string[] {
  const formatCounts: Record<string, number> = {}
  
  for (const ex of exercises) {
    for (const fmt of ex.expectedAnswerFormat) {
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
    }
  }

  return Object.entries(formatCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([fmt]) => fmt)
    .slice(0, 5)
}

// ============================================================================
// Main V2 Analysis Function
// ============================================================================

export interface AnalyzeDocumentV2Input {
  moduleId: string
  documentId: string
  documentType: DocumentType
  text: string
}

export interface AnalyzeDocumentV2Result {
  analysis: DocumentAnalysisV2
  sourceHash: string
  fromCache: boolean
}

/**
 * Analyze a document with V2 extraction
 */
export async function analyzeDocumentV2(
  input: AnalyzeDocumentV2Input,
  onProgress?: (percent: number) => void
): Promise<AnalyzeDocumentV2Result> {
  const { moduleId, documentId, documentType, text } = input

  // Compute hash for caching
  const normalizedText = normalizeTextForHash(text)
  const sourceHash = await sha256(normalizedText)

  // Chunk the text
  const chunks = chunkText(text)

  // Analyze each chunk
  const chunkResults: V2ChunkResult[] = []

  for (let i = 0; i < chunks.length; i++) {
    const result = await analyzeChunkV2(
      chunks[i],
      documentType,
      chunks.length,
      text,
      documentId
    )
    chunkResults.push(result)

    // Report progress
    if (onProgress) {
      onProgress(Math.round(((i + 1) / chunks.length) * 100))
    }
  }

  // Merge results
  const analysis = mergeV2ChunkResults(chunkResults, documentType, documentId)

  return {
    analysis,
    sourceHash,
    fromCache: false
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  getV2ChunkPrompt,
  getV2TypeSpecificPrompt,
  analyzeChunkV2,
  mergeV2ChunkResults
}
