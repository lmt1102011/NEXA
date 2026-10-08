import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useSessionStore } from '@/stores/session'

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSessionStore((state) => state.theme)
  const setTheme = useSessionStore((state) => state.setTheme)

  return (
    <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Button
        variant="ghost"
        size="iconSm"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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
