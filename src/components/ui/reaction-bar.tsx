import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * A Messenger-style reaction bar: a row of chunky emojis that pop upward on
 * hover and bounce back on press. Shared by the floating reaction picker and
 * the chat message reaction picker.
 */
export function ReactionBar({
  emojis,
  onPick,
  size = 'md',
  className,
}: {
  emojis: readonly string[]
  onPick: (emoji: string) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {emojis.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          aria-label={emoji}
          onClick={() => onPick(emoji)}
          whileHover={{ scale: 1.3, y: -4 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 480, damping: 17 }}
          className={cn(
            'grid shrink-0 place-items-center rounded-full leading-none transition-colors hover:bg-surface-3',
            size === 'sm' ? 'h-9 w-9 text-[22px]' : 'h-11 w-11 text-[26px]',
          )}
        >
          <span className="drop-shadow-sm">{emoji}</span>
        </motion.button>
      ))}
    </div>
  )
}
