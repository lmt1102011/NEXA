import { useEffect, useRef } from 'react'
import { useRoomSessionStore } from '@/stores/roomSession'
import { playChime } from '@/lib/sound'

/** Plays an audible chime the moment the shared room timer runs out. */
export function useTimerAlert() {
  const firedAtRef = useRef<number | null>(null)
  const timer = useRoomSessionStore((state) => state.timer)

  useEffect(() => {
    if (!timer?.running || !timer.endsAt) return
    const id = window.setInterval(() => {
      const remaining = timer.endsAt! - Date.now()
      if (remaining > 0) return
      window.clearInterval(id)
      if (firedAtRef.current === timer.endsAt) return
      firedAtRef.current = timer.endsAt
      playChime()
    }, 400)
    return () => window.clearInterval(id)
  }, [timer?.endsAt, timer?.running])
}