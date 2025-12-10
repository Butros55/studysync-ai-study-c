/**
 * Exam Task Prompt Template
 * 
 * Used for generating individual exam tasks based on blueprint.
 * This is Stage B of the exam generation pipeline.
 * 
 * PROMPT VERSION: 1.0.0
 */

export const EXAM_TASK_PROMPT_VERSION = '1.0.0'

export interface ExamTaskPromptParams {
  /** Blueprint item for this task */
  blueprint: {
    taskIndex: number
    topic: string
    subtopics: string[]
    difficulty: 'easy' | 'medium' | 'hard'
    points: number
    targetMinutes: number
    taskType: string
    answerMode: 'type' | 'draw' | 'either'
  }
  /** Topic-specific context */
  topicContext: {
    definitions: string[]
    formulas: string[]
    procedures: string[]
    evidenceSnippets: string[]
  }
  /** Exam style profile */
  styleProfile: {
    commonPhrases: string[]
    formattingPatterns: {
      usesTables?: boolean
      usesFormulas?: boolean
      usesSubtasks?: boolean
    }
  }
  /** Previously generated tasks (for this exam) to avoid duplicates */
  previousTasks: Array<{ question: string; topic: string }>
  /** Existing tasks from the module to avoid */
  avoidList: Array<{ question: string; topic: string }>
}

/**
 * Build the exam task generation prompt
 */
export function buildExamTaskPrompt(params: ExamTaskPromptParams): string {
  const {
    blueprint,
    topicContext,
    styleProfile,
    previousTasks,
    avoidList
  } = params

  // Build context section
  const contextSection = buildTopicContextSection(topicContext)
  
  // Build style section
  const styleSection = buildStyleSection(styleProfile)
  
  // Build avoid section
  const avoidSection = buildAvoidSection([...previousTasks, ...avoidList])

  const difficultyGuidelines = getDifficultyGuidelines(blueprint.difficulty, blueprint.points)
  const taskTypeGuidelines = getTaskTypeGuidelines(blueprint.taskType)

  return `Du bist ein erfahrener Professor. Erstelle eine Klausuraufgabe im universitären Stil.

AUFGABEN-BLUEPRINT:
- Thema: ${blueprint.topic}
- Unterthemen: ${blueprint.subtopics.join(', ') || 'keine'}
- Schwierigkeit: ${blueprint.difficulty}
- Punkte: ${blueprint.points}
- Zeit: ca. ${blueprint.targetMinutes} Minuten
- Aufgabentyp: ${blueprint.taskType}
- Antwortmodus: ${blueprint.answerMode}

THEMEN-KONTEXT:
${contextSection}

STIL-VORGABEN:
${styleSection}

SCHWIERIGKEITS-RICHTLINIEN:
${difficultyGuidelines}

AUFGABENTYP-RICHTLINIEN:
${taskTypeGuidelines}

BEREITS EXISTIERENDE AUFGABEN (VERMEIDE ÄHNLICHE):
${avoidSection}

WICHTIGE REGELN:
1. Die Aufgabe muss EXAKT zum Thema "${blueprint.topic}" passen
2. Punkte und Zeitaufwand müssen realistisch sein
3. Nutze den universitären Stil aus den Stil-Vorgaben
4. Teilaufgaben mit a), b), c) kennzeichnen
5. Alles auf DEUTSCH
6. KEINE Nummerierung vor der Aufgabe (keine "1.", "Aufgabe 1:" etc.)

ANTWORTE MIT JSON:
{
  "task": {
    "question": "### Aufgabentitel (${blueprint.points} Punkte)\\n\\nAufgabentext...",
    "solution": "Musterlösung mit Punkteverteilung...",
    "difficulty": "${blueprint.difficulty}",
    "topic": "${blueprint.topic}",
    "tags": ["tag1", "tag2"],
    "points": ${blueprint.points},
    "subtasks": [
      {"title": "a)", "prompt": "Teilaufgabe a", "points": 5}
    ]
  }
}

Gib NUR das JSON zurück.`
}

function buildTopicContextSection(context: ExamTaskPromptParams['topicContext']): string {
  const parts: string[] = []
  
  if (context.definitions.length > 0) {
    parts.push('Definitionen:')
    context.definitions.forEach(d => parts.push(`- ${d}`))
  }
  
  if (context.formulas.length > 0) {
    parts.push('\nFormeln:')
    context.formulas.forEach(f => parts.push(`- ${f}`))
  }
  
  if (context.procedures.length > 0) {
    parts.push('\nVerfahren:')
    context.procedures.forEach(p => parts.push(`- ${p}`))
  }
  
  if (context.evidenceSnippets.length > 0) {
    parts.push('\nWeiterer Kontext:')
    context.evidenceSnippets.slice(0, 3).forEach(s => parts.push(`- ${s}`))
  }
  
  return parts.length > 0 ? parts.join('\n') : '(Kein spezifischer Kontext verfügbar)'
}

function buildStyleSection(style: ExamTaskPromptParams['styleProfile']): string {
  const parts: string[] = []
  
  if (style.commonPhrases.length > 0) {
    parts.push(`Typische Formulierungen: ${style.commonPhrases.slice(0, 5).join(', ')}`)
  }
  
  const formatting = []
  if (style.formattingPatterns.usesTables) formatting.push('Tabellen')
  if (style.formattingPatterns.usesFormulas) formatting.push('LaTeX-Formeln')
  if (style.formattingPatterns.usesSubtasks) formatting.push('Teilaufgaben')
  
  if (formatting.length > 0) {
    parts.push(`Formatierung: ${formatting.join(', ')}`)
  }
  
  return parts.length > 0 ? parts.join('\n') : '(Standard-Stil)'
}

function buildAvoidSection(avoidList: Array<{ question: string; topic: string }>): string {
  if (avoidList.length === 0) {
    return '(Keine)'
  }
  
  return avoidList
    .slice(0, 10)
    .map((task, i) => `${i + 1}. [${task.topic}] ${task.question.substring(0, 80)}...`)
    .join('\n')
}

function getDifficultyGuidelines(difficulty: 'easy' | 'medium' | 'hard', points: number): string {
  switch (difficulty) {
    case 'easy':
      return `- Einfache Anwendung von Grundwissen
- 1-2 Lösungsschritte
- ${points} Punkte = ca. ${Math.round(points * 0.5)} Min Bearbeitungszeit`
    case 'medium':
      return `- Verständnis und Transfer erforderlich
- 2-4 Lösungsschritte
- ${points} Punkte = ca. ${Math.round(points * 0.7)} Min Bearbeitungszeit`
    case 'hard':
      return `- Komplexe Problemstellung
- Mehrere Konzepte kombinieren
- ${points} Punkte = ca. ${Math.round(points * 1.0)} Min Bearbeitungszeit`
  }
}

function getTaskTypeGuidelines(taskType: string): string {
  const guidelines: Record<string, string> = {
    'calculation': '- Konkrete Berechnung mit Zahlen\n- Lösungsweg zeigen\n- Zwischenergebnisse angeben',
    'proof': '- Mathematischer Beweis oder Herleitung\n- Logische Schritte\n- Vollständige Argumentation',
    'open-question': '- Freie Textantwort\n- Erklärung oder Diskussion\n- Eigene Formulierung',
    'multiple-choice': '- 4 Antwortmöglichkeiten\n- Genau EINE richtig\n- Plausible Distraktoren',
    'code': '- Programmieraufgabe\n- Pseudocode oder echte Sprache\n- Kommentare erwünscht',
    'diagram': '- Diagramm oder Zeichnung\n- Beschriftung erforderlich\n- Klare Legende',
    'mixed': '- Kombination verschiedener Typen\n- Mehrere Teilaufgaben\n- Aufeinander aufbauend'
  }
  
  return guidelines[taskType] || '- Standard-Aufgabenformat'
}

/**
 * Parse the exam task response
 */
export function parseExamTaskResponse(response: string): {
  success: boolean
  task?: {
    question: string
    solution: string
    difficulty: 'easy' | 'medium' | 'hard'
    topic: string
    tags: string[]
    points: number
    subtasks?: Array<{ title: string; prompt: string; points: number }>
  }
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
        points: typeof task.points === 'number' ? task.points : 10,
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : undefined
      }
    }
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e}` }
  }
}
