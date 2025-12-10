/**
 * Code Execution Tasks Prompt Template
 * 
 * Used for generating interactive code execution tasks for Software Engineering modules.
 * These tasks include:
 * - Code with step-by-step execution visualization
 * - Variable state tracking
 * - Output prediction tasks
 * - Bug finding exercises
 * 
 * PROMPT VERSION: 1.0.0
 */

export const CODE_TASKS_PROMPT_VERSION = '1.0.0'

export interface CodeTaskPromptParams {
  /** Topic name */
  topicName: string
  /** Programming language */
  language: 'javascript' | 'typescript' | 'python' | 'java' | 'c' | 'cpp' | 'pseudo'
  /** Topic evidence snippets from scripts */
  evidenceSnippets: string[]
  /** Target difficulty */
  difficulty: 'easy' | 'medium' | 'hard'
  /** Type of code task */
  codeTaskType: 'predict_output' | 'find_bug' | 'trace_variables' | 'explain_logic'
  /** Relevant concepts from module */
  concepts: string[]
  /** Avoid list - existing similar tasks */
  avoidList: Array<{ question: string; topic: string }>
}

/**
 * Build the code task generation prompt
 */
export function buildCodeTaskPrompt(params: CodeTaskPromptParams): string {
  const {
    topicName,
    language,
    evidenceSnippets,
    difficulty,
    codeTaskType,
    concepts,
    avoidList
  } = params

  const difficultyGuidelines = getCodeDifficultyGuidelines(difficulty)
  const taskTypeGuidelines = getCodeTaskTypeGuidelines(codeTaskType)
  const languageInfo = getLanguageInfo(language)
  
  // Build context section
  const contextSection = buildCodeContextSection(topicName, evidenceSnippets, concepts)
  
  // Build avoid list section
  const avoidSection = buildCodeAvoidSection(avoidList)

  return `Du bist ein erfahrener Informatik-Dozent. Erstelle EINE interaktive Code-Aufgabe zum Thema "${topicName}".

THEMEN-KONTEXT:
${contextSection}

PROGRAMMIERSPRACHE: ${language.toUpperCase()}
${languageInfo}

SCHWIERIGKEIT: ${difficulty.toUpperCase()}
${difficultyGuidelines}

AUFGABENTYP: ${codeTaskType}
${taskTypeGuidelines}

BEREITS EXISTIERENDE ÄHNLICHE AUFGABEN (VERMEIDE DIESE):
${avoidSection}

WICHTIGE REGELN FÜR CODE-AUFGABEN:
1. Der Code muss KORREKT und LAUFFÄHIG sein (außer bei find_bug)
2. Maximal 15-20 Zeilen Code
3. Klare Variablennamen verwenden
4. Für jeden Ausführungsschritt: Zeilennummer, Variablenzustand, ggf. Konsolenausgabe
5. Der Code soll das Konzept "${topicName}" praktisch demonstrieren
6. Kommentare im Code nur wo nötig für Verständnis
7. Bei "predict_output": Der User muss die Ausgabe vorhersagen
8. Bei "find_bug": GENAU EIN Fehler im Code, der zum Thema passt
9. Bei "trace_variables": Variablen-Tracking durch den Code
10. Bei "explain_logic": Code erklären und verstehen

ANTWORTE NUR MIT VALIDEM JSON:
{
  "task": {
    "question": "Kurze, klare Fragestellung zur Code-Aufgabe",
    "solution": "Erklärung der Lösung mit erwarteter Ausgabe",
    "difficulty": "${difficulty}",
    "topic": "${topicName}",
    "tags": ["${language}", "tag2", "tag3"],
    "codeExecution": {
      "language": "${language}",
      "code": "// Vollständiger Code hier\\nlet x = 5;\\nconsole.log(x);",
      "executionSteps": [
        {
          "lineNumber": 1,
          "content": "let x = 5;",
          "variableState": { "x": 5 },
          "explanation": "Variable x wird mit Wert 5 initialisiert"
        },
        {
          "lineNumber": 2,
          "content": "console.log(x);",
          "variableState": { "x": 5 },
          "consoleOutput": "5",
          "explanation": "Gibt den Wert von x (5) auf der Konsole aus"
        }
      ],
      "expectedOutput": "5",
      "userTask": "${codeTaskType}"
    }
  }
}

Gib NUR das JSON zurück, keine weiteren Erklärungen.`
}

function getCodeDifficultyGuidelines(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return `- 5-10 Zeilen Code
- Einfache Variablen und Operationen
- Lineare Ausführung (keine komplexen Verzweigungen)
- Maximal 1 Schleife oder Bedingung`
    case 'medium':
      return `- 10-15 Zeilen Code
- Schleifen und Bedingungen kombiniert
- Arrays/Listen mit einfachen Operationen
- 2-3 wichtige Konzepte demonstrieren`
    case 'hard':
      return `- 15-20 Zeilen Code
- Verschachtelte Strukturen
- Rekursion oder komplexe Algorithmen
- Mehrere Konzepte kombiniert`
  }
}

function getCodeTaskTypeGuidelines(taskType: CodeTaskPromptParams['codeTaskType']): string {
  switch (taskType) {
    case 'predict_output':
      return `AUFGABE: User soll die Ausgabe vorhersagen
- Code wird Schritt für Schritt ausgeführt
- User sieht Variablen-Änderungen
- Am Ende: "Was gibt das Programm aus?"
- Fokus auf Verständnis des Programmflusses`
    case 'find_bug':
      return `AUFGABE: User soll einen Fehler im Code finden
- Der Code enthält GENAU EINEN logischen Fehler
- Der Fehler sollte zum Thema passen
- Syntax ist korrekt, aber Logik falsch
- Fehler sollte durch Programmausführung sichtbar werden`
    case 'trace_variables':
      return `AUFGABE: User soll Variablenwerte verfolgen
- Frage nach Wert einer Variable nach bestimmter Zeile
- Mehrere Variablen die sich gegenseitig beeinflussen
- Fokus auf Verständnis von Zuweisungen und Berechnungen`
    case 'explain_logic':
      return `AUFGABE: User soll erklären, was der Code macht
- Code ohne Kommentare präsentieren
- User muss Algorithmus/Logik erkennen
- "Was berechnet dieser Code?" oder "Was ist der Zweck?"
- Fokus auf Konzeptverständnis`
  }
}

function getLanguageInfo(language: CodeTaskPromptParams['language']): string {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return `- Verwende console.log() für Ausgabe
- let/const für Variablen
- Moderne ES6+ Syntax bevorzugt`
    case 'python':
      return `- Verwende print() für Ausgabe
- Einrückung mit 4 Spaces
- Python 3 Syntax`
    case 'java':
      return `- Verwende System.out.println() für Ausgabe
- Vollständige Klassen-Struktur nicht nötig (nur relevanter Code)
- Typen explizit angeben`
    case 'c':
    case 'cpp':
      return `- Verwende printf() für Ausgabe
- Typen explizit angeben
- Kein vollständiges main() nötig`
    case 'pseudo':
      return `- Verwende PRINT/OUTPUT für Ausgabe
- Klare deutsche Schlüsselwörter (WENN, DANN, SONST, FÜR, SOLANGE)
- := für Zuweisung
- Einfache, verständliche Syntax`
  }
}

function buildCodeContextSection(
  topicName: string,
  evidenceSnippets: string[],
  concepts: string[]
): string {
  const parts: string[] = []
  
  parts.push(`Thema: ${topicName}`)
  
  if (evidenceSnippets.length > 0) {
    parts.push('\nRelevante Inhalte aus dem Skript:')
    evidenceSnippets.slice(0, 3).forEach((s, i) => parts.push(`${i + 1}. ${s.substring(0, 200)}...`))
  }
  
  if (concepts.length > 0) {
    parts.push('\nZu demonstrierende Konzepte:')
    concepts.forEach(c => parts.push(`- ${c}`))
  }
  
  return parts.join('\n')
}

function buildCodeAvoidSection(avoidList: Array<{ question: string; topic: string }>): string {
  if (avoidList.length === 0) {
    return '(Keine existierenden Aufgaben zu diesem Thema)'
  }
  
  return avoidList
    .slice(0, 5)
    .map((task, i) => `${i + 1}. [${task.topic}] ${task.question.substring(0, 80)}...`)
    .join('\n')
}

/**
 * Parse the LLM response for a code task
 */
export function parseCodeTaskResponse(response: string): {
  success: boolean
  task?: {
    question: string
    solution: string
    difficulty: 'easy' | 'medium' | 'hard'
    topic: string
    tags: string[]
    codeExecution: {
      language: 'javascript' | 'typescript' | 'python' | 'java' | 'c' | 'cpp' | 'pseudo'
      code: string
      executionSteps: Array<{
        lineNumber: number
        content: string
        variableState?: Record<string, unknown>
        consoleOutput?: string
        explanation?: string
      }>
      expectedOutput?: string
      userTask?: 'predict_output' | 'find_bug' | 'trace_variables' | 'explain_logic'
    }
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
    
    if (!task.question || !task.solution || !task.codeExecution) {
      return { success: false, error: 'Task missing question, solution, or codeExecution' }
    }
    
    const codeExec = task.codeExecution
    
    if (!codeExec.language || !codeExec.code) {
      return { success: false, error: 'codeExecution missing language or code' }
    }
    
    return {
      success: true,
      task: {
        question: task.question,
        solution: task.solution,
        difficulty: task.difficulty || 'medium',
        topic: task.topic || '',
        tags: Array.isArray(task.tags) ? task.tags : [],
        codeExecution: {
          language: codeExec.language,
          code: codeExec.code,
          executionSteps: Array.isArray(codeExec.executionSteps) ? codeExec.executionSteps : [],
          expectedOutput: codeExec.expectedOutput,
          userTask: codeExec.userTask
        }
      }
    }
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e}` }
  }
}

/**
 * Detect if a module is likely a Software Engineering module
 * based on topic names and content
 */
export function detectSoftwareEngineeringModule(topics: string[]): boolean {
  const seKeywords = [
    'software', 'programmier', 'code', 'algorithmus', 'datenstruktur',
    'objektorient', 'oop', 'klasse', 'methode', 'funktion', 'variable',
    'schleife', 'bedingung', 'array', 'liste', 'rekursion', 'sortier',
    'such', 'baum', 'graph', 'stack', 'queue', 'hash', 'pointer',
    'referenz', 'speicher', 'heap', 'komplex', 'laufzeit', 'big-o',
    'debug', 'test', 'pattern', 'design', 'architektur', 'uml',
    'java', 'python', 'javascript', 'c++', 'typescript'
  ]
  
  const topicsLower = topics.map(t => t.toLowerCase()).join(' ')
  
  return seKeywords.some(keyword => topicsLower.includes(keyword))
}

/**
 * Detect programming language from module content
 */
export function detectProgrammingLanguage(content: string): CodeTaskPromptParams['language'] {
  const contentLower = content.toLowerCase()
  
  // Check for language-specific patterns
  if (contentLower.includes('system.out.println') || contentLower.includes('public class')) {
    return 'java'
  }
  if (contentLower.includes('console.log') || contentLower.includes('const ') || contentLower.includes('let ')) {
    return 'javascript'
  }
  if (contentLower.includes('print(') && !contentLower.includes('printf')) {
    return 'python'
  }
  if (contentLower.includes('printf') || contentLower.includes('#include')) {
    return 'c'
  }
  if (contentLower.includes('cout') || contentLower.includes('std::')) {
    return 'cpp'
  }
  
  // Default to pseudo code if no specific language detected
  return 'pseudo'
}
