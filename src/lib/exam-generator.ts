/**
 * Exam Style Extraction & Task Generation
 * 
 * UPDATED: Now uses the multi-stage blueprint pipeline for improved quality.
 * 
 * WICHTIG: 
 * - Nutzt analysierte JSON-Daten statt roher Skript-Inhalte
 * - Blueprint-System verteilt Aufgaben über ALLE Themen/Skripte
 * - Keine arbiträren Limits mehr (max 3 scripts, 3000 char truncation)
 * - Unterstützt Input-Mode-Constraints (keine Zeichen-Aufgaben bei Tastatur-Modus)
 */

import { Script, ExamStyleProfile, ExamSubtaskPattern, ExamTask, Task, TopicStats } from './types'
import { llmWithRetry } from './llm-utils'
import { generateId } from './utils-app'
import { 
  buildGenerationContext, 
  formatContextForPrompt, 
  getTopicSpecificContext,
  MAX_CONTEXT_CHARS 
} from './generation-context'
import { getUserPreferencePreferredInputMode } from './analysis-storage'
import type { InputMode } from './analysis-types'
import { 
  generateExamTasksWithBlueprint, 
  type BlueprintOptions,
  type ExamBlueprint 
} from './exam-blueprint'

// ============================================
// Stil-Extraktion aus Probeklausuren
// ============================================

/**
 * Extrahiert das Stilprofil aus einer oder mehreren Probeklausuren
 * 
 * NOTE: This is now mostly used as a fallback. The primary path uses
 * cached ModuleProfileRecord.examStyleProfileJson via the blueprint system.
 */
export async function extractExamStyle(
  sampleExamFiles: Script[],
  model: string = 'gpt-4o-mini'
): Promise<ExamStyleProfile> {
  if (sampleExamFiles.length === 0) {
    // Fallback-Profil wenn keine Probeklausuren vorhanden
    return getDefaultExamStyleProfile()
  }

  const examContents = sampleExamFiles
    .map((f) => `--- Probeklausur: ${f.name} ---\n${f.content}`)
    .join('\n\n')

  const prompt = `Du bist ein Experte für die Analyse von Universitätsprüfungen.

Analysiere die folgenden Probeklausuren und extrahiere ein Stilprofil.

PROBEKLAUSUREN:
${examContents}

Analysiere und gib ein JSON-Objekt zurück mit folgender Struktur:
{
  "commonPhrases": ["typische Formulierungen wie 'Begründen Sie...', 'Berechnen Sie...'"],
  "typicalDifficultyMix": { "easy": 0.3, "medium": 0.5, "hard": 0.2 },
  "typicalStructures": [
    {
      "type": "calculation|multiple-choice|open-question|proof|code|diagram|table",
      "description": "Kurze Beschreibung des Aufgabentyps",
      "pointsRange": [min, max],
      "frequency": 0.3
    }
  ],
  "topicDistribution": { "Thema1": 0.4, "Thema2": 0.3 },
  "formattingPatterns": {
    "usesTables": true/false,
    "usesFormulas": true/false,
    "usesLongText": true/false,
    "usesMultipleChoice": true/false,
    "usesSubtasks": true/false
  },
  "averageTaskCount": 5,
  "averagePointsPerTask": 10
}

Gib NUR das JSON zurück, keine weiteren Erklärungen.`

  try {
    const response = await llmWithRetry(prompt, model, true, 2, 'exam-style-extraction')
    const profile = JSON.parse(response) as ExamStyleProfile
    return validateExamStyleProfile(profile)
  } catch (error) {
    console.error('Fehler bei Stil-Extraktion:', error)
    return getDefaultExamStyleProfile()
  }
}

/**
 * Validiert und vervollständigt ein ExamStyleProfile
 */
function validateExamStyleProfile(profile: Partial<ExamStyleProfile>): ExamStyleProfile {
  return {
    commonPhrases: profile.commonPhrases || ['Berechnen Sie', 'Begründen Sie', 'Erklären Sie'],
    typicalDifficultyMix: profile.typicalDifficultyMix || { easy: 0.4, medium: 0.4, hard: 0.2 },
    typicalStructures: profile.typicalStructures || [],
    topicDistribution: profile.topicDistribution || {},
    formattingPatterns: {
      usesTables: profile.formattingPatterns?.usesTables ?? false,
      usesFormulas: profile.formattingPatterns?.usesFormulas ?? true,
      usesLongText: profile.formattingPatterns?.usesLongText ?? false,
      usesMultipleChoice: profile.formattingPatterns?.usesMultipleChoice ?? false,
      usesSubtasks: profile.formattingPatterns?.usesSubtasks ?? true,
    },
    averageTaskCount: profile.averageTaskCount || 5,
    averagePointsPerTask: profile.averagePointsPerTask || 10,
  }
}

/**
 * Standard-Stilprofil falls keine Probeklausuren vorhanden
 */
function getDefaultExamStyleProfile(): ExamStyleProfile {
  return {
    commonPhrases: [
      'Berechnen Sie',
      'Begründen Sie Ihre Antwort',
      'Erklären Sie',
      'Zeigen Sie',
      'Bestimmen Sie',
      'Geben Sie an',
    ],
    typicalDifficultyMix: { easy: 0.4, medium: 0.4, hard: 0.2 },
    typicalStructures: [
      {
        type: 'calculation',
        description: 'Berechnungsaufgaben mit Formeln',
        pointsRange: [5, 15],
        frequency: 0.4,
      },
      {
        type: 'open-question',
        description: 'Offene Verständnisfragen',
        pointsRange: [3, 10],
        frequency: 0.3,
      },
      {
        type: 'proof',
        description: 'Beweise und Herleitungen',
        pointsRange: [10, 20],
        frequency: 0.2,
      },
      {
        type: 'multiple-choice',
        description: 'Multiple-Choice Fragen',
        pointsRange: [1, 3],
        frequency: 0.1,
      },
    ],
    topicDistribution: {},
    formattingPatterns: {
      usesTables: false,
      usesFormulas: true,
      usesLongText: false,
      usesMultipleChoice: false,
      usesSubtasks: true,
    },
    averageTaskCount: 5,
    averagePointsPerTask: 10,
  }
}

// ============================================
// Stilbasierte Aufgabengenerierung
// ============================================

interface ModuleData {
  scripts: Script[]           // Wissensbasis (wird jetzt aus analysierten Daten gezogen)
  exercises: Script[]         // Übungsblätter (nur für Struktur)
  solutions: Script[]         // Lösungen (nur für Struktur)
  exams: Script[]             // Probeklausuren (nur für Stil)
  topicStats?: TopicStats[]   // Schwachstellen des Nutzers
}

/**
 * Generiert eine neue Aufgabe im Stil der Probeklausuren
 * 
 * WICHTIG: Nutzt analysierte JSON-Daten statt roher Skript-Inhalte!
 */
export async function generateStyledExamTask(
  style: ExamStyleProfile,
  moduleData: ModuleData,
  difficulty: 'easy' | 'medium' | 'hard',
  moduleId: string,
  model: string = 'gpt-4o-mini',
  preferredInputMode?: InputMode
): Promise<ExamTask> {
  // Schwache Themen priorisieren
  const weakTopics = moduleData.topicStats
    ?.filter((t) => t.correct < t.incorrect)
    .map((t) => t.topic)
    .slice(0, 3) || []

  // Build rich context from analyzed module data
  const contextPack = await buildGenerationContext({
    moduleId,
    target: 'exam-tasks',
    preferredInputMode,
    topicHints: weakTopics,
    difficulty,
    model,
  })

  // Format context for prompt
  const moduleContext = formatContextForPrompt(contextPack)

  // Fallback to raw script content if no analyzed data
  let contentSection: string
  if (contextPack.hasAnalyzedData) {
    contentSection = moduleContext
  } else {
    // Legacy fallback: use raw script content
    // NOTE: This path is deprecated. The blueprint pipeline should be used instead.
    // We still limit to prevent context overflow, but use ALL available scripts
    const allScripts = moduleData.scripts.filter(s => s.category === 'script' || !s.category)
    const maxCharsPerScript = Math.floor(15000 / Math.max(allScripts.length, 1))
    const scriptContents = allScripts
      .map((s) => `--- ${s.name} ---\n${s.content.substring(0, maxCharsPerScript)}`)
      .join('\n\n')
    contentSection = `WISSENSBASIS (aus Skripten):\n${scriptContents || 'Keine Skripte verfügbar.'}`
  }

  const phraseExamples = style.commonPhrases.slice(0, 5).join('", "')
  const structureType = selectRandomStructure(style.typicalStructures)

  // Build input mode constraints
  const inputModeConstraint = preferredInputMode === 'type'
    ? `\nEINGABE-EINSCHRÄNKUNG: Der Nutzer verwendet TASTATUREINGABE. Generiere KEINE Aufgaben, die Zeichnungen, Diagramme oder handschriftliche Skizzen als Lösung erfordern. Aufgaben müssen durch Texteingabe, Formeln oder Code lösbar sein.`
    : ''

  const systemMessage = `Du bist ein Universitätsprofessor, der Prüfungsaufgaben erstellt.

WICHTIG - STRIKTE REGELN:
1. Generiere NEUE, ORIGINALE Aufgaben basierend auf der Wissensbasis.
2. Kopiere NIEMALS existierende Aufgaben.
3. Nutze die bereitgestellten Themen, Definitionen und Formeln.

STIL-VORGABEN:
- Typische Formulierungen: "${phraseExamples}"
- Aufgabentyp: ${structureType?.type || 'open-question'} - ${structureType?.description || 'offene Frage'}
- Verwende ${style.formattingPatterns.usesFormulas ? 'mathematische Formeln in LaTeX' : 'wenig Formeln'}
- ${style.formattingPatterns.usesSubtasks ? 'Unterteile in Teilaufgaben a), b), c)' : 'Eine zusammenhängende Aufgabe'}
${style.formattingPatterns.usesTables ? '- Nutze Tabellen wo sinnvoll' : ''}

SCHWIERIGKEIT: ${difficulty === 'easy' ? 'Einfach - grundlegendes Verständnis' : difficulty === 'medium' ? 'Mittel - Anwendung und Transfer' : 'Schwer - komplexe Analyse und Synthese'}

${weakTopics.length > 0 ? `PRIORISIERTE THEMEN (Schwachstellen des Nutzers): ${weakTopics.join(', ')}` : ''}${inputModeConstraint}`

  const prompt = `${systemMessage}

${contentSection}

Erstelle eine ${difficulty === 'easy' ? 'einfache' : difficulty === 'medium' ? 'mittelschwere' : 'schwere'} Prüfungsaufgabe.

Antworte im JSON-Format:
{
  "question": "Die vollständige Aufgabenstellung mit Teilaufgaben",
  "solution": "Ausführliche Musterlösung",
  "topic": "Hauptthema der Aufgabe",
  "tags": ["tag1", "tag2"],
  "points": 10
}

Gib NUR das JSON zurück.`

  try {
    const response = await llmWithRetry(prompt, model, true, 2, 'exam-task-generation', moduleId)
    const parsed = JSON.parse(response)

    const examTask: ExamTask = {
      id: generateId(),
      moduleId,
      question: parsed.question,
      solution: parsed.solution,
      difficulty,
      topic: parsed.topic || 'Allgemein',
      tags: parsed.tags || [],
      points: parsed.points || getDefaultPoints(difficulty),
      createdAt: new Date().toISOString(),
      completed: false,
      examStatus: 'unanswered',
    }

    return examTask
  } catch (error) {
    console.error('Fehler bei Aufgabengenerierung:', error)
    // Fallback-Aufgabe
    return createFallbackTask(moduleId, difficulty)
  }
}

/**
 * Generiert mehrere Aufgaben für eine Prüfung
 * 
 * UPDATED: Now uses the multi-stage blueprint pipeline for better quality.
 * - Stage A: Creates a blueprint over the full knowledge index
 * - Stage B: Generates each task with topic-specific retrieval
 * - Stage C: Uses cached style profiles (no re-extraction needed)
 * 
 * This ensures ALL scripts contribute without context overflow.
 */
export async function generateExamTasks(
  style: ExamStyleProfile,
  moduleData: ModuleData,
  moduleId: string,
  count: number,
  difficultyMix: { easy: number; medium: number; hard: number },
  model: string = 'gpt-4o-mini',
  onProgress?: (current: number, total: number) => void,
  preferredInputMode?: InputMode,
  duration: number = 90 // Default 90 minutes exam
): Promise<ExamTask[]> {
  // Load input mode if not provided
  const inputMode = preferredInputMode ?? await getUserPreferencePreferredInputMode()
  
  // Extract weak topics from module stats
  const weakTopics = moduleData.topicStats
    ?.filter((t) => t.correct < t.incorrect)
    .map((t) => t.topic)
    .slice(0, 5) || []

  // Use the new blueprint pipeline
  try {
    const blueprintOptions: BlueprintOptions = {
      moduleId,
      duration,
      taskCount: count,
      difficultyMix,
      preferredInputMode: inputMode,
      weakTopics,
      model
    }

    const { tasks } = await generateExamTasksWithBlueprint(
      blueprintOptions,
      (current, total, phase) => {
        // Map blueprint progress (0-10%) and task progress (10-100%) to task count
        if (phase === 'blueprint') {
          // Don't report blueprint phase to keep original API
        } else {
          const taskIndex = Math.floor((current - 10) / 90 * count)
          onProgress?.(Math.min(taskIndex + 1, count), count)
        }
      }
    )

    return tasks
  } catch (error) {
    console.error('[generateExamTasks] Blueprint pipeline failed, falling back to legacy:', error)
    // Fallback to legacy generation if blueprint fails
    return generateExamTasksLegacy(style, moduleData, moduleId, count, difficultyMix, model, onProgress, inputMode)
  }
}

/**
 * Legacy exam task generation (fallback)
 * 
 * @deprecated Use generateExamTasks with blueprint pipeline instead
 */
async function generateExamTasksLegacy(
  style: ExamStyleProfile,
  moduleData: ModuleData,
  moduleId: string,
  count: number,
  difficultyMix: { easy: number; medium: number; hard: number },
  model: string = 'gpt-4o-mini',
  onProgress?: (current: number, total: number) => void,
  inputMode?: InputMode
): Promise<ExamTask[]> {
  const tasks: ExamTask[] = []
  
  // Berechne Anzahl pro Schwierigkeit
  const easyCount = Math.round(count * difficultyMix.easy)
  const mediumCount = Math.round(count * difficultyMix.medium)
  const hardCount = Math.max(0, count - easyCount - mediumCount)

  const difficulties: ('easy' | 'medium' | 'hard')[] = [
    ...Array(easyCount).fill('easy'),
    ...Array(mediumCount).fill('medium'),
    ...Array(hardCount).fill('hard'),
  ]

  // Mische die Reihenfolge
  for (let i = difficulties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[difficulties[i], difficulties[j]] = [difficulties[j], difficulties[i]]
  }

  for (let i = 0; i < difficulties.length; i++) {
    const difficulty = difficulties[i]
    try {
      const task = await generateStyledExamTask(style, moduleData, difficulty, moduleId, model, inputMode)
      tasks.push(task)
      onProgress?.(i + 1, difficulties.length)
    } catch (error) {
      console.error(`Fehler bei Aufgabe ${i + 1}:`, error)
      // Fallback-Aufgabe hinzufügen
      tasks.push(createFallbackTask(moduleId, difficulty))
      onProgress?.(i + 1, difficulties.length)
    }
    
    // Kleine Pause zwischen Aufgaben für Rate Limiting
    if (i < difficulties.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return tasks
}

// ============================================
// Hilfsfunktionen
// ============================================

function selectRandomStructure(structures: ExamSubtaskPattern[]): ExamSubtaskPattern | undefined {
  if (structures.length === 0) return undefined
  
  // Gewichtete Auswahl basierend auf Frequenz
  const totalWeight = structures.reduce((sum, s) => sum + s.frequency, 0)
  let random = Math.random() * totalWeight
  
  for (const structure of structures) {
    random -= structure.frequency
    if (random <= 0) return structure
  }
  
  return structures[0]
}

function getDefaultPoints(difficulty: 'easy' | 'medium' | 'hard'): number {
  switch (difficulty) {
    case 'easy': return 5
    case 'medium': return 10
    case 'hard': return 15
  }
}

function createFallbackTask(moduleId: string, difficulty: 'easy' | 'medium' | 'hard'): ExamTask {
  return {
    id: generateId(),
    moduleId,
    question: 'Aufgabe konnte nicht generiert werden. Bitte versuche es erneut.',
    solution: 'Keine Lösung verfügbar.',
    difficulty,
    topic: 'Fallback',
    tags: [],
    points: getDefaultPoints(difficulty),
    createdAt: new Date().toISOString(),
    completed: false,
    examStatus: 'unanswered',
  }
}

// ============================================
// Aufgabenbewertung für Prüfungsmodus
// ============================================

export async function evaluateExamAnswer(
  task: ExamTask,
  model: string = 'gpt-4o-mini'
): Promise<{ isCorrect: boolean; earnedPoints: number; feedback: string }> {
  if (!task.userAnswer && !task.canvasDataUrl) {
    return {
      isCorrect: false,
      earnedPoints: 0,
      feedback: 'Keine Antwort eingereicht.',
    }
  }

  const prompt = `Du bist ein Prüfer, der Klausurantworten bewertet.

AUFGABE:
${task.question}

MUSTERLÖSUNG:
${task.solution}

ANTWORT DES STUDENTEN:
${task.userAnswer || '[Handschriftliche Antwort - Bewertung basierend auf Inhalt]'}

MAXIMALE PUNKTE: ${task.points || 10}

Bewerte die Antwort und gib ein JSON zurück:
{
  "isCorrect": true/false,
  "earnedPoints": number,
  "feedback": "Konstruktives Feedback zur Antwort"
}

isCorrect = true wenn mindestens 50% der Punkte erreicht wurden.
Gib NUR das JSON zurück.`

  try {
    const response = await llmWithRetry(prompt, model, true, 1, 'exam-evaluation', task.moduleId)
    return JSON.parse(response)
  } catch (error) {
    console.error('Fehler bei Bewertung:', error)
    return {
      isCorrect: false,
      earnedPoints: 0,
      feedback: 'Automatische Bewertung fehlgeschlagen.',
    }
  }
}

// ============================================
// Beispiel ExamStyleProfile für Dokumentation
// ============================================

export const EXAMPLE_EXAM_STYLE_PROFILE: ExamStyleProfile = {
  commonPhrases: [
    'Berechnen Sie',
    'Begründen Sie Ihre Antwort ausführlich',
    'Zeigen Sie mithilfe von',
    'Bestimmen Sie alle',
    'Geben Sie die Definition von ... an',
    'Beweisen Sie, dass',
  ],
  typicalDifficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 },
  typicalStructures: [
    {
      type: 'calculation',
      description: 'Mehrstufige Berechnungen mit Zwischenschritten',
      pointsRange: [8, 15],
      frequency: 0.35,
    },
    {
      type: 'proof',
      description: 'Mathematische Beweise mit Induktion oder direktem Beweis',
      pointsRange: [10, 20],
      frequency: 0.25,
    },
    {
      type: 'open-question',
      description: 'Konzeptuelle Verständnisfragen',
      pointsRange: [5, 10],
      frequency: 0.25,
    },
    {
      type: 'multiple-choice',
      description: 'Wahr/Falsch mit Begründung',
      pointsRange: [2, 4],
      frequency: 0.15,
    },
  ],
  topicDistribution: {
    'Lineare Algebra': 0.3,
    'Analysis': 0.3,
    'Differentialgleichungen': 0.2,
    'Wahrscheinlichkeitsrechnung': 0.2,
  },
  formattingPatterns: {
    usesTables: true,
    usesFormulas: true,
    usesLongText: false,
    usesMultipleChoice: true,
    usesSubtasks: true,
  },
  averageTaskCount: 6,
  averagePointsPerTask: 12,
}

// Beispiel einer generierten Aufgabe
export const EXAMPLE_GENERATED_TASK: ExamTask = {
  id: 'exam-task-001',
  moduleId: 'module-math-001',
  question: `**Aufgabe 3: Eigenwerte und Eigenvektoren** (15 Punkte)

Gegeben sei die Matrix:
$$A = \\begin{pmatrix} 3 & 1 \\\\ 0 & 2 \\end{pmatrix}$$

a) Berechnen Sie alle Eigenwerte von $A$. (5 Punkte)

b) Bestimmen Sie zu jedem Eigenwert einen zugehörigen Eigenvektor. (6 Punkte)

c) Begründen Sie, ob $A$ diagonalisierbar ist. (4 Punkte)`,
  solution: `**Lösung:**

a) Eigenwerte:
$$\\det(A - \\lambda I) = (3-\\lambda)(2-\\lambda) = 0$$
$$\\Rightarrow \\lambda_1 = 3, \\lambda_2 = 2$$

b) Eigenvektoren:
Für $\\lambda_1 = 3$: $(A - 3I)v = 0 \\Rightarrow v_1 = \\begin{pmatrix} 1 \\\\ 0 \\end{pmatrix}$
Für $\\lambda_2 = 2$: $(A - 2I)v = 0 \\Rightarrow v_2 = \\begin{pmatrix} -1 \\\\ 1 \\end{pmatrix}$

c) $A$ ist diagonalisierbar, da wir 2 linear unabhängige Eigenvektoren gefunden haben (entspricht der Dimension der Matrix).`,
  difficulty: 'medium',
  topic: 'Lineare Algebra',
  tags: ['Eigenwerte', 'Eigenvektoren', 'Diagonalisierung', 'Matrizen'],
  points: 15,
  createdAt: new Date().toISOString(),
  completed: false,
  examStatus: 'unanswered',
}
