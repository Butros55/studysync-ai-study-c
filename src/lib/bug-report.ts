import { devToolsStore, type ApiLogEntry, type BackendMeta, type CapturedError } from './devtools-store'
import { getStorageStatus, type StorageStatus } from './storage'

type BuildOptions = {
  includeLogs: boolean
  includeStorageInfo: boolean
  includePromptContent: boolean
  focusLogId?: string
  userComment?: string
  reproductionSteps?: string
  includeScreenshot?: boolean
}

type BuiltReport = {
  report: Record<string, any>
  markdown: string
  shortTitle: string
}

const BUG_EMAIL = import.meta.env.VITE_BUG_EMAIL || 'support@example.com'

function truncate(text: string, max = 1200) {
  if (!text) return text
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function hashContent(text: string) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return `h${Math.abs(hash)}`
}

function sanitizeLog(log: ApiLogEntry, includePrompt: boolean): ApiLogEntry {
  const clone: ApiLogEntry = JSON.parse(JSON.stringify(log))

  // Remove auth headers
  if (clone.request?.headers) {
    delete clone.request.headers.authorization
    delete clone.request.headers.Authorization
  }

  if (!includePrompt) {
    if (clone.request?.body?.prompt) clone.request.body.prompt = '<redacted>'
    if (clone.response?.body?.response) clone.response.body.response = '<redacted>'
    if (clone.response?.textPreview) clone.response.textPreview = '<redacted>'
  } else {
    if (clone.request?.body?.prompt) {
      const original = clone.request.body.prompt
      clone.request.body.promptPreview = truncate(original, 1200)
      clone.request.body.prompt = truncate(original, 1200)
      clone.request.body.promptHash = hashContent(original)
    }
    if (clone.response?.textPreview) {
      const text = clone.response.textPreview
      clone.response.textPreview = truncate(text, 1200)
    }
    if (clone.response?.body?.response) {
      clone.response.body.response = truncate(clone.response.body.response, 1200)
    }
  }

  return clone
}

function formatMarkdown(report: Record<string, any>, modelHint?: string, statusHint?: string) {
  const summary = [
    `- URL: ${report.url}`,
    `- Time: ${report.timestamp}`,
    `- Error: ${report.lastError?.message || 'n/a'}`,
    `- Model: ${modelHint || 'n/a'}`,
    `- Status: ${statusHint || 'n/a'}`,
  ].join('\n')

  return [
    '## Bug Report',
    '',
    summary,
    '',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
  ].join('\n')
}

export async function buildBugReport(options: BuildOptions): Promise<BuiltReport> {
  const state = devToolsStore.getState()
  const appVersion = import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_COMMIT_SHA || 'unknown'
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const logs = options.includeLogs ? state.logs.slice(0, 20) : []
  const focusedLogs = options.focusLogId ? logs.filter((l) => l.id === options.focusLogId) : logs
  const sanitizedLogs = focusedLogs.map((log) => sanitizeLog(log, options.includePromptContent))
  const storage: StorageStatus | null =
    options.includeStorageInfo ? await getStorageStatus().catch(() => null) : null

  const lastError: CapturedError | undefined = state.lastError
  const backendMeta: BackendMeta | undefined = state.meta

  const report = {
    appVersion,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString(),
    apiBaseUrl,
    backendMeta,
    lastError: lastError
      ? {
        message: lastError.message,
        stack: lastError.stack,
        source: lastError.source,
        at: lastError.timestamp,
      }
      : undefined,
    storage,
    logs: options.includeLogs ? sanitizedLogs : undefined,
    focusLogId: options.focusLogId,
    userComment: options.userComment,
    reproductionSteps: options.reproductionSteps,
    promptContentIncluded: options.includePromptContent,
    includeStorageInfo: options.includeStorageInfo,
    includeLogs: options.includeLogs,
    includeScreenshot: options.includeScreenshot ?? false,
  }

  const firstLog = sanitizedLogs[0]
  const markdown = formatMarkdown(report, firstLog?.llm?.model, firstLog?.response?.status?.toString())
  const shortTitle = `Bug: ${lastError?.message?.slice(0, 60) || 'Unbekannter Fehler'}`

  return { report, markdown, shortTitle }
}

export function buildGithubUrl(title: string, body: string) {
  const base = 'https://github.com/Butros55/studysync-ai-study-c/issues/new'
  const params = new URLSearchParams({
    title,
    body,
  })
  return `${base}?${params.toString()}`
}

export function buildMailtoUrl(subject: string, body: string) {
  const params = new URLSearchParams({
    subject,
    body,
  })
  return `mailto:${BUG_EMAIL}?${params.toString()}`
}
