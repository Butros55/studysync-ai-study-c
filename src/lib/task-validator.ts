/**
 * Task Validator - LLM-based Quality Gate for Generated Tasks
 * 
 * Validates generated tasks before they are saved to ensure:
 * - Question is solvable with given information
 * - All necessary parameters are provided
 * - Solution is consistent with question
 * - Style matches the module's style profiles
 * - Input mode constraints are respected
 * 
 * Includes repair logic: up to 2 repair attempts before regeneration.
 */

import { llmWithRetry } from './llm-utils'
import { devToolsStore } from './devtools-store'
import type { Task, ExamTask, ExamStyleProfile } from './types'
import type { InputMode } from './analysis-types'
import type { 
  ExamStyleProfile as BuilderExamStyleProfile, 
  ExerciseStyleProfile,
  ModuleKnowledgeIndex 
} from './module-profile-builder'
import type { GenerationContextPack } from './generation-context'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of task validation
 */
export interface ValidationResult {
  /** Whether the task passed all checks */
  ok: boolean
  /** List of issues found */
  issues: string[]
  /** Information that is missing from the question */
  missingInfo: string[]
  /** Ways the task doesn't match the style profile */
  styleMismatches: string[]
  /** Whether the task requires drawing (problematic for type mode) */
  requiresDrawing: boolean
  /** Suggested prompt to fix the task */
  suggestedFixPrompt?: string
  /** Confidence score (0-100) */
  confidence: number
  /** Time taken for validation in ms */
  validationTimeMs: number
}

/**
 * Options for task validation
 */
export interface ValidationOptions {
  /** The task to validate */
  task: Task | ExamTask
  /** Context pack used for generation (for knowledge reference) */
  contextPack?: GenerationContextPack
  /** User's preferred input mode */
  preferredInputMode?: InputMode
  /** Exam style profile for style checking */
  examStyleProfile?: BuilderExamStyleProfile | ExamStyleProfile
  /** Exercise style profile for style checking */
  exerciseStyleProfile?: ExerciseStyleProfile
  /** Module knowledge index for completeness checking */
  knowledgeIndex?: ModuleKnowledgeIndex
  /** LLM model to use */
  model?: string
  /** Module ID for logging */
  moduleId?: string
}

/**
 * Options for task repair
 */
export interface RepairOptions extends ValidationOptions {
  /** Validation result from previous check */
  validationResult: ValidationResult
  /** Repair attempt number (1 or 2) */
  attemptNumber: number
}

/**
 * Result of task repair
 */
export interface RepairResult {
  /** Whether repair was successful */
  success: boolean
  /** The repaired task (if successful) */
  repairedTask?: Task | ExamTask
  /** New validation result */
  validationResult: ValidationResult
}

/**
 * Debug report for validator inspection
 */
export interface ValidatorDebugReport {
  originalTask: Task | ExamTask
  validationResult: ValidationResult
  repairAttempts: Array<{
    attemptNumber: number
    prompt: string
    response: string
    newValidation: ValidationResult
    success: boolean
  }>
  finalTask: Task | ExamTask
  wasRepaired: boolean
  wasRegenerated: boolean
  totalTimeMs: number
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a generated task using LLM analysis
 */
export async function validateGeneratedTask(
  options: ValidationOptions
): Promise<ValidationResult> {
  const startTime = Date.now()
  const {
    task,
    contextPack,
    preferredInputMode,
    examStyleProfile,
    exerciseStyleProfile,
    model = 'gpt-4o-mini',
    moduleId
  } = options

  // Build validation prompt
  const prompt = buildValidationPrompt(
    task,
    contextPack,
    preferredInputMode,
    examStyleProfile,
    exerciseStyleProfile
  )

  try {
    const response = await llmWithRetry(
      prompt,
      model,
      true,
      1,
      'task-validation',
      moduleId
    )

    const parsed = JSON.parse(response)
    const result = parseValidationResponse(parsed, preferredInputMode)
    result.validationTimeMs = Date.now() - startTime

    // Log to debug store
    logValidationToDebug('validation', task, result)

    return result
  } catch (error) {
    console.error('[TaskValidator] Validation failed:', error)
    
    // Return a permissive result on error (don't block generation)
    return {
      ok: true,
      issues: [],
      missingInfo: [],
      styleMismatches: [],
      requiresDrawing: false,
      confidence: 0,
      validationTimeMs: Date.now() - startTime
    }
  }
}

/**
 * Build the validation prompt
 */
function buildValidationPrompt(
  task: Task | ExamTask,
  contextPack?: GenerationContextPack,
  preferredInputMode?: InputMode,
  examStyle?: BuilderExamStyleProfile | ExamStyleProfile,
  exerciseStyle?: ExerciseStyleProfile
): string {
  // Build style context
  let styleContext = ''
  
  if (examStyle) {
    const phrases = 'commonPhrases' in examStyle 
      ? examStyle.commonPhrases.slice(0, 5).join('", "')
      : ''
    styleContext += `\n### Erwarteter Klausur-Stil:
- Typische Formulierungen: "${phrases}"
- Verwendet Formeln: ${getFormattingFlag(examStyle, 'usesFormulas')}
- Verwendet Teilaufgaben: ${getFormattingFlag(examStyle, 'usesSubtasks')}`
  }

  if (exerciseStyle) {
    styleContext += `\n### Erwarteter Übungs-Stil:
- Häufige Verben: "${exerciseStyle.commonVerbs?.slice(0, 5).join('", "') || 'keine'}"
- Schritt-für-Schritt-Lösungen: ${exerciseStyle.solutionFormatting?.hasStepByStep ? 'Ja' : 'Nein'}`
  }

  // Build input mode check
  const inputModeCheck = preferredInputMode === 'type'
    ? `\n### WICHTIGE PRÜFUNG:
Der Nutzer verwendet TASTATUREINGABE. Die Aufgabe darf KEINE Zeichnungen, Diagramme, Skizzen oder handschriftlichen Elemente als Lösung erfordern.
Prüfe GENAU, ob die Aufgabe per Tastatur lösbar ist.`
    : ''

  // Build knowledge context (abbreviated)
  let knowledgeHint = ''
  if (contextPack?.availableTopics && contextPack.availableTopics.length > 0) {
    knowledgeHint = `\n### Verfügbare Themen im Modul:
${contextPack.availableTopics.slice(0, 15).join(', ')}`
  }

  return `Du bist ein Qualitätsprüfer für Prüfungsaufgaben.

Analysiere die folgende generierte Aufgabe und bewerte ihre Qualität.

## AUFGABE ZU PRÜFEN

### Frage:
${task.question}

### Musterlösung:
${task.solution}

### Metadaten:
- Schwierigkeit: ${task.difficulty}
- Thema: ${task.topic || 'nicht angegeben'}
- Punkte: ${'points' in task ? task.points : 'nicht angegeben'}
${styleContext}
${inputModeCheck}
${knowledgeHint}

## PRÜFKRITERIEN

1. **Lösbarkeit**: Ist die Frage mit den gegebenen Informationen lösbar?
2. **Vollständigkeit**: Sind alle notwendigen Parameter/Werte angegeben?
3. **Konsistenz**: Passt die Musterlösung zur Fragestellung?
4. **Stil**: Entspricht die Aufgabe dem erwarteten Stil?
5. **Eingabemodus**: Ist die Aufgabe per Tastatur lösbar (falls relevant)?

## ANTWORTFORMAT (JSON)

{
  "ok": true/false,
  "issues": ["Liste der gefundenen Probleme"],
  "missingInfo": ["Fehlende Informationen/Parameter"],
  "styleMismatches": ["Stil-Abweichungen"],
  "requiresDrawing": true/false,
  "suggestedFixPrompt": "Vorschlag zur Behebung (nur wenn nicht ok)",
  "confidence": 0-100
}

Gib NUR das JSON zurück.`
}

/**
 * Helper to get formatting flags from style profiles
 */
function getFormattingFlag(
  style: BuilderExamStyleProfile | ExamStyleProfile,
  flag: string
): string {
  if ('formattingRules' in style) {
    return (style.formattingRules as any)[flag] ? 'Ja' : 'Nein'
  }
  if ('formattingPatterns' in style) {
    return (style.formattingPatterns as any)[flag] ? 'Ja' : 'Nein'
  }
  return 'unbekannt'
}

/**
 * Parse and validate the LLM response
 */
function parseValidationResponse(
  parsed: any,
  preferredInputMode?: InputMode
): ValidationResult {
  const result: ValidationResult = {
    ok: parsed.ok ?? true,
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [],
    styleMismatches: Array.isArray(parsed.styleMismatches) ? parsed.styleMismatches : [],
    requiresDrawing: parsed.requiresDrawing ?? false,
    suggestedFixPrompt: parsed.suggestedFixPrompt,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
    validationTimeMs: 0
  }

  // Force fail if type mode and drawing required
  if (preferredInputMode === 'type' && result.requiresDrawing) {
    result.ok = false
    if (!result.issues.includes('Aufgabe erfordert Zeichnung, aber Tastatureingabe ist eingestellt')) {
      result.issues.push('Aufgabe erfordert Zeichnung, aber Tastatureingabe ist eingestellt')
    }
    if (!result.suggestedFixPrompt) {
      result.suggestedFixPrompt = 'Überarbeite die Aufgabe so, dass sie ohne Zeichnungen oder Diagramme lösbar ist. Ersetze Zeichnungsanforderungen durch Textbeschreibungen oder Berechnungen.'
    }
  }

  return result
}

// ============================================================================
// Repair Logic
// ============================================================================

/**
 * Attempt to repair a task based on validation issues
 */
export async function repairTask(
  options: RepairOptions
): Promise<RepairResult> {
  const {
    task,
    validationResult,
    attemptNumber,
    preferredInputMode,
    examStyleProfile,
    exerciseStyleProfile,
    model = 'gpt-4o-mini',
    moduleId
  } = options

  const prompt = buildRepairPrompt(
    task,
    validationResult,
    attemptNumber,
    preferredInputMode
  )

  try {
    const response = await llmWithRetry(
      prompt,
      model,
      true,
      1,
      'task-repair',
      moduleId
    )

    const parsed = JSON.parse(response)
    
    // Create repaired task
    const repairedTask: Task | ExamTask = {
      ...task,
      question: parsed.question || task.question,
      solution: parsed.solution || task.solution,
      tags: parsed.tags || task.tags
    }

    // Validate the repaired task
    const newValidation = await validateGeneratedTask({
      task: repairedTask,
      preferredInputMode,
      examStyleProfile,
      exerciseStyleProfile,
      model,
      moduleId
    })

    // Log to debug
    logRepairToDebug(attemptNumber, prompt, response, newValidation)

    return {
      success: newValidation.ok,
      repairedTask: newValidation.ok ? repairedTask : undefined,
      validationResult: newValidation
    }
  } catch (error) {
    console.error(`[TaskValidator] Repair attempt ${attemptNumber} failed:`, error)
    return {
      success: false,
      validationResult
    }
  }
}

/**
 * Build the repair prompt
 */
function buildRepairPrompt(
  task: Task | ExamTask,
  validationResult: ValidationResult,
  attemptNumber: number,
  preferredInputMode?: InputMode
): string {
  const issuesList = [
    ...validationResult.issues,
    ...validationResult.missingInfo.map(m => `Fehlende Info: ${m}`),
    ...validationResult.styleMismatches.map(s => `Stil-Problem: ${s}`)
  ].join('\n- ')

  const suggestedFix = validationResult.suggestedFixPrompt
    ? `\n\nVORGESCHLAGENE KORREKTUR:\n${validationResult.suggestedFixPrompt}`
    : ''

  const inputModeWarning = preferredInputMode === 'type' && validationResult.requiresDrawing
    ? '\n\nWICHTIG: Die Aufgabe darf KEINE Zeichnungen, Diagramme oder Skizzen erfordern. Der Nutzer verwendet Tastatureingabe.'
    : ''

  return `Du bist ein Experte für die Korrektur von Prüfungsaufgaben.

## URSPRÜNGLICHE AUFGABE

### Frage:
${task.question}

### Musterlösung:
${task.solution}

## GEFUNDENE PROBLEME (Versuch ${attemptNumber}/2)

- ${issuesList}
${suggestedFix}
${inputModeWarning}

## AUFTRAG

Überarbeite die Aufgabe, um ALLE genannten Probleme zu beheben.
Behalte das Thema und die Schwierigkeit bei.
Stelle sicher, dass die Musterlösung zur korrigierten Frage passt.

## ANTWORTFORMAT (JSON)

{
  "question": "Korrigierte Aufgabenstellung",
  "solution": "Korrigierte Musterlösung",
  "tags": ["tag1", "tag2"]
}

Gib NUR das JSON zurück.`
}

// ============================================================================
// Full Validation Pipeline
// ============================================================================

/**
 * Options for the full validation pipeline
 */
export interface ValidationPipelineOptions extends ValidationOptions {
  /** Maximum repair attempts before regeneration */
  maxRepairAttempts?: number
  /** Callback for regeneration (receives issues to avoid) */
  onRegenerate?: (issuesToAvoid: string[]) => Promise<Task | ExamTask>
  /** Whether to enable debug logging */
  enableDebugReport?: boolean
}

/**
 * Result of the validation pipeline
 */
export interface ValidationPipelineResult {
  /** The final validated task (or original if all attempts failed) */
  task: Task | ExamTask
  /** Whether the task passed validation */
  passed: boolean
  /** Total attempts made */
  totalAttempts: number
  /** Whether the task was repaired */
  wasRepaired: boolean
  /** Whether the task was regenerated */
  wasRegenerated: boolean
  /** Debug report (if enabled) */
  debugReport?: ValidatorDebugReport
}

/**
 * Run the full validation pipeline with repair and regeneration
 */
export async function runValidationPipeline(
  options: ValidationPipelineOptions
): Promise<ValidationPipelineResult> {
  const startTime = Date.now()
  const {
    task,
    maxRepairAttempts = 2,
    onRegenerate,
    enableDebugReport = false,
    ...validationOptions
  } = options

  const debugReport: ValidatorDebugReport = {
    originalTask: task,
    validationResult: {} as ValidationResult,
    repairAttempts: [],
    finalTask: task,
    wasRepaired: false,
    wasRegenerated: false,
    totalTimeMs: 0
  }

  let currentTask = task
  let totalAttempts = 0

  // Step 1: Initial validation
  let validationResult = await validateGeneratedTask({
    ...validationOptions,
    task: currentTask
  })
  debugReport.validationResult = validationResult
  totalAttempts++

  // If passed, return immediately
  if (validationResult.ok) {
    debugReport.finalTask = currentTask
    debugReport.totalTimeMs = Date.now() - startTime
    return {
      task: currentTask,
      passed: true,
      totalAttempts,
      wasRepaired: false,
      wasRegenerated: false,
      debugReport: enableDebugReport ? debugReport : undefined
    }
  }

  // Step 2: Repair attempts
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt++) {
    const repairResult = await repairTask({
      ...validationOptions,
      task: currentTask,
      validationResult,
      attemptNumber: attempt
    })
    totalAttempts++

    if (enableDebugReport) {
      debugReport.repairAttempts.push({
        attemptNumber: attempt,
        prompt: `Repair attempt ${attempt}`,
        response: repairResult.repairedTask ? 'Success' : 'Failed',
        newValidation: repairResult.validationResult,
        success: repairResult.success
      })
    }

    if (repairResult.success && repairResult.repairedTask) {
      debugReport.finalTask = repairResult.repairedTask
      debugReport.wasRepaired = true
      debugReport.totalTimeMs = Date.now() - startTime
      return {
        task: repairResult.repairedTask,
        passed: true,
        totalAttempts,
        wasRepaired: true,
        wasRegenerated: false,
        debugReport: enableDebugReport ? debugReport : undefined
      }
    }

    validationResult = repairResult.validationResult
  }

  // Step 3: Regeneration (if callback provided)
  if (onRegenerate) {
    try {
      const issuesToAvoid = [
        ...validationResult.issues,
        ...validationResult.missingInfo,
        ...validationResult.styleMismatches
      ]

      const regeneratedTask = await onRegenerate(issuesToAvoid)
      totalAttempts++

      // Validate regenerated task
      const regenValidation = await validateGeneratedTask({
        ...validationOptions,
        task: regeneratedTask
      })

      if (regenValidation.ok) {
        debugReport.finalTask = regeneratedTask
        debugReport.wasRegenerated = true
        debugReport.totalTimeMs = Date.now() - startTime
        return {
          task: regeneratedTask,
          passed: true,
          totalAttempts,
          wasRepaired: false,
          wasRegenerated: true,
          debugReport: enableDebugReport ? debugReport : undefined
        }
      }

      // Even if regeneration validation failed, use it as it's likely better
      currentTask = regeneratedTask
    } catch (error) {
      console.error('[TaskValidator] Regeneration failed:', error)
    }
  }

  // Step 4: Return best effort (original or last repaired version)
  debugReport.finalTask = currentTask
  debugReport.totalTimeMs = Date.now() - startTime

  // Log warning for failed validation
  console.warn('[TaskValidator] Task validation failed after all attempts:', {
    issues: validationResult.issues,
    missingInfo: validationResult.missingInfo,
    totalAttempts
  })

  return {
    task: currentTask,
    passed: false,
    totalAttempts,
    wasRepaired: false,
    wasRegenerated: false,
    debugReport: enableDebugReport ? debugReport : undefined
  }
}

// ============================================================================
// Debug Logging
// ============================================================================

/**
 * Log validation result to debug store
 */
function logValidationToDebug(
  type: 'validation' | 'repair',
  task: Task | ExamTask,
  result: ValidationResult
): void {
  devToolsStore.addLog({
    startedAt: Date.now(),
    durationMs: result.validationTimeMs ?? 0,
    request: {
      url: 'local://task-validation',
      method: 'POST',
      body: {
        type,
        question: task.question,
      },
    },
    response: {
      status: result.ok ? 200 : 400,
      body: result,
      textPreview: result.issues?.join('; ') || (result.ok ? 'ok' : 'validation failed'),
    },
    llm: {
      operation: 'task-validation',
    },
  })
}

/**
 * Log repair attempt to debug store
 */
function logRepairToDebug(
  attemptNumber: number,
  prompt: string,
  response: string,
  validation: ValidationResult
): void {
  devToolsStore.addLog({
    startedAt: Date.now(),
    durationMs: validation.validationTimeMs ?? 0,
    request: {
      url: 'local://task-repair',
      method: 'POST',
      body: {
        attemptNumber,
        prompt,
      },
    },
    response: {
      status: validation.ok ? 200 : 400,
      body: {
        response,
        validation,
      },
      textPreview: response.slice(0, 600),
    },
    llm: {
      operation: 'task-repair',
    },
  })
}

// ============================================================================
// Utility: Quick Validation Check (for UI indicators)
// ============================================================================

/**
 * Quick check if a task likely needs validation
 * (Heuristic-based, no LLM call)
 */
export function quickValidationCheck(
  task: Task | ExamTask,
  preferredInputMode?: InputMode
): { needsValidation: boolean; potentialIssues: string[] } {
  const issues: string[] = []

  // Check for empty content
  if (!task.question || task.question.length < 20) {
    issues.push('Frage zu kurz')
  }
  if (!task.solution || task.solution.length < 10) {
    issues.push('Lösung zu kurz')
  }

  // Check for drawing keywords when type mode is set
  if (preferredInputMode === 'type') {
    const drawingKeywords = [
      'zeichnen', 'skizzieren', 'diagramm', 'grafik', 
      'zeichnung', 'graph', 'kurve zeichnen', 'schaubild'
    ]
    const questionLower = task.question.toLowerCase()
    for (const keyword of drawingKeywords) {
      if (questionLower.includes(keyword)) {
        issues.push(`Möglicherweise Zeichnung erforderlich: "${keyword}"`)
      }
    }
  }

  // Check for placeholder text
  const placeholders = ['[TODO]', '[PLATZHALTER]', 'XXX', '???']
  for (const placeholder of placeholders) {
    if (task.question.includes(placeholder) || task.solution.includes(placeholder)) {
      issues.push(`Platzhalter gefunden: ${placeholder}`)
    }
  }

  return {
    needsValidation: issues.length > 0,
    potentialIssues: issues
  }
}
