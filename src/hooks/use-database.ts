/**
 * Browser-basierte Datenbank-Hooks für StudySync
 * 
 * Diese Hooks nutzen die robuste Storage-Abstraktion und funktionieren
 * auf allen Browsern (Desktop, iOS, Android) ohne Server.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  storage, 
  storageReady, 
  getCollection, 
  setCollection,
  setStorageError 
} from '@/lib/storage'
import type { Module, Script, StudyNote, Task, Flashcard } from '@/lib/types'

// Storage Keys
const STORAGE_KEYS = {
  modules: 'modules',
  scripts: 'scripts',
  notes: 'notes',
  tasks: 'tasks',
  flashcards: 'flashcards'
} as const

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

interface UseDBResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  create: (item: T) => Promise<T>
  createMany: (items: T[]) => Promise<T[]>
  update: (id: string, updates: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<boolean>
  refetch: () => Promise<void>
  setItems: (updater: T[] | ((prev: T[]) => T[])) => void
}

/**
 * Generischer Hook für Browser-basierte Datenpersistenz
 */
function useDB<T extends { id: string }>(storageKey: StorageKey): UseDBResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  // Lade Daten aus dem Browser-Storage
  const fetchData = useCallback(async () => {
    try {
      await storageReady
      const items = await getCollection<T>(storageKey)
      setData(items)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[useDB] Fehler beim Laden von ${storageKey}:`, err)
      setError(message)
      setStorageError(message)
    } finally {
      setLoading(false)
    }
  }, [storageKey])

  // Initial Load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      fetchData()
    }
  }, [fetchData])

  // Speichere Daten in den Storage
  const saveData = useCallback(async (items: T[]) => {
    try {
      await storageReady
      await setCollection(storageKey, items)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[useDB] Fehler beim Speichern von ${storageKey}:`, err)
      setError(message)
      setStorageError(message)
      throw err
    }
  }, [storageKey])

  // Erstelle neuen Eintrag
  const create = useCallback(async (item: T): Promise<T> => {
    const newData = [...data, item]
    setData(newData)
    await saveData(newData)
    return item
  }, [data, saveData])

  // Erstelle mehrere Einträge
  const createMany = useCallback(async (items: T[]): Promise<T[]> => {
    const newData = [...data, ...items]
    setData(newData)
    await saveData(newData)
    return items
  }, [data, saveData])

  // Aktualisiere Eintrag
  const update = useCallback(async (id: string, updates: Partial<T>): Promise<T> => {
    const index = data.findIndex(item => item.id === id)
    if (index === -1) {
      throw new Error(`Item with id ${id} not found in ${storageKey}`)
    }
    
    const updatedItem = { ...data[index], ...updates }
    const newData = [...data]
    newData[index] = updatedItem
    
    setData(newData)
    await saveData(newData)
    return updatedItem
  }, [data, saveData, storageKey])

  // Lösche Eintrag
  const remove = useCallback(async (id: string): Promise<boolean> => {
    const newData = data.filter(item => item.id !== id)
    if (newData.length === data.length) {
      return false
    }
    
    setData(newData)
    await saveData(newData)
    return true
  }, [data, saveData])

  // Setze Daten direkt (für Batch-Operationen)
  const setItems = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setData(prev => {
      const newData = typeof updater === 'function' ? updater(prev) : updater
      // Asynchron speichern
      saveData(newData).catch(console.error)
      return newData
    })
  }, [saveData])

  return {
    data,
    loading,
    error,
    create,
    createMany,
    update,
    remove,
    refetch: fetchData,
    setItems,
  }
}

// ============================================================================
// Typ-sichere Wrapper-Hooks für jede Ressource
// ============================================================================

export function useModules() {
  const db = useDB<Module>(STORAGE_KEYS.modules)
  
  // Sortiere nach Erstellungsdatum
  const sortedData = [...db.data].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  return {
    ...db,
    data: sortedData
  }
}

export function useScripts() {
  const db = useDB<Script>(STORAGE_KEYS.scripts)
  
  // Sortiere nach Upload-Datum
  const sortedData = [...db.data].sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )
  
  return {
    ...db,
    data: sortedData
  }
}

export function useNotes() {
  const db = useDB<StudyNote>(STORAGE_KEYS.notes)
  
  // Sortiere nach Update-Datum
  const sortedData = [...db.data].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  
  return {
    ...db,
    data: sortedData
  }
}

export function useTasks() {
  const db = useDB<Task>(STORAGE_KEYS.tasks)
  
  // Sortiere nach Erstellungsdatum
  const sortedData = [...db.data].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  return {
    ...db,
    data: sortedData
  }
}

export function useFlashcards() {
  const db = useDB<Flashcard>(STORAGE_KEYS.flashcards)
  
  // Sortiere nach Erstellungsdatum
  const sortedData = [...db.data].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  return {
    ...db,
    data: sortedData
  }
}

// ============================================================================
// Migration Helper: Importiere alte Server-Daten wenn vorhanden
// ============================================================================

export async function migrateFromServerIfNeeded(): Promise<boolean> {
  await storageReady
  
  // Prüfe ob bereits Daten im Browser-Storage sind
  const existingModules = await getCollection<Module>(STORAGE_KEYS.modules)
  if (existingModules.length > 0) {
    console.log('[Migration] Daten bereits im Browser-Storage vorhanden')
    return false
  }

  // Versuche Daten vom Server zu laden (falls verfügbar)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  
  try {
    const response = await fetch(`${API_URL}/api/modules`, {
      signal: AbortSignal.timeout(3000) // 3 Sekunden Timeout
    })
    
    if (!response.ok) {
      console.log('[Migration] Server nicht erreichbar, starte mit leerem Storage')
      return false
    }
    
    console.log('[Migration] Server-Daten gefunden, importiere...')
    
    // Importiere alle Ressourcen
    const resources = ['modules', 'scripts', 'notes', 'tasks', 'flashcards'] as const
    
    for (const resource of resources) {
      try {
        const res = await fetch(`${API_URL}/api/${resource}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            await setCollection(resource, data)
            console.log(`[Migration] ${resource}: ${data.length} Einträge importiert`)
          }
        }
      } catch {
        console.warn(`[Migration] Fehler beim Import von ${resource}`)
      }
    }
    
    console.log('[Migration] ✓ Migration abgeschlossen')
    return true
  } catch {
    console.log('[Migration] Server nicht erreichbar, starte mit leerem Storage')
    return false
  }
}

// ============================================================================
// Export/Import für Backup
// ============================================================================

export interface BackupData {
  version: number
  exportedAt: string
  modules: Module[]
  scripts: Script[]
  notes: StudyNote[]
  tasks: Task[]
  flashcards: Flashcard[]
}

export async function exportAllData(): Promise<BackupData> {
  await storageReady
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    modules: await getCollection<Module>(STORAGE_KEYS.modules),
    scripts: await getCollection<Script>(STORAGE_KEYS.scripts),
    notes: await getCollection<StudyNote>(STORAGE_KEYS.notes),
    tasks: await getCollection<Task>(STORAGE_KEYS.tasks),
    flashcards: await getCollection<Flashcard>(STORAGE_KEYS.flashcards),
  }
}

export async function importAllData(backup: BackupData): Promise<void> {
  await storageReady
  
  if (!backup.version || backup.version !== 1) {
    throw new Error('Ungültiges Backup-Format')
  }
  
  await setCollection(STORAGE_KEYS.modules, backup.modules || [])
  await setCollection(STORAGE_KEYS.scripts, backup.scripts || [])
  await setCollection(STORAGE_KEYS.notes, backup.notes || [])
  await setCollection(STORAGE_KEYS.tasks, backup.tasks || [])
  await setCollection(STORAGE_KEYS.flashcards, backup.flashcards || [])
  
  console.log('[Import] ✓ Backup importiert')
}

export async function clearAllData(): Promise<void> {
  await storageReady
  await storage.clear()
  console.log('[Storage] ✓ Alle Daten gelöscht')
}