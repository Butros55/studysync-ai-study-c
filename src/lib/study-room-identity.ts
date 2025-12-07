import { StudyRoomIdentity } from './types'
import { generateId } from './utils-app'

const USER_ID_KEY = 'studymate_user_id'
const NICKNAME_KEY = 'studymate_nickname'

function getStoredId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_ID_KEY)
}

function getStoredNickname(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NICKNAME_KEY)
}

function storeIdentity(identity: StudyRoomIdentity) {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_ID_KEY, identity.userId)
  localStorage.setItem(NICKNAME_KEY, identity.nickname)
}

export function ensureStudyRoomIdentity(nickname?: string): StudyRoomIdentity {
  const existingId = getStoredId()
  const existingNickname = getStoredNickname()

  const userId = existingId || generateId()
  const resolvedNickname =
    (nickname && nickname.trim()) ||
    existingNickname ||
    `Gast-${userId.slice(0, 6).toUpperCase()}`

  const identity: StudyRoomIdentity = { userId, nickname: resolvedNickname }
  storeIdentity(identity)
  return identity
}

export function updateStudyRoomNickname(nickname: string) {
  if (!nickname) return
  const currentId = getStoredId() || generateId()
  storeIdentity({ userId: currentId, nickname })
}

export function loadStudyRoomIdentity(): StudyRoomIdentity {
  const userId = getStoredId() || generateId()
  const nickname =
    getStoredNickname() || `Gast-${userId.slice(0, 6).toUpperCase()}`
  const identity: StudyRoomIdentity = { userId, nickname }
  storeIdentity(identity)
  return identity
}
