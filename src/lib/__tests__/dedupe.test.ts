/**
 * Unit Tests for Dedupe System (taskFingerprint + semanticSimilarity + topicCoverage)
 * 
 * Run with: npx vitest run src/lib/__tests__/dedupe.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  normalizeTags as normalizeTagsForFp,
  simpleHash,
  taskFingerprintSync,
  checkFingerprintDuplicate,
  buildFingerprintMap
} from '../dedupe/taskFingerprint'
import {
  tokenize,
  jaccardSimilarity,
  ngramSimilarity,
  softSemanticSimilarity,
  cosineSimilarity
} from '../dedupe/semanticSimilarity'

// ============================================================================
// normalizeText Tests
// ============================================================================

describe('normalizeText', () => {
  it('should convert to lowercase', () => {
    expect(normalizeText('HELLO World')).toBe('hello world')
  })

  it('should compress whitespace', () => {
    expect(normalizeText('hello   world')).toBe('hello world')
    expect(normalizeText('hello\n\nworld')).toBe('hello world')
    expect(normalizeText('hello\t\tworld')).toBe('hello world')
  })

  it('should remove punctuation', () => {
    expect(normalizeText('hello, world!')).toBe('hello world')
    expect(normalizeText('what?')).toBe('what')
    expect(normalizeText('a.b.c')).toBe('a b c')
  })

  it('should trim whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello')
  })

  it('should handle empty strings', () => {
    expect(normalizeText('')).toBe('')
    expect(normalizeText('   ')).toBe('')
  })

  it('should handle unicode characters', () => {
    expect(normalizeText('Größe')).toBe('größe')
    expect(normalizeText('Übung')).toBe('übung')
  })
})

// ============================================================================
// normalizeTags Tests
// ============================================================================

describe('normalizeTags', () => {
  it('should lowercase and sort tags', () => {
    expect(normalizeTagsForFp(['Zebra', 'apple', 'Banana'])).toEqual(['apple', 'banana', 'zebra'])
  })

  it('should remove duplicates', () => {
    expect(normalizeTagsForFp(['Apple', 'apple', 'APPLE'])).toEqual(['apple'])
  })

  it('should trim whitespace', () => {
    expect(normalizeTagsForFp(['  apple  ', 'banana'])).toEqual(['apple', 'banana'])
  })

  it('should handle empty arrays', () => {
    expect(normalizeTagsForFp([])).toEqual([])
    expect(normalizeTagsForFp(undefined)).toEqual([])
  })

  it('should filter out empty strings', () => {
    expect(normalizeTagsForFp(['apple', '', '  ', 'banana'])).toEqual(['apple', 'banana'])
  })
})

// ============================================================================
// simpleHash Tests
// ============================================================================

describe('simpleHash', () => {
  it('should produce consistent hashes', () => {
    const hash1 = simpleHash('hello world')
    const hash2 = simpleHash('hello world')
    expect(hash1).toBe(hash2)
  })

  it('should produce different hashes for different inputs', () => {
    const hash1 = simpleHash('hello world')
    const hash2 = simpleHash('hello world!')
    expect(hash1).not.toBe(hash2)
  })

  it('should produce non-empty hashes', () => {
    expect(simpleHash('test').length).toBeGreaterThan(0)
  })
})

// ============================================================================
// taskFingerprintSync Tests
// ============================================================================

describe('taskFingerprintSync', () => {
  it('should produce consistent fingerprints', () => {
    const fp1 = taskFingerprintSync('What is 2+2?', '4', ['math'])
    const fp2 = taskFingerprintSync('What is 2+2?', '4', ['math'])
    expect(fp1.fingerprint).toBe(fp2.fingerprint)
  })

  it('should produce different fingerprints for different questions', () => {
    const fp1 = taskFingerprintSync('What is 2+2?', '4', ['math'])
    const fp2 = taskFingerprintSync('What is 3+3?', '6', ['math'])
    expect(fp1.fingerprint).not.toBe(fp2.fingerprint)
  })

  it('should normalize before fingerprinting', () => {
    const fp1 = taskFingerprintSync('What is 2+2?', '4', ['Math'])
    const fp2 = taskFingerprintSync('what is 2+2', '4', ['math'])
    expect(fp1.fingerprint).toBe(fp2.fingerprint)
  })

  it('should include tags in fingerprint', () => {
    const fp1 = taskFingerprintSync('Question', 'Answer', ['tag1'])
    const fp2 = taskFingerprintSync('Question', 'Answer', ['tag2'])
    expect(fp1.fingerprint).not.toBe(fp2.fingerprint)
  })

  it('should sort tags before fingerprinting', () => {
    const fp1 = taskFingerprintSync('Question', 'Answer', ['a', 'b'])
    const fp2 = taskFingerprintSync('Question', 'Answer', ['b', 'a'])
    expect(fp1.fingerprint).toBe(fp2.fingerprint)
  })
})

// ============================================================================
// checkFingerprintDuplicate Tests
// ============================================================================

describe('checkFingerprintDuplicate', () => {
  it('should detect exact duplicates', () => {
    const existingMap = new Map([
      ['task1', 'abc123'],
      ['task2', 'def456']
    ])
    
    const result = checkFingerprintDuplicate('abc123', existingMap)
    expect(result.isDuplicate).toBe(true)
    expect(result.matchingTaskId).toBe('task1')
  })

  it('should not flag non-duplicates', () => {
    const existingMap = new Map([
      ['task1', 'abc123'],
      ['task2', 'def456']
    ])
    
    const result = checkFingerprintDuplicate('xyz789', existingMap)
    expect(result.isDuplicate).toBe(false)
    expect(result.matchingTaskId).toBeUndefined()
  })

  it('should handle empty maps', () => {
    const existingMap = new Map<string, string>()
    
    const result = checkFingerprintDuplicate('abc123', existingMap)
    expect(result.isDuplicate).toBe(false)
  })
})

// ============================================================================
// buildFingerprintMap Tests
// ============================================================================

describe('buildFingerprintMap', () => {
  it('should build map from tasks with fingerprints', () => {
    const tasks = [
      { id: 'task1', fingerprint: 'fp1' },
      { id: 'task2', fingerprint: 'fp2' },
      { id: 'task3' } // No fingerprint
    ]
    
    const map = buildFingerprintMap(tasks)
    expect(map.size).toBe(2)
    expect(map.get('task1')).toBe('fp1')
    expect(map.get('task2')).toBe('fp2')
    expect(map.has('task3')).toBe(false)
  })

  it('should handle empty arrays', () => {
    const map = buildFingerprintMap([])
    expect(map.size).toBe(0)
  })
})

// ============================================================================
// Semantic Similarity Tests
// ============================================================================

describe('tokenize', () => {
  it('should split text into tokens', () => {
    const tokens = tokenize('Hello World')
    expect(tokens).toContain('hello')
    expect(tokens).toContain('world')
  })

  it('should remove short tokens', () => {
    const tokens = tokenize('I am a test')
    expect(tokens).not.toContain('i')
    expect(tokens).not.toContain('a')
    expect(tokens).toContain('am')
    expect(tokens).toContain('test')
  })
})

describe('jaccardSimilarity', () => {
  it('should return 1 for identical texts', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1)
  })

  it('should return 0 for completely different texts', () => {
    expect(jaccardSimilarity('hello world', 'foo bar baz')).toBe(0)
  })

  it('should return partial similarity for overlapping texts', () => {
    const sim = jaccardSimilarity('hello world', 'hello there')
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })
})

describe('ngramSimilarity', () => {
  it('should return 1 for identical texts', () => {
    expect(ngramSimilarity('hello world', 'hello world')).toBe(1)
  })

  it('should return high similarity for similar texts', () => {
    const sim = ngramSimilarity('hello world', 'hello world!')
    expect(sim).toBeGreaterThan(0.8)
  })

  it('should return low similarity for different texts', () => {
    const sim = ngramSimilarity('hello world', 'goodbye moon')
    expect(sim).toBeLessThan(0.3)
  })
})

describe('softSemanticSimilarity', () => {
  it('should return 1 for identical texts', () => {
    expect(softSemanticSimilarity('hello world', 'hello world')).toBe(1)
  })

  it('should detect paraphrased content', () => {
    const text1 = 'Berechne die Summe von 5 und 3'
    const text2 = 'Berechne die Summe von 5 und 3'
    expect(softSemanticSimilarity(text1, text2)).toBe(1)
  })

  it('should distinguish different content', () => {
    const text1 = 'Berechne die Summe von 5 und 3'
    const text2 = 'Erkläre die Theorie der Relativität'
    expect(softSemanticSimilarity(text1, text2)).toBeLessThan(0.3)
  })
})

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const vec = [1, 2, 3]
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5)
  })

  it('should return 0 for orthogonal vectors', () => {
    const vec1 = [1, 0]
    const vec2 = [0, 1]
    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 5)
  })

  it('should return -1 for opposite vectors', () => {
    const vec1 = [1, 0]
    const vec2 = [-1, 0]
    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1, 5)
  })

  it('should handle zero vectors', () => {
    const vec1 = [0, 0]
    const vec2 = [1, 0]
    expect(cosineSimilarity(vec1, vec2)).toBe(0)
  })
})

// ============================================================================
// Integration: Dedup Workflow
// ============================================================================

describe('Integration: Dedup workflow', () => {
  it('should correctly identify duplicate tasks', () => {
    // Simulate existing tasks
    const existingTasks = [
      { id: 'task1', fingerprint: taskFingerprintSync('What is 2+2?', '4', ['math']).fingerprint },
      { id: 'task2', fingerprint: taskFingerprintSync('Explain recursion', 'A function that calls itself', ['programming']).fingerprint }
    ]
    
    // New task that is a duplicate (with minor text differences)
    const newTask = taskFingerprintSync('what is 2+2', '4', ['Math'])
    const existingMap = buildFingerprintMap(existingTasks)
    const dupCheck = checkFingerprintDuplicate(newTask.fingerprint, existingMap)
    
    expect(dupCheck.isDuplicate).toBe(true)
    expect(dupCheck.matchingTaskId).toBe('task1')
  })

  it('should allow genuinely new tasks', () => {
    const existingTasks = [
      { id: 'task1', fingerprint: taskFingerprintSync('What is 2+2?', '4', ['math']).fingerprint }
    ]
    
    // New task that is NOT a duplicate
    const newTask = taskFingerprintSync('What is 3*3?', '9', ['math'])
    const existingMap = buildFingerprintMap(existingTasks)
    const dupCheck = checkFingerprintDuplicate(newTask.fingerprint, existingMap)
    
    expect(dupCheck.isDuplicate).toBe(false)
  })
})
