import { useEffect, useRef } from 'react'
import { qualityController } from '@/services/media/QualityController'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { toast } from '@/stores/ui'
import { t } from '@/lib/i18n'

const EXCELLENT_STREAK_REQUIRED = 4
const WARNING_COOLDOWN_MS = 20000

export function useConnectionMonitor(enabled: boolean) {
  const reducedRef = useRef(false)
  const streakRef = useRef(0)
  const lastWarningRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    qualityController.start()
    const unsubscribe = qualityController.subscribe((stats) => {
      const call = useCallStore.getState()
      const room = useRoomSessionStore.getState().room
      const autoAdjust = room?.settings.av.autoAdjustQuality ?? true
      call.setStats(stats)

      if (stats.quality === 'poor' && !call.autoQualityReduced && autoAdjust) {
        const now = Date.now()
        reducedRef.current = true
        streakRef.current = 0
        call.setAutoQualityReduced(true)
        call.setLowBandwidth(true)
        if (now - lastWarningRef.current >= WARNING_COOLDOWN_MS) {
          lastWarningRef.current = now
          toast({
            title: t('Unstable connection'),
            description: t('NEXA is lowering video quality to keep the call stable.'),
            variant: 'warning',
            duration: 4000,
          })
        }
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
              title: t('Connection restored'),
              description: t('Video quality is back to normal.'),
              variant: 'success',
              duration: 3000,
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