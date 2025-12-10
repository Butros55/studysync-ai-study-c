/**
 * Notes Prompt Template
 * 
 * Used for generating study notes (Lernnotizen).
 * SEPARATE from task generation, exam generation, and flashcards.
 * 
 * PROMPT VERSION: 1.0.0
 */

export const NOTES_PROMPT_VERSION = '1.0.0'

export interface NotesPromptParams {
  /** Script/document name */
  scriptName: string
  /** Script content (will be truncated if too long) */
  scriptContent: string
  /** Maximum content length */
  maxContentLength?: number
  /** Module name for context */
  moduleName?: string
  /** Style preferences */
  style?: 'concise' | 'detailed' | 'bullet-points'
}

/**
 * Build the notes generation prompt
 */
export function buildNotesPrompt(params: NotesPromptParams): string {
  const {
    scriptName,
    scriptContent,
    maxContentLength = 20000,
    moduleName,
    style = 'concise'
  } = params

  const truncatedContent = scriptContent.length > maxContentLength
    ? scriptContent.substring(0, maxContentLength) + '\n\n[... weitere Inhalte gekürzt ...]'
    : scriptContent

  const moduleSection = moduleName 
    ? `Modul: ${moduleName}\n` 
    : ''

  const styleGuidelines = getStyleGuidelines(style)

  return `Du bist ein erfahrener Tutor. Erstelle strukturierte Lernnotizen aus dem folgenden Kursmaterial.

${moduleSection}Dokument: ${scriptName}

${styleGuidelines}

WICHTIGE REGELN:
1. Nutze Markdown-Formatierung (## für Überschriften, - für Listen)
2. Mathematische Formeln in LaTeX: $formel$ für inline, $$formel$$ für Blöcke
3. Wichtige Begriffe **fett** markieren
4. Logische Struktur: Vom Allgemeinen zum Speziellen
5. Alles auf DEUTSCH
6. KEINE Aufgaben oder Übungen einfügen - nur Lerninhalt!

STRUKTUR:
## Hauptthema
Kurze Einleitung...

### Unterthema 1
- Wichtiger Punkt
- Weitere Erklärung
  - Detail wenn nötig

### Formeln & Definitionen
$$ \\text{Formel hier} $$
Erklärung der Variablen...

### Zusammenfassung
Die wichtigsten Punkte auf einen Blick.

---

KURSMATERIAL:
${truncatedContent}

---

Erstelle jetzt die Lernnotizen. Gib NUR den Markdown-Text zurück, kein JSON.`
}

function getStyleGuidelines(style: 'concise' | 'detailed' | 'bullet-points'): string {
  switch (style) {
    case 'concise':
      return `STIL: KOMPAKT
- Fokus auf die Kernaussagen
- Maximal 3-4 Sätze pro Abschnitt
- Nur die wichtigsten Formeln`
    case 'detailed':
      return `STIL: AUSFÜHRLICH
- Detaillierte Erklärungen
- Beispiele einbeziehen
- Alle relevanten Formeln mit Herleitung`
    case 'bullet-points':
      return `STIL: STICHPUNKTE
- Fast ausschließlich Aufzählungen
- Sehr kurze, prägnante Punkte
- Keine Fließtexte`
  }
}

/**
 * Validate and clean notes response
 */
export function validateNotesResponse(response: string): {
  success: boolean
  notes?: string
  error?: string
} {
  if (!response || response.trim().length < 100) {
    return { success: false, error: 'Notes too short or empty' }
  }
  
  // Check for markdown structure
  const hasHeadings = /^##?\s+.+$/m.test(response)
  const hasContent = response.trim().length > 200
  
  if (!hasHeadings) {
    // Try to add structure if missing
    const lines = response.split('\n')
    if (lines.length > 3) {
      // Assume first line is title
      const structured = `## ${lines[0]}\n\n${lines.slice(1).join('\n')}`
      return { success: true, notes: structured }
    }
  }
  
  if (!hasContent) {
    return { success: false, error: 'Notes content too sparse' }
  }
  
  return { success: true, notes: response.trim() }
}
