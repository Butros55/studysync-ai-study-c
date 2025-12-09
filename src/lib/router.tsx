/**
 * Router-Konfiguration für StudySync
 * 
 * Definiert alle Routes und stellt Navigations-Utilities bereit.
 * Verwendet React Router v6 mit Browser History für persistente URLs.
 */

import { createBrowserRouter, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo } from 'react'

// Route-Definitionen
export const ROUTES = {
  HOME: '/',
  MODULE: '/module/:moduleId',
  MODULE_TAB: '/module/:moduleId/:tab',
  TASK: '/module/:moduleId/task/:taskId',
  FLASHCARDS: '/module/:moduleId/flashcards',
  QUIZ: '/module/:moduleId/quiz',
  EXAM: '/module/:moduleId/exam',
  STATISTICS: '/statistics',
  COST_TRACKING: '/costs',
  STUDY_ROOM: '/room/:roomCode',
} as const

// Helper zum Generieren von Route-Pfaden
export function buildModulePath(moduleId: string, tab?: string): string {
  if (tab) {
    return `/module/${moduleId}/${tab}`
  }
  return `/module/${moduleId}`
}

export function buildTaskPath(moduleId: string, taskId: string): string {
  return `/module/${moduleId}/task/${taskId}`
}

export function buildFlashcardsPath(moduleId: string): string {
  return `/module/${moduleId}/flashcards`
}

export function buildQuizPath(moduleId: string): string {
  return `/module/${moduleId}/quiz`
}

export function buildExamPath(moduleId: string): string {
  return `/module/${moduleId}/exam`
}

export function buildStudyRoomPath(roomCode: string): string {
  return `/room/${roomCode}`
}

// Hook für einfache Navigation
export function useAppNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const goHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  const goToModule = useCallback((moduleId: string, tab?: string) => {
    navigate(buildModulePath(moduleId, tab))
  }, [navigate])

  const goToTask = useCallback((moduleId: string, taskId: string) => {
    navigate(buildTaskPath(moduleId, taskId))
  }, [navigate])

  const goToFlashcards = useCallback((moduleId: string) => {
    navigate(buildFlashcardsPath(moduleId))
  }, [navigate])

  const goToQuiz = useCallback((moduleId: string) => {
    navigate(buildQuizPath(moduleId))
  }, [navigate])

  const goToExam = useCallback((moduleId: string) => {
    navigate(buildExamPath(moduleId))
  }, [navigate])

  const goToStatistics = useCallback(() => {
    navigate('/statistics')
  }, [navigate])

  const goToCostTracking = useCallback(() => {
    navigate('/costs')
  }, [navigate])

  const goToStudyRoom = useCallback((roomCode: string) => {
    navigate(buildStudyRoomPath(roomCode))
  }, [navigate])

  const goBack = useCallback(() => {
    // Wenn wir History haben, gehen wir zurück
    // Ansonsten zur Home-Seite
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }, [navigate])

  // Parse aktuelle Route-Infos
  const routeInfo = useMemo(() => {
    const path = location.pathname
    
    // Home
    if (path === '/') {
      return { screen: 'home' as const, moduleId: null, taskId: null, tab: null }
    }
    
    // Statistics
    if (path === '/statistics') {
      return { screen: 'statistics' as const, moduleId: null, taskId: null, tab: null }
    }
    
    // Cost Tracking
    if (path === '/costs') {
      return { screen: 'costs' as const, moduleId: null, taskId: null, tab: null }
    }
    
    // Study Room
    const roomMatch = path.match(/^\/room\/([^/]+)$/)
    if (roomMatch) {
      return { screen: 'studyroom' as const, moduleId: null, taskId: null, tab: null, roomCode: roomMatch[1] }
    }
    
    // Module Routes
    const moduleMatch = path.match(/^\/module\/([^/]+)(?:\/(.+))?$/)
    if (moduleMatch) {
      const moduleId = moduleMatch[1]
      const rest = moduleMatch[2]
      
      if (!rest) {
        return { screen: 'module' as const, moduleId, taskId: null, tab: null }
      }
      
      // Task
      const taskMatch = rest.match(/^task\/(.+)$/)
      if (taskMatch) {
        return { screen: 'task' as const, moduleId, taskId: taskMatch[1], tab: null }
      }
      
      // Flashcards
      if (rest === 'flashcards') {
        return { screen: 'flashcards' as const, moduleId, taskId: null, tab: null }
      }
      
      // Quiz
      if (rest === 'quiz') {
        return { screen: 'quiz' as const, moduleId, taskId: null, tab: null }
      }
      
      // Exam
      if (rest === 'exam') {
        return { screen: 'exam' as const, moduleId, taskId: null, tab: null }
      }
      
      // Tab (scripts, notes, tasks, flashcards)
      return { screen: 'module' as const, moduleId, taskId: null, tab: rest }
    }
    
    // Fallback
    return { screen: 'home' as const, moduleId: null, taskId: null, tab: null }
  }, [location.pathname])

  return {
    navigate,
    location,
    params,
    routeInfo,
    goHome,
    goToModule,
    goToTask,
    goToFlashcards,
    goToQuiz,
    goToExam,
    goToStatistics,
    goToCostTracking,
    goToStudyRoom,
    goBack,
  }
}

// Hook zum Synchronisieren von URL und App-State
export function useRouteSync(options: {
  selectedModuleId: string | null
  activeTaskId: string | null
  showStatistics: boolean
  showCostTracking: boolean
  showQuizMode: boolean
  showExamMode: boolean
  activeFlashcards: boolean
  studyRoomCode: string | null
  onModuleChange: (moduleId: string | null) => void
  onTaskChange: (taskId: string | null) => void
  onStatisticsChange: (show: boolean) => void
  onCostTrackingChange: (show: boolean) => void
  onQuizChange: (show: boolean) => void
  onExamChange: (show: boolean) => void
  onFlashcardsChange: (show: boolean) => void
  onStudyRoomChange: (roomCode: string | null) => void
}) {
  const { routeInfo, navigate } = useAppNavigation()

  // Synchronisiere URL -> App-State (beim Laden und Browser-Navigation)
  useEffect(() => {
    const { screen, moduleId, taskId } = routeInfo
    
    switch (screen) {
      case 'home':
        options.onModuleChange(null)
        options.onTaskChange(null)
        options.onStatisticsChange(false)
        options.onCostTrackingChange(false)
        options.onQuizChange(false)
        options.onExamChange(false)
        options.onFlashcardsChange(false)
        break
        
      case 'module':
        options.onModuleChange(moduleId)
        options.onTaskChange(null)
        options.onStatisticsChange(false)
        options.onCostTrackingChange(false)
        options.onQuizChange(false)
        options.onExamChange(false)
        options.onFlashcardsChange(false)
        break
        
      case 'task':
        options.onModuleChange(moduleId)
        options.onTaskChange(taskId)
        options.onStatisticsChange(false)
        options.onCostTrackingChange(false)
        break
        
      case 'flashcards':
        options.onModuleChange(moduleId)
        options.onFlashcardsChange(true)
        options.onStatisticsChange(false)
        options.onCostTrackingChange(false)
        break
        
      case 'quiz':
        options.onModuleChange(moduleId)
        options.onQuizChange(true)
        options.onStatisticsChange(false)
        options.onCostTrackingChange(false)
        break
        
      case 'exam':
        options.onModuleChange(moduleId)
        options.onExamChange(true)
        options.onStatisticsChange(false)
        options.onCostTrackingChange(false)
        break
        
      case 'statistics':
        options.onStatisticsChange(true)
        options.onCostTrackingChange(false)
        break
        
      case 'costs':
        options.onCostTrackingChange(true)
        options.onStatisticsChange(false)
        break
        
      case 'studyroom':
        if ('roomCode' in routeInfo && routeInfo.roomCode) {
          options.onStudyRoomChange(routeInfo.roomCode)
        }
        break
    }
  }, [routeInfo])

  return { routeInfo }
}
