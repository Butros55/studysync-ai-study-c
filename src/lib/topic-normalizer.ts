/**
 * Topic Normalization System
 * 
 * Provides consistent topic normalization to handle inconsistent topic strings
 * like "kv-diagramm" vs "kv - diagramm" vs "KV-Diagramm" vs "Karnaugh-Veitch".
 * 
 * Key concepts:
 * - Canonical topic: normalized, lowercase form for matching
 * - Display topic: preferred human-readable display form
 * - Synonyms: alternative spellings that map to the same canonical topic
 */

// ============================================================================
// Canonical Topic Mappings
// ============================================================================

/**
 * Maps canonical topic keys to their aliases/synonyms.
 * The first entry is the preferred display form.
 */
export const CANONICAL_TOPIC_MAP: Record<string, string[]> = {
  // Boolean Algebra & Logic
  'boolesche-algebra': [
    'Boolesche Algebra',
    'boolsche algebra', 'boolean algebra', 'boolesche logik', 'boolsche logik',
    'schaltalgebra', 'switching algebra'
  ],
  'wahrheitstabelle': [
    'Wahrheitstabelle',
    'wahrheitstafel', 'truth table', 'funktionstabelle', 'wahrheits-tabelle'
  ],
  'kv-diagramm': [
    'KV-Diagramm',
    'karnaugh-veitch', 'karnaugh veitch', 'karnaugh', 'kv map', 'kvmap', 'k-map', 
    'kmap', 'kv - diagramm', 'kvdiagramm', 'karnaugh-diagramm', 'veitch-diagramm'
  ],
  'quine-mccluskey': [
    'Quine-McCluskey',
    'quine mccluskey', 'quinemccluskey', 'qmc', 'quine-mc-cluskey', 'mccluskey',
    'tabellenverfahren', 'quine-mccluskey-verfahren', 'quine-mccluskey verfahren'
  ],
  'minimierung': [
    'Minimierung',
    'vereinfachung', 'minimieren', 'simplification', 'reduktion', 'optimierung',
    'funktionsminimierung', 'schaltungsminimierung'
  ],
  'primimplikanten': [
    'Primimplikanten',
    'primimplikant', 'prime implicants', 'kernimplikanten', 'wesentliche primimplikanten'
  ],
  
  // Number Systems
  'zahlensysteme': [
    'Zahlensysteme',
    'zahlensystem', 'number systems', 'stellenwertsysteme', 'positionssysteme'
  ],
  'binaersystem': [
    'Binärsystem',
    'binär', 'binary', 'dualsystem', 'zweier-system', 'basis-2'
  ],
  'hexadezimal': [
    'Hexadezimalsystem',
    'hex', 'hexadezimal', 'hexadecimal', 'basis-16', 'sechzehnersystem'
  ],
  'oktal': [
    'Oktalsystem',
    'octal', 'basis-8', 'achtersystem'
  ],
  'bcd': [
    'BCD-Code',
    'binary coded decimal', 'bcd code', '8421-code', 'bcd'
  ],
  'zweierkomplement': [
    'Zweierkomplement',
    'twos complement', '2er komplement', '2er-komplement', 'zweier komplement',
    'twos-complement', 'vorzeichendarstellung'
  ],
  'einerkomplement': [
    'Einerkomplement',
    'ones complement', '1er komplement', 'einer komplement'
  ],
  'gleitkommazahl': [
    'Gleitkommazahlen',
    'floating point', 'fließkomma', 'gleitkomma', 'floating-point',
    'ieee754', 'ieee 754', 'ieee-754'
  ],
  'festkommazahl': [
    'Festkommazahlen',
    'fixed point', 'festkomma', 'fixed-point'
  ],
  
  // Digital Logic
  'gatter': [
    'Logikgatter',
    'gates', 'logic gates', 'schaltgatter', 'grundgatter',
    'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'
  ],
  'schaltnetze': [
    'Schaltnetze',
    'schaltnetz', 'combinational circuits', 'kombinatorische schaltungen',
    'kombinatorik', 'kombinationsschaltung'
  ],
  'schaltwerke': [
    'Schaltwerke',
    'schaltwerk', 'sequential circuits', 'sequentielle schaltungen',
    'zustandsautomaten'
  ],
  'flipflop': [
    'Flipflops',
    'flip-flop', 'flip flop', 'speicherglieder', 'bistabile kippstufe',
    'rs-flipflop', 'jk-flipflop', 'd-flipflop', 't-flipflop'
  ],
  'multiplexer': [
    'Multiplexer',
    'mux', 'datenselektor', 'multiplexing'
  ],
  'demultiplexer': [
    'Demultiplexer',
    'demux', 'datenverteiler', 'demultiplexing'
  ],
  'addierer': [
    'Addierer',
    'adder', 'halbaddierer', 'volladdierer', 'carry-lookahead', 
    'ripple carry', 'half adder', 'full adder'
  ],
  'komparator': [
    'Komparator',
    'comparator', 'vergleicher', 'größenvergleich'
  ],
  
  // Automata Theory
  'automat': [
    'Automaten',
    'automaton', 'automata', 'zustandsmaschine', 'state machine',
    'endlicher automat', 'finite automaton', 'fsm'
  ],
  'dea': [
    'DEA',
    'dfa', 'deterministischer automat', 'deterministic finite automaton',
    'deterministisch endlicher automat'
  ],
  'nea': [
    'NEA',
    'nfa', 'nichtdeterministischer automat', 'non-deterministic finite automaton',
    'nichtdeterministisch endlicher automat'
  ],
  'zustandsdiagramm': [
    'Zustandsdiagramm',
    'state diagram', 'zustandsgraph', 'automatengraph', 'übergangsgraph'
  ],
  'zustandstabelle': [
    'Zustandstabelle',
    'state table', 'übergangstabelle', 'transition table'
  ],
  'regulaere-ausdruecke': [
    'Reguläre Ausdrücke',
    'regex', 'regexp', 'regular expressions', 'regulärer ausdruck'
  ],
  
  // Computer Architecture  
  'alu': [
    'ALU',
    'arithmetic logic unit', 'arithmetisch-logische einheit', 'rechenwerk'
  ],
  'register': [
    'Register',
    'registers', 'registerbank', 'speicherregister', 'schieberegister'
  ],
  'speicher': [
    'Speicher',
    'memory', 'ram', 'rom', 'cache', 'speicherarchitektur',
    'hauptspeicher', 'arbeitsspeicher'
  ],
  'bus': [
    'Bus-Systeme',
    'bus', 'datenbus', 'adressbus', 'steuerbus', 'systembus'
  ],
  'cpu': [
    'CPU',
    'processor', 'prozessor', 'central processing unit', 'rechenwerk',
    'steuerwerk', 'leitwerk'
  ],
  
  // Encoding & Codes
  'fehlerkorrektur': [
    'Fehlerkorrektur',
    'error correction', 'ecc', 'fehlerkorrekturcode', 'fehlererkennung'
  ],
  'hamming': [
    'Hamming-Code',
    'hamming', 'hamming code', 'hamming-distanz', 'hamming distance'
  ],
  'parity': [
    'Parität',
    'parity', 'paritätsbit', 'gerade parität', 'ungerade parität'
  ],
  
  // Misc Technical
  'horner-schema': [
    'Horner-Schema',
    'horner', 'horner schema', 'hornerschema', 'horner-verfahren'
  ],
  'assembler': [
    'Assembler',
    'assembly', 'maschinensprache', 'maschinenprogrammierung'
  ],
  'mikroprogrammierung': [
    'Mikroprogrammierung',
    'microcode', 'mikroprogramm', 'mikrobefehl'
  ]
}

/**
 * Noise topics that should be filtered out
 */
const NOISE_TOPICS = new Set([
  'aufgaben', 'aufgabe', 'übungen', 'übung', 'exercises', 'exercise',
  'keine zusammenfassung', 'keine zusammenfassung mehr möglich',
  'allgemein', 'general', 'sonstiges', 'misc', 'miscellaneous',
  'einleitung', 'einführung', 'introduction', 'intro',
  'zusammenfassung', 'summary', 'fazit', 'conclusion',
  'anhang', 'appendix', 'literatur', 'quellen', 'references',
  'seite', 'page', 'kapitel', 'chapter', 'abschnitt', 'section'
])

/**
 * Minimum length for a valid topic (after normalization)
 */
const MIN_TOPIC_LENGTH = 3

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize a topic string for consistent matching.
 * 
 * Process:
 * 1. Lowercase
 * 2. Trim whitespace
 * 3. Normalize unicode apostrophes and quotes
 * 4. Collapse multiple spaces to single space
 * 5. Normalize hyphen/dash spacing
 * 6. Replace umlauts with ascii equivalents for matching
 */
export function normalizeTopicKey(topic: string): string {
  if (!topic || typeof topic !== 'string') return ''
  
  let normalized = topic
    // Lowercase
    .toLowerCase()
    // Trim
    .trim()
    // Normalize various apostrophes/quotes
    .replace(/[''´`]/g, "'")
    .replace(/[""„]/g, '"')
    // Remove content in parentheses for key matching
    .replace(/\([^)]*\)/g, ' ')
    // Normalize hyphens with spacing issues
    .replace(/\s*[-–—]\s*/g, '-')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Remove trailing/leading punctuation
    .replace(/^[.,;:!?]+|[.,;:!?]+$/g, '')
    .trim()
  
  // Replace umlauts for consistent key matching
  normalized = normalized
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
  
  return normalized
}

/**
 * Find the canonical topic for a given topic string.
 * Returns the canonical key and preferred display label.
 */
export function findCanonicalTopic(topic: string): {
  canonicalKey: string
  displayLabel: string
  matched: boolean
  matchedFrom?: string
} {
  const normalizedInput = normalizeTopicKey(topic)
  
  if (!normalizedInput || normalizedInput.length < MIN_TOPIC_LENGTH) {
    return {
      canonicalKey: normalizedInput,
      displayLabel: topic.trim(),
      matched: false
    }
  }
  
  // First, check if it's a noise topic
  if (isNoiseTopic(normalizedInput)) {
    return {
      canonicalKey: '',
      displayLabel: '',
      matched: false
    }
  }
  
  // Check against canonical map
  for (const [canonicalKey, aliases] of Object.entries(CANONICAL_TOPIC_MAP)) {
    // Check if the normalized input matches the canonical key
    if (normalizedInput === canonicalKey || normalizedInput === normalizeTopicKey(canonicalKey)) {
      return {
        canonicalKey,
        displayLabel: aliases[0], // First alias is the preferred display
        matched: true,
        matchedFrom: canonicalKey
      }
    }
    
    // Check against aliases
    for (const alias of aliases) {
      const normalizedAlias = normalizeTopicKey(alias)
      
      // Exact match
      if (normalizedInput === normalizedAlias) {
        return {
          canonicalKey,
          displayLabel: aliases[0],
          matched: true,
          matchedFrom: alias
        }
      }
      
      // Partial match (input contains alias or vice versa)
      if (normalizedInput.includes(normalizedAlias) || normalizedAlias.includes(normalizedInput)) {
        // Only match if reasonably similar length to avoid false positives
        if (Math.abs(normalizedInput.length - normalizedAlias.length) <= 5) {
          return {
            canonicalKey,
            displayLabel: aliases[0],
            matched: true,
            matchedFrom: alias
          }
        }
      }
    }
  }
  
  // No match found - return original with normalized key
  return {
    canonicalKey: normalizedInput,
    displayLabel: toDisplayCase(topic),
    matched: false
  }
}

/**
 * Check if a topic is a noise topic that should be filtered
 */
export function isNoiseTopic(topic: string): boolean {
  const normalized = normalizeTopicKey(topic)
  
  // Check against noise list
  if (NOISE_TOPICS.has(normalized)) return true
  
  // Check for very short topics
  if (normalized.length < MIN_TOPIC_LENGTH) return true
  
  // Check for page headers/numbers
  if (/^(seite|page)?\s*\d+$/.test(normalized)) return true
  
  // Check for chapter markers
  if (/^(kapitel|chapter)\s*\d+/.test(normalized)) return true
  
  return false
}

/**
 * Convert a topic to display case (capitalize first letters)
 */
function toDisplayCase(topic: string): string {
  return topic
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Normalize an array of topics, removing duplicates and noise
 */
export function normalizeTopics(topics: string[]): {
  canonicalTopics: string[]
  displayTopics: string[]
  topicMapping: Record<string, string>  // raw -> canonical
} {
  const canonicalSet = new Set<string>()
  const displayMap = new Map<string, string>()  // canonical -> display
  const topicMapping: Record<string, string> = {}
  
  for (const topic of topics) {
    const result = findCanonicalTopic(topic)
    
    if (!result.canonicalKey || result.canonicalKey.length < MIN_TOPIC_LENGTH) {
      continue  // Skip noise/invalid topics
    }
    
    canonicalSet.add(result.canonicalKey)
    displayMap.set(result.canonicalKey, result.displayLabel)
    topicMapping[topic] = result.canonicalKey
  }
  
  const canonicalTopics = Array.from(canonicalSet)
  const displayTopics = canonicalTopics.map(c => displayMap.get(c) || c)
  
  return {
    canonicalTopics,
    displayTopics,
    topicMapping
  }
}

/**
 * Get the display label for a canonical topic key
 */
export function getTopicDisplayLabel(canonicalKey: string): string {
  const aliases = CANONICAL_TOPIC_MAP[canonicalKey]
  if (aliases && aliases.length > 0) {
    return aliases[0]
  }
  return toDisplayCase(canonicalKey.replace(/-/g, ' '))
}

// ============================================================================
// Heuristic Detectors
// ============================================================================

/**
 * Detect expected answer format from question text using keywords
 */
export function detectExpectedAnswerFormat(text: string): string[] {
  const formats: string[] = []
  const lower = text.toLowerCase()
  
  // Truth table
  if (/wahrheitstabelle|wahrheitstafel|truth\s*table|funktionstabelle/i.test(lower)) {
    formats.push('truthTable')
  }
  
  // KV diagram
  if (/kv[-\s]?diagramm|karnaugh|veitch|k[-\s]?map/i.test(lower)) {
    formats.push('kvDiagram')
  }
  
  // Circuit diagram
  if (/schalt(netz|bild|plan|werk)|circuit|gatter(schaltung)?|logic\s*diagram/i.test(lower)) {
    formats.push('circuitDiagram')
  }
  
  // Calculation steps
  if (/berechne|rechne|umwandl|konvertier|wandle|horner|division/i.test(lower)) {
    formats.push('calculationSteps')
  }
  
  // IEEE 754 bit layout
  if (/ieee\s*754|gleitkomma|floating\s*point|mantisse|exponent.*bias/i.test(lower)) {
    formats.push('bitLayout')
  }
  
  // State table/diagram
  if (/zustandstabelle|zustandsdiagramm|übergangstabelle|automat/i.test(lower)) {
    formats.push('stateTable')
  }
  
  // Minimization / Prime implicants table
  if (/primimplikant|quine|mccluskey|minimier/i.test(lower)) {
    formats.push('primeImplicantTable')
  }
  
  // Short text answer
  if (/erkläre|erläutere|beschreibe|definiere|was\s+(ist|sind|bedeutet)/i.test(lower)) {
    formats.push('shortText')
  }
  
  // Binary/number representation
  if (/binär|dual|hexadezimal|oktal|zweierkomplement|darstellung/i.test(lower)) {
    formats.push('numberRepresentation')
  }
  
  // Default if nothing specific detected
  if (formats.length === 0) {
    formats.push('freeform')
  }
  
  return formats
}

/**
 * Detect subtask patterns in text
 */
export function detectSubtasks(text: string): {
  hasSubtasks: boolean
  pattern: 'letter' | 'number' | 'roman' | 'none'
  count: number
} {
  // Letter pattern: a), b), c) or (a), (b), (c)
  const letterMatches = text.match(/(?:^|\n)\s*(?:\(?[a-h]\)|\([a-h]\))/gm)
  if (letterMatches && letterMatches.length >= 2) {
    return { hasSubtasks: true, pattern: 'letter', count: letterMatches.length }
  }
  
  // Number pattern: 1), 2), 3) or 1., 2., 3. or (1), (2), (3)
  const numberMatches = text.match(/(?:^|\n)\s*(?:\d+[.):]|\(\d+\))/gm)
  if (numberMatches && numberMatches.length >= 2) {
    return { hasSubtasks: true, pattern: 'number', count: numberMatches.length }
  }
  
  // Roman pattern: i), ii), iii) or (i), (ii), (iii)
  const romanMatches = text.match(/(?:^|\n)\s*(?:\(?[ivx]+\)|\([ivx]+\))/gim)
  if (romanMatches && romanMatches.length >= 2) {
    return { hasSubtasks: true, pattern: 'roman', count: romanMatches.length }
  }
  
  return { hasSubtasks: false, pattern: 'none', count: 0 }
}

/**
 * Detect task number pattern (e.g., "Aufgabe 1", "Exercise 2")
 */
export function detectTaskNumber(text: string): {
  hasTaskNumber: boolean
  taskNumber?: number
  format?: string
} {
  const patterns = [
    /aufgabe\s+(\d+)/i,
    /exercise\s+(\d+)/i,
    /übung\s+(\d+)/i,
    /task\s+(\d+)/i,
    /problem\s+(\d+)/i,
    /frage\s+(\d+)/i,
    /question\s+(\d+)/i
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return {
        hasTaskNumber: true,
        taskNumber: parseInt(match[1]),
        format: pattern.source.split('\\s')[0]
      }
    }
  }
  
  return { hasTaskNumber: false }
}

/**
 * Detect points pattern (e.g., "(10P)", "5 Punkte", "[3 points]")
 */
export function detectPoints(text: string): {
  hasPoints: boolean
  points?: number
  format?: string
} {
  const patterns = [
    /\((\d+(?:[.,]\d+)?)\s*P(?:unkte?)?\)/i,
    /\[(\d+(?:[.,]\d+)?)\s*P(?:unkte?)?\]/i,
    /(\d+(?:[.,]\d+)?)\s*Punkte?\b/i,
    /\((\d+(?:[.,]\d+)?)\s*points?\)/i,
    /(\d+(?:[.,]\d+)?)\s*points?\b/i,
    /\((\d+(?:[.,]\d+)?)\s*P\.\)/i
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const points = parseFloat(match[1].replace(',', '.'))
      return {
        hasPoints: true,
        points,
        format: pattern.source
      }
    }
  }
  
  return { hasPoints: false }
}

/**
 * Estimate difficulty from text indicators
 */
export function estimateDifficulty(text: string): 'easy' | 'medium' | 'hard' | 'unknown' {
  const lower = text.toLowerCase()
  
  // Easy indicators
  const easyPatterns = [
    /einfach/i, /leicht/i, /simple/i, /basic/i, /grundlegend/i,
    /angeben/i, /nennen/i, /definieren/i, /\(1-2\s*p/i, /\(1\s*p/i, /\(2\s*p/i
  ]
  
  // Hard indicators
  const hardPatterns = [
    /schwer/i, /schwierig/i, /komplex/i, /anspruchsvoll/i, /advanced/i,
    /beweisen/i, /herleiten/i, /entwickeln/i, /optimieren/i,
    /\(8-?\d+\s*p/i, /\(9\s*p/i, /\(10\s*p/i, /\(1\d\s*p/i, /\(2\d\s*p/i
  ]
  
  for (const pattern of hardPatterns) {
    if (pattern.test(lower)) return 'hard'
  }
  
  for (const pattern of easyPatterns) {
    if (pattern.test(lower)) return 'easy'
  }
  
  // Check points as indicator
  const pointsResult = detectPoints(text)
  if (pointsResult.hasPoints && pointsResult.points) {
    if (pointsResult.points <= 3) return 'easy'
    if (pointsResult.points >= 8) return 'hard'
  }
  
  // Check subtask complexity
  const subtasks = detectSubtasks(text)
  if (subtasks.hasSubtasks && subtasks.count >= 4) return 'hard'
  
  return 'unknown'
}
