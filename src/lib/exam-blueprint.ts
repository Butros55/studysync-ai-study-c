/**
 * Exam Blueprint System
 * 
 * Multi-stage exam generation that:
 * - Stage A: Creates a blueprint over the full knowledge index
 * - Stage B: Generates each task using topic-specific retrieval
 * - Stage C: Uses cached style profiles (no re-extraction)
 * - Stage D: Validates each task with quality gate (repair/regenerate if needed)
 * 
 * This ensures ALL scripts contribute without context overflow.
 */

import { 
  getModuleProfile, 
  listDocumentAnalyses,
  getUserPreferencePreferredInputMode 
} from './analysis-storage'
import { 
  parseExamStyleProfile, 
  parseExerciseStyleProfile, 
  parseModuleKnowledgeIndex,
  type ExamStyleProfile,
  type ExerciseStyleProfile,
  type ModuleKnowledgeIndex
} from './module-profile-builder'
import type { DocumentAnalysisRecord, InputMode } from './analysis-types'
import type { MergedDocumentAnalysis } from './document-analyzer'
import type { ExamTask, TopicStats, ExamStyleProfile as LegacyExamStyleProfile } from './types'
import { llmWithRetry } from './llm-utils'
import { generateId } from './utils-app'
import { 
  runValidationPipeline, 
  type ValidationPipelineResult,
  type ValidatorDebugReport 
} from './task-validator'
import { 
  normalizeTags, 
  getModuleAllowedTags, 
  formatAllowedTagsForPrompt 
} from './tag-canonicalizer'

// ============================================================================
// Types
// ============================================================================

/**
 * Answer mode for a task
 */
export type AnswerMode = 'type' | 'draw' | 'either'

/**
 * Blueprint item for a single exam task
 */
export interface BlueprintItem {
  /** Task index (0-based) */
  taskIndex: number
  /** Main topic for this task */
  topic: string
  /** Subtopics to cover */
  subtopics: string[]
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard'
  /** Points for this task */
  points: number
  /** Target time in minutes */
  targetMinutes: number
  /** Required answer mode based on task type */
  answerMode: AnswerMode
  /** Keys into the knowledge index to use for generation */
  requiredKnowledgeKeys: string[]
  /** Suggested task type */
  taskType: 'calculation' | 'proof' | 'open-question' | 'multiple-choice' | 'code' | 'diagram' | 'mixed'
}

/**
 * Complete exam blueprint
 */
export interface ExamBlueprint {
  /** Module ID */
  moduleId: string
  /** Total exam duration in minutes */
  totalDuration: number
  /** Total points */
  totalPoints: number
  /** Number of tasks */
  taskCount: number
  /** Individual task blueprints */
  items: BlueprintItem[]
  /** Topics covered */
  coveredTopics: string[]
  /** Difficulty distribution achieved */
  difficultyMix: { easy: number; medium: number; hard: number }
  /** Whether input mode constraint was applied */
  inputModeConstrained: boolean
  /** Timestamp */
  createdAt: string
}

/**
 * Options for blueprint generation
 */
export interface BlueprintOptions {
  /** Module ID */
  moduleId: string
  /** Exam duration in minutes */
  duration: number
  /** Desired number of tasks */
  taskCount: number
  /** Difficulty preferences */
  difficultyMix: { easy: number; medium: number; hard: number }
  /** User's preferred input mode */
  preferredInputMode?: InputMode
  /** User's weak topics to prioritize */
  weakTopics?: string[]
  /** LLM model to use */
  model?: string
}

/**
 * Options for per-task generation
 */
export interface TaskGenerationOptions {
  /** The blueprint item to generate */
  blueprint: BlueprintItem
  /** Module ID */
  moduleId: string
  /** Exam style profile */
  examStyle: ExamStyleProfile
  /** Exercise style profile (optional) */
  exerciseStyle?: ExerciseStyleProfile
  /** Knowledge index */
  knowledgeIndex: ModuleKnowledgeIndex
  /** Document analyses for evidence retrieval */
  analyses: DocumentAnalysisRecord[]
  /** LLM model */
  model?: string
  /** Allowed tags for the prompt (for consistent tagging) */
  allowedTags?: string[]
}

// ============================================================================
// Stage A: Blueprint Generation
// ============================================================================

/**
 * Generate an exam blueprint that distributes tasks across all topics
 */
export async function generateExamBlueprint(
  options: BlueprintOptions
): Promise<ExamBlueprint> {
  const {
    moduleId,
    duration,
    taskCount,
    difficultyMix,
    preferredInputMode,
    weakTopics = [],
    model = 'gpt-4o-mini'
  } = options

  // Load module profile
  const profile = await getModuleProfile(moduleId)
  
  if (!profile) {
    // No profile available - create a simple default blueprint
    return createDefaultBlueprint(moduleId, duration, taskCount, difficultyMix, preferredInputMode)
  }

  // Parse profiles
  const examStyle = parseExamStyleProfile(profile)
  const knowledgeIndex = parseModuleKnowledgeIndex(profile)

  // If no knowledge index, use default
  if (!knowledgeIndex || knowledgeIndex.allTopics.length === 0) {
    return createDefaultBlueprint(moduleId, duration, taskCount, difficultyMix, preferredInputMode)
  }

  // Build topic distribution based on frequency and weak topics
  const topicWeights = buildTopicWeights(knowledgeIndex, weakTopics)

  // Dynamische Task-Anzahl basierend auf Themen- und Dokumentanzahl,
  // um kleine Skripte nicht mit zu vielen Aufgaben zu überladen.
  const dynamicTaskCount = (() => {
    const topicFactor = Math.max(1, knowledgeIndex.allTopics.length / 2)
    const docFactor = Math.max(1, knowledgeIndex.sourceDocumentCount * 1.2)
    const estimate = Math.round(topicFactor + docFactor)
    return Math.max(3, Math.min(15, estimate))
  })()
  const finalTaskCount = Math.max(3, Math.min(taskCount || dynamicTaskCount, dynamicTaskCount + 2))
  
  // Calculate points and time distribution
  const avgPointsPerTask = examStyle?.scoringPatterns?.averagePointsPerTask || 10
  const totalPoints = Math.round(avgPointsPerTask * finalTaskCount)
  const avgMinutesPerTask = duration / finalTaskCount

  // Compute difficulty counts
  const easyCount = Math.max(1, Math.round(finalTaskCount * difficultyMix.easy))
  const hardCount = Math.max(0, Math.round(finalTaskCount * difficultyMix.hard))
  const mediumCount = Math.max(0, finalTaskCount - easyCount - hardCount)

  // Build the blueprint using LLM for intelligent topic distribution
  const blueprintItems = await planBlueprintWithLLM({
    moduleId,
    topicWeights,
    knowledgeIndex,
    examStyle,
    duration,
    taskCount: finalTaskCount,
    totalPoints,
    easyCount,
    mediumCount,
    hardCount,
    avgMinutesPerTask,
    preferredInputMode,
    weakTopics,
    model
  })

  // Validate and adjust the blueprint
  const validatedItems = validateBlueprint(blueprintItems, duration, totalPoints, preferredInputMode)

  return {
    moduleId,
    totalDuration: duration,
    totalPoints,
    taskCount: validatedItems.length,
    items: validatedItems,
    coveredTopics: [...new Set(validatedItems.map(i => i.topic))],
    difficultyMix: {
      easy: validatedItems.filter(i => i.difficulty === 'easy').length / validatedItems.length,
      medium: validatedItems.filter(i => i.difficulty === 'medium').length / validatedItems.length,
      hard: validatedItems.filter(i => i.difficulty === 'hard').length / validatedItems.length,
    },
    inputModeConstrained: preferredInputMode === 'type',
    createdAt: new Date().toISOString()
  }
}

/**
 * Build topic weights based on knowledge index frequency and weak topics
 */
function buildTopicWeights(
  index: ModuleKnowledgeIndex,
  weakTopics: string[]
): Map<string, number> {
  const weights = new Map<string, number>()
  
  for (const topic of index.allTopics) {
    // Base weight from frequency (normalized)
    const freq = index.topicFrequency[topic] || 1
    let weight = freq
    
    // Boost weak topics (2x weight)
    if (weakTopics.some(wt => 
      topic.toLowerCase().includes(wt.toLowerCase()) ||
      wt.toLowerCase().includes(topic.toLowerCase())
    )) {
      weight *= 2
    }
    
    weights.set(topic, weight)
  }
  
  return weights
}

/**
 * Use LLM to create an intelligent blueprint
 */
async function planBlueprintWithLLM(params: {
  moduleId: string
  topicWeights: Map<string, number>
  knowledgeIndex: ModuleKnowledgeIndex
  examStyle: ExamStyleProfile | null
  duration: number
  taskCount: number
  totalPoints: number
  easyCount: number
  mediumCount: number
  hardCount: number
  avgMinutesPerTask: number
  preferredInputMode?: InputMode
  weakTopics: string[]
  model: string
}): Promise<BlueprintItem[]> {
  const {
    topicWeights,
    knowledgeIndex,
    examStyle,
    duration,
    taskCount,
    totalPoints,
    easyCount,
    mediumCount,
    hardCount,
    avgMinutesPerTask,
    preferredInputMode,
    weakTopics,
    model
  } = params

  // Sort topics by weight
  const sortedTopics = [...topicWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([topic]) => topic)

  // Collect available knowledge keys
  const knowledgeKeys: string[] = []
  
  for (const def of knowledgeIndex.definitions.slice(0, 30)) {
    knowledgeKeys.push(`def:${def.term}`)
  }
  for (const formula of knowledgeIndex.formulas.slice(0, 20)) {
    knowledgeKeys.push(`formula:${formula.latex.substring(0, 50)}`)
  }
  for (const proc of knowledgeIndex.procedures.slice(0, 15)) {
    knowledgeKeys.push(`proc:${proc.name}`)
  }

  // Build input mode constraint
  const inputModeInstruction = preferredInputMode === 'type'
    ? '\nWICHTIG: Der Nutzer verwendet TASTATUREINGABE. Setze answerMode NIEMALS auf "draw". Vermeide Aufgaben, die Diagramme oder Zeichnungen erfordern.'
    : ''

  // Build exam style hints
  const styleHints = examStyle ? `
STIL-HINWEISE:
- Durchschnittliche Punkte pro Aufgabe: ${examStyle.scoringPatterns.averagePointsPerTask}
- Punktebereich: ${examStyle.scoringPatterns.minPoints}-${examStyle.scoringPatterns.maxPoints}
- Verwendet Teilaufgaben: ${examStyle.formattingRules.usesSubtasks ? 'Ja' : 'Nein'}
- Typische Aufgabentypen: ${examStyle.formattingRules.usesMultipleChoice ? 'Multiple-Choice, ' : ''}Berechnungen, offene Fragen` : ''

  const prompt = `Du bist ein Prüfungsplaner, der einen Klausur-Blueprint erstellt.

ANFORDERUNGEN:
- Prüfungsdauer: ${duration} Minuten
- Anzahl Aufgaben: ${taskCount}
- Gesamtpunkte: ${totalPoints}
- Schwierigkeitsverteilung: ${easyCount}x einfach, ${mediumCount}x mittel, ${hardCount}x schwer
- Durchschnittliche Zeit pro Aufgabe: ${avgMinutesPerTask.toFixed(1)} Minuten
${styleHints}
${inputModeInstruction}

VERFÜGBARE THEMEN (nach Wichtigkeit sortiert):
${sortedTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${weakTopics.length > 0 ? `SCHWACHSTELLEN DES NUTZERS (PRIORISIEREN):
${weakTopics.join(', ')}` : ''}

VERFÜGBARE WISSENSSCHLÜSSEL:
${knowledgeKeys.slice(0, 40).join('\n')}

Erstelle einen Blueprint als JSON-Array. Jedes Element:
{
  "taskIndex": 0,
  "topic": "Hauptthema",
  "subtopics": ["Unterthema1", "Unterthema2"],
  "difficulty": "easy|medium|hard",
  "points": 10,
  "targetMinutes": 8,
  "answerMode": "type|draw|either",
  "requiredKnowledgeKeys": ["def:Begriff", "formula:..."],
  "taskType": "calculation|proof|open-question|multiple-choice|code|diagram|mixed"
}

REGELN:
1. Verteile Themen gleichmäßig (keine Wiederholungen wenn möglich)
2. Punkteverteilung: einfach ~${Math.round(totalPoints / taskCount * 0.7)}, mittel ~${Math.round(totalPoints / taskCount)}, schwer ~${Math.round(totalPoints / taskCount * 1.3)}
3. targetMinutes muss zur Schwierigkeit passen
4. requiredKnowledgeKeys aus der Liste wählen
5. Summe der Punkte = ${totalPoints} (±10%)
6. Summe der Minuten <= ${duration}

Gib NUR das JSON-Array zurück.`

  try {
    const response = await llmWithRetry(prompt, model, true, 2, 'exam-blueprint', params.moduleId)
    const parsed = JSON.parse(response) as BlueprintItem[]
    
    // Validate structure
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid blueprint structure')
    }
    
    return parsed.map((item, index) => ({
      taskIndex: index,
      topic: item.topic || sortedTopics[index % sortedTopics.length] || 'Allgemein',
      subtopics: item.subtopics || [],
      difficulty: validateDifficulty(item.difficulty),
      points: item.points || 10,
      targetMinutes: item.targetMinutes || avgMinutesPerTask,
      answerMode: validateAnswerMode(item.answerMode, preferredInputMode),
      requiredKnowledgeKeys: item.requiredKnowledgeKeys || [],
      taskType: item.taskType || 'open-question'
    }))
  } catch (error) {
    console.error('[ExamBlueprint] LLM planning failed:', error)
    // Fallback: create algorithmic blueprint
    return createAlgorithmicBlueprint(
      sortedTopics,
      knowledgeKeys,
      taskCount,
      totalPoints,
      duration,
      easyCount,
      mediumCount,
      hardCount,
      preferredInputMode
    )
  }
}

/**
 * Validate difficulty value
 */
function validateDifficulty(d: string): 'easy' | 'medium' | 'hard' {
  if (d === 'easy' || d === 'medium' || d === 'hard') return d
  return 'medium'
}

/**
 * Validate answer mode with input preference constraint
 */
function validateAnswerMode(mode: string, preferredInputMode?: InputMode): AnswerMode {
  // If user prefers typing, never allow 'draw'
  if (preferredInputMode === 'type') {
    return mode === 'draw' ? 'type' : (mode as AnswerMode) || 'type'
  }
  if (mode === 'type' || mode === 'draw' || mode === 'either') return mode
  return 'either'
}

/**
 * Create an algorithmic blueprint as fallback
 */
function createAlgorithmicBlueprint(
  topics: string[],
  knowledgeKeys: string[],
  taskCount: number,
  totalPoints: number,
  duration: number,
  easyCount: number,
  mediumCount: number,
  hardCount: number,
  preferredInputMode?: InputMode
): BlueprintItem[] {
  const items: BlueprintItem[] = []
  const avgPoints = totalPoints / taskCount
  const avgMinutes = duration / taskCount
  
  // Distribute difficulties
  const difficulties: ('easy' | 'medium' | 'hard')[] = [
    ...Array(easyCount).fill('easy'),
    ...Array(mediumCount).fill('medium'),
    ...Array(hardCount).fill('hard')
  ]
  
  // Shuffle
  for (let i = difficulties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[difficulties[i], difficulties[j]] = [difficulties[j], difficulties[i]]
  }

  for (let i = 0; i < taskCount; i++) {
    const difficulty = difficulties[i] || 'medium'
    const topic = topics[i % topics.length] || 'Allgemein'
    
    // Adjust points by difficulty
    const pointsMultiplier = difficulty === 'easy' ? 0.7 : difficulty === 'hard' ? 1.3 : 1
    const points = Math.round(avgPoints * pointsMultiplier)
    
    // Adjust time by difficulty
    const minutesMultiplier = difficulty === 'easy' ? 0.8 : difficulty === 'hard' ? 1.2 : 1
    const targetMinutes = Math.round(avgMinutes * minutesMultiplier)

    items.push({
      taskIndex: i,
      topic,
      subtopics: [],
      difficulty,
      points,
      targetMinutes,
      answerMode: preferredInputMode === 'type' ? 'type' : 'either',
      requiredKnowledgeKeys: knowledgeKeys.slice(i * 2, i * 2 + 3),
      taskType: 'open-question'
    })
  }

  return items
}

/**
 * Validate blueprint totals and adjust if needed
 */
function validateBlueprint(
  items: BlueprintItem[],
  targetDuration: number,
  targetPoints: number,
  preferredInputMode?: InputMode
): BlueprintItem[] {
  // Calculate totals
  const totalMinutes = items.reduce((sum, i) => sum + i.targetMinutes, 0)
  const totalPoints = items.reduce((sum, i) => sum + i.points, 0)
  
  // Adjust times if over duration
  if (totalMinutes > targetDuration) {
    const ratio = targetDuration / totalMinutes
    for (const item of items) {
      item.targetMinutes = Math.max(2, Math.round(item.targetMinutes * ratio))
    }
  }
  
  // Adjust points if significantly off
  const pointsRatio = targetPoints / totalPoints
  if (pointsRatio < 0.9 || pointsRatio > 1.1) {
    for (const item of items) {
      item.points = Math.max(1, Math.round(item.points * pointsRatio))
    }
  }

  // Ensure input mode constraint
  if (preferredInputMode === 'type') {
    for (const item of items) {
      if (item.answerMode === 'draw') {
        item.answerMode = 'type'
      }
    }
  }

  return items
}

/**
 * Create a default blueprint when no profile is available
 */
function createDefaultBlueprint(
  moduleId: string,
  duration: number,
  taskCount: number,
  difficultyMix: { easy: number; medium: number; hard: number },
  preferredInputMode?: InputMode
): ExamBlueprint {
  const avgPoints = 10
  const totalPoints = avgPoints * taskCount
  const avgMinutes = duration / taskCount
  
  const easyCount = Math.round(taskCount * difficultyMix.easy)
  const hardCount = Math.round(taskCount * difficultyMix.hard)
  const mediumCount = taskCount - easyCount - hardCount

  const items = createAlgorithmicBlueprint(
    ['Allgemein'],
    [],
    taskCount,
    totalPoints,
    duration,
    easyCount,
    mediumCount,
    hardCount,
    preferredInputMode
  )

  return {
    moduleId,
    totalDuration: duration,
    totalPoints,
    taskCount,
    items,
    coveredTopics: ['Allgemein'],
    difficultyMix: {
      easy: easyCount / taskCount,
      medium: mediumCount / taskCount,
      hard: hardCount / taskCount
    },
    inputModeConstrained: preferredInputMode === 'type',
    createdAt: new Date().toISOString()
  }
}

// ============================================================================
// Stage B: Per-Task Generation with Retrieval
// ============================================================================

/**
 * Generate a single exam task from a blueprint item
 */
export async function generateTaskFromBlueprint(
  options: TaskGenerationOptions
): Promise<ExamTask> {
  const {
    blueprint,
    moduleId,
    examStyle,
    exerciseStyle,
    knowledgeIndex,
    analyses,
    model = 'gpt-4o-mini',
    allowedTags = []
  } = options

  // Retrieve relevant knowledge for this specific task
  const relevantKnowledge = retrieveRelevantKnowledge(
    blueprint,
    knowledgeIndex,
    analyses
  )

  // Build the prompt with allowed tags
  const prompt = buildTaskGenerationPrompt(
    blueprint,
    relevantKnowledge,
    examStyle,
    exerciseStyle,
    allowedTags
  )

  try {
    const response = await llmWithRetry(prompt, model, true, 2, 'exam-task-from-blueprint', moduleId)
    const parsed = JSON.parse(response)

    // Normalize tags using the module's tag registry
    const rawTags = parsed.tags || []
    const normalizedResult = await normalizeTags(rawTags, moduleId)

    return {
      id: generateId(),
      moduleId,
      question: parsed.question,
      solution: parsed.solution,
      difficulty: blueprint.difficulty,
      topic: blueprint.topic,
      tags: normalizedResult.tags,
      points: blueprint.points,
      createdAt: new Date().toISOString(),
      completed: false,
      examStatus: 'unanswered'
    }
  } catch (error) {
    console.error(`[ExamBlueprint] Task generation failed for task ${blueprint.taskIndex}:`, error)
    return createFallbackTask(moduleId, blueprint)
  }
}

/**
 * Retrieve knowledge relevant to a specific blueprint item
 */
function retrieveRelevantKnowledge(
  blueprint: BlueprintItem,
  index: ModuleKnowledgeIndex,
  analyses: DocumentAnalysisRecord[]
): {
  definitions: Array<{ term: string; definition?: string }>
  formulas: Array<{ latex: string; description?: string }>
  procedures: Array<{ name: string; description?: string }>
  examples: string[]
} {
  const result = {
    definitions: [] as Array<{ term: string; definition?: string }>,
    formulas: [] as Array<{ latex: string; description?: string }>,
    procedures: [] as Array<{ name: string; description?: string }>,
    examples: [] as string[]
  }

  // Parse required knowledge keys
  for (const key of blueprint.requiredKnowledgeKeys) {
    if (key.startsWith('def:')) {
      const term = key.substring(4)
      const def = index.definitions.find(d => 
        d.term.toLowerCase().includes(term.toLowerCase()) ||
        term.toLowerCase().includes(d.term.toLowerCase())
      )
      if (def) result.definitions.push({ term: def.term, definition: def.definition })
    } else if (key.startsWith('formula:')) {
      const latex = key.substring(8)
      const formula = index.formulas.find(f => 
        f.latex.includes(latex) || latex.includes(f.latex.substring(0, 20))
      )
      if (formula) result.formulas.push({ latex: formula.latex, description: formula.description })
    } else if (key.startsWith('proc:')) {
      const name = key.substring(5)
      const proc = index.procedures.find(p => 
        p.name.toLowerCase().includes(name.toLowerCase())
      )
      if (proc) result.procedures.push({ name: proc.name, description: proc.description })
    }
  }

  // Also retrieve by topic from inverted index
  const topicLower = blueprint.topic.toLowerCase()
  for (const [indexTopic, docs] of Object.entries(index.topicIndex)) {
    if (indexTopic.toLowerCase().includes(topicLower) || 
        topicLower.includes(indexTopic.toLowerCase())) {
      // Retrieve from these documents
      for (const docRef of docs) {
        const analysis = analyses.find(a => a.documentId === docRef.documentId && a.status === 'done')
        if (analysis?.analysisJson) {
          try {
            const parsed = JSON.parse(analysis.analysisJson) as MergedDocumentAnalysis
            
            // Get definitions related to topic
            if (parsed.definitions) {
              for (const def of parsed.definitions.slice(0, 3)) {
                if (!result.definitions.some(d => d.term === def.value)) {
                  result.definitions.push({ term: def.value, definition: undefined })
                }
              }
            }
            
            // Get formulas
            if (parsed.formulas) {
              for (const f of parsed.formulas.slice(0, 2)) {
                if (!result.formulas.some(rf => rf.latex === f.value)) {
                  result.formulas.push({ latex: f.value, description: undefined })
                }
              }
            }
            
            // Get examples
            if (parsed.examples) {
              for (const ex of parsed.examples.slice(0, 2)) {
                result.examples.push(ex.value)
              }
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  // Limit sizes to prevent context overflow
  result.definitions = result.definitions.slice(0, 8)
  result.formulas = result.formulas.slice(0, 5)
  result.procedures = result.procedures.slice(0, 4)
  result.examples = result.examples.slice(0, 3)

  return result
}

/**
 * Build the prompt for generating a single task
 */
function buildTaskGenerationPrompt(
  blueprint: BlueprintItem,
  knowledge: ReturnType<typeof retrieveRelevantKnowledge>,
  examStyle: ExamStyleProfile,
  exerciseStyle?: ExerciseStyleProfile,
  allowedTags: string[] = []
): string {
  // Build knowledge section
  const knowledgeLines: string[] = ['## RELEVANTES WISSEN FÜR DIESE AUFGABE']
  
  if (knowledge.definitions.length > 0) {
    knowledgeLines.push('\n### Definitionen:')
    for (const d of knowledge.definitions) {
      knowledgeLines.push(`- **${d.term}**${d.definition ? `: ${d.definition}` : ''}`)
    }
  }
  
  if (knowledge.formulas.length > 0) {
    knowledgeLines.push('\n### Formeln:')
    for (const f of knowledge.formulas) {
      knowledgeLines.push(`- $${f.latex}$${f.description ? ` (${f.description})` : ''}`)
    }
  }
  
  if (knowledge.procedures.length > 0) {
    knowledgeLines.push('\n### Verfahren:')
    for (const p of knowledge.procedures) {
      knowledgeLines.push(`- **${p.name}**${p.description ? `: ${p.description}` : ''}`)
    }
  }
  
  if (knowledge.examples.length > 0) {
    knowledgeLines.push('\n### Beispiele:')
    for (const ex of knowledge.examples) {
      knowledgeLines.push(`- ${ex}`)
    }
  }

  // Build style section
  const styleLines: string[] = ['## STIL-VORGABEN']
  
  if (examStyle.commonPhrases.length > 0) {
    styleLines.push(`\nTypische Formulierungen: "${examStyle.commonPhrases.slice(0, 5).join('", "')}"`)
  }
  
  if (examStyle.formattingRules.usesSubtasks) {
    styleLines.push('- Verwende Teilaufgaben: a), b), c)')
  }
  
  if (examStyle.formattingRules.usesFormulas) {
    styleLines.push('- Verwende mathematische Formeln in LaTeX')
  }
  
  if (exerciseStyle?.solutionFormatting.hasStepByStep) {
    styleLines.push('- Musterlösung mit Schritt-für-Schritt-Erklärung')
  }

  // Build allowed tags section
  const allowedTagsSection = formatAllowedTagsForPrompt(allowedTags)

  // Build difficulty instruction
  const difficultyInstruction = 
    blueprint.difficulty === 'easy' 
      ? 'EINFACH: Grundlegendes Verständnis, wenige Schritte, direkte Anwendung'
      : blueprint.difficulty === 'hard'
      ? 'SCHWER: Komplexe Analyse, mehrere Konzepte kombinieren, Transferleistung'
      : 'MITTEL: Anwendung von Konzepten, einige Zwischenschritte'

  // Build answer mode constraint
  const answerModeConstraint = 
    blueprint.answerMode === 'type'
      ? '\nEINGABE-EINSCHRÄNKUNG: Aufgabe MUSS per Tastatur lösbar sein. KEINE Diagramme, Zeichnungen oder Skizzen erforderlich.'
      : blueprint.answerMode === 'draw'
      ? '\nEINGABE-HINWEIS: Aufgabe darf handschriftliche Lösung oder Diagramme erfordern.'
      : ''

  // Build length guidance based on target minutes
  const lengthGuidance = `
LÄNGENRICHTLINIEN:
- Geschätzte Bearbeitungszeit: ${blueprint.targetMinutes} Minuten
- ${blueprint.targetMinutes <= 5 ? 'Kurze, fokussierte Aufgabe' : blueprint.targetMinutes <= 10 ? 'Mittellange Aufgabe mit 2-3 Teilaufgaben' : 'Ausführliche Aufgabe mit mehreren Teilaufgaben'}`

  return `Du bist ein Universitätsprofessor, der eine Prüfungsaufgabe erstellt.

${knowledgeLines.join('\n')}

${styleLines.join('\n')}
${allowedTagsSection ? '\n' + allowedTagsSection : ''}

## AUFGABEN-SPEZIFIKATION
- Thema: ${blueprint.topic}
${blueprint.subtopics.length > 0 ? `- Unterthemen: ${blueprint.subtopics.join(', ')}` : ''}
- Schwierigkeit: ${difficultyInstruction}
- Aufgabentyp: ${blueprint.taskType}
${lengthGuidance}
${answerModeConstraint}

WICHTIGE REGELN:
1. Generiere eine NEUE, ORIGINALE Aufgabe
2. Nutze die bereitgestellten Definitionen, Formeln und Verfahren
3. Halte dich an die Stil-Vorgaben
4. Musterlösung muss vollständig und nachvollziehbar sein
5. KEINE Nummerierung wie "1.", "2.", "3." im Aufgabentext; Teilaufgaben nur mit a), b), c) kennzeichnen
6. KEINE Punkte- oder Bewertungshinweise im Fragetext (keine "(5 Punkte)" o.Ä.)
7. KEINE Schwierigkeitsangaben im Fragetext (kein "schwer"/"leicht" etc.)

Antworte im JSON-Format:
{
  "question": "Vollständige Aufgabenstellung",
  "solution": "Ausführliche Musterlösung",
  "tags": ["tag1", "tag2", "tag3"]
}

Gib NUR das JSON zurück.`
}

/**
 * Create a fallback task if generation fails
 */
function createFallbackTask(moduleId: string, blueprint: BlueprintItem): ExamTask {
  return {
    id: generateId(),
    moduleId,
    question: `Aufgabe zu "${blueprint.topic}" (${blueprint.difficulty}): Diese Aufgabe konnte nicht generiert werden.`,
    solution: 'Keine Lösung verfügbar.',
    difficulty: blueprint.difficulty,
    topic: blueprint.topic,
    tags: [],
    points: blueprint.points,
    createdAt: new Date().toISOString(),
    completed: false,
    examStatus: 'unanswered'
  }
}

// ============================================================================
// Full Pipeline: Generate All Tasks from Blueprint
// ============================================================================

/**
 * Options for the full pipeline with validation
 */
export interface GenerateWithValidationOptions extends BlueprintOptions {
  /** Whether to enable validation quality gate */
  enableValidation?: boolean
  /** Whether to collect debug reports */
  enableDebugReports?: boolean
}

/**
 * Result of the full pipeline with validation info
 */
export interface GenerationWithValidationResult {
  blueprint: ExamBlueprint
  tasks: ExamTask[]
  validationStats: {
    totalTasks: number
    passedFirstTry: number
    repairedTasks: number
    regeneratedTasks: number
    failedValidation: number
  }
  debugReports?: ValidatorDebugReport[]
}

/**
 * Generate all exam tasks using the blueprint pipeline
 */
export async function generateExamTasksWithBlueprint(
  options: BlueprintOptions | GenerateWithValidationOptions,
  onProgress?: (current: number, total: number, phase: 'blueprint' | 'generating' | 'validating') => void
): Promise<{ blueprint: ExamBlueprint; tasks: ExamTask[]; validationStats?: GenerationWithValidationResult['validationStats'] }> {
  const { moduleId, model = 'gpt-4o-mini', preferredInputMode } = options
  const enableValidation = 'enableValidation' in options ? options.enableValidation !== false : true
  const enableDebugReports = 'enableDebugReports' in options ? options.enableDebugReports : false

  // Stage A: Generate blueprint
  onProgress?.(0, 100, 'blueprint')
  const blueprint = await generateExamBlueprint(options)
  onProgress?.(10, 100, 'blueprint')

  // Load profiles and analyses for Stage B
  const [profile, analyses, allowedTags] = await Promise.all([
    getModuleProfile(moduleId),
    listDocumentAnalyses(moduleId),
    getModuleAllowedTags(moduleId)
  ])

  const examStyle = profile ? parseExamStyleProfile(profile) : getDefaultExamStyle()
  const exerciseStyle = profile ? parseExerciseStyleProfile(profile) : undefined
  const knowledgeIndex = profile ? parseModuleKnowledgeIndex(profile) : getDefaultKnowledgeIndex()

  // Filter to completed analyses
  const completedAnalyses = analyses.filter(a => a.status === 'done')

  // Validation stats
  const validationStats = {
    totalTasks: blueprint.items.length,
    passedFirstTry: 0,
    repairedTasks: 0,
    regeneratedTasks: 0,
    failedValidation: 0
  }
  const debugReports: ValidatorDebugReport[] = []

  // Stage B + C: Generate and validate each task
  const tasks: ExamTask[] = []
  
  for (let i = 0; i < blueprint.items.length; i++) {
    const item = blueprint.items[i]
    
    try {
      // Generate the task with allowed tags
      const generatedTask = await generateTaskFromBlueprint({
        blueprint: item,
        moduleId,
        examStyle,
        exerciseStyle,
        knowledgeIndex,
        analyses: completedAnalyses,
        model,
        allowedTags
      })

      // Stage D: Validate with quality gate
      if (enableValidation) {
        const validationResult = await runValidationPipeline({
          task: generatedTask,
          preferredInputMode,
          examStyleProfile: examStyle,
          exerciseStyleProfile: exerciseStyle,
          model,
          moduleId,
          maxRepairAttempts: 2,
          enableDebugReport: enableDebugReports,
          onRegenerate: async (issuesToAvoid) => {
            // Regenerate with issues to avoid
            return await regenerateTaskWithConstraints(
              item,
              moduleId,
              examStyle,
              exerciseStyle,
              knowledgeIndex,
              completedAnalyses,
              issuesToAvoid,
              model,
              allowedTags
            )
          }
        })

        // Track validation stats
        if (validationResult.passed) {
          if (!validationResult.wasRepaired && !validationResult.wasRegenerated) {
            validationStats.passedFirstTry++
          } else if (validationResult.wasRepaired) {
            validationStats.repairedTasks++
          } else if (validationResult.wasRegenerated) {
            validationStats.regeneratedTasks++
          }
        } else {
          validationStats.failedValidation++
        }

        if (validationResult.debugReport) {
          debugReports.push(validationResult.debugReport)
        }

        tasks.push(validationResult.task as ExamTask)
      } else {
        // No validation, just add the task
        tasks.push(generatedTask)
        validationStats.passedFirstTry++
      }
    } catch (error) {
      console.error(`[ExamBlueprint] Failed to generate task ${i}:`, error)
      tasks.push(createFallbackTask(moduleId, item))
      validationStats.failedValidation++
    }
    
    // Report progress (10% for blueprint, 90% for tasks)
    const taskProgress = 10 + Math.round((i + 1) / blueprint.items.length * 90)
    onProgress?.(taskProgress, 100, enableValidation ? 'validating' : 'generating')
    
    // Small delay between tasks for rate limiting
    if (i < blueprint.items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Log validation summary
  console.log('[ExamBlueprint] Validation summary:', validationStats)

  return { 
    blueprint, 
    tasks,
    validationStats
  }
}

/**
 * Regenerate a task with explicit constraints to avoid previous issues
 */
async function regenerateTaskWithConstraints(
  blueprint: BlueprintItem,
  moduleId: string,
  examStyle: ExamStyleProfile,
  exerciseStyle: ExerciseStyleProfile | undefined,
  knowledgeIndex: ModuleKnowledgeIndex,
  analyses: DocumentAnalysisRecord[],
  issuesToAvoid: string[],
  model: string,
  allowedTags: string[] = []
): Promise<ExamTask> {
  // Retrieve relevant knowledge
  const relevantKnowledge = retrieveRelevantKnowledge(blueprint, knowledgeIndex, analyses)

  // Build prompt with explicit avoidance instructions and allowed tags
  const avoidanceInstructions = issuesToAvoid.length > 0
    ? `\n\nWICHTIG - VERMEIDE DIESE PROBLEME:\n- ${issuesToAvoid.join('\n- ')}`
    : ''

  const prompt = buildTaskGenerationPrompt(
    blueprint,
    relevantKnowledge,
    examStyle,
    exerciseStyle,
    allowedTags
  ) + avoidanceInstructions

  try {
    const response = await llmWithRetry(prompt, model, true, 2, 'exam-task-regenerate', moduleId)
    const parsed = JSON.parse(response)

    // Normalize tags using the module's tag registry
    const rawTags = parsed.tags || []
    const normalizedResult = await normalizeTags(rawTags, moduleId)

    return {
      id: generateId(),
      moduleId,
      question: parsed.question,
      solution: parsed.solution,
      difficulty: blueprint.difficulty,
      topic: blueprint.topic,
      tags: normalizedResult.tags,
      points: blueprint.points,
      createdAt: new Date().toISOString(),
      completed: false,
      examStatus: 'unanswered'
    }
  } catch (error) {
    console.error('[ExamBlueprint] Regeneration failed:', error)
    return createFallbackTask(moduleId, blueprint)
  }
}

/**
 * Default exam style when no profile is available
 */
function getDefaultExamStyle(): ExamStyleProfile {
  return {
    commonPhrases: ['Berechnen Sie', 'Begründen Sie', 'Erklären Sie', 'Zeigen Sie'],
    phraseFrequency: {},
    scoringPatterns: {
      averagePointsPerTask: 10,
      minPoints: 5,
      maxPoints: 20,
      usesHalfPoints: false
    },
    formattingRules: {
      usesTables: false,
      usesFormulas: true,
      usesMultipleChoice: false,
      usesSubtasks: true,
      usesLetterSubtasks: true,
      usesNumberedSubtasks: false
    },
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    coveredTopics: [],
    sourceDocumentCount: 0
  }
}

/**
 * Default knowledge index when no profile is available
 */
function getDefaultKnowledgeIndex(): ModuleKnowledgeIndex {
  return {
    allTopics: ['Allgemein'],
    topicFrequency: { 'Allgemein': 1 },
    topicIndex: {},
    definitions: [],
    formulas: [],
    procedures: [],
    sourceDocumentCount: 0
  }
}
