import { useMemo, useState } from 'react'
import { Check, Clock, Crown, Mic, MicOff, MoreVertical, Search, ShieldCheck, Trash, UserPlus, Users, WifiOff, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRoomSessionStore } from '@/stores/roomSession'
import { t, useT } from '@/lib/i18n'
import {
  acceptAllRequests,
  acceptRequest,
  grantParticipantPermissions,
  hostMuteParticipant,
  hostRemoveParticipant,
  hostTransferHost,
  rejectRequest,
} from '@/features/room/session/sessionController'
import type { ParticipantPermissions } from '@/types'

const COHOST_PERMISSIONS: ParticipantPermissions = {
  canShareScreen: true,
  canModerate: true,
  canManageRoom: true,
}

function hasPermission(participant: ParticipantPermissions | undefined, key: keyof ParticipantPermissions) {
  return Boolean(participant?.[key])
}

function isCoHost(participant: ParticipantPermissions | undefined) {
  return Boolean(participant && (participant.canShareScreen || participant.canModerate || participant.canManageRoom))
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return t('{seconds}s ago', { seconds })
  return t('{minutes}m ago', { minutes: Math.floor(seconds / 60) })
}

export function ParticipantsPanel() {
  const participants = useRoomSessionStore((state) => state.participants)
  const requests = useRoomSessionStore((state) => state.requests)
  const self = useRoomSessionStore((state) => state.self)
  const settings = useRoomSessionStore((state) => state.room?.settings)
  const t = useT()
  const [query, setQuery] = useState('')

  const isHost = self?.role === 'host'
  const canModerateSelf = isHost || Boolean(self?.permissions?.canModerate)
  const raisedHands = useMemo(
    () =>
      participants
        .filter((participant) => participant.handRaised)
        .sort((a, b) => (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0)),
    [participants],
  )

  function togglePermission(participantId: string, current: ParticipantPermissions | undefined, key: keyof ParticipantPermissions) {
    const next: ParticipantPermissions = { ...current }
    if (next[key]) delete next[key]
    else next[key] = true
    grantParticipantPermissions(participantId, next)
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return participants
    return participants.filter((participant) => participant.name.toLowerCase().includes(normalized))
  }, [participants, query])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isHost && requests.length > 0 ? (
        <div className="shrink-0 border-b border-line bg-warning-soft/40 px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[12.5px] font-medium text-warning">
              <Clock className="h-3.5 w-3.5" />
              {t('{count} pending requests', { count: requests.length })}
            </p>
            {requests.length > 1 ? (
              <button
                type="button"
                onClick={acceptAllRequests}
                className="text-[12.5px] font-medium text-accent underline-offset-4 hover:underline"
              >
                {t('Accept all')}
              </button>
            ) : null}
          </div>

          <div className="mt-2.5 space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5">
                <Avatar name={request.name} color={request.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">{request.name}</p>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                    {request.micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3 text-danger" />}
                    {request.cameraOn ? t('camera on') : t('camera off')} · {timeAgo(request.requestedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="ghost" aria-label={t('Decline {name}', { name: request.name })} onClick={() => rejectRequest(request.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" aria-label={t('Accept {name}', { name: request.name })} onClick={() => acceptRequest(request.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
          {t('In the room — {count}', { count: participants.length })}
        </p>
      </div>

      {participants.length > 8 ? (
        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search people…')}
              aria-label={t('Search participants')}
              className="h-9 pl-8 text-[13px]"
            />
          </div>
        </div>
      ) : null}

      {raisedHands.length > 0 ? (
        <div className="shrink-0 border-b border-line bg-warning-soft/40 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
            <span aria-hidden>✋</span>
            {raisedHands.length === 1
              ? t('1 hand raised')
              : t('{count} hands raised', { count: raisedHands.length })}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {raisedHands.map((participant, index) => (
              <span
                key={participant.id}
                className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-warning/30 bg-surface px-2 py-0.5 text-[11.5px] text-ink"
              >
                <span className="font-mono text-warning">{index + 1}</span>
                {participant.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto nx-scroll px-2 pb-3">
        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title={t('Nobody matches')} description={t('Try another name.')} />
        ) : (
          filtered.map((participant) => (
            <div
              key={participant.id}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
            >
              <div className="relative">
                <Avatar name={participant.name} color={participant.avatarColor} size="sm" />
                <span
                  className={
                    'absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-surface ring-2 ring-surface'
                  }
                >
                  {participant.micOn ? (
                    <Mic className="h-2.5 w-2.5 text-ink-subtle" />
                  ) : (
                    <MicOff className="h-2.5 w-2.5 text-danger" />
                  )}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-ink">
                  {participant.isSelf ? t('{name} (You)', { name: participant.name }) : participant.name}
                  {participant.role === 'host' ? <Crown className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
                </p>
                <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                  {participant.role === 'host' ? t('Host') : t('Guest')}
                  {participant.role !== 'host' && isCoHost(participant.permissions) ? ` · ${t('Co-host')}` : ''}
                  {participant.quality === 'poor' || participant.quality === 'fair' ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      · <WifiOff className="h-3 w-3" /> {t(participant.quality)}
                    </span>
                  ) : null}
                </p>
              </div>

              {!participant.isSelf && canModerateSelf && participant.role !== 'host' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('Actions for {name}', { name: participant.name })}
                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-subtle opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink focus:opacity-100 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{participant.name}</DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={!participant.micOn || settings?.participants.allowMuteOthers === false}
                      onSelect={() => hostMuteParticipant(participant.id)}
                    >
                      <MicOff className="h-4 w-4" />
                      {t('Mute')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => hostTransferHost(participant.id)}>
                      <ShieldCheck className="h-4 w-4" />
                      {t('Make host')}
                    </DropdownMenuItem>

                    {isHost ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            grantParticipantPermissions(
                              participant.id,
                              isCoHost(participant.permissions) ? {} : COHOST_PERMISSIONS,
                            )
                          }
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {isCoHost(participant.permissions) ? t('Remove co-host') : t('Make co-host')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => togglePermission(participant.id, participant.permissions, 'canShareScreen')}
                        >
                          {hasPermission(participant.permissions, 'canShareScreen') ? (
                            <Check className="h-4 w-4 text-accent" />
                          ) : (
                            <span className="h-4 w-4" />
                          )}
                          {t('Can share screen')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => togglePermission(participant.id, participant.permissions, 'canModerate')}
                        >
                          {hasPermission(participant.permissions, 'canModerate') ? (
                            <Check className="h-4 w-4 text-accent" />
                          ) : (
                            <span className="h-4 w-4" />
                          )}
                          {t('Can mute & remove')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => togglePermission(participant.id, participant.permissions, 'canManageRoom')}
                        >
                          {hasPermission(participant.permissions, 'canManageRoom') ? (
                            <Check className="h-4 w-4 text-accent" />
                          ) : (
                            <span className="h-4 w-4" />
                          )}
                          {t('Can manage room')}
                        </DropdownMenuItem>
                      </>
                    ) : null}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      disabled={settings?.participants.allowRemoveOthers === false}
                      onSelect={() => hostRemoveParticipant(participant.id)}
                    >
                      <Trash className="h-4 w-4" />
                      {t('Remove from room')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : participant.isSelf ? (
                <Badge variant="accent" className="shrink-0">
                  <UserPlus className="h-3 w-3" />
                  {t('You')}
                </Badge>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
