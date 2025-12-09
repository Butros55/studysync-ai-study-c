import express from "express";
import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { finished } from "stream/promises";

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MiB
const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB hard cap per request

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHARED_BACKUP_PATH = path.join(__dirname, "shared-backup.json");
const TMP_ROOT = path.join(__dirname, "data", "tmp", "shared-backup");

const router = express.Router();

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function generateUploadId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveUploadDir(uploadId) {
  return path.join(TMP_ROOT, uploadId);
}

function resolveMetaPath(uploadId) {
  return path.join(resolveUploadDir(uploadId), "meta.json");
}

function resolvePartPath(uploadId, index) {
  const padded = String(index).padStart(5, "0");
  return path.join(resolveUploadDir(uploadId), `part-${padded}`);
}

async function loadMeta(uploadId) {
  const metaPath = resolveMetaPath(uploadId);
  const raw = await fs.readFile(metaPath, "utf-8");
  return JSON.parse(raw);
}

async function persistMeta(uploadId, meta) {
  const metaPath = resolveMetaPath(uploadId);
  await ensureDir(path.dirname(metaPath));
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

async function cheapJsonSanityCheck(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const stats = await handle.stat();
    if (!stats.size) return false;

    const headBuffer = Buffer.alloc(Math.min(2048, stats.size));
    await handle.read(headBuffer, 0, headBuffer.length, 0);
    const tailLength = Math.min(2048, stats.size);
    const tailBuffer = Buffer.alloc(tailLength);
    await handle.read(tailBuffer, 0, tailLength, Math.max(0, stats.size - tailLength));

    const headChar = String(headBuffer)
      .trimStart()
      .charAt(0);
    const tailChar = String(tailBuffer)
      .trimEnd()
      .slice(-1);

    const headValid = headChar === "{" || headChar === "[";
    const tailValid = tailChar === "}" || tailChar === "]";
    return headValid && tailValid;
  } finally {
    await handle.close();
  }
}

async function appendFileToStream(partPath, targetStream) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(partPath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(targetStream, { end: false });
  });
}

router.post("/upload/init", async (_req, res) => {
  try {
    const uploadId = generateUploadId();
    const now = Date.now();
    const expiresAt = new Date(now + 1000 * 60 * 30).toISOString();
    const meta = {
      uploadId,
      chunkSizeBytes: DEFAULT_CHUNK_SIZE,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      totalChunks: null,
    };
    await persistMeta(uploadId, meta);

    res.json({
      uploadId,
      chunkSizeBytes: DEFAULT_CHUNK_SIZE,
      expiresAt,
    });
  } catch (error) {
    console.error("[SharedBackup] init failed", error);
    res.status(500).json({ error: "Upload-Initialisierung fehlgeschlagen" });
  }
});

router.post(
  "/upload/chunk",
  express.raw({ type: "application/octet-stream", limit: `${Math.ceil(MAX_CHUNK_SIZE / (1024 * 1024))}mb` }),
  async (req, res) => {
    const { uploadId, index, total } = req.query;

    if (!uploadId || index === undefined || total === undefined) {
      return res.status(400).json({ error: "uploadId, index und total sind erforderlich" });
    }

    const chunkIndex = Number(index);
    const totalChunks = Number(total);

    if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
      return res.status(400).json({ error: "Ungültige Chunk-Metadaten" });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: "Chunk-Payload fehlt" });
    }

    if (req.body.length > MAX_CHUNK_SIZE) {
      return res.status(413).json({ error: "Chunk zu groß" });
    }

    try {
      const metaPath = resolveMetaPath(uploadId);
      let meta;
      try {
        meta = await loadMeta(uploadId);
      } catch {
        meta = {
          uploadId,
          chunkSizeBytes: DEFAULT_CHUNK_SIZE,
          createdAt: new Date().toISOString(),
          expiresAt: null,
          totalChunks: null,
        };
      }

      if (meta.totalChunks != null && meta.totalChunks !== totalChunks) {
        return res.status(409).json({ error: "total stimmt nicht mit bestehendem Upload überein" });
      }

      meta.totalChunks = totalChunks;
      await persistMeta(uploadId, meta);

      const uploadDir = resolveUploadDir(uploadId);
      await ensureDir(uploadDir);
      const partPath = resolvePartPath(uploadId, chunkIndex);
      await fs.writeFile(partPath, req.body);

      res.json({ ok: true, uploadId, received: chunkIndex });
    } catch (error) {
      console.error("[SharedBackup] chunk failed", error);
      res.status(500).json({ error: "Chunk konnte nicht gespeichert werden" });
    }
  }
);

router.post("/upload/complete", async (req, res) => {
  const { uploadId } = req.query;
  const totalRaw = req.query.total;

  if (!uploadId) {
    return res.status(400).json({ error: "uploadId ist erforderlich" });
  }

  try {
    const meta = await loadMeta(uploadId);
    const totalChunks = meta.totalChunks ?? (totalRaw ? Number(totalRaw) : null);

    if (!Number.isInteger(totalChunks) || totalChunks < 1) {
      return res.status(400).json({ error: "totalChunks fehlen" });
    }

    const uploadDir = resolveUploadDir(uploadId);
    const partFiles = await fs.readdir(uploadDir);
    const expectedParts = Array.from({ length: totalChunks }, (_, i) => `part-${String(i).padStart(5, "0")}`);
    const missing = expectedParts.filter((p) => !partFiles.includes(p));

    if (missing.length > 0) {
      return res.status(400).json({ error: "Es fehlen Chunks", missing });
    }

    await ensureDir(path.dirname(SHARED_BACKUP_PATH));
    const writeStream = createWriteStream(SHARED_BACKUP_PATH);

    for (let i = 0; i < totalChunks; i++) {
      const partPath = resolvePartPath(uploadId, i);
      await appendFileToStream(partPath, writeStream);
    }

    writeStream.end();
    await finished(writeStream);

    const isJsonLike = await cheapJsonSanityCheck(SHARED_BACKUP_PATH);
    if (!isJsonLike) {
      await fs.rm(SHARED_BACKUP_PATH, { force: true });
      return res.status(400).json({ error: "Backup-Datei sieht nicht wie JSON aus" });
    }

    const stats = await fs.stat(SHARED_BACKUP_PATH);
    await fs.rm(uploadDir, { recursive: true, force: true });

    res.json({ ok: true, saved: true, sizeBytes: stats.size });
  } catch (error) {
    console.error("[SharedBackup] complete failed", error);
    res.status(500).json({ error: "Upload konnte nicht finalisiert werden" });
  }
});

router.post("/upload/abort", async (req, res) => {
  const { uploadId } = req.query;
  if (!uploadId) {
    return res.status(400).json({ error: "uploadId ist erforderlich" });
  }

  try {
    await fs.rm(resolveUploadDir(uploadId), { recursive: true, force: true });
    res.json({ ok: true, aborted: true });
  } catch (error) {
    console.error("[SharedBackup] abort failed", error);
    res.status(500).json({ error: "Abort fehlgeschlagen" });
  }
});

router.get("/", async (_req, res) => {
  try {
    await fs.access(SHARED_BACKUP_PATH);
    res.setHeader("Content-Type", "application/json");
    res.write("{\"backup\":");

    const readStream = createReadStream(SHARED_BACKUP_PATH);
    readStream.on("error", (err) => {
      console.error("[SharedBackup] read stream failed", err);
      if (!res.headersSent) {
        res.status(500);
      }
      res.end();
    });
    readStream.on("end", () => {
      res.write("}");
      res.end();
    });
    readStream.pipe(res, { end: false });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return res.status(404).json({ error: "Kein Server-Backup vorhanden" });
    }
    console.error("[SharedBackup] get failed", error);
    res.status(500).json({ error: "Backup konnte nicht gelesen werden" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Backup-Payload fehlt" });
    }

    const serialized = JSON.stringify(req.body);
    if (Buffer.byteLength(serialized, "utf-8") > MAX_CHUNK_SIZE) {
      return res.status(413).json({ error: "Backup zu groß, bitte Chunk-Upload nutzen" });
    }

    const payload = {
      ...req.body,
      savedAt: new Date().toISOString(),
    };

    if (!payload?.version || !payload?.data) {
      return res.status(400).json({ error: "Ungültiges Backup-Payload" });
    }

    await fs.writeFile(SHARED_BACKUP_PATH, JSON.stringify(payload, null, 2), "utf-8");
    res.json({ status: "saved", version: payload.version, exportedAt: payload.exportedAt });
  } catch (error) {
    console.error("[SharedBackup] small upload failed", error);
    res.status(500).json({ error: "Backup konnte nicht gespeichert werden" });
  }
});

export { router as sharedBackupRouter, SHARED_BACKUP_PATH };
