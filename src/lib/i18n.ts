import { create } from 'zustand'

/**
 * Lightweight i18n: components call t('English text') — the English string is
 * the key. Missing translations fall back to the original English, so new
 * strings never break the UI. Vietnamese lives in the VI dictionaries under
 * src/lib/i18n/.
 */

export type Lang = 'en' | 'vi'

export type TranslationVars = Record<string, string | number>
export type TranslationEntry = string | ((vars: TranslationVars) => string)

let dictionary: Record<string, TranslationEntry> = {}

export function registerTranslations(entries: Record<string, TranslationEntry>) {
  dictionary = { ...dictionary, ...entries }
}

function loadLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem('nexa.lang')
  return stored === 'vi' ? 'vi' : 'en'
}

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useI18nStore = create<I18nState>()((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nexa.lang', lang)
      window.document.documentElement.lang = lang
    }
    set({ lang })
  },
}))

function interpolate(template: string, vars?: TranslationVars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  )
}

export function t(key: string, vars?: TranslationVars, lang?: Lang): string {
  const current = lang ?? useI18nStore.getState().lang
  const entry = current !== 'vi' ? undefined : dictionary[key]
  if (entry === undefined) return interpolate(key, vars)
  return typeof entry === 'function' ? entry(vars ?? {}) : interpolate(entry, vars)
}

/** React hook: returns a translate function that re-renders on language change. */
export function useT() {
  const lang = useI18nStore((state) => state.lang)
  return (key: string, vars?: TranslationVars) => t(key, vars, lang)
}

export function formatNumber(value: number, lang?: Lang): string {
  const current = lang ?? useI18nStore.getState().lang
  return value.toLocaleString(current === 'vi' ? 'vi-VN' : 'en-US')
}
