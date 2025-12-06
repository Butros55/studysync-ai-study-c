# Planning Guide

A university study companion that organizes course materials by module, generates AI-powered study notes and practice tasks from uploaded scripts, and provides an interactive problem-solving interface with handwriting recognition for touch devices.

**Experience Qualities**:

1. **Organized** - Clear module-based hierarchy that keeps different courses completely separated, making it effortless to find and manage materials
2. **Intelligent** - AI seamlessly generates study materials and provides adaptive feedback, acting as a personal tutor
3. **Interactive** - Touch-friendly canvas for handwritten solutions creates an authentic study experience that mimics paper-based learning

**Complexity Level**: Complex Application (advanced functionality, accounts)

- Requires file upload management, AI processing, persistent storage across multiple modules, handwriting recognition, and stateful task progression

## Essential Features

### Module Management

- **Functionality**: Create, organize, and navigate folders for each university module/course
- **Purpose**: Keeps different courses completely separated to prevent confusion and maintain organization
- **Trigger**: User clicks "New Module" button on main dashboard
- **Progression**: Click new module → Enter module name/code → Module card appears on dashboard → Click to enter module view
- **Success criteria**: Modules persist between sessions, each maintains independent script and task collections

### Local Data Storage Indicator

- **Functionality**: Visible indicator showing users that all their data is stored locally in their browser
- **Purpose**: Builds trust by clearly communicating privacy and data ownership, helps users understand why data doesn't sync between devices
- **Trigger**: Always visible in header (desktop) and footer (all views)
- **Progression**: User sees database icon with "Daten lokal gespeichert" text → Can hover for detailed tooltip explaining local storage → Banner appears on empty state with full explanation
- **Success criteria**: Users understand their data is private and stored locally, tooltip provides clear information about what's stored and why

### Script Upload & Storage

- **Functionality**: Upload PDF and PPTX files (lecture notes/presentations) to specific modules with content preview
- **Purpose**: Centralizes course materials in one accessible location per module and allows verification of parsed content
- **Trigger**: User clicks "Upload Script" within a module folder
- **Progression**: Click upload → Select PDF/PPTX file → AI parses file content → Upload progress tracked in notification center → Script appears in module's script list with file type badge → User can preview extracted content before processing
- **Success criteria**: PDF and PPTX files are parsed correctly, text content is extracted, files are stored per module with metadata (name, upload date, file type), preview shows accurate content with statistics, progress is tracked smoothly

### Real-time Notification Center

- **Functionality**: Global notification bell with badge counter showing all ongoing tasks (uploads, AI generations), completed items, and errors with an expandable notification history panel
- **Purpose**: Provides visibility into background processing, allows users to continue working while tasks complete, creates confidence through transparent progress tracking
- **Trigger**: Automatically appears when any task starts (upload, note generation, task generation); user can click bell icon to open full notification history
- **Progression**: Task initiated → Notification bell shows badge count → Active task card appears with real-time progress bar → Task completes/fails → Result shown in notification history → User can dismiss individual notifications or clear all
- **Success criteria**: Badge count is accurate, progress bars update smoothly (not stuck at 40%), notifications persist across all views (home, module view, task solver), completed/failed notifications remain accessible for review, animations are smooth and delightful

### Script Content Preview

- **Functionality**: View extracted text content from uploaded scripts with statistics
- **Purpose**: Verify parsed content accuracy before generating notes or tasks, review material at a glance
- **Trigger**: User clicks "Preview" button on a script card
- **Progression**: Click preview → Dialog opens showing full content → Display word count, line count, character count → User can review and scroll through content → Close to return
- **Success criteria**: Preview loads instantly, shows formatted content exactly as extracted, statistics are accurate, dialog is responsive and scrollable

### Document Analysis System

- **Functionality**: Automatically analyzes uploaded documents (scripts, exercises, solutions, exams) into structured JSON with chunked processing for large files
- **Purpose**: Extracts machine-readable data (topics, concepts, formulas, definitions, procedures, examples) that powers intelligent task generation and learning recommendations
- **Trigger**: Automatic on file upload, or manual via "Analyse starten" menu action
- **Progression**: Upload file → Added to analysis queue → Serial processing (1 at a time) → Large files chunked with sentence-boundary detection → Each chunk analyzed by LLM → Evidence snippets validated against source text → Results merged and deduplicated → Stored as DocumentAnalysisRecord
- **Analysis Types by Document Category**:
  - **Scripts**: topics, concepts, formulas, definitions, procedures, constraints, examples
  - **Exercises**: patterns, phrases, structure, topics, concepts
  - **Solutions**: patterns, procedures, formulas, structure
  - **Exams**: phrases, patterns, structure, topics, formulas, difficulty distribution
- **Key Features**:
  - **Chunking**: Text split at sentence boundaries with overlap for context continuity
  - **Evidence Validation**: Every extracted item must have source text snippets (70% word match required)
  - **Caching**: sourceHash computed via SHA-256, analysis skipped if hash unchanged
  - **Queue Management**: Serial processing prevents rate limit issues, queue state persisted
- **Success criteria**: Analysis captures all relevant concepts, no hallucinated items (evidence validation), large documents processed without timeout, results cached for performance

### Module Profiles (Aggregated Intelligence)

- **Functionality**: Builds aggregated profiles per module from all analyzed documents: ExamStyleProfile, ExerciseStyleProfile, and ModuleKnowledgeIndex
- **Purpose**: Provides structured knowledge base for task generation with consistent style matching and topic coverage tracking
- **Trigger**: Automatically rebuilt after each document analysis completes
- **Progression**: Document analysis done → Aggregate all analyses for module → Build ExamStyle from exam docs → Build ExerciseStyle from exercise/solution docs → Build KnowledgeIndex with inverted topic index from scripts → Store as ModuleProfileRecord
- **Profile Types**:
  - **ExamStyleProfile**: Phrasen, Scoring patterns, Formatierung, Schwierigkeitsmix from exam documents
  - **ExerciseStyleProfile**: Verben, Subtasks, Lösungsformatierung, Punktekonventionen from exercises
  - **ModuleKnowledgeIndex**: Topics, Definitions, Formulas, Procedures with inverted index for retrieval
- **Key Features**:
  - **Inverted Index**: Maps topic keywords to specific knowledge items for focused retrieval
  - **Coverage Stats**: Shows what percentage of documents have been analyzed (weighted: scripts 2x)
  - **Cache Invalidation**: sourceHashAggregate tracks all contributing hashes, rebuilt if any change
- **Success criteria**: Profiles reflect actual document content, inverted index enables fast topic lookup, coverage stats accurate

### AI Study Note Generation

- **Functionality**: Processes uploaded scripts to generate concise study notes automatically with progress tracking
- **Purpose**: Saves time by summarizing key concepts and creating study-friendly content
- **Trigger**: User clicks "Generate Notes" on an uploaded script (can preview content first)
- **Progression**: Click generate → Task added to notification center → AI processes document → Progress updates in real-time → Notes appear in dedicated notes section → Completion notification shown → Notes are editable and savable
- **Success criteria**: Notes capture key concepts, are formatted readably, persist for future reference, progress is clearly visible throughout generation

### AI Task Generation (Enhanced with Blueprint Pipeline)

- **Functionality**: Creates practice problems based on analyzed script content with solutions, using a multi-stage blueprint system that considers ALL module documents
- **Purpose**: Provides targeted practice material directly related to course content, with intelligent topic coverage and quality validation
- **Trigger**: User clicks "Generate Tasks" on a script or module
- **Progression**: Click generate → Task added to notification center → Blueprint planned across all analyzed documents → Tasks generated per blueprint item with focused context retrieval → Quality Gate validates each task → Tasks appear in module's task list → Each task shows difficulty level and normalized tags
- **Key Features**:
  - **Document Analysis**: All scripts/exercises/exams are pre-analyzed into structured JSON (topics, formulas, definitions, procedures)
  - **Module Profiles**: Aggregated ExamStyle, ExerciseStyle, and KnowledgeIndex from analyzed documents
  - **Blueprint Planning**: LLM plans task distribution across ALL topics in the knowledge index
  - **Focused Retrieval**: Each task only loads relevant knowledge (no context overflow)
  - **Quality Gate**: LLM validates solvability, style matching, and input-mode compatibility
  - **Tag Canonicalization**: Tags are normalized to prevent duplicate learning blocks
- **Success criteria**: Tasks are relevant to content, cover broad topic range, vary in difficulty, pass quality validation, include solutions stored separately, tags are consistent across tasks

### Flashcard Study Mode

- **Functionality**: Converts study notes into interactive flashcards with spaced repetition algorithm for optimal learning
- **Purpose**: Provides active recall practice using proven memory techniques to improve retention
- **Trigger**: User clicks "Generate Flashcards" on notes, or starts flashcard study session
- **Progression**: Generate → Task added to notification center → AI creates 5-10 cards from notes → Cards appear in flashcards tab → User starts study session → Cards shown one at a time with flip animation → User self-evaluates recall quality (Again/Hard/Good/Easy) → Spaced repetition schedules next review → Session completes with summary
- **Success criteria**: Cards capture key concepts from notes, flip animation is smooth and intuitive, spaced repetition algorithm properly schedules reviews based on quality ratings, due cards are clearly indicated, study sessions feel focused and productive

### Exam Mode with Blueprint Pipeline

- **Functionality**: Multi-stage exam generation with intelligent blueprint planning across ALL analyzed module content
- **Purpose**: Creates realistic practice exams with proper topic coverage, difficulty distribution, and time allocation
- **Trigger**: User starts Exam Mode from module view
- **Progression**:
  1. **Stage A - Blueprint Planning**: LLM plans task distribution over entire KnowledgeIndex
  2. **Stage B - Per-Task Generation**: Each BlueprintItem triggers focused knowledge retrieval → Task generated with relevant context only
  3. **Stage C - Quality Validation**: Each task validated for solvability and style matching
  4. **Stage D - Assembly**: Valid tasks combined into exam session with timer
- **Blueprint Structure per Task**:
  - `topic`, `subtopics[]`, `difficulty`, `points`, `targetMinutes`
  - `answerMode: 'type' | 'draw' | 'either'` - respects user's input mode preference
  - `requiredKnowledgeKeys[]` - keys for focused retrieval from inverted index
  - `taskType` - calculation, proof, open-question, etc.
- **Key Features**:
  - **No Script Limit**: Blueprint considers ALL topics from ALL analyzed scripts
  - **Weakness Prioritization**: User's weak topics get 2x weight in blueprint planning
  - **Focused Retrieval**: Each task only loads ~2000 chars of relevant knowledge (no overflow)
  - **Time Planning**: Blueprint allocates realistic minutes per task based on difficulty
  - **Input Mode Respect**: If user prefers typing, draw-only tasks are avoided
- **Success criteria**: Exams cover broad topic range, difficulty matches selection, total points/time balanced, tasks are solvable with given information

### Interactive Task Solving

- **Functionality**: Full-screen canvas for solving tasks with keyboard input or touch/stylus drawing
- **Purpose**: Creates authentic problem-solving experience that supports multiple input methods
- **Trigger**: User clicks "Solve" on a task card
- **Progression**: Task opens full screen → User writes/types solution → Submits for AI analysis → Receives feedback (hints if incorrect, success if correct) → Next task button appears on success
- **Success criteria**: Canvas supports smooth drawing, keyboard input works, AI accurately recognizes handwriting, feedback is contextual

### Handwriting Recognition & Validation

- **Functionality**: AI analyzes handwritten or typed solutions and compares against correct answer
- **Purpose**: Enables natural problem-solving while providing immediate intelligent feedback
- **Trigger**: User clicks "Submit Solution" after working on canvas
- **Progression**: Submit → AI extracts text/equations from canvas → Compares to solution → Returns match percentage → Provides hints or success message
- **Success criteria**: Handwriting recognition achieves reasonable accuracy, feedback is helpful not just binary correct/incorrect

### Task Quality Gate (Validation Pipeline)

- **Functionality**: LLM-based quality validation for every generated task with automatic repair and regeneration
- **Purpose**: Ensures all tasks are solvable, complete, and match module style before being saved
- **Trigger**: Automatic after each task generation (both regular tasks and exam tasks)
- **Progression**: Task generated → Validation checks run → If issues found: repair attempt → If repair fails: regenerate → Final task saved or rejected
- **Validation Criteria**:
  - **Solvability**: Are all parameters and values given? Can task be solved with provided information?
  - **Consistency**: Does solution match the question? Are calculations correct?
  - **Style Matching**: Does task match module's exam/exercise style (phrases, format, points)?
  - **Input Mode Compatibility**: Does task require drawing when user prefers typing?
  - **Completeness**: Are all required fields present (question, solution, difficulty, topic, tags)?
- **Repair Strategy**:
  - Uses structured `suggestedFixPrompt` from validator
  - Fixes specific issues without full regeneration
  - Preserves correct parts of original task
  - Max 2 repair attempts before regeneration
- **Debug Integration**: All validation attempts logged to debug console with issues, confidence, timing
- **Success criteria**: Invalid tasks are caught and fixed before user sees them, validation adds <2 seconds per task, debug logs help diagnose patterns

### Tag Canonicalization & Learning Block Merging

- **Functionality**: Normalizes task tags to canonical keys, preventing duplicate learning blocks for semantically equivalent topics
- **Purpose**: Ensures "Quine-McCluskey" and "Minimierung (Quine-McCluskey)" are treated as the same topic in statistics and recommendations
- **Trigger**: Automatic on every task generation, exam task generation, and via one-time migration for existing tasks
- **Progression**: Tag generated by LLM → canonicalKey computed → Check module's TagRegistry for existing match → Use existing label if found, or register new tag → Update usage stats
- **Canonical Key Algorithm**:
  1. Lowercase + trim
  2. Extract parentheses content as separate tokens
  3. Replace hyphens/underscores with spaces
  4. Normalize umlauts (ä→ae, ö→oe, ü→ue, ß→ss)
  5. Remove stop words
  6. Sort tokens alphabetically
  7. Join with spaces
- **Key Features**:
  - **Module-Level Registry**: Each module has its own TagRegistry with labels, synonyms, usage counts
  - **Known Synonyms**: Built-in mapping (KV-Diagramm ↔ Karnaugh-Veitch, etc.)
  - **LLM Guidance**: Allowed tags passed to LLM prompt to encourage reuse of existing labels
  - **One-Time Migration**: Existing tasks normalized at app start
  - **Learning Block Grouping**: Statistics grouped by canonical key, not raw label
- **Success criteria**: Duplicate topics merged correctly, new tags consistent with existing, learning recommendations accurate

### Input Mode Onboarding & Preference

- **Functionality**: Mandatory input mode selection during onboarding (keyboard vs. stylus/drawing) that persists and affects task generation and solving UI
- **Purpose**: Tailors the entire experience to user's preferred input method, generates compatible tasks, shows appropriate UI
- **Trigger**: During mandatory onboarding (no skip button), changeable later via header settings button
- **Progression**: Onboarding step shown → User must select "⌨️ Tastatur (Tippen)" or "✍️ Stift (Zeichnen)" → Preference saved → UI adapts immediately → Can change later via InputModeSettingsButton in header
- **UI Behavior by Mode**:
  - **Type Mode**: No drawing/typing tabs shown → Only textarea visible → Canvas never rendered → Tasks generated avoid drawing-required content
  - **Draw Mode**: Full tabs with "Zeichnen" and "Tippen" → Both input methods available → OCR/Vision pipeline active
- **Integration Points**:
  - `TaskSolver.tsx`: Conditionally renders tabs/canvas based on preference
  - `ExamSessionScreen.tsx`: Same conditional rendering
  - `buildGenerationContext()`: Adds input-mode constraints to task generation prompts
  - `ExamBlueprint`: answerMode considers user preference
  - `TaskValidator`: Checks if task requires drawing when user prefers typing
- **Success criteria**: Mode persists across sessions, UI adapts immediately, generated tasks match capability, no dead states possible

### Study Statistics Dashboard

- **Functionality**: Visual dashboard displaying learning progress over time with charts, metrics, and insights across all modules or per-module
- **Purpose**: Provides motivation through visible progress, identifies areas needing more focus, and helps students understand their learning patterns
- **Trigger**: User clicks "Statistics" button in header or within a specific module
- **Progression**: Click statistics → Dashboard loads with animated charts → View overall stats or filter by module → See tasks completed over time, flashcard retention rates, study streak, difficulty distribution → Identify weak areas → Click through to relevant content
- **Success criteria**: Charts are accurate and update in real-time, data is meaningful and actionable, visualizations are clear and beautiful, dashboard is responsive on all devices, empty states guide new users

## Edge Case Handling

- **Empty States**: First-time users see helpful onboarding cards explaining to create modules and upload scripts; empty analysis states show "Analyse fehlt" badge
- **Analysis Status Indicators**: Per-document badges show analysis state (missing/queued/running/done/error) with tooltips; ModuleProfileStatus card shows aggregated profile coverage
- **Debug Mode**: Developers can enable debug mode to click status badges and view full JSON analysis/profile data in modal dialogs
- **Upload Failures**: Show clear error messages in notification center with retry options if file uploads fail, are wrong format (only PDF/PPTX accepted), or cannot be parsed
- **AI Processing Errors**: Graceful fallback messages in notification center if AI generation fails, with error details shown in the notification history
- **No Touch Support**: Keyboard/text input remains fully functional for non-touch devices
- **Large Files**: Show smooth progress indicators in notification center for PDF/PPTX parsing, especially for large documents with many pages/slides
- **Task Completion**: Completed tasks are marked/moved to archive to avoid clutter
- **Module Deletion**: Confirm before deleting modules to prevent accidental data loss
- **Multiple Concurrent Operations**: Notification center handles multiple simultaneous uploads and AI generations, showing progress for each independently
- **Notification Persistence**: Completed/failed notifications remain in history until user dismisses them, visible across all app views

## Design Direction

The design should feel academic yet modern—professional enough for serious study while remaining approachable and encouraging. The interface should be clean and focused, with generous whitespace that reduces cognitive load during study sessions. A minimal approach serves the educational purpose: less distraction means better concentration on learning materials.

## Color Selection

Analogous color scheme using cool blues and purples to evoke calm, focused learning.

- **Primary Color**: Deep academic blue (oklch(0.45 0.15 250)) - communicates trust, intelligence, and professionalism
- **Secondary Colors**: Soft slate blue (oklch(0.65 0.08 250)) for supporting elements, light lavender (oklch(0.92 0.04 280)) for backgrounds
- **Accent Color**: Vibrant success green (oklch(0.65 0.15 145)) for correct answers, warm amber (oklch(0.70 0.12 65)) for hints/warnings
- **Foreground/Background Pairings**:
  - Background (Light Cream oklch(0.98 0.01 90)): Dark slate text (oklch(0.25 0.02 250)) - Ratio 14.2:1 ✓
  - Card (White oklch(1 0 0)): Dark slate text (oklch(0.25 0.02 250)) - Ratio 15.1:1 ✓
  - Primary (Deep Blue oklch(0.45 0.15 250)): White text (oklch(1 0 0)) - Ratio 7.8:1 ✓
  - Secondary (Slate Blue oklch(0.65 0.08 250)): White text (oklch(1 0 0)) - Ratio 4.9:1 ✓
  - Accent Success (Green oklch(0.65 0.15 145)): White text (oklch(1 0 0)) - Ratio 4.6:1 ✓
  - Accent Warning (Amber oklch(0.70 0.12 65)): Dark text (oklch(0.25 0.02 250)) - Ratio 8.1:1 ✓
  - Muted (Light Lavender oklch(0.92 0.04 280)): Medium slate (oklch(0.50 0.04 250)) - Ratio 5.2:1 ✓

## Font Selection

Typography should convey clarity and academic credibility using a clean sans-serif that's highly readable for extended study sessions, paired with a monospace font for code/equations.

- **Typographic Hierarchy**:
  - H1 (Page Titles): Inter SemiBold/32px/tight tracking (-0.02em)
  - H2 (Module Names): Inter SemiBold/24px/tight tracking (-0.01em)
  - H3 (Section Headers): Inter Medium/18px/normal tracking
  - Body (Content/Notes): Inter Regular/16px/relaxed leading (1.6)
  - Small (Metadata): Inter Regular/14px/normal leading (1.5)
  - Code/Math: JetBrains Mono Regular/14px/normal leading

## Animations

Animations should be subtle and purposeful, reinforcing the calm academic atmosphere while providing clear feedback for interactions. Movement should feel smooth and natural, never jarring or distracting from study focus.

- **Purposeful Meaning**: Success states use gentle scale + fade for encouragement; task transitions slide smoothly to maintain spatial context; loading states pulse softly to indicate processing
- **Hierarchy of Movement**:
  - High priority: Task feedback (correct/incorrect) - 300ms spring animation
  - Medium priority: Page transitions between modules - 250ms ease-out
  - Low priority: Hover states on cards - 150ms ease

## Component Selection

- **Components**:

  - **Card**: Module folders, script items, task cards (with subtle hover lift effect)
  - **Dialog**: Module creation, delete confirmations, settings
  - **Button**: Primary for actions, secondary for cancel, ghost for icon buttons
  - **Tabs**: Switch between scripts/notes/tasks within a module view
  - **Scroll Area**: Long lists of modules, scripts, tasks, notification history
  - **Progress**: File upload progress, task completion tracking, AI generation progress with smooth 300ms transitions
  - **Badge**: Task difficulty levels, completion status, notification counter with pulse animation
  - **Separator**: Visual division between sections
  - **Textarea**: Note editing, text-based problem input
  - **Alert**: Error messages, helpful tips

- **Customizations**:

  - **Canvas Component**: Custom HTML5 canvas for handwriting with pen pressure support
  - **File Upload Zone**: Custom drag-drop area with file type validation
  - **Task Solver View**: Full-screen overlay with canvas, task prompt, and controls
  - **Module Grid**: Responsive grid layout with masonry-style cards
  - **Notification Center**: Fixed-position bell icon with badge counter, expandable notification panel showing active tasks with live progress, completed items, and error history with timestamps

- **States**:

  - Buttons: Default with subtle shadow → Hover with slight lift → Active with press effect → Disabled with reduced opacity
  - Cards: Default flat → Hover with shadow + lift → Active/selected with border highlight
  - Canvas: Default with dotted grid → Active drawing with smooth stroke → Submitted with readonly overlay

- **Icon Selection**:

  - Plus: New module/upload
  - Folder: Module representation
  - FileText: Scripts/documents
  - Eye: Preview script content
  - Brain/Sparkles: AI generation actions
  - Pencil: Handwriting/solve mode
  - Check: Correct solutions
  - Lightbulb: Hints
  - ArrowRight: Next task
  - Trash: Delete actions
  - Download: Export notes
  - Bell: Notification center (regular weight when closed, filled when open)
  - Upload: File uploads in progress
  - Warning: Error notifications
  - ListChecks: Task generation
  - Database: Local storage indicator (duotone variant with primary color)
  - Info: Information/help tooltips

- **Spacing**: Base unit of 4px, generous padding (p-6 for cards, p-8 for containers), gap-4 for grids, gap-6 for major sections

- **Mobile**:
  - Module grid: 1 column on mobile → 2 columns tablet → 3 columns desktop
  - Tabs switch to dropdown select on mobile
  - Canvas solver is full-screen by default (optimal for all screen sizes)
  - Touch targets minimum 44px, increased button padding on mobile
  - Bottom sheet instead of dialog on mobile for actions
