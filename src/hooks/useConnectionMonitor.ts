import { useEffect, useRef } from 'react'
import { qualityController } from '@/services/media/QualityController'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { toast } from '@/stores/ui'

const EXCELLENT_STREAK_REQUIRED = 4

export function useConnectionMonitor(enabled: boolean) {
  const reducedRef = useRef(false)
  const streakRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    qualityController.start()
    const unsubscribe = qualityController.subscribe((stats) => {
      const call = useCallStore.getState()
      const room = useRoomSessionStore.getState().room
      const autoAdjust = room?.settings.av.autoAdjustQuality ?? true
      call.setStats(stats)

      if (stats.quality === 'poor' && !call.autoQualityReduced && autoAdjust) {
        reducedRef.current = true
        streakRef.current = 0
        call.setAutoQualityReduced(true)
        call.setLowBandwidth(true)
        toast({
          title: 'Unstable connection',
          description: `Packet loss: ${stats.loss}% — NEXA is reducing video quality.`,
          variant: 'warning',
          duration: 5000,
        })
        return
      }

      if (stats.quality === 'excellent' && call.autoQualityReduced) {
        streakRef.current += 1
        if (streakRef.current >= EXCELLENT_STREAK_REQUIRED) {
          streakRef.current = 0
          call.setAutoQualityReduced(false)
          call.setLowBandwidth(room?.settings.av.lowBandwidth ?? false)
          if (reducedRef.current) {
            reducedRef.current = false
            toast({
              title: 'Connection restored',
              description: 'Video quality is back to normal.',
              variant: 'success',
              duration: 3200,
            })
          }
        }
      } else {
        streakRef.current = 0
      }
    })

    return () => {
      unsubscribe()
      qualityController.stop()
    }
  }, [enabled])
}
