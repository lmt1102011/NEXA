let locked = false

/**
 * Blocks browser page zoom (Ctrl + wheel, Ctrl + +/-/0, pinch gesture,
 * double-tap) so the app lays out exactly as designed. Safe to call once at
 * startup; it installs passive:false listeners that `preventDefault()` only
 * when a zoom gesture is actually detected.
 */
export function lockZoom() {
  if (locked || typeof window === 'undefined') return
  locked = true

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    const key = event.key.toLowerCase()
    if (key === '+' || key === '=' || key === '-' || key === '0' || key === '_') event.preventDefault()
  }
  const onGesture = (event: Event) => event.preventDefault()

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('gesturestart', onGesture)
  window.addEventListener('gesturechange', onGesture)
  window.addEventListener('gestureend', onGesture)
  window.addEventListener('gesturetap', onGesture)
}