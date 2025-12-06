/**
 * Hook for managing user's preferred input mode (type vs draw)
 * 
 * Provides reactive access to the preferred input mode preference,
 * with automatic re-rendering when the value changes.
 */

import { useState, useEffect, useCallback } from 'react'
import type { InputMode } from '@/lib/analysis-types'
import {
  getUserPreferencePreferredInputMode,
  setUserPreferencePreferredInputMode,
} from '@/lib/analysis-storage'

// ============================================================================
// Event System for Cross-Component Reactivity
// ============================================================================

const INPUT_MODE_CHANGE_EVENT = 'studysync:inputModeChange'

type InputModeChangeHandler = (mode: InputMode | undefined) => void
const listeners = new Set<InputModeChangeHandler>()

function notifyInputModeChange(mode: InputMode | undefined) {
  // Dispatch custom event for window listeners
  window.dispatchEvent(new CustomEvent(INPUT_MODE_CHANGE_EVENT, { detail: mode }))
  // Also notify direct subscribers
  listeners.forEach(fn => fn(mode))
}

function subscribeToInputModeChange(handler: InputModeChangeHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UsePreferredInputModeResult {
  /** Current preferred input mode, or undefined if not set */
  mode: InputMode | undefined
  
  /** Whether the mode is still loading from storage */
  isLoading: boolean
  
  /** Whether a preferred mode has been set */
  isSet: boolean
  
  /** Set the preferred input mode (persists to storage) */
  setMode: (mode: InputMode) => Promise<void>
}

/**
 * Hook to access and manage the user's preferred input mode.
 * 
 * Re-renders automatically when the mode changes, even from other components.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { mode, setMode, isSet } = usePreferredInputMode()
 *   
 *   return (
 *     <div>
 *       {isSet ? `Preferred: ${mode}` : 'No preference set'}
 *       <button onClick={() => setMode('type')}>Use Keyboard</button>
 *       <button onClick={() => setMode('draw')}>Use Pen</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function usePreferredInputMode(): UsePreferredInputModeResult {
  const [mode, setModeState] = useState<InputMode | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Load initial value from storage
  useEffect(() => {
    let mounted = true
    
    async function loadMode() {
      try {
        const storedMode = await getUserPreferencePreferredInputMode()
        if (mounted) {
          setModeState(storedMode)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[usePreferredInputMode] Failed to load preference:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    
    loadMode()
    
    return () => {
      mounted = false
    }
  }, [])

  // Subscribe to changes from other components
  useEffect(() => {
    const handleChange = (newMode: InputMode | undefined) => {
      setModeState(newMode)
    }
    
    const unsubscribe = subscribeToInputModeChange(handleChange)
    
    // Also listen to window event for cross-tab sync potential
    const handleWindowEvent = (e: Event) => {
      const customEvent = e as CustomEvent<InputMode | undefined>
      setModeState(customEvent.detail)
    }
    window.addEventListener(INPUT_MODE_CHANGE_EVENT, handleWindowEvent)
    
    return () => {
      unsubscribe()
      window.removeEventListener(INPUT_MODE_CHANGE_EVENT, handleWindowEvent)
    }
  }, [])

  // Setter function that persists and notifies
  const setMode = useCallback(async (newMode: InputMode) => {
    try {
      await setUserPreferencePreferredInputMode(newMode)
      setModeState(newMode)
      notifyInputModeChange(newMode)
    } catch (error) {
      console.error('[usePreferredInputMode] Failed to save preference:', error)
      throw error
    }
  }, [])

  return {
    mode,
    isLoading,
    isSet: mode !== undefined,
    setMode,
  }
}

/**
 * Get the current preferred input mode synchronously (for non-React contexts).
 * 
 * Note: This returns a promise. For reactive usage, use the hook instead.
 */
export async function getPreferredInputMode(): Promise<InputMode | undefined> {
  return getUserPreferencePreferredInputMode()
}

/**
 * Set the preferred input mode and notify all subscribers.
 * 
 * Use this from non-React contexts. For React components, use the hook.
 */
export async function setPreferredInputMode(mode: InputMode): Promise<void> {
  await setUserPreferencePreferredInputMode(mode)
  notifyInputModeChange(mode)
}
