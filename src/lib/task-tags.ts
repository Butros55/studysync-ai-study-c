/**
 * Extrahiert Tags, Themen und Schwierigkeit aus Aufgabenstellungen
 */

// Bekannte Themen und ihre Schlagwörter
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Boolesche Algebra': ['boolean', 'boolesch', 'wahrheitstafel', 'wahrheitstabelle', 'konjunktion', 'disjunktion', 'negation', 'and', 'or', 'not', 'xor', 'nand', 'nor'],
  'Quine-McCluskey': ['quine', 'mccluskey', 'primimplikant', 'minimierung', 'dnf', 'knf', 'minterm', 'maxterm'],
  'KV-Diagramm': ['kv-diagramm', 'karnaugh', 'veitch', 'k-map'],
  'Digitale Logik': ['gatter', 'schaltung', 'flipflop', 'register', 'multiplexer', 'decoder', 'encoder', 'addierer', 'alu'],
  'Zahlensysteme': ['binär', 'hexadezimal', 'oktal', 'dezimal', 'zweierkomplement', 'einerkomplement', 'festkomma', 'gleitkomma', 'ieee'],
  'Automatentheorie': ['automat', 'zustand', 'deterministisch', 'nichtdeterministisch', 'dfa', 'nfa', 'mealy', 'moore', 'übergangsfunktion'],
  'Graphentheorie': ['graph', 'knoten', 'kante', 'pfad', 'zyklus', 'baum', 'adjazenz', 'dijkstra', 'bfs', 'dfs'],
  'Komplexität': ['o-notation', 'laufzeit', 'komplexität', 'big-o', 'landau', 'polynomial', 'exponentiell', 'np-hart', 'np-vollständig'],
  'Stochastik': ['wahrscheinlichkeit', 'erwartungswert', 'varianz', 'standardabweichung', 'binomialverteilung', 'normalverteilung', 'bayes'],
  'Lineare Algebra': ['matrix', 'vektor', 'determinante', 'eigenwert', 'eigenvektor', 'rang', 'inverse', 'linear'],
  'Analysis': ['ableitung', 'integral', 'grenzwert', 'stetigkeit', 'differenzierbar', 'taylor', 'reihe'],
  'Programmierung': ['algorithmus', 'rekursion', 'iteration', 'schleife', 'funktion', 'variable', 'datenstruktur', 'array', 'liste']
}

// Bekannte Module
const MODULE_KEYWORDS: Record<string, string[]> = {
  'Technische Informatik': ['ti', 'technische informatik', 'hardware', 'schaltung', 'gatter', 'register', 'cpu', 'speicher', 'bus'],
  'Grundbegriffe der Informatik': ['gbi', 'grundbegriffe', 'automat', 'sprache', 'grammatik', 'alphabet', 'wort'],
  'Mathematik': ['mathe', 'mathematik', 'analysis', 'lineare algebra', 'stochastik', 'statistik'],
  'Algorithmen': ['algo', 'algorithmen', 'datenstrukturen', 'sortieren', 'suchen', 'graph'],
  'Programmieren': ['programmieren', 'java', 'python', 'c++', 'code', 'software']
}

// Komplexitäts-Indikatoren
const COMPLEXITY_INDICATORS = {
  variables: /\b[a-e]\b/gi,  // Variablen a, b, c, d, e
  operators: /[∧∨¬⊕→↔⇒⇔\+\*\']/g,  // Logische Operatoren
  numbers: /\d+/g,
  subtasks: /[a-z]\)|[1-9]\.|teilaufgabe|schritt/gi
}

export interface ExtractedTags {
  topic: string
  module: string
  tags: string[]
  estimatedDifficulty: 'easy' | 'medium' | 'hard'
}

/**
 * Extrahiert Tags, Thema und geschätzte Schwierigkeit aus einer Aufgabenstellung
 */
export function extractTagsFromQuestion(questionText: string): ExtractedTags {
  const lowerText = questionText.toLowerCase()
  const tags: Set<string> = new Set()
  let topic = 'Allgemein'
  let module = 'Allgemein'

  // Thema erkennen
  for (const [topicName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        topic = topicName
        tags.add(keyword)
      }
    }
  }

  // Modul erkennen
  for (const [moduleName, keywords] of Object.entries(MODULE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        module = moduleName
        break
      }
    }
    if (module !== 'Allgemein') break
  }

  // Zusätzliche spezifische Tags
  if (lowerText.includes('wahrheitstafel') || lowerText.includes('wahrheitstabelle')) {
    tags.add('wahrheitstafel')
  }
  if (lowerText.includes('minimier') || lowerText.includes('vereinfach')) {
    tags.add('minimierung')
  }
  if (lowerText.includes('beweis') || lowerText.includes('zeige')) {
    tags.add('beweis')
  }
  if (lowerText.includes('berechne') || lowerText.includes('bestimme')) {
    tags.add('berechnung')
  }

  // Schwierigkeit schätzen
  const variableMatches = questionText.match(COMPLEXITY_INDICATORS.variables) || []
  const operatorMatches = questionText.match(COMPLEXITY_INDICATORS.operators) || []
  const subtaskMatches = questionText.match(COMPLEXITY_INDICATORS.subtasks) || []
  
  const uniqueVariables = new Set(variableMatches.map(v => v.toLowerCase())).size
  const operatorCount = operatorMatches.length
  const subtaskCount = subtaskMatches.length
  const textLength = questionText.length

  let estimatedDifficulty: 'easy' | 'medium' | 'hard' = 'easy'
  
  // Komplexitätspunkte berechnen
  let complexityScore = 0
  complexityScore += uniqueVariables * 2
  complexityScore += operatorCount * 1
  complexityScore += subtaskCount * 3
  complexityScore += Math.floor(textLength / 200)

  if (complexityScore >= 15 || subtaskCount >= 3) {
    estimatedDifficulty = 'hard'
  } else if (complexityScore >= 7 || subtaskCount >= 2) {
    estimatedDifficulty = 'medium'
  }

  return {
    topic,
    module,
    tags: Array.from(tags).slice(0, 5),  // Max 5 Tags
    estimatedDifficulty
  }
}

/**
 * Generiert einen kurzen Titel aus der Aufgabenstellung
 */
export function generateTaskTitle(question: string): string {
  // Bereinige Markdown und führende Nummerierungen
  const lines = question.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  // Suche die erste sinnvolle Zeile (nicht nur Nummerierung)
  let titleLine = ''
  for (const line of lines) {
    // Entferne führende Nummerierung wie "1.", "1)", "a)", "a.", "#", "##", etc.
    const cleaned = line
      .replace(/^#+\s*/, '') // Markdown headers
      .replace(/^\d+[\.\)]\s*/, '') // "1." oder "1)"
      .replace(/^[a-zA-Z][\.\)]\s*/, '') // "a." oder "a)"
      .replace(/^\*+\s*/, '') // Aufzählungszeichen
      .replace(/^-\s*/, '') // Dash-Aufzählungen
      .trim()
    
    // Ignoriere Zeilen die nur aus kurzer Nummerierung bestehen
    if (cleaned.length >= 10) {
      titleLine = cleaned
      break
    } else if (cleaned.length > 0 && !titleLine) {
      // Fallback auf die erste nicht-leere Zeile nach Bereinigung
      titleLine = cleaned
    }
  }
  
  // Wenn keine gute Zeile gefunden, nimm die ursprüngliche erste Zeile
  if (!titleLine) {
    titleLine = lines[0] || 'Aufgabe'
  }
  
  // Ersten Satz extrahieren (aber nur bei Punkt nach mindestens 15 Zeichen)
  const sentenceMatch = titleLine.match(/^(.{15,}?)[.!?]/)
  const title = sentenceMatch ? sentenceMatch[1].trim() : titleLine
  
  // Kürzen wenn zu lang
  if (title.length > 80) {
    return title.substring(0, 77) + '...'
  }
  
  return title || 'Aufgabe'
}
