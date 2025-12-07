import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Timer, UsersThree, Alarm } from '@phosphor-icons/react'

interface StudyRoomHUDProps {
  roomCode?: string
  roundIndex?: number
  mode?: string
  timeLabel?: string
  submitted?: number
  members?: number
  votes?: number
  onVote?: () => void
  onGoLobby?: () => void
  lockCountdown?: number | null
}

export function StudyRoomHUD({
  roomCode,
  roundIndex,
  mode,
  timeLabel,
  submitted,
  members,
  votes,
  onVote,
  onGoLobby,
  lockCountdown,
}: StudyRoomHUDProps) {
  return (
    <div className="w-full bg-card/80 border-b shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="flex items-center gap-1">
          <UsersThree size={14} />
          Room {roomCode || '-'}
        </Badge>
        <Badge variant="secondary">
          Runde #{roundIndex || '-'} • {mode || '-'}
        </Badge>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 flex items-center gap-1">
          <Timer size={14} />
          {timeLabel || '00:00'}
        </Badge>
        <Badge variant="outline">
          Submits {submitted ?? 0}/{members ?? 0}
        </Badge>
        <Badge variant="outline">
          Votes {votes ?? 0}/{members ?? 0}
        </Badge>
        {lockCountdown !== null && lockCountdown !== undefined && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Alarm size={14} />
            Ende in {lockCountdown}s
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onVote && (
            <Button size="sm" variant="outline" onClick={onVote}>
              Zeit verlängern
            </Button>
          )}
          {onGoLobby && (
            <Button size="sm" variant="ghost" onClick={onGoLobby}>
              Lobby
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
