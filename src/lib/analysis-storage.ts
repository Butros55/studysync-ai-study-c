/**
 * Persistence layer for Document Analysis, Module Profiles, and User Preferences
 * 
 * Uses the existing storage abstraction (IndexedDB/localStorage/Memory)
 * to persist analysis data across sessions.
 */

import { storage, storageReady, getCollection, setCollection } from './storage'
import type { 
  DocumentAnalysisRecord, 
  ModuleProfileRecord, 
  UserPreferences,
  InputMode 
} from './analysis-types'

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  /** Collection of all document analyses */
  documentAnalyses: 'document_analyses',
  
  /** Collection of all module profiles */
  moduleProfiles: 'module_profiles',
  
  /** User preferences (single object, not collection) */
  userPreferences: 'user_preferences',
} as const

// ============================================================================
// Document Analysis API
// ============================================================================

/**
 * Get a specific document's analysis record
 * 
 * @param moduleId - The module the document belongs to
 * @param documentId - The document (script) ID
 * @returns The analysis record or null if not found
 */
export async function getDocumentAnalysis(
  moduleId: string,
  documentId: string
): Promise<DocumentAnalysisRecord | null> {
  await storageReady
  const analyses = await getCollection<DocumentAnalysisRecord>(STORAGE_KEYS.documentAnalyses)
  
  const found = analyses.find(
    a => a.moduleId === moduleId && a.documentId === documentId
  )
  
  return found ?? null
}

/**
 * Create or update a document analysis record
 * 
 * @param record - The analysis record to upsert
 * @returns The upserted record
 */
export async function upsertDocumentAnalysis(
  record: DocumentAnalysisRecord
): Promise<DocumentAnalysisRecord> {
  await storageReady
  const analyses = await getCollection<DocumentAnalysisRecord>(STORAGE_KEYS.documentAnalyses)
  
  const existingIndex = analyses.findIndex(
    a => a.moduleId === record.moduleId && a.documentId === record.documentId
  )
  
  if (existingIndex >= 0) {
    // Update existing
    analyses[existingIndex] = record
  } else {
    // Add new
    analyses.push(record)
  }
  
  await setCollection(STORAGE_KEYS.documentAnalyses, analyses)
  return record
}

/**
 * List all document analyses for a module
 * 
 * @param moduleId - The module to list analyses for
 * @returns Array of analysis records for the module
 */
export async function listDocumentAnalyses(
  moduleId: string
): Promise<DocumentAnalysisRecord[]> {
  await storageReady
  const analyses = await getCollection<DocumentAnalysisRecord>(STORAGE_KEYS.documentAnalyses)
  
  return analyses.filter(a => a.moduleId === moduleId)
}

/**
 * Delete a document analysis record
 * 
 * @param moduleId - The module the document belongs to
 * @param documentId - The document ID
 * @returns true if deleted, false if not found
 */
export async function deleteDocumentAnalysis(
  moduleId: string,
  documentId: string
): Promise<boolean> {
  await storageReady
  const analyses = await getCollection<DocumentAnalysisRecord>(STORAGE_KEYS.documentAnalyses)
  
  const filtered = analyses.filter(
    a => !(a.moduleId === moduleId && a.documentId === documentId)
  )
  
  if (filtered.length === analyses.length) {
    return false
  }
  
  await setCollection(STORAGE_KEYS.documentAnalyses, filtered)
  return true
}

/**
 * Delete all document analyses for a module
 * 
 * @param moduleId - The module to delete analyses for
 * @returns Number of records deleted
 */
export async function deleteModuleDocumentAnalyses(
  moduleId: string
): Promise<number> {
  await storageReady
  const analyses = await getCollection<DocumentAnalysisRecord>(STORAGE_KEYS.documentAnalyses)
  
  const filtered = analyses.filter(a => a.moduleId !== moduleId)
  const deletedCount = analyses.length - filtered.length
  
  await setCollection(STORAGE_KEYS.documentAnalyses, filtered)
  return deletedCount
}

// ============================================================================
// Module Profile API
// ============================================================================

/**
 * Get a module's aggregated profile
 * 
 * @param moduleId - The module ID
 * @returns The module profile or null if not found
 */
export async function getModuleProfile(
  moduleId: string
): Promise<ModuleProfileRecord | null> {
  await storageReady
  const profiles = await getCollection<ModuleProfileRecord>(STORAGE_KEYS.moduleProfiles)
  
  const found = profiles.find(p => p.moduleId === moduleId)
  return found ?? null
}

/**
 * Create or update a module profile
 * 
 * @param record - The profile record to upsert
 * @returns The upserted record
 */
export async function upsertModuleProfile(
  record: ModuleProfileRecord
): Promise<ModuleProfileRecord> {
  await storageReady
  const profiles = await getCollection<ModuleProfileRecord>(STORAGE_KEYS.moduleProfiles)
  
  const existingIndex = profiles.findIndex(p => p.moduleId === record.moduleId)
  
  if (existingIndex >= 0) {
    // Update existing
    profiles[existingIndex] = record
  } else {
    // Add new
    profiles.push(record)
  }
  
  await setCollection(STORAGE_KEYS.moduleProfiles, profiles)
  return record
}

/**
 * Delete a module's profile
 * 
 * @param moduleId - The module ID
 * @returns true if deleted, false if not found
 */
export async function deleteModuleProfile(
  moduleId: string
): Promise<boolean> {
  await storageReady
  const profiles = await getCollection<ModuleProfileRecord>(STORAGE_KEYS.moduleProfiles)
  
  const filtered = profiles.filter(p => p.moduleId !== moduleId)
  
  if (filtered.length === profiles.length) {
    return false
  }
  
  await setCollection(STORAGE_KEYS.moduleProfiles, filtered)
  return true
}

/**
 * List all module profiles
 * 
 * @returns Array of all module profile records
 */
export async function listModuleProfiles(): Promise<ModuleProfileRecord[]> {
  await storageReady
  return getCollection<ModuleProfileRecord>(STORAGE_KEYS.moduleProfiles)
}

// ============================================================================
// User Preferences API
// ============================================================================

/**
 * Get all user preferences
 * 
 * @returns User preferences object (empty object if not set)
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  await storageReady
  const prefs = await storage.getItem<UserPreferences>(STORAGE_KEYS.userPreferences)
  return prefs ?? {}
}

/**
 * Update user preferences (partial update)
 * 
 * @param updates - Partial preferences to merge
 * @returns Updated preferences object
 */
export async function updateUserPreferences(
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  await storageReady
  const current = await getUserPreferences()
  const updated: UserPreferences = { ...current, ...updates }
  await storage.setItem(STORAGE_KEYS.userPreferences, updated)
  return updated
}

/**
 * Get user's preferred input mode for task solving
 * 
 * @returns The preferred input mode, or undefined if not set
 */
export async function getUserPreferencePreferredInputMode(): Promise<InputMode | undefined> {
  const prefs = await getUserPreferences()
  return prefs.preferredInputMode
}

/**
 * Set user's preferred input mode for task solving
 * 
 * @param mode - The input mode to set ('type' or 'draw')
 */
export async function setUserPreferencePreferredInputMode(
  mode: InputMode
): Promise<void> {
  await updateUserPreferences({ preferredInputMode: mode })
}

/**
 * Clear user's preferred input mode (reset to unset)
 */
export async function clearUserPreferencePreferredInputMode(): Promise<void> {
  await storageReady
  const current = await getUserPreferences()
  const { preferredInputMode: _, ...rest } = current
  await storage.setItem(STORAGE_KEYS.userPreferences, rest)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute a simple hash of a string (for sourceHash field)
 * Uses a fast, non-cryptographic hash suitable for cache invalidation
 * 
 * @param text - The text to hash
 * @returns A hex string hash
 */
export function computeSourceHash(text: string): string {
  // Simple djb2 hash algorithm
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i)
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Compute an aggregate hash from multiple source hashes
 * 
 * @param hashes - Array of individual source hashes
 * @returns Combined hash string
 */
export function computeAggregateHash(hashes: string[]): string {
  if (hashes.length === 0) return '00000000'
  
  // Sort for consistency, then combine
  const sorted = [...hashes].sort()
  return computeSourceHash(sorted.join(':'))
}

/**
 * Check if a document analysis needs to be re-run
 * 
 * @param record - The existing analysis record
 * @param currentHash - Hash of current document content
 * @param currentVersion - Current analysis version
 * @returns true if analysis should be re-run
 */
export function isAnalysisStale(
  record: DocumentAnalysisRecord | null,
  currentHash: string,
  currentVersion: string
): boolean {
  if (!record) return true
  if (record.status === 'error') return true
  if (record.sourceHash !== currentHash) return true
  if (record.analysisVersion !== currentVersion) return true
  return false
}

/**
 * Check if a module profile needs to be rebuilt
 * 
 * @param profile - The existing profile record
 * @param currentAggregateHash - Hash of all current document hashes
 * @param currentVersion - Current profile version
 * @returns true if profile should be rebuilt
 */
export function isProfileStale(
  profile: ModuleProfileRecord | null,
  currentAggregateHash: string,
  currentVersion: string
): boolean {
  if (!profile) return true
  if (profile.status === 'error') return true
  if (profile.sourceHashAggregate !== currentAggregateHash) return true
  if (profile.profileVersion !== currentVersion) return true
  return false
}
