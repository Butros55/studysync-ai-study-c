/**
 * Document Analysis Types V2
 * 
 * Enhanced analysis schema with:
 * - Strict separation of content types (concepts, formulas, procedures, examples, exercises)
 * - Evidence-based extraction (every item has source references)
 * - Improved structural patterns for exercises/exams
 * - Task archetypes for consistent generation
 * 
 * Backward compatible with V1 - V1 records are auto-migrated on load.
 */

import { DocumentType, AnalysisStatus } from './analysis-types'

// ============================================================================
// Version Constants
// ============================================================================

export const ANALYSIS_SCHEMA_VERSION = '2.0.0'

// ============================================================================
// Evidence & Source Reference Types
// ============================================================================

/**
 * Evidence reference for an extracted item
 */
export interface EvidenceRef {
  /** Document ID where this was found */
  documentId: string
  /** Optional page/section hint */
  pageHint?: string
  /** Short snippet (max 200 chars) proving this exists in source */
  snippet: string
}

/**
 * Confidence level for extracted information
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'inferred'

// ============================================================================
// Extracted Content Types (V2)
// ============================================================================

/**
 * A concept/definition with required term and definition
 */
export interface ExtractedConceptV2 {
  /** Unique ID for this concept within the analysis */
  id: string
  /** The term being defined (required) */
  term: string
  /** The definition text (required - if not extractable, don't include) */
  definition: string
  /** Related terms/synonyms */
  relatedTerms?: string[]
  /** Evidence from source text */
  evidence: EvidenceRef
  /** Confidence level */
  confidence: ConfidenceLevel
}

/**
 * A formula with LaTeX representation
 * Only genuine formulas - not worked examples or text descriptions
 */
export interface ExtractedFormulaV2 {
  /** Unique ID */
  id: string
  /** LaTeX representation (must be valid LaTeX, not plain text) */
  latex: string
  /** Human-readable description of what the formula represents */
  description?: string
  /** Variables used and their meanings */
  variables?: Record<string, string>
  /** Context/when to use this formula */
  context?: string
  /** Evidence from source text */
  evidence: EvidenceRef
  /** Confidence level */
  confidence: ConfidenceLevel
}

/**
 * A procedure/algorithm with steps
 */
export interface ExtractedProcedureV2 {
  /** Unique ID */
  id: string
  /** Name of the procedure/algorithm */
  name: string
  /** Brief description of purpose */
  description?: string
  /** Numbered steps of the procedure */
  steps: string[]
  /** When/why to use this procedure */
  whenToUse?: string
  /** Common pitfalls or notes */
  notes?: string[]
  /** Evidence from source text */
  evidence: EvidenceRef
  /** Confidence level */
  confidence: ConfidenceLevel
}

/**
 * A worked example from the source material
 * (Different from formulas - these are complete problem+solution pairs)
 */
export interface ExtractedWorkedExampleV2 {
  /** Unique ID */
  id: string
  /** The problem statement */
  problem: string
  /** Solution steps */
  solutionSteps: string[]
  /** Final result/answer */
  result?: string
  /** Topic(s) this example illustrates */
  topics: string[]
  /** Evidence from source text */
  evidence: EvidenceRef
}

/**
 * An embedded exercise found in the source material
 * (Questions meant for student practice)
 */
export interface ExtractedExerciseV2 {
  /** Unique ID */
  id: string
  /** The question/task text */
  questionText: string
  /** Subtask texts if present */
  subtasks?: string[]
  /** Expected answer format(s) */
  expectedAnswerFormat: string[]
  /** Estimated difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown'
  /** Points if specified */
  points?: number
  /** Topic(s) covered */
  topics: string[]
  /** Whether a solution is provided */
  hasSolution: boolean
  /** Solution text if available */
  solution?: string
  /** Evidence from source text */
  evidence: EvidenceRef
}

// ============================================================================
// Document Signals (Structure & Style)
// ============================================================================

/**
 * Structural signals extracted from the document
 */
export interface DocumentStructuralSignals {
  /** Whether the doc uses tables */
  usesTables: boolean
  /** Whether the doc contains code blocks */
  usesCodeBlocks: boolean
  /** Whether the doc has formula environments */
  usesFormulaEnvironments: boolean
  /** Task numbering patterns detected */
  taskNumberingPatterns: string[]
  /** Subtask patterns detected (e.g., 'a)', '(1)') */
  subtaskPatterns: string[]
  /** Points/scoring patterns detected */
  pointsPatterns: string[]
  /** Section header patterns */
  sectionPatterns: string[]
  /** Typical phrases indicating task start */
  taskStartPhrases: string[]
}

/**
 * Style signals for task generation
 */
export interface DocumentStyleSignals {
  /** Common imperative verbs ("Berechne", "Zeige", "Beweise") */
  imperativeVerbs: string[]
  /** Frequency map of verbs */
  verbFrequency: Record<string, number>
  /** Typical question phrase patterns */
  questionPhrases: string[]
  /** Notation conventions observed */
  notationConventions: {
    /** Boolean operators (e.g., "¬", "NOT", "~") */
    booleanOperators?: string[]
    /** Number notation (e.g., "0x", "0b", "h'") */
    numberPrefixes?: string[]
    /** Set notation */
    setNotation?: string[]
    /** Other mathematical conventions */
    other?: string[]
  }
  /** Answer format preferences */
  preferredAnswerFormats: string[]
}

// ============================================================================
// Task Archetype (for consistent generation)
// ============================================================================

/**
 * A task archetype derived from analyzed exercises/examples
 * Used to generate consistent, non-duplicate tasks
 */
export interface TaskArchetype {
  /** Unique archetype ID */
  id: string
  /** Human-readable name */
  name: string
  /** Description of when to use this archetype */
  whenToUse: string
  /** Template for generating similar tasks */
  promptTemplate: string
  /** Required inputs for this archetype (e.g., ['booleanExpression', 'numVariables']) */
  requiredInputs: string[]
  /** Expected output format(s) */
  expectedOutputFormats: string[]
  /** Strategies for varying this archetype */
  variationStrategies: string[]
  /** Source evidence IDs (which exercises/examples defined this) */
  sourceEvidenceIds: string[]
  /** Typical difficulty range */
  difficultyRange: {
    min: 'easy' | 'medium' | 'hard'
    max: 'easy' | 'medium' | 'hard'
  }
  /** Topics this archetype applies to */
  applicableTopics: string[]
}

// ============================================================================
// Merged Document Analysis V2
// ============================================================================

/**
 * Complete analysis result for a document (V2 schema)
 */
export interface DocumentAnalysisV2 {
  /** Schema version */
  schemaVersion: '2.0.0'
  
  /** Document type that was analyzed */
  documentType: DocumentType
  
  /** Canonical topics found (normalized) */
  canonicalTopics: string[]
  
  /** Raw topics before normalization (for debugging) */
  rawTopics: string[]
  
  /** Topic mapping (raw -> canonical) */
  topicMapping: Record<string, string>
  
  // ============================================================================
  // Content Categories (Strictly Separated)
  // ============================================================================
  
  /** Concepts/definitions (term + definition required) */
  concepts: ExtractedConceptV2[]
  
  /** Formulas (must be valid LaTeX, not worked examples) */
  formulas: ExtractedFormulaV2[]
  
  /** Procedures/algorithms with steps */
  procedures: ExtractedProcedureV2[]
  
  /** Worked examples (problem + solution from source) */
  workedExamples: ExtractedWorkedExampleV2[]
  
  /** Embedded exercises (practice questions from source) */
  embeddedExercises: ExtractedExerciseV2[]
  
  // ============================================================================
  // Signals & Patterns
  // ============================================================================
  
  /** Structural signals from the document */
  structuralSignals: DocumentStructuralSignals
  
  /** Style signals for generation */
  styleSignals: DocumentStyleSignals
  
  // ============================================================================
  // Metadata
  // ============================================================================
  
  /** Processing metadata */
  processingMetadata: {
    /** Chunks processed */
    chunksProcessed: number
    /** Total chunks */
    totalChunks: number
    /** Coverage percentage */
    coveragePercent: number
    /** Processing errors */
    errors: string[]
    /** Coverage notes */
    coverageNotes: string[]
    /** Processing timestamp */
    processedAt: string
  }
}

// ============================================================================
// Module Profile V2 Types
// ============================================================================

/**
 * Knowledge Index V2 with enhanced structure
 */
export interface ModuleKnowledgeIndexV2 {
  /** Schema version */
  schemaVersion: '2.0.0'
  
  /** All canonical topics across scripts */
  canonicalTopics: string[]
  
  /** Topic synonyms/aliases mapping */
  topicSynonyms: Record<string, string[]>
  
  /** Topic frequency (canonical keys) */
  topicFrequency: Record<string, number>
  
  /** Enhanced topic index with entity references */
  topicIndex: Record<string, {
    documents: Array<{ documentId: string; documentName?: string }>
    conceptIds: string[]
    formulaIds: string[]
    procedureIds: string[]
    exampleIds: string[]
    exerciseIds: string[]
  }>
  
  /** All concepts with evidence */
  concepts: ExtractedConceptV2[]
  
  /** All formulas (validated as real formulas, not examples) */
  formulas: ExtractedFormulaV2[]
  
  /** All procedures with steps */
  procedures: ExtractedProcedureV2[]
  
  /** All worked examples */
  workedExamples: ExtractedWorkedExampleV2[]
  
  /** Source document count */
  sourceDocumentCount: number
  
  /** Last built timestamp */
  lastBuiltAt: string
}

/**
 * Exercise Style Profile V2 with enhanced patterns
 */
export interface ExerciseStyleProfileV2 {
  /** Schema version */
  schemaVersion: '2.0.0'
  
  // ============================================================================
  // Verb & Phrase Patterns
  // ============================================================================
  
  /** Common verbs with frequency */
  verbs: Array<{ verb: string; frequency: number }>
  
  /** Typical phrases */
  typicalPhrases: string[]
  
  // ============================================================================
  // Structure Patterns
  // ============================================================================
  
  structure: {
    /** Task numbering (e.g., "Aufgabe N", "N.") */
    taskNumbering: string[]
    /** Letter subtasks used */
    usesLetterSubtasks: boolean
    /** Number subtasks used */
    usesNumberedSubtasks: boolean
    /** Average subtasks per exercise */
    avgSubtasksPerExercise: number
    /** Points usage */
    pointsUsage: {
      usesPoints: boolean
      avgPoints: number
      minPoints: number
      maxPoints: number
      usesHalfPoints: boolean
    }
    /** Typical sections (e.g., "Aufgabe", "Hinweis", "Lösung") */
    typicalSections: string[]
  }
  
  // ============================================================================
  // Answer Format Patterns
  // ============================================================================
  
  answerFormats: {
    /** Format frequencies */
    frequencies: Record<string, number>
    /** Most common formats */
    mostCommon: string[]
  }
  
  // ============================================================================
  // Notation Conventions
  // ============================================================================
  
  notationConventions: {
    /** Boolean operators used */
    booleanOperators: string[]
    /** Number system notation */
    numberNotation: string[]
    /** Don't care representation */
    dontCareSymbols: string[]
    /** Index/subscript conventions */
    indexConventions: string[]
    /** Other notation patterns */
    other: string[]
  }
  
  // ============================================================================
  // Task Archetypes
  // ============================================================================
  
  /** Derived task archetypes */
  taskArchetypes: TaskArchetype[]
  
  // ============================================================================
  // Solution Style
  // ============================================================================
  
  solutionStyle: {
    /** Whether step-by-step solutions are used */
    usesStepByStep: boolean
    /** Typical intermediate steps */
    typicalSteps: string[]
    /** Output formats (tables, diagrams, etc.) */
    outputFormats: string[]
  }
  
  /** Source document count */
  sourceDocumentCount: number
  
  /** Last built timestamp */
  lastBuiltAt: string
}

/**
 * Exam Style Profile V2 with enhanced patterns and confidence tracking
 */
export interface ExamStyleProfileV2 {
  /** Schema version */
  schemaVersion: '2.0.0'
  
  // ============================================================================
  // Operator/Verb Patterns
  // ============================================================================
  
  /** Typical exam operators with frequency */
  operators: Array<{ 
    operator: string
    frequency: number 
    examples: string[]
  }>
  
  // ============================================================================
  // Task Type Patterns
  // ============================================================================
  
  taskTypes: {
    /** Detected task types with frequencies */
    types: Array<{
      type: string
      frequency: number
      typicalPoints?: number
    }>
    /** Points patterns (e.g., "(10P)") */
    pointsPatterns: string[]
  }
  
  // ============================================================================
  // Subtask Patterns
  // ============================================================================
  
  subtaskPattern: {
    /** Uses subtasks */
    usesSubtasks: boolean
    /** Pattern type */
    patternType: 'letter' | 'number' | 'roman' | 'mixed' | 'none'
    /** Examples */
    examples: string[]
  }
  
  // ============================================================================
  // Formatting Rules
  // ============================================================================
  
  formattingRules: {
    usesTables: boolean
    usesFormulas: boolean
    usesMultipleChoice: boolean
    usesCodeBlocks: boolean
    usesGraphics: boolean
  }
  
  // ============================================================================
  // Difficulty & Scoring
  // ============================================================================
  
  scoring: {
    averagePointsPerTask: number
    minPoints: number
    maxPoints: number
    usesHalfPoints: boolean
    totalPointsTypical?: number
  }
  
  difficultyMix: {
    easy: number
    medium: number
    hard: number
  }
  
  // ============================================================================
  // Coverage & Confidence
  // ============================================================================
  
  /** Topics covered in exams (only from sources) */
  coveredTopics: Array<{
    topic: string
    confidence: ConfidenceLevel
    source: 'exam' | 'inferred-from-exercises'
  }>
  
  /** Overall confidence level for this profile */
  overallConfidence: ConfidenceLevel
  
  /** Whether data was supplemented from exercises */
  inferredFromExercises: boolean
  
  // ============================================================================
  // Metadata
  // ============================================================================
  
  /** Number of exam documents analyzed */
  sourceExamCount: number
  
  /** Number of exercise docs used for inference */
  sourceExerciseCount: number
  
  /** Last built timestamp */
  lastBuiltAt: string
}

// ============================================================================
// Migration Helper: V1 -> V2
// ============================================================================

/**
 * Check if an analysis is V1 format
 */
export function isV1Analysis(analysis: unknown): boolean {
  if (!analysis || typeof analysis !== 'object') return false
  const a = analysis as Record<string, unknown>
  return !a.schemaVersion || a.schemaVersion === '1.0.0'
}

/**
 * Migrate V1 analysis to V2 format (best-effort)
 */
export function migrateAnalysisV1ToV2(v1: Record<string, unknown>, documentType: DocumentType): DocumentAnalysisV2 {
  const now = new Date().toISOString()
  
  // Extract topics
  const rawTopics = Array.isArray(v1.topics) ? v1.topics as string[] : []
  
  // Import topic normalizer dynamically to avoid circular deps
  // For now, do basic normalization
  const canonicalTopics = rawTopics.map(t => t.toLowerCase().trim())
  const topicMapping: Record<string, string> = {}
  rawTopics.forEach((t, i) => { topicMapping[t] = canonicalTopics[i] })
  
  // Migrate concepts
  const concepts: ExtractedConceptV2[] = []
  if (Array.isArray(v1.concepts)) {
    for (const c of v1.concepts as Array<Record<string, unknown>>) {
      if (c.term && c.definition) {
        concepts.push({
          id: `concept-${concepts.length}`,
          term: String(c.term),
          definition: String(c.definition),
          evidence: {
            documentId: 'unknown',
            snippet: Array.isArray(c.evidence) ? String(c.evidence[0] || '') : ''
          },
          confidence: 'medium'
        })
      }
    }
  }
  
  // Migrate formulas (filter out non-latex entries)
  const formulas: ExtractedFormulaV2[] = []
  if (Array.isArray(v1.formulas)) {
    for (const f of v1.formulas as Array<Record<string, unknown>>) {
      const latex = String(f.latex || f.value || '')
      // Only include if it looks like LaTeX (contains \ or ^ or _ or {})
      if (latex && /[\\^_{}]/.test(latex)) {
        formulas.push({
          id: `formula-${formulas.length}`,
          latex,
          description: f.description ? String(f.description) : undefined,
          evidence: {
            documentId: 'unknown',
            snippet: Array.isArray(f.evidence) ? String(f.evidence[0] || '') : ''
          },
          confidence: 'medium'
        })
      }
    }
  }
  
  return {
    schemaVersion: '2.0.0',
    documentType,
    canonicalTopics,
    rawTopics,
    topicMapping,
    concepts,
    formulas,
    procedures: [],
    workedExamples: [],
    embeddedExercises: [],
    structuralSignals: {
      usesTables: !!(v1.structuralPatterns as Record<string, unknown>)?.hasTables,
      usesCodeBlocks: !!(v1.structuralPatterns as Record<string, unknown>)?.hasCodeBlocks,
      usesFormulaEnvironments: formulas.length > 0,
      taskNumberingPatterns: [],
      subtaskPatterns: [],
      pointsPatterns: [],
      sectionPatterns: [],
      taskStartPhrases: []
    },
    styleSignals: {
      imperativeVerbs: (v1.structuralPatterns as Record<string, unknown>)?.commonVerbs as string[] || [],
      verbFrequency: {},
      questionPhrases: (v1.structuralPatterns as Record<string, unknown>)?.typicalPhrases as string[] || [],
      notationConventions: {},
      preferredAnswerFormats: []
    },
    processingMetadata: {
      chunksProcessed: 0,
      totalChunks: 0,
      coveragePercent: v1.coveragePercent as number || 0,
      errors: v1.errors as string[] || [],
      coverageNotes: v1.coverageNotes as string[] || [],
      processedAt: now
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for extracted items
 */
export function generateExtractedItemId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
}

/**
 * Validate that a string looks like valid LaTeX
 */
export function isValidLatex(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  
  // Must contain at least one LaTeX indicator
  const latexIndicators = [
    /\\/,           // Backslash commands
    /\^/,           // Superscript
    /_/,            // Subscript
    /\{.*\}/,       // Braces
    /\\frac/,       // Fraction
    /\\sqrt/,       // Square root
    /\\sum/,        // Sum
    /\\int/,        // Integral
    /\\alpha|\\beta|\\gamma/,  // Greek letters
  ]
  
  // Should NOT be just plain text sentences
  const textIndicators = [
    /^[A-Za-z\s,.:;!?äöüß]+$/,  // Just text with punctuation
    /Beispiel/i,                // "Example" indicator
    /siehe/i,                   // "see" reference
    /bzw\./i,                   // "or" abbreviation
  ]
  
  const hasLatex = latexIndicators.some(p => p.test(text))
  const isJustText = textIndicators.some(p => p.test(text))
  
  return hasLatex && !isJustText
}
