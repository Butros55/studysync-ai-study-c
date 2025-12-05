/**
 * Universelle Storage-Abstraktion für StudySync
 * 
 * Diese Schicht sorgt dafür, dass die App auf ALLEN Browsern funktioniert:
 * - Bevorzugt: IndexedDB (große Datenmengen, binäre Dateien)
 * - Fallback: localStorage (falls IndexedDB nicht verfügbar)
 * - Notfall-Fallback: In-Memory (Session-only, wenn alles andere fehlschlägt)
 * 
 * KEINE Abhängigkeit von:
 * - navigator.storage.persist() Ergebnis
 * - File System Access API
 * - Server-Backend
 */

// ============================================================================
// Types
// ============================================================================

export interface StorageBackend {
  name: 'indexeddb' | 'localstorage' | 'memory'
  getItem<T>(key: string): Promise<T | null>
  setItem<T>(key: string, value: T): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
  getAllKeys(): Promise<string[]>
}

export interface StorageStatus {
  backend: 'indexeddb' | 'localstorage' | 'memory'
  persistentStorageAvailable: boolean
  persistentStorageGranted: boolean | null
  indexedDBAvailable: boolean
  localStorageAvailable: boolean
  fileSystemAccessAvailable: boolean
  estimatedQuota: number | null
  usedQuota: number | null
  lastError: string | null
}

// ============================================================================
// In-Memory Fallback Storage
// ============================================================================

class MemoryStorage implements StorageBackend {
  name: 'memory' = 'memory'
  private store: Map<string, string> = new Map()

  async getItem<T>(key: string): Promise<T | null> {
    const value = this.store.get(key)
    if (value === undefined) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value))
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }
}

// ============================================================================
// localStorage Wrapper
// ============================================================================

class LocalStorageBackend implements StorageBackend {
  name: 'localstorage' = 'localstorage'
  private prefix = 'studysync_'

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = localStorage.getItem(this.prefix + key)
      if (value === null) return null
      return JSON.parse(value) as T
    } catch (e) {
      console.warn('[LocalStorage] getItem failed:', key, e)
      return null
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value))
    } catch (e) {
      console.warn('[LocalStorage] setItem failed:', key, e)
      // Bei QuotaExceededError: Versuche alte Daten zu löschen
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[LocalStorage] Quota exceeded, trying to clear old data')
        this.tryFreeSpace()
        // Zweiter Versuch
        try {
          localStorage.setItem(this.prefix + key, JSON.stringify(value))
        } catch {
          throw new Error('Storage quota exceeded')
        }
      } else {
        throw e
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key)
    } catch (e) {
      console.warn('[LocalStorage] removeItem failed:', key, e)
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys()
      for (const key of keys) {
        localStorage.removeItem(this.prefix + key)
      }
    } catch (e) {
      console.warn('[LocalStorage] clear failed:', e)
    }
  }

  async getAllKeys(): Promise<string[]> {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length))
      }
    }
    return keys
  }

  private tryFreeSpace(): void {
    // Versuche, alte/große Einträge zu entfernen
    const keysToCheck = ['scripts', 'tasks', 'flashcards']
    for (const key of keysToCheck) {
      const fullKey = this.prefix + key
      const value = localStorage.getItem(fullKey)
      if (value && value.length > 1000000) { // > 1MB
        console.warn(`[LocalStorage] Removing large item: ${key}`)
        localStorage.removeItem(fullKey)
      }
    }
  }
}

// ============================================================================
// IndexedDB Wrapper
// ============================================================================

class IndexedDBStorage implements StorageBackend {
  name: 'indexeddb' = 'indexeddb'
  private dbName = 'studysync_db'
  private storeName = 'keyvalue'
  private dbVersion = 1
  private db: IDBDatabase | null = null
  private initPromise: Promise<boolean> | null = null

  async init(): Promise<boolean> {
    if (this.db) return true
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, this.dbVersion)

        request.onerror = () => {
          console.warn('[IndexedDB] Failed to open database:', request.error)
          this.initPromise = null
          resolve(false)
        }

        request.onsuccess = () => {
          this.db = request.result
          
          // Handle connection closing
          this.db.onclose = () => {
            this.db = null
            this.initPromise = null
          }
          
          this.db.onerror = (event) => {
            console.warn('[IndexedDB] Database error:', event)
          }
          
          resolve(true)
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName)
          }
        }

        request.onblocked = () => {
          console.warn('[IndexedDB] Database blocked - close other tabs')
          resolve(false)
        }
      } catch (e) {
        console.warn('[IndexedDB] Exception during init:', e)
        this.initPromise = null
        resolve(false)
      }
    })

    return this.initPromise
  }

  private async ensureDB(): Promise<IDBDatabase | null> {
    if (this.db) return this.db
    const success = await this.init()
    return success ? this.db : null
  }

  async getItem<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB()
    if (!db) return null

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(this.storeName, 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.get(key)

        request.onsuccess = () => {
          resolve(request.result ?? null)
        }
        request.onerror = () => {
          console.warn('[IndexedDB] getItem failed:', key, request.error)
          resolve(null)
        }
      } catch (e) {
        console.warn('[IndexedDB] getItem exception:', key, e)
        resolve(null)
      }
    })
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const db = await this.ensureDB()
    if (!db) throw new Error('IndexedDB not available')

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.put(value, key)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          console.warn('[IndexedDB] setItem failed:', key, request.error)
          reject(request.error)
        }
        
        transaction.onerror = () => {
          console.warn('[IndexedDB] Transaction error:', transaction.error)
          reject(transaction.error)
        }
      } catch (e) {
        console.warn('[IndexedDB] setItem exception:', key, e)
        reject(e)
      }
    })
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.ensureDB()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.delete(key)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          console.warn('[IndexedDB] removeItem failed:', key, request.error)
          resolve()
        }
      } catch (e) {
        console.warn('[IndexedDB] removeItem exception:', key, e)
        resolve()
      }
    })
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => {
          console.warn('[IndexedDB] clear failed:', request.error)
          resolve()
        }
      } catch (e) {
        console.warn('[IndexedDB] clear exception:', e)
        resolve()
      }
    })
  }

  async getAllKeys(): Promise<string[]> {
    const db = await this.ensureDB()
    if (!db) return []

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(this.storeName, 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.getAllKeys()

        request.onsuccess = () => {
          resolve(request.result.map(k => String(k)))
        }
        request.onerror = () => {
          console.warn('[IndexedDB] getAllKeys failed:', request.error)
          resolve([])
        }
      } catch (e) {
        console.warn('[IndexedDB] getAllKeys exception:', e)
        resolve([])
      }
    })
  }
}

// ============================================================================
// Feature Detection & Backend Selection
// ============================================================================

function isIndexedDBAvailable(): boolean {
  try {
    if (typeof indexedDB === 'undefined') return false
    // Einfacher Test ob IndexedDB funktioniert
    const testRequest = indexedDB.open('__test__')
    testRequest.onerror = () => {}
    testRequest.onsuccess = () => {
      testRequest.result.close()
      indexedDB.deleteDatabase('__test__')
    }
    return true
  } catch {
    return false
  }
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, testKey)
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function isFileSystemAccessAvailable(): boolean {
  return typeof window !== 'undefined' && 
         'showOpenFilePicker' in window
}

// ============================================================================
// Storage Status
// ============================================================================

let storageStatus: StorageStatus = {
  backend: 'memory',
  persistentStorageAvailable: false,
  persistentStorageGranted: null,
  indexedDBAvailable: false,
  localStorageAvailable: false,
  fileSystemAccessAvailable: false,
  estimatedQuota: null,
  usedQuota: null,
  lastError: null
}

export async function getStorageStatus(): Promise<StorageStatus> {
  // Feature detection
  storageStatus.indexedDBAvailable = isIndexedDBAvailable()
  storageStatus.localStorageAvailable = isLocalStorageAvailable()
  storageStatus.fileSystemAccessAvailable = isFileSystemAccessAvailable()
  storageStatus.backend = storage.name

  // Persistent storage (optional, nicht blockierend)
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    storageStatus.persistentStorageAvailable = true
    try {
      // Nur prüfen, nicht anfordern - um keine Dialoge auszulösen
      if (navigator.storage.persisted) {
        storageStatus.persistentStorageGranted = await navigator.storage.persisted()
      }
    } catch (e) {
      console.warn('[Storage] persist check failed:', e)
    }
  }

  // Storage estimate (optional)
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      storageStatus.estimatedQuota = estimate.quota ?? null
      storageStatus.usedQuota = estimate.usage ?? null
    } catch (e) {
      console.warn('[Storage] estimate failed:', e)
    }
  }

  return { ...storageStatus }
}

export function setStorageError(error: string): void {
  storageStatus.lastError = error
}

// ============================================================================
// Request Persistent Storage (Optional, niemals blockierend)
// ============================================================================

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    console.log('[Storage] Persistent storage API not available')
    return false
  }

  try {
    const granted = await navigator.storage.persist()
    storageStatus.persistentStorageGranted = granted
    console.log('[Storage] Persistent storage:', granted ? 'granted' : 'denied')
    return granted
  } catch (e) {
    console.warn('[Storage] persist() failed:', e)
    return false
  }
}

// ============================================================================
// Create Storage Backend
// ============================================================================

async function createStorageBackend(): Promise<StorageBackend> {
  // 1. Versuche IndexedDB
  if (isIndexedDBAvailable()) {
    const idb = new IndexedDBStorage()
    const success = await idb.init()
    if (success) {
      console.log('[Storage] ✓ Using IndexedDB')
      storageStatus.backend = 'indexeddb'
      return idb
    }
    console.warn('[Storage] IndexedDB init failed, trying localStorage')
  }

  // 2. Fallback: localStorage
  if (isLocalStorageAvailable()) {
    console.log('[Storage] ✓ Using localStorage (fallback)')
    storageStatus.backend = 'localstorage'
    return new LocalStorageBackend()
  }

  // 3. Notfall: In-Memory
  console.warn('[Storage] ⚠ Using in-memory storage (data will not persist!)')
  storageStatus.backend = 'memory'
  return new MemoryStorage()
}

// ============================================================================
// Singleton Storage Instance
// ============================================================================

// Sofort ein Fallback bereitstellen, wird asynchron durch besseres Backend ersetzt
let storage: StorageBackend = new MemoryStorage()
let storageReady: Promise<void>

// Initialisiere asynchron das beste verfügbare Backend
storageReady = (async () => {
  storage = await createStorageBackend()
  
  // Optional: Persistent storage anfordern (nicht blockierend)
  requestPersistentStorage().catch(() => {})
})()

export { storage, storageReady }

// ============================================================================
// Convenience Functions
// ============================================================================

export async function waitForStorage(): Promise<StorageBackend> {
  await storageReady
  return storage
}

// Helper für typsicheren Zugriff auf Collections
export async function getCollection<T>(key: string): Promise<T[]> {
  await storageReady
  const data = await storage.getItem<T[]>(key)
  return data ?? []
}

export async function setCollection<T>(key: string, data: T[]): Promise<void> {
  await storageReady
  await storage.setItem(key, data)
}

export async function updateCollectionItem<T extends { id: string }>(
  key: string,
  id: string,
  updates: Partial<T>
): Promise<T | null> {
  const items = await getCollection<T>(key)
  const index = items.findIndex(item => item.id === id)
  if (index === -1) return null
  
  items[index] = { ...items[index], ...updates }
  await setCollection(key, items)
  return items[index]
}

export async function addToCollection<T extends { id: string }>(
  key: string,
  item: T
): Promise<T> {
  const items = await getCollection<T>(key)
  items.push(item)
  await setCollection(key, items)
  return item
}

export async function removeFromCollection<T extends { id: string }>(
  key: string,
  id: string
): Promise<boolean> {
  const items = await getCollection<T>(key)
  const filtered = items.filter(item => item.id !== id)
  if (filtered.length === items.length) return false
  await setCollection(key, filtered)
  return true
}
