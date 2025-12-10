/**
 * Flashcards Prompt Template
 * 
 * Used for generating flashcards (Karteikarten).
 * SEPARATE from task generation and exam generation.
 * 
 * PROMPT VERSION: 1.0.0
 */

export const FLASHCARDS_PROMPT_VERSION = '1.0.0'

export interface FlashcardsPromptParams {
  /** Script/document name */
  scriptName: string
  /** Script content (will be truncated if too long) */
  scriptContent: string
  /** Maximum content length */
  maxContentLength?: number
  /** Number of flashcards to generate */
  targetCount?: number
  /** Topics to focus on (optional) */
  focusTopics?: string[]
}

/**
 * Build the flashcard generation prompt
 */
export function buildFlashcardsPrompt(params: FlashcardsPromptParams): string {
  const {
    scriptName,
    scriptContent,
    maxContentLength = 15000,
    targetCount = 10,
    focusTopics
  } = params

  const truncatedContent = scriptContent.length > maxContentLength
    ? scriptContent.substring(0, maxContentLength) + '\n\n[... weitere Inhalte gekürzt ...]'
    : scriptContent

  const focusSection = focusTopics && focusTopics.length > 0
    ? `\n\nFOKUS-THEMEN (priorisiere diese):\n${focusTopics.map(t => `- ${t}`).join('\n')}`
    : ''

  return `Du bist ein Experte für das Erstellen von Lernkarten (Flashcards).

WICHTIG - KARTEIKARTEN-REGELN:
1. Karteikarten sind zum SCHNELLEN Lernen - Antworten müssen KURZ und PRÄGNANT sein!
2. MAXIMALE Antwortlänge: 3-5 Zeilen (ca. 50-100 Wörter)
3. Nutze Stichpunkte statt Fließtext
4. Bei Formeln: Nur die Formel + kurze Variablenerklärung
5. Bei Definitionen: Nur den Kern, keine ausschweifenden Erklärungen
6. KEINE langen Beispiele oder Herleitungen - das ist keine Aufgabe!
${focusSection}

Inhalt (${scriptName}):
${truncatedContent}

Erstelle ${targetCount}-${Math.min(targetCount + 5, 15)} Karteikarten als JSON-Objekt:

STILREGELN FÜR KARTEIKARTEN:
- Vorderseite: Klare, kurze Frage oder Begriff (max. 1 Zeile)
- Rückseite: Knackige Antwort (max. 3-5 Zeilen/Stichpunkte)
- Jede Karte testet EINE Sache (nicht mehrere vermischen)
- Nutze \\n für Zeilenumbrüche, - für Aufzählungen

BEISPIELE FÜR GUTE KARTEIKARTEN:
{
  "flashcards": [
    {
      "front": "Was ist ein Bit?",
      "back": "- Kleinste Informationseinheit\\n- Zwei Zustände: 0 oder 1\\n- 8 Bit = 1 Byte"
    },
    {
      "front": "Formel: Kreisfläche",
      "back": "A = π × r²\\n\\nr = Radius"
    },
    {
      "front": "Was ist der Unterschied zwischen Stack und Heap?",
      "back": "Stack: Automatisch, LIFO, schnell\\nHeap: Manuell, beliebige Größe, langsamer"
    }
  ]
}

Gib NUR das JSON zurück.`
}

/**
 * Parse the LLM response for flashcards
 */
export function parseFlashcardsResponse(response: string): {
  success: boolean
  flashcards?: Array<{
    front: string
    back: string
  }>
  error?: string
} {
  try {
    // Try to extract JSON from response
    let jsonStr = response.trim()
    
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    
    const parsed = JSON.parse(jsonStr)
    
    if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
      return { success: false, error: 'Response missing "flashcards" array' }
    }
    
    // Validate each flashcard
    const validFlashcards = parsed.flashcards.filter((f: any) => 
      f && typeof f.front === 'string' && typeof f.back === 'string' &&
      f.front.trim() && f.back.trim()
    )
    
    if (validFlashcards.length === 0) {
      return { success: false, error: 'No valid flashcards in response' }
    }
    
    return {
      success: true,
      flashcards: validFlashcards.map((f: any) => ({
        front: f.front.trim(),
        back: f.back.trim()
      }))
    }
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e}` }
  }
}
