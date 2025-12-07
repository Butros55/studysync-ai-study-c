/**
 * Analysis Migration V1 to V2
 * 
 * Handles migration of existing V1 document analyses to V2 schema.
 * Also provides utilities for checking migration status and batch migration.
 */

import { 
  listDocumentAnalyses,
  getDocumentAnalysis,
  upsertDocumentAnalysis
} from './analysis-storage'
import { 
  DocumentAnalysisRecord,
  DOCUMENT_ANALYSIS_VERSION 
} from './analysis-types'
import {
  ANALYSIS_SCHEMA_VERSION,
  DocumentAnalysisV2,
  isV1Analysis,
  migrateAnalysisV1ToV2
} from './analysis-types-v2'

// ============================================================================
// Migration Status
// ============================================================================

export interface MigrationStatus {
  /** Module ID */
  moduleId: string
  /** Total analyses */
  totalAnalyses: number
  /** Already V2 */
  v2Analyses: number
  /** V1 needing migration */
  v1Analyses: number
  /** Failed parses */
  failedParses: number
  /** Migration percent complete */
  percentComplete: number
}

/**
 * Check migration status for a module
 */
export async function checkMigrationStatus(moduleId: string): Promise<MigrationStatus> {
  const analyses = await listDocumentAnalyses(moduleId)
  
  let v2Count = 0
  let v1Count = 0
  let failedCount = 0
  
  for (const record of analyses) {
    if (record.status !== 'done' || !record.analysisJson) {
      continue
    }
    
    try {
      const parsed = JSON.parse(record.analysisJson)
      
      if (parsed.schemaVersion === '2.0.0') {
        v2Count++
      } else if (isV1Analysis(parsed)) {
        v1Count++
      } else {
        failedCount++
      }
    } catch {
      failedCount++
    }
  }
  
  const total = v2Count + v1Count + failedCount
  const percentComplete = total > 0 ? Math.round((v2Count / total) * 100) : 100
  
  return {
    moduleId,
    totalAnalyses: total,
    v2Analyses: v2Count,
    v1Analyses: v1Count,
    failedParses: failedCount,
    percentComplete
  }
}

// ============================================================================
// Migration Functions
// ============================================================================

export interface MigrationResult {
  /** Successfully migrated */
  migrated: number
  /** Already V2 (skipped) */
  skipped: number
  /** Failed migrations */
  failed: number
  /** Error messages */
  errors: Array<{ documentId: string; error: string }>
}

/**
 * Migrate all V1 analyses for a module to V2
 */
export async function migrateModuleAnalysesToV2(
  moduleId: string,
  onProgress?: (current: number, total: number) => void
): Promise<MigrationResult> {
  const analyses = await listDocumentAnalyses(moduleId)
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }
  
  const toMigrate = analyses.filter(a => a.status === 'done' && a.analysisJson)
  
  for (let i = 0; i < toMigrate.length; i++) {
    const record = toMigrate[i]
    
    if (onProgress) {
      onProgress(i + 1, toMigrate.length)
    }
    
    try {
      const parsed = JSON.parse(record.analysisJson!)
      
      // Check if already V2
      if (parsed.schemaVersion === '2.0.0') {
        result.skipped++
        continue
      }
      
      // Check if V1
      if (!isV1Analysis(parsed)) {
        result.errors.push({
          documentId: record.documentId,
          error: 'Unknown analysis version'
        })
        result.failed++
        continue
      }
      
      // Migrate V1 to V2
      const v2Analysis = migrateAnalysisV1ToV2(parsed, record.documentType)
      
      // Update record
      const updatedRecord: DocumentAnalysisRecord = {
        ...record,
        analysisJson: JSON.stringify(v2Analysis, null, 2),
        analysisVersion: ANALYSIS_SCHEMA_VERSION,
        lastAnalyzedAt: new Date().toISOString()
      }
      
      await upsertDocumentAnalysis(updatedRecord)
      result.migrated++
      
    } catch (error) {
      result.errors.push({
        documentId: record.documentId,
        error: error instanceof Error ? error.message : String(error)
      })
      result.failed++
    }
  }
  
  return result
}

/**
 * Migrate a single document analysis to V2
 */
export async function migrateDocumentAnalysisToV2(
  moduleId: string,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const record = await getDocumentAnalysis(moduleId, documentId)
  
  if (!record || !record.analysisJson) {
    return { success: false, error: 'Analysis record not found' }
  }
  
  try {
    const parsed = JSON.parse(record.analysisJson)
    
    // Check if already V2
    if (parsed.schemaVersion === '2.0.0') {
      return { success: true } // Already migrated
    }
    
    // Check if V1
    if (!isV1Analysis(parsed)) {
      return { success: false, error: 'Unknown analysis version' }
    }
    
    // Migrate
    const v2Analysis = migrateAnalysisV1ToV2(parsed, record.documentType)
    
    // Update record
    const updatedRecord: DocumentAnalysisRecord = {
      ...record,
      analysisJson: JSON.stringify(v2Analysis, null, 2),
      analysisVersion: ANALYSIS_SCHEMA_VERSION,
      lastAnalyzedAt: new Date().toISOString()
    }
    
    await upsertDocumentAnalysis(updatedRecord)
    
    return { success: true }
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// ============================================================================
// Version Checking Utilities
// ============================================================================

/**
 * Check if an analysis needs re-analysis (not just migration)
 * 
 * Some V1 analyses might benefit from full re-analysis
 * rather than just structural migration.
 */
export function shouldReanalyze(record: DocumentAnalysisRecord): boolean {
  // Always re-analyze if analysis is old
  if (!record.lastAnalyzedAt) return true
  
  const analyzedAt = new Date(record.lastAnalyzedAt)
  const ageInDays = (Date.now() - analyzedAt.getTime()) / (1000 * 60 * 60 * 24)
  
  // Re-analyze if older than 30 days
  if (ageInDays > 30) return true
  
  // Re-analyze if coverage is low
  if (record.coveragePercent !== undefined && record.coveragePercent < 50) return true
  
  // Re-analyze if there were errors
  if (record.errorMessage) return true
  
  // Check analysis content
  if (record.analysisJson) {
    try {
      const parsed = JSON.parse(record.analysisJson)
      
      // V1 analyses with few items should be re-analyzed
      if (isV1Analysis(parsed)) {
        const itemCount = parsed.items?.length || 0
        const topicCount = parsed.topics?.length || 0
        const conceptCount = parsed.concepts?.length || 0
        
        // Too few items extracted
        if (itemCount + topicCount + conceptCount < 5) return true
      }
    } catch {
      return true // Parse error - re-analyze
    }
  }
  
  return false
}

/**
 * Get analyses that should be re-analyzed
 */
export async function getAnalysesNeedingReanalysis(
  moduleId: string
): Promise<DocumentAnalysisRecord[]> {
  const analyses = await listDocumentAnalyses(moduleId)
  return analyses.filter(shouldReanalyze)
}

// ============================================================================
// Exports
// ============================================================================

export { isV1Analysis, migrateAnalysisV1ToV2 }
