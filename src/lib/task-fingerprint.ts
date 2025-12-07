/**
 * Task Fingerprinting & Duplicate Detection
 * 
 * Provides functions to:
 * - Create fingerprints for tasks based on structural features
 * - Detect near-duplicate tasks to avoid repetition
 * - Support variant generation (same archetype, different values)
 * 
 * Fingerprints are based on:
 * 1. Topic (canonicalized)
 * 2. Task archetype (what type of operation)
 * 3. Key structural features (number of variables, subtasks, etc.)
 * 
 * NOT included in fingerprint (to allow variants):
 * - Specific numbers/values
 * - Variable names
 * - Exact wording
 */

import { normalizeTopicKey, findCanonicalTopic } from './topic-normalizer'
import type { Task, ExamTask } from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * A task fingerprint for duplicate detection
 */
export interface TaskFingerprint {
  /** Canonical topic */
  topic: string
  /** Task archetype (e.g., "kv-minimization", "number-conversion") */
  archetype: string
  /** Key structural features */
  features: TaskFeatures
  /** Full fingerprint string for comparison */
  fingerprint: string
  /** Short hash for storage */
  hash: string
}

/**
 * Structural features extracted from a task
 */
export interface TaskFeatures {
  /** Number of variables (for boolean algebra) */
  numVariables?: number
  /** Number of subtasks */
  numSubtasks: number
  /** Answer format(s) expected */
  answerFormats: string[]
  /** Whether task requires diagram */
  requiresDiagram: boolean
  /** Whether task requires table */
  requiresTable: boolean
  /** Whether task requires code */
  requiresCode: boolean
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown'
  /** Estimated complexity (1-10) */
  complexity: number
}

/**
 * Result of duplicate check
 */
export interface DuplicateCheckResult {
  /** Whether a duplicate or near-duplicate was found */
  isDuplicate: boolean
  /** How similar (0-1, 1 = exact duplicate) */
  similarity: number
  /** The matching fingerprint if found */
  matchingFingerprint?: TaskFingerprint
  /** The matching task ID if found */
  matchingTaskId?: string
  /** Reason for duplicate detection */
  reason?: string
}

// ============================================================================
// Archetype Detection
// ============================================================================

/**
 * Detect task archetype from question text
 */
export function detectArchetype(questionText: string): string {
  const text = questionText.toLowerCase()
  
  // Boolean algebra / logic
  if (/kv[- ]?diagramm|karnaugh/i.test(text)) return 'kv-minimization'
  if (/quine[- ]?mccluskey|qmc/i.test(text)) return 'quine-mccluskey'
  if (/wahrheitstab/i.test(text)) return 'truth-table'
  if (/dnf|disjunktiv|minterm/i.test(text)) return 'dnf-conversion'
  if (/knf|konjunktiv|maxterm/i.test(text)) return 'knf-conversion'
  if (/negiere|de.?morgan/i.test(text)) return 'boolean-negation'
  if (/vereinfach|simplifiz|minimier/i.test(text) && /boole|logik|ausdruck/i.test(text)) {
    return 'boolean-simplification'
  }
  
  // Number systems
  if (/dezimal.*binär|binär.*dezimal|umrechnung|konvertier/i.test(text) && /zahl/i.test(text)) {
    return 'number-conversion'
  }
  if (/hex|hexadezimal/i.test(text)) return 'hex-conversion'
  if (/oktal/i.test(text)) return 'octal-conversion'
  if (/bcd|binary.?coded/i.test(text)) return 'bcd-coding'
  if (/zweier.*komplement|2[- ]?komplement|two'?s.?complement/i.test(text)) return 'twos-complement'
  if (/einer.*komplement|1[- ]?komplement|ones.?complement/i.test(text)) return 'ones-complement'
  if (/ieee|gleitkomma|float/i.test(text)) return 'ieee-floating-point'
  
  // Automata & FSM
  if (/automat|state.?machine|zustand/i.test(text)) {
    if (/mealy/i.test(text)) return 'mealy-automaton'
    if (/moore/i.test(text)) return 'moore-automaton'
    if (/nfa|nea|nicht.*determin/i.test(text)) return 'nfa-design'
    if (/dfa|dea|determin/i.test(text)) return 'dfa-design'
    return 'automaton-general'
  }
  
  // Coding theory
  if (/huffman/i.test(text)) return 'huffman-coding'
  if (/hamming/i.test(text)) return 'hamming-code'
  if (/parität|parity/i.test(text)) return 'parity-check'
  if (/crc/i.test(text)) return 'crc-calculation'
  
  // Circuits
  if (/schaltung|circuit|gatter|gate/i.test(text)) return 'circuit-design'
  if (/halbaddierer|half.?adder/i.test(text)) return 'half-adder'
  if (/volladdierer|full.?adder/i.test(text)) return 'full-adder'
  if (/multiplexer|mux/i.test(text)) return 'multiplexer'
  if (/demultiplexer|demux/i.test(text)) return 'demultiplexer'
  if (/decoder|dekodierer/i.test(text)) return 'decoder'
  if (/encoder|kodierer/i.test(text)) return 'encoder'
  if (/flip.?flop|ff/i.test(text)) return 'flip-flop'
  if (/latch/i.test(text)) return 'latch'
  if (/register/i.test(text)) return 'register'
  if (/zähler|counter/i.test(text)) return 'counter'
  
  // Complexity & algorithms
  if (/o\(|komplexität|laufzeit/i.test(text)) return 'complexity-analysis'
  if (/rekursion|rekursiv/i.test(text)) return 'recursion'
  if (/sortier/i.test(text)) return 'sorting'
  if (/such|search/i.test(text)) return 'searching'
  
  // Data structures
  if (/baum|tree/i.test(text)) return 'tree-operation'
  if (/graph/i.test(text)) return 'graph-operation'
  if (/stack|stapel/i.test(text)) return 'stack-operation'
  if (/queue|warteschlange/i.test(text)) return 'queue-operation'
  if (/liste|list/i.test(text)) return 'list-operation'
  if (/hash/i.test(text)) return 'hashing'
  
  // General task types
  if (/beweise|zeige.*dass|prove/i.test(text)) return 'proof'
  if (/implementier|programmier|code/i.test(text)) return 'implementation'
  if (/erkläre|beschreibe|explain/i.test(text)) return 'explanation'
  if (/zeichne|skizzier|diagram/i.test(text)) return 'diagram-creation'
  if (/berechne|compute|calculate/i.test(text)) return 'calculation'
  if (/vergleiche|compare/i.test(text)) return 'comparison'
  if (/definiere|define/i.test(text)) return 'definition'
  
  return 'general'
}

// ============================================================================
// Feature Extraction
// ============================================================================

/**
 * Extract structural features from task question
 */
export function extractFeatures(questionText: string, subtasks?: string[]): TaskFeatures {
  const text = questionText.toLowerCase()
  
  // Count variables (a, b, c, d, e, x, y, z in boolean context)
  let numVariables: number | undefined
  const varMatch = text.match(/(\d+)\s*variable/i)
  if (varMatch) {
    numVariables = parseInt(varMatch[1], 10)
  } else {
    // Try to detect from context
    const varsInText = text.match(/\b[a-e]\b|\b[x-z]\b/gi)
    if (varsInText) {
      numVariables = new Set(varsInText.map(v => v.toLowerCase())).size
    }
  }
  
  // Count subtasks
  const numSubtasks = subtasks?.length || 
    (text.match(/[a-z]\)|teilaufgabe|\d+\./gi)?.length || 0)
  
  // Detect answer formats
  const answerFormats: string[] = []
  if (/tabelle|table/i.test(text)) answerFormats.push('table')
  if (/diagram|zeichn|skizz/i.test(text)) answerFormats.push('diagram')
  if (/formel|formula|ausdruck|expression/i.test(text)) answerFormats.push('formula')
  if (/code|programm|implement/i.test(text)) answerFormats.push('code')
  if (/text|erklär|beschreib/i.test(text)) answerFormats.push('text')
  if (/zahl|wert|ergeb|result/i.test(text)) answerFormats.push('number')
  if (answerFormats.length === 0) answerFormats.push('text')
  
  // Detect requirements
  const requiresDiagram = /diagram|zeichn|skizz|automat|graph|baum/i.test(text)
  const requiresTable = /tabelle|table|wahrheitstab/i.test(text)
  const requiresCode = /code|programm|implement|pseudo/i.test(text)
  
  // Estimate difficulty
  let difficulty: 'easy' | 'medium' | 'hard' | 'unknown' = 'unknown'
  if (/einfach|leicht|basic|einführ/i.test(text)) difficulty = 'easy'
  else if (/schwer|komplex|schwierig|fortgeschritt/i.test(text)) difficulty = 'hard'
  else if (numSubtasks >= 4 || (numVariables && numVariables >= 5)) difficulty = 'hard'
  else if (numSubtasks >= 2 || (numVariables && numVariables >= 3)) difficulty = 'medium'
  else difficulty = 'easy'
  
  // Estimate complexity (1-10)
  let complexity = 3 // Base complexity
  if (numVariables) complexity += Math.min(numVariables - 2, 3)
  if (numSubtasks > 0) complexity += Math.min(numSubtasks, 3)
  if (requiresDiagram) complexity += 1
  if (requiresCode) complexity += 2
  complexity = Math.min(10, Math.max(1, complexity))
  
  return {
    numVariables,
    numSubtasks,
    answerFormats,
    requiresDiagram,
    requiresTable,
    requiresCode,
    difficulty,
    complexity
  }
}

// ============================================================================
// Fingerprint Generation
// ============================================================================

/**
 * Create a fingerprint for a task
 */
export function createTaskFingerprint(
  questionText: string,
  tags: string[] = [],
  subtasks?: string[]
): TaskFingerprint {
  // Get canonical topic from tags
  const primaryTag = tags[0] || ''
  const topic = findCanonicalTopic(primaryTag) || normalizeTopicKey(primaryTag) || 'general'
  
  // Detect archetype
  const archetype = detectArchetype(questionText)
  
  // Extract features
  const features = extractFeatures(questionText, subtasks)
  
  // Build fingerprint string
  const fingerprintParts = [
    topic,
    archetype,
    `sub:${features.numSubtasks}`,
    `diff:${features.difficulty}`,
    `cmplx:${features.complexity}`,
    features.numVariables ? `vars:${features.numVariables}` : '',
    features.requiresDiagram ? 'diag' : '',
    features.requiresTable ? 'tbl' : '',
    features.requiresCode ? 'code' : ''
  ].filter(Boolean)
  
  const fingerprint = fingerprintParts.join('|')
  
  // Create short hash
  const hash = simpleHash(fingerprint)
  
  return {
    topic,
    archetype,
    features,
    fingerprint,
    hash
  }
}

/**
 * Simple string hash for fingerprints
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8)
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Compare two fingerprints for similarity
 * Returns a score from 0 (completely different) to 1 (identical)
 */
export function compareFingerprints(fp1: TaskFingerprint, fp2: TaskFingerprint): number {
  let score = 0
  let maxScore = 0
  
  // Topic match (30% weight)
  maxScore += 30
  if (fp1.topic === fp2.topic) score += 30
  
  // Archetype match (40% weight) - most important
  maxScore += 40
  if (fp1.archetype === fp2.archetype) score += 40
  
  // Difficulty match (10% weight)
  maxScore += 10
  if (fp1.features.difficulty === fp2.features.difficulty) score += 10
  
  // Subtask count match (10% weight)
  maxScore += 10
  if (fp1.features.numSubtasks === fp2.features.numSubtasks) score += 10
  else if (Math.abs(fp1.features.numSubtasks - fp2.features.numSubtasks) <= 1) score += 5
  
  // Variable count match (5% weight)
  maxScore += 5
  if (fp1.features.numVariables === fp2.features.numVariables) score += 5
  
  // Format requirements match (5% weight)
  maxScore += 5
  const formatOverlap = fp1.features.answerFormats.filter(f => 
    fp2.features.answerFormats.includes(f)
  ).length
  const formatUnion = new Set([...fp1.features.answerFormats, ...fp2.features.answerFormats]).size
  if (formatUnion > 0) score += 5 * (formatOverlap / formatUnion)
  
  return score / maxScore
}

/**
 * Check if a task is a duplicate of any existing task
 */
export function checkForDuplicate(
  newFingerprint: TaskFingerprint,
  existingFingerprints: Map<string, TaskFingerprint>,
  threshold: number = 0.85
): DuplicateCheckResult {
  let highestSimilarity = 0
  let matchingFingerprint: TaskFingerprint | undefined
  let matchingTaskId: string | undefined
  
  for (const [taskId, fp] of existingFingerprints) {
    const similarity = compareFingerprints(newFingerprint, fp)
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
      matchingFingerprint = fp
      matchingTaskId = taskId
    }
  }
  
  const isDuplicate = highestSimilarity >= threshold
  
  return {
    isDuplicate,
    similarity: highestSimilarity,
    matchingFingerprint: isDuplicate ? matchingFingerprint : undefined,
    matchingTaskId: isDuplicate ? matchingTaskId : undefined,
    reason: isDuplicate 
      ? `Ähnlichkeit ${Math.round(highestSimilarity * 100)}% mit Aufgabe ${matchingTaskId}`
      : undefined
  }
}

// ============================================================================
// Fingerprint Extraction from Tasks
// ============================================================================

/**
 * Create fingerprint from an existing Task object
 */
export function fingerprintFromTask(task: Task | ExamTask): TaskFingerprint {
  const subtasks = 'subtasks' in task ? task.subtasks : undefined
  return createTaskFingerprint(task.question, task.tags, subtasks)
}

/**
 * Build a fingerprint map from an array of tasks
 */
export function buildFingerprintMap(tasks: Array<Task | ExamTask>): Map<string, TaskFingerprint> {
  const map = new Map<string, TaskFingerprint>()
  
  for (const task of tasks) {
    const fp = fingerprintFromTask(task)
    map.set(task.id, fp)
  }
  
  return map
}

// ============================================================================
// Variant Generation Support
// ============================================================================

/**
 * Check if a task could be a variant of another task
 * (same archetype, different specific values)
 */
export function isVariantOf(
  newFingerprint: TaskFingerprint,
  existingFingerprint: TaskFingerprint
): boolean {
  // Must have same topic and archetype
  if (newFingerprint.topic !== existingFingerprint.topic) return false
  if (newFingerprint.archetype !== existingFingerprint.archetype) return false
  
  // But at least one feature should differ
  const f1 = newFingerprint.features
  const f2 = existingFingerprint.features
  
  const sameFeatures = 
    f1.numVariables === f2.numVariables &&
    f1.numSubtasks === f2.numSubtasks &&
    f1.difficulty === f2.difficulty
  
  // If all structural features are the same, it's a duplicate, not a variant
  return !sameFeatures
}

/**
 * Suggest variation strategies for a given archetype
 */
export function getVariationStrategies(archetype: string): string[] {
  const strategies: Record<string, string[]> = {
    'kv-minimization': [
      'Andere Anzahl Variablen (3, 4, 5)',
      'Andere Mintermkombination',
      'Mit/ohne Don\'t-Care-Terme',
      'Mehrere Ausgangsvariablen'
    ],
    'number-conversion': [
      'Andere Zahlenwerte',
      'Andere Zahlensysteme (8, 16, 2)',
      'Bruchzahlen statt Ganzzahlen',
      'Negative Zahlen'
    ],
    'truth-table': [
      'Andere boolesche Funktion',
      'Mehr/weniger Eingangsvariablen',
      'Tabelle vorgegeben, Funktion ableiten',
      'Funktion vorgegeben, Tabelle erstellen'
    ],
    'huffman-coding': [
      'Andere Häufigkeitsverteilung',
      'Andere Alphabetgröße',
      'Dekodierung statt Kodierung',
      'Effizienzberechnung hinzufügen'
    ],
    'automaton-general': [
      'Andere Sprache/Muster',
      'Mealy statt Moore (oder umgekehrt)',
      'NFA zu DFA Konvertierung',
      'Minimierung eines existierenden Automaten'
    ],
    'default': [
      'Andere Eingabewerte',
      'Zusätzliche Teilaufgaben',
      'Höhere/niedrigere Schwierigkeit',
      'Anderes Ausgabeformat'
    ]
  }
  
  return strategies[archetype] || strategies['default']
}

// ============================================================================
// Exports
// ============================================================================

export {
  simpleHash
}
