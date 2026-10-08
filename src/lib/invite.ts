import type { Room } from '@/types'
import { defaultRoomSettings } from '@/lib/defaults'

const INVITE_URL_PARAMS = ['name', 'hostId', 'hostName', 'code', 'desc', 'approval', 'max', 'visibility', 'bg'] as const

/**
 * Builds a shareable room link. Because there is no server, the link carries
 * everything a brand-new device needs to render the pre-join screen before
 * the WebRTC handshake starts.
 */
export function buildInviteLink(room: Room): string {
  const url = new URL(window.location.href)
  url.search = ''
  const params = new URLSearchParams()
  params.set('name', room.name)
  params.set('hostId', room.hostId)
  params.set('hostName', room.hostName)
  params.set('code', room.code)
  if (room.description) params.set('desc', room.description)
  if (room.settings.access.requireApproval) params.set('approval', '1')
  params.set('max', String(room.settings.participants.maxParticipants))
  params.set('visibility', room.visibility)
  params.set('bg', room.settings.appearance.background)
  url.hash = `/room/${room.id}?${params.toString()}`
  return url.toString()
}

export function hasInviteParams(search: URLSearchParams): boolean {
  return search.has('hostId') && search.has('name')
}

export function roomFromInviteParams(roomId: string, search: URLSearchParams): Room | null {
  if (!hasInviteParams(search)) return null
  const hostId = search.get('hostId') ?? ''
  const name = search.get('name') ?? ''
  const settings = defaultRoomSettings()
  settings.general.name = name
  const description = search.get('desc')
  if (description) settings.general.description = description
  settings.access.requireApproval = search.get('approval') === '1'
  const max = Number(search.get('max'))
  if (Number.isFinite(max) && max > 0) settings.participants.maxParticipants = max
  const bg = search.get('bg')
  if (bg === 'grid' || bg === 'aurora' || bg === 'solid' || bg === 'default') {
    settings.appearance.background = bg
  }
  return {
    id: roomId,
    code: search.get('code') ?? '',
    name,
    description: settings.general.description,
    hostId,
    hostName: search.get('hostName') ?? name,
    visibility: search.get('visibility') === 'public' ? 'public' : 'private',
    status: 'idle',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    participantCount: 1,
    settings,
    tags: [],
  }
}

export function stripInviteParams(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search)
  for (const key of INVITE_URL_PARAMS) next.delete(key)
  return next
}