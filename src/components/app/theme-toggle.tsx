import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useSessionStore } from '@/stores/session'
import { useT } from '@/lib/i18n'

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSessionStore((state) => state.theme)
  const setTheme = useSessionStore((state) => state.setTheme)
  const t = useT()
  const label = theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')

  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="iconSm"
        aria-label={label}
        className={className}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ opacity: 0, scale: 0.65, rotate: -35 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.65, rotate: 35 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="grid place-items-center"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </Button>
    </Tooltip>
  )
}
