# Technical Architecture Documentation

**Erstellt:** 06.12.2024  
**Version:** 1.0.0

---

## 📐 Architektur-Übersicht

StudySync ist eine React + TypeScript Single-Page-Application mit optionalem Node.js-Backend. Die Anwendung nutzt einen mehrstufigen Analyse- und Generierungspipeline für intelligente Lernmaterialien.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Components          │  Hooks              │  Lib (Core Logic)   │
│  ─────────────       │  ──────             │  ───────────────    │
│  App.tsx             │  use-database.ts    │  storage.ts         │
│  ModuleView.tsx      │  use-debug-mode.ts  │  llm-utils.ts       │
│  TaskSolver.tsx      │  use-preferred-     │  document-analyzer  │
│  FilesTab.tsx        │    input-mode.ts    │  module-profile-    │
│  ExamMode.tsx        │  use-file-upload.ts │    builder.ts       │
│  DebugConsole.tsx    │                     │  exam-blueprint.ts  │
│  ...                 │                     │  task-validator.ts  │
│                      │                     │  tag-canonicalizer  │
│                      │                     │  recommendations.ts │
└──────────────────────┴─────────────────────┴─────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Persistenz-Schicht                          │
├─────────────────────────────────────────────────────────────────┤
│  IndexedDB (primär) → localStorage (fallback) → Memory (fallback)│
│                                                                  │
│  Keys:                                                           │
│  • modules, scripts, notes, tasks, flashcards                    │
│  • document_analyses, module_profiles                            │
│  • module_tag_registries, user_preferences                       │
│  • studymate-topic-stats, token-usage-*                          │
│  • analysis_queue_state                                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Optional, Express)                    │
├─────────────────────────────────────────────────────────────────┤
│  /api/llm    → OpenAI API Proxy (streaming)                     │
│  /api/parse  → PDF/PPTX Parsing                                 │
│  data/*.json → Persistente JSON-Dateien                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Datenmodelle

### DocumentAnalysisRecord

Speichert die strukturierte Analyse eines einzelnen Dokuments.

```typescript
interface DocumentAnalysisRecord {
  moduleId: string;
  documentId: string;
  documentType: "script" | "exercise" | "solution" | "exam";
  status: "missing" | "queued" | "running" | "done" | "error";
  sourceHash: string; // SHA-256 des Quelltexts
  analysisVersion: string; // z.B. "1.0.0"
  analysisJson?: string; // Stringified JSON mit extrahierten Items
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Inhalt von analysisJson (nach Dokumenttyp):
interface ScriptAnalysis {
  topics: ExtractedItem[];
  concepts: ExtractedItem[];
  formulas: ExtractedItem[];
  definitions: ExtractedItem[];
  procedures: ExtractedItem[];
  constraints: ExtractedItem[];
  examples: ExtractedItem[];
}

interface ExtractedItem {
  type: string;
  value: string;
  evidenceSnippets: string[]; // Zitate aus Quelltext (validiert!)
}
```

**Persistenz:** `document_analyses` Key in localStorage

**Cache-Invalidierung:** Neuer `sourceHash` triggert Re-Analyse

---

### ModuleProfileRecord

Aggregiertes Profil aus allen Dokument-Analysen eines Moduls.

```typescript
interface ModuleProfileRecord {
  moduleId: string;
  status: "building" | "done" | "error";
  sourceHashAggregate: string; // Kombinierter Hash aller Quellen
  profileVersion: string; // z.B. "1.0.0"
  examStyleProfileJson?: string;
  exerciseStyleProfileJson?: string;
  moduleKnowledgeIndexJson?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Enthaltene Profile:**

```typescript
// ExamStyleProfile (aus exam-Dokumenten)
interface ExamStyleProfile {
  phrases: string[]; // "Berechnen Sie...", "Zeigen Sie..."
  scoringPatterns: string[]; // Punkteverteilung
  formatting: string[]; // Nummerierung, Struktur
  difficultyMix: { easy: number; medium: number; hard: number };
}

// ExerciseStyleProfile (aus exercise/solution-Dokumenten)
interface ExerciseStyleProfile {
  verbs: string[]; // "Bestimmen", "Zeichnen"
  subtaskPatterns: string[]; // a), b), c) Struktur
  solutionFormats: string[]; // Erwartete Antwortformate
  pointConventions: string[];
}

// ModuleKnowledgeIndex (aus script-Dokumenten)
interface ModuleKnowledgeIndex {
  topics: string[];
  definitions: { term: string; definition: string; source: string }[];
  formulas: { name: string; formula: string; source: string }[];
  procedures: { name: string; steps: string[]; source: string }[];
  topicIndex: Record<string, string[]>; // Invertierter Index: keyword → items
}
```

**Persistenz:** `module_profiles` Key in localStorage

**Cache-Invalidierung:** Wenn `sourceHashAggregate` sich ändert (neue/geänderte Analyse)

---

### ModuleTagRegistry

Modul-spezifisches Tag-Register für Kanonisierung.

```typescript
interface ModuleTagRegistry {
  moduleId: string;
  entries: TagRegistryEntry[];
  lastUpdatedAt: string;
  version: string; // z.B. "1.0.0"
}

interface TagRegistryEntry {
  canonicalKey: string; // Normalisierter Schlüssel
  label: string; // Bevorzugtes Anzeigelabel
  synonyms: string[]; // Alternative Formen
  usageCount: number; // Nutzungszähler
  lastUsedAt: string;
}
```

**Persistenz:** `module_tag_registries` Key in localStorage

**Canonical Key Algorithmus:**

1. Lowercase + trim
2. Klammerninhalt als Tokens extrahieren
3. Bindestriche/Unterstriche → Leerzeichen
4. Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss)
5. Stoppwörter entfernen
6. Tokens alphabetisch sortieren
7. Mit Leerzeichen verbinden

**Beispiel:** `"Minimierung (Quine-McCluskey)"` → `"mccluskey minimierung quine"`

---

### UserPreferences

Persistierte Benutzereinstellungen.

```typescript
interface UserPreferences {
  preferredInputMode?: "type" | "draw";
  // Weitere Einstellungen können ergänzt werden
}
```

**Persistenz:** `user_preferences` Key in localStorage

---

### ExamBlueprint

Planungs-Dokument für Multi-Stage Exam-Generierung.

```typescript
interface ExamBlueprint {
  moduleId: string;
  totalDuration: number; // Minuten
  totalPoints: number;
  taskCount: number;
  items: BlueprintItem[];
  coveredTopics: string[];
  difficultyMix: { easy: number; medium: number; hard: number };
  inputModeConstrained: boolean;
}

interface BlueprintItem {
  taskIndex: number;
  topic: string;
  subtopics: string[];
  difficulty: "easy" | "medium" | "hard";
  points: number;
  targetMinutes: number;
  answerMode: "type" | "draw" | "either";
  requiredKnowledgeKeys: string[]; // Keys für Retrieval
  taskType: string; // calculation, proof, open-question, etc.
}
```

---

## 🔄 Pipeline-Diagramme

### Document Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    analyzeDocumentToJson()                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Compute sourceHash (SHA-256)                                 │
│ 2. Check cache: same hash + version? → Return cached            │
└─────────────────────────────────────────────────────────────────┘
                              │ Cache miss
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Chunk text (if > threshold)                                  │
│    • Sentence-boundary detection                                │
│    • Overlap between chunks (200 chars)                         │
│    • Max 4000 chars per chunk                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. For each chunk: LLM analysis                                 │
│    • STRICT extract-only prompts                                │
│    • Return structured JSON                                     │
│    • Includes evidenceSnippets for each item                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Validate evidenceSnippets                                    │
│    • 70% word match against original text                       │
│    • Items without valid evidence → discarded                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Merge chunk results                                          │
│    • Deduplicate items                                          │
│    • Combine evidence snippets                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Store DocumentAnalysisRecord                                 │
│    • status: 'done'                                             │
│    • analysisJson: stringified result                           │
└─────────────────────────────────────────────────────────────────┘
```

### Analysis Queue Management

```
┌─────────────────────────────────────────────────────────────────┐
│                      Analysis Queue                              │
│                      (Singleton)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   enqueue()             process()            onProgress()
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Add to queue │    │ Run serial   │    │ Emit events  │
│ (if needed)  │    │ (1 at a time)│    │ to UI        │
└──────────────┘    └──────────────┘    └──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ After completion:│
                    │ buildModuleProf- │
                    │ iles(moduleId)   │
                    └──────────────────┘

Queue State persistiert in: analysis_queue_state
Bei App-Start: 'running' → 'queued' (Recovery)
```

### Exam Blueprint Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    generateExamTasks()                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage A: generateExamBlueprint()                        [10%]   │
│ ─────────────────────────────────                               │
│ 1. Load ModuleProfileRecord (cached)                            │
│ 2. Parse ModuleKnowledgeIndex                                   │
│ 3. Build topic weights: frequency + weakness boost (2x)         │
│ 4. LLM plans BlueprintItems across ALL topics                   │
│ 5. Validate totals (points, time, difficulty mix)               │
│ 6. Fallback: algorithmic planning if LLM fails                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage B: For each BlueprintItem                    [10% → 100%] │
│ ─────────────────────────────                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 1. retrieveRelevantKnowledge()                              │ │
│ │    • Use requiredKnowledgeKeys from blueprint               │ │
│ │    • Query inverted topicIndex                              │ │
│ │    • Get specific definitions, formulas, procedures         │ │
│ │    • Max ~2000 chars context per task                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 2. generateTaskFromBlueprint()                              │ │
│ │    • Build focused prompt with retrieved knowledge          │ │
│ │    • Apply style from ExamStyleProfile                      │ │
│ │    • Respect answerMode constraint (type/draw/either)       │ │
│ │    • Include allowedTags for tag consistency                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 3. normalizeTags()                                          │ │
│ │    • Canonical key computation                              │ │
│ │    • Registry lookup/update                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 4. runValidationPipeline() [Quality Gate]                   │ │
│ │    • Validate: solvability, consistency, style, input-mode  │ │
│ │    • If issues: repair attempt (max 2x)                     │ │
│ │    • If repair fails: regenerate with "avoid these issues"  │ │
│ │    • Log to debug console                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Return: { blueprint, tasks[] }                                   │
│ • Blueprint for debugging/transparency                          │
│ • Tasks array with validated, tag-normalized tasks              │
└─────────────────────────────────────────────────────────────────┘
```

### Task Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                   runValidationPipeline()                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. validateGeneratedTask()                                      │
│    • Check: All parameters given?                               │
│    • Check: Solution consistent with question?                  │
│    • Check: Style matches module profile?                       │
│    • Check: requiresDrawing vs preferredInputMode?              │
│    • Return: ValidationResult { ok, issues[], confidence }      │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ ok = true         │ ok = false
                    ▼                   ▼
            ┌───────────┐       ┌───────────────────────┐
            │ Return    │       │ 2. repairTask()       │
            │ task      │       │    (max 2 attempts)   │
            └───────────┘       │    • Use suggested-   │
                                │      FixPrompt        │
                                │    • Preserve good    │
                                │      parts            │
                                └───────────────────────┘
                                          │
                                ┌─────────┴─────────┐
                                │ ok = true         │ ok = false
                                ▼                   ▼
                        ┌───────────┐       ┌───────────────────────┐
                        │ Return    │       │ 3. regenerate()       │
                        │ repaired  │       │    • Add "avoid these │
                        └───────────┘       │      issues" to prompt│
                                            │    • Full new task    │
                                            └───────────────────────┘
                                                      │
                                            ┌─────────┴─────────┐
                                            │ ok = true         │ ok = false
                                            ▼                   ▼
                                    ┌───────────┐       ┌───────────┐
                                    │ Return    │       │ Return    │
                                    │ regenera- │       │ original  │
                                    │ ted       │       │ (fallback)│
                                    └───────────┘       └───────────┘

All steps logged to DebugConsole with:
• Task question
• Validation result + confidence
• Issues list
• Repair/regenerate status
• Timing
```

### Tag Canonicalization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      normalizeTags()                             │
│                      Input: ["Quine-McCluskey",                  │
│                              "Minimierung (Quine-McCluskey)"]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ For each tag:                                                   │
│ 1. Compute canonicalKey                                         │
│    "Quine-McCluskey" → "mccluskey quine"                        │
│    "Minimierung (Quine-McCluskey)" → "mccluskey minimierung...  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Check ModuleTagRegistry                                      │
│    • Exact key match?                                           │
│    • Synonym match (KNOWN_SYNONYMS)?                            │
│    • Token overlap match?                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │ Found                             │ Not found
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│ Use existing label  │             │ Create new entry    │
│ Increment usageCount│             │ with cleaned label  │
└─────────────────────┘             └─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Output: ["Quine-McCluskey", "Quine-McCluskey"]                  │
│ (Second tag mapped to existing entry)                           │
│                                                                 │
│ Registry updated with usage counts                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Caching-Mechanismen

### Source Hash Caching

Alle Analyse-Operationen verwenden Hash-basiertes Caching:

| Record Type            | Hash Field            | Berechnung                               | Invalidierung                |
| ---------------------- | --------------------- | ---------------------------------------- | ---------------------------- |
| DocumentAnalysisRecord | `sourceHash`          | SHA-256(normalizedText)                  | Text geändert                |
| ModuleProfileRecord    | `sourceHashAggregate` | SHA-256(alle Analyse-Hashes + Versionen) | Analyse hinzugefügt/geändert |

**Beispiel-Flow:**

```
Upload script.pdf
  → Compute sourceHash = sha256(extractedText)
  → Check: existingRecord.sourceHash === newHash?
  → YES: Skip analysis (cached)
  → NO: Run analysis, store new record with hash
```

### Version Tracking

Jedes Record hat eine `*Version` Feld für Schema-Migrationen:

```typescript
const DOCUMENT_ANALYSIS_VERSION = "1.0.0";
const MODULE_PROFILE_VERSION = "1.0.0";
const REGISTRY_VERSION = "1.0.0";
```

Bei Schema-Änderungen:

1. Version erhöhen
2. Alte Records werden automatisch re-analysiert/rebuilt

---

## 🐛 Debug-Tooling

### Debug Mode

Aktivierung: `localStorage.setItem('studysync_debug_mode', 'true')` oder Toggle-Button

**Sichtbare Features im Debug Mode:**

1. **AnalysisStatusBadge** (klickbar):

   - Zeigt Status-Punkt (missing/queued/running/done/error)
   - Klick öffnet Modal mit vollem JSON der Analyse
   - Copy-to-Clipboard Funktion

2. **ModuleProfileStatus** (klickbar):

   - Zeigt 3 Profile (Exam/Exercise/Knowledge)
   - Klick öffnet jeweiliges Profil-JSON im Modal
   - Coverage-Statistiken sichtbar

3. **DebugConsole**:
   - Echtzeit-Log aller LLM-Operationen
   - Task-Validierungen mit Issues und Confidence
   - Repair/Regenerate-Versuche geloggt
   - Filter nach Log-Typ

### Debug Log Types

```typescript
type DebugLogType =
  | "llm-call" // LLM API Aufruf
  | "task-generation" // Task generiert
  | "task-validation" // Validierung durchgeführt
  | "task-repair" // Reparatur-Versuch
  | "validation-pipeline" // Vollständige Pipeline
  | "exam-generation" // Exam generiert
  | "analysis" // Dokument-Analyse
  | "profile-build" // Profil-Build
  | "error"; // Fehler

interface DebugLogEntry {
  id: string;
  timestamp: Date;
  type: DebugLogType;
  message: string;
  data?: {
    prompt?: string;
    response?: string;
    validationResult?: ValidationResult;
    issues?: string[];
    wasRepaired?: boolean;
    wasRegenerated?: boolean;
    totalAttempts?: number;
    taskQuestion?: string;
    // ... weitere Felder
  };
}
```

---

## 📁 Verzeichnisstruktur

```
src/
├── lib/                           # Core Business Logic
│   ├── storage.ts                 # IndexedDB/localStorage Abstraktion
│   ├── llm-utils.ts               # LLM API Client
│   ├── types.ts                   # Haupt-Typen (Task, Module, Script, etc.)
│   ├── analysis-types.ts          # Analyse-spezifische Typen
│   ├── analysis-storage.ts        # Analyse/Profil Persistenz
│   ├── document-analyzer.ts       # Dokument-Analyse Pipeline
│   ├── analysis-queue.ts          # Analyse Queue (Singleton)
│   ├── module-profile-builder.ts  # Profil-Aggregation
│   ├── generation-context.ts      # Context-Building für Generierung
│   ├── exam-generator.ts          # Legacy Exam-Generierung
│   ├── exam-blueprint.ts          # Blueprint-basierte Generierung
│   ├── task-validator.ts          # Quality Gate
│   ├── tag-canonicalizer.ts       # Tag-Normalisierung
│   ├── recommendations.ts         # Lernempfehlungen
│   ├── spaced-repetition.ts       # Flashcard-Algorithmus
│   ├── statistics.ts              # Statistik-Berechnung
│   └── debug-store.ts             # Debug-Logging
│
├── hooks/                         # React Hooks
│   ├── use-database.ts            # CRUD-Operationen
│   ├── use-debug-mode.ts          # Debug Mode State
│   ├── use-preferred-input-mode.ts# Input Mode Preference
│   └── use-file-upload.ts         # File Upload Logic
│
├── components/                    # React Components
│   ├── App.tsx                    # Hauptkomponente
│   ├── ModuleView.tsx             # Modul-Ansicht
│   ├── FilesTab.tsx               # Datei-Liste mit Status-Badges
│   ├── AnalysisStatusBadge.tsx    # Per-Dokument Status
│   ├── ModuleProfileStatus.tsx    # Modul-Profil Übersicht
│   ├── TaskSolver.tsx             # Aufgaben-Löser
│   ├── ExamMode.tsx               # Prüfungsmodus
│   ├── ExamSessionScreen.tsx      # Prüfungs-Session
│   ├── OnboardingTutorial.tsx     # Onboarding mit Input-Mode
│   ├── InputModeSettings.tsx      # Input-Mode Einstellungen
│   ├── DebugConsole.tsx           # Debug-Konsole
│   └── ui/                        # shadcn/ui Komponenten
│
├── styles/
│   └── theme.css                  # Custom CSS Variablen
│
└── assets/
    └── documents/                 # Lokale Dokumente
```

---

## 🔑 LocalStorage Keys

| Key                              | Inhalt                 | Typ                        |
| -------------------------------- | ---------------------- | -------------------------- |
| `modules`                        | Module-Liste           | `Module[]`                 |
| `scripts`                        | Alle Skripte           | `Script[]`                 |
| `notes`                          | Alle Notizen           | `Note[]`                   |
| `tasks`                          | Alle Aufgaben          | `Task[]`                   |
| `flashcards`                     | Alle Flashcards        | `Flashcard[]`              |
| `document_analyses`              | Analyse-Records        | `DocumentAnalysisRecord[]` |
| `module_profiles`                | Profil-Records         | `ModuleProfileRecord[]`    |
| `module_tag_registries`          | Tag-Registries         | `ModuleTagRegistry[]`      |
| `user_preferences`               | Benutzer-Einstellungen | `UserPreferences`          |
| `analysis_queue_state`           | Queue-State            | `QueueState`               |
| `studymate-topic-stats`          | Topic-Statistiken      | `TopicStats[]`             |
| `studysync_onboarding_completed` | Onboarding-Flag        | `boolean`                  |
| `studysync_tag_migration_v1`     | Migrations-Flag        | `boolean`                  |
| `studysync_debug_mode`           | Debug-Mode             | `boolean`                  |
| `token-usage-*`                  | Kosten-Tracking        | `TokenUsage`               |

---

## 🚀 Performance-Optimierungen

1. **Chunked Analysis**: Große Dokumente werden in ~4000-Zeichen-Chunks analysiert
2. **Serial Queue**: Analyse-Jobs laufen seriell um Rate-Limits zu respektieren
3. **Hash-Caching**: Unveränderte Dokumente werden nicht re-analysiert
4. **Focused Retrieval**: Blueprint-Tasks laden nur relevanten Context (~2000 chars)
5. **Lazy Profile Loading**: Profile werden on-demand geparsed, nicht bei jedem Render
6. **Badge Polling**: Status-Updates alle 5 Sekunden, nicht bei jedem Render

---

## 🔒 Sicherheit

- Alle Daten lokal im Browser gespeichert
- Kein Server-Account erforderlich
- OpenAI API Key nur im Backend verwendet
- Keine PII wird an externe Dienste gesendet (außer LLM für Analyse)
