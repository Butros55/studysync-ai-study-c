/**
 * Task Migration Utilities
 * 
 * Handles migration of existing tasks to add new fields:
 * - fingerprint (SHA256 hash for dedup)
 * - topicId (for coverage tracking)
 * - generationMeta (metadata)
 * 
 * Run this migration once when the app loads.
 */

import { storage, storageReady, getCollection, setCollection } from './storage'
import { taskFingerprint } from './dedupe/taskFingerprint'
import { generateTopicId } from './dedupe/topicCoverage'
import type { Task } from './types'

// ============================================================================
// Types
// ============================================================================

export interface MigrationResult {
  /** Whether migration was needed */
  migrationNeeded: boolean
  /** Number of tasks migrated */
  migratedCount: number
  /** Total tasks */
  totalTasks: number
  /** Duration in ms */
  durationMs: number
  /** Any errors encountered */
  errors: string[]
}

// ============================================================================
// Migration State
// ============================================================================

const MIGRATION_KEY = 'task_migration_v2_completed'
const MIGRATION_VERSION = 2 // Increment when adding new migrations

/**
 * Check if migration has already been completed
 */
export async function isMigrationCompleted(): Promise<boolean> {
  await storageReady
  try {
    const migrationState = localStorage.getItem(MIGRATION_KEY)
    if (!migrationState) return false
    
    const parsed = JSON.parse(migrationState)
    return parsed.version >= MIGRATION_VERSION
  } catch {
    return false
  }
}

/**
 * Mark migration as completed
 */
function markMigrationCompleted(): void {
  localStorage.setItem(MIGRATION_KEY, JSON.stringify({
    version: MIGRATION_VERSION,
    completedAt: Date.now()
  }))
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Run task migration to add fingerprints and other new fields
 * 
 * This is designed to be:
 * - Idempotent (safe to run multiple times)
 * - Fast (batch processing)
 * - Non-blocking (async)
 */
export async function runTaskMigration(): Promise<MigrationResult> {
  const startTime = Date.now()
  const errors: string[] = []

  // Check if already completed
  if (await isMigrationCompleted()) {
    return {
      migrationNeeded: false,
      migratedCount: 0,
      totalTasks: 0,
      durationMs: Date.now() - startTime,
      errors: []
    }
  }

  await storageReady

  // Load all tasks
  const tasks = await getCollection<Task>('tasks')
  
  if (tasks.length === 0) {
    markMigrationCompleted()
    return {
      migrationNeeded: false,
      migratedCount: 0,
      totalTasks: 0,
      durationMs: Date.now() - startTime,
      errors: []
    }
  }

  console.log(`[Migration] Starting migration for ${tasks.length} tasks...`)

  let migratedCount = 0
  const updatedTasks: Task[] = []

  // Process tasks in batches to avoid blocking
  const BATCH_SIZE = 50
  
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE)
    
    const processedBatch = await Promise.all(
      batch.map(async (task) => {
        try {
          let needsUpdate = false
          const updates: Partial<Task> = {}

          // Add fingerprint if missing
          if (!task.fingerprint) {
            const fpData = await taskFingerprint(
              task.question,
              task.solution,
              task.tags
            )
            updates.fingerprint = fpData.fingerprint
            needsUpdate = true
          }

          // Add topicId if missing but topic exists
          if (!task.topicId && task.topic) {
            updates.topicId = generateTopicId(task.topic, task.moduleId)
            needsUpdate = true
          }

          if (needsUpdate) {
            migratedCount++
            return { ...task, ...updates }
          }

          return task
        } catch (error) {
          errors.push(`Failed to migrate task ${task.id}: ${error}`)
          return task
        }
      })
    )

    updatedTasks.push(...processedBatch)

    // Yield to main thread between batches
    if (i + BATCH_SIZE < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  // Save all tasks
  if (migratedCount > 0) {
    await setCollection('tasks', updatedTasks)
    console.log(`[Migration] Migrated ${migratedCount} tasks`)
  }

  markMigrationCompleted()

  return {
    migrationNeeded: migratedCount > 0,
    migratedCount,
    totalTasks: tasks.length,
    durationMs: Date.now() - startTime,
    errors
  }
}

/**
 * Force re-run migration (for development/debugging)
 */
export async function forceRunMigration(): Promise<MigrationResult> {
  localStorage.removeItem(MIGRATION_KEY)
  return runTaskMigration()
}

// ============================================================================
// Task Storage with Dedup
// ============================================================================

export interface TaskSaveResult {
  success: boolean
  task?: Task
  isDuplicate: boolean
  duplicateReason?: string
  matchingTaskId?: string
}

/**
 * Save a task with dedup check
 * Returns failure if task is a duplicate
 */
export async function saveTaskWithDedup(
  task: Task,
  existingTasks: Task[]
): Promise<TaskSaveResult> {
  // Ensure task has fingerprint
  if (!task.fingerprint) {
    const fpData = await taskFingerprint(task.question, task.solution, task.tags)
    task.fingerprint = fpData.fingerprint
  }

  // Check for fingerprint duplicates
  for (const existing of existingTasks) {
    if (existing.fingerprint === task.fingerprint && existing.id !== task.id) {
      return {
        success: false,
        isDuplicate: true,
        duplicateReason: 'Exaktes Duplikat (identischer Fingerprint)',
        matchingTaskId: existing.id
      }
    }
  }

  // Task is not a duplicate
  return {
    success: true,
    task,
    isDuplicate: false
  }
}

/**
 * Batch save tasks with dedup check
 * Returns only non-duplicate tasks
 */
export async function saveTasksWithDedup(
  newTasks: Task[],
  existingTasks: Task[]
): Promise<{
  savedTasks: Task[]
  duplicateCount: number
  duplicates: Array<{ task: Task; reason: string; matchingTaskId?: string }>
}> {
  const savedTasks: Task[] = []
  const duplicates: Array<{ task: Task; reason: string; matchingTaskId?: string }> = []
  
  // Build fingerprint set from existing + already saved
  const seenFingerprints = new Set<string>()
  
  for (const existing of existingTasks) {
    if (existing.fingerprint) {
      seenFingerprints.add(existing.fingerprint)
    }
  }

  for (const task of newTasks) {
    // Ensure task has fingerprint
    if (!task.fingerprint) {
      const fpData = await taskFingerprint(task.question, task.solution, task.tags)
      task.fingerprint = fpData.fingerprint
    }

    // Check if duplicate
    if (seenFingerprints.has(task.fingerprint)) {
      // Find matching task
      const matching = existingTasks.find(t => t.fingerprint === task.fingerprint)
      duplicates.push({
        task,
        reason: 'Exaktes Duplikat',
        matchingTaskId: matching?.id
      })
    } else {
      savedTasks.push(task)
      seenFingerprints.add(task.fingerprint)
    }
  }

  return {
    savedTasks,
    duplicateCount: duplicates.length,
    duplicates
  }
}
