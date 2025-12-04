import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

// Stelle sicher, dass das Datenverzeichnis existiert
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Hilfsfunktionen für Datei-Operationen
function getFilePath(collection) {
  return path.join(dataDir, `${collection}.json`);
}

function readCollection(collection) {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Fehler beim Lesen von ${collection}:`, error);
    return [];
  }
}

function writeCollection(collection, data) {
  const filePath = getFilePath(collection);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Fehler beim Schreiben von ${collection}:`, error);
    throw error;
  }
}

// Initialisiere die Datenbank
export async function initDatabase() {
  console.log("📦 JSON-Datenbank initialisiert:", dataDir);
  return true;
}

// ========== MODULES ==========
export const modulesDB = {
  getAll: () => {
    return readCollection("modules").sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getById: (id) => {
    const modules = readCollection("modules");
    return modules.find((m) => m.id === id) || null;
  },

  create: (module) => {
    const modules = readCollection("modules");
    modules.push(module);
    writeCollection("modules", modules);
    return module;
  },

  update: (id, data) => {
    const modules = readCollection("modules");
    const index = modules.findIndex((m) => m.id === id);
    if (index !== -1) {
      modules[index] = { ...modules[index], ...data };
      writeCollection("modules", modules);
      return modules[index];
    }
    return null;
  },

  delete: (id) => {
    let modules = readCollection("modules");
    modules = modules.filter((m) => m.id !== id);
    writeCollection("modules", modules);
    return { success: true };
  },
};

// ========== SCRIPTS ==========
export const scriptsDB = {
  getAll: () => {
    return readCollection("scripts").sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  },

  getByModuleId: (moduleId) => {
    return scriptsDB.getAll().filter((s) => s.moduleId === moduleId);
  },

  getById: (id) => {
    const scripts = readCollection("scripts");
    return scripts.find((s) => s.id === id) || null;
  },

  create: (script) => {
    const scripts = readCollection("scripts");
    scripts.push(script);
    writeCollection("scripts", scripts);
    return script;
  },

  delete: (id) => {
    let scripts = readCollection("scripts");
    scripts = scripts.filter((s) => s.id !== id);
    writeCollection("scripts", scripts);
    return { success: true };
  },
};

// ========== NOTES ==========
export const notesDB = {
  getAll: () => {
    return readCollection("notes").sort(
      (a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  },

  getByModuleId: (moduleId) => {
    return notesDB.getAll().filter((n) => n.moduleId === moduleId);
  },

  getById: (id) => {
    const notes = readCollection("notes");
    return notes.find((n) => n.id === id) || null;
  },

  create: (note) => {
    const notes = readCollection("notes");
    notes.push(note);
    writeCollection("notes", notes);
    return note;
  },

  delete: (id) => {
    let notes = readCollection("notes");
    notes = notes.filter((n) => n.id !== id);
    writeCollection("notes", notes);
    return { success: true };
  },
};

// ========== TASKS ==========
export const tasksDB = {
  getAll: () => {
    return readCollection("tasks").sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getByModuleId: (moduleId) => {
    return tasksDB.getAll().filter((t) => t.moduleId === moduleId);
  },

  getById: (id) => {
    const tasks = readCollection("tasks");
    return tasks.find((t) => t.id === id) || null;
  },

  create: (task) => {
    const tasks = readCollection("tasks");
    tasks.push(task);
    writeCollection("tasks", tasks);
    return task;
  },

  update: (id, data) => {
    const tasks = readCollection("tasks");
    const index = tasks.findIndex((t) => t.id === id);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...data };
      writeCollection("tasks", tasks);
      return tasks[index];
    }
    return null;
  },

  delete: (id) => {
    let tasks = readCollection("tasks");
    tasks = tasks.filter((t) => t.id !== id);
    writeCollection("tasks", tasks);
    return { success: true };
  },
};

// ========== FLASHCARDS ==========
export const flashcardsDB = {
  getAll: () => {
    return readCollection("flashcards").sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getByModuleId: (moduleId) => {
    return flashcardsDB.getAll().filter((f) => f.moduleId === moduleId);
  },

  getById: (id) => {
    const flashcards = readCollection("flashcards");
    return flashcards.find((f) => f.id === id) || null;
  },

  create: (flashcard) => {
    const flashcards = readCollection("flashcards");
    flashcards.push(flashcard);
    writeCollection("flashcards", flashcards);
    return flashcard;
  },

  update: (id, data) => {
    const flashcards = readCollection("flashcards");
    const index = flashcards.findIndex((f) => f.id === id);
    if (index !== -1) {
      flashcards[index] = { ...flashcards[index], ...data };
      writeCollection("flashcards", flashcards);
      return flashcards[index];
    }
    return null;
  },

  delete: (id) => {
    let flashcards = readCollection("flashcards");
    flashcards = flashcards.filter((f) => f.id !== id);
    writeCollection("flashcards", flashcards);
    return { success: true };
  },
};

export default {
  initDatabase,
  modulesDB,
  scriptsDB,
  notesDB,
  tasksDB,
  flashcardsDB,
};
