/**
 * Tests for Task Fingerprinting
 * 
 * Run with: npx vitest run src/lib/__tests__/task-fingerprint.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  detectArchetype,
  extractFeatures,
  createTaskFingerprint,
  compareFingerprints,
  checkForDuplicate,
  isVariantOf,
  getVariationStrategies
} from '../task-fingerprint'

describe('detectArchetype', () => {
  it('should detect KV diagram archetype', () => {
    expect(detectArchetype('Erstelle ein KV-Diagramm für f(a,b,c,d)')).toBe('kv-minimization')
    expect(detectArchetype('Minimiere mit Karnaugh-Veitch')).toBe('kv-minimization')
  })

  it('should detect Quine-McCluskey archetype', () => {
    expect(detectArchetype('Wende das Quine-McCluskey Verfahren an')).toBe('quine-mccluskey')
    expect(detectArchetype('Löse mit QMC')).toBe('quine-mccluskey')
  })

  it('should detect truth table archetype', () => {
    expect(detectArchetype('Erstelle eine Wahrheitstabelle')).toBe('truth-table')
  })

  it('should detect number conversion archetype', () => {
    expect(detectArchetype('Konvertiere 42 von dezimal nach binär')).toBe('number-conversion')
    expect(detectArchetype('Rechne die Zahl um')).toBe('number-conversion')
  })

  it('should detect automaton archetypes', () => {
    expect(detectArchetype('Entwerfe einen Mealy-Automaten')).toBe('mealy-automaton')
    expect(detectArchetype('Konstruiere einen DFA')).toBe('dfa-design')
    expect(detectArchetype('Erstelle eine Zustandsmaschine')).toBe('automaton-general')
  })

  it('should detect Huffman coding archetype', () => {
    expect(detectArchetype('Erstelle einen Huffman-Code')).toBe('huffman-coding')
  })

  it('should detect proof archetype', () => {
    expect(detectArchetype('Beweise, dass A = B')).toBe('proof')
    expect(detectArchetype('Zeige, dass gilt...')).toBe('proof')
  })

  it('should return general for unknown patterns', () => {
    expect(detectArchetype('Random question without pattern')).toBe('general')
  })
})

describe('extractFeatures', () => {
  it('should count subtasks', () => {
    const features = extractFeatures('a) Berechne x\nb) Berechne y', ['a)', 'b)'])
    expect(features.numSubtasks).toBe(2)
  })

  it('should detect variables', () => {
    const features = extractFeatures('Gegeben f(a,b,c,d) mit 4 Variablen')
    expect(features.numVariables).toBe(4)
  })

  it('should detect table requirement', () => {
    const features = extractFeatures('Erstelle eine Tabelle')
    expect(features.requiresTable).toBe(true)
    expect(features.answerFormats).toContain('table')
  })

  it('should detect diagram requirement', () => {
    const features = extractFeatures('Zeichne das Diagramm')
    expect(features.requiresDiagram).toBe(true)
    expect(features.answerFormats).toContain('diagram')
  })

  it('should detect code requirement', () => {
    const features = extractFeatures('Implementiere den Algorithmus')
    expect(features.requiresCode).toBe(true)
    expect(features.answerFormats).toContain('code')
  })

  it('should estimate complexity', () => {
    const simple = extractFeatures('Berechne 5+3')
    const complex = extractFeatures('Minimiere f(a,b,c,d,e) mit KV-Diagramm und erstelle Schaltung', 
      ['a)', 'b)', 'c)', 'd)'])
    
    expect(complex.complexity).toBeGreaterThan(simple.complexity)
  })
})

describe('createTaskFingerprint', () => {
  it('should create fingerprint with all components', () => {
    const fp = createTaskFingerprint(
      'Erstelle ein KV-Diagramm für f(a,b,c)',
      ['kv-diagramm', 'boolesche-algebra'],
      ['a) Zeichne KV', 'b) Bestimme Primimplikanten']
    )

    expect(fp.topic).toBe('kv-diagramm')
    expect(fp.archetype).toBe('kv-minimization')
    expect(fp.features.numSubtasks).toBe(2)
    expect(fp.fingerprint).toBeTruthy()
    expect(fp.hash).toBeTruthy()
  })

  it('should normalize topic', () => {
    const fp = createTaskFingerprint(
      'Test question',
      ['Karnaugh-Veitch'],
      []
    )
    expect(fp.topic).toBe('kv-diagramm')
  })
})

describe('compareFingerprints', () => {
  it('should return 1.0 for identical fingerprints', () => {
    const fp1 = createTaskFingerprint(
      'Erstelle KV-Diagramm für f(a,b,c)',
      ['kv-diagramm'],
      ['a)', 'b)']
    )
    const fp2 = createTaskFingerprint(
      'Erstelle KV-Diagramm für g(x,y,z)',
      ['kv-diagramm'],
      ['a)', 'b)']
    )

    const similarity = compareFingerprints(fp1, fp2)
    expect(similarity).toBeGreaterThanOrEqual(0.9)
  })

  it('should return high similarity for same archetype different difficulty', () => {
    const fp1 = createTaskFingerprint('Einfaches KV-Diagramm', ['kv-diagramm'], [])
    const fp2 = createTaskFingerprint('Komplexes KV-Diagramm', ['kv-diagramm'], ['a)', 'b)', 'c)'])

    const similarity = compareFingerprints(fp1, fp2)
    expect(similarity).toBeGreaterThan(0.6) // Same topic & archetype
    expect(similarity).toBeLessThan(0.95) // But different structure
  })

  it('should return low similarity for different archetypes', () => {
    const fp1 = createTaskFingerprint('KV-Diagramm erstellen', ['kv-diagramm'], [])
    const fp2 = createTaskFingerprint('Huffman-Code erstellen', ['huffman'], [])

    const similarity = compareFingerprints(fp1, fp2)
    expect(similarity).toBeLessThan(0.5)
  })
})

describe('checkForDuplicate', () => {
  it('should detect duplicate', () => {
    const existing = new Map<string, ReturnType<typeof createTaskFingerprint>>()
    existing.set('task-1', createTaskFingerprint(
      'Erstelle KV-Diagramm für f(a,b,c)',
      ['kv-diagramm'],
      ['a)', 'b)']
    ))

    const newFp = createTaskFingerprint(
      'Erstelle KV-Diagramm für g(x,y,z)',
      ['kv-diagramm'],
      ['a)', 'b)']
    )

    const result = checkForDuplicate(newFp, existing, 0.85)
    expect(result.isDuplicate).toBe(true)
    expect(result.matchingTaskId).toBe('task-1')
  })

  it('should not flag different tasks as duplicates', () => {
    const existing = new Map<string, ReturnType<typeof createTaskFingerprint>>()
    existing.set('task-1', createTaskFingerprint(
      'Erstelle KV-Diagramm',
      ['kv-diagramm'],
      []
    ))

    const newFp = createTaskFingerprint(
      'Erstelle Huffman-Code',
      ['huffman'],
      []
    )

    const result = checkForDuplicate(newFp, existing, 0.85)
    expect(result.isDuplicate).toBe(false)
  })
})

describe('isVariantOf', () => {
  it('should identify variants (same archetype, different features)', () => {
    const fp1 = createTaskFingerprint('KV-Diagramm 3 Variablen', ['kv-diagramm'], [])
    const fp2 = createTaskFingerprint('KV-Diagramm 4 Variablen', ['kv-diagramm'], ['a)', 'b)'])
    
    // Manually set different variable counts
    fp1.features.numVariables = 3
    fp2.features.numVariables = 4

    expect(isVariantOf(fp2, fp1)).toBe(true)
  })

  it('should not identify as variant if archetype differs', () => {
    const fp1 = createTaskFingerprint('KV-Diagramm', ['kv-diagramm'], [])
    const fp2 = createTaskFingerprint('Huffman-Code', ['huffman'], [])

    expect(isVariantOf(fp2, fp1)).toBe(false)
  })

  it('should not identify as variant if features are identical', () => {
    const fp1 = createTaskFingerprint('KV-Diagramm f(a,b,c)', ['kv-diagramm'], [])
    const fp2 = createTaskFingerprint('KV-Diagramm g(x,y,z)', ['kv-diagramm'], [])

    // Same features = duplicate, not variant
    expect(isVariantOf(fp2, fp1)).toBe(false)
  })
})

describe('getVariationStrategies', () => {
  it('should return strategies for KV diagrams', () => {
    const strategies = getVariationStrategies('kv-minimization')
    expect(strategies.length).toBeGreaterThan(0)
    expect(strategies.some(s => s.toLowerCase().includes('variable'))).toBe(true)
  })

  it('should return strategies for number conversion', () => {
    const strategies = getVariationStrategies('number-conversion')
    expect(strategies.length).toBeGreaterThan(0)
    expect(strategies.some(s => s.toLowerCase().includes('zahl'))).toBe(true)
  })

  it('should return default strategies for unknown archetypes', () => {
    const strategies = getVariationStrategies('unknown-archetype')
    expect(strategies.length).toBeGreaterThan(0)
  })
})
