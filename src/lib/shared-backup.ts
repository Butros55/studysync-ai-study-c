import { exportAllData, getCollection, setCollection, storageReady, type StudySyncExportData } from './storage'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function stripModuleUserState(module: any) {
  const clone = { ...module }
  delete clone.progress
  if (Array.isArray(clone.topicStats)) {
    clone.topicStats = []
  }
  if (Array.isArray(clone.learningBlocks)) {
    clone.learningBlocks = clone.learningBlocks.map((block: any) => ({
      ...block,
      completed: false,
      completedAt: undefined,
      completedTasks: [],
    }))
  }
  return clone
}

function stripTaskUserState(task: any) {
  const { completed, completedAt, viewedSolution, savedCanvasDataUrl, savedStrokes, ...rest } = task
  return rest
}

function stripFlashcardUserState(card: any) {
  const clone = { ...card }
  clone.interval = 0
  clone.repetitions = 0
  delete clone.lastReviewed
  delete clone.nextReview
  return clone
}

export function sanitizeBackupForSharing(exportData: StudySyncExportData): StudySyncExportData {
  const clone = deepClone(exportData)
  clone.data.modules = (clone.data.modules || []).map(stripModuleUserState)
  clone.data.tasks = (clone.data.tasks || []).map(stripTaskUserState)
  clone.data.flashcards = (clone.data.flashcards || []).map(stripFlashcardUserState)
  // Analysis/User-Preferences nicht mitsenden
  if ('analysisData' in clone) {
    delete (clone as any).analysisData
  }
  return clone
}

function mergeById<T extends { id?: string }>(
  existing: T[],
  incoming: T[],
  mergeFn: (incoming: T, existing?: T) => T
): T[] {
  const existingMap = new Map((existing || []).map((item) => [item.id, item]))
  const result: T[] = []
  incoming.forEach((item) => {
    const merged = mergeFn(item, existingMap.get(item.id))
    result.push(merged)
  })
  existing.forEach((item) => {
    if (!incoming.find((i) => i.id === item.id)) {
      result.push(item)
    }
  })
  return result
}

function preserveModuleUserState(incoming: any, existing?: any) {
  if (!existing) return incoming
  const merged = { ...incoming }
  merged.progress = existing.progress
  merged.topicStats = existing.topicStats ?? merged.topicStats

  if (Array.isArray(incoming.learningBlocks)) {
    const existingMap = new Map(
      (existing.learningBlocks || []).map((b: any) => [b.id, b])
    )
    merged.learningBlocks = incoming.learningBlocks.map((block: any) => {
      const prev = existingMap.get(block.id)
      if (!prev) {
        return { ...block, completed: false, completedTasks: [], completedAt: undefined }
      }
      return {
        ...block,
        completed: prev.completed,
        completedTasks: prev.completedTasks,
        completedAt: prev.completedAt,
      }
    })
  }

  return merged
}

function preserveTaskUserState(incoming: any, existing?: any) {
  if (!existing) return incoming
  return {
    ...incoming,
    completed: existing.completed,
    completedAt: existing.completedAt,
    viewedSolution: existing.viewedSolution,
    savedCanvasDataUrl: existing.savedCanvasDataUrl,
    savedStrokes: existing.savedStrokes,
  }
}

function preserveFlashcardUserState(incoming: any, existing?: any) {
  if (!existing) return incoming
  return {
    ...incoming,
    ease: existing.ease ?? incoming.ease,
    interval: existing.interval ?? incoming.interval ?? 0,
    repetitions: existing.repetitions ?? incoming.repetitions ?? 0,
    lastReviewed: existing.lastReviewed ?? incoming.lastReviewed,
    nextReview: existing.nextReview ?? incoming.nextReview,
  }
}

export async function importSharedBackup(backup: StudySyncExportData): Promise<Record<string, number>> {
  await storageReady
  const counts: Record<string, number> = {}

  // MODULES
  if (Array.isArray(backup.data.modules)) {
    const existingModules = await getCollection<any>('modules')
    const mergedModules = mergeById(existingModules, backup.data.modules as any[], preserveModuleUserState)
    await setCollection('modules', mergedModules)
    counts.modules = mergedModules.length
  }

  if (Array.isArray(backup.data.scripts)) {
    const existing = await getCollection<any>('scripts')
    const merged = mergeById(existing, backup.data.scripts as any[], (incoming) => incoming)
    await setCollection('scripts', merged)
    counts.scripts = merged.length
  }

  if (Array.isArray(backup.data.notes)) {
    const existing = await getCollection<any>('notes')
    const merged = mergeById(existing, backup.data.notes as any[], (incoming, existingNote) => ({
      ...(existingNote || {}),
      ...incoming,
    }))
    await setCollection('notes', merged)
    counts.notes = merged.length
  }

  if (Array.isArray(backup.data.tasks)) {
    const existing = await getCollection<any>('tasks')
    const merged = mergeById(existing, backup.data.tasks as any[], preserveTaskUserState)
    await setCollection('tasks', merged)
    counts.tasks = merged.length
  }

  if (Array.isArray(backup.data.flashcards)) {
    const existing = await getCollection<any>('flashcards')
    const merged = mergeById(existing, backup.data.flashcards as any[], preserveFlashcardUserState)
    await setCollection('flashcards', merged)
    counts.flashcards = merged.length
  }

  if (Array.isArray((backup as any).data?.moduleTagRegistries)) {
    const existing = await getCollection<any>('module_tag_registries')
    const merged = mergeById(existing, (backup as any).data.moduleTagRegistries as any[], (incoming) => incoming)
    await setCollection('module_tag_registries', merged)
    counts.module_tag_registries = merged.length
  }

  // Analysis/Profile optional, aber ohne User-Preferences überschreiben
  const analysis = (backup as any).analysisData
  if (analysis?.documentAnalyses) {
    const existing = await getCollection<any>('document_analyses')
    const merged = mergeById(existing, analysis.documentAnalyses as any[], (incoming) => incoming)
    await setCollection('document_analyses', merged)
    counts.document_analyses = merged.length
  }

  if (analysis?.moduleProfiles) {
    const existing = await getCollection<any>('module_profiles')
    const merged = mergeById(existing, analysis.moduleProfiles as any[], (incoming) => incoming)
    await setCollection('module_profiles', merged)
    counts.module_profiles = merged.length
  }

  return counts
}

export async function uploadSharedBackupToServer(apiBase: string = API_BASE_URL) {
  const exportData = await exportAllData()
  const sanitized = sanitizeBackupForSharing(exportData)
  const response = await fetch(`${apiBase}/api/shared-backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitized),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Upload fehlgeschlagen')
  }
  return response.json()
}

export async function downloadSharedBackupFromServer(apiBase: string = API_BASE_URL) {
  const response = await fetch(`${apiBase}/api/shared-backup`)
  if (response.status === 404) {
    throw new Error('Kein Server-Backup gefunden')
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Download fehlgeschlagen')
  }
  const payload = await response.json()
  if (!payload?.backup) {
    throw new Error('Ungültige Server-Antwort')
  }
  const counts = await importSharedBackup(payload.backup as StudySyncExportData)
  return { backup: payload.backup as StudySyncExportData, counts }
}
