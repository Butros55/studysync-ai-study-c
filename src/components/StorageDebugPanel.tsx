/**
 * Storage Debug Panel
 * 
 * Zeigt Storage-Status, Backend-Typ und Diagnostik-Informationen an.
 * Hilfreich für Debugging auf verschiedenen Geräten (Desktop, iOS, etc.)
 */

import { useState, useEffect } from 'react'
import { 
  getStorageStatus, 
  requestPersistentStorage,
  type StorageStatus 
} from '@/lib/storage'
import { 
  exportAllData, 
  importAllData, 
  clearAllData,
  type BackupData 
} from '@/hooks/use-database'
import { downloadSharedBackupFromServer, uploadSharedBackupToServer } from '@/lib/shared-backup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Database, 
  HardDrive, 
  Cloud, 
  CheckCircle, 
  XCircle, 
  Warning,
  DownloadSimple,
  UploadSimple,
  Trash,
  ArrowsClockwise
} from '@phosphor-icons/react'

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'N/A'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface StorageDebugPanelProps {
  onRefresh?: () => void
}

export function StorageDebugPanel({ onRefresh }: StorageDebugPanelProps) {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const s = await getStorageStatus()
      setStatus(s)
    } catch (e) {
      console.error('Failed to get storage status:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleRequestPersistent = async () => {
    setActionLoading('persist')
    try {
      await requestPersistentStorage()
      await loadStatus()
    } finally {
      setActionLoading(null)
    }
  }

  const handleExport = async () => {
    setActionLoading('export')
    try {
      const data = await exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `studysync-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
      alert('Export fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setActionLoading(null)
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      setActionLoading('import')
      try {
        const text = await file.text()
        const data = JSON.parse(text) as BackupData
        await importAllData(data)
        alert('Import erfolgreich! Die Seite wird neu geladen.')
        window.location.reload()
      } catch (e) {
        console.error('Import failed:', e)
        alert('Import fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
      } finally {
        setActionLoading(null)
      }
    }
    input.click()
  }

  const handleUploadSharedBackup = async () => {
    setActionLoading('upload-shared')
    setLastSyncMessage(null)
    try {
      const result = await uploadSharedBackupToServer()
      setLastSyncMessage(`Server-Backup gespeichert (Version ${result.version || 'n/a'})`)
    } catch (e) {
      console.error('Shared backup upload failed:', e)
      alert('Server-Backup fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDownloadSharedBackup = async () => {
    setActionLoading('download-shared')
    setLastSyncMessage(null)
    try {
      const { counts } = await downloadSharedBackupFromServer()
      const total = Object.values(counts || {}).reduce((sum, c) => sum + (c || 0), 0)
      setLastSyncMessage(`Server-Backup geladen und gemergt (${total} Elemente berücksichtigt)`)
      alert('Server-Backup geladen. Deine persönlichen Fortschritte wurden beibehalten.')
      window.location.reload()
    } catch (e) {
      console.error('Shared backup download failed:', e)
      alert('Server-Backup laden fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setActionLoading(null)
    }
  }

  const handleClear = async () => {
    if (!confirm('Wirklich ALLE Daten löschen? Dies kann nicht rückgängig gemacht werden!')) {
      return
    }
    
    setActionLoading('clear')
    try {
      await clearAllData()
      alert('Alle Daten gelöscht. Die Seite wird neu geladen.')
      window.location.reload()
    } catch (e) {
      console.error('Clear failed:', e)
      alert('Löschen fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setActionLoading(null)
    }
  }

  const getBackendIcon = () => {
    if (!status) return <Database className="h-5 w-5" />
    switch (status.backend) {
      case 'indexeddb':
        return <Database className="h-5 w-5 text-green-500" />
      case 'localstorage':
        return <HardDrive className="h-5 w-5 text-yellow-500" />
      case 'memory':
        return <Cloud className="h-5 w-5 text-red-500" />
    }
  }

  const getBackendLabel = () => {
    if (!status) return 'Laden...'
    switch (status.backend) {
      case 'indexeddb':
        return 'IndexedDB'
      case 'localstorage':
        return 'localStorage'
      case 'memory':
        return 'In-Memory (temporär!)'
    }
  }

  const getBackendVariant = (): 'default' | 'secondary' | 'destructive' => {
    if (!status) return 'secondary'
    switch (status.backend) {
      case 'indexeddb':
        return 'default'
      case 'localstorage':
        return 'secondary'
      case 'memory':
        return 'destructive'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowsClockwise className="h-4 w-4 animate-spin" />
            Storage-Status wird geladen...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {getBackendIcon()}
          Storage-Diagnostik
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backend Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Aktives Backend:</span>
            <Badge variant={getBackendVariant()}>
              {getBackendLabel()}
            </Badge>
          </div>

          {status?.backend === 'memory' && (
            <div className="p-2 bg-destructive/10 rounded-md text-sm text-destructive">
              ⚠️ Daten werden nur temporär gespeichert und gehen beim Schließen verloren!
            </div>
          )}
        </div>

        {/* Feature Detection */}
        <div className="space-y-1.5 text-sm">
          <div className="font-medium">Browser-Features:</div>
          
          <div className="flex items-center gap-2">
            {status?.indexedDBAvailable ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span>IndexedDB</span>
          </div>

          <div className="flex items-center gap-2">
            {status?.localStorageAvailable ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span>localStorage</span>
          </div>

          <div className="flex items-center gap-2">
            {status?.fileSystemAccessAvailable ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Warning className="h-4 w-4 text-yellow-500" />
            )}
            <span>File System Access API {!status?.fileSystemAccessAvailable && '(optional)'}</span>
          </div>

          <div className="flex items-center gap-2">
            {status?.persistentStorageAvailable ? (
              status?.persistentStorageGranted ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Warning className="h-4 w-4 text-yellow-500" />
              )
            ) : (
              <Warning className="h-4 w-4 text-yellow-500" />
            )}
            <span>
              Persistent Storage 
              {status?.persistentStorageGranted === true && ' (gewährt)'}
              {status?.persistentStorageGranted === false && ' (nicht gewährt)'}
              {status?.persistentStorageGranted === null && ' (unbekannt)'}
            </span>
          </div>
        </div>

        {/* Quota Info */}
        {(status?.estimatedQuota || status?.usedQuota) && (
          <div className="space-y-1 text-sm">
            <div className="font-medium">Speicherplatz:</div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Verwendet:</span>
              <span>{formatBytes(status?.usedQuota ?? null)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Verfügbar:</span>
              <span>{formatBytes(status?.estimatedQuota ?? null)}</span>
            </div>
            {status?.usedQuota && status?.estimatedQuota && (
              <div className="w-full bg-muted rounded-full h-2 mt-1">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (status.usedQuota / status.estimatedQuota) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Last Error */}
        {status?.lastError && (
          <div className="p-2 bg-destructive/10 rounded-md text-sm text-destructive">
            Letzter Fehler: {status.lastError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {status?.persistentStorageAvailable && !status?.persistentStorageGranted && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRequestPersistent}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'persist' ? (
                <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4 mr-1" />
              )}
              Persistent anfordern
            </Button>
          )}

          <Button 
            size="sm" 
            variant="outline"
            onClick={handleExport}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'export' ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <DownloadSimple className="h-4 w-4 mr-1" />
            )}
            Backup
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            onClick={handleImport}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'import' ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <UploadSimple className="h-4 w-4 mr-1" />
            )}
            Importieren
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleUploadSharedBackup}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'upload-shared' ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <UploadSimple className="h-4 w-4 mr-1" />
            )}
            Server-Backup hochladen
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadSharedBackup}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'download-shared' ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <DownloadSimple className="h-4 w-4 mr-1" />
            )}
            Server-Backup laden
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              loadStatus()
              onRefresh?.()
            }}
            disabled={actionLoading !== null}
          >
            <ArrowsClockwise className="h-4 w-4 mr-1" />
            Aktualisieren
          </Button>

          <Button 
            size="sm" 
            variant="destructive"
            onClick={handleClear}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'clear' ? (
              <ArrowsClockwise className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash className="h-4 w-4 mr-1" />
            )}
            Alles löschen
          </Button>
        </div>

        {lastSyncMessage && (
          <div className="text-sm text-muted-foreground">
            {lastSyncMessage}
          </div>
        )}

        {/* User Agent Info (for debugging) */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Browser-Info (für Support)
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto">
            {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}
