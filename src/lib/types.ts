// Zusätzliche Termine (Abgaben, Präsentationen, etc.)
export interface CustomDeadline {
  id: string
  label: string      // z.B. "Hausarbeit Abgabe", "Präsentation"
  date: string       // ISO-String
}

// =========================================
// NEUE DATEITYPEN FÜR ERWEITERTE MODUL-STRUKTUR
// =========================================

// Referenz auf eine hochgeladene Datei
export interface FileRef {
  id: string
  name: string
  type: 'pdf' | 'image' | 'text' | 'pptx'
  path: string
  uploadedAt: string
  fileSize?: number
}

// Kategorien für Dateien
export type FileCategory = 'script' | 'exercise' | 'solution' | 'exam'

// Erweiterte Datei-Referenz mit Kategorie
export interface CategorizedFileRef extends FileRef {
  category: FileCategory
}

// Referenz auf eine Notiz
export interface NoteRef {
  id: string
  title: string
  scriptId?: string
}

// Referenz auf Karteikarten
export interface FlashcardRef {
  id: string
  count: number
  noteId?: string
}

// Referenz auf eine Aufgabe
export interface TaskRef {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
}

// Lernblock für strukturiertes Lernen
export interface ModuleLearningBlock {
  id: string
  title: string
  description?: string
  topics: string[]
  requiredTasks: TaskRef[]
  completedTasks: string[]  // IDs der abgeschlossenen Tasks
  completed: boolean
  completedAt?: string
  order: number
}

// Erweiterte Statistiken pro Thema
export interface TopicStats {
  topic: string
  correct: number
  incorrect: number
  lastPracticed?: string
  difficultyDistribution?: {
    easy: number
    medium: number
    hard: number
  }
}

export interface Module {
  id: string
  name: string
  code: string
  createdAt: string
  color: string
  examDate?: string           // ISO-String für Prüfungstermin
  customDeadlines?: CustomDeadline[]  // Weitere Termine
  
  // =========================================
  // NEUE FELDER FÜR ERWEITERTE MODUL-STRUKTUR
  // =========================================
  
  // Kategorisierte Dateien (Skripte, Übungsblätter, Lösungen, Probeklausuren)
  files?: CategorizedFileRef[]
  
  // Lernblöcke für strukturiertes Lernen
  learningBlocks?: ModuleLearningBlock[]
  
  // Modul-weite Statistiken
  topicStats?: TopicStats[]
  
  // Fortschritt in Prozent
  progress?: number
}

// Legacy Module-Interface für Abwärtskompatibilität
export interface LegacyModule {
  id: string
  name: string
  code: string
  createdAt: string
  color: string
  examDate?: string
  customDeadlines?: CustomDeadline[]
}

export interface ModuleStats {
  moduleId: string
  topics: TopicStats[]
  lastUpdated: string
}

// Anhänge für Aufgaben (Wahrheitstabellen, Bilder, etc.)
export type TaskAttachmentType = 'image' | 'table' | 'text'

export interface TaskAttachment {
  id: string
  type: TaskAttachmentType
  label?: string        // z.B. "Wahrheitstabelle"
  url?: string          // für Bilder
  markdown?: string     // z.B. Tabelle als Markdown
}

export interface Script {
  id: string
  moduleId: string
  name: string
  content: string
  uploadedAt: string
  fileType: string
  fileData?: string
  category?: FileCategory  // Kategorie: script, exercise, solution, exam
}

export interface StudyNote {
  id: string
  scriptId: string
  moduleId: string
  content: string
  generatedAt: string
}

export interface TaskSubtask {
  title: string
  points: number
  prompt: string
}

export interface Task {
  id: string
  moduleId: string
  scriptId?: string
  title?: string
  question: string
  solution: string
  solutionMarkdown?: string  // Musterlösung als Markdown (alternativ zu solution)
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  module?: string
  tags?: string[]
  subtasks?: TaskSubtask[]
  attachments?: TaskAttachment[]  // Anhänge wie Wahrheitstabellen, Bilder
  createdAt: string
  completed: boolean
  completedAt?: string
  viewedSolution?: boolean  // Wurde die Musterlösung angesehen?
}

// Feedback-Daten von der KI-Bewertung
export interface TaskFeedback {
  isCorrect: boolean
  hints?: string[]
  transcription?: string  // KI-Transkription der Handschrift
}

export interface GeneratedTaskResponse {
  question: string
  solution: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
  module: string
  tags: string[]
  subtasks?: TaskSubtask[]
  attachments?: TaskAttachment[]  // Anhänge aus LLM-Response
}

// Empfehlungssystem für Tutor-Dashboard
export type RecommendationType = 'today' | 'this-week' | 'weak-topic' | 'exam-prep'

export interface Recommendation {
  moduleId: string
  moduleName: string
  type: RecommendationType
  reason: string
  priority: number  // 1 = höchste Priorität
  tasks: Task[]
}

export interface TaskAttempt {
  taskId: string
  userAnswer: string
  isCorrect: boolean
  hints: string[]
  attemptedAt: string
}

export interface Flashcard {
  id: string
  noteId: string
  moduleId: string
  front: string
  back: string
  createdAt: string
  lastReviewed?: string
  nextReview?: string
  ease: number
  interval: number
  repetitions: number
}

export interface FlashcardReview {
  flashcardId: string
  quality: number
  reviewedAt: string
}

export interface TokenUsage {
  id: string
  timestamp: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  operation: string
  moduleId?: string
}

export interface CostSummary {
  totalCost: number
  totalTokens: number
  totalRequests: number
  costByModel: Record<string, number>
  tokensByModel: Record<string, number>
  requestsByModel: Record<string, number>
  costByOperation: Record<string, number>
  recentUsage: TokenUsage[]
}

// =========================================
// PRÜFUNGSMODUS TYPEN
// =========================================

// Stil-Muster aus Probeklausuren
export interface ExamSubtaskPattern {
  type: 'multiple-choice' | 'open-question' | 'calculation' | 'proof' | 'code' | 'diagram' | 'table'
  description: string
  pointsRange: [number, number]
  frequency: number // wie oft kommt dieses Muster vor (0-1)
}

// Stilprofil einer Probeklausur
export interface ExamStyleProfile {
  commonPhrases: string[]
  typicalDifficultyMix: { easy: number; medium: number; hard: number }
  typicalStructures: ExamSubtaskPattern[]
  topicDistribution: Record<string, number>
  formattingPatterns: {
    usesTables?: boolean
    usesFormulas?: boolean
    usesLongText?: boolean
    usesMultipleChoice?: boolean
    usesSubtasks?: boolean
  }
  averageTaskCount: number
  averagePointsPerTask: number
}

// Status einer einzelnen Prüfungsaufgabe
export type ExamTaskStatus = 'unanswered' | 'answered' | 'flagged'

// Erweiterte Aufgabe für Prüfungsmodus
export interface ExamTask extends Task {
  examStatus: ExamTaskStatus
  userAnswer?: string
  canvasDataUrl?: string
  isHandwritten?: boolean
  points?: number
  earnedPoints?: number
}

// Prüfungssession
export interface ExamSession {
  id: string
  moduleId: string
  startedAt: string
  duration: number // in Minuten
  difficultyMix: { easy: number; medium: number; hard: number }
  tasks: ExamTask[]
  status: 'preparing' | 'in-progress' | 'submitted' | 'evaluated'
  submittedAt?: string
  timeRemaining?: number // in Sekunden
  results?: ExamResults
}

// Auswertungsergebnisse
export interface ExamResults {
  totalScore: number
  maxScore: number
  percentage: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  taskResults: ExamTaskResult[]
  topicAnalysis: ExamTopicAnalysis[]
  recommendations: string[]
  weakTopics: string[]
  strongTopics: string[]
}

export interface ExamTaskResult {
  taskId: string
  isCorrect: boolean
  earnedPoints: number
  maxPoints: number
  feedback?: string
}

export interface ExamTopicAnalysis {
  topic: string
  correct: number
  total: number
  percentage: number
  isWeak: boolean
}

