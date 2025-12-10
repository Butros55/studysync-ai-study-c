/**
 * Dedupe Module Index
 * 
 * Exports all deduplication utilities
 */

export {
  normalizeText,
  normalizeTags,
  sha256,
  simpleHash,
  taskFingerprint,
  taskFingerprintSync,
  checkFingerprintDuplicate,
  buildFingerprintMap,
  checkTaskDuplicate,
  type TaskFingerprintData,
  type DuplicateCheckResult
} from './taskFingerprint'

export {
  cosineSimilarity,
  tokenize,
  jaccardSimilarity,
  generateNgrams,
  ngramSimilarity,
  softSemanticSimilarity,
  getEmbedding,
  embeddingsAvailable,
  findSemanticDuplicates,
  getTopKSimilarTasks,
  type SemanticCheckResult,
  type EmbeddingCache
} from './semanticSimilarity'

export {
  generateTopicId,
  getModuleTopics,
  getTopicCoverage,
  getTopicCoverageForModule,
  updateTopicCoverage,
  resetModuleCoverage,
  buildTaskBlueprint,
  getModuleCoverageStats,
  type Topic,
  type TopicCoverage,
  type BlueprintItem,
  type TaskBlueprint
} from './topicCoverage'
