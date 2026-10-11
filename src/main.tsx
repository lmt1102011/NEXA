import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/index.css'
import '@/lib/translations'
import App from '@/app/App'
import { initSessionAppearance } from '@/stores/session'
import { useRoomsStore } from '@/stores/rooms'
import { lockZoom } from '@/lib/lockZoom'
import { enableTapCompat } from '@/lib/tapCompat'
import { startPublicRoomsDirectory } from '@/services/directory/PublicRoomsDirectory'
import { useI18nStore } from '@/lib/i18n'

initSessionAppearance()
lockZoom()
enableTapCompat()
document.documentElement.lang = useI18nStore.getState().lang

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
  let registration: ServiceWorkerRegistration | null = null

  window.addEventListener('load', () => {
    navigator.serviceWorker
      // updateViaCache 'none' keeps a stale HTTP copy of sw.js from blocking
      // the update check on every navigation.
      .register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg
      })
      .catch(() => undefined)
  })

  // Check for a new build whenever the tab comes back, not just on the
  // interval — that is when a deploy actually becomes visible to the user.
  const checkForUpdate = () => {
    registration?.update().catch(() => undefined)
  }
  window.addEventListener('focus', checkForUpdate)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate()
  })
  window.setInterval(checkForUpdate, 60 * 60 * 1000)

  // A newly deployed build takes over and this page reloads once, so the
  // client never keeps running a shell whose hashed chunks are already gone.
  // On a first-ever visit there is nothing to refresh, so the takeover is
  // allowed to happen silently.
  let refreshedForNewBuild = false
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshedForNewBuild || !hadController) return
    refreshedForNewBuild = true
    window.setTimeout(() => window.location.reload(), 1200)
  })
}

function watchChunkFailures() {
  const RELOAD_GUARD_KEY = 'nexa:chunk-reload'
  const reloading = { active: false }
  const reload = async () => {
    if (reloading.active) return
    // Guard against an endless reload loop: if the previous attempt happened
    // moments ago, let this page rest instead of spinning forever.
    try {
      const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0')
      if (Date.now() - last < 10_000) return
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    } catch {
      // sessionStorage can be unavailable (private mode); continue anyway
    }
    reloading.active = true
    const finish = () => window.location.reload()
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
    } catch {
      // ignore cleanup errors and reload regardless
    }
    finish()
  }
  const chunkError = (message: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)

  window.addEventListener('error', (event) => {
    if (chunkError(event.message ?? '')) void reload()
  })
  window.addEventListener('unhandledrejection', (event) => {
    const message =
      event.reason instanceof Error
        ? event.reason.message
        : String((event.reason as { message?: string } | undefined)?.message ?? '')
    if (chunkError(message)) void reload()
  })
}
watchChunkFailures()
