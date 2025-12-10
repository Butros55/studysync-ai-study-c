/**
 * Exam Blueprint Prompt Template
 * 
 * Used for planning exam task distribution across topics.
 * This is Stage A of the exam generation pipeline.
 * 
 * PROMPT VERSION: 1.0.0
 */

export const EXAM_BLUEPRINT_PROMPT_VERSION = '1.0.0'

export interface ExamBlueprintPromptParams {
  /** Module ID */
  moduleId: string
  /** All available topics with their weights */
  topics: Array<{ name: string; weight: number; docCount: number }>
  /** Exam duration in minutes */
  duration: number
  /** Target number of tasks */
  taskCount: number
  /** Total points */
  totalPoints: number
  /** Difficulty distribution */
  difficultyMix: { easy: number; medium: number; hard: number }
  /** User's weak topics to prioritize */
  weakTopics: string[]
  /** Available task types */
  availableTaskTypes: string[]
  /** Input mode constraints */
  preferredInputMode?: 'type' | 'draw'
}

/**
 * Build the exam blueprint planning prompt
 */
export function buildExamBlueprintPrompt(params: ExamBlueprintPromptParams): string {
  const {
    topics,
    duration,
    taskCount,
    totalPoints,
    difficultyMix,
    weakTopics,
    availableTaskTypes,
    preferredInputMode
  } = params

  const topicsSection = topics
    .map(t => `- ${t.name} (Gewicht: ${t.weight}, Dokumente: ${t.docCount})`)
    .join('\n')

  const weakTopicsSection = weakTopics.length > 0
    ? `\n\nSCHWACHE THEMEN (Priorisieren!):\n${weakTopics.map(t => `- ${t}`).join('\n')}`
    : ''

  const inputConstraint = preferredInputMode === 'type'
    ? '\n\nWICHTIG: Keine Zeichen-/Diagrammaufgaben - nur Textantworten!'
    : ''

  return `Du bist ein Experte für Prüfungsplanung. Erstelle einen Blueprint für eine Klausur.

PRÜFUNGSPARAMETER:
- Dauer: ${duration} Minuten
- Aufgaben: ${taskCount}
- Gesamtpunkte: ${totalPoints}
- Schwierigkeit: ${Math.round(difficultyMix.easy * 100)}% leicht, ${Math.round(difficultyMix.medium * 100)}% mittel, ${Math.round(difficultyMix.hard * 100)}% schwer

VERFÜGBARE THEMEN:
${topicsSection}
${weakTopicsSection}

VERFÜGBARE AUFGABENTYPEN:
${availableTaskTypes.map(t => `- ${t}`).join('\n')}
${inputConstraint}

REGELN FÜR DIE VERTEILUNG:
1. ALLE wichtigen Themen abdecken (nach Gewicht)
2. Schwache Themen des Studenten priorisieren
3. Sinnvolle Punkteverteilung (schwer = mehr Punkte)
4. Zeitlich machbar (ca. ${Math.round(duration / taskCount)} Min/Aufgabe)
5. Variation in Aufgabentypen

ANTWORTE MIT JSON:
{
  "blueprint": [
    {
      "taskIndex": 0,
      "topic": "Themenname",
      "subtopics": ["Unterthema1", "Unterthema2"],
      "difficulty": "easy|medium|hard",
      "points": 10,
      "targetMinutes": 5,
      "taskType": "calculation|proof|open-question|multiple-choice|code|diagram|mixed",
      "answerMode": "type|draw|either"
    }
  ],
  "reasoning": "Kurze Begründung der Verteilung"
}

Gib NUR das JSON zurück.`
}

/**
 * Parse the exam blueprint response
 */
export function parseExamBlueprintResponse(response: string): {
  success: boolean
  blueprint?: Array<{
    taskIndex: number
    topic: string
    subtopics: string[]
    difficulty: 'easy' | 'medium' | 'hard'
    points: number
    targetMinutes: number
    taskType: string
    answerMode: 'type' | 'draw' | 'either'
  }>
  reasoning?: string
  error?: string
} {
  try {
    let jsonStr = response.trim()
    
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    
    const parsed = JSON.parse(jsonStr)
    
    if (!parsed.blueprint || !Array.isArray(parsed.blueprint)) {
      return { success: false, error: 'Response missing "blueprint" array' }
    }
    
    // Validate and normalize each item
    const blueprint = parsed.blueprint.map((item: any, index: number) => ({
      taskIndex: item.taskIndex ?? index,
      topic: item.topic || 'Allgemein',
      subtopics: Array.isArray(item.subtopics) ? item.subtopics : [],
      difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
      points: typeof item.points === 'number' ? item.points : 10,
      targetMinutes: typeof item.targetMinutes === 'number' ? item.targetMinutes : 5,
      taskType: item.taskType || 'open-question',
      answerMode: ['type', 'draw', 'either'].includes(item.answerMode) ? item.answerMode : 'either'
    }))
    
    return {
      success: true,
      blueprint,
      reasoning: parsed.reasoning
    }
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e}` }
  }
}
