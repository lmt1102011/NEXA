import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '@/lib/buildInfo'

/** Once a build has triggered an auto-reload, don't do it again for 5 minutes. */
const AUTO_RELOAD_COOLDOWN_MS = 5 * 60 * 1000
const AUTO_RELOAD_KEY = 'nexa:build-auto-reload'

/**
 * Records the build we are about to reload for and reports whether the reload
 * should happen. This keeps a misbehaving CDN (or a version that never
 * matches) from putting the app into a reload loop.
 */
function claimAutoReload(version: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(AUTO_RELOAD_KEY)
    const last = raw ? (JSON.parse(raw) as { version?: string; at?: number }) : {}
    if (last.version === version && Date.now() - (last.at ?? 0) < AUTO_RELOAD_COOLDOWN_MS) {
      return false
    }
    window.sessionStorage.setItem(AUTO_RELOAD_KEY, JSON.stringify({ version, at: Date.now() }))
    return true
  } catch {
    // sessionStorage can be unavailable; reload anyway
    return true
  }
}

export type BuildUpdateState = {
  hasUpdate: boolean
  /** Reloads immediately, e.g. from the banner's button. */
  reloadNow: () => void
}

/**
 * Polls the deployed `index.html` for a newer build version and swaps the tab
 * over to it, so a client never keeps running a shell whose hashed chunks have
 * already been purged. The reload happens from a standalone timer rather than
 * React state, so a re-render can never leave the tab stranded on the old
 * bundle.
 */
export function useBuildUpdate(intervalMs = 60_000): BuildUpdateState {
  const [detectedVersion, setDetectedVersion] = useState<string | null>(null)
  const claimed = useRef(new Set<string>())

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
        const version = match?.[1]
        if (!version || version === APP_VERSION || cancelled) return

        setDetectedVersion(version)

        // Swap to the new build right away — this runs in the same task as the
        // detection, so nothing (re-render, route change, remount) can strand
        // the tab on the old bundle.
        if (claimed.current.has(version)) return
        claimed.current.add(version)
        if (claimAutoReload(version)) window.location.reload()
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

  const reloadNow = () => window.location.reload()

  return { hasUpdate: Boolean(detectedVersion), reloadNow }
}
