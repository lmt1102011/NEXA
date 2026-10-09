import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlarmClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { playChime } from '@/lib/sound'
import { useRoomSessionStore } from '@/stores/roomSession'
import { startTimer } from '@/features/room/session/sessionController'

const VIBRATE_PATTERN = [600, 200, 600, 200, 900]

/**
 * Shows a "Time's up!" popup the moment the shared timer runs out and keeps
 * the device vibrating until the user acknowledges or a new timer starts.
 */
export function TimeUpOverlay() {
  const t = useT()
  const timer = useRoomSessionStore((state) => state.timer)
  const [dismissedFor, setDismissedFor] = useState<number | null>(null)
  const [acked, setAcked] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timer?.endsAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [timer?.endsAt])

  const ended = Boolean(timer?.endsAt && now >= timer.endsAt)
  const show = ended && dismissedFor !== timer?.endsAt

  useEffect(() => {
    if (!show || acked) return
    setAcked(false)
    try {
      navigator.vibrate?.(VIBRATE_PATTERN)
    } catch {
      // vibration unsupported on iOS — the chime below still plays
    }
    const id = window.setInterval(() => {
      try {
        navigator.vibrate?.(VIBRATE_PATTERN)
      } catch {
        // ignore
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [show, acked])

  useEffect(() => {
    if (!show) return
    playChime()
  }, [show])

  useEffect(() => {
    if (timer?.endsAt && dismissedFor !== null && dismissedFor !== timer.endsAt) {
      setDismissedFor(null)
    }
  }, [timer?.endsAt, dismissedFor])

  if (!show || acked) return null

  const startedPersonId = timer?.startedBy
  const startedName = startedPersonId
    ? useRoomSessionStore.getState().participants.find((participant) => participant.id === startedPersonId)?.name
    : undefined

  return (
    <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.22 }}
        className="pointer-events-auto fixed left-1/2 top-1/2 z-[70] w-[min(360px,calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-danger/40 bg-surface p-5 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="false"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <AlarmClock className="h-7 w-7 animate-pulse" />
        </div>
        <p className="mt-3 text-lg font-semibold text-ink">{t("Time's up!")}</p>
        <p className="mt-1 text-[13px] text-ink-subtle">
          {startedName ? t("Time's up — {name}'s countdown is over.", { name: startedName }) : t('The countdown is over.')}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => startTimer(60_000)}>
            {t('+1 minute')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setAcked(true)
              try {
                navigator.vibrate?.(0)
              } catch {
                // ignore
              }
            }}
          >
            {t('Got it')}
          </Button>
        </div>
      </motion.div>
  )
}