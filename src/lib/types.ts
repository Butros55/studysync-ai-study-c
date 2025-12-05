export interface Module {
  id: string
  name: string
  code: string
  createdAt: string
  color: string
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
  difficulty: 'easy' | 'medium' | 'hard'
  topic?: string
  module?: string
  tags?: string[]
  subtasks?: TaskSubtask[]
  createdAt: string
  completed: boolean
}

export interface GeneratedTaskResponse {
  question: string
  solution: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
  module: string
  tags: string[]
  subtasks?: TaskSubtask[]
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
