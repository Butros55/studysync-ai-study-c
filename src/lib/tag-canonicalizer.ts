/**
 * Tag Canonicalization System
 * 
 * Provides consistent tag normalization to fix "tag chaos" where semantically
 * identical tags have different representations (e.g., "Quine-McCluskey" vs
 * "Minimierung (Quine-McCluskey)").
 * 
 * Key concepts:
 * - canonicalKey: normalized, lowercase, punctuation-free key for matching
 * - label: human-readable display label
 * - synonyms: alternative spellings/phrasings that map to same canonicalKey
 */

import { storage, storageReady, getCollection, setCollection } from './storage'

// ============================================================================
// Types
// ============================================================================

/**
 * Single entry in the tag registry
 */
export interface TagRegistryEntry {
  /** The canonical key (used for matching/grouping) */
  canonicalKey: string
  
  /** The preferred display label */
  label: string
  
  /** Alternative forms that map to this entry */
  synonyms: string[]
  
  /** Usage count (for ranking) */
  usageCount: number
  
  /** When this entry was last used */
  lastUsedAt: string
}

/**
 * Module-level tag registry
 */
export interface ModuleTagRegistry {
  moduleId: string
  entries: TagRegistryEntry[]
  lastUpdatedAt: string
  version: string
}

/**
 * Result of normalizing a set of tags
 */
export interface NormalizedTagsResult {
  /** Tags with their canonical labels */
  tags: string[]
  
  /** Which tags were mapped from synonyms */
  mappedSynonyms: Array<{ original: string; mappedTo: string }>
  
  /** Which tags were newly added to the registry */
  newEntries: string[]
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'module_tag_registries'
const REGISTRY_VERSION = '1.0.0'

/**
 * Common German/English stop words to remove from canonical keys
 */
const STOP_WORDS = new Set([
  // German articles
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
  // German prepositions
  'mit', 'von', 'zu', 'bei', 'nach', 'für', 'über', 'unter', 'zwischen',
  'in', 'an', 'auf', 'aus', 'vor', 'hinter', 'neben',
  // English articles & prepositions
  'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  // Common filler words
  'und', 'oder', 'and', 'or'
])

/**
 * Known tag synonyms - maps variant forms to preferred canonical key tokens
 * This helps recognize that "KV-Diagramm" and "Karnaugh-Veitch" are the same
 */
const KNOWN_SYNONYMS: Record<string, string[]> = {
  'quinemccluskey': ['quine', 'mccluskey', 'qmc'],
  'kvdiagramm': ['karnaugh', 'veitch', 'kmap', 'kvmap'],
  'wahrheitstabelle': ['wahrheitstafel', 'truthtable'],
  'booleschealgebra': ['boolean', 'boolesch', 'boolsche'],
  'minimierung': ['minimieren', 'vereinfachung', 'vereinfachen', 'simplification'],
  'zahlensystem': ['zahlensysteme', 'numbersystem', 'numbersystems'],
  'zweierkomplement': ['twoscomplement', '2komplement', '2skomplement'],
  'automat': ['automaten', 'automaton', 'automata', 'statemachine'],
  'deterministic': ['deterministisch', 'dfa', 'dea'],
  'nondeterministic': ['nichtdeterministisch', 'nfa', 'nea'],
  'regulaererausdruck': ['regex', 'regexp', 'regularexpression', 'regulaereausdruecke']
}

// ============================================================================
// Core Canonicalization Functions
// ============================================================================

/**
 * Generate a canonical key from a tag string.
 * 
 * Process:
 * 1. Lowercase
 * 2. Remove/normalize punctuation
 * 3. Extract content from parentheses as separate tokens
 * 4. Remove stop words
 * 5. Sort tokens alphabetically
 * 6. Join with empty string
 * 
 * @example
 * canonicalKey("Quine-McCluskey") -> "mccluskey quine"
 * canonicalKey("Minimierung (Quine-McCluskey)") -> "mccluskey minimierung quine"
 * canonicalKey("KV-Diagramm") -> "diagramm kv"
 */
export function canonicalKey(tag: string): string {
  if (!tag || typeof tag !== 'string') return ''
  
  // Step 1: Lowercase and trim
  let normalized = tag.toLowerCase().trim()
  
  // Step 2: Extract parentheses content and treat as separate tokens
  // "Minimierung (Quine-McCluskey)" -> "Minimierung Quine-McCluskey"
  normalized = normalized.replace(/\(([^)]+)\)/g, ' $1 ')
  
  // Step 3: Replace hyphens, underscores, slashes with spaces
  normalized = normalized.replace(/[-_\/]/g, ' ')
  
  // Step 4: Remove remaining punctuation except spaces
  normalized = normalized.replace(/[^\w\säöüß]/g, '')
  
  // Step 5: Replace German umlauts for matching
  normalized = normalized
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
  
  // Step 6: Split into tokens
  let tokens = normalized.split(/\s+/).filter(t => t.length > 0)
  
  // Step 7: Remove stop words (but keep if it's the only token)
  if (tokens.length > 1) {
    tokens = tokens.filter(t => !STOP_WORDS.has(t))
  }
  
  // Step 8: Sort tokens alphabetically for consistent matching
  tokens.sort()
  
  // Step 9: Join with spaces (readable) - use empty string for stricter matching
  return tokens.join(' ')
}

/**
 * Check if two canonical keys are likely the same tag based on known synonyms
 */
export function areCanonicalKeysSynonyms(key1: string, key2: string): boolean {
  if (key1 === key2) return true
  
  const tokens1 = new Set(key1.split(' '))
  const tokens2 = new Set(key2.split(' '))
  
  // Check if either key contains known synonym tokens
  for (const [primary, variants] of Object.entries(KNOWN_SYNONYMS)) {
    const allForms = [primary, ...variants]
    
    const key1HasForm = allForms.some(f => 
      key1.includes(f) || [...tokens1].some(t => t.includes(f))
    )
    const key2HasForm = allForms.some(f => 
      key2.includes(f) || [...tokens2].some(t => t.includes(f))
    )
    
    if (key1HasForm && key2HasForm) {
      return true
    }
  }
  
  // Check token overlap (if > 50% tokens match, consider synonym)
  const intersection = [...tokens1].filter(t => tokens2.has(t))
  const minSize = Math.min(tokens1.size, tokens2.size)
  
  if (minSize > 0 && intersection.length / minSize >= 0.5) {
    return true
  }
  
  return false
}

/**
 * Generate a clean display label from a tag string.
 * Preserves original casing but normalizes whitespace.
 */
export function cleanLabel(tag: string): string {
  if (!tag || typeof tag !== 'string') return ''
  
  return tag
    .trim()
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    // Normalize hyphens with spaces
    .replace(/\s*-\s*/g, '-')
}

/**
 * Select the best label from multiple candidates.
 * Prefers:
 * 1. Shorter, cleaner labels
 * 2. Labels without parentheses
 * 3. Labels with proper capitalization
 */
export function selectBestLabel(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return cleanLabel(labels[0])
  
  const scored = labels.map(label => {
    const clean = cleanLabel(label)
    let score = 0
    
    // Prefer shorter labels
    score -= clean.length * 0.1
    
    // Penalize labels with parentheses
    if (clean.includes('(')) score -= 10
    
    // Prefer labels that start with uppercase (proper nouns)
    if (/^[A-ZÄÖÜ]/.test(clean)) score += 5
    
    // Prefer labels without too many hyphens
    const hyphenCount = (clean.match(/-/g) || []).length
    score -= hyphenCount * 2
    
    // Prefer German over English if both present (for German app)
    if (/[äöüßÄÖÜ]/.test(clean)) score += 3
    
    return { label: clean, score }
  })
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)
  
  return scored[0].label
}

// ============================================================================
// Tag Registry Persistence
// ============================================================================

/**
 * Load all module tag registries from storage
 */
async function loadAllRegistries(): Promise<ModuleTagRegistry[]> {
  await storageReady
  return getCollection<ModuleTagRegistry>(STORAGE_KEY)
}

/**
 * Save all module tag registries to storage
 */
async function saveAllRegistries(registries: ModuleTagRegistry[]): Promise<void> {
  await storageReady
  await setCollection(STORAGE_KEY, registries)
}

/**
 * Get the tag registry for a specific module
 */
export async function getModuleTagRegistry(moduleId: string): Promise<ModuleTagRegistry> {
  const registries = await loadAllRegistries()
  const existing = registries.find(r => r.moduleId === moduleId)
  
  if (existing) return existing
  
  // Return empty registry
  return {
    moduleId,
    entries: [],
    lastUpdatedAt: new Date().toISOString(),
    version: REGISTRY_VERSION
  }
}

/**
 * Save a module's tag registry
 */
export async function saveModuleTagRegistry(registry: ModuleTagRegistry): Promise<void> {
  const registries = await loadAllRegistries()
  const existingIndex = registries.findIndex(r => r.moduleId === registry.moduleId)
  
  registry.lastUpdatedAt = new Date().toISOString()
  
  if (existingIndex >= 0) {
    registries[existingIndex] = registry
  } else {
    registries.push(registry)
  }
  
  await saveAllRegistries(registries)
}

/**
 * Delete a module's tag registry (e.g., when module is deleted)
 */
export async function deleteModuleTagRegistry(moduleId: string): Promise<void> {
  const registries = await loadAllRegistries()
  const filtered = registries.filter(r => r.moduleId !== moduleId)
  await saveAllRegistries(filtered)
}

// ============================================================================
// Tag Normalization
// ============================================================================

/**
 * Find an existing registry entry that matches a tag
 */
function findMatchingEntry(
  tag: string,
  registry: ModuleTagRegistry
): TagRegistryEntry | null {
  const tagKey = canonicalKey(tag)
  const cleanedTag = cleanLabel(tag)
  
  for (const entry of registry.entries) {
    // Direct canonical key match
    if (entry.canonicalKey === tagKey) {
      return entry
    }
    
    // Check synonyms
    if (entry.synonyms.some(s => canonicalKey(s) === tagKey)) {
      return entry
    }
    
    // Check if keys are synonym-equivalent
    if (areCanonicalKeysSynonyms(entry.canonicalKey, tagKey)) {
      return entry
    }
  }
  
  return null
}

/**
 * Normalize a set of tags using the module's tag registry.
 * 
 * This is the main function to call when processing tags from LLM output
 * or user input.
 * 
 * @param tags - Raw tags to normalize
 * @param moduleId - Module to use for registry lookup
 * @returns Normalized tags with mapping information
 */
export async function normalizeTags(
  tags: string[],
  moduleId: string
): Promise<NormalizedTagsResult> {
  const registry = await getModuleTagRegistry(moduleId)
  const result: NormalizedTagsResult = {
    tags: [],
    mappedSynonyms: [],
    newEntries: []
  }
  
  const seenKeys = new Set<string>()
  
  for (const rawTag of tags) {
    if (!rawTag || typeof rawTag !== 'string') continue
    
    const cleanedTag = cleanLabel(rawTag)
    if (!cleanedTag) continue
    
    const tagKey = canonicalKey(cleanedTag)
    
    // Skip if we've already processed this canonical key
    if (seenKeys.has(tagKey)) continue
    seenKeys.add(tagKey)
    
    // Try to find existing entry
    const existingEntry = findMatchingEntry(cleanedTag, registry)
    
    if (existingEntry) {
      // Use the existing label
      result.tags.push(existingEntry.label)
      
      // Track if this was a synonym mapping
      if (existingEntry.canonicalKey !== tagKey) {
        result.mappedSynonyms.push({
          original: cleanedTag,
          mappedTo: existingEntry.label
        })
      }
      
      // Update usage stats
      existingEntry.usageCount++
      existingEntry.lastUsedAt = new Date().toISOString()
      
      // Add as synonym if not already present
      if (!existingEntry.synonyms.includes(cleanedTag) && 
          existingEntry.label !== cleanedTag) {
        existingEntry.synonyms.push(cleanedTag)
      }
    } else {
      // Create new entry
      const newEntry: TagRegistryEntry = {
        canonicalKey: tagKey,
        label: cleanedTag,
        synonyms: [],
        usageCount: 1,
        lastUsedAt: new Date().toISOString()
      }
      
      registry.entries.push(newEntry)
      result.tags.push(cleanedTag)
      result.newEntries.push(cleanedTag)
    }
  }
  
  // Save updated registry
  await saveModuleTagRegistry(registry)
  
  return result
}

/**
 * Get all known tags for a module (for LLM prompts)
 */
export async function getModuleAllowedTags(moduleId: string): Promise<string[]> {
  const registry = await getModuleTagRegistry(moduleId)
  
  // Sort by usage count (most used first)
  const sorted = [...registry.entries].sort((a, b) => b.usageCount - a.usageCount)
  
  return sorted.map(e => e.label)
}

/**
 * Format allowed tags for inclusion in LLM prompt
 */
export function formatAllowedTagsForPrompt(allowedTags: string[]): string {
  if (allowedTags.length === 0) return ''
  
  return `
Bevorzugte Tags (verwende diese wenn passend):
${allowedTags.slice(0, 30).map(t => `- "${t}"`).join('\n')}

Wichtig: Verwende bevorzugt Tags aus dieser Liste. Erstelle nur neue Tags, wenn kein passender existiert.
`.trim()
}

// ============================================================================
// Migration & Cleanup
// ============================================================================

/**
 * Migrate existing tasks' tags to use normalized versions.
 * This is a one-time operation to clean up legacy data.
 * 
 * @param tasks - All tasks from the database
 * @param updateTask - Function to update a single task
 * @returns Migration statistics
 */
export async function migrateExistingTags(
  tasks: Array<{ id: string; moduleId: string; tags?: string[] }>,
  updateTask: (taskId: string, updates: { tags: string[] }) => Promise<void>
): Promise<{
  tasksProcessed: number
  tagsNormalized: number
  errors: string[]
}> {
  const stats = {
    tasksProcessed: 0,
    tagsNormalized: 0,
    errors: [] as string[]
  }
  
  // Group tasks by module for efficient registry access
  const tasksByModule = new Map<string, typeof tasks>()
  for (const task of tasks) {
    if (!task.tags || task.tags.length === 0) continue
    
    const moduleTasks = tasksByModule.get(task.moduleId) || []
    moduleTasks.push(task)
    tasksByModule.set(task.moduleId, moduleTasks)
  }
  
  // Process each module's tasks
  for (const [moduleId, moduleTasks] of tasksByModule) {
    for (const task of moduleTasks) {
      try {
        if (!task.tags || task.tags.length === 0) continue
        
        const result = await normalizeTags(task.tags, moduleId)
        
        // Check if tags actually changed
        const tagsChanged = 
          result.tags.length !== task.tags.length ||
          result.tags.some((t, i) => t !== task.tags![i])
        
        if (tagsChanged) {
          await updateTask(task.id, { tags: result.tags })
          stats.tagsNormalized += result.mappedSynonyms.length
        }
        
        stats.tasksProcessed++
      } catch (error) {
        stats.errors.push(`Task ${task.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  
  return stats
}

/**
 * Merge two tag entries in a registry (when user confirms they're the same)
 */
export async function mergeTagEntries(
  moduleId: string,
  keepKey: string,
  mergeKey: string
): Promise<void> {
  const registry = await getModuleTagRegistry(moduleId)
  
  const keepEntry = registry.entries.find(e => e.canonicalKey === keepKey)
  const mergeEntry = registry.entries.find(e => e.canonicalKey === mergeKey)
  
  if (!keepEntry || !mergeEntry) {
    throw new Error('One or both tag entries not found')
  }
  
  // Add merge entry's label and synonyms to keep entry
  if (!keepEntry.synonyms.includes(mergeEntry.label)) {
    keepEntry.synonyms.push(mergeEntry.label)
  }
  for (const syn of mergeEntry.synonyms) {
    if (!keepEntry.synonyms.includes(syn) && syn !== keepEntry.label) {
      keepEntry.synonyms.push(syn)
    }
  }
  
  // Combine usage counts
  keepEntry.usageCount += mergeEntry.usageCount
  
  // Remove the merged entry
  registry.entries = registry.entries.filter(e => e.canonicalKey !== mergeKey)
  
  await saveModuleTagRegistry(registry)
}

/**
 * Rename a tag's display label
 */
export async function renameTagLabel(
  moduleId: string,
  canonicalKey: string,
  newLabel: string
): Promise<void> {
  const registry = await getModuleTagRegistry(moduleId)
  
  const entry = registry.entries.find(e => e.canonicalKey === canonicalKey)
  if (!entry) {
    throw new Error('Tag entry not found')
  }
  
  // Add old label as synonym if not already present
  if (!entry.synonyms.includes(entry.label)) {
    entry.synonyms.push(entry.label)
  }
  
  entry.label = cleanLabel(newLabel)
  
  await saveModuleTagRegistry(registry)
}

// ============================================================================
// Utility Functions for Learning Blocks
// ============================================================================

/**
 * Get the canonical key for a topic (for grouping learning blocks)
 * This ensures "Quine-McCluskey" and "Minimierung (Quine-McCluskey)" 
 * end up in the same learning block.
 */
export function getTopicCanonicalKey(topic: string): string {
  return canonicalKey(topic)
}

/**
 * Group tasks by canonical topic key
 */
export function groupTasksByCanonicalTopic<T extends { topic?: string }>(
  tasks: T[]
): Map<string, { label: string; tasks: T[] }> {
  const groups = new Map<string, { label: string; tasks: T[] }>()
  
  for (const task of tasks) {
    if (!task.topic) continue
    
    const key = canonicalKey(task.topic)
    const existing = groups.get(key)
    
    if (existing) {
      existing.tasks.push(task)
      // Update label to prefer the most common/best form
      const allLabels = existing.tasks.map(t => t.topic).filter(Boolean) as string[]
      existing.label = selectBestLabel(allLabels)
    } else {
      groups.set(key, {
        label: cleanLabel(task.topic),
        tasks: [task]
      })
    }
  }
  
  return groups
}

/**
 * Group items by canonical tag key
 */
export function groupByCanonicalTag<T extends { tags?: string[] }>(
  items: T[]
): Map<string, { label: string; items: T[] }> {
  const groups = new Map<string, { label: string; items: T[] }>()
  
  for (const item of items) {
    if (!item.tags) continue
    
    for (const tag of item.tags) {
      const key = canonicalKey(tag)
      const existing = groups.get(key)
      
      if (existing) {
        existing.items.push(item)
      } else {
        groups.set(key, {
          label: cleanLabel(tag),
          items: [item]
        })
      }
    }
  }
  
  return groups
}
