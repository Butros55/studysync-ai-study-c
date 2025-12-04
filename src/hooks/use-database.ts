import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type ApiResource = 'modules' | 'scripts' | 'notes' | 'tasks' | 'flashcards'

interface UseDBOptions<T> {
  resource: ApiResource
  defaultValue: T[]
}

export function useDB<T extends { id: string }>({ resource, defaultValue }: UseDBOptions<T>) {
  const [data, setData] = useState<T[]>(defaultValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lade Daten vom Server
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/${resource}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      console.error(`[useDB] Fehler beim Laden von ${resource}:`, err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [resource])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Erstelle neuen Eintrag
  const create = useCallback(async (item: T) => {
    try {
      const response = await fetch(`${API_URL}/api/${resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const created = await response.json()
      setData(prev => [...prev, created])
      return created
    } catch (err) {
      console.error(`[useDB] Fehler beim Erstellen in ${resource}:`, err)
      throw err
    }
  }, [resource])

  // Aktualisiere Eintrag
  const update = useCallback(async (id: string, updates: Partial<T>) => {
    try {
      const response = await fetch(`${API_URL}/api/${resource}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const updated = await response.json()
      setData(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item))
      return updated
    } catch (err) {
      console.error(`[useDB] Fehler beim Aktualisieren in ${resource}:`, err)
      throw err
    }
  }, [resource])

  // Lösche Eintrag
  const remove = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/${resource}/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setData(prev => prev.filter(item => item.id !== id))
      return true
    } catch (err) {
      console.error(`[useDB] Fehler beim Löschen in ${resource}:`, err)
      throw err
    }
  }, [resource])

  // Setze Daten direkt (für Batch-Operationen)
  const setItems = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setData(updater)
  }, [])

  // Füge mehrere Items hinzu (für Batch-Erstellung)
  const createMany = useCallback(async (items: T[]) => {
    const created: T[] = []
    for (const item of items) {
      const result = await create(item)
      created.push(result)
    }
    return created
  }, [create])

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

// Typ-sichere Wrapper-Hooks für jede Ressource
export function useModules() {
  return useDB<import('@/lib/types').Module>({ resource: 'modules', defaultValue: [] })
}

export function useScripts() {
  return useDB<import('@/lib/types').Script>({ resource: 'scripts', defaultValue: [] })
}

export function useNotes() {
  return useDB<import('@/lib/types').StudyNote>({ resource: 'notes', defaultValue: [] })
}

export function useTasks() {
  return useDB<import('@/lib/types').Task>({ resource: 'tasks', defaultValue: [] })
}

export function useFlashcards() {
  return useDB<import('@/lib/types').Flashcard>({ resource: 'flashcards', defaultValue: [] })
}
