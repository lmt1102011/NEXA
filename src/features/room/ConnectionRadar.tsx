import { WifiOff } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import type { ConnectionQuality } from '@/types'

const BAR_LEVELS: Record<ConnectionQuality, number> = {
  excellent: 3,
  good: 2,
  fair: 1,
  poor: 0,
}

export function ConnectionRadar({ className, showText = true }: { className?: string; showText?: boolean }) {
  const t = useT()
  const stats = useCallStore((state) => state.stats)
  const connected = useRoomSessionStore((state) => state.connected)
  const bars = BAR_LEVELS[stats.quality]

  if (!connected) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium text-danger', className)}>
        <WifiOff className="h-3.5 w-3.5" />
        {showText ? t('Reconnecting…') : null}
      </span>
    )
  }

  const levelColor =
    stats.quality === 'excellent'
      ? 'bg-success'
      : stats.quality === 'good'
        ? 'bg-success'
        : stats.quality === 'fair'
          ? 'bg-warning'
          : 'bg-danger'

  const tooltip = (
    <div className="space-y-1">
      <p className="text-ink">{t('Connection: {quality}', { quality: stats.quality })}</p>
      <p className="font-mono text-ink-muted">
        {t('{ping} ms · {jitter} ms jitter · {loss}% loss', {
          ping: stats.ping,
          jitter: stats.jitter,
          loss: stats.loss,
        })}
      </p>
      <p className="font-mono text-ink-subtle">{stats.bitrate} kbps</p>
    </div>
  )

  return (
    <Tooltip content={tooltip} side="bottom">
      <button
        type="button"
        aria-label={t('Connection quality: {quality}, {ping} milliseconds ping', {
          quality: stats.quality,
          ping: stats.ping,
        })}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink',
          className,
        )}
      >
        <span className="flex items-end gap-[2.5px]" aria-hidden>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={cn(
                'w-[3.5px] rounded-full transition-colors duration-300',
                index < bars ? levelColor : 'bg-line-strong',
              )}
              style={{ height: 5 + index * 3 }}
            />
          ))}
        </span>
        {showText ? (
          <span className="hidden font-mono text-ink-subtle sm:inline">
            {t('{ping} ms · {loss}% loss', { ping: stats.ping, loss: stats.loss })}
          </span>
        ) : null}
      </button>
    </Tooltip>
  )
}
