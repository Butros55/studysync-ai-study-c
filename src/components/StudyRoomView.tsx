import { useEffect, useMemo, useState } from 'react'
import {
  StudyRoom,
  StudyRoomMode,
  StudyRoomRound,
  StudyRoomSubmission,
} from '@/lib/types'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Progress } from './ui/progress'
import {
  ArrowLeft,
  Clock,
  Crown,
  ListChecks,
  RocketLaunch,
  Timer,
  Users,
  Lightning,
  ChartLineUp,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface StudyRoomViewProps {
  room: StudyRoom
  currentUserId: string
  moduleName?: string
  isSyncing?: boolean
  onLeave: () => void
  onToggleReady: (ready: boolean) => Promise<void> | void
  onStartRound: (mode: StudyRoomMode) => Promise<void> | void
  onVoteExtension: () => Promise<void> | void
  onOpenTask: () => void
  onEndRound: () => Promise<void> | void
  onRefresh?: () => void
  onUnsubmit?: () => void
}

function useRoundCountdown(round?: StudyRoomRound) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [round?.id])

  if (!round?.endsAt) return { remainingMs: 0, progress: 0 }

  const endMs = new Date(round.endsAt).getTime()
  const startMs = new Date(round.startedAt).getTime()
  const totalMs = Math.max(1, endMs - startMs)
  const remainingMs = Math.max(0, endMs - now)
  const elapsedMs = Math.min(totalMs, totalMs - remainingMs)
  const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))

  return { remainingMs, progress }
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function StudyRoomView({
  room,
  currentUserId,
  moduleName,
  isSyncing = false,
  onLeave,
  onToggleReady,
  onStartRound,
  onVoteExtension,
  onOpenTask,
  onEndRound,
  onRefresh,
  onUnsubmit,
}: StudyRoomViewProps) {
  const me = room.members.find((m) => m.userId === currentUserId)
  const isHost = room.host.userId === currentUserId
  const readyCount = room.members.filter((m) => m.ready).length
  const currentRound = room.currentRound
  const [startCountdown, setStartCountdown] = useState<number>(0)
  const [lockCountdown, setLockCountdown] = useState<number | null>(null)
  const { remainingMs, progress } = useRoundCountdown(currentRound)

  const scoreboard = useMemo(() => {
    const entries = Object.entries(room.scoreboard || {}).map(([userId, points]) => {
      const member = room.members.find((m) => m.userId === userId)
      return { userId, points, nickname: member?.nickname || 'Unbekannt' }
    })
    return entries.sort((a, b) => b.points - a.points)
  }, [room.members, room.scoreboard])

  const submissions = useMemo<StudyRoomSubmission[]>(() => {
    if (!currentRound) return []
    return [...currentRound.submissions].sort((a, b) => {
      const aTime = a.timeMs || Number.MAX_SAFE_INTEGER
      const bTime = b.timeMs || Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
  }, [currentRound])

  const canStartChallenge =
    isHost && room.members.length >= 2 && readyCount === room.members.length
  const canStartCollab = isHost && room.members.length >= 1

  useEffect(() => {
    if (!currentRound) return
    const tick = () => {
      if (currentRound.phase === 'starting' && currentRound.startsAt) {
        const diff = Math.max(
          0,
          Math.ceil((new Date(currentRound.startsAt).getTime() - Date.now()) / 1000)
        )
        setStartCountdown(diff)
      } else {
        setStartCountdown(0)
      }
      if (currentRound.lockCountdownStartAt) {
        const diff = 5000 - (Date.now() - new Date(currentRound.lockCountdownStartAt).getTime())
        setLockCountdown(diff > 0 ? Math.ceil(diff / 1000) : 0)
      } else {
        setLockCountdown(null)
      }
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [currentRound?.id, currentRound?.phase, currentRound?.startsAt])

  // TODO: replace polling trigger with realtime once backend supports WS/SSE

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {currentRound?.phase === 'starting' && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center text-white text-6xl font-bold">
          {startCountdown > 0 ? startCountdown : 0}
        </div>
      )}
      {currentRound?.phase === 'ending' && (
        <div className="fixed inset-0 z-50 bg-red-900/70 flex items-center justify-center text-white text-4xl font-bold">
          Runde endet...
        </div>
      )}
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onLeave} className="h-9 w-9">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Lerngruppe</h1>
                <Badge variant="outline" className="text-lg tracking-widest">
                  {room.code}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Modul: {moduleName || room.moduleId} {room.topic ? `• Thema: ${room.topic}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={room.state === 'running' ? 'default' : 'outline'}>
              {room.state === 'running' ? 'Aktiv' : 'Lobby'}
            </Badge>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isSyncing}>
              Sync {isSyncing ? '…' : ''}
            </Button>
            <Button variant="destructive" size="sm" onClick={onLeave}>
              Raum verlassen
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Users size={18} /> Mitglieder
              </CardTitle>
              <CardDescription>
                {readyCount}/{room.members.length} bereit • Host: {room.host.nickname}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {room.members.map((member) => (
                  <div
                    key={member.userId}
                    className={cn(
                      'border rounded-lg px-3 py-2 flex items-center justify-between',
                      member.userId === currentUserId ? 'border-primary/50 bg-primary/5' : 'border-border'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {room.host.userId === member.userId && (
                        <Crown size={16} className="text-amber-500" weight="fill" />
                      )}
                      <div>
                        <p className="font-medium">{member.nickname}</p>
                        <p className="text-xs text-muted-foreground">{member.status}</p>
                      </div>
                    </div>
                    <Badge variant={member.ready ? 'default' : 'outline'}>
                      {member.ready ? 'Ready' : 'Wartet'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={me?.ready ? 'secondary' : 'default'}
                  onClick={() => onToggleReady(!me?.ready)}
                >
                  <ListChecks size={16} className="mr-2" />
                  {me?.ready ? 'Nicht bereit' : 'Bereit melden'}
                </Button>
                {isHost && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStartRound('collab')}
                      disabled={!canStartCollab}
                    >
                      <RocketLaunch size={16} className="mr-2" />
                      Runde starten (Collab)
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onStartRound('challenge')}
                      disabled={!canStartChallenge}
                    >
                      <Lightning size={16} className="mr-2" />
                      Challenge starten
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Challenge erfordert aktuell, dass alle Spieler bereit sind. Collab kann sofort starten.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartLineUp size={18} />
                Scoreboard
              </CardTitle>
              <CardDescription>Punkte aus Challenge-Runden</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {scoreboard.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine Punkte vergeben.</p>
              )}
              {scoreboard.map((entry, idx) => (
                <div
                  key={entry.userId}
                  className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2',
                    idx === 0 ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {idx === 0 ? <Crown size={16} className="text-amber-500" /> : <span className="text-xs w-5 text-center">{idx + 1}</span>}
                    <span className="font-medium truncate">{entry.nickname}</span>
                  </div>
                  <span className="text-sm font-semibold">{entry.points} pts</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer size={18} />
                {currentRound ? `Runde #${currentRound.roundIndex} (${currentRound.mode})` : 'Keine laufende Runde'}
              </CardTitle>
              <CardDescription>
                {currentRound
                  ? `Gestartet ${new Date(currentRound.startedAt).toLocaleTimeString()}`
                  : 'Host kann eine Runde starten'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentRound ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline">{currentRound.task.topic || 'Allgemein'}</Badge>
                    <Badge variant="secondary">{currentRound.task.difficulty}</Badge>
                    <Badge variant={currentRound.state === 'running' ? 'default' : 'outline'}>
                      {currentRound.state === 'running' ? 'Läuft' : 'Beendet'}
                    </Badge>
                  </div>
                  {currentRound.endsAt && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} />
                        <span>Countdown: {formatTime(remainingMs)}</span>
                        {currentRound.extended && (
                          <Badge variant="outline" className="ml-2">+{currentRound.extendedTimeSec || 0}s</Badge>
                        )}
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button size="sm" onClick={onOpenTask} disabled={startCountdown > 0 || currentRound.phase === 'review'}>
                      {startCountdown > 0 ? `Start in ${startCountdown}` : 'Aufgabe öffnen'}
                    </Button>
                    {currentRound.mode === 'challenge' && currentRound.state === 'running' && (
                      <Button size="sm" variant="outline" onClick={onVoteExtension} disabled={currentRound.extended}>
                        Zeit verlängern vorschlagen ({currentRound.extensionVotes.length}/{room.members.length})
                      </Button>
                    )}
                    {isHost && currentRound.state === 'running' && (
                      <Button size="sm" variant="secondary" onClick={onEndRound}>
                        Runde beenden
                      </Button>
                    )}
                    {lockCountdown !== null && (
                      <Badge variant="destructive">Endet in {lockCountdown}s</Badge>
                    )}
                    {me?.status === 'submitted' && onUnsubmit && currentRound.phase === 'running' && (
                      <Button size="sm" variant="outline" onClick={onUnsubmit}>
                        Antwort bearbeiten
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="bg-muted/40">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <RocketLaunch size={16} /> Aufgabe
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Alle Spieler sehen dieselbe Aufgabe
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <p className="font-medium">{currentRound.task.question}</p>
                        <p className="text-muted-foreground text-xs">
                          Lösungsvorschau wird nicht gespeichert (nur kurzer Preview).
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/40">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <ListChecks size={16} /> Abgaben
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {submissions.length}/{room.members.length} abgegeben
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {submissions.length === 0 && (
                          <p className="text-sm text-muted-foreground">Noch keine Abgaben.</p>
                        )}
                        {submissions.slice(0, 6).map((sub) => {
                          const member = room.members.find((m) => m.userId === sub.userId)
                          return (
                            <div key={sub.userId} className="text-sm flex items-center justify-between">
                              <span className="truncate">{member?.nickname || sub.userId}</span>
                              <span className="text-xs text-muted-foreground">
                                {sub.isCorrect === undefined ? 'ausstehend' : sub.isCorrect ? 'korrekt' : 'falsch'}
                              </span>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  </div>
                  {currentRound.phase === 'review' && (
                    <Card className="bg-green-500/5 border-green-500/40">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-semibold">Review & Punkte</CardTitle>
                        <CardDescription>
                          {currentRound.evaluation?.status === 'pending'
                            ? 'Auswertung läuft...'
                            : 'Auswertung abgeschlossen'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {currentRound.evaluation?.result?.summaryMarkdown ? (
                          <div className="text-muted-foreground whitespace-pre-wrap">
                            {currentRound.evaluation.result.summaryMarkdown}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">Warten auf Auswertung...</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Warte auf den Host, um eine neue Runde zu starten.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
