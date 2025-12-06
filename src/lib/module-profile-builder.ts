/**
 * Module Profile Builder
 * 
 * Builds aggregated module-level profiles from document analyses.
 * These profiles are used to improve task/exam generation by:
 * - Capturing exam style patterns (phrases, scoring, formatting)
 * - Understanding exercise patterns (subtasks, verbs, point conventions)
 * - Building a knowledge index from scripts (topics, definitions, formulas)
 * 
 * The profiles are cached and only rebuilt when source documents change.
 */

import { 
  listDocumentAnalyses, 
  getModuleProfile, 
  upsertModuleProfile 
} from './analysis-storage'
import { 
  MODULE_PROFILE_VERSION,
  type DocumentAnalysisRecord, 
  type ModuleProfileRecord,
  type DocumentType
} from './analysis-types'
import type { MergedDocumentAnalysis } from './document-analyzer'

// ============================================================================
// Types for Profile Building
// ============================================================================

/**
 * Exam style profile aggregated from exam analyses
 */
export interface ExamStyleProfile {
  /** Common phrases found across exams */
  commonPhrases: string[]
  /** Phrase frequency map */
  phraseFrequency: Record<string, number>
  /** Scoring patterns */
  scoringPatterns: {
    averagePointsPerTask: number
    minPoints: number
    maxPoints: number
    usesHalfPoints: boolean
  }
  /** Formatting rules observed */
  formattingRules: {
    usesTables: boolean
    usesFormulas: boolean
    usesMultipleChoice: boolean
    usesSubtasks: boolean
    usesLetterSubtasks: boolean
    usesNumberedSubtasks: boolean
  }
  /** Difficulty distribution */
  difficultyMix: {
    easy: number
    medium: number
    hard: number
  }
  /** Topics covered in exams */
  coveredTopics: string[]
  /** Number of exam documents analyzed */
  sourceDocumentCount: number
}

/**
 * Exercise style profile aggregated from exercise+solution analyses
 */
export interface ExerciseStyleProfile {
  /** Common verbs used in exercises */
  commonVerbs: string[]
  /** Verb frequency map */
  verbFrequency: Record<string, number>
  /** Subtask usage patterns */
  subtaskPatterns: {
    usesSubtasks: boolean
    usesLetterSubtasks: boolean
    usesNumberedSubtasks: boolean
    averageSubtasksPerExercise: number
  }
  /** Solution formatting patterns */
  solutionFormatting: {
    hasStepByStep: boolean
    usesFormulas: boolean
    usesCodeBlocks: boolean
    usesTables: boolean
  }
  /** Point conventions */
  pointConventions: {
    averagePoints: number
    minPoints: number
    maxPoints: number
    hasPointsDistribution: boolean
  }
  /** Typical phrases in exercises */
  typicalPhrases: string[]
  /** Number of exercise+solution documents analyzed */
  sourceDocumentCount: number
}

/**
 * Module knowledge index built from script analyses
 */
export interface ModuleKnowledgeIndex {
  /** All topics across all scripts */
  allTopics: string[]
  /** Topic frequency map */
  topicFrequency: Record<string, number>
  /** Inverted index: topic -> document references */
  topicIndex: Record<string, Array<{
    documentId: string
    documentName?: string
  }>>
  /** All definitions/concepts */
  definitions: Array<{
    term: string
    definition?: string
    documentId: string
  }>
  /** All formulas */
  formulas: Array<{
    latex: string
    description?: string
    documentId: string
  }>
  /** All procedures/algorithms */
  procedures: Array<{
    name: string
    description?: string
    documentId: string
  }>
  /** Number of script documents analyzed */
  sourceDocumentCount: number
}

/**
 * Coverage statistics for the module profile
 */
export interface ModuleCoverageStats {
  /** Total documents in module */
  totalDocuments: number
  /** Documents with completed analysis */
  analyzedDocuments: number
  /** Overall coverage percentage (0-100) */
  coveragePercent: number
  /** Weighted coverage (scripts have more weight) */
  weightedCoveragePercent: number
  /** Breakdown by document type */
  byType: {
    scripts: { total: number; analyzed: number }
    exercises: { total: number; analyzed: number }
    solutions: { total: number; analyzed: number }
    exams: { total: number; analyzed: number }
  }
}

// ============================================================================
// Hash Computation
// ============================================================================

/**
 * Compute an aggregate hash from all source document hashes and analysis versions
 */
async function computeAggregateHash(analyses: DocumentAnalysisRecord[]): Promise<string> {
  // Sort by documentId for consistent ordering
  const sorted = [...analyses].sort((a, b) => a.documentId.localeCompare(b.documentId))
  
  // Concatenate all hashes and versions
  const combined = sorted
    .map(a => `${a.sourceHash}:${a.analysisVersion}`)
    .join('|')
  
  // Compute SHA-256
  const encoder = new TextEncoder()
  const data = encoder.encode(combined)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// Profile Building Functions
// ============================================================================

/**
 * Partition analyses by document type
 */
function partitionByType(analyses: DocumentAnalysisRecord[]): {
  scripts: DocumentAnalysisRecord[]
  exercises: DocumentAnalysisRecord[]
  solutions: DocumentAnalysisRecord[]
  exams: DocumentAnalysisRecord[]
} {
  return {
    scripts: analyses.filter(a => a.documentType === 'script'),
    exercises: analyses.filter(a => a.documentType === 'exercise'),
    solutions: analyses.filter(a => a.documentType === 'solution'),
    exams: analyses.filter(a => a.documentType === 'exam'),
  }
}

/**
 * Safely parse analysis JSON
 */
function parseAnalysisJson(record: DocumentAnalysisRecord): MergedDocumentAnalysis | null {
  try {
    if (!record.analysisJson) return null
    return JSON.parse(record.analysisJson) as MergedDocumentAnalysis
  } catch (e) {
    console.warn(`[ModuleProfileBuilder] Failed to parse analysis JSON for ${record.documentId}:`, e)
    return null
  }
}

/**
 * Build exam style profile from exam analyses
 */
function buildExamStyleProfile(exams: DocumentAnalysisRecord[]): ExamStyleProfile {
  const profile: ExamStyleProfile = {
    commonPhrases: [],
    phraseFrequency: {},
    scoringPatterns: {
      averagePointsPerTask: 0,
      minPoints: Infinity,
      maxPoints: 0,
      usesHalfPoints: false,
    },
    formattingRules: {
      usesTables: false,
      usesFormulas: false,
      usesMultipleChoice: false,
      usesSubtasks: false,
      usesLetterSubtasks: false,
      usesNumberedSubtasks: false,
    },
    difficultyMix: { easy: 0, medium: 0, hard: 0 },
    coveredTopics: [],
    sourceDocumentCount: exams.length,
  }

  if (exams.length === 0) return profile

  const allPhrases: string[] = []
  const allTopics: string[] = []
  const pointsValues: number[] = []
  let difficultySum = { easy: 0, medium: 0, hard: 0 }
  let formatCounts = { tables: 0, formulas: 0, mc: 0, subtasks: 0, letterSub: 0, numSub: 0 }

  for (const exam of exams) {
    const parsed = parseAnalysisJson(exam)
    if (!parsed) continue

    // Collect phrases
    if (parsed.examStylePatterns?.commonPhrases) {
      allPhrases.push(...parsed.examStylePatterns.commonPhrases)
    }
    if (parsed.structuralPatterns?.typicalPhrases) {
      allPhrases.push(...parsed.structuralPatterns.typicalPhrases)
    }

    // Collect topics
    if (parsed.topics) {
      allTopics.push(...parsed.topics)
    }

    // Collect scoring patterns
    if (parsed.examStylePatterns?.averagePointsPerTask) {
      pointsValues.push(parsed.examStylePatterns.averagePointsPerTask)
    }

    // Aggregate difficulty mix
    if (parsed.examStylePatterns?.typicalDifficultyMix) {
      difficultySum.easy += parsed.examStylePatterns.typicalDifficultyMix.easy
      difficultySum.medium += parsed.examStylePatterns.typicalDifficultyMix.medium
      difficultySum.hard += parsed.examStylePatterns.typicalDifficultyMix.hard
    }

    // Aggregate formatting patterns
    if (parsed.examStylePatterns?.formattingPatterns) {
      if (parsed.examStylePatterns.formattingPatterns.usesTables) formatCounts.tables++
      if (parsed.examStylePatterns.formattingPatterns.usesFormulas) formatCounts.formulas++
      if (parsed.examStylePatterns.formattingPatterns.usesMultipleChoice) formatCounts.mc++
      if (parsed.examStylePatterns.formattingPatterns.usesSubtasks) formatCounts.subtasks++
    }
    if (parsed.structuralPatterns) {
      if (parsed.structuralPatterns.usesLetterSubtasks) formatCounts.letterSub++
      if (parsed.structuralPatterns.usesNumberedSubtasks) formatCounts.numSub++
    }
  }

  // Compute phrase frequency
  const phraseFreq: Record<string, number> = {}
  for (const phrase of allPhrases) {
    const normalized = phrase.toLowerCase().trim()
    phraseFreq[normalized] = (phraseFreq[normalized] || 0) + 1
  }
  
  // Sort phrases by frequency
  const sortedPhrases = Object.entries(phraseFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
  
  profile.commonPhrases = sortedPhrases.map(([phrase]) => phrase)
  profile.phraseFrequency = Object.fromEntries(sortedPhrases)

  // Compute topic coverage
  const topicFreq: Record<string, number> = {}
  for (const topic of allTopics) {
    const normalized = topic.toLowerCase().trim()
    topicFreq[normalized] = (topicFreq[normalized] || 0) + 1
  }
  profile.coveredTopics = Object.keys(topicFreq)

  // Compute scoring patterns
  if (pointsValues.length > 0) {
    profile.scoringPatterns.averagePointsPerTask = 
      pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length
    profile.scoringPatterns.minPoints = Math.min(...pointsValues)
    profile.scoringPatterns.maxPoints = Math.max(...pointsValues)
    profile.scoringPatterns.usesHalfPoints = pointsValues.some(p => p % 1 !== 0)
  }

  // Normalize difficulty mix
  const totalDiff = difficultySum.easy + difficultySum.medium + difficultySum.hard
  if (totalDiff > 0) {
    profile.difficultyMix = {
      easy: Math.round((difficultySum.easy / totalDiff) * 100),
      medium: Math.round((difficultySum.medium / totalDiff) * 100),
      hard: Math.round((difficultySum.hard / totalDiff) * 100),
    }
  }

  // Determine formatting rules (majority voting)
  const threshold = exams.length / 2
  profile.formattingRules = {
    usesTables: formatCounts.tables > threshold,
    usesFormulas: formatCounts.formulas > threshold,
    usesMultipleChoice: formatCounts.mc > threshold,
    usesSubtasks: formatCounts.subtasks > threshold,
    usesLetterSubtasks: formatCounts.letterSub > threshold,
    usesNumberedSubtasks: formatCounts.numSub > threshold,
  }

  return profile
}

/**
 * Build exercise style profile from exercise+solution analyses
 */
function buildExerciseStyleProfile(
  exercises: DocumentAnalysisRecord[],
  solutions: DocumentAnalysisRecord[]
): ExerciseStyleProfile {
  const allDocs = [...exercises, ...solutions]
  
  const profile: ExerciseStyleProfile = {
    commonVerbs: [],
    verbFrequency: {},
    subtaskPatterns: {
      usesSubtasks: false,
      usesLetterSubtasks: false,
      usesNumberedSubtasks: false,
      averageSubtasksPerExercise: 0,
    },
    solutionFormatting: {
      hasStepByStep: false,
      usesFormulas: false,
      usesCodeBlocks: false,
      usesTables: false,
    },
    pointConventions: {
      averagePoints: 0,
      minPoints: Infinity,
      maxPoints: 0,
      hasPointsDistribution: false,
    },
    typicalPhrases: [],
    sourceDocumentCount: allDocs.length,
  }

  if (allDocs.length === 0) return profile

  const allVerbs: string[] = []
  const allPhrases: string[] = []
  let subtaskCount = 0
  let hasPoints = 0
  let formatCounts = { stepByStep: 0, formulas: 0, code: 0, tables: 0 }
  let structureCounts = { subtasks: 0, letterSub: 0, numSub: 0 }

  for (const doc of allDocs) {
    const parsed = parseAnalysisJson(doc)
    if (!parsed) continue

    // Collect verbs
    if (parsed.structuralPatterns?.commonVerbs) {
      allVerbs.push(...parsed.structuralPatterns.commonVerbs)
    }

    // Collect phrases
    if (parsed.structuralPatterns?.typicalPhrases) {
      allPhrases.push(...parsed.structuralPatterns.typicalPhrases)
    }

    // Count structural patterns
    if (parsed.structuralPatterns) {
      if (parsed.structuralPatterns.hasSubtasks) {
        structureCounts.subtasks++
        subtaskCount += 3 // Assume average 3 subtasks per exercise
      }
      if (parsed.structuralPatterns.usesLetterSubtasks) structureCounts.letterSub++
      if (parsed.structuralPatterns.usesNumberedSubtasks) structureCounts.numSub++
      if (parsed.structuralPatterns.hasPointsDistribution) hasPoints++
      if (parsed.structuralPatterns.hasTables) formatCounts.tables++
      if (parsed.structuralPatterns.hasCodeBlocks) formatCounts.code++
    }

    // Check for formulas
    if (parsed.formulas && parsed.formulas.length > 0) {
      formatCounts.formulas++
    }

    // Check for step-by-step (in solutions)
    if (doc.documentType === 'solution') {
      // Look for step indicators in items
      const hasSteps = parsed.items?.some(item => 
        item.value.match(/schritt|step|zunächst|dann|abschließend/i)
      )
      if (hasSteps) formatCounts.stepByStep++
    }
  }

  // Compute verb frequency
  const verbFreq: Record<string, number> = {}
  for (const verb of allVerbs) {
    const normalized = verb.toLowerCase().trim()
    verbFreq[normalized] = (verbFreq[normalized] || 0) + 1
  }
  
  const sortedVerbs = Object.entries(verbFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
  
  profile.commonVerbs = sortedVerbs.map(([verb]) => verb)
  profile.verbFrequency = Object.fromEntries(sortedVerbs)

  // Compute phrase list
  const phraseFreq: Record<string, number> = {}
  for (const phrase of allPhrases) {
    const normalized = phrase.toLowerCase().trim()
    phraseFreq[normalized] = (phraseFreq[normalized] || 0) + 1
  }
  profile.typicalPhrases = Object.entries(phraseFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase)

  // Subtask patterns (majority voting)
  const threshold = allDocs.length / 2
  profile.subtaskPatterns = {
    usesSubtasks: structureCounts.subtasks > threshold,
    usesLetterSubtasks: structureCounts.letterSub > threshold,
    usesNumberedSubtasks: structureCounts.numSub > threshold,
    averageSubtasksPerExercise: structureCounts.subtasks > 0 
      ? subtaskCount / structureCounts.subtasks 
      : 0,
  }

  // Solution formatting
  profile.solutionFormatting = {
    hasStepByStep: formatCounts.stepByStep > solutions.length / 2,
    usesFormulas: formatCounts.formulas > threshold,
    usesCodeBlocks: formatCounts.code > threshold,
    usesTables: formatCounts.tables > threshold,
  }

  // Point conventions
  profile.pointConventions.hasPointsDistribution = hasPoints > threshold

  return profile
}

/**
 * Build knowledge index from script analyses
 */
function buildModuleKnowledgeIndex(scripts: DocumentAnalysisRecord[]): ModuleKnowledgeIndex {
  const index: ModuleKnowledgeIndex = {
    allTopics: [],
    topicFrequency: {},
    topicIndex: {},
    definitions: [],
    formulas: [],
    procedures: [],
    sourceDocumentCount: scripts.length,
  }

  if (scripts.length === 0) return index

  const topicFreq: Record<string, number> = {}
  const topicDocs: Record<string, Set<string>> = {}

  for (const script of scripts) {
    const parsed = parseAnalysisJson(script)
    if (!parsed) continue

    const docId = script.documentId

    // Collect topics and build inverted index
    if (parsed.topics) {
      for (const topic of parsed.topics) {
        const normalized = topic.toLowerCase().trim()
        topicFreq[normalized] = (topicFreq[normalized] || 0) + 1
        
        if (!topicDocs[normalized]) {
          topicDocs[normalized] = new Set()
        }
        topicDocs[normalized].add(docId)
      }
    }

    // Collect concepts/definitions
    if (parsed.concepts) {
      for (const concept of parsed.concepts) {
        index.definitions.push({
          term: concept.term,
          definition: concept.definition,
          documentId: docId,
        })
      }
    }

    // Collect formulas
    if (parsed.formulas) {
      for (const formula of parsed.formulas) {
        index.formulas.push({
          latex: formula.latex,
          description: formula.description,
          documentId: docId,
        })
      }
    }

    // Collect procedures (from items with type 'procedure')
    if (parsed.items) {
      const procedureItems = parsed.items.filter(i => i.type === 'procedure')
      for (const proc of procedureItems) {
        index.procedures.push({
          name: proc.value,
          description: proc.details,
          documentId: docId,
        })
      }
    }
  }

  // Finalize topic data
  index.topicFrequency = topicFreq
  index.allTopics = Object.keys(topicFreq).sort((a, b) => topicFreq[b] - topicFreq[a])
  
  // Build topic index
  for (const [topic, docIds] of Object.entries(topicDocs)) {
    index.topicIndex[topic] = Array.from(docIds).map(docId => ({ documentId: docId }))
  }

  // Deduplicate definitions by term (keep first occurrence)
  const seenTerms = new Set<string>()
  index.definitions = index.definitions.filter(def => {
    const normalized = def.term.toLowerCase().trim()
    if (seenTerms.has(normalized)) return false
    seenTerms.add(normalized)
    return true
  })

  // Deduplicate formulas by latex
  const seenFormulas = new Set<string>()
  index.formulas = index.formulas.filter(f => {
    const normalized = f.latex.toLowerCase().trim()
    if (seenFormulas.has(normalized)) return false
    seenFormulas.add(normalized)
    return true
  })

  return index
}

/**
 * Calculate coverage statistics for a module
 */
export function calculateCoverageStats(
  allAnalyses: DocumentAnalysisRecord[],
  totalScripts: number,
  totalExercises: number,
  totalSolutions: number,
  totalExams: number
): ModuleCoverageStats {
  const partitioned = partitionByType(allAnalyses)
  const doneAnalyses = allAnalyses.filter(a => a.status === 'done')
  const donePartitioned = partitionByType(doneAnalyses)

  const totalDocs = totalScripts + totalExercises + totalSolutions + totalExams
  const analyzedDocs = doneAnalyses.length

  // Simple coverage
  const coveragePercent = totalDocs > 0 
    ? Math.round((analyzedDocs / totalDocs) * 100) 
    : 0

  // Weighted coverage (scripts have 2x weight since they're the primary knowledge source)
  const scriptWeight = 2
  const otherWeight = 1
  const totalWeight = (totalScripts * scriptWeight) + 
    ((totalExercises + totalSolutions + totalExams) * otherWeight)
  const analyzedWeight = (donePartitioned.scripts.length * scriptWeight) + 
    ((donePartitioned.exercises.length + donePartitioned.solutions.length + donePartitioned.exams.length) * otherWeight)
  const weightedCoveragePercent = totalWeight > 0 
    ? Math.round((analyzedWeight / totalWeight) * 100) 
    : 0

  return {
    totalDocuments: totalDocs,
    analyzedDocuments: analyzedDocs,
    coveragePercent,
    weightedCoveragePercent,
    byType: {
      scripts: { total: totalScripts, analyzed: donePartitioned.scripts.length },
      exercises: { total: totalExercises, analyzed: donePartitioned.exercises.length },
      solutions: { total: totalSolutions, analyzed: donePartitioned.solutions.length },
      exams: { total: totalExams, analyzed: donePartitioned.exams.length },
    },
  }
}

// ============================================================================
// Main API Functions
// ============================================================================

/**
 * Build module profiles from document analyses
 * 
 * @param moduleId - The module to build profiles for
 * @returns The built or cached module profile record
 */
export async function buildModuleProfiles(moduleId: string): Promise<ModuleProfileRecord> {
  console.log(`[ModuleProfileBuilder] Building profiles for module ${moduleId}`)

  // Load all analyses for this module with status 'done'
  const allAnalyses = await listDocumentAnalyses(moduleId)
  const doneAnalyses = allAnalyses.filter(a => a.status === 'done')

  console.log(`[ModuleProfileBuilder] Found ${doneAnalyses.length} completed analyses out of ${allAnalyses.length} total`)

  // Compute aggregate hash
  const sourceHashAggregate = await computeAggregateHash(doneAnalyses)

  // Check if we already have a valid cached profile
  const existingProfile = await getModuleProfile(moduleId)
  if (existingProfile && 
      existingProfile.sourceHashAggregate === sourceHashAggregate &&
      existingProfile.profileVersion === MODULE_PROFILE_VERSION &&
      existingProfile.status === 'done') {
    console.log(`[ModuleProfileBuilder] Using cached profile for module ${moduleId}`)
    return existingProfile
  }

  // Partition analyses by type
  const partitioned = partitionByType(doneAnalyses)

  // Build the three profile components
  const examStyleProfile = buildExamStyleProfile(partitioned.exams)
  const exerciseStyleProfile = buildExerciseStyleProfile(partitioned.exercises, partitioned.solutions)
  const moduleKnowledgeIndex = buildModuleKnowledgeIndex(partitioned.scripts)

  // Calculate coverage
  const coverageStats = calculateCoverageStats(
    allAnalyses,
    partitioned.scripts.length,
    partitioned.exercises.length,
    partitioned.solutions.length,
    partitioned.exams.length
  )

  // Create the profile record
  const profileRecord: ModuleProfileRecord = {
    moduleId,
    sourceHashAggregate,
    profileVersion: MODULE_PROFILE_VERSION,
    examStyleProfileJson: JSON.stringify(examStyleProfile),
    exerciseStyleProfileJson: JSON.stringify(exerciseStyleProfile),
    moduleKnowledgeIndexJson: JSON.stringify(moduleKnowledgeIndex),
    lastBuiltAt: new Date().toISOString(),
    status: 'done',
    coveragePercent: coverageStats.weightedCoveragePercent,
  }

  // Persist the profile
  await upsertModuleProfile(profileRecord)

  console.log(`[ModuleProfileBuilder] Built profile for module ${moduleId} with ${coverageStats.coveragePercent}% coverage`)

  return profileRecord
}

/**
 * Get or build module profiles
 * 
 * If a valid cached profile exists, returns it immediately.
 * Otherwise, builds the profile from document analyses.
 * 
 * @param moduleId - The module ID
 * @returns The module profile record
 */
export async function getOrBuildModuleProfiles(moduleId: string): Promise<ModuleProfileRecord> {
  return buildModuleProfiles(moduleId)
}

/**
 * Parse the exam style profile from a module profile record
 */
export function parseExamStyleProfile(record: ModuleProfileRecord): ExamStyleProfile | null {
  try {
    if (!record.examStyleProfileJson) return null
    return JSON.parse(record.examStyleProfileJson) as ExamStyleProfile
  } catch {
    return null
  }
}

/**
 * Parse the exercise style profile from a module profile record
 */
export function parseExerciseStyleProfile(record: ModuleProfileRecord): ExerciseStyleProfile | null {
  try {
    if (!record.exerciseStyleProfileJson) return null
    return JSON.parse(record.exerciseStyleProfileJson) as ExerciseStyleProfile
  } catch {
    return null
  }
}

/**
 * Parse the module knowledge index from a module profile record
 */
export function parseModuleKnowledgeIndex(record: ModuleProfileRecord): ModuleKnowledgeIndex | null {
  try {
    if (!record.moduleKnowledgeIndexJson) return null
    return JSON.parse(record.moduleKnowledgeIndexJson) as ModuleKnowledgeIndex
  } catch {
    return null
  }
}

/**
 * Invalidate module profile (force rebuild on next access)
 * 
 * This is called when documents are added/deleted
 */
export async function invalidateModuleProfile(moduleId: string): Promise<void> {
  const existing = await getModuleProfile(moduleId)
  if (existing) {
    await upsertModuleProfile({
      ...existing,
      status: 'queued', // Mark as needing rebuild
      sourceHashAggregate: '', // Invalidate hash
    })
  }
}
