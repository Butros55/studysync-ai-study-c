/**
 * Generation Context Builder
 * 
 * Builds rich context packs for LLM-based task/exam generation using
 * the analyzed document data and module profiles.
 * 
 * IMPORTANT:
 * - Uses pre-analyzed JSON data, NOT raw script content
 * - Automatically manages context size with compression/selection
 * - Integrates user's preferred input mode for constraint generation
 */

import { getModuleProfile, listDocumentAnalyses } from './analysis-storage'
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
import { llmWithRetry } from './llm-utils'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum characters for the context pack before compression/selection kicks in
 * Set high to maximize context, but prevent token overflow
 */
export const MAX_CONTEXT_CHARS = 25000

/**
 * Target size after compression (if needed)
 */
const COMPRESSED_TARGET_CHARS = 15000

/**
 * Minimum context size to include knowledge items
 */
const MIN_KNOWLEDGE_ITEMS = 10

// ============================================================================
// Types
// ============================================================================

export type GenerationTarget = 'single-task' | 'exam-tasks' | 'flashcards'

export interface GenerationContextOptions {
  /** Module ID to load context for */
  moduleId: string
  
  /** What kind of content is being generated */
  target: GenerationTarget
  
  /** User's preferred input mode (affects task constraints) */
  preferredInputMode?: InputMode
  
  /** Optional topic hints to prioritize in knowledge retrieval */
  topicHints?: string[]
  
  /** Optional specific difficulty to filter for */
  difficulty?: 'easy' | 'medium' | 'hard'
  
  /** LLM model to use for compression (if needed) */
  model?: string
}

export interface GenerationContextPack {
  /** Whether the module has analyzed data */
  hasAnalyzedData: boolean
  
  /** Coverage percentage (0-100) */
  coveragePercent: number
  
  /** The formatted context text for embedding in prompts */
  contextText: string
  
  /** Size of the context in characters */
  contextChars: number
  
  /** Whether compression was applied */
  wasCompressed: boolean
  
  /** Additional constraints based on input mode */
  inputModeConstraints: string
  
  /** Available topics for topic-based filtering */
  availableTopics: string[]
  
  /** Exam style summary (if available) */
  examStyleSummary?: string
  
  /** Exercise style summary (if available) */
  exerciseStyleSummary?: string
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build a generation context pack for LLM prompts
 * 
 * This function:
 * 1. Loads the module profile and document analyses
 * 2. Formats the analyzed data into structured context
 * 3. Applies size limits with compression/selection as needed
 * 4. Adds input mode constraints
 */
export async function buildGenerationContext(
  options: GenerationContextOptions
): Promise<GenerationContextPack> {
  const {
    moduleId,
    target,
    preferredInputMode,
    topicHints = [],
    model = 'gpt-4o-mini'
  } = options

  // Load module profile and analyses
  const [profile, analyses] = await Promise.all([
    getModuleProfile(moduleId),
    listDocumentAnalyses(moduleId)
  ])

  // Parse profiles if available
  const examStyle = profile ? parseExamStyleProfile(profile) : null
  const exerciseStyle = profile ? parseExerciseStyleProfile(profile) : null
  const knowledgeIndex = profile ? parseModuleKnowledgeIndex(profile) : null

  // Filter to completed analyses
  const completedAnalyses = analyses.filter(a => a.status === 'done' && a.analysisJson)
  
  // Calculate coverage
  const coveragePercent = analyses.length > 0 
    ? Math.round((completedAnalyses.length / analyses.length) * 100)
    : 0

  // If no analyzed data, return minimal context
  if (completedAnalyses.length === 0 && !knowledgeIndex) {
    return {
      hasAnalyzedData: false,
      coveragePercent: 0,
      contextText: '',
      contextChars: 0,
      wasCompressed: false,
      inputModeConstraints: buildInputModeConstraints(preferredInputMode),
      availableTopics: [],
    }
  }

  // Build context sections
  const sections: string[] = []

  // 1. Knowledge Index Section (from scripts)
  if (knowledgeIndex && knowledgeIndex.allTopics.length > 0) {
    const knowledgeSection = buildKnowledgeSection(knowledgeIndex, topicHints)
    sections.push(knowledgeSection)
  }

  // 2. Exam Style Section
  let examStyleSummary: string | undefined
  if (examStyle && examStyle.sourceDocumentCount > 0) {
    examStyleSummary = buildExamStyleSection(examStyle)
    sections.push(examStyleSummary)
  }

  // 3. Exercise Style Section
  let exerciseStyleSummary: string | undefined
  if (exerciseStyle && exerciseStyle.sourceDocumentCount > 0) {
    exerciseStyleSummary = buildExerciseStyleSection(exerciseStyle)
    sections.push(exerciseStyleSummary)
  }

  // 4. Topic-specific evidence (from document analyses)
  if (topicHints.length > 0 && knowledgeIndex) {
    const evidenceSection = buildTopicEvidenceSection(
      completedAnalyses, 
      knowledgeIndex, 
      topicHints
    )
    if (evidenceSection) {
      sections.push(evidenceSection)
    }
  }

  // Combine sections
  let contextText = sections.join('\n\n---\n\n')
  let wasCompressed = false

  // Check size and compress if needed
  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = await compressContext(contextText, COMPRESSED_TARGET_CHARS, model, moduleId)
    wasCompressed = true
  }

  // Build input mode constraints
  const inputModeConstraints = buildInputModeConstraints(preferredInputMode)

  return {
    hasAnalyzedData: true,
    coveragePercent,
    contextText,
    contextChars: contextText.length,
    wasCompressed,
    inputModeConstraints,
    availableTopics: knowledgeIndex?.allTopics || [],
    examStyleSummary,
    exerciseStyleSummary,
  }
}

// ============================================================================
// Section Builders
// ============================================================================

/**
 * Build the knowledge index section from script analyses
 */
function buildKnowledgeSection(
  index: ModuleKnowledgeIndex,
  priorityTopics: string[] = []
): string {
  const lines: string[] = ['## WISSENSBASIS (aus analysierten Skripten)']

  // Topics with priority sorting
  if (index.allTopics.length > 0) {
    lines.push('\n### Themen:')
    
    // Sort topics: priority topics first, then by frequency
    const sortedTopics = [...index.allTopics].sort((a, b) => {
      const aIsPriority = priorityTopics.some(pt => 
        a.toLowerCase().includes(pt.toLowerCase())
      )
      const bIsPriority = priorityTopics.some(pt => 
        b.toLowerCase().includes(pt.toLowerCase())
      )
      
      if (aIsPriority && !bIsPriority) return -1
      if (!aIsPriority && bIsPriority) return 1
      
      const aFreq = index.topicFrequency[a] || 0
      const bFreq = index.topicFrequency[b] || 0
      return bFreq - aFreq
    })

    // Include top topics
    const topTopics = sortedTopics.slice(0, 30)
    for (const topic of topTopics) {
      const freq = index.topicFrequency[topic] || 1
      lines.push(`- ${topic}${freq > 1 ? ` (${freq}x)` : ''}`)
    }
  }

  // Definitions
  if (index.definitions.length > 0) {
    lines.push('\n### Wichtige Definitionen/Konzepte:')
    const defs = index.definitions.slice(0, 20)
    for (const def of defs) {
      if (def.definition) {
        lines.push(`- **${def.term}**: ${def.definition}`)
      } else {
        lines.push(`- ${def.term}`)
      }
    }
  }

  // Formulas
  if (index.formulas.length > 0) {
    lines.push('\n### Wichtige Formeln:')
    const formulas = index.formulas.slice(0, 15)
    for (const f of formulas) {
      if (f.description) {
        lines.push(`- ${f.description}: $${f.latex}$`)
      } else {
        lines.push(`- $${f.latex}$`)
      }
    }
  }

  // Procedures
  if (index.procedures.length > 0) {
    lines.push('\n### Verfahren/Algorithmen:')
    const procs = index.procedures.slice(0, 10)
    for (const p of procs) {
      if (p.description) {
        lines.push(`- **${p.name}**: ${p.description}`)
      } else {
        lines.push(`- ${p.name}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Build the exam style section
 */
function buildExamStyleSection(style: ExamStyleProfile): string {
  const lines: string[] = ['## KLAUSUR-STIL (aus analysierten Probeklausuren)']

  if (style.commonPhrases.length > 0) {
    lines.push(`\n### Typische Formulierungen:`)
    lines.push(`"${style.commonPhrases.slice(0, 8).join('", "')}"`)
  }

  lines.push(`\n### Punkteverteilung:`)
  lines.push(`- Durchschnitt: ${style.scoringPatterns.averagePointsPerTask.toFixed(1)} Punkte pro Aufgabe`)
  lines.push(`- Bereich: ${style.scoringPatterns.minPoints}-${style.scoringPatterns.maxPoints} Punkte`)

  lines.push(`\n### Schwierigkeitsverteilung:`)
  lines.push(`- Einfach: ${style.difficultyMix.easy}%`)
  lines.push(`- Mittel: ${style.difficultyMix.medium}%`)
  lines.push(`- Schwer: ${style.difficultyMix.hard}%`)

  lines.push(`\n### Formatierung:`)
  const formats: string[] = []
  if (style.formattingRules.usesFormulas) formats.push('mathematische Formeln')
  if (style.formattingRules.usesSubtasks) formats.push('Teilaufgaben')
  if (style.formattingRules.usesTables) formats.push('Tabellen')
  if (style.formattingRules.usesMultipleChoice) formats.push('Multiple-Choice')
  if (formats.length > 0) {
    lines.push(`Verwendet: ${formats.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Build the exercise style section
 */
function buildExerciseStyleSection(style: ExerciseStyleProfile): string {
  const lines: string[] = ['## ÜBUNGS-STIL (aus analysierten Übungsblättern)']

  if (style.commonVerbs.length > 0) {
    lines.push(`\n### Häufige Verben in Aufgabenstellungen:`)
    lines.push(`"${style.commonVerbs.slice(0, 10).join('", "')}"`)
  }

  if (style.typicalPhrases.length > 0) {
    lines.push(`\n### Typische Formulierungen:`)
    lines.push(`"${style.typicalPhrases.slice(0, 6).join('", "')}"`)
  }

  lines.push(`\n### Struktur:`)
  if (style.subtaskPatterns.usesSubtasks) {
    lines.push(`- Verwendet Teilaufgaben (Ø ${style.subtaskPatterns.averageSubtasksPerExercise.toFixed(1)} pro Übung)`)
    if (style.subtaskPatterns.usesLetterSubtasks) lines.push(`- Format: a), b), c)`)
    if (style.subtaskPatterns.usesNumberedSubtasks) lines.push(`- Format: 1., 2., 3.`)
  }

  lines.push(`\n### Lösungsformatierung:`)
  const formats: string[] = []
  if (style.solutionFormatting.hasStepByStep) formats.push('Schritt-für-Schritt')
  if (style.solutionFormatting.usesFormulas) formats.push('Formeln')
  if (style.solutionFormatting.usesCodeBlocks) formats.push('Code-Blöcke')
  if (formats.length > 0) {
    lines.push(`Verwendet: ${formats.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Build topic-specific evidence section from document analyses
 */
function buildTopicEvidenceSection(
  analyses: DocumentAnalysisRecord[],
  index: ModuleKnowledgeIndex,
  topics: string[]
): string | null {
  // Find documents related to the topics using inverted index
  const relevantDocs = new Set<string>()
  
  for (const topic of topics) {
    const topicLower = topic.toLowerCase()
    
    // Check inverted index
    for (const [indexTopic, docs] of Object.entries(index.topicIndex)) {
      if (indexTopic.toLowerCase().includes(topicLower) || 
          topicLower.includes(indexTopic.toLowerCase())) {
        for (const doc of docs) {
          relevantDocs.add(doc.documentId)
        }
      }
    }
  }

  if (relevantDocs.size === 0) return null

  // Get evidence from relevant documents
  const evidenceItems: string[] = []
  
  for (const analysis of analyses) {
    if (!relevantDocs.has(analysis.documentId)) continue
    
    try {
      const parsed = JSON.parse(analysis.analysisJson!) as MergedDocumentAnalysis
      
      // Collect relevant definitions
      if (parsed.definitions) {
        for (const def of parsed.definitions) {
          if (topics.some(t => 
            def.value.toLowerCase().includes(t.toLowerCase()) ||
            t.toLowerCase().includes(def.value.toLowerCase())
          )) {
            evidenceItems.push(`Definition: ${def.value}`)
          }
        }
      }
      
      // Collect relevant formulas
      if (parsed.formulas) {
        for (const formula of parsed.formulas) {
          evidenceItems.push(`Formel: ${formula.value}`)
        }
      }
      
      // Collect relevant examples
      if (parsed.examples) {
        for (const ex of parsed.examples.slice(0, 3)) {
          evidenceItems.push(`Beispiel: ${ex.value}`)
        }
      }
    } catch (e) {
      // Skip malformed JSON
    }
  }

  if (evidenceItems.length === 0) return null

  const lines: string[] = ['## THEMENSPEZIFISCHE EVIDENZ']
  lines.push(`\nFür Themen: ${topics.join(', ')}\n`)
  
  for (const item of evidenceItems.slice(0, 20)) {
    lines.push(`- ${item}`)
  }

  return lines.join('\n')
}

// ============================================================================
// Input Mode Constraints
// ============================================================================

/**
 * Build constraints text based on user's input mode preference
 */
function buildInputModeConstraints(mode?: InputMode): string {
  if (!mode) return ''
  
  if (mode === 'type') {
    return `
EINGABE-EINSCHRÄNKUNG:
Der Nutzer verwendet TASTATUREINGABE. Generiere daher:
- KEINE Aufgaben, die Zeichnungen oder Diagramme als Lösung erfordern
- KEINE Aufgaben, bei denen handschriftliche Skizzen nötig sind
- Aufgaben sollten durch Texteingabe, Formeln oder Code lösbar sein
- Graphen, Schaltpläne oder Freihandzeichnungen VERMEIDEN`
  }
  
  if (mode === 'draw') {
    return `
EINGABE-HINWEIS:
Der Nutzer verwendet STIFTEINGABE (handschriftlich/Zeichnen).
- Aufgaben mit Diagrammen, Skizzen und handschriftlichen Lösungen sind geeignet
- Formeln können handschriftlich gelöst werden`
  }
  
  return ''
}

// ============================================================================
// Context Compression
// ============================================================================

/**
 * Compress context using LLM while preserving factual content
 */
async function compressContext(
  context: string,
  targetChars: number,
  model: string,
  moduleId: string
): Promise<string> {
  const compressionRatio = targetChars / context.length
  
  const prompt = `Du bist ein Experte für Wissenskomprimierung.

Komprimiere den folgenden Kontext auf etwa ${Math.round(compressionRatio * 100)}% der ursprünglichen Länge.

WICHTIGE REGELN:
1. BEHALTE alle faktischen Informationen (Definitionen, Formeln, Verfahren)
2. ENTFERNE Redundanzen und Wiederholungen
3. KÜRZE Beschreibungen, aber behalte den Kern
4. BEHALTE die Struktur (Überschriften, Listen)
5. PRIORISIERE: Formeln > Definitionen > Verfahren > Beispiele

URSPRÜNGLICHER KONTEXT:
${context}

GIB NUR DEN KOMPRIMIERTEN KONTEXT ZURÜCK, KEINE ERKLÄRUNGEN.`

  try {
    const compressed = await llmWithRetry(
      prompt, 
      model, 
      false, 
      1, 
      'context-compression',
      moduleId
    )
    
    // Validate compression didn't fail
    if (compressed.length > 100 && compressed.length < context.length) {
      return compressed
    }
    
    // Fallback: simple truncation with priority sections
    return truncateWithPriority(context, targetChars)
  } catch (error) {
    console.error('[GenerationContext] Compression failed:', error)
    return truncateWithPriority(context, targetChars)
  }
}

/**
 * Fallback truncation that prioritizes important sections
 */
function truncateWithPriority(context: string, targetChars: number): string {
  // Split into sections
  const sections = context.split('\n\n---\n\n')
  
  // Priority order: Knowledge > Exam Style > Exercise Style > Evidence
  const prioritized: string[] = []
  let currentLength = 0
  
  for (const section of sections) {
    if (currentLength + section.length <= targetChars) {
      prioritized.push(section)
      currentLength += section.length
    } else {
      // Truncate this section to fit
      const remaining = targetChars - currentLength
      if (remaining > 500) {
        prioritized.push(section.substring(0, remaining) + '\n\n[... gekürzt]')
      }
      break
    }
  }
  
  return prioritized.join('\n\n---\n\n')
}

// ============================================================================
// Topic-based Retrieval (for per-task context)
// ============================================================================

/**
 * Get context for a specific topic (for multi-task generation)
 * Uses the inverted index to retrieve only relevant knowledge
 */
export async function getTopicSpecificContext(
  moduleId: string,
  topic: string,
  maxChars: number = 5000
): Promise<string> {
  const [profile, analyses] = await Promise.all([
    getModuleProfile(moduleId),
    listDocumentAnalyses(moduleId)
  ])

  const knowledgeIndex = profile ? parseModuleKnowledgeIndex(profile) : null
  if (!knowledgeIndex) return ''

  const completedAnalyses = analyses.filter(a => a.status === 'done' && a.analysisJson)
  
  const evidenceSection = buildTopicEvidenceSection(
    completedAnalyses,
    knowledgeIndex,
    [topic]
  )

  if (!evidenceSection) {
    // Fallback: just include topic from knowledge index
    const topicLines: string[] = [`## Kontext für: ${topic}`]
    
    // Find related definitions
    for (const def of knowledgeIndex.definitions) {
      if (def.term.toLowerCase().includes(topic.toLowerCase())) {
        topicLines.push(`- **${def.term}**: ${def.definition || ''}`)
      }
    }
    
    // Find related formulas
    for (const formula of knowledgeIndex.formulas) {
      if (formula.description?.toLowerCase().includes(topic.toLowerCase())) {
        topicLines.push(`- Formel: ${formula.description} - $${formula.latex}$`)
      }
    }

    return topicLines.slice(0, 20).join('\n')
  }

  return evidenceSection.length > maxChars 
    ? evidenceSection.substring(0, maxChars) + '\n[...]'
    : evidenceSection
}

// ============================================================================
// Utility: Format context for prompt embedding
// ============================================================================

/**
 * Format the generation context for embedding in an LLM prompt
 */
export function formatContextForPrompt(pack: GenerationContextPack): string {
  if (!pack.hasAnalyzedData) {
    return ''
  }

  const parts: string[] = []

  if (pack.contextText) {
    parts.push('=== MODUL-KONTEXT (aus analysiertem Material) ===')
    parts.push(pack.contextText)
    parts.push('=== ENDE MODUL-KONTEXT ===')
  }

  if (pack.inputModeConstraints) {
    parts.push(pack.inputModeConstraints)
  }

  if (pack.wasCompressed) {
    parts.push('\n[Hinweis: Kontext wurde komprimiert, alle Kernfakten sind enthalten]')
  }

  return parts.join('\n\n')
}
