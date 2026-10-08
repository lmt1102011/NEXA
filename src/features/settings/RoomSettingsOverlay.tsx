import { useEffect } from 'react'
import {
  Lock,
  MessageSquare,
  PowerOff,
  Radio,
  ScreenShare,
  Shield,
  SlidersHorizontal,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Slider } from '@/components/ui/slider'
import { Segmented } from '@/components/ui/segmented'
import { ToggleRow } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRoomSessionStore } from '@/stores/roomSession'
import { applyHostSettings, hostEndRoom, hostToggleLock } from '@/features/room/session/sessionController'
import type { AudioQuality, VideoQuality } from '@/types'

const VIDEO_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '360p', label: '360p' },
  { value: '180p', label: '180p' },
]

const AUDIO_OPTIONS: { value: AudioQuality; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export default function RoomSettingsOverlay() {
  const navigate = useNavigate()
  const { roomId = '' } = useParams()
  const room = useRoomSessionStore((state) => state.room)
  const self = useRoomSessionStore((state) => state.self)
  const isHost = self?.role === 'host'

  useEffect(() => {
    if (!isHost && self) navigate(`/room/${roomId}`, { replace: true })
  }, [isHost, self, navigate, roomId])

  if (!room || !isHost) return null

  const settings = room.settings

  function close() {
    navigate(`/room/${roomId}`)
  }

  return (
    <div className="absolute inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close settings"
        onClick={close}
        className="absolute inset-0 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in"
      />

      <aside
        aria-label="Room settings"
        className="relative flex h-full w-[min(440px,100vw)] flex-col border-l border-line bg-surface shadow-xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">Room settings</h2>
            <p className="truncate text-[12px] text-ink-subtle">{room.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="hidden sm:inline-flex">
              Host
            </Badge>
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto nx-scroll px-4 py-5">
          <Section icon={<Radio className="h-3.5 w-3.5" />} title="General">
            <Field label="Room name">
              <input
                value={settings.general.name}
                onChange={(event) => applyHostSettings({ general: { name: event.target.value } })}
                maxLength={48}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-[13.5px] text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={settings.general.description}
                onChange={(event) => applyHostSettings({ general: { description: event.target.value } })}
                maxLength={140}
                rows={2}
                placeholder="What is this room about?"
                className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13.5px] text-ink shadow-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
            </Field>
            <Field label="Visibility">
              <Segmented
                ariaLabel="Room visibility"
                value={settings.general.visibility}
                onChange={(value) => applyHostSettings({ general: { visibility: value } })}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                size="sm"
                className="w-full"
              />
            </Field>
          </Section>

          <Section icon={<Shield className="h-3.5 w-3.5" />} title="Access">
            <ToggleRow
              label="Require approval"
              description="Guests wait in the waiting room until you accept."
              checked={settings.access.requireApproval}
              onCheckedChange={(checked) => applyHostSettings({ access: { requireApproval: checked } })}
            />
            <ToggleRow
              label="Lock room"
              description="Nobody new can request to join."
              checked={settings.access.lockRoom}
              onCheckedChange={(checked) => hostToggleLock(checked)}
            />
            <ToggleRow
              label="Allow join by code"
              description="People can enter with the 6-character room code."
              checked={settings.access.allowJoinByCode}
              onCheckedChange={(checked) => applyHostSettings({ access: { allowJoinByCode: checked } })}
            />
          </Section>

          <Section icon={<Users className="h-3.5 w-3.5" />} title="Participants">
            <div className="py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Maximum participants</p>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[13px] text-ink">
                  {settings.participants.maxParticipants}
                </span>
              </div>
              <Slider
                className="mt-3"
                value={[settings.participants.maxParticipants]}
                min={2}
                max={50}
                step={1}
                aria-label="Maximum participants"
                onValueChange={([value]) => applyHostSettings({ participants: { maxParticipants: value } })}
              />
            </div>
            <ToggleRow
              label="Guests join with mic on"
              checked={settings.participants.defaultMic}
              onCheckedChange={(checked) => applyHostSettings({ participants: { defaultMic: checked } })}
            />
            <ToggleRow
              label="Guests join with camera on"
              checked={settings.participants.defaultCamera}
              onCheckedChange={(checked) => applyHostSettings({ participants: { defaultCamera: checked } })}
            />
            <ToggleRow
              label="Host can mute others"
              checked={settings.participants.allowMuteOthers}
              onCheckedChange={(checked) => applyHostSettings({ participants: { allowMuteOthers: checked } })}
            />
            <ToggleRow
              label="Host can remove others"
              checked={settings.participants.allowRemoveOthers}
              onCheckedChange={(checked) => applyHostSettings({ participants: { allowRemoveOthers: checked } })}
            />
          </Section>

          <Section icon={<SlidersHorizontal className="h-3.5 w-3.5" />} title="Audio & video">
            <Field label="Video quality">
              <Segmented
                ariaLabel="Video quality"
                value={settings.av.videoQuality}
                onChange={(value) => applyHostSettings({ av: { videoQuality: value } })}
                options={VIDEO_OPTIONS}
                size="sm"
                className="w-full"
              />
            </Field>
            <Field label="Audio quality">
              <Segmented
                ariaLabel="Audio quality"
                value={settings.av.audioQuality}
                onChange={(value) => applyHostSettings({ av: { audioQuality: value } })}
                options={AUDIO_OPTIONS}
                size="sm"
                className="w-full"
              />
            </Field>
            <ToggleRow
              label="Noise suppression"
              checked={settings.av.noiseSuppression}
              onCheckedChange={(checked) => applyHostSettings({ av: { noiseSuppression: checked } })}
            />
            <ToggleRow
              label="Echo cancellation"
              checked={settings.av.echoCancellation}
              onCheckedChange={(checked) => applyHostSettings({ av: { echoCancellation: checked } })}
            />
            <ToggleRow
              label="Auto adjust quality"
              description="Reduce quality automatically on a weak connection."
              checked={settings.av.autoAdjustQuality}
              onCheckedChange={(checked) => applyHostSettings({ av: { autoAdjustQuality: checked } })}
            />
            <ToggleRow
              label="Low bandwidth by default"
              checked={settings.av.lowBandwidth}
              onCheckedChange={(checked) => applyHostSettings({ av: { lowBandwidth: checked } })}
            />
          </Section>

          <Section icon={<MessageSquare className="h-3.5 w-3.5" />} title="Chat">
            <ToggleRow
              label="Enable chat"
              checked={settings.chat.enabled}
              onCheckedChange={(checked) => applyHostSettings({ chat: { enabled: checked } })}
            />
            <ToggleRow
              label="Allow file sharing"
              disabled={!settings.chat.enabled}
              checked={settings.chat.allowFiles}
              onCheckedChange={(checked) => applyHostSettings({ chat: { allowFiles: checked } })}
            />
            <ToggleRow
              label="Allow reactions"
              disabled={!settings.chat.enabled}
              checked={settings.chat.allowReactions}
              onCheckedChange={(checked) => applyHostSettings({ chat: { allowReactions: checked } })}
            />
          </Section>

          <Section icon={<ScreenShare className="h-3.5 w-3.5" />} title="Screen sharing">
            <ToggleRow
              label="Allow screen sharing"
              checked={settings.screenShare.allow}
              onCheckedChange={(checked) => applyHostSettings({ screenShare: { allow: checked } })}
            />
            <ToggleRow
              label="Guests can share"
              disabled={!settings.screenShare.allow}
              checked={settings.screenShare.allowParticipants}
              onCheckedChange={(checked) => applyHostSettings({ screenShare: { allowParticipants: checked } })}
            />
            <div className="py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Maximum screens</p>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[13px] text-ink">
                  {settings.screenShare.maxScreens}
                </span>
              </div>
              <Slider
                className="mt-3"
                value={[settings.screenShare.maxScreens]}
                min={1}
                max={4}
                step={1}
                aria-label="Maximum simultaneous screens"
                onValueChange={([value]) => applyHostSettings({ screenShare: { maxScreens: value } })}
              />
            </div>
          </Section>

          <Section icon={<Lock className="h-3.5 w-3.5" />} title="Security">
            <ToggleRow
              label="Block join requests"
              description="Pause all incoming requests without locking the room."
              checked={settings.security.blockJoinRequests}
              onCheckedChange={(checked) => applyHostSettings({ security: { blockJoinRequests: checked } })}
            />
            <ToggleRow
              label="Temporary room"
              description="Auto-close after the scheduled time."
              checked={settings.security.temporary}
              onCheckedChange={(checked) =>
                applyHostSettings({
                  security: { temporary: checked, autoExpireMinutes: checked ? settings.security.autoExpireMinutes || 60 : 0 },
                })
              }
            />
            {settings.security.temporary ? (
              <Field label="Auto close after">
                <Segmented
                  ariaLabel="Auto close time"
                  value={String(settings.security.autoExpireMinutes)}
                  onChange={(value) => applyHostSettings({ security: { autoExpireMinutes: Number(value) } })}
                  options={[
                    { value: '15', label: '15m' },
                    { value: '30', label: '30m' },
                    { value: '60', label: '1h' },
                    { value: '120', label: '2h' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </Field>
            ) : null}
          </Section>

          <section className="rounded-xl border border-danger/40 bg-danger-soft/50 p-4">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-danger">
              <Zap className="h-4 w-4" />
              Danger zone
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-subtle">
              Ending the room disconnects everyone immediately. This cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                hostEndRoom()
                navigate(`/room/${roomId}`)
              }}
            >
              <PowerOff className="h-4 w-4" />
              End room for everyone
            </Button>
          </section>
        </div>

        <footer className="shrink-0 border-t border-line px-4 py-3">
          <Button variant="secondary" className="w-full" onClick={close}>
            Done
          </Button>
        </footer>
      </aside>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
        {icon}
        {title}
      </h3>
      <div className={cn('mt-1.5 divide-y divide-[var(--nx-line)] rounded-xl border border-line bg-surface-2 px-3')}>
        {children}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3">
      <p className="mb-1.5 text-[13px] font-medium text-ink-muted">{label}</p>
      {children}
    </div>
  )
}
