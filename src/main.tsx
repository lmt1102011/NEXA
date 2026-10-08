import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/index.css'
import App from '@/app/App'
import { initSessionAppearance } from '@/stores/session'
import { useRoomsStore } from '@/stores/rooms'
import { lockZoom } from '@/lib/lockZoom'

initSessionAppearance()
lockZoom()

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}

// Empty rooms (nobody inside for 90s) drop off the device's room list.
const EMPTY_ROOM_TIMEOUT_MS = 90_000
window.setInterval(() => {
  useRoomsStore.getState().reapEmptyRooms(EMPTY_ROOM_TIMEOUT_MS)
}, 15_000)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined)
  })
}
