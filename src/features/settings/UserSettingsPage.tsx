import { useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldHint } from '@/components/ui/input'
import { useSessionStore } from '@/stores/session'
import { toast } from '@/stores/ui'
import type { AccentName } from '@/types'

const ACCENTS: { value: AccentName; label: string; swatch: string }[] = [
  { value: 'violet', label: 'Violet', swatch: '#7c74ff' },
  { value: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { value: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { value: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { value: 'amber', label: 'Amber', swatch: '#f59e0b' },
]

const AVATAR_SWATCHES = [
  '#7c74ff',
  '#3b82f6',
  '#10b981',
  '#f43f5e',
  '#f59e0b',
  '#06b6d4',
  '#a855f7',
  '#84cc16',
  '#f97316',
  '#64748b',
]

export default function UserSettingsPage() {
  const navigate = useNavigate()
  const displayName = useSessionStore((state) => state.displayName)
  const setName = useSessionStore((state) => state.setName)
  const avatarColor = useSessionStore((state) => state.avatarColor)
  const setAvatarColor = useSessionStore((state) => state.setAvatarColor)
  const theme = useSessionStore((state) => state.theme)
  const setTheme = useSessionStore((state) => state.setTheme)
  const accent = useSessionStore((state) => state.accent)
  const setAccent = useSessionStore((state) => state.setAccent)

  const [nameDraft, setNameDraft] = useState(displayName)
  const nameError = nameDraft.trim().length === 0

  function saveName() {
    if (nameError) return
    setName(nameDraft.trim())
    toast({ title: 'Profile saved', description: 'Your display name was updated.', variant: 'success', duration: 2400 })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-[14px] text-ink-subtle">Profile and appearance — applied everywhere on this device.</p>
      </div>

      <div className="mt-8 space-y-5">
        <Card title="Profile" description="How you appear in rooms and chat.">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <Avatar name={nameDraft.trim() || 'You'} color={avatarColor} size="2xl" />
              <Badge variant="outline">Your avatar</Badge>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <Label htmlFor="settings-name">Display name</Label>
                <Input
                  id="settings-name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={saveName}
                  maxLength={32}
                  placeholder="e.g. Tri"
                />
                {nameError ? (
                  <FieldHint className="text-danger">Name cannot be empty.</FieldHint>
                ) : (
                  <FieldHint>Shown to everyone you talk to.</FieldHint>
                )}
              </div>

              <div>
                <span className="mb-2 block text-[13px] font-medium text-ink-muted">Avatar color</span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Avatar color ${color}`}
                      aria-pressed={avatarColor === color}
                      onClick={() => setAvatarColor(color)}
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                        avatarColor === color && 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--nx-surface)]',
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {avatarColor === color ? <Check className="h-4 w-4 text-white" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Appearance" description="Theme and accent color for the whole app.">
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-[13px] font-medium text-ink-muted">Theme</span>
              <div className="grid grid-cols-3 gap-2.5">
                <ThemeCard
                  active={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                  icon={<Moon className="h-4 w-4" />}
                  label="Dark"
                />
                <ThemeCard
                  active={theme === 'light'}
                  onClick={() => setTheme('light')}
                  icon={<Sun className="h-4 w-4" />}
                  label="Light"
                />
                <ThemeCard
                  active={false}
                  onClick={() => {
                    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
                    setTheme(prefersLight ? 'light' : 'dark')
                  }}
                  icon={<Monitor className="h-4 w-4" />}
                  label="System"
                />
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[13px] font-medium text-ink-muted">Accent color</span>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {ACCENTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={accent === option.value}
                    onClick={() => setAccent(option.value)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      accent === option.value
                        ? 'border-accent/60 bg-accent-soft'
                        : 'border-line bg-surface-2 hover:border-line-strong',
                    )}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: option.swatch }} />
                    <span className="truncate text-[13px] font-medium text-ink">{option.label}</span>
                    {accent === option.value ? <Check className="ml-auto h-3.5 w-3.5 text-accent" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="About" description="Build information.">
          <div className="space-y-2 text-[13.5px] text-ink-muted">
            <p className="flex justify-between gap-4">
              <span>App version</span>
              <span className="font-mono text-ink">NEXA 1.1.0</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Realtime transport</span>
              <span className="font-mono text-ink">WebRTC · Trystero (Nostr signaling)</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Media</span>
              <span className="font-mono text-ink">getUserMedia / getDisplayMedia</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" className="mt-4 px-0" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Card>
      </div>
    </div>
  )
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-ink-subtle">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ThemeCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors',
        active ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
