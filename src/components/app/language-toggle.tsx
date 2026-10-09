import { Languages } from 'lucide-react'
import { useI18nStore, useT, type Lang } from '@/lib/i18n'

export function LanguageToggle({ className }: { className?: string }) {
  const t = useT()
  const lang = useI18nStore((state) => state.lang)
  const setLang = useI18nStore((state) => state.setLang)
  const next: Lang = lang === 'vi' ? 'en' : 'vi'
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={t('Change language')}
      title={t('Language')}
      className={
        'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink shadow-sm transition-colors hover:border-ink/20 hover:bg-surface-2 hover:text-ink ' +
        (className ?? '')
      }
    >
      <Languages className="h-4 w-4" />
      {lang === 'vi' ? 'VI' : 'EN'}
    </button>
  )
}
