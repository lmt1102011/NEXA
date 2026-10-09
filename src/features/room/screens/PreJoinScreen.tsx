import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CheckCircle2, Loader2, Mic, MicOff, ShieldAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useSessionStore } from '@/stores/session'
import { useCallStore } from '@/stores/call'
import { mediaEngine } from '@/services/media/MediaEngine'
import { preparePreview, requestJoin, switchDevice, toggleCamera, toggleMic, nameTakenBy } from '@/features/room/session/sessionController'
import { useT } from '@/lib/i18n'

export default function PreJoinScreen() {
  const t = useT()
  const navigate = useNavigate()
  const room = useRoomSessionStore((state) => state.room)
  const nameTaken = useRoomSessionStore((state) => state.nameTaken)
  const setNameTaken = useRoomSessionStore((state) => state.setNameTaken)
  const displayName = useSessionStore((state) => state.displayName)
  const setSessionName = useSessionStore((state) => state.setName)

  const micOn = useCallStore((state) => state.micOn)
  const cameraOn = useCallStore((state) => state.cameraOn)
  const videoPermission = useCallStore((state) => state.videoPermission)
  const audioPermission = useCallStore((state) => state.audioPermission)
  const hasLocalVideo = useCallStore((state) => state.hasLocalVideo)
  const devices = useCallStore((state) => state.devices)
  const activeAudioId = useCallStore((state) => state.activeAudioId)
  const activeVideoId = useCallStore((state) => state.activeVideoId)

  const [name, setName] = useState(displayName)
  const [submitting, setSubmitting] = useState(false)
  const [preparing, setPreparing] = useState(true)
  const [cameraRetrying, setCameraRetrying] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const prepareStarted = useRef(false)

  useEffect(() => {
    if (prepareStarted.current) return
    prepareStarted.current = true
    void (async () => {
      await preparePreview(
        room?.settings.participants.defaultMic ?? true,
        room?.settings.participants.defaultCamera ?? true,
      )
      setPreparing(false)
    })()
  }, [room])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const stream = mediaEngine.getStream()
    video.srcObject = stream
    if (stream) void video.play().catch(() => undefined)
  }, [cameraOn, hasLocalVideo, preparing, videoPermission])

  if (!room) return null

  const requireApproval = room.settings.access.requireApproval
  const trimmed = name.trim()
  const emptyName = trimmed.length === 0
  const flaggedTaken =
    nameTaken && trimmed.length > 0 && trimmed.toLowerCase() === nameTaken.toLowerCase() ? nameTaken : null
  const clashFound = emptyName ? null : nameTakenBy(trimmed)
  const conflictName = flaggedTaken ?? clashFound
  const nameError = emptyName || conflictName !== null

  async function handleJoin() {
    if (nameError || submitting) return
    if (conflictName !== null) {
      setNameTaken(conflictName)
      return
    }
    setSubmitting(true)
    try {
      await requestJoin({ name: trimmed, micOn, cameraOn })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetryCamera() {
    setCameraRetrying(true)
    try {
      await preparePreview(audioPermission === 'granted', true)
    } finally {
      setCameraRetrying(false)
    }
  }

  const micOptions = [
    { value: '__default', label: t('System default microphone') },
    ...devices.audio.map((device) => ({ value: device.deviceId, label: device.label })),
  ]
  const camOptions = [
    { value: '__default', label: t('System default camera') },
    ...devices.video.map((device) => ({ value: device.deviceId, label: device.label })),
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-6">
        <Link to="/" className="text-[13px] text-ink-subtle transition-colors hover:text-ink">
          {t('NEXA Home')}
        </Link>
        <Badge variant="success">
          <LiveDot />
          {t('Room live')}
        </Badge>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={room.visibility === 'public' ? 'accent' : 'default'}>
              {room.visibility === 'public' ? t('Public room') : t('Private room')}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {room.code}
            </Badge>
          </div>

          <h1 className="mt-3 text-2xl font-semibold text-ink">{t('Join “{name}”', { name: room.name })}</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-subtle">
            {t('Hosted by {host} · {count} {people} inside', {
              host: room.hostName,
              count: room.participantCount,
              people: room.participantCount === 1 ? t('person') : t('people'),
            })}
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-md">
            <div className="relative aspect-video w-full overflow-hidden bg-[#0a0c12]">
              {videoPermission === 'denied' || videoPermission === 'unavailable' ? (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div>
                    <ShieldAlert className="mx-auto h-7 w-7 text-warning" />
                    <p className="mt-3 text-sm font-medium text-ink">
                      {videoPermission === 'denied' ? t('Camera access blocked') : t('No camera found')}
                    </p>
                    <p className="mx-auto mt-1.5 max-w-[320px] text-[12.5px] leading-relaxed text-ink-subtle">
                      {videoPermission === 'denied'
                        ? t('Allow camera access in your browser’s site settings, then try again. You can still join with audio.')
                        : t('You can still join with audio and your avatar.')}
                    </p>
                    {videoPermission === 'denied' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-4"
                        loading={cameraRetrying}
                        onClick={handleRetryCamera}
                      >
                        {t('Check again')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : cameraOn && hasLocalVideo ? (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="h-full w-full -scale-x-100 object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-3">
                    <Avatar name={name.trim() || 'You'} color="#7c74ff" size="2xl" />
                    <p className="text-[12.5px] text-ink-subtle">
                      {preparing ? t('Starting preview…') : cameraOn ? t('Starting camera…') : t('Camera is off')}
                    </p>
                  </div>
                </div>
              )}

              <span className="absolute left-3.5 top-3.5 rounded-lg bg-black/45 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur">
                {t('Your preview')}
              </span>

              <div className="absolute inset-x-0 bottom-3.5 flex items-center justify-center gap-2.5">
                <PreviewToggle
                  on={micOn}
                  onToggle={() => void toggleMic()}
                  onIcon={<Mic className="h-4.5 w-4.5" />}
                  offIcon={<MicOff className="h-4.5 w-4.5" />}
                  label={micOn ? t('Turn microphone off') : t('Turn microphone on')}
                />
                <PreviewToggle
                  on={cameraOn}
                  onToggle={() => void toggleCamera()}
                  onIcon={<Camera className="h-4.5 w-4.5" />}
                  offIcon={<CameraOff className="h-4.5 w-4.5" />}
                  label={cameraOn ? t('Turn camera off') : t('Turn camera on')}
                />
              </div>

              {preparing ? (
                <div className="absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-2.5 py-1 text-[11.5px] text-white backdrop-blur">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('Preparing devices')}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 border-t border-line p-4 sm:p-5">
              <div>
                <label htmlFor="prejoin-name" className="mb-1.5 block text-[13px] font-medium text-ink-muted">
                  {t('Your name')}
                </label>
                <input
                  id="prejoin-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setSessionName(event.target.value)
                    if (nameTaken) setNameTaken(null)
                  }}
                  maxLength={32}
                  placeholder={t('e.g. Tri')}
                  aria-invalid={nameError}
                  className={cn(
                    'h-10 w-full rounded-lg border bg-surface-2 px-3 text-sm text-ink shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-ink-subtle focus:outline-none focus:ring-2',
                    conflictName !== null
                      ? 'border-danger/60 focus:ring-danger/25'
                      : 'border-line focus:ring-accent/25',
                  )}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleJoin()
                  }}
                />
                <p className="mt-1.5 text-[12.5px] text-ink-subtle">
                  {emptyName ? (
                    <span className="text-danger">{t('Please enter a name to continue.')}</span>
                  ) : conflictName !== null ? (
                    <span className="font-medium text-danger">
                      {t('“{name}” is already used in this room. Please choose a different name.', { name: conflictName })}
                    </span>
                  ) : (
                    <>{t('You appear as “{name}” to everyone in the room.', { name: trimmed })}</>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DeviceSelect
                  label={t('Microphone')}
                  value={activeAudioId || '__default'}
                  options={micOptions}
                  disabled={audioPermission === 'denied'}
                  onChange={(value) => {
                    if (value !== '__default') void switchDevice('audio', value)
                  }}
                />
                <DeviceSelect
                  label={t('Camera')}
                  value={activeVideoId || '__default'}
                  options={camOptions}
                  disabled={videoPermission === 'denied'}
                  onChange={(value) => {
                    if (value !== '__default') void switchDevice('video', value)
                  }}
                />
              </div>

              <Button size="lg" className="w-full" onClick={() => void handleJoin()} loading={submitting} disabled={nameError}>
                <CheckCircle2 className="h-4 w-4" />
                {requireApproval ? t('Request to Join') : t('Join Room')}
              </Button>

              <p className="text-center text-[12.5px] text-ink-subtle">
                {requireApproval
                  ? t('The host approves new guests — you will wait in the waiting room first.')
                  : t('No approval needed — you will enter the room right away.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/rooms')}
            className="mx-auto mt-5 block text-[13px] text-ink-subtle underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {t('This is not the room I want')}
          </button>
        </div>
      </main>
    </div>
  )
}

function PreviewToggle({
  on,
  onToggle,
  onIcon,
  offIcon,
  label,
}: {
  on: boolean
  onToggle: () => void
  onIcon: React.ReactNode
  offIcon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={
        on
          ? 'grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/12 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
          : 'grid h-11 w-11 place-items-center rounded-full bg-danger-solid text-white shadow-md transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/60'
      }
    >
      {on ? onIcon : offIcon}
    </button>
  )
}

function DeviceSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink shadow-sm transition-[border-color] duration-150 hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
