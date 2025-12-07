import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { StudyRoom, StudyRoomRound } from '@/lib/types'
import { fetchStudyRoom } from '@/lib/study-room-api'
import { toast } from 'sonner'

interface StudyRoomContextValue {
  room: StudyRoom | null
  round: StudyRoomRound | null
  setRoom: (room: StudyRoom | null) => void
  startCountdown: number
  endCountdown: number | null
  lastSync: number | null
  refresh: (roomId?: string) => Promise<void>
  registerRoom: (room: StudyRoom, userId: string) => void
  userId?: string
}

const StudyRoomContext = createContext<StudyRoomContextValue | undefined>(undefined)

export function StudyRoomProvider({ children }: { children: React.ReactNode }) {
  const [room, setRoom] = useState<StudyRoom | null>(null)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [startCountdown, setStartCountdown] = useState(0)
  const [endCountdown, setEndCountdown] = useState<number | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const round = room?.currentRound || null

  const registerRoom = (nextRoom: StudyRoom, uid: string) => {
    setRoom(nextRoom)
    setUserId(uid)
  }

  const refresh = async (roomId?: string) => {
    if (!roomId || !userId) return
    try {
      const res = await fetchStudyRoom(roomId, userId)
      setRoom(res)
      setLastSync(Date.now())
    } catch (error) {
      console.warn('[StudyRoom] refresh failed', error)
    }
  }

  useEffect(() => {
    if (!room || !userId) return
    // Poll every 2s
    pollRef.current && clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      refresh(room.id)
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [room?.id, userId])

  // Countdown derivation (client-only display)
  useEffect(() => {
    if (!round) return
    const t = setInterval(() => {
      if (round.phase === 'starting' && round.startsAt) {
        const diff = Math.max(
          0,
          Math.ceil((new Date(round.startsAt).getTime() - Date.now()) / 1000)
        )
        setStartCountdown(diff)
      } else {
        setStartCountdown(0)
      }
      if (round.endsAt) {
        const diff = Math.max(
          0,
          Math.ceil((new Date(round.endsAt).getTime() - Date.now()) / 1000)
        )
        setEndCountdown(diff)
      } else {
        setEndCountdown(null)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [round?.id, round?.phase, round?.startsAt, round?.endsAt])

  // Detect votes/submissions to trigger toast actions
  const prevMeta = useRef<{
    votes: number
    submissions: number
  }>({ votes: 0, submissions: 0 })

  useEffect(() => {
    if (!round) return
    if (prevMeta.current.votes && round.extensionVotes.length > prevMeta.current.votes) {
      toast.info('Jemand möchte Zeit verlängern', {
        duration: 5000,
      })
    }
    prevMeta.current = {
      votes: round.extensionVotes.length,
      submissions: round.submissions.length,
    }
  }, [round?.extensionVotes.length, round?.submissions.length])

  const value = useMemo(
    () => ({
      room,
      round,
      setRoom,
      startCountdown,
      endCountdown,
      lastSync,
      refresh,
      registerRoom,
      userId,
    }),
    [room, round, startCountdown, endCountdown, lastSync, userId]
  )

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>
}

export function useStudyRoom() {
  const ctx = useContext(StudyRoomContext)
  if (!ctx) throw new Error('useStudyRoom must be used within StudyRoomProvider')
  return ctx
}
