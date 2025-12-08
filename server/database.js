import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCollectionDB, sortByDateDesc } from "./db-utils.js";

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

// Shared DB utilities for all collections
const dbOptions = { getFilePath, readCollection, writeCollection };

// ========== MODULES ==========
export const modulesDB = createCollectionDB("modules", {
  ...dbOptions,
  sortFn: sortByDateDesc("createdAt"),
});

// ========== SCRIPTS ==========
export const scriptsDB = createCollectionDB("scripts", {
  ...dbOptions,
  sortFn: sortByDateDesc("uploadedAt"),
});

// ========== NOTES ==========
export const notesDB = createCollectionDB("notes", {
  ...dbOptions,
  sortFn: sortByDateDesc("generatedAt"),
});

// ========== TASKS ==========
export const tasksDB = createCollectionDB("tasks", {
  ...dbOptions,
  sortFn: sortByDateDesc("createdAt"),
});

// ========== FLASHCARDS ==========
export const flashcardsDB = createCollectionDB("flashcards", {
  ...dbOptions,
  sortFn: sortByDateDesc("createdAt"),
});

export default {
  initDatabase,
  modulesDB,
  scriptsDB,
  notesDB,
  tasksDB,
  flashcardsDB,
};
