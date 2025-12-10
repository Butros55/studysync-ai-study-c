/**
 * Semantic Similarity Utilities
 * 
 * Provides:
 * - Cosine similarity calculation for embeddings
 * - Token-based Jaccard similarity (fallback)
 * - N-gram similarity
 * - OpenAI embedding integration
 */

import { llmWithRetry } from '../llm-utils'

// ============================================================================
// Types
// ============================================================================

export interface SemanticCheckResult {
  /** Whether this is a semantic duplicate */
  isDuplicate: boolean
  /** Similarity score (0-1) */
  similarity: number
  /** The matching task ID if found */
  matchingTaskId?: string
  /** Method used for detection */
  method: 'embedding' | 'jaccard' | 'ngram'
}

export interface EmbeddingCache {
  /** Task ID */
  taskId: string
  /** Embedding vector */
  embedding: number[]
  /** Text that was embedded */
  text: string
  /** Created timestamp */
  createdAt: number
}

// ============================================================================
// Cosine Similarity
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length')
  }
  
  if (vecA.length === 0) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)
  
  if (normA === 0 || normB === 0) return 0
  
  return dotProduct / (normA * normB)
}

// ============================================================================
// Token-based Similarity (Jaccard)
// ============================================================================

/**
 * Tokenize text into words (unicode-safe)
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1)
}

/**
 * Calculate Jaccard similarity between two texts
 * Returns a value between 0 and 1
 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(tokenize(textA))
  const tokensB = new Set(tokenize(textB))
  
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  
  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++
    }
  }
  
  const union = tokensA.size + tokensB.size - intersection
  
  return intersection / union
}

// ============================================================================
// N-gram Similarity
// ============================================================================

/**
 * Generate character n-grams from text
 */
export function generateNgrams(text: string, n: number = 3): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const ngrams = new Set<string>()
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.substring(i, i + n))
  }
  
  return ngrams
}

/**
 * Calculate n-gram similarity between two texts
 * Returns a value between 0 and 1
 */
export function ngramSimilarity(textA: string, textB: string, n: number = 3): number {
  const ngramsA = generateNgrams(textA, n)
  const ngramsB = generateNgrams(textB, n)
  
  if (ngramsA.size === 0 && ngramsB.size === 0) return 1
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0
  
  let intersection = 0
  for (const ngram of ngramsA) {
    if (ngramsB.has(ngram)) {
      intersection++
    }
  }
  
  const union = ngramsA.size + ngramsB.size - intersection
  
  return intersection / union
}

// ============================================================================
// Combined Soft Semantic Similarity (No API needed)
// ============================================================================

/**
 * Calculate combined soft semantic similarity using multiple methods
 * Weighted combination of Jaccard and n-gram similarity
 */
export function softSemanticSimilarity(textA: string, textB: string): number {
  const jaccard = jaccardSimilarity(textA, textB)
  const trigram = ngramSimilarity(textA, textB, 3)
  const fourgram = ngramSimilarity(textA, textB, 4)
  
  // Weighted combination: n-grams capture more semantic overlap
  return jaccard * 0.3 + trigram * 0.4 + fourgram * 0.3
}

// ============================================================================
// OpenAI Embeddings Integration
// ============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536 // Default for text-embedding-3-small

/**
 * Get embedding for a text using OpenAI API
 * 
 * Note: This requires the OpenAI API key to be configured in the app
 */
export async function getEmbedding(
  text: string,
  moduleId?: string
): Promise<number[] | null> {
  try {
    // Build embedding request
    const prompt = `[EMBEDDING_REQUEST]${text}`
    
    // Use a special marker that llmWithRetry can detect
    // In practice, you'd want a dedicated embedding function
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getOpenAIKey()}`
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.substring(0, 8000) // Limit to 8000 chars
      })
    })
    
    if (!response.ok) {
      console.warn('[Embedding] API request failed:', response.status)
      return null
    }
    
    const data = await response.json()
    return data.data?.[0]?.embedding || null
  } catch (error) {
    console.warn('[Embedding] Failed to get embedding:', error)
    return null
  }
}

/**
 * Get OpenAI API key from localStorage
 */
function getOpenAIKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('openai_api_key') || ''
}

/**
 * Check if embeddings are available (API key configured)
 */
export function embeddingsAvailable(): boolean {
  return !!getOpenAIKey()
}

// ============================================================================
// Semantic Duplicate Detection
// ============================================================================

/**
 * Find semantic duplicates in existing tasks
 * Uses embeddings if available, falls back to soft semantic similarity
 * 
 * @param candidateText - Text to check (usually question + solution)
 * @param existingTasks - Existing tasks to check against
 * @param threshold - Similarity threshold (default 0.92 for embeddings, 0.85 for soft)
 * @param moduleId - Module ID for tracking
 */
export async function findSemanticDuplicates(
  candidateText: string,
  existingTasks: Array<{ id: string; question: string; solution: string; embedding?: number[] }>,
  threshold: number = 0.92,
  moduleId?: string
): Promise<SemanticCheckResult> {
  // Try embeddings first if available
  if (embeddingsAvailable()) {
    const candidateEmbedding = await getEmbedding(candidateText, moduleId)
    
    if (candidateEmbedding) {
      // Check against existing embeddings
      for (const task of existingTasks) {
        if (task.embedding && task.embedding.length === candidateEmbedding.length) {
          const similarity = cosineSimilarity(candidateEmbedding, task.embedding)
          
          if (similarity >= threshold) {
            return {
              isDuplicate: true,
              similarity,
              matchingTaskId: task.id,
              method: 'embedding'
            }
          }
        }
      }
      
      // No embedding match found
      return {
        isDuplicate: false,
        similarity: 0,
        method: 'embedding'
      }
    }
  }
  
  // Fallback to soft semantic similarity
  const softThreshold = 0.85 // Lower threshold for soft methods
  
  let highestSimilarity = 0
  let matchingTaskId: string | undefined
  
  for (const task of existingTasks) {
    const taskText = `${task.question} ${task.solution}`
    const similarity = softSemanticSimilarity(candidateText, taskText)
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
      matchingTaskId = task.id
    }
  }
  
  return {
    isDuplicate: highestSimilarity >= softThreshold,
    similarity: highestSimilarity,
    matchingTaskId: highestSimilarity >= softThreshold ? matchingTaskId : undefined,
    method: 'jaccard'
  }
}

/**
 * Get top-K most similar tasks to a candidate
 * Useful for building "avoid lists" for generation
 */
export async function getTopKSimilarTasks(
  candidateText: string,
  existingTasks: Array<{ id: string; question: string; solution: string; topicId?: string; embedding?: number[] }>,
  k: number = 10,
  topicId?: string,
  moduleId?: string
): Promise<Array<{ taskId: string; similarity: number }>> {
  const similarities: Array<{ taskId: string; similarity: number }> = []
  
  // If topic is specified, prioritize same-topic tasks
  const topicTasks = topicId 
    ? existingTasks.filter(t => t.topicId === topicId)
    : existingTasks
  
  // Calculate similarities
  for (const task of topicTasks) {
    const taskText = `${task.question} ${task.solution}`
    const similarity = softSemanticSimilarity(candidateText, taskText)
    similarities.push({ taskId: task.id, similarity })
  }
  
  // Sort by similarity descending and take top K
  similarities.sort((a, b) => b.similarity - a.similarity)
  
  return similarities.slice(0, k)
}
