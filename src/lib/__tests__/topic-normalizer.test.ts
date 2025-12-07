/**
 * Tests for Topic Normalizer
 * 
 * Run with: npx vitest run src/lib/__tests__/topic-normalizer.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTopicKey,
  findCanonicalTopic,
  isNoiseTopic,
  detectExpectedAnswerFormat,
  detectSubtasks,
  detectPoints,
  estimateDifficulty
} from '../topic-normalizer'

describe('normalizeTopicKey', () => {
  it('should lowercase and trim', () => {
    expect(normalizeTopicKey('  KV-Diagramm  ')).toBe('kv-diagramm')
  })

  it('should convert underscores to hyphens', () => {
    expect(normalizeTopicKey('quine_mccluskey')).toBe('quine-mccluskey')
  })

  it('should collapse multiple whitespace', () => {
    expect(normalizeTopicKey('boolesche   algebra')).toBe('boolesche-algebra')
  })

  it('should remove special characters except hyphens', () => {
    expect(normalizeTopicKey('KV-Diagramm (4 Variablen)')).toBe('kv-diagramm-4-variablen')
  })
})

describe('findCanonicalTopic', () => {
  it('should find canonical topic for synonyms', () => {
    expect(findCanonicalTopic('karnaugh-diagramm')).toBe('kv-diagramm')
    expect(findCanonicalTopic('karnaugh-veitch')).toBe('kv-diagramm')
    expect(findCanonicalTopic('KV-Map')).toBe('kv-diagramm')
  })

  it('should find canonical topic for quine-mccluskey variations', () => {
    expect(findCanonicalTopic('quine mccluskey')).toBe('quine-mccluskey')
    expect(findCanonicalTopic('QMC')).toBe('quine-mccluskey')
    expect(findCanonicalTopic('qmc-verfahren')).toBe('quine-mccluskey')
  })

  it('should find canonical topic for number systems', () => {
    expect(findCanonicalTopic('dezimal')).toBe('zahlensysteme')
    expect(findCanonicalTopic('binärsystem')).toBe('zahlensysteme')
    expect(findCanonicalTopic('hexadezimal')).toBe('zahlensysteme')
  })

  it('should find canonical topic for boolean algebra', () => {
    expect(findCanonicalTopic('de morgan')).toBe('boolesche-algebra')
    expect(findCanonicalTopic('wahrheitstabelle')).toBe('boolesche-algebra')
    expect(findCanonicalTopic('logikgatter')).toBe('boolesche-algebra')
  })

  it('should return null for unknown topics', () => {
    expect(findCanonicalTopic('asdfghjkl')).toBeNull()
    expect(findCanonicalTopic('random topic')).toBeNull()
  })

  it('should be case insensitive', () => {
    expect(findCanonicalTopic('KV-DIAGRAMM')).toBe('kv-diagramm')
    expect(findCanonicalTopic('Quine-McCluskey')).toBe('quine-mccluskey')
  })
})

describe('isNoiseTopic', () => {
  it('should identify noise topics', () => {
    expect(isNoiseTopic('beispiel')).toBe(true)
    expect(isNoiseTopic('Aufgabe 1')).toBe(true)
    expect(isNoiseTopic('Kapitel 3')).toBe(true)
    expect(isNoiseTopic('übung')).toBe(true)
    expect(isNoiseTopic('zusammenfassung')).toBe(true)
  })

  it('should not flag real topics as noise', () => {
    expect(isNoiseTopic('kv-diagramm')).toBe(false)
    expect(isNoiseTopic('boolesche algebra')).toBe(false)
    expect(isNoiseTopic('huffman-codierung')).toBe(false)
  })

  it('should identify single characters and short strings as noise', () => {
    expect(isNoiseTopic('a')).toBe(true)
    expect(isNoiseTopic('ab')).toBe(true)
    expect(isNoiseTopic('abc')).toBe(false) // 3+ chars is OK
  })
})

describe('detectExpectedAnswerFormat', () => {
  it('should detect table format', () => {
    const formats = detectExpectedAnswerFormat('Erstelle eine Wahrheitstabelle für f(a,b,c)')
    expect(formats).toContain('table')
  })

  it('should detect formula format', () => {
    const formats = detectExpectedAnswerFormat('Gib die minimale DNF an')
    expect(formats).toContain('formula')
  })

  it('should detect diagram format', () => {
    const formats = detectExpectedAnswerFormat('Zeichne ein KV-Diagramm')
    expect(formats).toContain('diagram')
  })

  it('should detect number format', () => {
    const formats = detectExpectedAnswerFormat('Berechne das Ergebnis')
    expect(formats).toContain('number')
  })

  it('should detect code format', () => {
    const formats = detectExpectedAnswerFormat('Implementiere den Algorithmus in Python')
    expect(formats).toContain('code')
  })

  it('should detect multiple formats', () => {
    const formats = detectExpectedAnswerFormat('Erstelle eine Tabelle und leite die Formel ab')
    expect(formats).toContain('table')
    expect(formats).toContain('formula')
  })
})

describe('detectSubtasks', () => {
  it('should detect letter subtasks', () => {
    const subtasks = detectSubtasks('a) Berechne x\nb) Berechne y\nc) Zeige z')
    expect(subtasks).toHaveLength(3)
    expect(subtasks[0]).toContain('Berechne x')
  })

  it('should detect numbered subtasks', () => {
    const subtasks = detectSubtasks('1. Bestimme A\n2. Bestimme B')
    expect(subtasks).toHaveLength(2)
  })

  it('should detect parenthesis subtasks', () => {
    const subtasks = detectSubtasks('(i) Zeige Aussage 1\n(ii) Zeige Aussage 2')
    expect(subtasks).toHaveLength(2)
  })

  it('should return empty array if no subtasks', () => {
    const subtasks = detectSubtasks('Berechne das Ergebnis.')
    expect(subtasks).toHaveLength(0)
  })
})

describe('detectPoints', () => {
  it('should detect points in parentheses', () => {
    expect(detectPoints('Aufgabe 1 (10P)')).toBe(10)
    expect(detectPoints('Berechne x (5 Punkte)')).toBe(5)
  })

  it('should detect points after text', () => {
    expect(detectPoints('Aufgabe 3: 15 Punkte')).toBe(15)
  })

  it('should return null if no points found', () => {
    expect(detectPoints('Berechne das Ergebnis')).toBeNull()
  })
})

describe('estimateDifficulty', () => {
  it('should estimate easy difficulty', () => {
    expect(estimateDifficulty('Einfache Umrechnung von 42 in Binär')).toBe('easy')
    expect(estimateDifficulty('Grundlegende Wahrheitstabelle')).toBe('easy')
  })

  it('should estimate hard difficulty', () => {
    expect(estimateDifficulty('Komplexe Minimierung mit 6 Variablen')).toBe('hard')
    expect(estimateDifficulty('Schwierige Automaten-Konstruktion')).toBe('hard')
  })

  it('should estimate medium by default', () => {
    expect(estimateDifficulty('Minimiere die Funktion f(a,b,c)')).toBe('medium')
  })

  it('should consider number of variables', () => {
    expect(estimateDifficulty('f(a,b) = a AND b')).toBe('easy') // 2 vars
    expect(estimateDifficulty('f(a,b,c,d,e,f) = ...')).toBe('hard') // 6 vars
  })
})
