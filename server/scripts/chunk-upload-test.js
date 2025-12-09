#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

const DEFAULT_BASE = 'http://localhost:3001'
const FIVE_MIB = 5 * 1024 * 1024
const TEN_MIB = 10 * 1024 * 1024

async function main() {
  const [filePath, baseArg, sizeArg] = process.argv.slice(2)
  if (!filePath) {
    console.error('Usage: node server/scripts/chunk-upload-test.js <file> [baseUrl] [chunkSizeBytes]')
    process.exit(1)
  }

  const baseUrl = baseArg || DEFAULT_BASE
  const requestedSize = sizeArg ? Number(sizeArg) : FIVE_MIB
  const chunkSize = Math.min(Math.max(requestedSize, FIVE_MIB), TEN_MIB)

  const absolutePath = path.resolve(filePath)
  const buffer = await fs.readFile(absolutePath)
  const blob = new Blob([buffer])

  console.log(`Uploading ${absolutePath} (${blob.size} bytes) to ${baseUrl} in chunks of ${chunkSize} bytes`)

  const initRes = await fetch(`${baseUrl}/api/shared-backup/upload/init`, { method: 'POST' })
  if (!initRes.ok) {
    throw new Error(`Init failed: ${initRes.status} ${await initRes.text()}`)
  }
  const initPayload = await initRes.json()
  const uploadId = initPayload.uploadId
  const serverChunkSize = initPayload.chunkSizeBytes || chunkSize
  const effectiveChunkSize = Math.min(Math.max(serverChunkSize, FIVE_MIB), TEN_MIB)
  const total = Math.ceil(blob.size / effectiveChunkSize)

  console.log(`Upload ID: ${uploadId}, server chunk size: ${effectiveChunkSize}, total chunks: ${total}`)

  for (let i = 0; i < total; i++) {
    const start = i * effectiveChunkSize
    const end = Math.min(start + effectiveChunkSize, blob.size)
    const chunk = blob.slice(start, end)

    const res = await fetch(
      `${baseUrl}/api/shared-backup/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&index=${i}&total=${total}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      }
    )

    if (!res.ok) {
      throw new Error(`Chunk ${i + 1}/${total} failed: ${res.status} ${await res.text()}`)
    }

    console.log(`Chunk ${i + 1}/${total} (${chunk.size} bytes) uploaded`)
  }

  const completeRes = await fetch(
    `${baseUrl}/api/shared-backup/upload/complete?uploadId=${encodeURIComponent(uploadId)}&total=${total}`,
    { method: 'POST' }
  )

  if (!completeRes.ok) {
    throw new Error(`Complete failed: ${completeRes.status} ${await completeRes.text()}`)
  }

  const result = await completeRes.json()
  console.log('Upload complete:', result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
