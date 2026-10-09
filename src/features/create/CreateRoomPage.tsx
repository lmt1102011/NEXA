import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronDown, Globe, Lock, Plus, Settings2, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldHint } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ToggleRow } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { toast } from '@/stores/ui'
import type { RoomVisibility } from '@/types'

export default function CreateRoomPage() {
  const t = useT()
  const navigate = useNavigate()
  const createRoom = useRoomsStore((state) => state.createRoom)
  const displayName = useSessionStore((state) => state.displayName)
  const setSessionName = useSessionStore((state) => state.setName)
  const userId = useSessionStore((state) => state.userId)

  const [name, setName] = useState(displayName)
  const [roomName, setRoomName] = useState('')
  const [visibility, setVisibility] = useState<RoomVisibility>('public')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [requireApproval, setRequireApproval] = useState(true)
  const [maxParticipants, setMaxParticipants] = useState(12)
  const [defaultMic, setDefaultMic] = useState(true)
  const [defaultCamera, setDefaultCamera] = useState(true)
  const [allowChat, setAllowChat] = useState(true)

  const nameError = !name.trim() ? t('Please enter your name') : undefined

  function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setSessionName(name.trim())
    window.setTimeout(() => {
      const room = createRoom({
        hostId: userId,
        hostName: name.trim(),
        name: roomName.trim() || undefined,
        visibility,
        requireApproval,
        maxParticipants,
        defaultMic,
        defaultCamera,
        allowChat,
      })
      toast({
        title: t('Room created'),
        description: visibility === 'public' ? t('Your room is live and listed publicly.') : t('Your room is private — share the link or code.'),
        variant: 'success',
      })
      navigate(`/room/${room.id}`)
    }, 420)
  }

  return (
    <div className="relative mx-auto w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-64"
        style={{ background: 'radial-gradient(50% 60% at 50% 0%, rgba(124,116,255,0.12), transparent 70%)' }}
      />

      <Link
        to="/"
        className="relative inline-flex items-center gap-1.5 rounded-lg text-[13px] text-ink-subtle transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('Home')}
      </Link>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-md">
        <div className="px-6 pb-1 pt-7 sm:px-8">
          <h1 className="text-xl font-semibold text-ink">{t('Create a room')}</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-subtle">
            {t('Set the essentials now — you can fine-tune everything later in room settings.')}
          </p>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div>
            <Label htmlFor="display-name">{t('Your name')} *</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('e.g. Tri')}
              maxLength={32}
              autoComplete="nickname"
              aria-invalid={Boolean(nameError) && name.length > 0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
              }}
            />
            {name.trim() ? (
              <FieldHint>{t('This is how you appear to everyone in the room.')}</FieldHint>
            ) : (
              <FieldHint className="text-danger">{nameError}</FieldHint>
            )}
          </div>

          <div>
            <Label htmlFor="room-name">{t('Room name')}</Label>
            <Input
              id="room-name"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder={t('e.g. Gaming Night')}
              maxLength={48}
            />
            <FieldHint>{t('Optional — leave empty to use “Room by {name}”.', { name: name.trim() || t('You') })}</FieldHint>
          </div>

          <fieldset>
            <legend className="mb-2 block text-[13px] font-medium text-ink-muted">{t('Visibility')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup">
              <VisibilityCard
                selected={visibility === 'public'}
                onSelect={() => setVisibility('public')}
                icon={<Globe className="h-4 w-4" />}
                title={t('Public')}
                description={t('Appears in the public room list.')}
              />
              <VisibilityCard
                selected={visibility === 'private'}
                onSelect={() => setVisibility('private')}
                icon={<Lock className="h-4 w-4" />}
                title={t('Private')}
                description={t('Only accessible with the link or code.')}
              />
            </div>
          </fieldset>

          <div className="rounded-xl border border-line bg-surface-2/60 p-1">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <span className="inline-flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5" />
                {t('Advanced Settings')}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  advancedOpen && 'rotate-180',
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {advancedOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 divide-y divide-[var(--nx-line)] px-2.5 pb-3 pt-1">
                    <ToggleRow
                      label={t('Require host approval')}
                      description={t('Guests wait until you accept their request.')}
                      checked={requireApproval}
                      onCheckedChange={setRequireApproval}
                    />
                    <ToggleRow
                      label={t('Default microphone')}
                      description={t('Microphone starts on when you enter.')}
                      checked={defaultMic}
                      onCheckedChange={setDefaultMic}
                    />
                    <ToggleRow
                      label={t('Default camera')}
                      description={t('Camera starts on when you enter.')}
                      checked={defaultCamera}
                      onCheckedChange={setDefaultCamera}
                    />
                    <ToggleRow
                      label={t('Room chat')}
                      description={t('Text messages, reactions and file sharing.')}
                      checked={allowChat}
                      onCheckedChange={setAllowChat}
                    />
                    <div className="py-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink">{t('Maximum participants')}</p>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[12.5px] text-ink">
                          <Users className="h-3.5 w-3.5 text-ink-subtle" />
                          {maxParticipants}
                        </span>
                      </div>
                      <Slider
                        className="mt-3"
                        value={[maxParticipants]}
                        min={2}
                        max={50}
                        step={1}
                        aria-label={t('Maximum participants')}
                        onValueChange={([value]) => setMaxParticipants(value)}
                      />
                      <p className="mt-1.5 text-[12.5px] text-ink-subtle">
                        {t('Full room settings live inside the room.')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="border-t border-line px-6 py-4 sm:px-8">
          <Button size="lg" className="w-full" onClick={handleCreate} loading={creating} disabled={!name.trim()}>
            <Plus className="h-4 w-4" />
            {t('Create Room')}
          </Button>
        </div>
      </div>

      <p className="relative mt-4 text-center text-[12.5px] text-ink-subtle">
        {t('Already have a code?')}{' '}
        <Link to="/rooms" className="text-accent underline-offset-4 hover:underline">
          {t('Find a room')}
        </Link>
      </p>
    </div>
  )
}

function VisibilityCard({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected
          ? 'border-accent/60 bg-accent-soft shadow-sm'
          : 'border-line bg-surface-2 hover:border-line-strong',
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg border transition-colors',
            selected ? 'border-accent/30 bg-surface text-accent' : 'border-line bg-surface-3 text-ink-subtle',
          )}
        >
          {icon}
        </span>
        <span
          aria-hidden
          className={cn(
            'mt-0.5 grid h-4 w-4 place-items-center rounded-full border transition-colors',
            selected ? 'border-accent-solid' : 'border-line-strong',
          )}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-accent-solid" /> : null}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-subtle">{description}</p>
    </button>
  )
}
