/**
 * StudySync Dedup & Topic Coverage System
 * 
 * ========================================
 * ENTRY POINTS & USAGE GUIDE
 * ========================================
 * 
 * 1. FINGERPRINT DEDUP (exact duplicates):
 *    - Import: taskFingerprint, checkTaskDuplicate from './dedupe'
 *    - Use: Before saving any task, compute fingerprint and check
 * 
 * 2. SEMANTIC DEDUP (paraphrased duplicates):
 *    - Import: findSemanticDuplicates, softSemanticSimilarity from './dedupe'
 *    - Use: After fingerprint check, run semantic check for threshold >= 0.85
 * 
 * 3. TOPIC COVERAGE (ensure all topics get tasks):
 *    - Import: buildTaskBlueprint, getModuleTopics from './dedupe'
 *    - Use: Build blueprint before generating tasks, then generate per-topic
 * 
 * 4. SIMILARITY RETRIEVAL (avoid list for LLM):
 *    - Import: getTopKSimilarTasks from './dedupe'
 *    - Use: Get 10 most similar existing tasks as "AVOID" list in prompt
 * 
 * 5. TASK MIGRATION (add fingerprints to existing tasks):
 *    - Import: runTaskMigration from './task-migration'
 *    - Use: Run once at app startup to backfill fingerprints
 * 
 * 6. PRACTICE TASK GENERATOR (full pipeline):
 *    - Import: generatePracticeTasks from './practice-task-generator'
 *    - Use: Call with moduleId and count, handles everything
 * 
 * ========================================
 * FILES CREATED/MODIFIED
 * ========================================
 * 
 * NEW FILES:
 * - src/lib/dedupe/taskFingerprint.ts - SHA256 fingerprinting & exact dedup
 * - src/lib/dedupe/semanticSimilarity.ts - Cosine similarity, Jaccard, n-grams
 * - src/lib/dedupe/topicCoverage.ts - Topic extraction & coverage tracking
 * - src/lib/dedupe/index.ts - Module exports
 * - src/lib/prompts/practiceTasks.prompt.ts - Practice task prompt template
 * - src/lib/prompts/flashcards.prompt.ts - Flashcard prompt template
 * - src/lib/prompts/notes.prompt.ts - Notes prompt template
 * - src/lib/prompts/examBlueprint.prompt.ts - Exam blueprint prompt
 * - src/lib/prompts/examTask.prompt.ts - Exam task prompt
 * - src/lib/prompts/index.ts - Prompt exports
 * - src/lib/practice-task-generator.ts - Full pipeline for practice tasks
 * - src/lib/task-migration.ts - Migration to add fingerprints
 * - src/lib/__tests__/dedupe.test.ts - Unit tests
 * 
 * MODIFIED FILES:
 * - src/lib/types.ts - Added Task fields: fingerprint, topicId, sourceDocIds, generationMeta
 * - src/App.tsx - Added migration call, dedup checks in handleGenerateTasks
 * 
 * ========================================
 * MIGRATION
 * ========================================
 * 
 * The migration runs automatically on app startup and adds fingerprints
 * to all existing tasks. It's idempotent and fast (batch processing).
 * 
 * ========================================
 * TESTING
 * ========================================
 * 
 * Run: npx vitest run src/lib/__tests__/dedupe.test.ts
 * 
 */

// Re-export everything for convenience
export * from './dedupe'
export * from './prompts'
export { 
  generatePracticeTasks, 
  migrateTasksAddFingerprints,
  checkTaskIsDuplicate,
  type GeneratePracticeTasksOptions,
  type GenerationProgress,
  type GenerationResult,
  type GenerationDebugReport
} from './practice-task-generator'
export {
  runTaskMigration,
  forceRunMigration,
  isMigrationCompleted,
  saveTaskWithDedup,
  saveTasksWithDedup,
  type MigrationResult,
  type TaskSaveResult
} from './task-migration'
