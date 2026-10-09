let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx
  } catch {
    return null
  }
}

/** Three-note chime used when the room timer reaches zero. */
export function playChime() {
  const context = audioContext()
  if (!context) return
  const now = context.currentTime
  const notes = [
    [880, 0, 0.22],
    [1108.7, 0.16, 0.22],
    [1318.5, 0.32, 0.5],
  ] as const
  for (const [freq, start, duration] of notes) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + start)
    gain.gain.exponentialRampToValueAtTime(0.45, now + start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now + start)
    oscillator.stop(now + start + duration + 0.05)
  }
}