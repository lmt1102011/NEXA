import { RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useBuildUpdate } from '@/hooks/useBuildUpdate'

/**
 * Polls the deployed `index.html` for a newer build version and swaps the tab
 * over to it, so a stale client never keeps running a bundle whose hashed
 * chunks have already been purged.
 */
export function BuildUpdateBanner({ className }: { className?: string }) {
  const t = useT()
  const { hasUpdate, reloadNow } = useBuildUpdate()

  return (
    <AnimatePresence>
      {hasUpdate ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={cn(
            'pointer-events-auto fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-surface-2/95 py-2 pl-4 pr-2 shadow-lg backdrop-blur',
            className,
          )}
          role="status"
          aria-live="polite"
        >
          <span className="text-[13px] font-medium text-ink">{t('Updating to the latest version…')}</span>
          <button
            type="button"
            onClick={reloadNow}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-solid px-3 text-[13px] font-medium text-white transition-colors hover:bg-accent-solid-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t('Reload now')}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
