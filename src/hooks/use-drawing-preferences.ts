/**
 * useDrawingPreferences - Hook für persistente Zeichnungs-Einstellungen
 * 
 * Speichert Benutzer-Präferenzen wie:
 * - Stiftdicke
 * - Radierer-Dicke
 * - Stiftfarbe
 * - Letztes verwendetes Tool
 */

import { useState, useEffect, useCallback } from 'react'

export interface DrawingPreferences {
  penWidth: number
  penColor: string
  eraserWidth: number
  lastTool: 'pen' | 'eraser' | 'select'
}

const STORAGE_KEY = 'studysync-drawing-preferences'

const DEFAULT_PREFERENCES: DrawingPreferences = {
  penWidth: 3,
  penColor: '#1a1a2e',
  eraserWidth: 20,
  lastTool: 'pen',
}

export function useDrawingPreferences() {
  const [preferences, setPreferences] = useState<DrawingPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
      }
    } catch (e) {
      console.warn('Fehler beim Laden der Zeichnungs-Einstellungen:', e)
    }
    return DEFAULT_PREFERENCES
  })

  // Speichern wenn sich Präferenzen ändern
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch (e) {
      console.warn('Fehler beim Speichern der Zeichnungs-Einstellungen:', e)
    }
  }, [preferences])

  const updatePreference = useCallback(<K extends keyof DrawingPreferences>(
    key: K,
    value: DrawingPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
  }, [])

  return {
    preferences,
    updatePreference,
    resetPreferences,
  }
}
