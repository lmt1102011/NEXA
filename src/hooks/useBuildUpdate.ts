import { useEffect, useState } from 'react'
import { APP_VERSION } from '@/lib/buildInfo'

export function useBuildUpdate(intervalMs = 60_000) {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('./index.html', { cache: 'no-cache' })
        if (!res.ok) return
        const html = await res.text()
        const match =
          html.match(/name="app-version"\s+content="([^"]+)"/) ??
          html.match(/content="([^"]+)"\s+name="app-version"/)
        if (match && match[1] && match[1] !== APP_VERSION) {
          if (!cancelled) setHasUpdate(true)
        }
      } catch {
        // ignore
      }
    }
    check()
    const id = window.setInterval(check, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [intervalMs])

  return hasUpdate
}
