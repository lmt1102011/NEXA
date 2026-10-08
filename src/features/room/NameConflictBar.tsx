import { useEffect, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useRoomSessionStore } from '@/stores/roomSession'
import { nameTakenBy, renameSelf } from '@/features/room/session/sessionController'

export function NameConflictBar() {
  const nameTaken = useRoomSessionStore((state) => state.nameTaken)
  const self = useRoomSessionStore((state) => state.self)
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(self?.name ?? '')
  }, [self?.name])

  if (!nameTaken || !self) return null

  const trimmed = value.trim()
  const clash = trimmed.length > 0 ? nameTakenBy(trimmed, self.id) : null

  return (
    <div className="z-20 flex shrink-0 items-center gap-2.5 border-b border-danger/40 bg-danger-soft px-3 py-2.5 sm:px-4">
      <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-danger">
          “{nameTaken}” is used by someone else in this room.
        </p>
        <p className="truncate text-[12px] text-ink-subtle">Choose another name to stay in the room.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={32}
          aria-label="New name"
          aria-invalid={clash !== null}
          className={cn(
            'h-9 w-36 rounded-lg border bg-surface-2 px-3 text-sm text-ink shadow-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2 sm:w-48',
            clash !== null ? 'border-danger/60 focus:ring-danger/25' : 'border-line focus:ring-accent/25',
          )}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && trimmed.length > 0 && clash === null) renameSelf(trimmed)
          }}
        />
        <Button
          size="sm"
          disabled={trimmed.length === 0 || clash !== null}
          onClick={() => renameSelf(trimmed)}
        >
          <Check className="h-4 w-4" />
          <span className="hidden sm:inline">Rename</span>
        </Button>
      </div>
    </div>
  )
}