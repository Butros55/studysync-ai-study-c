/**
 * Types for Document Analysis and Module Profiles
 * 
 * These types support the new document analysis pipeline that:
 * - Analyzes uploaded documents (scripts, exercises, solutions, exams)
 * - Builds aggregated module profiles for improved task generation
 * - Tracks user preferences for input modes
 */

// ============================================================================
// Version Constants (for future migrations)
// ============================================================================

/** Current version of the document analysis schema */
export const DOCUMENT_ANALYSIS_VERSION = '1.0.0'

/** Current version of the module profile schema */
export const MODULE_PROFILE_VERSION = '1.0.0'

// ============================================================================
// Document Types
// ============================================================================

/**
 * Document types for analysis
 * Note: This is a subset of FileCategory focusing on analyzable content
 */
export type DocumentType = 'script' | 'exercise' | 'solution' | 'exam'

/**
 * Status of a document's analysis
 */
export type AnalysisStatus = 'missing' | 'queued' | 'running' | 'done' | 'error'

/**
 * User's preferred input mode for solving tasks
 */
export type InputMode = 'type' | 'draw'

// ============================================================================
// Document Analysis Record
// ============================================================================

/**
 * Stores the analysis result for a single document
 * 
 * The analysisJson field contains structured information extracted from the document,
 * such as topics, key concepts, formulas, and structural patterns.
 */
export interface DocumentAnalysisRecord {
  /** Unique identifier for this analysis record */
  id: string
  
  /** The module this document belongs to */
  moduleId: string
  
  /** The document (script) being analyzed */
  documentId: string
  
  /** Type of document being analyzed */
  documentType: DocumentType
  
  /** Hash of the source text content (for cache invalidation) */
  sourceHash: string
  
  /** Version of the analysis schema used */
  analysisVersion: string
  
  /** Current status of the analysis */
  status: AnalysisStatus
  
  /** Percentage of document content that was successfully analyzed (0-100) */
  coveragePercent: number
  
  /** 
   * The structured analysis result as JSON string
   * Contains: topics, key concepts, formulas, difficulty indicators, etc.
   */
  analysisJson: string
  
  /** Total number of chunks the document was split into */
  chunkCount: number
  
  /** Number of chunks that have been processed */
  processedChunkCount: number
  
  /** Timestamp when analysis was last run */
  lastAnalyzedAt: string
  
  /** Error message if status is 'error' */
  errorMessage?: string
}

// ============================================================================
// Module Profile Record
// ============================================================================

/**
 * Aggregated profile for a module, built from all analyzed documents
 * 
 * This profile is used to:
 * - Generate tasks in the style of the module's exams
 * - Apply exercise patterns from the module's exercises
 * - Use the knowledge base from the module's scripts
 */
export interface ModuleProfileRecord {
  /** The module this profile belongs to */
  moduleId: string
  
  /** Aggregate hash of all source documents (for cache invalidation) */
  sourceHashAggregate: string
  
  /** Version of the profile schema used */
  profileVersion: string
  
  /**
   * Extracted exam style profile as JSON string
   * Based on ExamStyleProfile type, derived from 'exam' documents
   */
  examStyleProfileJson: string
  
  /**
   * Extracted exercise style patterns as JSON string
   * Derived from 'exercise' and 'solution' documents
   */
  exerciseStyleProfileJson: string
  
  /**
   * Knowledge index built from 'script' documents as JSON string
   * Contains: topics, concepts, formulas, definitions
   */
  moduleKnowledgeIndexJson: string
  
  /** Timestamp when profile was last built */
  lastBuiltAt: string
  
  /** Current status of the profile build */
  status: AnalysisStatus
  
  /** Overall coverage percentage across all documents (0-100) */
  coveragePercent: number
  
  /** Error message if status is 'error' */
  errorMessage?: string
}

// ============================================================================
// User Preferences
// ============================================================================

/**
 * User preferences that persist across sessions
 */
export interface UserPreferences {
  /** 
   * User's preferred input mode for solving tasks
   * undefined = not yet set (user hasn't made a choice)
   */
  preferredInputMode?: InputMode
}

// ============================================================================
// Parsed Analysis Types (for working with the JSON fields)
// ============================================================================

/**
 * Parsed structure of DocumentAnalysisRecord.analysisJson
 * Used when working with the analysis data programmatically
 */
export interface DocumentAnalysis {
  /** Main topics covered in the document */
  topics: string[]
  
  /** Key concepts and definitions */
  concepts: Array<{
    term: string
    definition?: string
  }>
  
  /** Formulas found in the document */
  formulas: Array<{
    latex: string
    description?: string
  }>
  
  /** Structural patterns (for exercises/exams) */
  structuralPatterns?: {
    hasSubtasks: boolean
    hasPointsDistribution: boolean
    hasTables: boolean
    hasCodeBlocks: boolean
  }
  
  /** Estimated difficulty distribution */
  difficultyIndicators?: {
    easy: number
    medium: number
    hard: number
  }
  
  /** Raw extracted text summary */
  summary?: string
}

/**
 * Parsed structure of ModuleProfileRecord.moduleKnowledgeIndexJson
 */
export interface ModuleKnowledgeIndex {
  /** All topics from all scripts */
  allTopics: string[]
  
  /** Merged concepts from all scripts */
  allConcepts: Array<{
    term: string
    definition?: string
    sourceDocumentId: string
  }>
  
  /** All formulas from all scripts */
  allFormulas: Array<{
    latex: string
    description?: string
    sourceDocumentId: string
  }>
  
  /** Topic frequency map */
  topicFrequency: Record<string, number>
}

/**
 * Parsed structure of ModuleProfileRecord.exerciseStyleProfileJson
 */
export interface ExerciseStyleProfile {
  /** Common task patterns from exercises */
  taskPatterns: Array<{
    type: string
    frequency: number
    examplePrompt?: string
  }>
  
  /** Typical points distribution */
  pointsDistribution: {
    min: number
    max: number
    average: number
  }
  
  /** Whether exercises typically have solutions */
  hasSolutions: boolean
  
  /** Common formatting patterns */
  formattingPatterns: {
    usesNumberedSubtasks: boolean
    usesLetterSubtasks: boolean
    usesTables: boolean
    usesCodeBlocks: boolean
  }
}
