/**
 * Recommendation Engine für das Tutor-Dashboard
 * 
 * Generiert personalisierte Lernempfehlungen basierend auf:
 * - Prüfungsterminen (Module mit nahen Prüfungen priorisieren)
 * - Lernfortschritt (schwache Themen bevorzugen)
 * - Schwierigkeitsverteilung (Mischung aus leicht/mittel/schwer)
 */

import { Module, Task, ModuleStats, TopicStats, Recommendation, RecommendationType } from './types'
import { canonicalKey, cleanLabel } from './tag-canonicalizer'

const STATS_STORAGE_KEY = 'studymate-topic-stats'

// ============================================
// Statistik-Persistenz (localStorage)
// ============================================

export function loadModuleStats(): ModuleStats[] {
  try {
    const stored = localStorage.getItem(STATS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveModuleStats(stats: ModuleStats[]): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
  } catch (e) {
    console.warn('Fehler beim Speichern der Statistiken:', e)
  }
}

/**
 * Aktualisiert die Statistiken nach einer Aufgabenlösung.
 * Uses canonical keys for topic matching to prevent duplicate entries
 * for semantically identical topics (e.g., "Quine-McCluskey" vs "Minimierung (Quine-McCluskey)")
 */
export function updateTopicStats(
  moduleId: string,
  topic: string,
  isCorrect: boolean
): ModuleStats[] {
  const allStats = loadModuleStats()
  
  let moduleStats = allStats.find(s => s.moduleId === moduleId)
  if (!moduleStats) {
    moduleStats = {
      moduleId,
      topics: [],
      lastUpdated: new Date().toISOString()
    }
    allStats.push(moduleStats)
  }
  
  // Use canonical key for matching to merge similar topics
  const topicKey = canonicalKey(topic)
  const cleanedLabel = cleanLabel(topic)
  
  // Find existing topic stats by canonical key match
  let topicStats = moduleStats.topics.find(t => canonicalKey(t.topic) === topicKey)
  
  if (!topicStats) {
    topicStats = {
      topic: cleanedLabel, // Store the clean label
      correct: 0,
      incorrect: 0,
      lastPracticed: new Date().toISOString()
    }
    moduleStats.topics.push(topicStats)
  } else {
    // Optionally update the label to the newest form if it's "better"
    // (shorter, no parentheses, proper capitalization)
    if (cleanedLabel.length < topicStats.topic.length && !cleanedLabel.includes('(')) {
      topicStats.topic = cleanedLabel
    }
  }
  
  if (isCorrect) {
    topicStats.correct++
  } else {
    topicStats.incorrect++
  }
  topicStats.lastPracticed = new Date().toISOString()
  moduleStats.lastUpdated = new Date().toISOString()
  
  saveModuleStats(allStats)
  return allStats
}

/**
 * Berechnet die Erfolgsquote für ein Thema (0-1)
 */
function getSuccessRate(stats: TopicStats): number {
  const total = stats.correct + stats.incorrect
  if (total === 0) return 0.5 // Neutral wenn keine Daten
  return stats.correct / total
}

/**
 * Findet schwache Themen für ein Modul (Erfolgsquote < 60%)
 */
export function getWeakTopics(moduleId: string): string[] {
  const allStats = loadModuleStats()
  const moduleStats = allStats.find(s => s.moduleId === moduleId)
  if (!moduleStats) return []
  
  // Group by canonical key to avoid returning duplicates
  const groupedByKey = new Map<string, TopicStats>()
  for (const topic of moduleStats.topics) {
    const key = canonicalKey(topic.topic)
    const existing = groupedByKey.get(key)
    if (existing) {
      // Merge stats
      existing.correct += topic.correct
      existing.incorrect += topic.incorrect
      // Use the shorter/cleaner label
      if (topic.topic.length < existing.topic.length) {
        existing.topic = topic.topic
      }
    } else {
      groupedByKey.set(key, { ...topic })
    }
  }
  
  return Array.from(groupedByKey.values())
    .filter(t => getSuccessRate(t) < 0.6 && (t.correct + t.incorrect) >= 2)
    .sort((a, b) => getSuccessRate(a) - getSuccessRate(b))
    .map(t => t.topic)
}

/**
 * Get consolidated topic stats with duplicates merged by canonical key.
 * Returns stats grouped by canonical key but displaying the best label.
 */
export function getConsolidatedTopicStats(moduleId: string): TopicStats[] {
  const allStats = loadModuleStats()
  const moduleStats = allStats.find(s => s.moduleId === moduleId)
  if (!moduleStats) return []
  
  // Group by canonical key
  const groupedByKey = new Map<string, TopicStats>()
  for (const topic of moduleStats.topics) {
    const key = canonicalKey(topic.topic)
    const existing = groupedByKey.get(key)
    if (existing) {
      // Merge stats
      existing.correct += topic.correct
      existing.incorrect += topic.incorrect
      // Use more recent lastPracticed
      if (topic.lastPracticed && (!existing.lastPracticed || topic.lastPracticed > existing.lastPracticed)) {
        existing.lastPracticed = topic.lastPracticed
      }
      // Use the shorter/cleaner label
      if (topic.topic.length < existing.topic.length && !topic.topic.includes('(')) {
        existing.topic = topic.topic
      }
    } else {
      groupedByKey.set(key, { ...topic })
    }
  }
  
  return Array.from(groupedByKey.values())
}

/**
 * Berechnet den Gesamtfortschritt eines Moduls (0-1)
 */
export function getModuleProgress(moduleId: string): number {
  const allStats = loadModuleStats()
  const moduleStats = allStats.find(s => s.moduleId === moduleId)
  if (!moduleStats || moduleStats.topics.length === 0) return 0
  
  const totalCorrect = moduleStats.topics.reduce((sum, t) => sum + t.correct, 0)
  const totalAttempts = moduleStats.topics.reduce((sum, t) => sum + t.correct + t.incorrect, 0)
  
  if (totalAttempts === 0) return 0
  return totalCorrect / totalAttempts
}

/**
 * Berechnet Tage bis zur Prüfung
 */
export function getDaysUntilExam(examDate?: string): number | null {
  if (!examDate) return null
  
  const exam = new Date(examDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exam.setHours(0, 0, 0, 0)
  
  const diffTime = exam.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays >= 0 ? diffDays : null
}

// ============================================
// Haupt-Empfehlungslogik
// ============================================

/**
 * Generiert Lernempfehlungen basierend auf Prüfungsterminen und Fortschritt
 */
export function generateRecommendations(
  modules: Module[],
  tasks: Task[],
  maxRecommendations: number = 5
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const allStats = loadModuleStats()
  
  // Sortiere Module nach Prüfungsnähe
  const modulesWithExams = modules
    .map(m => ({
      module: m,
      daysUntil: getDaysUntilExam(m.examDate)
    }))
    .filter(m => m.daysUntil !== null && m.daysUntil >= 0 && m.daysUntil <= 30)
    .sort((a, b) => (a.daysUntil || 999) - (b.daysUntil || 999))
  
  // Prüfungsnahe Module priorisieren
  for (const { module, daysUntil } of modulesWithExams) {
    const moduleTasks = tasks.filter(t => t.moduleId === module.id && !t.completed)
    if (moduleTasks.length === 0) continue
    
    const moduleStats = allStats.find(s => s.moduleId === module.id)
    const weakTopics = getWeakTopics(module.id)
    
    // Finde schwache Themen-Tasks
    const weakTopicTasks = moduleTasks.filter(t => 
      t.topic && weakTopics.includes(t.topic)
    )
    
    // Mische Schwierigkeitsgrade
    const selectedTasks = selectBalancedTasks(
      weakTopicTasks.length > 0 ? weakTopicTasks : moduleTasks,
      daysUntil || 30
    )
    
    if (selectedTasks.length > 0) {
      let reason = ''
      let type: RecommendationType = 'today'
      
      if (daysUntil !== null && daysUntil <= 7) {
        reason = `Prüfung in ${daysUntil} Tag${daysUntil !== 1 ? 'en' : ''}`
        type = 'exam-prep'
      } else if (daysUntil !== null && daysUntil <= 14) {
        reason = `Prüfung in ${daysUntil} Tagen – jetzt intensiv lernen`
        type = 'this-week'
      } else if (weakTopics.length > 0) {
        reason = `Schwach in: ${weakTopics.slice(0, 2).join(', ')}`
        type = 'weak-topic'
      } else {
        reason = 'Regelmäßig üben'
        type = 'today'
      }
      
      recommendations.push({
        moduleId: module.id,
        moduleName: module.name,
        type,
        reason,
        priority: daysUntil !== null ? Math.max(1, Math.floor(daysUntil / 7)) : 5,
        tasks: selectedTasks
      })
    }
  }
  
  // Module ohne Prüfungstermin mit niedrigerer Priorität
  const modulesWithoutExams = modules.filter(m => !m.examDate)
  for (const module of modulesWithoutExams) {
    const moduleTasks = tasks.filter(t => t.moduleId === module.id && !t.completed)
    if (moduleTasks.length === 0) continue
    
    const weakTopics = getWeakTopics(module.id)
    const weakTopicTasks = moduleTasks.filter(t => 
      t.topic && weakTopics.includes(t.topic)
    )
    
    if (weakTopicTasks.length > 0) {
      recommendations.push({
        moduleId: module.id,
        moduleName: module.name,
        type: 'weak-topic',
        reason: `Schwach in: ${weakTopics.slice(0, 2).join(', ')}`,
        priority: 10,
        tasks: selectBalancedTasks(weakTopicTasks, 30).slice(0, 2)
      })
    }
  }
  
  // Nach Priorität sortieren und begrenzen
  return recommendations
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxRecommendations)
}

/**
 * Wählt eine ausgewogene Mischung aus Aufgaben verschiedener Schwierigkeitsgrade
 */
function selectBalancedTasks(tasks: Task[], daysUntilExam: number): Task[] {
  const easy = tasks.filter(t => t.difficulty === 'easy')
  const medium = tasks.filter(t => t.difficulty === 'medium')
  const hard = tasks.filter(t => t.difficulty === 'hard')
  
  const selected: Task[] = []
  
  // Je näher die Prüfung, desto mehr schwere Aufgaben
  if (daysUntilExam <= 7) {
    // Prüfung nah: 1 leicht, 2 mittel, 1-2 schwer
    if (easy.length > 0) selected.push(easy[Math.floor(Math.random() * easy.length)])
    selected.push(...shuffleArray(medium).slice(0, 2))
    selected.push(...shuffleArray(hard).slice(0, 2))
  } else if (daysUntilExam <= 14) {
    // Mittelfristig: 1 leicht, 2 mittel, 1 schwer
    if (easy.length > 0) selected.push(easy[Math.floor(Math.random() * easy.length)])
    selected.push(...shuffleArray(medium).slice(0, 2))
    if (hard.length > 0) selected.push(hard[Math.floor(Math.random() * hard.length)])
  } else {
    // Langfristig: 2 leicht, 2 mittel
    selected.push(...shuffleArray(easy).slice(0, 2))
    selected.push(...shuffleArray(medium).slice(0, 2))
  }
  
  return selected.slice(0, 5)
}

/**
 * Fisher-Yates Shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Formatiert Datum als "in X Tagen" oder konkretes Datum
 */
export function formatExamDate(examDate?: string): string {
  if (!examDate) return 'Kein Termin gesetzt'
  
  const days = getDaysUntilExam(examDate)
  if (days === null) return 'Prüfung vorbei'
  if (days === 0) return 'Heute!'
  if (days === 1) return 'Morgen'
  if (days <= 7) return `In ${days} Tagen`
  
  return new Date(examDate).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
