/**
 * Hook for AI Action Queue
 * 
 * Provides easy integration with the AI Action Queue system
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type AIActionType,
  type AIAction,
  type AIActionResult,
  type AIActionStack,
  subscribeToQueue,
  getActiveStacks,
  enqueueAction,
  updateActionProgress,
  completeAction,
  failAction,
  hasActiveActions,
} from '@/lib/ai-action-queue'
import { generateId } from '@/lib/utils-app'

interface UseAIActionQueueReturn {
  /** All active stacks */
  stacks: AIActionStack[]
  /** Whether any action is currently active */
  isActive: boolean
  /** Start a new action and get controls */
  startAction: (
    type: AIActionType,
    name: string,
    moduleId: string,
    moduleName?: string
  ) => AIActionControls
}

interface AIActionControls {
  /** The action ID */
  id: string
  /** Update progress (0-100) */
  setProgress: (progress: number) => void
  /** Mark as completed with optional result */
  complete: (result?: AIActionResult) => void
  /** Mark as failed */
  fail: (error: string, details?: string) => void
}

export function useAIActionQueue(): UseAIActionQueueReturn {
  const [stacks, setStacks] = useState<AIActionStack[]>([])

  useEffect(() => {
    return subscribeToQueue(() => {
      setStacks(getActiveStacks())
    })
  }, [])

  const startAction = useCallback((
    type: AIActionType,
    name: string,
    moduleId: string,
    moduleName?: string
  ): AIActionControls => {
    const id = generateId()
    
    enqueueAction({
      id,
      type,
      name,
      moduleId,
      moduleName,
    })

    return {
      id,
      setProgress: (progress: number) => updateActionProgress(id, progress),
      complete: (result?: AIActionResult) => completeAction(id, result),
      fail: (error: string, details?: string) => failAction(id, error, details),
    }
  }, [])

  return {
    stacks,
    isActive: hasActiveActions(),
    startAction,
  }
}

/**
 * Simple hook to check if AI actions are active
 */
export function useAIActionsActive(): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    return subscribeToQueue(() => {
      setIsActive(hasActiveActions())
    })
  }, [])

  return isActive
}
