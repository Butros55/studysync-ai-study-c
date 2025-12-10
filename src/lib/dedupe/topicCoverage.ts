/**
 * Topic Coverage System
 * 
 * Tracks which topics have been covered by generated tasks and ensures
 * even distribution across all module topics.
 * 
 * ENTRY POINTS:
 * - getModuleTopics() - Get all topics for a module from DocumentAnalysis
 * - getTopicCoverage() - Get coverage stats for a module
 * - updateTopicCoverage() - Update coverage after task generation
 * - buildTaskBlueprint() - Create a blueprint for task generation
 */

import { storage, storageReady, getCollection, setCollection } from '../storage'
import { listDocumentAnalyses, getModuleProfile } from '../analysis-storage'
import { parseModuleKnowledgeIndex, type ModuleKnowledgeIndex } from '../module-profile-builder'
import { simpleHash } from './taskFingerprint'

// ============================================================================
// Types
// ============================================================================

export interface Topic {
  /** Stable topic ID (hash of name + moduleId) */
  topicId: string
  /** Topic name */
  name: string
  /** Evidence snippets from documents */
  evidenceSnippets: string[]
  /** Document IDs that contain this topic */
  docIds: string[]
  /** Frequency weight (how often mentioned) */
  weight: number
}

export interface TopicCoverage {
  /** Module ID */
  moduleId: string
  /** Topic ID */
  topicId: string
  /** Topic name (for display) */
  topicName: string
  /** Number of tasks generated for this topic */
  tasksGeneratedCount: number
  /** Last generation timestamp */
  lastGeneratedAt?: number
  /** Breakdown by difficulty */
  byDifficulty: {
    easy: number
    medium: number
    hard: number
  }
}

export interface BlueprintItem {
  /** Topic to generate task for */
  topicId: string
  /** Topic name */
  topicName: string
  /** Target difficulty */
  difficulty: 'easy' | 'medium' | 'hard'
  /** Question type */
  questionType: 'definition' | 'apply' | 'compare' | 'debug' | 'mcq' | 'transfer' | 'calculation'
  /** Answer mode constraint */
  answerMode: 'type' | 'draw' | 'either'
  /** Evidence snippets for context */
  evidenceSnippets: string[]
  /** Related doc IDs */
  docIds: string[]
}

export interface TaskBlueprint {
  /** Module ID */
  moduleId: string
  /** Total tasks to generate */
  targetCount: number
  /** Blueprint items */
  items: BlueprintItem[]
  /** Topics covered */
  coveredTopicIds: string[]
  /** Created timestamp */
  createdAt: number
}

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY = 'topic_coverage'

/**
 * Get all topic coverage records for a module
 */
export async function getTopicCoverageForModule(moduleId: string): Promise<TopicCoverage[]> {
  await storageReady
  const allCoverage = await getCollection<TopicCoverage>(STORAGE_KEY)
  return allCoverage.filter(c => c.moduleId === moduleId)
}

/**
 * Get coverage for a specific topic
 */
export async function getTopicCoverage(moduleId: string, topicId: string): Promise<TopicCoverage | null> {
  await storageReady
  const allCoverage = await getCollection<TopicCoverage>(STORAGE_KEY)
  return allCoverage.find(c => c.moduleId === moduleId && c.topicId === topicId) || null
}

/**
 * Update coverage for a topic after task generation
 */
export async function updateTopicCoverage(
  moduleId: string,
  topicId: string,
  topicName: string,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<TopicCoverage> {
  await storageReady
  const allCoverage = await getCollection<TopicCoverage>(STORAGE_KEY)
  
  let coverage = allCoverage.find(c => c.moduleId === moduleId && c.topicId === topicId)
  
  if (coverage) {
    // Update existing
    coverage.tasksGeneratedCount++
    coverage.lastGeneratedAt = Date.now()
    coverage.byDifficulty[difficulty]++
  } else {
    // Create new
    coverage = {
      moduleId,
      topicId,
      topicName,
      tasksGeneratedCount: 1,
      lastGeneratedAt: Date.now(),
      byDifficulty: {
        easy: difficulty === 'easy' ? 1 : 0,
        medium: difficulty === 'medium' ? 1 : 0,
        hard: difficulty === 'hard' ? 1 : 0
      }
    }
    allCoverage.push(coverage)
  }
  
  await setCollection(STORAGE_KEY, allCoverage)
  return coverage
}

/**
 * Reset coverage for a module (for testing/reset)
 */
export async function resetModuleCoverage(moduleId: string): Promise<void> {
  await storageReady
  const allCoverage = await getCollection<TopicCoverage>(STORAGE_KEY)
  const filtered = allCoverage.filter(c => c.moduleId !== moduleId)
  await setCollection(STORAGE_KEY, filtered)
}

// ============================================================================
// Topic Extraction
// ============================================================================

/**
 * Generate a stable topic ID from topic name and module ID
 */
export function generateTopicId(topicName: string, moduleId: string): string {
  const normalized = topicName.toLowerCase().trim()
  return simpleHash(`${moduleId}:${normalized}`)
}

/**
 * Get all topics for a module from DocumentAnalysis and ModuleProfile
 */
export async function getModuleTopics(moduleId: string): Promise<Topic[]> {
  // Try to get from ModuleProfile first (aggregated data)
  const profile = await getModuleProfile(moduleId)
  
  if (profile) {
    const knowledgeIndex = parseModuleKnowledgeIndex(profile)
    
    if (knowledgeIndex && knowledgeIndex.allTopics.length > 0) {
      return knowledgeIndex.allTopics.map(topicName => {
        const topicId = generateTopicId(topicName, moduleId)
        const docRefs = knowledgeIndex.topicIndex[topicName] || []
        
        // Get evidence snippets from definitions/formulas related to this topic
        const relatedDefs = knowledgeIndex.definitions.filter(d => 
          d.term.toLowerCase().includes(topicName.toLowerCase()) ||
          topicName.toLowerCase().includes(d.term.toLowerCase())
        )
        const evidenceSnippets = relatedDefs
          .slice(0, 3)
          .map(d => d.definition || d.term)
          .filter(Boolean)
        
        return {
          topicId,
          name: topicName,
          evidenceSnippets,
          docIds: docRefs.map(r => r.documentId),
          weight: knowledgeIndex.topicFrequency[topicName] || 1
        }
      })
    }
  }
  
  // Fallback: Get from individual DocumentAnalyses
  const analyses = await listDocumentAnalyses(moduleId)
  const topicMap = new Map<string, Topic>()
  
  for (const analysis of analyses) {
    if (!analysis.analysisJson) continue
    
    try {
      const parsed = JSON.parse(analysis.analysisJson)
      const topics: string[] = parsed.topics || parsed.canonicalTopics || []
      const concepts: Array<{ term: string; definition?: string }> = parsed.concepts || []
      
      for (const topicName of topics) {
        const topicId = generateTopicId(topicName, moduleId)
        
        if (topicMap.has(topicId)) {
          // Update existing topic
          const existing = topicMap.get(topicId)!
          if (!existing.docIds.includes(analysis.documentId)) {
            existing.docIds.push(analysis.documentId)
          }
          existing.weight++
        } else {
          // Create new topic
          const relatedConcepts = concepts.filter(c => 
            c.term.toLowerCase().includes(topicName.toLowerCase()) ||
            topicName.toLowerCase().includes(c.term.toLowerCase())
          )
          
          topicMap.set(topicId, {
            topicId,
            name: topicName,
            evidenceSnippets: relatedConcepts.slice(0, 3).map(c => c.definition || c.term),
            docIds: [analysis.documentId],
            weight: 1
          })
        }
      }
    } catch {
      // Skip invalid analyses
    }
  }
  
  return Array.from(topicMap.values())
}

// ============================================================================
// Blueprint Generation
// ============================================================================

const QUESTION_TYPES: BlueprintItem['questionType'][] = [
  'definition',
  'apply',
  'compare',
  'calculation',
  'mcq',
  'transfer'
]

const DIFFICULTIES: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']

/**
 * Build a task blueprint that ensures even topic coverage
 * 
 * Strategy:
 * 1. Get all topics
 * 2. Get existing coverage
 * 3. Sort topics by coverage (least covered first)
 * 4. Round-robin assign tasks to topics
 * 5. Vary difficulty and question type
 */
export async function buildTaskBlueprint(
  moduleId: string,
  targetCount: number,
  preferredInputMode?: 'type' | 'draw'
): Promise<TaskBlueprint> {
  // Get all topics
  const topics = await getModuleTopics(moduleId)
  
  if (topics.length === 0) {
    // No topics found - return empty blueprint
    return {
      moduleId,
      targetCount,
      items: [],
      coveredTopicIds: [],
      createdAt: Date.now()
    }
  }
  
  // Get existing coverage
  const coverage = await getTopicCoverageForModule(moduleId)
  const coverageMap = new Map(coverage.map(c => [c.topicId, c]))
  
  // Sort topics by coverage (least covered first)
  const sortedTopics = [...topics].sort((a, b) => {
    const coverageA = coverageMap.get(a.topicId)?.tasksGeneratedCount || 0
    const coverageB = coverageMap.get(b.topicId)?.tasksGeneratedCount || 0
    
    // Primary sort: coverage ascending
    if (coverageA !== coverageB) return coverageA - coverageB
    
    // Secondary sort: weight descending (more important topics first)
    return b.weight - a.weight
  })
  
  // Build blueprint items
  const items: BlueprintItem[] = []
  let difficultyIndex = 0
  let questionTypeIndex = 0
  
  for (let i = 0; i < targetCount; i++) {
    // Round-robin through topics
    const topic = sortedTopics[i % sortedTopics.length]
    
    // Cycle through difficulties (40% easy, 40% medium, 20% hard)
    const difficultyRoll = Math.random()
    let difficulty: 'easy' | 'medium' | 'hard'
    if (difficultyRoll < 0.4) difficulty = 'easy'
    else if (difficultyRoll < 0.8) difficulty = 'medium'
    else difficulty = 'hard'
    
    // Cycle through question types
    const questionType = QUESTION_TYPES[questionTypeIndex % QUESTION_TYPES.length]
    questionTypeIndex++
    
    // Determine answer mode based on question type and user preference
    let answerMode: 'type' | 'draw' | 'either' = 'either'
    if (preferredInputMode === 'type') {
      answerMode = 'type'
    } else if (questionType === 'calculation' || questionType === 'apply') {
      answerMode = 'either' // These might benefit from drawing
    }
    
    items.push({
      topicId: topic.topicId,
      topicName: topic.name,
      difficulty,
      questionType,
      answerMode,
      evidenceSnippets: topic.evidenceSnippets,
      docIds: topic.docIds
    })
  }
  
  return {
    moduleId,
    targetCount,
    items,
    coveredTopicIds: [...new Set(items.map(i => i.topicId))],
    createdAt: Date.now()
  }
}

/**
 * Get coverage statistics for a module
 */
export async function getModuleCoverageStats(moduleId: string): Promise<{
  totalTopics: number
  coveredTopics: number
  coveragePercent: number
  topicsWithNoTasks: string[]
  topicsNeedingMoreTasks: string[]
  avgTasksPerTopic: number
}> {
  const topics = await getModuleTopics(moduleId)
  const coverage = await getTopicCoverageForModule(moduleId)
  const coverageMap = new Map(coverage.map(c => [c.topicId, c]))
  
  let totalTasks = 0
  const topicsWithNoTasks: string[] = []
  const topicsNeedingMoreTasks: string[] = []
  
  for (const topic of topics) {
    const cov = coverageMap.get(topic.topicId)
    const taskCount = cov?.tasksGeneratedCount || 0
    totalTasks += taskCount
    
    if (taskCount === 0) {
      topicsWithNoTasks.push(topic.name)
    } else if (taskCount < 3) {
      topicsNeedingMoreTasks.push(topic.name)
    }
  }
  
  const coveredCount = topics.length - topicsWithNoTasks.length
  
  return {
    totalTopics: topics.length,
    coveredTopics: coveredCount,
    coveragePercent: topics.length > 0 ? (coveredCount / topics.length) * 100 : 0,
    topicsWithNoTasks,
    topicsNeedingMoreTasks,
    avgTasksPerTopic: topics.length > 0 ? totalTasks / topics.length : 0
  }
}
