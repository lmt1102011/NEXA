import type { CallStats, ConnectionQuality } from '@/types'
import type { StatsSample } from '@/services/realtime'

type StatsListener = (stats: CallStats) => void

const EMIT_MS = 2000

/**
 * Connection monitor. Consumes real measurements (RTT from trystero's ping,
 * packet loss/jitter from RTCPeerConnection stats) pushed in by the session
 * controller and emits a smoothed CallStats picture to the UI.
 */
export class QualityController {
  private timer: number | null = null
  private listeners = new Set<StatsListener>()
  private stats: CallStats = { ping: 0, jitter: 0, loss: 0, bitrate: 0, quality: 'excellent' }

  start() {
    if (this.timer !== null) return
    this.timer = window.setInterval(() => this.emit(), EMIT_MS)
    this.emit()
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  getStats(): CallStats {
    return this.stats
  }

  subscribe(listener: StatsListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  report(sample: StatsSample) {
    const next: CallStats = {
      ping: sample.ping ? Math.round(smoother(this.stats.ping, sample.ping, 0.35)) : sample.ping,
      jitter: Math.round(smoother(this.stats.jitter, sample.jitter, 0.4)),
      loss: Number(smoother(this.stats.loss, sample.loss, 0.4).toFixed(1)),
      bitrate: Math.round(smoother(this.stats.bitrate, sample.bitrate, 0.5)),
      quality: classify(sample.ping, sample.jitter, sample.loss),
    }
    this.stats = next
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener(this.stats)
  }
}

function smoother(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

function classify(ping: number, jitter: number, loss: number): ConnectionQuality {
  if (loss >= 6 || ping >= 220 || jitter >= 30) return 'poor'
  if (loss >= 2.5 || ping >= 140 || jitter >= 18) return 'fair'
  if (loss >= 1 || ping >= 90 || jitter >= 10) return 'good'
  return 'excellent'
}

export const qualityController = new QualityController()