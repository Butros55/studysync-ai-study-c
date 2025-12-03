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
- **Functionality**: Upload PDF and PPTX files (lecture notes/presentations) to specific modules
- **Purpose**: Centralizes course materials in one accessible location per module
- **Trigger**: User clicks "Upload Script" within a module folder
- **Progression**: Click upload → Select PDF/PPTX file → AI parses file content → File uploads with loading indicator → Script appears in module's script list with file type badge
- **Success criteria**: PDF and PPTX files are parsed correctly, text content is extracted, files are stored per module with metadata (name, upload date, file type)

### AI Study Note Generation
- **Functionality**: Processes uploaded scripts to generate concise study notes automatically
- **Purpose**: Saves time by summarizing key concepts and creating study-friendly content
- **Trigger**: User clicks "Generate Notes" on an uploaded script
- **Progression**: Click generate → AI processes document → Loading state → Notes appear in dedicated notes section → Notes are editable and savable
- **Success criteria**: Notes capture key concepts, are formatted readably, and persist for future reference

### AI Task Generation
- **Functionality**: Creates practice problems based on script content with solutions
- **Purpose**: Provides targeted practice material directly related to course content
- **Trigger**: User clicks "Generate Tasks" on a script or module
- **Progression**: Click generate → AI creates 3-5 tasks → Tasks appear in module's task list → Each task shows difficulty level
- **Success criteria**: Tasks are relevant to content, vary in difficulty, include solutions stored separately

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
- **Upload Failures**: Show clear error messages with retry options if file uploads fail, are wrong format (only PDF/PPTX accepted), or cannot be parsed
- **AI Processing Errors**: Graceful fallback messages if AI generation fails, with manual retry button
- **No Touch Support**: Keyboard/text input remains fully functional for non-touch devices
- **Large Files**: Show progress indicators for PDF/PPTX parsing, especially for large documents with many pages/slides
- **Task Completion**: Completed tasks are marked/moved to archive to avoid clutter
- **Module Deletion**: Confirm before deleting modules to prevent accidental data loss

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
  - **Scroll Area**: Long lists of modules, scripts, tasks
  - **Progress**: File upload progress, task completion tracking
  - **Badge**: Task difficulty levels, completion status
  - **Separator**: Visual division between sections
  - **Textarea**: Note editing, text-based problem input
  - **Alert**: Error messages, helpful tips

- **Customizations**:
  - **Canvas Component**: Custom HTML5 canvas for handwriting with pen pressure support
  - **File Upload Zone**: Custom drag-drop area with file type validation
  - **Task Solver View**: Full-screen overlay with canvas, task prompt, and controls
  - **Module Grid**: Responsive grid layout with masonry-style cards

- **States**:
  - Buttons: Default with subtle shadow → Hover with slight lift → Active with press effect → Disabled with reduced opacity
  - Cards: Default flat → Hover with shadow + lift → Active/selected with border highlight
  - Canvas: Default with dotted grid → Active drawing with smooth stroke → Submitted with readonly overlay

- **Icon Selection**:
  - Plus: New module/upload
  - Folder: Module representation
  - FileText: Scripts/documents
  - Brain/Sparkles: AI generation actions
  - Pencil: Handwriting/solve mode
  - Check: Correct solutions
  - Lightbulb: Hints
  - ArrowRight: Next task
  - Trash: Delete actions
  - Download: Export notes

- **Spacing**: Base unit of 4px, generous padding (p-6 for cards, p-8 for containers), gap-4 for grids, gap-6 for major sections

- **Mobile**: 
  - Module grid: 1 column on mobile → 2 columns tablet → 3 columns desktop
  - Tabs switch to dropdown select on mobile
  - Canvas solver is full-screen by default (optimal for all screen sizes)
  - Touch targets minimum 44px, increased button padding on mobile
  - Bottom sheet instead of dialog on mobile for actions
