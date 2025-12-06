import { ExamSession } from './types'

const PAUSED_EXAM_KEY = 'studysync_paused_exam'

export interface PausedExam {
  session: ExamSession
  timeRemaining: number
  pausedAt: string
}

/**
 * Save a paused exam to localStorage
 */
export function savePausedExam(moduleId: string, session: ExamSession, timeRemaining: number): void {
  const paused: PausedExam = {
    session,
    timeRemaining,
    pausedAt: new Date().toISOString(),
  }
  const allPaused = loadAllPausedExams()
  allPaused[moduleId] = paused
  localStorage.setItem(PAUSED_EXAM_KEY, JSON.stringify(allPaused))
}

/**
 * Load a paused exam from localStorage
 */
export function loadPausedExam(moduleId: string): PausedExam | null {
  const allPaused = loadAllPausedExams()
  return allPaused[moduleId] || null
}

/**
 * Load all paused exams from localStorage
 */
export function loadAllPausedExams(): Record<string, PausedExam> {
  try {
    const data = localStorage.getItem(PAUSED_EXAM_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * Clear a paused exam from localStorage
 */
export function clearPausedExam(moduleId: string): void {
  const allPaused = loadAllPausedExams()
  delete allPaused[moduleId]
  localStorage.setItem(PAUSED_EXAM_KEY, JSON.stringify(allPaused))
}
