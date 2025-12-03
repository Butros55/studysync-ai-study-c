import { Flashcard } from './types'

export function calculateNextReview(
  flashcard: Flashcard,
  quality: number
): {
  ease: number
  interval: number
  repetitions: number
  nextReview: string
} {
  let { ease, interval, repetitions } = flashcard

  if (quality < 3) {
    repetitions = 0
    interval = 0
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * ease)
    }
    
    repetitions += 1
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return {
    ease,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
  }
}
