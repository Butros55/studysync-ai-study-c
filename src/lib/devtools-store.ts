import { estimateCost, normalizeModelName } from "./model-pricing";

export type ApiLogEntry = {
  id: string;
  startedAt: number;
  durationMs: number;
  request: {
    url: string;
    method: string;
    body?: any;
    headers?: Record<string, string>;
  };
  response?: {
    status: number;
    body?: any;
    textPreview?: string;
  };
  llm?: {
    model?: string;
    normalizedModel?: string;
    operation?: string;
    jsonMode?: boolean;
    usage?: any;
    cost?: {
      estimatedUsd?: number;
      breakdown?: { inputUsd?: number; cachedInputUsd?: number; outputUsd?: number };
      pricingModelKey?: string;
      note?: string;
    };
  };
  error?: {
    message: string;
    stack?: string;
  };
};

export type BackendMeta = {
  env?: string;
  serverTime?: string;
  baseUrl?: string;
  service?: {
    provider?: string;
    port?: string;
    host?: string;
    forwardedProto?: string;
  };
};

export type CapturedError = {
  id: string;
  message: string;
  stack?: string;
  source?: "error" | "promise" | "boundary";
  url?: string;
  timestamp: number;
};

type DevToolsState = {
  devMode: boolean;
  debugLogging: boolean;
  logs: ApiLogEntry[];
  meta?: BackendMeta;
  lastError?: CapturedError;
};

const LOG_STORAGE_KEY = "studymate_api_logs";
const DEV_MODE_KEY = "studymate_dev_mode";
const DEBUG_LOGGING_KEY = "studymate_debug_logging";
const MAX_LOGS = 200;

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  );
}

function loadBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function loadLogs(): ApiLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

class DevToolsStore {
  private state: DevToolsState;
  private listeners: Set<(state: DevToolsState) => void> = new Set();

  constructor() {
    const initialDevMode = loadBoolean(DEV_MODE_KEY, false);
    const initialDebugLogging = initialDevMode && loadBoolean(DEBUG_LOGGING_KEY, false);
    this.state = {
      devMode: initialDevMode,
      debugLogging: initialDebugLogging,
      logs: initialDevMode ? loadLogs() : [],
      meta: undefined,
      lastError: undefined,
    };
  }

  getState(): DevToolsState {
    return this.state;
  }

  subscribe(listener: (state: DevToolsState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.state;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private persistDevMode() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DEV_MODE_KEY, this.state.devMode ? "true" : "false");
    } catch {
      // ignore
    }
  }

  private persistDebugLogging() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        DEBUG_LOGGING_KEY,
        this.state.debugLogging ? "true" : "false"
      );
    } catch {
      // ignore
    }
  }

  private persistLogs() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.state.logs));
    } catch {
      // ignore
    }
  }

  setDevMode(enabled: boolean) {
    const logs = enabled
      ? this.state.logs.length > 0
        ? this.state.logs
        : loadLogs()
      : [];
    this.state = { ...this.state, devMode: enabled, logs };
    this.persistDevMode();
    this.persistLogs();
    this.notify();
  }

  setDebugLogging(enabled: boolean) {
    this.state = { ...this.state, debugLogging: enabled };
    this.persistDebugLogging();
    this.notify();
  }

  setMeta(meta: BackendMeta) {
    this.state = { ...this.state, meta };
    this.notify();
  }

  captureError(error: CapturedError) {
    this.state = { ...this.state, lastError: error };
    this.notify();
  }

  clearLastError() {
    if (!this.state.lastError) return;
    this.state = { ...this.state, lastError: undefined };
    this.notify();
  }

  addLog(entry: Omit<ApiLogEntry, "id">) {
    if (!this.state.devMode || !this.state.debugLogging) return;
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    const normalizedModel =
      entry.llm?.normalizedModel ??
      (entry.llm?.model ? normalizeModelName(entry.llm.model) : undefined);

    const cost =
      entry.llm?.model && entry.llm?.usage
        ? estimateCost(entry.llm.model, entry.llm.usage).cost
        : entry.llm?.cost;

    const newEntry: ApiLogEntry = {
      ...entry,
      id,
      llm: {
        ...entry.llm,
        normalizedModel: normalizedModel ?? entry.llm?.normalizedModel,
        cost: entry.llm?.cost ?? cost,
      },
    };

    const nextLogs = [newEntry, ...this.state.logs].slice(0, MAX_LOGS);
    this.state = { ...this.state, logs: nextLogs };
    this.persistLogs();
    this.notify();
  }

  clearLogs() {
    this.state = { ...this.state, logs: [] };
    this.persistLogs();
    this.notify();
  }
}

export const devToolsStore = new DevToolsStore();
