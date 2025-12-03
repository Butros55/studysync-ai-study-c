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

### AI Study Note Generation
- **Functionality**: Processes uploaded scripts to generate concise study notes automatically with progress tracking
- **Purpose**: Saves time by summarizing key concepts and creating study-friendly content
- **Trigger**: User clicks "Generate Notes" on an uploaded script (can preview content first)
- **Progression**: Click generate → Task added to notification center → AI processes document → Progress updates in real-time → Notes appear in dedicated notes section → Completion notification shown → Notes are editable and savable
- **Success criteria**: Notes capture key concepts, are formatted readably, persist for future reference, progress is clearly visible throughout generation

### AI Task Generation
- **Functionality**: Creates practice problems based on script content with solutions, with robust error handling
- **Purpose**: Provides targeted practice material directly related to course content
- **Trigger**: User clicks "Generate Tasks" on a script or module
- **Progression**: Click generate → Task added to notification center with progress tracking → AI creates 3-5 tasks → Progress updates smoothly through all stages → Tasks appear in module's task list → Each task shows difficulty level → Completion notification
- **Success criteria**: Tasks are relevant to content, vary in difficulty, include solutions stored separately, generation process is reliable with clear error messages if it fails, progress tracking is accurate and smooth

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

## Edge Case Handling

- **Empty States**: First-time users see helpful onboarding cards explaining to create modules and upload scripts
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

- **Spacing**: Base unit of 4px, generous padding (p-6 for cards, p-8 for containers), gap-4 for grids, gap-6 for major sections

- **Mobile**: 
  - Module grid: 1 column on mobile → 2 columns tablet → 3 columns desktop
  - Tabs switch to dropdown select on mobile
  - Canvas solver is full-screen by default (optimal for all screen sizes)
  - Touch targets minimum 44px, increased button padding on mobile
  - Bottom sheet instead of dialog on mobile for actions
