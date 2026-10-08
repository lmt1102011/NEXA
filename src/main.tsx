import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/index.css'
import App from '@/app/App'
import { initSessionAppearance } from '@/stores/session'

initSessionAppearance()

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined)
  })
}
