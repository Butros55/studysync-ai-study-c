/**
 * AI Action Queue System
 * 
 * Zentrales System für alle KI-Aktionen mit:
 * - Stack-basierte Queues (Analyse, Notizen, Aufgaben, etc.)
 * - Persistenz über localStorage für Reload-Resilienz
 * - Event-basierte Updates für UI-Reaktivität
 */

// ============================================================================
// Types
// ============================================================================

export type AIActionType = 
  | 'analyze' 
  | 'generate-notes' 
  | 'generate-tasks' 
  | 'generate-flashcards' 
  | 'generate-exam'

export type AIActionStatus = 
  | 'queued'      // Wartet in der Queue
  | 'processing'  // Wird gerade verarbeitet
  | 'completed'   // Erfolgreich abgeschlossen
  | 'error'       // Fehler aufgetreten

export interface AIActionResult {
  /** Anzahl der erstellten Items */
  count?: number
  /** Titel/Namen der erstellten Items (für Zusammenfassung) */
  items?: Array<{
    id: string
    title: string
    subtitle?: string
  }>
  /** Extrahierte Themen (für Analyse) */
  topics?: string[]
  /** Fehler-Nachricht */
  error?: string
  /** Detaillierte Fehlermeldung */
  errorDetails?: string
}

export interface AIAction {
  id: string
  type: AIActionType
  /** Name der Aktion (z.B. Skript-Name) */
  name: string
  /** Modul-ID */
  moduleId: string
  /** Modul-Name für Anzeige */
  moduleName?: string
  /** Fortschritt 0-100 */
  progress: number
  /** Status */
  status: AIActionStatus
  /** Ergebnis nach Abschluss */
  result?: AIActionResult
  /** Zeitstempel des Starts */
  startedAt: number
  /** Zeitstempel des Abschlusses */
  completedAt?: number
  /** Zusätzliche Metadaten */
  metadata?: Record<string, unknown>
}

export interface AIActionStack {
  type: AIActionType
  label: string
  icon: string
  actions: AIAction[]
  /** Gesamtfortschritt des Stacks (0-100) */
  totalProgress: number
  /** Ob der Stack gerade aktiv ist */
  isActive: boolean
  /** Ob die Ergebnis-Zusammenfassung angezeigt werden soll */
  showResults: boolean
}

// ============================================================================
// Stack Labels & Icons
// ============================================================================

export const STACK_CONFIG: Record<AIActionType, { label: string; icon: string; color: string }> = {
  'analyze': { 
    label: 'Dokument-Analyse', 
    icon: 'MagnifyingGlass',
    color: 'text-blue-500'
  },
  'generate-notes': { 
    label: 'Notiz generieren', 
    icon: 'FileText',
    color: 'text-green-500'
  },
  'generate-tasks': { 
    label: 'Aufgabe generieren', 
    icon: 'ListChecks',
    color: 'text-orange-500'
  },
  'generate-flashcards': { 
    label: 'Karteikarte erstellen', 
    icon: 'Cards',
    color: 'text-purple-500'
  },
  'generate-exam': { 
    label: 'Prüfung vorbereiten', 
    icon: 'Exam',
    color: 'text-red-500'
  },
}

// ============================================================================
// State Management
// ============================================================================

const STORAGE_KEY = 'ai-action-queue-state'

interface QueueState {
  stacks: Record<AIActionType, AIAction[]>
  activeStackType: AIActionType | null
  isProcessing: boolean
}

let state: QueueState = {
  stacks: {
    'analyze': [],
    'generate-notes': [],
    'generate-tasks': [],
    'generate-flashcards': [],
    'generate-exam': [],
  },
  activeStackType: null,
  isProcessing: false,
}

// Event listeners
type StateListener = (state: QueueState) => void
const listeners: Set<StateListener> = new Set()

function notifyListeners() {
  listeners.forEach(listener => listener(state))
}

export function subscribeToQueue(listener: StateListener): () => void {
  listeners.add(listener)
  // Sofort aktuellen State senden
  listener(state)
  return () => listeners.delete(listener)
}

// ============================================================================
// Persistence
// ============================================================================

function saveState() {
  try {
    // Nur queued und processing Actions speichern (nicht completed)
    const persistState: QueueState = {
      ...state,
      stacks: Object.fromEntries(
        Object.entries(state.stacks).map(([type, actions]) => [
          type,
          actions.filter(a => a.status === 'queued' || a.status === 'processing')
        ])
      ) as Record<AIActionType, AIAction[]>,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistState))
  } catch (e) {
    console.warn('[AIQueue] Failed to save state:', e)
  }
}

function loadState(): QueueState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as QueueState
      // Alle "processing" auf "queued" zurücksetzen (da nach Reload neu gestartet werden muss)
      Object.values(parsed.stacks).forEach(actions => {
        actions.forEach(action => {
          if (action.status === 'processing') {
            action.status = 'queued'
            action.progress = 0
          }
        })
      })
      return parsed
    }
  } catch (e) {
    console.warn('[AIQueue] Failed to load state:', e)
  }
  return null
}

// Initialize from localStorage
const savedState = loadState()
if (savedState) {
  state = savedState
}

// ============================================================================
// Queue Operations
// ============================================================================

/**
 * Eine neue AI-Aktion zur Queue hinzufügen
 */
export function enqueueAction(action: Omit<AIAction, 'status' | 'startedAt' | 'progress'>): AIAction {
  const newAction: AIAction = {
    ...action,
    status: 'queued',
    progress: 0,
    startedAt: Date.now(),
  }
  
  state = {
    ...state,
    stacks: {
      ...state.stacks,
      [action.type]: [...state.stacks[action.type], newAction],
    },
  }
  
  saveState()
  notifyListeners()
  
  return newAction
}

/**
 * Fortschritt einer Aktion aktualisieren
 */
export function updateActionProgress(actionId: string, progress: number) {
  let found = false
  
  const newStacks = Object.fromEntries(
    Object.entries(state.stacks).map(([type, actions]) => [
      type,
      actions.map(action => {
        if (action.id === actionId) {
          found = true
          return { ...action, progress, status: 'processing' as AIActionStatus }
        }
        return action
      })
    ])
  ) as Record<AIActionType, AIAction[]>
  
  if (found) {
    state = { ...state, stacks: newStacks }
    notifyListeners()
  }
}

/**
 * Eine Aktion als abgeschlossen markieren
 */
export function completeAction(actionId: string, result?: AIActionResult) {
  let actionType: AIActionType | null = null
  
  const newStacks = Object.fromEntries(
    Object.entries(state.stacks).map(([type, actions]) => [
      type,
      actions.map(action => {
        if (action.id === actionId) {
          actionType = type as AIActionType
          return { 
            ...action, 
            progress: 100, 
            status: 'completed' as AIActionStatus,
            result,
            completedAt: Date.now(),
          }
        }
        return action
      })
    ])
  ) as Record<AIActionType, AIAction[]>
  
  state = { ...state, stacks: newStacks }
  saveState()
  notifyListeners()
}

/**
 * Eine Aktion als fehlgeschlagen markieren
 */
export function failAction(actionId: string, error: string, errorDetails?: string) {
  const newStacks = Object.fromEntries(
    Object.entries(state.stacks).map(([type, actions]) => [
      type,
      actions.map(action => {
        if (action.id === actionId) {
          return { 
            ...action, 
            status: 'error' as AIActionStatus,
            result: { error, errorDetails },
            completedAt: Date.now(),
          }
        }
        return action
      })
    ])
  ) as Record<AIActionType, AIAction[]>
  
  state = { ...state, stacks: newStacks }
  saveState()
  notifyListeners()
}

/**
 * Alle abgeschlossenen Aktionen eines Stacks entfernen
 */
export function clearCompletedActions(type: AIActionType) {
  state = {
    ...state,
    stacks: {
      ...state.stacks,
      [type]: state.stacks[type].filter(a => a.status !== 'completed' && a.status !== 'error'),
    },
  }
  saveState()
  notifyListeners()
}

/**
 * Eine einzelne Aktion abbrechen (aus Queue entfernen)
 */
export function cancelAction(actionId: string): boolean {
  let found = false
  
  const newStacks = Object.fromEntries(
    Object.entries(state.stacks).map(([type, actions]) => [
      type,
      actions.filter(action => {
        if (action.id === actionId) {
          found = true
          return false // Entfernen
        }
        return true
      })
    ])
  ) as Record<AIActionType, AIAction[]>
  
  if (found) {
    state = { ...state, stacks: newStacks }
    saveState()
    notifyListeners()
  }
  
  return found
}

/**
 * Alle Aktionen eines Stack-Typs abbrechen
 */
export function cancelAllActions(type: AIActionType) {
  state = {
    ...state,
    stacks: {
      ...state.stacks,
      [type]: [],
    },
  }
  saveState()
  notifyListeners()
}

/**
 * Aktiven Stack setzen
 */
export function setActiveStack(type: AIActionType | null) {
  state = { ...state, activeStackType: type }
  notifyListeners()
}

/**
 * Alle Aktionen eines Typs abrufen
 */
export function getStackActions(type: AIActionType): AIAction[] {
  return state.stacks[type]
}

/**
 * Alle Stacks mit aktiven Aktionen abrufen
 */
export function getActiveStacks(): AIActionStack[] {
  return (Object.keys(state.stacks) as AIActionType[])
    .map(type => {
      const actions = state.stacks[type]
      const config = STACK_CONFIG[type]
      
      // Berechne Gesamtfortschritt
      const activeActions = actions.filter(a => a.status !== 'completed' && a.status !== 'error')
      const totalProgress = activeActions.length > 0
        ? activeActions.reduce((sum, a) => sum + a.progress, 0) / activeActions.length
        : actions.length > 0 && actions.every(a => a.status === 'completed') ? 100 : 0
      
      return {
        type,
        label: config.label,
        icon: config.icon,
        actions,
        totalProgress,
        isActive: actions.some(a => a.status === 'processing' || a.status === 'queued'),
        showResults: actions.length > 0 && actions.every(a => a.status === 'completed' || a.status === 'error'),
      }
    })
    .filter(stack => stack.actions.length > 0)
}

/**
 * Prüfen ob irgendeine Queue aktiv ist
 */
export function hasActiveActions(): boolean {
  return Object.values(state.stacks).some(actions => 
    actions.some(a => a.status === 'processing' || a.status === 'queued')
  )
}

/**
 * Queue-State zurücksetzen (für Tests/Debug)
 */
export function resetQueue() {
  state = {
    stacks: {
      'analyze': [],
      'generate-notes': [],
      'generate-tasks': [],
      'generate-flashcards': [],
      'generate-exam': [],
    },
    activeStackType: null,
    isProcessing: false,
  }
  localStorage.removeItem(STORAGE_KEY)
  notifyListeners()
}
