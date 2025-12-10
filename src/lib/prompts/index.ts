/**
 * Prompts Module Index
 * 
 * Exports all prompt templates for different generation types.
 * Each generator function imports exactly its own prompt.
 */

export {
  PRACTICE_TASKS_PROMPT_VERSION,
  buildPracticeTaskPrompt,
  parsePracticeTaskResponse,
  type PracticeTaskPromptParams
} from './practiceTasks.prompt'

export {
  FLASHCARDS_PROMPT_VERSION,
  buildFlashcardsPrompt,
  parseFlashcardsResponse,
  type FlashcardsPromptParams
} from './flashcards.prompt'

export {
  NOTES_PROMPT_VERSION,
  buildNotesPrompt,
  validateNotesResponse,
  type NotesPromptParams
} from './notes.prompt'

export {
  EXAM_BLUEPRINT_PROMPT_VERSION,
  buildExamBlueprintPrompt,
  parseExamBlueprintResponse,
  type ExamBlueprintPromptParams
} from './examBlueprint.prompt'

export {
  EXAM_TASK_PROMPT_VERSION,
  buildExamTaskPrompt,
  parseExamTaskResponse,
  type ExamTaskPromptParams
} from './examTask.prompt'
