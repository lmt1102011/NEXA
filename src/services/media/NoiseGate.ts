import type { NoiseFilter } from '@/types'

/**
 * Real microphone noise suppression built on Web Audio.
 *
 * The browser's `noiseSuppression` capture constraint is only a hint and is
 * silently ignored on many devices, which is why toggling it can feel like it
 * does nothing. This gate runs the mic through an explicit graph:
 *
 *   source → high-pass filter → noise gate (AudioWorklet) → destination
 *
 * The high-pass removes low-frequency rumble (fans, AC, traffic) and the gate
 * attenuates the signal whenever the level drops below a threshold, so room
 * tone disappears the moment you stop speaking. Everything runs on the audio
 * worklet thread, keeping the main thread (and weak CPUs) free.
 */

const GATE_PROCESSOR = `
class NXNoiseGate extends AudioWorkletProcessor {
  constructor() {
    super()
    this.level = 0
    this.gain = 0
    this.muted = false
    this.threshold = 0.03
    this.closedGain = 0.08
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || !input[0] || !output || !output[0]) return true

    const source = input[0]
    let sum = 0
    for (let i = 0; i < source.length; i++) sum += source[i] * source[i]
    const rms = Math.sqrt(sum / source.length)

    // Smooth the measured level so the gate reacts to speech, not transients.
    this.level = this.level * 0.92 + rms * 0.08

    const open = !this.muted && this.level > this.threshold
    const target = open ? 1 : this.closedGain
    // Fast attack, slower release — avoids clipping the first syllable.
    const coeff = target > this.gain ? 0.02 : 0.004
    this.gain += (target - this.gain) * coeff

    for (let channel = 0; channel < output.length; channel++) {
      const out = output[channel]
      const src = input[channel] || source
      for (let i = 0; i < out.length; i++) out[i] = src[i] * this.gain
    }
    return true
  }
}

registerProcessor('nx-noise-gate', NXNoiseGate)
`

const STRENGTH_PRESETS: Record<Exclude<NoiseFilter, 'off'>, { threshold: number; closedGain: number; highpass: number }> = {
  light: { threshold: 0.03, closedGain: 0.08, highpass: 80 },
  strong: { threshold: 0.018, closedGain: 0.0, highpass: 100 },
}

export class NoiseGate {
  private readonly context: AudioContext
  private readonly source: MediaStreamAudioSourceNode
  private readonly highpass: BiquadFilterNode
  private readonly node: AudioWorkletNode
  private readonly destination: MediaStreamAudioDestinationNode
  private readonly output: MediaStream

  private constructor(
    context: AudioContext,
    source: MediaStreamAudioSourceNode,
    highpass: BiquadFilterNode,
    node: AudioWorkletNode,
    destination: MediaStreamAudioDestinationNode,
    output: MediaStream,
  ) {
    this.context = context
    this.source = source
    this.highpass = highpass
    this.node = node
    this.destination = destination
    this.output = output
  }

  /**
   * Builds the processing graph for a raw mic track. Returns null when the
   * platform can't run an audio worklet, so callers can fall back to the
   * untouched track instead of dropping audio.
   */
  static async create(rawTrack: MediaStreamTrack, strength: NoiseFilter): Promise<NoiseGate | null> {
    if (strength === 'off') return null
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null

    try {
      const context = new AudioContextCtor()
      if (context.state === 'suspended') await context.resume().catch(() => undefined)

      const blob = new Blob([GATE_PROCESSOR], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      try {
        await context.audioWorklet.addModule(url)
      } finally {
        URL.revokeObjectURL(url)
      }

      const source = context.createMediaStreamSource(new MediaStream([rawTrack]))
      const highpass = context.createBiquadFilter()
      highpass.type = 'highpass'
      const node = new AudioWorkletNode(context, 'nx-noise-gate')
      const destination = context.createMediaStreamDestination()

      source.connect(highpass)
      highpass.connect(node)
      node.connect(destination)

      const gate = new NoiseGate(context, source, highpass, node, destination, destination.stream)
      gate.applyStrength(strength)
      return gate
    } catch {
      return null
    }
  }

  /** The processed track to publish instead of the raw microphone track. */
  get track(): MediaStreamTrack {
    return this.output.getAudioTracks()[0]
  }

  get stream(): MediaStream {
    return this.output
  }

  setStrength(strength: Exclude<NoiseFilter, 'off'>) {
    this.applyStrength(strength)
  }

  /** Forces the gate shut (mic muted) without touching the track's enabled flag. */
  setMuted(muted: boolean) {
    this.node.port.postMessage({ type: 'mute', muted })
  }

  dispose() {
    try {
      this.source.disconnect()
    } catch {
      // already disconnected
    }
    try {
      this.highpass.disconnect()
    } catch {
      // already disconnected
    }
    try {
      this.node.disconnect()
    } catch {
      // already disconnected
    }
    try {
      this.destination.disconnect()
    } catch {
      // already disconnected
    }
    try {
      this.context.close().catch(() => undefined)
    } catch {
      // already closed
    }
  }

  private applyStrength(strength: Exclude<NoiseFilter, 'off'>) {
    const preset = STRENGTH_PRESETS[strength]
    if (!preset) return
    this.highpass.frequency.setTargetAtTime(preset.highpass, this.context.currentTime, 0.01)
    this.node.port.postMessage({ type: 'strength', threshold: preset.threshold, closedGain: preset.closedGain })
  }
}
