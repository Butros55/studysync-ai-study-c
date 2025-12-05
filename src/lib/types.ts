// Zusätzliche Termine (Abgaben, Präsentationen, etc.)
export interface CustomDeadline {
  id: string
  label: string      // z.B. "Hausarbeit Abgabe", "Präsentation"
  date: string       // ISO-String
}

export interface Module {
  id: string
  name: string
  code: string
  createdAt: string
  color: string
  examDate?: string           // ISO-String für Prüfungstermin
  customDeadlines?: CustomDeadline[]  // Weitere Termine
}

// Statistiken pro Thema für Lernfortschritt
export interface TopicStats {
  topic: string
  correct: number
  incorrect: number
  lastPracticed?: string
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
