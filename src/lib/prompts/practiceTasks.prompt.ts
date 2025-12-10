/**
 * Practice Tasks Prompt Template
 * 
 * Used for generating individual practice tasks (Übungsaufgaben).
 * This is SEPARATE from exam generation and flashcard generation.
 * 
 * PROMPT VERSION: 1.0.0
 */

export const PRACTICE_TASKS_PROMPT_VERSION = '1.0.0'

export interface PracticeTaskPromptParams {
  /** Topic name */
  topicName: string
  /** Topic evidence snippets */
  evidenceSnippets: string[]
  /** Target difficulty */
  difficulty: 'easy' | 'medium' | 'hard'
  /** Question type */
  questionType: 'definition' | 'apply' | 'compare' | 'debug' | 'mcq' | 'transfer' | 'calculation'
  /** Relevant definitions from module */
  definitions: string[]
  /** Relevant formulas from module */
  formulas: string[]
  /** Input mode constraints */
  inputModeConstraints: string
  /** Allowed tags for consistency */
  allowedTags: string[]
  /** Avoid list - existing similar tasks */
  avoidList: Array<{ question: string; topic: string }>
  /** Issues from previous generation attempts to avoid */
  issuesToAvoid?: string[]
}

/**
 * Build the practice task generation prompt
 */
export function buildPracticeTaskPrompt(params: PracticeTaskPromptParams): string {
  const {
    topicName,
    evidenceSnippets,
    difficulty,
    questionType,
    definitions,
    formulas,
    inputModeConstraints,
    allowedTags,
    avoidList,
    issuesToAvoid
  } = params

  const difficultyGuidelines = getDifficultyGuidelines(difficulty)
  const questionTypeGuidelines = getQuestionTypeGuidelines(questionType)
  
  // Build context section
  const contextSection = buildContextSection(topicName, evidenceSnippets, definitions, formulas)
  
  // Build avoid list section
  const avoidSection = buildAvoidSection(avoidList)
  
  // Build issues section if regenerating
  const issuesSection = issuesToAvoid && issuesToAvoid.length > 0
    ? `\n\nWICHTIG - VERMEIDE DIESE PROBLEME:\n${issuesToAvoid.map(i => `- ${i}`).join('\n')}`
    : ''
  
  // Build allowed tags section
  const tagsSection = allowedTags.length > 0
    ? `\n\nERLAUBTE TAGS (verwende nur diese):\n${allowedTags.join(', ')}`
    : ''

  return `Du bist ein erfahrener Universitätsdozent. Erstelle EINE präzise Übungsaufgabe zum Thema "${topicName}".

THEMEN-KONTEXT:
${contextSection}

SCHWIERIGKEIT: ${difficulty.toUpperCase()}
${difficultyGuidelines}

AUFGABENTYP: ${questionType}
${questionTypeGuidelines}
${inputModeConstraints}
${tagsSection}

BEREITS EXISTIERENDE ÄHNLICHE AUFGABEN (VERMEIDE DIESE):
${avoidSection}
${issuesSection}

WICHTIGE REGELN:
1. Erstelle eine NEUE, EINZIGARTIGE Aufgabe - KEINE Kopie der existierenden!
2. Die Aufgabe muss zum Thema "${topicName}" passen
3. Aufgabentext NIEMALS mit Nummerierung beginnen (keine "1.", "2." etc.)
4. Teilaufgaben NUR mit a), b), c) kennzeichnen
5. Antwort muss KURZ und PRÄZISE sein
6. Alles auf DEUTSCH

ANTWORTE NUR MIT VALIDEM JSON:
{
  "task": {
    "question": "### Kurzer Titel\\n\\nKlare, präzise Aufgabenstellung",
    "solution": "Strukturierte Lösung mit Erklärung",
    "difficulty": "${difficulty}",
    "topic": "${topicName}",
    "tags": ["tag1", "tag2"],
    "topicId": "wird-vom-system-gesetzt"
  }
}

Gib NUR das JSON zurück, keine weiteren Erklärungen.`
}

function getDifficultyGuidelines(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return `- Lösungszeit: 1-2 Minuten
- Direktes Anwenden einer Definition oder Formel
- Keine verschachtelten Schritte
- Klare, eindeutige Antwort`
    case 'medium':
      return `- Lösungszeit: 3-5 Minuten
- 2-3 Lösungsschritte erforderlich
- Kann Transfer zwischen Konzepten erfordern
- Maximal 2 Teilaufgaben`
    case 'hard':
      return `- Lösungszeit: 5-10 Minuten
- Mehrere Konzepte kombinieren
- Komplexere Berechnung oder Beweis
- Maximal 3 Teilaufgaben`
  }
}

function getQuestionTypeGuidelines(questionType: PracticeTaskPromptParams['questionType']): string {
  switch (questionType) {
    case 'definition':
      return `- Frage nach Definition, Eigenschaften oder Unterscheidungsmerkmalen
- "Was ist...", "Definiere...", "Erkläre den Begriff..."`
    case 'apply':
      return `- Anwendungsaufgabe mit konkreten Werten
- Berechnung oder Durchführung eines Verfahrens`
    case 'compare':
      return `- Vergleich zweier Konzepte oder Methoden
- "Vergleiche...", "Was ist der Unterschied zwischen..."`
    case 'debug':
      return `- Fehler finden und korrigieren
- "Finde den Fehler in...", "Korrigiere..."`
    case 'mcq':
      return `- Multiple-Choice mit 4 Optionen
- Genau EINE richtige Antwort
- Plausible Distraktoren`
    case 'transfer':
      return `- Konzept auf neue Situation anwenden
- "Wie würdest du... einsetzen für..."`
    case 'calculation':
      return `- Konkrete Berechnung mit Zahlen
- Lösungsweg zeigen`
  }
}

function buildContextSection(
  topicName: string,
  evidenceSnippets: string[],
  definitions: string[],
  formulas: string[]
): string {
  const parts: string[] = []
  
  parts.push(`Thema: ${topicName}`)
  
  if (evidenceSnippets.length > 0) {
    parts.push('\nRelevante Inhalte:')
    evidenceSnippets.forEach((s, i) => parts.push(`${i + 1}. ${s}`))
  }
  
  if (definitions.length > 0) {
    parts.push('\nDefinitionen:')
    definitions.forEach(d => parts.push(`- ${d}`))
  }
  
  if (formulas.length > 0) {
    parts.push('\nFormeln:')
    formulas.forEach(f => parts.push(`- ${f}`))
  }
  
  return parts.join('\n')
}

function buildAvoidSection(avoidList: Array<{ question: string; topic: string }>): string {
  if (avoidList.length === 0) {
    return '(Keine existierenden Aufgaben zu diesem Thema)'
  }
  
  return avoidList
    .map((task, i) => `${i + 1}. [${task.topic}] ${task.question.substring(0, 100)}...`)
    .join('\n')
}

/**
 * Parse the LLM response for a practice task
 */
export function parsePracticeTaskResponse(response: string): {
  success: boolean
  task?: {
    question: string
    solution: string
    difficulty: 'easy' | 'medium' | 'hard'
    topic: string
    tags: string[]
    topicId?: string
  }
  error?: string
} {
  try {
    // Try to extract JSON from response
    let jsonStr = response.trim()
    
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    
    const parsed = JSON.parse(jsonStr)
    
    if (!parsed.task) {
      return { success: false, error: 'Response missing "task" object' }
    }
    
    const task = parsed.task
    
    if (!task.question || !task.solution) {
      return { success: false, error: 'Task missing question or solution' }
    }
    
    return {
      success: true,
      task: {
        question: task.question,
        solution: task.solution,
        difficulty: task.difficulty || 'medium',
        topic: task.topic || '',
        tags: Array.isArray(task.tags) ? task.tags : [],
        topicId: task.topicId
      }
    }
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e}` }
  }
}
