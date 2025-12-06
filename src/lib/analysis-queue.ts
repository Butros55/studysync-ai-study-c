/**
 * Analysis Queue System
 * 
 * Provides a singleton queue that processes document analysis jobs one at a time.
 * The queue state is persisted to storage for resilience across browser refreshes.
 * 
 * Features:
 * - Only one job running at a time (serial processing)
 * - Queue state persisted to localStorage/IndexedDB
 * - On startup, any 'running' records are reset to 'queued'
 * - Progress callbacks for UI integration
 * - Automatically triggers module profile rebuild after analysis completes
 */

import { analyzeDocumentToJson, needsAnalysis } from './document-analyzer'
import { getDocumentAnalysis, upsertDocumentAnalysis, listDocumentAnalyses } from './analysis-storage'
import { buildModuleProfiles } from './module-profile-builder'
import type { DocumentAnalysisRecord, DocumentType } from './analysis-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalysisJob {
  id: string                // unique job id (usually documentId)
  moduleId: string
  documentId: string
  documentType: DocumentType
  documentName: string
  text: string
  priority: number          // higher = run first
  addedAt: number           // timestamp
}

export interface AnalysisQueueState {
  queue: AnalysisJob[]
  currentJob: AnalysisJob | null
}

export type AnalysisProgressCallback = (
  job: AnalysisJob,
  status: 'queued' | 'running' | 'completed' | 'error',
  progress: number,
  error?: string
) => void

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = 'analysis_queue_state'

// ---------------------------------------------------------------------------
// Singleton Queue
// ---------------------------------------------------------------------------

class AnalysisQueueSingleton {
  private state: AnalysisQueueState = { queue: [], currentJob: null }
  private isProcessing = false
  private progressCallbacks: Set<AnalysisProgressCallback> = new Set()

  constructor() {
    this.loadFromStorage()
    this.resetStaleRunningRecords()
  }

  /**
   * Load queue state from storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AnalysisQueueState
        // Only restore the queue, not currentJob (if app crashed mid-job)
        this.state.queue = parsed.queue || []
        // If there was a currentJob, re-add it to the front of the queue
        if (parsed.currentJob) {
          this.state.queue.unshift(parsed.currentJob)
        }
      }
    } catch (e) {
      console.warn('[AnalysisQueue] Failed to load state from storage:', e)
    }
  }

  /**
   * Save queue state to storage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.warn('[AnalysisQueue] Failed to save state to storage:', e)
    }
  }

  /**
   * On startup, reset any 'running' analysis records to 'queued' status
   * (in case the app crashed mid-analysis)
   */
  private async resetStaleRunningRecords(): Promise<void> {
    try {
      const allAnalyses = await listDocumentAnalyses()
      for (const record of allAnalyses) {
        if (record.status === 'running') {
          await upsertDocumentAnalysis({
            ...record,
            status: 'queued',
            updatedAt: Date.now()
          })
        }
      }
    } catch (e) {
      console.warn('[AnalysisQueue] Failed to reset stale running records:', e)
    }
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: AnalysisProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  /**
   * Notify all progress callbacks
   */
  private notifyProgress(
    job: AnalysisJob,
    status: 'queued' | 'running' | 'completed' | 'error',
    progress: number,
    error?: string
  ): void {
    for (const cb of this.progressCallbacks) {
      try {
        cb(job, status, progress, error)
      } catch (e) {
        console.error('[AnalysisQueue] Progress callback error:', e)
      }
    }
  }

  /**
   * Add a job to the queue
   */
  async enqueue(job: Omit<AnalysisJob, 'id' | 'priority' | 'addedAt'>): Promise<string> {
    const fullJob: AnalysisJob = {
      ...job,
      id: job.documentId,
      priority: 0,
      addedAt: Date.now()
    }

    // Check if already in queue
    const existingIndex = this.state.queue.findIndex(j => j.documentId === job.documentId)
    if (existingIndex >= 0) {
      // Update existing job
      this.state.queue[existingIndex] = fullJob
    } else if (this.state.currentJob?.documentId === job.documentId) {
      // Currently processing this document - will re-queue after completion
      // For now, just return the id
      return fullJob.id
    } else {
      // Add to queue
      this.state.queue.push(fullJob)
    }

    // Create initial analysis record with 'queued' status
    const existingRecord = await getDocumentAnalysis(job.moduleId, job.documentId)
    await upsertDocumentAnalysis({
      moduleId: job.moduleId,
      documentId: job.documentId,
      status: 'queued',
      result: existingRecord?.result || null,
      sourceHash: existingRecord?.sourceHash || '',
      version: existingRecord?.version || '1.0.0',
      createdAt: existingRecord?.createdAt || Date.now(),
      updatedAt: Date.now()
    })

    this.saveToStorage()
    this.notifyProgress(fullJob, 'queued', 0)

    // Start processing if not already
    this.processQueue()

    return fullJob.id
  }

  /**
   * Enqueue analysis for a document, checking if analysis is needed first
   */
  async enqueueIfNeeded(job: Omit<AnalysisJob, 'id' | 'priority' | 'addedAt'>): Promise<string | null> {
    const needs = await needsAnalysis(job.moduleId, job.documentId, job.text)
    if (needs) {
      return this.enqueue(job)
    }
    return null
  }

  /**
   * Remove a job from the queue (e.g., when document is deleted)
   */
  removeFromQueue(documentId: string): void {
    this.state.queue = this.state.queue.filter(j => j.documentId !== documentId)
    this.saveToStorage()
  }

  /**
   * Get current queue state
   */
  getState(): AnalysisQueueState {
    return { ...this.state }
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.state.queue.length + (this.state.currentJob ? 1 : 0)
  }

  /**
   * Check if a document is currently being analyzed or queued
   */
  isDocumentQueued(documentId: string): boolean {
    return (
      this.state.currentJob?.documentId === documentId ||
      this.state.queue.some(j => j.documentId === documentId)
    )
  }

  /**
   * Process the queue (one job at a time)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    if (this.state.queue.length === 0) return

    this.isProcessing = true

    while (this.state.queue.length > 0) {
      // Sort by priority (higher first), then by addedAt (older first)
      this.state.queue.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return a.addedAt - b.addedAt
      })

      // Take the first job
      const job = this.state.queue.shift()!
      this.state.currentJob = job
      this.saveToStorage()

      this.notifyProgress(job, 'running', 10)

      try {
        // Update record to 'running'
        const existingRecord = await getDocumentAnalysis(job.moduleId, job.documentId)
        await upsertDocumentAnalysis({
          moduleId: job.moduleId,
          documentId: job.documentId,
          status: 'running',
          result: existingRecord?.result || null,
          sourceHash: existingRecord?.sourceHash || '',
          version: existingRecord?.version || '1.0.0',
          createdAt: existingRecord?.createdAt || Date.now(),
          updatedAt: Date.now()
        })

        this.notifyProgress(job, 'running', 30)

        // Run the analysis
        const record = await analyzeDocumentToJson({
          moduleId: job.moduleId,
          documentId: job.documentId,
          documentType: job.documentType,
          text: job.text
        })

        this.notifyProgress(job, 'completed', 100)

        console.log(`[AnalysisQueue] Completed analysis for ${job.documentName}`)

        // Trigger module profile rebuild in background
        buildModuleProfiles(job.moduleId).catch((err) => {
          console.warn(`[AnalysisQueue] Failed to rebuild module profile after analysis:`, err)
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AnalysisQueue] Error analyzing ${job.documentName}:`, error)

        // Update record to 'error'
        const existingRecord = await getDocumentAnalysis(job.moduleId, job.documentId)
        await upsertDocumentAnalysis({
          moduleId: job.moduleId,
          documentId: job.documentId,
          status: 'error',
          result: existingRecord?.result || null,
          sourceHash: existingRecord?.sourceHash || '',
          version: existingRecord?.version || '1.0.0',
          createdAt: existingRecord?.createdAt || Date.now(),
          updatedAt: Date.now(),
          errorMessage
        })

        this.notifyProgress(job, 'error', 0, errorMessage)
      }

      this.state.currentJob = null
      this.saveToStorage()
    }

    this.isProcessing = false
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let queueInstance: AnalysisQueueSingleton | null = null

export function getAnalysisQueue(): AnalysisQueueSingleton {
  if (!queueInstance) {
    queueInstance = new AnalysisQueueSingleton()
  }
  return queueInstance
}

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

/**
 * Enqueue a document for analysis
 */
export async function enqueueAnalysis(
  moduleId: string,
  documentId: string,
  documentType: DocumentType,
  documentName: string,
  text: string
): Promise<string> {
  return getAnalysisQueue().enqueue({
    moduleId,
    documentId,
    documentType,
    documentName,
    text
  })
}

/**
 * Enqueue a document for analysis only if it needs re-analysis
 */
export async function enqueueAnalysisIfNeeded(
  moduleId: string,
  documentId: string,
  documentType: DocumentType,
  documentName: string,
  text: string
): Promise<string | null> {
  return getAnalysisQueue().enqueueIfNeeded({
    moduleId,
    documentId,
    documentType,
    documentName,
    text
  })
}

/**
 * Remove a document from the analysis queue
 */
export function removeFromAnalysisQueue(documentId: string): void {
  getAnalysisQueue().removeFromQueue(documentId)
}

/**
 * Subscribe to analysis progress updates
 */
export function onAnalysisProgress(callback: AnalysisProgressCallback): () => void {
  return getAnalysisQueue().onProgress(callback)
}

/**
 * Check if a document is queued or being analyzed
 */
export function isDocumentInAnalysisQueue(documentId: string): boolean {
  return getAnalysisQueue().isDocumentQueued(documentId)
}

/**
 * Get the current analysis queue length
 */
export function getAnalysisQueueLength(): number {
  return getAnalysisQueue().getQueueLength()
}
