# Implementation Plan: New Features

**Erstellt:** 06.12.2024  
**Branch:** `update_tasks_gereration`

---

## 🎯 Geplante Features

1. **Document Analysis JSON** – Strukturierte JSON-Analyse hochgeladener Dokumente
2. **Module Style Profiles** – Stilprofile pro Modul speichern und anwenden
3. **Exam/Task Generation Improvements** – Verbesserte Aufgabengenerierung
4. **Input-mode Onboarding** – Einführung in Handschrift vs. Tastatur bei erstem Task
5. **Quality Gate** – Qualitätsprüfung generierter Aufgaben vor dem Speichern
6. **Tag Canonicalization** – Normalisierung und Gruppierung von Tags

---

## 📂 Repo-Analyse

### 1. Dokumenten-Speicherung (Scripts/Exercises/Solutions/Exams)

| Datei                           | Beschreibung                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/lib/types.ts`              | `Script` Interface mit `category?: FileCategory` (script, exercise, solution, exam, formula) |
| `src/components/FilesTab.tsx`   | UI für kategorisierte Datei-Uploads mit Drag&Drop                                            |
| `src/components/ScriptsTab.tsx` | Legacy-Tab für einfache Script-Uploads                                                       |
| `src/App.tsx` (Zeile ~230-280)  | `handleUploadScript()` – erstellt `Script`-Objekt und ruft `createScript()` auf              |
| `src/hooks/use-database.ts`     | Browser-basierter CRUD für Scripts (IndexedDB/localStorage)                                  |
| `server/database.js`            | Server-seitige JSON-Datei-Persistenz (`data/scripts.json`)                                   |
| `src/lib/file-parser.ts`        | Parsing von PDF, PPTX, TXT, MD, Bildern                                                      |

**Kategorien:**

- `script` – Vorlesungsskripte (Wissensbasis)
- `exercise` – Übungsblätter (nur Struktur)
- `solution` – Musterlösungen (nur Struktur)
- `exam` – Probeklausuren (Stilextraktion)
- `formula` – Formelsammlungen

---

### 2. AI/LLM-Anfragen

| Datei                           | Beschreibung                                              |
| ------------------------------- | --------------------------------------------------------- |
| `src/lib/llm-utils.ts`          | `llmWithRetry()` – Zentrale Funktion für alle LLM-Aufrufe |
| `server/index.js`               | Express-Backend mit `/api/llm` Route, OpenAI-Client       |
| `src/lib/rate-limit-tracker.ts` | Rate-Limiting und Cooldown-Logik                          |
| `src/lib/cost-tracker.ts`       | Token-Usage und Kosten-Tracking                           |

**`llmWithRetry()` Signatur:**

```typescript
llmWithRetry(
  prompt: string,
  model: string = 'gpt-4o-mini',
  jsonMode: boolean = false,
  maxRetries: number = 1,
  operation: string = 'unknown',
  moduleId?: string,
  imageBase64?: string  // Vision-API Support
): Promise<string>
```

---

### 3. Aufgaben-Generierung

| Datei                                | Beschreibung                                                       |
| ------------------------------------ | ------------------------------------------------------------------ |
| `src/App.tsx` (Zeile ~450-600)       | `handleGenerateTasks()` – Einzelne Aufgaben aus Script generieren  |
| `src/lib/exam-generator.ts`          | Exam-Mode Generierung:                                             |
|                                      | → `extractExamStyle()` – Stilprofil aus Probeklausuren extrahieren |
|                                      | → `generateStyledExamTask()` – Einzelne Aufgabe im Klausurstil     |
|                                      | → `generateExamTasks()` – Mehrere Aufgaben mit Difficulty-Mix      |
| `src/lib/task-tags.ts`               | `extractTagsFromQuestion()` – Tag-Extraktion aus Fragetext         |
| `src/components/ExamMode.tsx`        | Orchestriert Exam-Generierung                                      |
| `src/components/ExamPreparation.tsx` | Zeigt Generierungsfortschritt an                                   |

**Prompt-Struktur für Aufgaben (App.tsx ~510):**

```json
{
  "tasks": [
    {
      "question": "Markdown-formatierte Aufgabe",
      "solution": "Musterlösung",
      "difficulty": "easy|medium|hard",
      "topic": "Thema",
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

---

### 4. Aufgaben-Lösung

| Datei                                      | Beschreibung                                         |
| ------------------------------------------ | ---------------------------------------------------- |
| `src/components/TaskSolver.tsx`            | Haupt-UI für Aufgabenlösung (Handschrift + Tastatur) |
| `src/components/TaskQuestionPanel.tsx`     | Anzeige der Aufgabenstellung                         |
| `src/components/SolutionPanel.tsx`         | Musterlösung anzeigen                                |
| `src/components/AdvancedDrawingCanvas.tsx` | Canvas für Handschrift-Eingabe                       |
| `src/components/TaskFeedbackPanel.tsx`     | KI-Feedback nach Abgabe                              |
| `src/components/ExamSessionScreen.tsx`     | Prüfungsmodus mit Timer                              |
| `src/lib/exam-generator.ts`                | `evaluateExamAnswer()` – KI-Bewertung                |

**Input-Modi:**

- `'draw'` – Handschrift auf Canvas (mit Vision-API Erkennung)
- `'type'` – Tastatureingabe

---

### 5. Onboarding

| Datei                                                | Beschreibung                     |
| ---------------------------------------------------- | -------------------------------- |
| `src/components/OnboardingTutorial.tsx`              | Hauptkomponente mit 8 Schritten  |
| `src/components/OnboardingTutorial.tsx` (Zeile ~290) | `useOnboarding()` Hook           |
| `src/App.tsx` (Zeile ~118)                           | Integration des Hooks            |
| `localStorage` Key                                   | `studysync_onboarding_completed` |

**Schritte:**

1. Welcome
2. Modul erstellen
3. Dateien hochladen
4. Aufgaben generieren
5. Aufgaben lösen (← hier Input-Mode Onboarding einfügen)
6. Dashboard nutzen
7. Prüfungsmodus
8. Fertig

---

### 6. Tags / Lernblöcke / Dashboard

| Datei                                    | Beschreibung                                              |
| ---------------------------------------- | --------------------------------------------------------- |
| `src/lib/task-tags.ts`                   | `extractTagsFromQuestion()` – Regelbasierte Tag-Erkennung |
|                                          | `TOPIC_KEYWORDS` – Mapping von Themen zu Schlagwörtern    |
|                                          | `MODULE_KEYWORDS` – Mapping von Modulen zu Schlagwörtern  |
| `src/lib/recommendations.ts`             | `updateTopicStats()` – Statistiken pro Thema              |
|                                          | `getWeakTopics()` – Schwache Themen identifizieren        |
|                                          | `generateRecommendations()` – Lernempfehlungen            |
| `src/lib/types.ts`                       | `TopicStats`, `ModuleLearningBlock`, `ModuleStats`        |
| `src/components/TutorDashboard.tsx`      | Dashboard mit Empfehlungen                                |
| `src/components/StatisticsDashboard.tsx` | Statistik-Visualisierung                                  |

**Aktuelles Tag-Verhalten:**

- Tags werden bei Generierung vom LLM zurückgegeben
- `extractTagsFromQuestion()` extrahiert zusätzliche Tags client-seitig
- Keine Normalisierung/Kanonisierung vorhanden

---

### 7. Persistenz

| Ebene                 | Technologie                                | Dateien                     |
| --------------------- | ------------------------------------------ | --------------------------- |
| **Browser (primär)**  | IndexedDB (Fallback: localStorage, Memory) | `src/lib/storage.ts`        |
| **Hooks**             | React State + Storage-Abstraktion          | `src/hooks/use-database.ts` |
| **Server (optional)** | JSON-Dateien in `data/`                    | `server/database.js`        |

**Storage Keys:**

- `modules`, `scripts`, `notes`, `tasks`, `flashcards`
- `studymate-topic-stats` (Empfehlungen)
- `studysync_onboarding_completed` (Onboarding)
- `token-usage-*` (Kosten-Tracking)
- `document_analyses` (NEU: Dokument-Analyse-Records)
- `module_profiles` (NEU: Aggregierte Modul-Profile)
- `user_preferences` (NEU: User-Präferenzen inkl. Input-Mode)
- `analysis_queue_state` (NEU: Persistierte Analysis-Queue)

---

## 🏃 Build & Run Instructions

```bash
# Dependencies installieren
npm install

# Frontend starten (Port 5173)
npm run dev

# Backend starten (Port 3001)
npm run server

# Beides parallel starten
npm run dev:full
```

**Umgebungsvariablen (`.env`):**

```
OPENAI_API_KEY=sk-...
```

---

## 📋 Implementierungs-Schritte (Safe Small Steps)

### ✅ Phase 0: Persistenz-Infrastruktur (ERLEDIGT)

**Neue Dateien:**

- [x] `src/lib/analysis-types.ts` – Types für DocumentAnalysisRecord, ModuleProfileRecord, UserPreferences
- [x] `src/lib/analysis-storage.ts` – Persistenz-APIs für Analysis und Profile

**Neue Types:**

- `DocumentType`: 'script' | 'exercise' | 'solution' | 'exam'
- `AnalysisStatus`: 'missing' | 'queued' | 'running' | 'done' | 'error'
- `InputMode`: 'type' | 'draw'
- `DocumentAnalysisRecord`: Speichert Analyse-Ergebnisse pro Dokument
- `ModuleProfileRecord`: Aggregiertes Profil pro Modul
- `UserPreferences`: User-Einstellungen inkl. Input-Mode

**Neue APIs:**

- `getDocumentAnalysis(moduleId, documentId)`
- `upsertDocumentAnalysis(record)`
- `listDocumentAnalyses(moduleId)`
- `deleteDocumentAnalysis(moduleId, documentId)`
- `getModuleProfile(moduleId)`
- `upsertModuleProfile(record)`
- `deleteModuleProfile(moduleId)`
- `getUserPreferencePreferredInputMode()`
- `setUserPreferencePreferredInputMode(mode)`
- `computeSourceHash(text)` – Hash für Cache-Invalidierung
- `isAnalysisStale()` / `isProfileStale()` – Prüfung ob Neu-Analyse nötig

**Version-Konstanten:**

- `DOCUMENT_ANALYSIS_VERSION = '1.0.0'`
- `MODULE_PROFILE_VERSION = '1.0.0'`

### ✅ Phase 1: Document Analysis JSON (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/document-analyzer.ts` – Vollständige Dokument-Analyse-Pipeline

**Neue Utilities:**

- `normalizeTextForHash(text)` – Normalisiert Text für konsistentes Hashing
- `sha256(text)` – Berechnet SHA-256 Hash via Web Crypto API
- `chunkText(text, options)` – Teilt Text in überlappende Chunks (Satzgrenzen-aware)

**Neue Types:**

- `TextChunk` – Einzelner Text-Chunk mit Position und Index
- `ExtractedItem` – Extrahiertes Item mit Typ, Wert und evidenceSnippets
- `ChunkAnalysisResult` – Ergebnis einer Chunk-Analyse
- `MergedDocumentAnalysis` – Zusammengeführtes Analyse-Ergebnis

**Hauptfunktionen:**

- `analyzeDocumentToJson({moduleId, documentId, documentType, text})` – Hauptfunktion
  - Berechnet sourceHash, prüft Cache
  - Chunked große Dokumente
  - Analysiert jeden Chunk mit LLM (STRICT extract-only Prompts)
  - Validiert evidenceSnippets gegen Originaltext
  - Merged Chunk-Ergebnisse, dedupliziert Items
  - Speichert Ergebnis in DocumentAnalysisRecord
- `needsAnalysis(moduleId, documentId, currentText)` – Prüft ob Neu-Analyse nötig
- `getParsedDocumentAnalysis(moduleId, documentId)` – Holt geparstes Ergebnis

**Analyse-Prompts nach Dokumenttyp:**

- `script`: topics, concepts, formulas, definitions, procedures, constraints, examples
- `exercise`: patterns, phrases, structure, topics, concepts
- `solution`: patterns, procedures, formulas, structure
- `exam`: phrases, patterns, structure, topics, formulas (Schwierigkeitsverteilung, MC, Teilaufgaben)

**Evidenz-Validierung:**

- Jedes extrahierte Item muss evidenceSnippets haben
- Snippets werden gegen Originaltext geprüft (70% der Wörter müssen matchen)
- Items ohne valide Evidenz werden verworfen

### ✅ Phase 1.5: Analysis Queue Integration (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/analysis-queue.ts` – Singleton-Queue für Dokument-Analysen

**Neue Funktionen:**

- `getAnalysisQueue()` – Singleton-Instanz
- `enqueueAnalysis(moduleId, documentId, documentType, documentName, text)` – Job hinzufügen
- `enqueueAnalysisIfNeeded(...)` – Job nur hinzufügen wenn nötig
- `removeFromAnalysisQueue(documentId)` – Job entfernen
- `onAnalysisProgress(callback)` – Progress-Updates abonnieren
- `isDocumentInAnalysisQueue(documentId)` – Prüft ob in Queue
- `getAnalysisQueueLength()` – Aktuelle Queue-Länge

**Queue-Verhalten:**

- Nur 1 Job läuft gleichzeitig (seriell)
- Queue-State wird in localStorage persistiert
- Bei App-Start werden 'running' Records auf 'queued' zurückgesetzt

**Integration in App.tsx:**

- [x] `handleUploadScript()` enqueued Analyse nach `createScript()`
- [x] `handleDeleteScript()` ruft `removeFromAnalysisQueue()` und `deleteDocumentAnalysis()` auf
- [x] `handleBulkDeleteScripts()` löscht alle Analysen für die IDs
- [x] `handleAnalyzeScript()` – Neuer Handler für manuelles Starten der Analyse
- [x] `useEffect` subscribes zu `onAnalysisProgress()` und updated `pipelineTasks`

**Integration in NotificationCenter:**

- [x] `PipelineTask.type` erweitert um `'analyze'`
- [x] `MagnifyingGlass` Icon für Analyse-Tasks

**Integration in FilesTab:**

- [x] `onAnalyzeScript` prop hinzugefügt
- [x] "Analyse starten" Menüpunkt im Dropdown

**Integration in ModuleView:**

- [x] `onAnalyzeScript` prop durchgereicht

### ✅ Phase 2: Module Style Profiles (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/module-profile-builder.ts` – Baut aggregierte Module-Profile

**Neue Types:**

- `ExamStyleProfile` – Aggregiertes Klausur-Stilprofil (Phrasen, Scoring, Formatierung, Schwierigkeitsmix)
- `ExerciseStyleProfile` – Aggregiertes Übungs-Stilprofil (Verben, Subtasks, Lösungsformatierung, Punktekonventionen)
- `ModuleKnowledgeIndex` – Wissensindex aus Skripten (Topics, Definitionen, Formeln, Prozeduren, invertierter Index)
- `ModuleCoverageStats` – Coverage-Statistiken mit gewichteter Berechnung

**Neue APIs:**

- `buildModuleProfiles(moduleId)` – Hauptfunktion, baut alle 3 JSON-Blobs:
  - `examStyleProfileJson` – aus Exam-Analysen
  - `exerciseStyleProfileJson` – aus Exercise+Solution-Analysen
  - `moduleKnowledgeIndexJson` – aus Script-Analysen mit invertiertem Index
- `getOrBuildModuleProfiles(moduleId)` – Cached/baut Profile
- `parseExamStyleProfile(record)` – Parsed das Exam-Profil
- `parseExerciseStyleProfile(record)` – Parsed das Exercise-Profil
- `parseModuleKnowledgeIndex(record)` – Parsed den Wissensindex
- `invalidateModuleProfile(moduleId)` – Markiert Profil als veraltet
- `calculateCoverageStats(...)` – Berechnet Coverage (einfach + gewichtet)

**Cache-Mechanismus:**

- `sourceHashAggregate` wird aus allen teilnehmenden Dokumenten-Hashes + Analyse-Versionen berechnet
- Wenn bestehendes Profil gleichen Hash+Version hat und status='done' → Skip Rebuild

**Coverage-Berechnung:**

- Einfach: `doneAnalysesCount / totalDocsCount * 100`
- Gewichtet: Scripts haben 2x Gewicht (da primäre Wissensquelle)

**Auto-Update Integration:**

- [x] `analysis-queue.ts` ruft `buildModuleProfiles()` nach erfolgreicher Analyse auf
- [x] `App.tsx` `handleDeleteScript()` ruft `invalidateModuleProfile()` auf
- [x] `App.tsx` `handleBulkDeleteScripts()` ruft `invalidateModuleProfile()` für alle betroffenen Module auf

### ✅ Phase 2.5: UI Indicators & Developer Inspection Tools (ERLEDIGT)

**Neue Komponenten:**

- [x] `src/components/AnalysisStatusBadge.tsx` – Per-Dokument Statusanzeige
- [x] `src/components/ModuleProfileStatus.tsx` – Modul-Profil-Übersicht

**AnalysisStatusBadge Features:**

- Status-Indikatoren:
  - `missing`: Grauer Punkt – Analyse fehlt
  - `queued`/`running`: Spinner – Analyse läuft/wartet
  - `done`: Grüner Haken + Coverage-% – Analyse abgeschlossen
  - `error`: Rotes Warnsymbol – Analyse fehlgeschlagen
- Tooltip mit detaillierten Status-Infos
- **Debug-Mode only:** Klick öffnet Modal mit:
  - Vollständiges JSON der Analyse
  - Metadata (Hash, Versionen, Timestamps)
  - "Copy JSON" Button
  - ScrollArea für große Datenmengen

**ModuleProfileStatus Features:**

- 3 Profil-Items in einer Karte:
  - 🎯 Klausur-Stil (ExamStyleProfile) – aus Probeklausuren
  - 📝 Übungs-Stil (ExerciseStyleProfile) – aus Übungsblättern
  - 📚 Wissens-Index (ModuleKnowledgeIndex) – aus Skripten
- Jedes Item zeigt:
  - Status-Badge (done/missing/partial)
  - Tooltip mit Beschreibung
  - **Debug-Mode only:** Klick öffnet Profil-JSON im Modal
- Gesamt-Coverage mit Progress-Bar
- Collapsible Card (aufklappbar)

**FilesTab Integration:**

- [x] `ModuleProfileStatus` am oberen Rand der Datei-Liste
- [x] `AnalysisStatusBadge` neben jedem Dateinamen
- [x] `analysisRecords` State mit 5-Sekunden-Polling für Live-Updates
- [x] Badge erhält vorgeladenen Record um DB-Calls zu reduzieren

**UI/UX Prinzipien:**

- Debug-Features nur sichtbar wenn Debug-Mode aktiv
- Normale User sehen nur Status-Indikatoren ohne Klick-Interaktion
- Bestehende Layout und Funktionalität bleibt unverändert
- Responsive Design mit Tailwind CSS

### ✅ Phase 3: Task Generation Quality Gate (ERLEDIGT → Siehe Phase 6)

_Implementiert als Teil von Phase 6: Task Validator Quality Gate_

### ✅ Phase 4: Input-Mode Onboarding (ERLEDIGT)

**Neue Dateien:**

- [x] `src/hooks/use-preferred-input-mode.ts` – Reaktiver Hook für Input-Mode-Präferenz
- [x] `src/components/InputModeSettings.tsx` – Settings-Dialog zum Ändern der Eingabemethode

**usePreferredInputMode Hook:**

- `mode: InputMode | undefined` – Aktuelle Präferenz
- `isLoading: boolean` – Lade-Status
- `isSet: boolean` – Ob eine Präferenz gesetzt ist
- `setMode(mode: InputMode): Promise<void>` – Setzt und persistiert Präferenz
- Event-basierte Cross-Component-Reaktivität
- Automatisches Re-Rendering bei Änderungen

**OnboardingTutorial Updates:**

- [x] Skip-Button entfernt – Onboarding ist jetzt verpflichtend
- [x] Neuer Schritt "input-mode" vor dem finalen Schritt
- [x] User muss zwischen "⌨️ Tastatur (Tippen)" und "✍️ Stift (Zeichnen)" wählen
- [x] Weiter-Button deaktiviert bis Auswahl getroffen
- [x] Präferenz wird persistiert bevor fortgefahren wird
- [x] Wenn Präferenz bereits existiert, wird sie vorausgewählt

**InputModeSettings Dialog:**

- [x] Modal-Dialog zum Ändern der Eingabemethode
- [x] Zwei große klickbare Optionen mit Icons
- [x] Zeigt aktuelle Einstellung an
- [x] Speichern + Toast-Benachrichtigung
- [x] `InputModeSettingsButton` – Kompakter Button für die Header-Leiste

**App.tsx Integration:**

- [x] `InputModeSettingsButton` im Header neben OnboardingTrigger und DebugModeToggle
- [x] Responsive: Icon + Text auf Desktop, nur Icon auf Mobile

**Persistenz:**

- Verwendet `analysis-storage.ts` APIs (`getUserPreferencePreferredInputMode`, `setUserPreferencePreferredInputMode`)
- Speichert in `user_preferences` localStorage-Key unter `preferredInputMode`

### ✅ Phase 4.5: Global Input Mode Application (ERLEDIGT)

**Aktualisierte Komponenten:**

- [x] `src/components/TaskSolver.tsx` – Normale Aufgabenlösung
- [x] `src/components/ExamSessionScreen.tsx` – Prüfungsmodus

**Verhaltensänderungen:**

- **`preferredInputMode === 'type'`:**

  - Tabs werden NICHT gerendert (kein Zeichnen/Tippen Toggle)
  - Nur Textarea wird angezeigt
  - Canvas wird überhaupt nicht gerendert
  - `inputMode` State wird auf `'type'` synchronisiert
  - Submit funktioniert ohne `canvasDataUrl`

- **`preferredInputMode === 'draw'` (oder undefined):**
  - Bestehendes Verhalten bleibt unverändert
  - Tabs mit "Zeichnen" und "Tippen" werden angezeigt
  - Beide Eingabemodi verfügbar
  - OCR/Vision-Pipeline bleibt intakt

**Integration:**

- [x] Hook `usePreferredInputMode()` in beide Komponenten integriert
- [x] State-Synchronisation via `useEffect` bei Präferenz-Lade
- [x] `showInputModeTabs` Boolean bestimmt UI-Darstellung
- [x] Bedingtes Rendering: Canvas nur wenn `inputMode === 'draw' && showInputModeTabs`

**Submit/Evaluation-Kompatibilität:**

- TaskSolver: `handleSubmit()` prüft `inputMode` → keine canvasDataUrl bei 'type'
- ExamSessionScreen: `saveAnswer()` prüft `inputMode` → speichert `userAnswer` oder `canvasDataUrl`
- Keine Dead-UI-States möglich (inputMode wird synchronisiert)

### ✅ Phase 5: Generation Context Refactoring (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/generation-context.ts` – Context-Building Utility für Task/Exam-Generierung

**Neue Types:**

- `GenerationContextOptions` – Konfiguration für Context-Building:
  - `moduleId: string` – Pflicht
  - `target: 'task' | 'exam'` – Bestimmt welche Profile priorisiert werden
  - `preferredInputMode?: InputMode` – Für Input-Mode-Constraints
  - `topicHints?: string[]` – Optionale Topic-Filter
  - `maxContextChars?: number` – Maximum Context-Größe (Default: 32000)
- `ContextPack` – Ergebnis des Context-Buildings:
  - `moduleId: string`
  - `contextText: string` – Fertiger Prompt-Context
  - `usedTopics: string[]` – Topics die im Context verwendet wurden
  - `wasCompressed: boolean` – Ob LLM-Kompression angewendet wurde
  - `sourceAnalysesCount: number` – Anzahl verwendeter Dokument-Analysen
- `ContextSection` – Interne Struktur für Context-Blöcke:
  - `title: string`
  - `content: string`
  - `priority: number`
  - `estimatedTokens: number`

**Konstanten:**

- `DEFAULT_MAX_CONTEXT_CHARS = 32000` – Standard-Maximum

**Neue APIs:**

- `buildGenerationContext(options): Promise<ContextPack | undefined>` – Hauptfunktion
  - Lädt ModuleProfileRecord
  - Baut Sections aus KnowledgeIndex, ExamStyle, ExerciseStyle
  - Fügt Input-Mode-Constraints hinzu (für 'type' Mode)
  - Filtert nach Topics wenn topicHints gegeben
  - Komprimiert via LLM wenn über maxContextChars
  - Gibt undefined zurück wenn keine Daten verfügbar
- `buildKnowledgeSection(profile)` – Baut Wissens-Section aus ModuleKnowledgeIndex
- `buildExamStyleSection(profile)` – Baut Stil-Section aus ExamStyleProfile
- `buildExerciseStyleSection(profile)` – Baut Stil-Section aus ExerciseStyleProfile
- `compressContextIfNeeded(text, maxChars, model)` – LLM-basierte Kompression
- `filterByTopics(index, topics)` – Topic-basiertes Filtern via invertiertem Index

**Input-Mode Constraints:**

- Für `preferredInputMode === 'type'`:
  - "Aufgaben sollten per Tastatur lösbar sein"
  - "Keine Zeichnungen, Diagramme oder handschriftlichen Elemente erforderlich"
  - "Text-basierte Antworten bevorzugen"

**App.tsx Integration:**

- [x] `handleGenerateTasks()` verwendet jetzt `buildGenerationContext({ moduleId, target: 'task', preferredInputMode: 'type' })`
- [x] `contextPack.contextText` wird im Prompt verwendet statt rohem Script-Content
- [x] Fallback zu legacy Script-Content wenn Context nicht verfügbar

**exam-generator.ts Integration:**

- [x] `generateStyledExamTask()` akzeptiert jetzt `preferredInputMode?: InputMode`
- [x] Ruft `buildGenerationContext({ moduleId, target: 'exam', preferredInputMode })` auf
- [x] Fügt Input-Mode-Constraints zum Prompt hinzu
- [x] Fallback zu legacy Script-Truncation wenn Context nicht verfügbar
- [x] `generateExamTasks()` akzeptiert und reicht `preferredInputMode` durch

**ExamMode.tsx Integration:**

- [x] Importiert `usePreferredInputMode` Hook
- [x] Übergibt `preferredInputMode` an `generateExamTasks()`

**Vorteile gegenüber Legacy:**

- Verwendet analysierte JSON-Daten statt rohem Text
- Strukturierter Context mit Definitionen, Formeln, Prozeduren
- Topic-basiertes Filtern für relevante Inhalte
- Automatische Kompression bei Überlänge
- Stilprofile für konsistente Aufgaben-Generierung
- Input-Mode-Constraints für passende Aufgabentypen
- Keine arbiträre 4000-Zeichen-Truncation mehr

### ✅ Phase 5.5: Multi-Stage Exam Blueprint Pipeline (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/exam-blueprint.ts` – Multi-Stage Exam-Generierung mit Blueprint-Planung

**Neue Types:**

- `AnswerMode: 'type' | 'draw' | 'either'` – Erlaubter Antwortmodus pro Aufgabe
- `BlueprintItem` – Einzelne Aufgaben-Spezifikation im Blueprint:
  - `taskIndex: number` – Aufgabenindex
  - `topic: string` – Hauptthema
  - `subtopics: string[]` – Unterthemen
  - `difficulty: 'easy' | 'medium' | 'hard'` – Schwierigkeit
  - `points: number` – Punkte
  - `targetMinutes: number` – Geplante Bearbeitungszeit
  - `answerMode: AnswerMode` – Erlaubter Eingabemodus
  - `requiredKnowledgeKeys: string[]` – Schlüssel für Knowledge-Retrieval
  - `taskType: string` – Aufgabentyp (calculation, proof, open-question, etc.)
- `ExamBlueprint` – Vollständiger Prüfungs-Blueprint:
  - `moduleId`, `totalDuration`, `totalPoints`, `taskCount`
  - `items: BlueprintItem[]` – Einzelne Aufgaben-Spezifikationen
  - `coveredTopics: string[]` – Abgedeckte Themen
  - `difficultyMix` – Erreichte Schwierigkeitsverteilung
  - `inputModeConstrained: boolean` – Ob Input-Mode-Einschränkung aktiv
- `BlueprintOptions` – Optionen für Blueprint-Generierung
- `TaskGenerationOptions` – Optionen für Per-Task-Generierung

**Neue APIs:**

- `generateExamBlueprint(options): Promise<ExamBlueprint>` – Stage A: Blueprint-Planung
  - Lädt ModuleProfile und KnowledgeIndex
  - Berechnet Topic-Weights (Frequenz + Schwachstellen-Boost)
  - Plant Tasks via LLM über den gesamten Wissensindex
  - Validiert Punkte- und Zeitverteilung
  - Fallback zu algorithmischer Planung bei LLM-Fehler
- `generateTaskFromBlueprint(options): Promise<ExamTask>` – Stage B: Per-Task-Generierung
  - Ruft `retrieveRelevantKnowledge()` mit Blueprint-Keys ab
  - Holt themenspezifische Evidenz aus dem invertierten Index
  - Generiert Aufgabe mit fokussiertem Context (keine Overflow-Gefahr)
  - Respektiert answerMode-Constraints
- `generateExamTasksWithBlueprint(options, onProgress): Promise<{ blueprint, tasks }>` – Vollständige Pipeline
  - Stage A: Blueprint bei 10% Progress
  - Stage B: Tasks bei 10-100% Progress
  - Returns Blueprint + Tasks für Debugging/Transparenz

**Hilfsfunktionen:**

- `buildTopicWeights(index, weakTopics)` – Gewichtet Topics nach Frequenz + Schwachstellen
- `planBlueprintWithLLM(params)` – LLM-basierte intelligente Blueprint-Planung
- `validateBlueprint(items, duration, points, inputMode)` – Validiert und korrigiert Totals
- `createAlgorithmicBlueprint(...)` – Fallback ohne LLM
- `retrieveRelevantKnowledge(blueprint, index, analyses)` – Topic-spezifisches Retrieval
- `buildTaskGenerationPrompt(blueprint, knowledge, style)` – Prompt für Einzelaufgabe

**exam-generator.ts Updates:**

- [x] `generateExamTasks()` nutzt jetzt Blueprint-Pipeline als primären Pfad
- [x] Neue Signatur mit `duration: number` Parameter
- [x] Legacy-Fallback `generateExamTasksLegacy()` bei Blueprint-Fehler
- [x] Entfernt: Hardcodierte Limits (`.slice(0, 3)`, `.substring(0, 3000)`)
- [x] Legacy-Fallback verteilt Zeichen dynamisch über ALLE Skripte

**ExamMode.tsx Updates:**

- [x] Übergibt `config.duration` an `generateExamTasks()`

**Vorteile des Blueprint-Systems:**

1. **ALLE Skripte berücksichtigt:** Blueprint wird über den gesamten Knowledge-Index geplant
2. **Keine Context-Overflow:** Per-Task-Retrieval holt nur relevante Daten
3. **Bessere Themenverteilung:** Tasks werden gezielt über verschiedene Topics verteilt
4. **Schwachstellen-Priorisierung:** Nutzer-Schwachstellen werden 2x gewichtet
5. **Input-Mode-Garantie:** Bei `type` Mode wird `answerMode: 'draw'` nie verwendet
6. **Zeitplanung:** `targetMinutes` pro Task für realistische Prüfungsdauer
7. **Konsistente Punkteverteilung:** Blueprint validiert Gesamtpunkte
8. **Cached Style Profiles:** Nutzt ModuleProfileRecord, keine Re-Extraktion

**Architektur-Übersicht:**

```
┌─────────────────────────────────────────────────────────────┐
│                    generateExamTasks()                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage A: generateExamBlueprint()                            │
│ - Load ModuleProfile (cached)                               │
│ - Build topic weights from KnowledgeIndex                   │
│ - LLM plans BlueprintItems across ALL topics                │
│ - Validate totals (points, time)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage B: For each BlueprintItem                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ retrieveRelevantKnowledge()                             │ │
│ │ - Use requiredKnowledgeKeys                             │ │
│ │ - Query inverted topicIndex                             │ │
│ │ - Get specific definitions, formulas, procedures        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ generateTaskFromBlueprint()                             │ │
│ │ - Build focused prompt with retrieved knowledge         │ │
│ │ - Apply style from ExamStyleProfile                     │ │
│ │ - Respect answerMode constraint                         │ │
│ │ - Generate single task                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage C: Style Profile Caching (bereits in Phase 2)        │
│ - ModuleProfileRecord enthält examStyleProfileJson          │
│ - parseExamStyleProfile() gibt gecachte Daten zurück        │
│ - Keine Re-Extraktion bei jeder Exam-Generierung            │
└─────────────────────────────────────────────────────────────┘
```

### ✅ Phase 6: Task Validator Quality Gate (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/task-validator.ts` – LLM-basierte Qualitätsprüfung für generierte Aufgaben

**Neue Types:**

- `ValidationOptions` – Konfiguration für Validierung:
  - `task: Partial<Task>` – Zu validierende Aufgabe
  - `contextPack?: ContextPack` – Context für Faktenprüfung
  - `preferredInputMode?: InputMode` – Für requiresDrawing-Check
  - `examStyle?: ExamStyleProfile` – Für Stil-Matching
  - `exerciseStyle?: ExerciseStyleProfile` – Für Stil-Matching
  - `model?: string` – LLM-Modell (Default: gpt-4o-mini)
- `ValidationResult` – Ergebnis einer Validierung:
  - `ok: boolean` – Ob Aufgabe gültig ist
  - `issues: string[]` – Liste der Probleme
  - `missingInfo: string[]` – Fehlende Informationen
  - `styleMismatches: string[]` – Stil-Abweichungen
  - `requiresDrawing: boolean` – Ob Zeichnen erforderlich
  - `suggestedFixPrompt?: string` – Reparatur-Vorschlag
  - `confidence: number` – Konfidenz 0.0-1.0
  - `validationTimeMs: number` – Validierungsdauer
- `RepairOptions` – Optionen für Reparatur:
  - `task`, `validationResult`, `contextPack`, `model`
- `ValidationPipelineOptions` – Optionen für vollständige Pipeline:
  - `task`, `contextPack`, `preferredInputMode`
  - `examStyle?`, `exerciseStyle?`
  - `maxRepairAttempts?: number` – Max Reparaturversuche (Default: 2)
  - `regenerate?: () => Promise<Partial<Task>>` – Neu-Generierungsfunktion
  - `model?`
- `ValidationPipelineResult` – Ergebnis der Pipeline:
  - `task: Partial<Task>` – Finale (möglicherweise reparierte) Aufgabe
  - `passed: boolean` – Ob Validierung bestanden
  - `totalAttempts: number` – Gesamtzahl Versuche
  - `wasRepaired: boolean` – Ob repariert
  - `wasRegenerated: boolean` – Ob neu generiert
  - `debugReport?: ValidatorDebugReport` – Debug-Info
- `ValidatorDebugReport` – Debug-Bericht:
  - `attempts: ValidationResult[]` – Alle Validierungsversuche
  - `finalIssues: string[]` – Verbleibende Probleme
  - `totalValidationTimeMs: number` – Gesamtdauer

**Neue APIs:**

- `validateGeneratedTask(options): Promise<ValidationResult>` – Hauptvalidierung
  - Prüft: Lösbarkeit, Parameter vollständig, Lösung konsistent
  - Prüft: Stil-Matching (Phrasen, Formatierung, Punkte)
  - Prüft: requiresDrawing vs. preferredInputMode
  - Returned strukturiertes JSON mit Problemen und Reparatur-Vorschlag
- `repairTask(options): Promise<Partial<Task>>` – Reparatur-Versuch
  - Nutzt suggestedFixPrompt aus ValidationResult
  - Behebt spezifische Issues ohne komplette Neu-Generierung
  - Erhält gute Teile der ursprünglichen Aufgabe
- `runValidationPipeline(options): Promise<ValidationPipelineResult>` – Vollständige Pipeline
  - Schritt 1: Initiale Validierung
  - Schritt 2: Bis zu N Reparaturversuche wenn !ok
  - Schritt 3: Neu-Generierung wenn Reparatur fehlschlägt
  - Schritt 4: Return finale Aufgabe mit Status

**Debug-Logging APIs:**

- `logValidationToDebug(task, result)` – Logged einzelne Validierung
- `logRepairToDebug(originalTask, repairedTask, result)` – Logged Reparatur
- `logValidationPipelineToDebug(task, result)` – Logged gesamte Pipeline

**App.tsx Integration:**

- [x] `handleGenerateTasks()` validiert jetzt jede generierte Aufgabe
- [x] `runValidationPipeline()` mit Regenerate-Callback
- [x] Nur validierte Aufgaben werden in DB gespeichert
- [x] Validierungs-Statistiken werden geloggt (passed, repaired, regenerated, failed)
- [x] Fallback zu ursprünglicher Aufgabe wenn Pipeline fehlschlägt

**exam-blueprint.ts Integration:**

- [x] `generateExamTasksWithBlueprint()` validiert jede Aufgabe
- [x] Validierung nach Task-Generierung, vor Hinzufügen zur Liste
- [x] Fallback-Task-Erstellung bei Validierungsfehler
- [x] Progress-Tracking inklusive Validierung

**debug-store.ts Updates:**

- [x] Neue Log-Typen: `'task-validation' | 'task-repair' | 'validation-pipeline'`
- [x] Erweiterte `data` Interface mit Validierungs-Feldern:
  - `validationResult?`, `issues?`, `wasRepaired?`
  - `wasRegenerated?`, `totalAttempts?`, `taskQuestion?`

**DebugConsole.tsx Updates:**

- [x] Neue Typ-Farben: purple (Validierung), orange (Reparatur), cyan (Pipeline)
- [x] Neue Typ-Labels: "Validierung", "Reparatur", "Pipeline"
- [x] Zusammenfassungszeilen für alle Validierungstypen
- [x] Erweitertes Detailpanel mit:
  - Aufgabentext, Validierungsergebnis mit Konfidenz
  - Problemliste mit Icons
  - Repariert/Neu-generiert Badges
  - Versuchsanzahl

**Validierungskriterien:**

1. **Lösbarkeit:** Sind alle Parameter und Werte gegeben?
2. **Konsistenz:** Stimmt Lösung mit Aufgabenstellung überein?
3. **Stil-Matching:** Passt Phraseologie/Format zum Modul-Stil?
4. **Input-Mode:** Erfordert Aufgabe Zeichnen bei type-only-Mode?
5. **Vollständigkeit:** Sind alle erforderlichen Felder vorhanden?

**Reparatur-Strategie:**

- Nutzt `suggestedFixPrompt` vom Validator
- Behebt identifizierte Issues gezielt
- Erhält korrekte Teile der Aufgabe
- Max 2 Reparaturversuche bevor Neu-Generierung

**Neu-Generierung:**

- Wird nur aufgerufen wenn regenerate-Callback gegeben
- Fügt explizite "avoid these issues" zum Prompt hinzu
- Generiert komplett neue Aufgabe
- Unterliegt wieder Validierung

### ✅ Phase 7: Tag Canonicalization (ERLEDIGT)

**Neue Datei:**

- [x] `src/lib/tag-canonicalizer.ts` – Vollständiges Tag-Normalisierungssystem

**Neue Types:**

- `TagRegistryEntry` – Einzelner Eintrag im Tag-Registry:
  - `canonicalKey: string` – Normalisierter Schlüssel für Matching
  - `label: string` – Bevorzugtes Anzeigelabel
  - `synonyms: string[]` – Alternative Formen die auf diesen Eintrag mappen
  - `usageCount: number` – Nutzungszähler für Ranking
  - `lastUsedAt: string` – Letzter Verwendungszeitpunkt
- `ModuleTagRegistry` – Modul-Level Tag-Registry:
  - `moduleId`, `entries[]`, `lastUpdatedAt`, `version`
- `NormalizedTagsResult` – Ergebnis der Tag-Normalisierung:
  - `tags: string[]` – Normalisierte Tags
  - `mappedSynonyms[]` – Welche Tags von Synonymen gemappt wurden
  - `newEntries[]` – Neu zur Registry hinzugefügte Tags

**Konstanten:**

- `STORAGE_KEY = 'module_tag_registries'` – Persistenz-Key
- `REGISTRY_VERSION = '1.0.0'`
- `STOP_WORDS` – Deutsche/Englische Stoppwörter für Canonical Keys
- `KNOWN_SYNONYMS` – Bekannte Tag-Synonyme (Quine-McCluskey, KV-Diagramm, etc.)

**Kern-Funktionen:**

- `canonicalKey(tag)` – Generiert normalisierten Schlüssel:
  1. Lowercase + trim
  2. Klammerninhalt als separate Tokens extrahieren
  3. Bindestriche/Unterstriche durch Leerzeichen ersetzen
  4. Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss)
  5. Stoppwörter entfernen
  6. Tokens alphabetisch sortieren
  7. Mit Leerzeichen verbinden
- `areCanonicalKeysSynonyms(key1, key2)` – Prüft Synonym-Übereinstimmung via KNOWN_SYNONYMS oder Token-Overlap
- `cleanLabel(tag)` – Bereinigt Label (Whitespace normalisieren)
- `selectBestLabel(labels)` – Wählt bestes Label aus Kandidaten (kürzestes, ohne Klammern, Großschreibung bevorzugt)

**Registry-Persistenz:**

- `getModuleTagRegistry(moduleId)` – Lädt/erstellt Registry
- `saveModuleTagRegistry(registry)` – Speichert Registry
- `deleteModuleTagRegistry(moduleId)` – Löscht Registry

**Tag-Normalisierung:**

- `normalizeTags(tags, moduleId)` – Hauptfunktion:
  - Für jeden Tag: canonical key berechnen
  - Prüfen ob existierender Eintrag matcht (direkter Key, Synonym, Synonym-äquivalent)
  - Falls ja: existierendes Label verwenden, Usage-Count erhöhen
  - Falls nein: neuen Eintrag erstellen
  - Registry speichern
- `getModuleAllowedTags(moduleId)` – Gibt alle bekannten Tags für LLM-Prompts zurück
- `formatAllowedTagsForPrompt(tags)` – Formatiert Tags für Prompt-Einbindung

**Migration & Cleanup:**

- `migrateExistingTags(tasks, updateTask)` – Einmalige Migration bestehender Tasks:
  - Gruppiert Tasks nach Modul
  - Normalisiert Tags jeder Task
  - Aktualisiert Tasks mit geänderten Tags
  - Gibt Statistiken zurück (processed, normalized, errors)
- `mergeTagEntries(moduleId, keepKey, mergeKey)` – Manuelles Zusammenführen zweier Einträge
- `renameTagLabel(moduleId, canonicalKey, newLabel)` – Label umbenennen

**Utility-Funktionen für Learning Blocks:**

- `getTopicCanonicalKey(topic)` – Canonical key für Topic (für Gruppierung)
- `groupTasksByCanonicalTopic(tasks)` – Gruppiert Tasks nach canonical topic key
- `groupByCanonicalTag(items)` – Gruppiert Items nach canonical tag key

**App.tsx Integration:**

- [x] Import von `normalizeTags`, `getModuleAllowedTags`, `formatAllowedTagsForPrompt`, `migrateExistingTags`
- [x] `handleGenerateTasks()` lädt allowed tags und fügt sie zum Prompt hinzu
- [x] Jede generierte Task wird durch `normalizeTags()` normalisiert
- [x] Regenerierte Tasks werden ebenfalls normalisiert
- [x] Einmalige Migration beim App-Start (gesteuert durch `TAG_MIGRATION_KEY`)

**exam-blueprint.ts Integration:**

- [x] `TaskGenerationOptions` erweitert um `allowedTags?: string[]`
- [x] `generateExamTasksWithBlueprint()` lädt allowed tags parallel
- [x] `generateTaskFromBlueprint()` normalisiert generierte Tags
- [x] `buildTaskGenerationPrompt()` fügt allowed tags zum Prompt hinzu
- [x] `regenerateTaskWithConstraints()` normalisiert regenerierte Tags

**recommendations.ts Integration:**

- [x] Import von `canonicalKey`, `cleanLabel`
- [x] `updateTopicStats()` nutzt canonical key für Matching:
  - Findet existierende Topic-Stats via canonical key statt exact match
  - Vermeidet doppelte Einträge für semantisch gleiche Topics
  - Aktualisiert Label zum "besseren" (kürzeren) wenn möglich
- [x] `getWeakTopics()` gruppiert nach canonical key vor Filterung
- [x] Neue `getConsolidatedTopicStats()` – Konsolidierte Stats mit merged Duplikaten

**Beispiel-Normalisierung:**

| Original Tag                    | Canonical Key                 | Genormalisiertes Label          |
| ------------------------------- | ----------------------------- | ------------------------------- |
| "Quine-McCluskey"               | "mccluskey quine"             | "Quine-McCluskey"               |
| "Minimierung (Quine-McCluskey)" | "mccluskey minimierung quine" | "Quine-McCluskey" (existiert)   |
| "KV-Diagramm"                   | "diagramm kv"                 | "KV-Diagramm"                   |
| "Karnaugh-Veitch Diagramm"      | "diagramm karnaugh veitch"    | "KV-Diagramm" (Synonym erkannt) |

**Persistenz:**

- `module_tag_registries` – Array aller ModuleTagRegistry-Objekte
- `studysync_tag_migration_v1` – Flag für einmalige Migration

**Vorteile:**

1. **Keine doppelten Learning Blocks:** Topics werden nach canonical key gruppiert
2. **Konsistente Tags:** LLM bekommt erlaubte Tags, wählt bevorzugt existierende
3. **Rückwärtskompatibel:** Bestehende Tags werden automatisch migriert
4. **Modul-isoliert:** Jedes Modul hat eigene Tag-Registry
5. **Erweiterbar:** KNOWN_SYNONYMS kann ergänzt werden

---

## ⚠️ Hinweise

- **Keine Verhaltensänderungen ohne Tests!**
- **Jeden Schritt einzeln committen**
- **Bestehende Prompts nicht ändern** ohne vorherige Abstimmung
- **localStorage-Keys dokumentieren** bei Änderungen
