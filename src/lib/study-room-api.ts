import {
  StudyRoom,
  StudyRoomRound,
  StudyRoomMode,
  StudyRoomSubmission,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface RoomResponse {
  room: StudyRoom
  round?: StudyRoomRound
}

async function postJson<T = RoomResponse>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function getJson<T = RoomResponse>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function createStudyRoomApi(params: {
  moduleId: string
  topic?: string
  nickname: string
  userId: string
}): Promise<StudyRoom> {
  const data = await postJson<RoomResponse>('/api/rooms', params)
  return data.room
}

export async function joinStudyRoomApi(params: {
  code: string
  nickname: string
  userId: string
}): Promise<StudyRoom> {
  const data = await postJson<RoomResponse>('/api/rooms/join', params)
  return data.room
}

export async function fetchStudyRoom(roomId: string, userId?: string): Promise<StudyRoom> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  const data = await getJson<RoomResponse>(`/api/rooms/${roomId}${query}`)
  return data.room
}

export async function setReadyState(roomId: string, params: {
  userId: string
  ready: boolean
}): Promise<StudyRoom> {
  const data = await postJson<RoomResponse>(`/api/rooms/${roomId}/ready`, params)
  return data.room
}

export async function startStudyRound(roomId: string, params: {
  hostId: string
  mode: StudyRoomMode
}): Promise<RoomResponse> {
  return postJson<RoomResponse>(`/api/rooms/${roomId}/start-round`, params)
}

export async function voteForExtension(roomId: string, params: {
  userId: string
}): Promise<StudyRoom> {
  const data = await postJson<RoomResponse>(`/api/rooms/${roomId}/vote-extension`, params)
  return data.room
}

export async function submitStudyRound(roomId: string, params: {
  userId: string
  isCorrect?: boolean
  answerPreview?: string
}): Promise<RoomResponse> {
  return postJson<RoomResponse>(`/api/rooms/${roomId}/submit`, params)
}

export async function endStudyRound(roomId: string, params: {
  hostId: string
}): Promise<RoomResponse> {
  return postJson<RoomResponse>(`/api/rooms/${roomId}/end-round`, params)
}

export async function leaveStudyRoom(roomId: string, params: {
  userId: string
}): Promise<StudyRoom> {
  const data = await postJson<RoomResponse>(`/api/rooms/${roomId}/leave`, params)
  return data.room
}

export function limitAnswerPreview(preview?: string): string | undefined {
  if (!preview) return undefined
  return preview.length > 300 ? `${preview.slice(0, 300)}…` : preview
}

// TODO: replace polling with WebSocket/SSE once backend supports realtime updates
