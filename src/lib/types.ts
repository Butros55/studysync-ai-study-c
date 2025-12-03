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
}

export interface StudyNote {
  id: string
  scriptId: string
  moduleId: string
  content: string
  generatedAt: string
}

export interface Task {
  id: string
  moduleId: string
  scriptId?: string
  question: string
  solution: string
  difficulty: 'easy' | 'medium' | 'hard'
  createdAt: string
  completed: boolean
}

export interface TaskAttempt {
  taskId: string
  userAnswer: string
  isCorrect: boolean
  hints: string[]
  attemptedAt: string
}
