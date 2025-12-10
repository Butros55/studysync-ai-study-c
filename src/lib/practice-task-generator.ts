/**
 * Practice Task Generator (Übungsaufgaben)
 * 
 * New pipeline for generating practice tasks with:
 * - Topic coverage planning (Blueprint)
 * - Fingerprint-based deduplication
 * - Semantic similarity checking
 * - Top-K similar tasks as avoid list
 * 
 * ENTRY POINT: generatePracticeTasks()
 * 
 * This is SEPARATE from:
 * - Exam generation (exam-generator.ts, exam-blueprint.ts)
 * - Flashcard generation (in App.tsx)
 * - Notes generation (in App.tsx)
 */

import { 
  taskFingerprint, 
  checkFingerprintDuplicate, 
  buildFingerprintMap,
  type DuplicateCheckResult 
} from './dedupe/taskFingerprint'
import { 
  findSemanticDuplicates, 
  getTopKSimilarTasks,
  softSemanticSimilarity 
} from './dedupe/semanticSimilarity'
import {
  buildTaskBlueprint,
  updateTopicCoverage,
  getModuleTopics,
  type BlueprintItem,
  type TaskBlueprint
} from './dedupe/topicCoverage'
import {
  buildPracticeTaskPrompt,
  parsePracticeTaskResponse,
  PRACTICE_TASKS_PROMPT_VERSION,
  type PracticeTaskPromptParams
} from './prompts/practiceTasks.prompt'
import { llmWithRetry } from './llm-utils'
import { generateId } from './utils-app'
import { getModuleProfile, listDocumentAnalyses } from './analysis-storage'
import { parseModuleKnowledgeIndex } from './module-profile-builder'
import { normalizeTags, getModuleAllowedTags } from './tag-canonicalizer'
import { getUserPreferencePreferredInputMode } from './analysis-storage'
import type { Task, TaskGenerationMeta } from './types'

// ============================================================================
// Types
// ============================================================================

export interface GeneratePracticeTasksOptions {
  /** Module ID */
  moduleId: string
  /** Number of tasks to generate */
  count: number
  /** Existing tasks in the module (for dedup) */
  existingTasks: Task[]
  /** LLM model to use */
  model?: string
  /** Preferred input mode */
  preferredInputMode?: 'type' | 'draw'
  /** Callback for progress updates */
  onProgress?: (progress: GenerationProgress) => void
  /** Enable debug reporting */
  enableDebugReport?: boolean
}

export interface GenerationProgress {
  /** Current step */
  step: 'loading' | 'planning' | 'generating' | 'validating' | 'complete'
  /** Current item index */
  currentIndex: number
  /** Total items */
  totalItems: number
  /** Percentage (0-100) */
  percent: number
  /** Current topic being processed */
  currentTopic?: string
  /** Status message */
  message: string
}

export interface GenerationResult {
  /** Successfully generated tasks */
  tasks: Task[]
  /** Number of duplicates rejected */
  duplicateRejectCount: number
  /** Number of regeneration attempts */
  regenerationCount: number
  /** Topics covered */
  coveredTopicIds: string[]
  /** Debug report (if enabled) */
  debugReport?: GenerationDebugReport
}

export interface GenerationDebugReport {
  /** Module ID */
  moduleId: string
  /** Blueprint used */
  blueprint: TaskBlueprint
  /** Prompt version used */
  promptVersion: string
  /** Total context characters used */
  contextCharLen: number
  /** Per-item reports */
  itemReports: Array<{
    blueprintItem: BlueprintItem
    attempts: number
    success: boolean
    duplicateChecks: Array<{
      type: 'fingerprint' | 'semantic'
      isDuplicate: boolean
      similarity?: number
      matchingTaskId?: string
    }>
    finalTask?: Task
    error?: string
  }>
  /** Timing */
  startedAt: number
  completedAt: number
  durationMs: number
}

// ============================================================================
// Main Pipeline
// ============================================================================

const MAX_REGENERATION_ATTEMPTS = 3
const SEMANTIC_SIMILARITY_THRESHOLD = 0.65  // Niedriger Threshold um mehr Varianten zu erkennen
const TOP_K_SIMILAR = 10

/**
 * Generate practice tasks with full dedup and coverage pipeline
 */
export async function generatePracticeTasks(
  options: GeneratePracticeTasksOptions
): Promise<GenerationResult> {
  const {
    moduleId,
    count,
    existingTasks,
    model = 'gpt-4o-mini',
    preferredInputMode,
    onProgress,
    enableDebugReport = false
  } = options

  const startedAt = Date.now()
  const generatedTasks: Task[] = []
  let duplicateRejectCount = 0
  let regenerationCount = 0

  // Debug report data
  const itemReports: GenerationDebugReport['itemReports'] = []
  let totalContextChars = 0

  // Progress helper
  const reportProgress = (step: GenerationProgress['step'], index: number, total: number, topic?: string, message?: string) => {
    onProgress?.({
      step,
      currentIndex: index,
      totalItems: total,
      percent: Math.round((index / total) * 100),
      currentTopic: topic,
      message: message || `${step}...`
    })
  }

  // ========================================
  // Step 1: Load module data
  // ========================================
  reportProgress('loading', 0, count, undefined, 'Lade Moduldaten...')

  const inputMode = preferredInputMode || await getUserPreferencePreferredInputMode() || 'type'
  const profile = await getModuleProfile(moduleId)
  const knowledgeIndex = profile ? parseModuleKnowledgeIndex(profile) : null
  const allowedTags = await getModuleAllowedTags(moduleId)
  
  // Build fingerprint map from existing tasks
  const existingFingerprints = buildFingerprintMap(
    existingTasks.filter(t => t.fingerprint).map(t => ({ id: t.id, fingerprint: t.fingerprint! }))
  )

  // ========================================
  // Step 2: Build blueprint
  // ========================================
  reportProgress('planning', 0, count, undefined, 'Erstelle Blueprint...')

  const blueprint = await buildTaskBlueprint(moduleId, count, inputMode)
  
  if (blueprint.items.length === 0) {
    // No topics found - cannot generate
    console.warn('[PracticeTaskGenerator] No topics found in module')
    return {
      tasks: [],
      duplicateRejectCount: 0,
      regenerationCount: 0,
      coveredTopicIds: [],
      debugReport: enableDebugReport ? {
        moduleId,
        blueprint,
        promptVersion: PRACTICE_TASKS_PROMPT_VERSION,
        contextCharLen: 0,
        itemReports: [],
        startedAt,
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt
      } : undefined
    }
  }

  // ========================================
  // Step 3: Generate tasks per blueprint item
  // ========================================
  for (let i = 0; i < blueprint.items.length; i++) {
    const item = blueprint.items[i]
    reportProgress('generating', i, blueprint.items.length, item.topicName, `Generiere Aufgabe ${i + 1}/${blueprint.items.length}...`)

    const itemReport: GenerationDebugReport['itemReports'][0] = {
      blueprintItem: item,
      attempts: 0,
      success: false,
      duplicateChecks: []
    }

    let task: Task | null = null
    let attempts = 0
    const issuesToAvoid: string[] = []

    while (!task && attempts < MAX_REGENERATION_ATTEMPTS) {
      attempts++
      itemReport.attempts = attempts

      try {
        // Build topic context
        const topicContext = await buildTopicContext(moduleId, item, knowledgeIndex)
        totalContextChars += JSON.stringify(topicContext).length

        // Get top-K similar existing tasks as avoid list
        const candidateText = `${item.topicName} ${item.questionType} ${item.difficulty}`
        const similarTasks = await getTopKSimilarTasks(
          candidateText,
          existingTasks.map(t => ({
            id: t.id,
            question: t.question,
            solution: t.solution,
            topicId: t.topicId
          })),
          TOP_K_SIMILAR,
          item.topicId,
          moduleId
        )

        const avoidList = similarTasks
          .map(s => {
            const t = existingTasks.find(et => et.id === s.taskId)
            return t ? { question: t.question, topic: t.topic || 'Allgemein' } : null
          })
          .filter((x): x is { question: string; topic: string } => x !== null)

        // Add recently generated tasks to avoid list
        generatedTasks.forEach(gt => {
          avoidList.push({ question: gt.question, topic: gt.topic || 'Allgemein' })
        })

        // Build prompt
        const promptParams: PracticeTaskPromptParams = {
          topicName: item.topicName,
          evidenceSnippets: item.evidenceSnippets,
          difficulty: item.difficulty,
          questionType: item.questionType,
          definitions: topicContext.definitions,
          formulas: topicContext.formulas,
          inputModeConstraints: inputMode === 'type' 
            ? 'WICHTIG: Keine Zeichen-/Diagrammaufgaben - nur Textantworten!' 
            : '',
          allowedTags,
          avoidList,
          issuesToAvoid: issuesToAvoid.length > 0 ? issuesToAvoid : undefined
        }

        const prompt = buildPracticeTaskPrompt(promptParams)

        // Call LLM
        const response = await llmWithRetry(prompt, model, true, 1, 'practice-task-generate', moduleId)
        
        // Parse response
        const parsed = parsePracticeTaskResponse(response)
        
        if (!parsed.success || !parsed.task) {
          issuesToAvoid.push(`Ungültige JSON-Antwort: ${parsed.error}`)
          regenerationCount++
          continue
        }

        // Normalize tags
        const normalizedTags = await normalizeTags(parsed.task.tags, moduleId)

        // Compute fingerprint
        const fpData = await taskFingerprint(
          parsed.task.question,
          parsed.task.solution,
          normalizedTags.tags
        )

        // Check fingerprint duplicate
        const fpCheck = checkFingerprintDuplicate(fpData.fingerprint, existingFingerprints)
        itemReport.duplicateChecks.push({
          type: 'fingerprint',
          isDuplicate: fpCheck.isDuplicate,
          matchingTaskId: fpCheck.matchingTaskId
        })

        if (fpCheck.isDuplicate) {
          issuesToAvoid.push(`Exaktes Duplikat von existierender Aufgabe gefunden`)
          duplicateRejectCount++
          regenerationCount++
          continue
        }

        // Check semantic similarity
        const taskText = `${parsed.task.question} ${parsed.task.solution}`
        const semanticCheck = await findSemanticDuplicates(
          taskText,
          existingTasks.map(t => ({
            id: t.id,
            question: t.question,
            solution: t.solution,
            embedding: t.embedding
          })),
          SEMANTIC_SIMILARITY_THRESHOLD,
          moduleId
        )

        itemReport.duplicateChecks.push({
          type: 'semantic',
          isDuplicate: semanticCheck.isDuplicate,
          similarity: semanticCheck.similarity,
          matchingTaskId: semanticCheck.matchingTaskId
        })

        if (semanticCheck.isDuplicate) {
          issuesToAvoid.push(`Semantisch ähnlich zu existierender Aufgabe (${Math.round(semanticCheck.similarity * 100)}% Ähnlichkeit)`)
          duplicateRejectCount++
          regenerationCount++
          continue
        }

        // Also check against recently generated tasks in this batch
        const batchDuplicate = generatedTasks.some(gt => {
          const similarity = softSemanticSimilarity(taskText, `${gt.question} ${gt.solution}`)
          return similarity >= SEMANTIC_SIMILARITY_THRESHOLD
        })

        if (batchDuplicate) {
          issuesToAvoid.push('Zu ähnlich zu einer gerade generierten Aufgabe')
          duplicateRejectCount++
          regenerationCount++
          continue
        }

        // Create task object
        const generationMeta: TaskGenerationMeta = {
          model,
          promptVersion: PRACTICE_TASKS_PROMPT_VERSION,
          createdAt: Date.now(),
          blueprintIndex: i,
          regenerationAttempt: attempts > 1 ? attempts : undefined
        }

        task = {
          id: generateId(),
          moduleId,
          question: parsed.task.question,
          solution: parsed.task.solution,
          difficulty: parsed.task.difficulty,
          topic: parsed.task.topic || item.topicName,
          tags: normalizedTags.tags,
          createdAt: new Date().toISOString(),
          completed: false,
          fingerprint: fpData.fingerprint,
          topicId: item.topicId,
          sourceDocIds: item.docIds,
          generationMeta
        }

        // Add fingerprint to existing map for future checks in this batch
        existingFingerprints.set(task.id, fpData.fingerprint)
        
        itemReport.success = true
        itemReport.finalTask = task

      } catch (error) {
        console.error(`[PracticeTaskGenerator] Error generating task for ${item.topicName}:`, error)
        issuesToAvoid.push(`Fehler: ${error instanceof Error ? error.message : String(error)}`)
        regenerationCount++
      }
    }

    if (task) {
      generatedTasks.push(task)
      
      // Update coverage tracking
      await updateTopicCoverage(moduleId, item.topicId, item.topicName, item.difficulty)
    } else {
      itemReport.error = `Failed after ${MAX_REGENERATION_ATTEMPTS} attempts`
    }

    itemReports.push(itemReport)
  }

  // ========================================
  // Step 4: Complete
  // ========================================
  reportProgress('complete', blueprint.items.length, blueprint.items.length, undefined, 'Fertig!')

  const completedAt = Date.now()

  return {
    tasks: generatedTasks,
    duplicateRejectCount,
    regenerationCount,
    coveredTopicIds: [...new Set(generatedTasks.map(t => t.topicId).filter(Boolean))] as string[],
    debugReport: enableDebugReport ? {
      moduleId,
      blueprint,
      promptVersion: PRACTICE_TASKS_PROMPT_VERSION,
      contextCharLen: totalContextChars,
      itemReports,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt
    } : undefined
  }
}

// ============================================================================
// Context Building
// ============================================================================

interface TopicContext {
  definitions: string[]
  formulas: string[]
  procedures: string[]
  evidenceSnippets: string[]
}

/**
 * Build topic-specific context for generation
 * Keeps context small and focused (max ~1000 tokens)
 */
async function buildTopicContext(
  moduleId: string,
  blueprintItem: BlueprintItem,
  knowledgeIndex: ReturnType<typeof parseModuleKnowledgeIndex> | null
): Promise<TopicContext> {
  const context: TopicContext = {
    definitions: [],
    formulas: [],
    procedures: [],
    evidenceSnippets: blueprintItem.evidenceSnippets || []
  }

  if (!knowledgeIndex) {
    return context
  }

  const topicLower = blueprintItem.topicName.toLowerCase()

  // Find relevant definitions (max 4)
  context.definitions = knowledgeIndex.definitions
    .filter(d => 
      d.term.toLowerCase().includes(topicLower) ||
      topicLower.includes(d.term.toLowerCase()) ||
      (d.definition && d.definition.toLowerCase().includes(topicLower))
    )
    .slice(0, 4)
    .map(d => d.definition ? `${d.term}: ${d.definition}` : d.term)

  // Find relevant formulas (max 3)
  context.formulas = knowledgeIndex.formulas
    .filter(f => 
      (f.description && f.description.toLowerCase().includes(topicLower)) ||
      f.latex.toLowerCase().includes(topicLower)
    )
    .slice(0, 3)
    .map(f => f.description ? `${f.latex} (${f.description})` : f.latex)

  // Find relevant procedures (max 2)
  if (knowledgeIndex.procedures) {
    context.procedures = knowledgeIndex.procedures
      .filter(p => 
        p.name.toLowerCase().includes(topicLower) ||
        (p.description && p.description.toLowerCase().includes(topicLower))
      )
      .slice(0, 2)
      .map(p => p.description ? `${p.name}: ${p.description}` : p.name)
  }

  return context
}

// ============================================================================
// Utility: Migrate existing tasks (add fingerprints)
// ============================================================================

/**
 * Migrate existing tasks to add fingerprints
 * Call this once when loading tasks to ensure all have fingerprints
 */
export async function migrateTasksAddFingerprints(
  tasks: Task[]
): Promise<{ migratedCount: number; tasks: Task[] }> {
  let migratedCount = 0
  const updatedTasks: Task[] = []

  for (const task of tasks) {
    if (task.fingerprint) {
      // Already has fingerprint
      updatedTasks.push(task)
    } else {
      // Compute and add fingerprint
      const fpData = await taskFingerprint(task.question, task.solution, task.tags)
      updatedTasks.push({
        ...task,
        fingerprint: fpData.fingerprint
      })
      migratedCount++
    }
  }

  return { migratedCount, tasks: updatedTasks }
}

/**
 * Check if a single task is a duplicate (for use in existing generators)
 * 
 * Uses 3-tier check:
 * 1. Fingerprint (exact match)
 * 2. Title similarity (quick check for variations like "UTF-8 und ISO 8859" vs "UTF-8 und ISO-8859-1")
 * 3. Semantic similarity (full content)
 */
export async function checkTaskIsDuplicate(
  question: string,
  solution: string,
  tags: string[],
  existingTasks: Task[],
  moduleId: string
): Promise<{
  isDuplicate: boolean
  reason?: string
  matchingTaskId?: string
  similarity?: number
}> {
  // Compute fingerprint
  const fpData = await taskFingerprint(question, solution, tags)
  
  // Check fingerprint
  const existingFingerprints = buildFingerprintMap(
    existingTasks.filter(t => t.fingerprint).map(t => ({ id: t.id, fingerprint: t.fingerprint! }))
  )
  const fpCheck = checkFingerprintDuplicate(fpData.fingerprint, existingFingerprints)
  
  if (fpCheck.isDuplicate) {
    return {
      isDuplicate: true,
      reason: 'Exaktes Duplikat (identischer Fingerprint)',
      matchingTaskId: fpCheck.matchingTaskId,
      similarity: 1.0
    }
  }

  // ========================================
  // Tier 2: Title-based similarity check
  // Catches variations like "UTF-8 und ISO 8859" vs "UTF-8 und ISO-8859-1"
  // ========================================
  const titleFromQuestion = extractTitleFromQuestion(question)
  const TITLE_SIMILARITY_THRESHOLD = 0.55  // Niedrig um Varianten zu fangen
  
  for (const existing of existingTasks) {
    const existingTitle = existing.title || extractTitleFromQuestion(existing.question)
    const titleSim = softSemanticSimilarity(titleFromQuestion, existingTitle)
    
    if (titleSim >= TITLE_SIMILARITY_THRESHOLD) {
      // Title is very similar - also check topic overlap
      const topicSim = existing.topic && tags.some(tag => 
        existing.topic!.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(existing.topic!.toLowerCase())
      )
      
      if (topicSim || titleSim >= 0.7) {
        return {
          isDuplicate: true,
          reason: `Ähnlicher Titel (${Math.round(titleSim * 100)}% Übereinstimmung): "${existingTitle}"`,
          matchingTaskId: existing.id,
          similarity: titleSim
        }
      }
    }
  }

  // ========================================
  // Tier 3: Full semantic similarity
  // ========================================
  const taskText = `${question} ${solution}`
  const semanticCheck = await findSemanticDuplicates(
    taskText,
    existingTasks.map(t => ({
      id: t.id,
      question: t.question,
      solution: t.solution,
      embedding: t.embedding
    })),
    SEMANTIC_SIMILARITY_THRESHOLD,
    moduleId
  )

  if (semanticCheck.isDuplicate) {
    return {
      isDuplicate: true,
      reason: `Semantisches Duplikat (${Math.round(semanticCheck.similarity * 100)}% Ähnlichkeit)`,
      matchingTaskId: semanticCheck.matchingTaskId,
      similarity: semanticCheck.similarity
    }
  }

  return { isDuplicate: false }
}

/**
 * Extract title from question (first heading or first line)
 */
function extractTitleFromQuestion(question: string): string {
  // Try to find markdown heading
  const headingMatch = question.match(/^###?\s+(.+?)\n/)
  if (headingMatch) {
    return headingMatch[1].trim()
  }
  
  // Fall back to first line
  const firstLine = question.split('\n')[0].trim()
  return firstLine.substring(0, 100)
}
