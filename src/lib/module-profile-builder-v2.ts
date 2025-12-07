/**
 * Module Profile Builder V2
 * 
 * Enhanced profile building with:
 * - V2 analysis schema integration
 * - Task archetype detection and storage
 * - Entity reference linking (concepts, formulas, procedures to topics)
 * - Enhanced exercise/exam style profiles
 * - Confidence tracking for single-exam scenarios
 */

import { 
  listDocumentAnalyses, 
  getModuleProfile, 
  upsertModuleProfile 
} from './analysis-storage'
import { 
  MODULE_PROFILE_VERSION,
  type DocumentAnalysisRecord, 
  type ModuleProfileRecord
} from './analysis-types'
import {
  DocumentAnalysisV2,
  ModuleKnowledgeIndexV2,
  ExerciseStyleProfileV2,
  ExamStyleProfileV2,
  TaskArchetype,
  ExtractedConceptV2,
  ExtractedFormulaV2,
  ExtractedProcedureV2,
  ExtractedWorkedExampleV2,
  ConfidenceLevel,
  isV1Analysis,
  migrateAnalysisV1ToV2
} from './analysis-types-v2'
import { 
  normalizeTopicKey, 
  findCanonicalTopic, 
  isNoiseTopic 
} from './topic-normalizer'

// ============================================================================
// Profile Builder V2 Version
// ============================================================================

export const PROFILE_BUILDER_VERSION = '2.0.0'

// ============================================================================
// V2 Profile Building
// ============================================================================

/**
 * Safely parse and migrate analysis JSON to V2
 */
function parseAndMigrateToV2(record: DocumentAnalysisRecord): DocumentAnalysisV2 | null {
  try {
    if (!record.analysisJson) return null
    const parsed = JSON.parse(record.analysisJson)
    
    // Check if it's already V2
    if (parsed.schemaVersion === '2.0.0') {
      return parsed as DocumentAnalysisV2
    }
    
    // Migrate V1 to V2
    if (isV1Analysis(parsed)) {
      return migrateAnalysisV1ToV2(parsed, record.documentType)
    }
    
    return null
  } catch (e) {
    console.warn(`[ModuleProfileBuilderV2] Failed to parse analysis for ${record.documentId}:`, e)
    return null
  }
}

/**
 * Build V2 Knowledge Index from analyses
 */
function buildKnowledgeIndexV2(
  analyses: DocumentAnalysisV2[],
  scriptAnalyses: DocumentAnalysisV2[]
): ModuleKnowledgeIndexV2 {
  const now = new Date().toISOString()
  
  // Collect and normalize all topics
  const topicFrequency: Record<string, number> = {}
  const topicSynonyms: Record<string, string[]> = {}
  const rawToCanonical: Record<string, string> = {}
  
  // Topic index with entity references
  const topicIndex: Record<string, {
    documents: Array<{ documentId: string; documentName?: string }>
    conceptIds: string[]
    formulaIds: string[]
    procedureIds: string[]
    exampleIds: string[]
    exerciseIds: string[]
  }> = {}
  
  // Collected entities
  const allConcepts: ExtractedConceptV2[] = []
  const allFormulas: ExtractedFormulaV2[] = []
  const allProcedures: ExtractedProcedureV2[] = []
  const allWorkedExamples: ExtractedWorkedExampleV2[] = []
  
  // Process each analysis
  for (const analysis of analyses) {
    const docId = analysis.processingMetadata?.processedAt || 'unknown'
    
    // Process topics
    for (const rawTopic of analysis.rawTopics || []) {
      if (isNoiseTopic(rawTopic)) continue
      
      const canonical = findCanonicalTopic(rawTopic) || normalizeTopicKey(rawTopic)
      rawToCanonical[rawTopic] = canonical
      topicFrequency[canonical] = (topicFrequency[canonical] || 0) + 1
      
      // Track synonyms
      if (!topicSynonyms[canonical]) {
        topicSynonyms[canonical] = []
      }
      if (!topicSynonyms[canonical].includes(rawTopic) && rawTopic !== canonical) {
        topicSynonyms[canonical].push(rawTopic)
      }
      
      // Initialize topic index entry
      if (!topicIndex[canonical]) {
        topicIndex[canonical] = {
          documents: [],
          conceptIds: [],
          formulaIds: [],
          procedureIds: [],
          exampleIds: [],
          exerciseIds: []
        }
      }
      
      // Add document reference
      const docRef = { documentId: docId }
      if (!topicIndex[canonical].documents.some(d => d.documentId === docId)) {
        topicIndex[canonical].documents.push(docRef)
      }
    }
    
    // Collect entities and link to topics
    for (const concept of analysis.concepts || []) {
      allConcepts.push(concept)
      
      // Link to relevant topics
      const conceptTopics = analysis.canonicalTopics || []
      for (const topic of conceptTopics) {
        if (topicIndex[topic]) {
          topicIndex[topic].conceptIds.push(concept.id)
        }
      }
    }
    
    for (const formula of analysis.formulas || []) {
      allFormulas.push(formula)
      
      for (const topic of analysis.canonicalTopics || []) {
        if (topicIndex[topic]) {
          topicIndex[topic].formulaIds.push(formula.id)
        }
      }
    }
    
    for (const procedure of analysis.procedures || []) {
      allProcedures.push(procedure)
      
      for (const topic of analysis.canonicalTopics || []) {
        if (topicIndex[topic]) {
          topicIndex[topic].procedureIds.push(procedure.id)
        }
      }
    }
    
    for (const example of analysis.workedExamples || []) {
      allWorkedExamples.push(example)
      
      // Link to example's specific topics
      for (const exTopic of example.topics || []) {
        const canonical = findCanonicalTopic(exTopic) || normalizeTopicKey(exTopic)
        if (topicIndex[canonical]) {
          topicIndex[canonical].exampleIds.push(example.id)
        }
      }
    }
    
    // Link exercises to topics
    for (const exercise of analysis.embeddedExercises || []) {
      for (const exTopic of exercise.topics || []) {
        const canonical = findCanonicalTopic(exTopic) || normalizeTopicKey(exTopic)
        if (topicIndex[canonical]) {
          topicIndex[canonical].exerciseIds.push(exercise.id)
        }
      }
    }
  }
  
  // Sort canonical topics by frequency
  const canonicalTopics = Object.keys(topicFrequency)
    .sort((a, b) => topicFrequency[b] - topicFrequency[a])
  
  // Deduplicate concepts by normalized term
  const conceptMap = new Map<string, ExtractedConceptV2>()
  for (const c of allConcepts) {
    const key = c.term.toLowerCase().trim()
    if (!conceptMap.has(key) || c.definition.length > (conceptMap.get(key)?.definition.length || 0)) {
      conceptMap.set(key, c)
    }
  }
  
  // Deduplicate formulas by normalized LaTeX
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
  
  return {
    schemaVersion: '2.0.0',
    canonicalTopics,
    topicSynonyms,
    topicFrequency,
    topicIndex,
    concepts: Array.from(conceptMap.values()),
    formulas: Array.from(formulaMap.values()),
    procedures: Array.from(procedureMap.values()),
    workedExamples: allWorkedExamples,
    sourceDocumentCount: scriptAnalyses.length,
    lastBuiltAt: now
  }
}

/**
 * Build V2 Exercise Style Profile
 */
function buildExerciseStyleProfileV2(
  exerciseAnalyses: DocumentAnalysisV2[],
  solutionAnalyses: DocumentAnalysisV2[]
): ExerciseStyleProfileV2 {
  const now = new Date().toISOString()
  const allAnalyses = [...exerciseAnalyses, ...solutionAnalyses]
  
  // Verb analysis
  const verbCounts: Record<string, number> = {}
  const typicalPhrases: string[] = []
  
  // Structure analysis
  let totalSubtasks = 0
  let exerciseWithSubtasks = 0
  let usesLetterSubtasks = false
  let usesNumberedSubtasks = false
  const taskNumberingPatterns = new Set<string>()
  const subtaskPatternSet = new Set<string>()
  
  // Points analysis
  const pointsValues: number[] = []
  let usesHalfPoints = false
  let usesPointsOverall = false
  
  // Answer format analysis
  const formatCounts: Record<string, number> = {}
  
  // Notation analysis
  const boolOps = new Set<string>()
  const numNotation = new Set<string>()
  const dontCare = new Set<string>()
  
  // Solution style
  let stepByStepCount = 0
  const outputFormats = new Set<string>()
  
  for (const analysis of allAnalyses) {
    // Extract verbs
    for (const verb of analysis.styleSignals?.imperativeVerbs || []) {
      verbCounts[verb] = (verbCounts[verb] || 0) + 1
    }
    
    // Extract phrases
    typicalPhrases.push(...(analysis.styleSignals?.questionPhrases || []))
    
    // Extract structural patterns
    const ss = analysis.structuralSignals
    if (ss) {
      ss.taskNumberingPatterns?.forEach(p => taskNumberingPatterns.add(p))
      ss.subtaskPatterns?.forEach(p => subtaskPatternSet.add(p))
      if (ss.subtaskPatterns?.some(p => /[a-z]\)/.test(p))) usesLetterSubtasks = true
      if (ss.subtaskPatterns?.some(p => /\d\./.test(p))) usesNumberedSubtasks = true
    }
    
    // Extract notation
    const nc = analysis.styleSignals?.notationConventions
    if (nc) {
      nc.booleanOperators?.forEach(o => boolOps.add(o))
      nc.numberPrefixes?.forEach(p => numNotation.add(p))
    }
    
    // Analyze exercises
    for (const ex of analysis.embeddedExercises || []) {
      // Subtasks
      if (ex.subtasks && ex.subtasks.length > 0) {
        exerciseWithSubtasks++
        totalSubtasks += ex.subtasks.length
      }
      
      // Points
      if (ex.points !== undefined) {
        pointsValues.push(ex.points)
        usesPointsOverall = true
        if (ex.points % 1 !== 0) usesHalfPoints = true
      }
      
      // Answer formats
      for (const fmt of ex.expectedAnswerFormat || []) {
        formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
      }
    }
    
    // Analyze worked examples for solution style
    for (const ex of analysis.workedExamples || []) {
      if (ex.solutionSteps && ex.solutionSteps.length > 2) {
        stepByStepCount++
      }
    }
    
    // Check for output formats
    if (analysis.structuralSignals?.usesTables) outputFormats.add('table')
    if (analysis.structuralSignals?.usesCodeBlocks) outputFormats.add('code')
    if (analysis.structuralSignals?.usesFormulaEnvironments) outputFormats.add('formula')
  }
  
  // Build verb list with frequencies
  const verbs = Object.entries(verbCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([verb, frequency]) => ({ verb, frequency }))
  
  // Calculate averages
  const avgSubtasks = exerciseWithSubtasks > 0 ? totalSubtasks / exerciseWithSubtasks : 0
  const avgPoints = pointsValues.length > 0 
    ? pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length 
    : 10
  
  // Sort answer formats by frequency
  const mostCommonFormats = Object.entries(formatCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([fmt]) => fmt)
    .slice(0, 5)
  
  // Build task archetypes from patterns (basic detection)
  const taskArchetypes: TaskArchetype[] = buildTaskArchetypes(allAnalyses)
  
  return {
    schemaVersion: '2.0.0',
    verbs,
    typicalPhrases: [...new Set(typicalPhrases)].slice(0, 20),
    structure: {
      taskNumbering: Array.from(taskNumberingPatterns),
      usesLetterSubtasks,
      usesNumberedSubtasks,
      avgSubtasksPerExercise: Math.round(avgSubtasks * 10) / 10,
      pointsUsage: {
        usesPoints: usesPointsOverall,
        avgPoints: Math.round(avgPoints * 10) / 10,
        minPoints: pointsValues.length > 0 ? Math.min(...pointsValues) : 0,
        maxPoints: pointsValues.length > 0 ? Math.max(...pointsValues) : 0,
        usesHalfPoints
      },
      typicalSections: ['Aufgabe', 'Hinweis', 'Lösung'] // Default German sections
    },
    answerFormats: {
      frequencies: formatCounts,
      mostCommon: mostCommonFormats
    },
    notationConventions: {
      booleanOperators: Array.from(boolOps),
      numberNotation: Array.from(numNotation),
      dontCareSymbols: Array.from(dontCare),
      indexConventions: [],
      other: []
    },
    taskArchetypes,
    solutionStyle: {
      usesStepByStep: stepByStepCount > allAnalyses.length / 3,
      typicalSteps: [],
      outputFormats: Array.from(outputFormats)
    },
    sourceDocumentCount: allAnalyses.length,
    lastBuiltAt: now
  }
}

/**
 * Build basic task archetypes from exercise patterns
 */
function buildTaskArchetypes(analyses: DocumentAnalysisV2[]): TaskArchetype[] {
  const archetypes: TaskArchetype[] = []
  const seenPatterns = new Set<string>()
  
  // Common archetype patterns to detect
  const archetypePatterns = [
    {
      match: /konvert|umwandl|umrechn/i,
      name: 'Zahlensystem-Konvertierung',
      whenToUse: 'Umrechnung zwischen Zahlensystemen (Dezimal, Binär, Hexadezimal, Oktal)',
      requiredInputs: ['sourceNumber', 'sourceBase', 'targetBase'],
      expectedOutputFormats: ['number'],
      topics: ['zahlensysteme', 'zahlenkonvertierung']
    },
    {
      match: /kv[- ]?diagramm|karnaugh/i,
      name: 'KV-Diagramm',
      whenToUse: 'Minimierung boolescher Funktionen mit Karnaugh-Veitch-Diagramm',
      requiredInputs: ['booleanFunction', 'numVariables'],
      expectedOutputFormats: ['diagram', 'formula'],
      topics: ['kv-diagramm', 'boolesche-algebra']
    },
    {
      match: /quine|mccluskey|qmc/i,
      name: 'Quine-McCluskey',
      whenToUse: 'Algorithmische Minimierung boolescher Funktionen',
      requiredInputs: ['booleanFunction', 'dontCares'],
      expectedOutputFormats: ['table', 'formula'],
      topics: ['quine-mccluskey', 'boolesche-algebra']
    },
    {
      match: /wahrheitstab|truth.?table/i,
      name: 'Wahrheitstabelle',
      whenToUse: 'Erstellen oder Ausfüllen einer Wahrheitstabelle',
      requiredInputs: ['booleanExpression'],
      expectedOutputFormats: ['table'],
      topics: ['wahrheitstabelle', 'boolesche-algebra']
    },
    {
      match: /automat|zustandsmaschin|fsm|dfa|nfa/i,
      name: 'Automaten',
      whenToUse: 'Entwurf oder Analyse von endlichen Automaten',
      requiredInputs: ['specification'],
      expectedOutputFormats: ['diagram', 'table'],
      topics: ['automaten', 'zustandsmaschinen']
    },
    {
      match: /huffman|kompression|encoding/i,
      name: 'Huffman-Codierung',
      whenToUse: 'Erstellen von Huffman-Codes für Datenkompression',
      requiredInputs: ['frequencies', 'alphabet'],
      expectedOutputFormats: ['tree', 'table', 'code'],
      topics: ['huffman', 'codierung']
    }
  ]
  
  // Scan exercises for archetype patterns
  for (const analysis of analyses) {
    for (const exercise of analysis.embeddedExercises || []) {
      for (const pattern of archetypePatterns) {
        if (pattern.match.test(exercise.questionText) && !seenPatterns.has(pattern.name)) {
          seenPatterns.add(pattern.name)
          
          archetypes.push({
            id: `archetype-${pattern.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: pattern.name,
            whenToUse: pattern.whenToUse,
            promptTemplate: `Erstelle eine Aufgabe zum Thema "${pattern.name}". {variationHint}`,
            requiredInputs: pattern.requiredInputs,
            expectedOutputFormats: pattern.expectedOutputFormats,
            variationStrategies: [
              'andere-zahlen',
              'andere-variablen',
              'mehr-teilaufgaben',
              'höhere-schwierigkeit'
            ],
            sourceEvidenceIds: [exercise.id],
            difficultyRange: {
              min: 'easy',
              max: 'hard'
            },
            applicableTopics: pattern.topics
          })
        }
      }
    }
  }
  
  return archetypes
}

/**
 * Build V2 Exam Style Profile
 */
function buildExamStyleProfileV2(
  examAnalyses: DocumentAnalysisV2[],
  exerciseAnalyses: DocumentAnalysisV2[]
): ExamStyleProfileV2 {
  const now = new Date().toISOString()
  
  // Determine confidence level based on source count
  let overallConfidence: ConfidenceLevel = 'low'
  let inferredFromExercises = false
  
  if (examAnalyses.length >= 3) {
    overallConfidence = 'high'
  } else if (examAnalyses.length >= 1) {
    overallConfidence = 'medium'
  } else if (exerciseAnalyses.length > 0) {
    overallConfidence = 'low'
    inferredFromExercises = true
  }
  
  // Use exam analyses if available, otherwise infer from exercises
  const sourceAnalyses = examAnalyses.length > 0 ? examAnalyses : exerciseAnalyses
  
  // Collect operators/verbs
  const operatorCounts: Record<string, { count: number; examples: string[] }> = {}
  const taskTypes: Record<string, { count: number; points: number[] }> = {}
  
  // Subtask patterns
  let usesSubtasks = false
  let subtaskPatternType: 'letter' | 'number' | 'roman' | 'mixed' | 'none' = 'none'
  const subtaskExamples: string[] = []
  
  // Formatting flags
  let usesTables = false
  let usesFormulas = false
  let usesMultipleChoice = false
  let usesCodeBlocks = false
  let usesGraphics = false
  
  // Scoring stats
  const allPoints: number[] = []
  let usesHalfPoints = false
  
  // Difficulty counts
  const difficultyCounts = { easy: 0, medium: 0, hard: 0, unknown: 0 }
  
  // Topics from exams
  const coveredTopics: Array<{ topic: string; confidence: ConfidenceLevel; source: 'exam' | 'inferred-from-exercises' }> = []
  const seenTopics = new Set<string>()
  
  for (const analysis of sourceAnalyses) {
    const isExam = examAnalyses.includes(analysis)
    const source: 'exam' | 'inferred-from-exercises' = isExam ? 'exam' : 'inferred-from-exercises'
    const confidence: ConfidenceLevel = isExam ? 'high' : 'low'
    
    // Extract operators from style signals
    for (const verb of analysis.styleSignals?.imperativeVerbs || []) {
      if (!operatorCounts[verb]) {
        operatorCounts[verb] = { count: 0, examples: [] }
      }
      operatorCounts[verb].count++
    }
    
    // Add topic coverage
    for (const topic of analysis.canonicalTopics || []) {
      if (!seenTopics.has(topic)) {
        seenTopics.add(topic)
        coveredTopics.push({ topic, confidence, source })
      }
    }
    
    // Analyze exercises
    for (const ex of analysis.embeddedExercises || []) {
      // Points
      if (ex.points !== undefined) {
        allPoints.push(ex.points)
        if (ex.points % 1 !== 0) usesHalfPoints = true
      }
      
      // Difficulty
      difficultyCounts[ex.difficulty || 'unknown']++
      
      // Subtasks
      if (ex.subtasks && ex.subtasks.length > 0) {
        usesSubtasks = true
        if (ex.subtasks[0].match(/^[a-z]\)/)) subtaskPatternType = 'letter'
        else if (ex.subtasks[0].match(/^\d/)) subtaskPatternType = 'number'
        subtaskExamples.push(...ex.subtasks.slice(0, 3))
      }
      
      // Classify task type from question text
      const questionLower = ex.questionText.toLowerCase()
      let taskType = 'allgemein'
      if (questionLower.includes('berechne') || questionLower.includes('rechne')) taskType = 'berechnung'
      else if (questionLower.includes('zeige') || questionLower.includes('beweise')) taskType = 'beweis'
      else if (questionLower.includes('erkläre') || questionLower.includes('beschreibe')) taskType = 'erklärung'
      else if (questionLower.includes('implementiere') || questionLower.includes('programmiere')) taskType = 'implementierung'
      else if (questionLower.includes('zeichne') || questionLower.includes('skizziere')) taskType = 'zeichnung'
      
      if (!taskTypes[taskType]) {
        taskTypes[taskType] = { count: 0, points: [] }
      }
      taskTypes[taskType].count++
      if (ex.points) taskTypes[taskType].points.push(ex.points)
    }
    
    // Formatting flags
    const ss = analysis.structuralSignals
    if (ss?.usesTables) usesTables = true
    if (ss?.usesFormulaEnvironments || (analysis.formulas?.length || 0) > 0) usesFormulas = true
    if (ss?.usesCodeBlocks) usesCodeBlocks = true
  }
  
  // Build operators list
  const operators = Object.entries(operatorCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([operator, data]) => ({
      operator,
      frequency: data.count,
      examples: data.examples.slice(0, 3)
    }))
  
  // Build task types list
  const taskTypesList = Object.entries(taskTypes)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([type, data]) => ({
      type,
      frequency: data.count,
      typicalPoints: data.points.length > 0 
        ? Math.round(data.points.reduce((a, b) => a + b, 0) / data.points.length)
        : undefined
    }))
  
  // Calculate difficulty mix
  const totalDiff = difficultyCounts.easy + difficultyCounts.medium + difficultyCounts.hard
  const difficultyMix = totalDiff > 0 ? {
    easy: Math.round((difficultyCounts.easy / totalDiff) * 100),
    medium: Math.round((difficultyCounts.medium / totalDiff) * 100),
    hard: Math.round((difficultyCounts.hard / totalDiff) * 100)
  } : { easy: 33, medium: 34, hard: 33 }
  
  // Calculate scoring stats
  const avgPoints = allPoints.length > 0 
    ? Math.round(allPoints.reduce((a, b) => a + b, 0) / allPoints.length * 10) / 10
    : 10
  
  return {
    schemaVersion: '2.0.0',
    operators,
    taskTypes: {
      types: taskTypesList,
      pointsPatterns: [] // Could extract from structural signals
    },
    subtaskPattern: {
      usesSubtasks,
      patternType: subtaskPatternType,
      examples: [...new Set(subtaskExamples)].slice(0, 5)
    },
    formattingRules: {
      usesTables,
      usesFormulas,
      usesMultipleChoice,
      usesCodeBlocks,
      usesGraphics
    },
    scoring: {
      averagePointsPerTask: avgPoints,
      minPoints: allPoints.length > 0 ? Math.min(...allPoints) : 1,
      maxPoints: allPoints.length > 0 ? Math.max(...allPoints) : 20,
      usesHalfPoints
    },
    difficultyMix,
    coveredTopics,
    overallConfidence,
    inferredFromExercises,
    sourceExamCount: examAnalyses.length,
    sourceExerciseCount: inferredFromExercises ? exerciseAnalyses.length : 0,
    lastBuiltAt: now
  }
}

// ============================================================================
// Main Build Function
// ============================================================================

/**
 * Build V2 module profiles from document analyses
 */
export async function buildModuleProfilesV2(moduleId: string): Promise<{
  knowledgeIndex: ModuleKnowledgeIndexV2
  exerciseStyle: ExerciseStyleProfileV2
  examStyle: ExamStyleProfileV2
  sourceHash: string
}> {
  console.log(`[ModuleProfileBuilderV2] Building V2 profiles for module ${moduleId}`)
  
  // Load all analyses
  const allRecords = await listDocumentAnalyses(moduleId)
  const doneRecords = allRecords.filter(r => r.status === 'done')
  
  console.log(`[ModuleProfileBuilderV2] Found ${doneRecords.length} completed analyses`)
  
  // Parse and migrate to V2
  const v2Analyses: DocumentAnalysisV2[] = []
  const analysisMap: Record<string, DocumentAnalysisV2[]> = {
    script: [],
    exercise: [],
    solution: [],
    exam: []
  }
  
  for (const record of doneRecords) {
    const v2 = parseAndMigrateToV2(record)
    if (v2) {
      v2Analyses.push(v2)
      analysisMap[record.documentType]?.push(v2)
    }
  }
  
  // Compute aggregate hash
  const hashInput = doneRecords.map(r => r.sourceHash).sort().join('|')
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput))
  const sourceHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  
  // Build profiles
  const knowledgeIndex = buildKnowledgeIndexV2(v2Analyses, analysisMap.script)
  const exerciseStyle = buildExerciseStyleProfileV2(analysisMap.exercise, analysisMap.solution)
  const examStyle = buildExamStyleProfileV2(analysisMap.exam, analysisMap.exercise)
  
  console.log(`[ModuleProfileBuilderV2] Built profiles:`)
  console.log(`  - Knowledge Index: ${knowledgeIndex.canonicalTopics.length} topics, ${knowledgeIndex.concepts.length} concepts`)
  console.log(`  - Exercise Style: ${exerciseStyle.taskArchetypes.length} archetypes`)
  console.log(`  - Exam Style: confidence=${examStyle.overallConfidence}, ${examStyle.coveredTopics.length} topics`)
  
  return {
    knowledgeIndex,
    exerciseStyle,
    examStyle,
    sourceHash
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  buildKnowledgeIndexV2,
  buildExerciseStyleProfileV2,
  buildExamStyleProfileV2,
  buildTaskArchetypes,
  parseAndMigrateToV2
}
