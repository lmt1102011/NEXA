import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { copyText } from '@/lib/utils'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', callback)
      return () => mediaQuery.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export interface BreakpointInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isUltrawide: boolean
  isTouch: boolean
  isCompact: boolean
}

export function useBreakpoint(): BreakpointInfo {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isUltrawide = useMediaQuery('(min-width: 1700px)')
  const isTouch = useMediaQuery('(pointer: coarse)')

  return {
    isDesktop,
    isTablet,
    isMobile,
    isUltrawide,
    isTouch,
    isCompact: !isDesktop,
  }
}

export function useCopy(resetAfter = 2000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text)
      if (ok) {
        setCopied(true)
        if (timerRef.current) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setCopied(false), resetAfter)
      }
      return ok
    },
    [resetAfter],
  )

  return { copied, copy }
}

export interface Hotkey {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  allowInInput?: boolean
  enabled?: boolean
  handler: (event: KeyboardEvent) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function useHotkeys(hotkeys: Hotkey[]) {
  const hotkeysRef = useRef(hotkeys)
  hotkeysRef.current = hotkeys

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      for (const hotkey of hotkeysRef.current) {
        if (hotkey.enabled === false) continue
        if (hotkey.key.toLowerCase() !== key) continue
        if (hotkey.ctrl && !(event.ctrlKey || event.metaKey)) continue
        if (!hotkey.ctrl && (event.ctrlKey || event.metaKey)) continue
        if (hotkey.shift !== undefined && hotkey.shift !== event.shiftKey) continue
        if (hotkey.alt && !event.altKey) continue
        if (hotkey.alt === undefined && event.altKey) continue
        if (!hotkey.allowInInput && key !== 'escape' && isTypingTarget(event.target)) continue
        event.preventDefault()
        hotkey.handler(event)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
