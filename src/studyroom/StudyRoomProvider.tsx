import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { StudyRoom } from '@/lib/types'
import { fetchStudyRoom } from '@/lib/study-room-api'
import { toast } from 'sonner'

type Phase = 'starting' | 'running' | 'ending' | 'review'

interface StudyRoomContextValue {
  room: StudyRoom | null
  phase: Phase | null
  startCountdown: number
  endCountdown: number | null
  lockCountdown: number | null
  userId?: string
  lastSync: number | null
  registerRoom: (room: StudyRoom, userId: string) => void
  clearRoom: () => void
  refresh: (roomId?: string) => Promise<void>
}

const StudyRoomContext = createContext<StudyRoomContextValue | undefined>(undefined)

export function StudyRoomProvider({ children }: { children: React.ReactNode }) {
  const [room, setRoom] = useState<StudyRoom | null>(null)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [startCountdown, setStartCountdown] = useState(0)
  const [endCountdown, setEndCountdown] = useState<number | null>(null)
  const [lockCountdown, setLockCountdown] = useState<number | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const prevVotes = useRef<number>(0)

  const phase: Phase | null = room?.currentRound?.phase || null

  const registerRoom = (nextRoom: StudyRoom, uid: string) => {
    setRoom(nextRoom)
    setUserId(uid)
    setLastSync(Date.now())
    prevVotes.current = nextRoom.currentRound?.extensionVotes.length || 0
  }

  const clearRoom = () => {
    setRoom(null)
    setUserId(undefined)
    setStartCountdown(0)
    setEndCountdown(null)
    setLockCountdown(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const refresh = async (roomId?: string) => {
    if (!roomId || !userId) return
    try {
      const updated = await fetchStudyRoom(roomId, userId)
      setRoom(updated)
      setLastSync(Date.now())
    } catch (error) {
      console.warn('[StudyRoom] refresh failed', error)
    }
  }

  useEffect(() => {
    if (!room || !userId) return
    pollRef.current && clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      refresh(room.id)
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [room?.id, userId])

  // client-side countdowns for display only
  useEffect(() => {
    const round = room?.currentRound
    if (!round) return
    const interval = setInterval(() => {
      if (round.phase === 'starting' && round.startsAt) {
        const diff = Math.max(0, Math.ceil((new Date(round.startsAt).getTime() - Date.now()) / 1000))
        setStartCountdown(diff)
      } else {
        setStartCountdown(0)
      }

      if (round.endsAt) {
        const diff = Math.max(0, Math.ceil((new Date(round.endsAt).getTime() - Date.now()) / 1000))
        setEndCountdown(diff)
      } else {
        setEndCountdown(null)
      }

      if (round.lockCountdownStartAt) {
        const diff = 5000 - (Date.now() - new Date(round.lockCountdownStartAt).getTime())
        setLockCountdown(diff > 0 ? Math.ceil(diff / 1000) : 0)
      } else {
        setLockCountdown(null)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [room?.currentRound?.id, room?.currentRound?.phase, room?.currentRound?.startsAt, room?.currentRound?.endsAt, room?.currentRound?.lockCountdownStartAt])

  // Vote diff → toast with action suggestion
  useEffect(() => {
    const round = room?.currentRound
    if (!round) return
    const votes = round.extensionVotes.length
    if (votes > prevVotes.current) {
      toast.info('Jemand möchte Zeit verlängern', { duration: 5000 })
    }
    prevVotes.current = votes
  }, [room?.currentRound?.extensionVotes.length])

  const value = useMemo(
    () => ({
      room,
      phase,
      startCountdown,
      endCountdown,
      lockCountdown,
      userId,
      lastSync,
      registerRoom,
      clearRoom,
      refresh,
    }),
    [room, phase, startCountdown, endCountdown, lockCountdown, userId, lastSync]
  )

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>
}

export function useStudyRoom() {
  const ctx = useContext(StudyRoomContext)
  if (!ctx) throw new Error('useStudyRoom must be used within StudyRoomProvider')
  return ctx
}
