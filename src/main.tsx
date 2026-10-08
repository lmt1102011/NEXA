import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/index.css'
import App from '@/app/App'
import { initSessionAppearance } from '@/stores/session'
import { useRoomsStore } from '@/stores/rooms'
import { lockZoom } from '@/lib/lockZoom'
import { enableTapCompat } from '@/lib/tapCompat'
import { startPublicRoomsDirectory } from '@/services/directory/PublicRoomsDirectory'

initSessionAppearance()
lockZoom()
enableTapCompat()

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}

// Share and discover public rooms across devices over Nostr.
startPublicRoomsDirectory()

// Empty rooms (nobody inside for 90s) drop off the device's room list.
const EMPTY_ROOM_TIMEOUT_MS = 90_000
window.setInterval(() => {
  useRoomsStore.getState().reapEmptyRooms(EMPTY_ROOM_TIMEOUT_MS)
}, 15_000)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined)
  })

  // Re-fetch the app from the network when a freshly deployed build takes
  // control, so users never run a mix of old and new chunks.
  let refreshedForNewBuild = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshedForNewBuild) return
    refreshedForNewBuild = true
    window.location.reload()
  })

  // GH Pages can serve a stale index.html whose hashed JS chunks no longer
  // exist (purged from CDN). Instead of leaving the user on a dead screen,
  // reset the app cache and reload so they always land on a valid build.
  window.setInterval(() => {
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined)
  }, 60 * 60 * 1000)
}

function watchChunkFailures() {
  const reloading = { active: false }
  const reload = () => {
    if (reloading.active) return
    reloading.active = true
    const finish = () => window.location.reload()
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(finish)
        .catch(finish)
    } else {
      finish()
    }
  }
  const chunkError = (message: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)

  window.addEventListener('error', (event) => {
    if (chunkError(event.message ?? '')) reload()
  })
  window.addEventListener('unhandledrejection', (event) => {
    const message =
      event.reason instanceof Error ? event.reason.message : String((event.reason as { message?: string } | undefined)?.message ?? '')
    if (chunkError(message)) reload()
  })
}
watchChunkFailures()
