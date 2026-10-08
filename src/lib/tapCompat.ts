let activeTap: { target: EventTarget | null; x: number; y: number } | null = null
let suppressClick = false
let pendingTimer: number | null = null
let enabled = false

function clearPending() {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
  activeTap = null
}

/**
 * Some Chrome-for-Android versions (and embedded engines) do not synthesize a
 * compatible `click` after a finger tap, so buttons show a pressed state but
 * never fire. This wrapper re-dispatches a `click` on the tapped element when
 * the browser did not already produce one, mirroring how FastClick works.
 * A real click arriving in between cancels the fallback so taps never fire
 * twice. Only active on touch-capable devices.
 */
export function enableTapCompat() {
  if (enabled || typeof window === 'undefined' || !('ontouchstart' in window)) return
  enabled = true

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) {
        clearPending()
        return
      }
      activeTap = {
        target: event.target,
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      }
      suppressClick = false
    },
    { capture: true, passive: true },
  )

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!activeTap) return
      const point = event.changedTouches?.[0] ?? event.touches[0]
      if (point && Math.hypot(point.clientX - activeTap.x, point.clientY - activeTap.y) > 12) clearPending()
    },
    { capture: true, passive: true },
  )

  document.addEventListener(
    'touchend',
    (event) => {
      const tap = activeTap
      clearPending()
      if (!tap || event.changedTouches.length !== 1) return
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null
        if (suppressClick || !tap.target) return
        if (tap.target instanceof HTMLElement || tap.target instanceof SVGElement) {
          tap.target.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }),
          )
        }
      }, 0)
    },
    { capture: true, passive: true },
  )

  document.addEventListener(
    'click',
    () => {
      suppressClick = true
    },
    { capture: true, passive: true },
  )
}