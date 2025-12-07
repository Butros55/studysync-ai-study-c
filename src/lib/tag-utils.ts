import { canonicalKey, cleanLabel } from './tag-canonicalizer'
import { Task } from './types'

const FALLBACK_TAG = 'Allgemein'

export function formatTagLabel(tag: string): string {
  const cleaned = cleanLabel(tag || FALLBACK_TAG).trim()
  const base = (cleaned || FALLBACK_TAG).replace(/-/g, ' ').trim()
  if (!base) return FALLBACK_TAG

  return base
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function extractTaskTags(task: Task): Array<{ key: string; label: string }> {
  const sourceTags = task.tags?.length ? task.tags : task.topic ? [task.topic] : [FALLBACK_TAG]
  const unique = new Map<string, string>()

  for (const tag of sourceTags) {
    const key = canonicalKey(tag) || canonicalKey(FALLBACK_TAG)
    const label = formatTagLabel(tag)
    if (!unique.has(key)) {
      unique.set(key, label)
    }
  }

  return Array.from(unique, ([key, label]) => ({ key, label }))
}
