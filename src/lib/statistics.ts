import { Module, Task, Flashcard, Script, StudyNote } from './types'
import { startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, format, subDays, subWeeks, subMonths, isAfter } from 'date-fns'

export interface DailyActivity {
  date: string
  tasksCompleted: number
  flashcardsReviewed: number
  notesGenerated: number
  scriptsUploaded: number
}

export interface ModuleStats {
  moduleId: string
  moduleName: string
  moduleColor: string
  totalTasks: number
  completedTasks: number
  totalFlashcards: number
  dueFlashcards: number
  totalScripts: number
  totalNotes: number
  averageTaskDifficulty: number
  completionRate: number
  lastActivity?: string
}

export interface OverallStats {
  totalModules: number
  totalTasks: number
  completedTasks: number
  totalFlashcards: number
  flashcardsReviewed: number
  totalScripts: number
  totalNotes: number
  currentStreak: number
  longestStreak: number
  studyTimeMinutes: number
  averageCompletionRate: number
}

export interface DifficultyDistribution {
  easy: number
  medium: number
  hard: number
}

export interface StudyStreak {
  currentStreak: number
  longestStreak: number
  lastStudyDate?: string
}

export function calculateDailyActivity(
  tasks: Task[],
  flashcards: Flashcard[],
  notes: StudyNote[],
  scripts: Script[],
  days: number = 30
): DailyActivity[] {
  const today = new Date()
  const startDate = subDays(today, days - 1)
  const dateRange = eachDayOfInterval({ start: startDate, end: today })

  return dateRange.map((date) => {
    const dayStart = startOfDay(date)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    const completedTasksOnDay = tasks.filter((task) => {
      if (!task.completed) return false
      return true
    }).length

    const flashcardsReviewedOnDay = flashcards.filter((card) => {
      if (!card.lastReviewed) return false
      const reviewDate = new Date(card.lastReviewed)
      return reviewDate >= dayStart && reviewDate <= dayEnd
    }).length

    const notesGeneratedOnDay = notes.filter((note) => {
      const noteDate = new Date(note.generatedAt)
      return noteDate >= dayStart && noteDate <= dayEnd
    }).length

    const scriptsUploadedOnDay = scripts.filter((script) => {
      const uploadDate = new Date(script.uploadedAt)
      return uploadDate >= dayStart && uploadDate <= dayEnd
    }).length

    return {
      date: format(date, 'yyyy-MM-dd'),
      tasksCompleted: completedTasksOnDay,
      flashcardsReviewed: flashcardsReviewedOnDay,
      notesGenerated: notesGeneratedOnDay,
      scriptsUploaded: scriptsUploadedOnDay,
    }
  })
}

export function calculateModuleStats(
  module: Module,
  tasks: Task[],
  flashcards: Flashcard[],
  scripts: Script[],
  notes: StudyNote[]
): ModuleStats {
  const moduleTasks = tasks.filter((t) => t.moduleId === module.id)
  const moduleFlashcards = flashcards.filter((f) => f.moduleId === module.id)
  const moduleScripts = scripts.filter((s) => s.moduleId === module.id)
  const moduleNotes = notes.filter((n) => n.moduleId === module.id)

  const completedTasks = moduleTasks.filter((t) => t.completed).length
  const completionRate = moduleTasks.length > 0 ? (completedTasks / moduleTasks.length) * 100 : 0

  const dueFlashcards = moduleFlashcards.filter((card) => {
    if (!card.nextReview) return true
    return new Date(card.nextReview) <= new Date()
  }).length

  const difficultyValues = {
    easy: 1,
    medium: 2,
    hard: 3,
  }
  const totalDifficulty = moduleTasks.reduce((sum, task) => sum + difficultyValues[task.difficulty], 0)
  const averageTaskDifficulty = moduleTasks.length > 0 ? totalDifficulty / moduleTasks.length : 0

  const allDates = [
    ...moduleTasks.map((t) => t.createdAt),
    ...moduleFlashcards.filter((f) => f.lastReviewed).map((f) => f.lastReviewed!),
    ...moduleNotes.map((n) => n.generatedAt),
    ...moduleScripts.map((s) => s.uploadedAt),
  ]
  const lastActivity = allDates.length > 0 ? allDates.sort().reverse()[0] : undefined

  return {
    moduleId: module.id,
    moduleName: module.name,
    moduleColor: module.color,
    totalTasks: moduleTasks.length,
    completedTasks,
    totalFlashcards: moduleFlashcards.length,
    dueFlashcards,
    totalScripts: moduleScripts.length,
    totalNotes: moduleNotes.length,
    averageTaskDifficulty,
    completionRate,
    lastActivity,
  }
}

export function calculateOverallStats(
  modules: Module[],
  tasks: Task[],
  flashcards: Flashcard[],
  scripts: Script[],
  notes: StudyNote[]
): OverallStats {
  const completedTasks = tasks.filter((t) => t.completed).length
  const flashcardsReviewed = flashcards.filter((f) => f.lastReviewed).length

  const streak = calculateStudyStreak(tasks, flashcards)

  const moduleStats = modules.map((module) =>
    calculateModuleStats(module, tasks, flashcards, scripts, notes)
  )
  const averageCompletionRate =
    moduleStats.length > 0
      ? moduleStats.reduce((sum, stat) => sum + stat.completionRate, 0) / moduleStats.length
      : 0

  const estimatedStudyTime = completedTasks * 5 + flashcardsReviewed * 1

  return {
    totalModules: modules.length,
    totalTasks: tasks.length,
    completedTasks,
    totalFlashcards: flashcards.length,
    flashcardsReviewed,
    totalScripts: scripts.length,
    totalNotes: notes.length,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    studyTimeMinutes: estimatedStudyTime,
    averageCompletionRate,
  }
}

export function calculateDifficultyDistribution(tasks: Task[]): DifficultyDistribution {
  return {
    easy: tasks.filter((t) => t.difficulty === 'easy').length,
    medium: tasks.filter((t) => t.difficulty === 'medium').length,
    hard: tasks.filter((t) => t.difficulty === 'hard').length,
  }
}

export function calculateStudyStreak(tasks: Task[], flashcards: Flashcard[]): StudyStreak {
  const allActivityDates = new Set<string>()

  tasks
    .filter((t) => t.completed)
    .forEach((task) => {
      allActivityDates.add(format(startOfDay(new Date(task.createdAt)), 'yyyy-MM-dd'))
    })

  flashcards
    .filter((f) => f.lastReviewed)
    .forEach((card) => {
      allActivityDates.add(format(startOfDay(new Date(card.lastReviewed!)), 'yyyy-MM-dd'))
    })

  const sortedDates = Array.from(allActivityDates)
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  if (sortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0

  const today = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))

  if (sortedDates[0].getTime() === today.getTime() || sortedDates[0].getTime() === yesterday.getTime()) {
    currentStreak = 1
    tempStreak = 1

    for (let i = 1; i < sortedDates.length; i++) {
      const expectedDate = subDays(sortedDates[i - 1], 1)
      if (sortedDates[i].getTime() === expectedDate.getTime()) {
        currentStreak++
        tempStreak++
      } else {
        break
      }
    }
  }

  tempStreak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const expectedDate = subDays(sortedDates[i - 1], 1)
    if (sortedDates[i].getTime() === expectedDate.getTime()) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 1
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak)
  longestStreak = Math.max(longestStreak, currentStreak)

  return {
    currentStreak,
    longestStreak,
    lastStudyDate: sortedDates.length > 0 ? format(sortedDates[0], 'yyyy-MM-dd') : undefined,
  }
}

export function calculateWeeklyProgress(tasks: Task[], weeks: number = 12): { week: string; completed: number }[] {
  const result: { week: string; completed: number }[] = []
  const today = new Date()

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(today, i))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const completedInWeek = tasks.filter((task) => {
      if (!task.completed) return false
      const taskDate = new Date(task.createdAt)
      return taskDate >= weekStart && taskDate <= weekEnd
    }).length

    result.push({
      week: format(weekStart, 'MMM d'),
      completed: completedInWeek,
    })
  }

  return result
}

export function getTopPerformingModules(
  modules: Module[],
  tasks: Task[],
  flashcards: Flashcard[],
  scripts: Script[],
  notes: StudyNote[],
  limit: number = 3
): ModuleStats[] {
  const moduleStats = modules.map((module) =>
    calculateModuleStats(module, tasks, flashcards, scripts, notes)
  )

  return moduleStats
    .sort((a, b) => {
      const scoreA = a.completionRate * 0.5 + (a.completedTasks / (a.totalTasks || 1)) * 0.5
      const scoreB = b.completionRate * 0.5 + (b.completedTasks / (b.totalTasks || 1)) * 0.5
      return scoreB - scoreA
    })
    .slice(0, limit)
}
