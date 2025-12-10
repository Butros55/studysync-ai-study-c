/**
 * Task Fingerprint & Deduplication System
 * 
 * Provides:
 * - SHA256-based fingerprinting for exact duplicate detection
 * - Text normalization utilities
 * - Browser-compatible crypto operations
 * 
 * ENTRY POINT: Alle Task-Speichervorgänge müssen durch dedup-check laufen
 */

// ============================================================================
// Types
// ============================================================================

export interface TaskFingerprintData {
  /** SHA256 hash of normalized content */
  fingerprint: string
  /** Normalized question text (for debugging) */
  normalizedQuestion: string
  /** Normalized solution text (for debugging) */
  normalizedSolution: string
  /** Sorted tags used in fingerprint */
  normalizedTags: string[]
}

export interface DuplicateCheckResult {
  /** Whether this is an exact duplicate */
  isDuplicate: boolean
  /** The matching task ID if found */
  matchingTaskId?: string
  /** The fingerprint of the new task */
  fingerprint: string
}

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize text for fingerprinting:
 * - lowercase
 * - compress whitespace to single spaces
 * - remove punctuation (unicode-safe)
 * - trim
 */
export function normalizeText(s: string): string {
  if (!s) return ''
  
  return s
    // Convert to lowercase
    .toLowerCase()
    // Remove all punctuation (unicode-safe regex)
    .replace(/[\p{P}\p{S}]/gu, ' ')
    // Compress whitespace (tabs, newlines, multiple spaces → single space)
    .replace(/\s+/g, ' ')
    // Trim leading/trailing whitespace
    .trim()
}

/**
 * Normalize tags for fingerprinting:
 * - lowercase each tag
 * - trim whitespace
 * - sort alphabetically
 * - remove duplicates
 */
export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || !Array.isArray(tags)) return []
  
  const normalized = tags
    .filter(t => typeof t === 'string' && t.trim())
    .map(t => t.toLowerCase().trim())
  
  // Remove duplicates and sort
  return [...new Set(normalized)].sort()
}

// ============================================================================
// SHA256 Hashing (Browser-compatible)
// ============================================================================

/**
 * Compute SHA256 hash of a string (async, uses WebCrypto)
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  
  // Use SubtleCrypto for browser compatibility
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex
}

/**
 * Synchronous simple hash fallback (for cases where async is not possible)
 * Uses djb2 algorithm - NOT cryptographically secure, but fast
 */
export function simpleHash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// ============================================================================
// Task Fingerprint Generation
// ============================================================================

/**
 * Generate fingerprint for a task based on question, solution, and tags
 * 
 * The fingerprint is a SHA256 hash of:
 * normalize(question) + "|" + normalize(solution) + "|" + sortedTags.join(",")
 */
export async function taskFingerprint(
  question: string,
  solution: string,
  tags?: string[]
): Promise<TaskFingerprintData> {
  const normalizedQuestion = normalizeText(question)
  const normalizedSolution = normalizeText(solution)
  const normalizedTags = normalizeTags(tags)
  
  // Build fingerprint base string
  const base = `${normalizedQuestion}|${normalizedSolution}|${normalizedTags.join(',')}`
  
  // Compute SHA256 hash
  const fingerprint = await sha256(base)
  
  return {
    fingerprint,
    normalizedQuestion,
    normalizedSolution,
    normalizedTags
  }
}

/**
 * Synchronous fingerprint generation (uses simple hash instead of SHA256)
 * Use this only when async is not possible
 */
export function taskFingerprintSync(
  question: string,
  solution: string,
  tags?: string[]
): TaskFingerprintData {
  const normalizedQuestion = normalizeText(question)
  const normalizedSolution = normalizeText(solution)
  const normalizedTags = normalizeTags(tags)
  
  // Build fingerprint base string
  const base = `${normalizedQuestion}|${normalizedSolution}|${normalizedTags.join(',')}`
  
  // Use simple hash for sync operation
  const fingerprint = simpleHash(base) + simpleHash(base.split('').reverse().join(''))
  
  return {
    fingerprint,
    normalizedQuestion,
    normalizedSolution,
    normalizedTags
  }
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Check if a task with the given fingerprint already exists in the module
 * 
 * @param fingerprint - The fingerprint to check
 * @param existingFingerprints - Map of taskId -> fingerprint for existing tasks
 * @returns DuplicateCheckResult
 */
export function checkFingerprintDuplicate(
  fingerprint: string,
  existingFingerprints: Map<string, string>
): DuplicateCheckResult {
  for (const [taskId, existingFp] of existingFingerprints) {
    if (existingFp === fingerprint) {
      return {
        isDuplicate: true,
        matchingTaskId: taskId,
        fingerprint
      }
    }
  }
  
  return {
    isDuplicate: false,
    fingerprint
  }
}

/**
 * Build a fingerprint map from existing tasks
 * 
 * @param tasks - Array of tasks with fingerprint field
 * @returns Map of taskId -> fingerprint
 */
export function buildFingerprintMap(
  tasks: Array<{ id: string; fingerprint?: string }>
): Map<string, string> {
  const map = new Map<string, string>()
  
  for (const task of tasks) {
    if (task.fingerprint) {
      map.set(task.id, task.fingerprint)
    }
  }
  
  return map
}

/**
 * Check and compute fingerprint for a new task
 * Returns duplicate check result with the computed fingerprint
 */
export async function checkTaskDuplicate(
  question: string,
  solution: string,
  tags: string[] | undefined,
  existingTasks: Array<{ id: string; fingerprint?: string }>
): Promise<DuplicateCheckResult> {
  // Compute fingerprint for new task
  const fpData = await taskFingerprint(question, solution, tags)
  
  // Build map of existing fingerprints
  const existingMap = buildFingerprintMap(existingTasks)
  
  // Check for duplicate
  return checkFingerprintDuplicate(fpData.fingerprint, existingMap)
}
