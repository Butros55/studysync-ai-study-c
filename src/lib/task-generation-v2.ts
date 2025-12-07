/**
 * Task Generation V2 Integration
 * 
 * Integrates the new V2 analysis and profile system with task generation:
 * - Uses topic normalization for consistent matching
 * - Applies task fingerprinting to avoid duplicates
 * - Supports variant generation
 * - Uses V2 knowledge index for better context
 */

import { 
  createTaskFingerprint,
  checkForDuplicate,
  buildFingerprintMap,
  fingerprintFromTask,
  getVariationStrategies,
  isVariantOf,
  type TaskFingerprint,
  type DuplicateCheckResult
} from './task-fingerprint'
import { 
  findCanonicalTopic,
  normalizeTopicKey
} from './topic-normalizer'
import {
  type ModuleKnowledgeIndexV2,
  type ExerciseStyleProfileV2,
  type ExamStyleProfileV2,
  type TaskArchetype
} from './analysis-types-v2'
import type { Task, ExamTask } from './types'
import { generateId } from './utils-app'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for generating a task with duplicate checking
 */
export interface GenerateTaskV2Options {
  /** Module ID */
  moduleId: string
  /** Requested topic (will be normalized) */
  topic: string
  /** Requested difficulty */
  difficulty: 'easy' | 'medium' | 'hard'
  /** Existing tasks to check for duplicates */
  existingTasks: Task[]
  /** Knowledge index to use */
  knowledgeIndex?: ModuleKnowledgeIndexV2
  /** Exercise style to follow */
  exerciseStyle?: ExerciseStyleProfileV2
  /** Specific archetype to use (optional) */
  archetypeId?: string
  /** If true, generate a variant of an existing task */
  generateVariant?: boolean
  /** Task ID to generate variant of (if generateVariant is true) */
  variantOfTaskId?: string
}

/**
 * Result of task generation with fingerprint
 */
export interface GenerateTaskV2Result {
  /** The generated task (or null if blocked by duplicate) */
  task: Task | null
  /** The task's fingerprint */
  fingerprint: TaskFingerprint
  /** Whether generation was blocked by duplicate detection */
  blockedByDuplicate: boolean
  /** Duplicate check result if blocked */
  duplicateCheck?: DuplicateCheckResult
  /** Whether this is a variant of an existing task */
  isVariant: boolean
  /** ID of the task this is a variant of (if applicable) */
  variantOfTaskId?: string
  /** Suggested variations if duplicate was found */
  suggestedVariations?: string[]
}

// ============================================================================
// Fingerprint Management for Module Tasks
// ============================================================================

/**
 * Cache of fingerprints per module
 */
const moduleFingerprintCache = new Map<string, Map<string, TaskFingerprint>>()

/**
 * Get or build fingerprint cache for a module's tasks
 */
export function getModuleFingerprintCache(
  moduleId: string, 
  tasks: Task[]
): Map<string, TaskFingerprint> {
  // Check if we have a cached version
  const cached = moduleFingerprintCache.get(moduleId)
  if (cached && cached.size === tasks.length) {
    return cached
  }
  
  // Rebuild cache
  const fingerprintMap = buildFingerprintMap(tasks)
  moduleFingerprintCache.set(moduleId, fingerprintMap)
  
  return fingerprintMap
}

/**
 * Invalidate fingerprint cache for a module
 */
export function invalidateFingerprintCache(moduleId: string): void {
  moduleFingerprintCache.delete(moduleId)
}

/**
 * Add a task's fingerprint to the cache
 */
export function addToFingerprintCache(
  moduleId: string, 
  taskId: string, 
  fingerprint: TaskFingerprint
): void {
  let cache = moduleFingerprintCache.get(moduleId)
  if (!cache) {
    cache = new Map()
    moduleFingerprintCache.set(moduleId, cache)
  }
  cache.set(taskId, fingerprint)
}

// ============================================================================
// Pre-Generation Duplicate Check
// ============================================================================

/**
 * Check if a task with the given parameters would be a duplicate
 * Call this BEFORE generating to save LLM calls
 */
export function preCheckDuplicate(
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  existingTasks: Task[],
  moduleId: string
): { 
  wouldBeDuplicate: boolean
  similarity: number
  matchingTask?: Task
  suggestions?: string[]
} {
  // Normalize topic
  const canonicalTopic = findCanonicalTopic(topic) || normalizeTopicKey(topic)
  
  // Build fingerprint cache
  const fingerprintCache = getModuleFingerprintCache(moduleId, existingTasks)
  
  // Find tasks with same canonical topic
  const sameTopic = existingTasks.filter(t => {
    const taskTopic = t.tags[0] ? (findCanonicalTopic(t.tags[0]) || normalizeTopicKey(t.tags[0])) : ''
    return taskTopic === canonicalTopic
  })
  
  // Check if there are already many tasks on this topic with same difficulty
  const sameDifficulty = sameTopic.filter(t => t.difficulty === difficulty)
  
  if (sameDifficulty.length >= 3) {
    // High chance of duplicate - suggest variations
    const archetype = sameDifficulty.length > 0 
      ? fingerprintFromTask(sameDifficulty[0]).archetype 
      : 'general'
    
    return {
      wouldBeDuplicate: true,
      similarity: 0.9,
      matchingTask: sameDifficulty[0],
      suggestions: getVariationStrategies(archetype)
    }
  }
  
  // Check for near-duplicate fingerprints
  // Create a hypothetical fingerprint for the new task
  const hypotheticalFp = createTaskFingerprint(
    `Aufgabe zu ${topic}`, // Minimal question text
    [topic],
    []
  )
  
  // Override with requested difficulty
  hypotheticalFp.features.difficulty = difficulty
  
  // Check against existing
  const duplicateCheck = checkForDuplicate(hypotheticalFp, fingerprintCache, 0.75)
  
  if (duplicateCheck.isDuplicate && duplicateCheck.matchingTaskId) {
    const matchingTask = existingTasks.find(t => t.id === duplicateCheck.matchingTaskId)
    return {
      wouldBeDuplicate: true,
      similarity: duplicateCheck.similarity,
      matchingTask,
      suggestions: getVariationStrategies(hypotheticalFp.archetype)
    }
  }
  
  return {
    wouldBeDuplicate: false,
    similarity: duplicateCheck.similarity
  }
}

// ============================================================================
// Post-Generation Duplicate Check
// ============================================================================

/**
 * Check a generated task for duplicates before saving
 */
export function postCheckDuplicate(
  generatedTask: Task,
  existingTasks: Task[],
  moduleId: string,
  threshold: number = 0.85
): DuplicateCheckResult {
  const fingerprintCache = getModuleFingerprintCache(moduleId, existingTasks)
  const newFingerprint = fingerprintFromTask(generatedTask)
  
  return checkForDuplicate(newFingerprint, fingerprintCache, threshold)
}

// ============================================================================
// Variant Generation Support
// ============================================================================

/**
 * Get information needed to generate a variant of an existing task
 */
export function getVariantGenerationInfo(
  originalTask: Task,
  existingTasks: Task[],
  moduleId: string
): {
  archetype: string
  canonicalTopic: string
  variationStrategies: string[]
  avoidPatterns: string[]
  originalFingerprint: TaskFingerprint
} {
  const originalFp = fingerprintFromTask(originalTask)
  const fingerprintCache = getModuleFingerprintCache(moduleId, existingTasks)
  
  // Find other tasks with same archetype to understand what to avoid
  const avoidPatterns: string[] = []
  
  for (const [taskId, fp] of fingerprintCache) {
    if (taskId !== originalTask.id && fp.archetype === originalFp.archetype) {
      // Add distinguishing features to avoid
      const task = existingTasks.find(t => t.id === taskId)
      if (task) {
        // Extract key numbers or patterns to avoid
        const numbers = task.question.match(/\d+/g)
        if (numbers) {
          avoidPatterns.push(`Vermeide die Zahlen: ${numbers.slice(0, 5).join(', ')}`)
        }
      }
    }
  }
  
  return {
    archetype: originalFp.archetype,
    canonicalTopic: originalFp.topic,
    variationStrategies: getVariationStrategies(originalFp.archetype),
    avoidPatterns,
    originalFingerprint: originalFp
  }
}

/**
 * Build a prompt hint for variant generation
 */
export function buildVariantPromptHint(
  originalTask: Task,
  existingTasks: Task[],
  moduleId: string
): string {
  const info = getVariantGenerationInfo(originalTask, existingTasks, moduleId)
  
  let hint = `\n\nVARIANTEN-MODUS: Erstelle eine Variation der folgenden Aufgabe.
Original-Aufgabe: "${originalTask.question.substring(0, 200)}..."
Archetype: ${info.archetype}

VARIATIONSSTRATEGIEN (wähle eine):
${info.variationStrategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}

WICHTIG - VERMEIDE Wiederholungen:
${info.avoidPatterns.slice(0, 5).join('\n')}

Die Aufgabe muss strukturell ähnlich, aber mit anderen konkreten Werten sein.`
  
  return hint
}

// ============================================================================
// Topic-Aware Knowledge Retrieval
// ============================================================================

/**
 * Retrieve relevant knowledge for a topic from V2 index
 */
export function retrieveTopicKnowledge(
  topic: string,
  knowledgeIndex: ModuleKnowledgeIndexV2
): {
  concepts: Array<{ term: string; definition: string }>
  formulas: Array<{ latex: string; description?: string }>
  procedures: Array<{ name: string; steps: string[] }>
  relatedTopics: string[]
} {
  const canonicalTopic = findCanonicalTopic(topic) || normalizeTopicKey(topic)
  
  // Look up in topic index
  const topicEntry = knowledgeIndex.topicIndex[canonicalTopic]
  
  if (!topicEntry) {
    // Try fuzzy match
    for (const [key, entry] of Object.entries(knowledgeIndex.topicIndex)) {
      if (key.includes(canonicalTopic) || canonicalTopic.includes(key)) {
        return extractKnowledgeFromEntry(entry, knowledgeIndex)
      }
    }
    
    return { concepts: [], formulas: [], procedures: [], relatedTopics: [] }
  }
  
  return extractKnowledgeFromEntry(topicEntry, knowledgeIndex)
}

/**
 * Extract knowledge from a topic index entry
 */
function extractKnowledgeFromEntry(
  entry: {
    conceptIds: string[]
    formulaIds: string[]
    procedureIds: string[]
  },
  index: ModuleKnowledgeIndexV2
) {
  const concepts = index.concepts
    .filter(c => entry.conceptIds.includes(c.id))
    .map(c => ({ term: c.term, definition: c.definition }))
  
  const formulas = index.formulas
    .filter(f => entry.formulaIds.includes(f.id))
    .map(f => ({ latex: f.latex, description: f.description }))
  
  const procedures = index.procedures
    .filter(p => entry.procedureIds.includes(p.id))
    .map(p => ({ name: p.name, steps: p.steps }))
  
  // Find related topics (those that share concepts/formulas)
  const relatedTopics: string[] = []
  for (const [topic, te] of Object.entries(index.topicIndex)) {
    const sharedConcepts = te.conceptIds.filter(id => entry.conceptIds.includes(id))
    if (sharedConcepts.length > 0) {
      relatedTopics.push(topic)
    }
  }
  
  return { concepts, formulas, procedures, relatedTopics: relatedTopics.slice(0, 5) }
}

// ============================================================================
// Task Archetype Selection
// ============================================================================

/**
 * Select an appropriate archetype for task generation
 */
export function selectArchetype(
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  exerciseStyle: ExerciseStyleProfileV2,
  existingTasks: Task[],
  moduleId: string
): TaskArchetype | null {
  const canonicalTopic = findCanonicalTopic(topic) || normalizeTopicKey(topic)
  
  // Find archetypes that apply to this topic
  const applicableArchetypes = exerciseStyle.taskArchetypes.filter(a =>
    a.applicableTopics.includes(canonicalTopic) ||
    a.applicableTopics.some(t => t.includes(canonicalTopic) || canonicalTopic.includes(t))
  )
  
  if (applicableArchetypes.length === 0) {
    return null
  }
  
  // Filter by difficulty
  const difficultyOrder = ['easy', 'medium', 'hard']
  const requestedDiffIdx = difficultyOrder.indexOf(difficulty)
  
  const matchingDifficulty = applicableArchetypes.filter(a => {
    const minIdx = difficultyOrder.indexOf(a.difficultyRange.min)
    const maxIdx = difficultyOrder.indexOf(a.difficultyRange.max)
    return requestedDiffIdx >= minIdx && requestedDiffIdx <= maxIdx
  })
  
  const candidates = matchingDifficulty.length > 0 ? matchingDifficulty : applicableArchetypes
  
  // Prefer archetypes we haven't used much
  const fingerprintCache = getModuleFingerprintCache(moduleId, existingTasks)
  const archetypeUsage = new Map<string, number>()
  
  for (const [, fp] of fingerprintCache) {
    const usage = archetypeUsage.get(fp.archetype) || 0
    archetypeUsage.set(fp.archetype, usage + 1)
  }
  
  // Sort by usage (least used first)
  candidates.sort((a, b) => {
    const usageA = archetypeUsage.get(a.id) || 0
    const usageB = archetypeUsage.get(b.id) || 0
    return usageA - usageB
  })
  
  return candidates[0] || null
}

// ============================================================================
// Exports
// ============================================================================

export {
  createTaskFingerprint,
  fingerprintFromTask,
  checkForDuplicate,
  getVariationStrategies,
  isVariantOf
}
