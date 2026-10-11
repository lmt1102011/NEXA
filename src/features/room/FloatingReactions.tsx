import { AnimatePresence, motion } from 'framer-motion'
import { useRoomSessionStore } from '@/stores/roomSession'

/**
 * Ephemeral overlay for the quick "floating reaction" emojis. Each entry drifts
 * up the stage and fades out, then removes itself once the animation finishes,
 * so nothing accumulates.
 */
export function FloatingReactions() {
  const reactions = useRoomSessionStore((state) => state.floatingReactions)
  const removeFloatingReaction = useRoomSessionStore((state) => state.removeFloatingReaction)

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            className="absolute bottom-16 flex flex-col items-center gap-1"
            style={{ left: `${reaction.x}%` }}
            initial={{ opacity: 0, y: 30, scale: 0.4, rotate: -8 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -200,
              scale: [0.4, 1.15, 1, 0.9],
              rotate: [-8, 5, -3, 0],
            }}
            transition={{ duration: 2.6, ease: 'easeOut', times: [0, 0.12, 0.75, 1] }}
            onAnimationComplete={() => removeFloatingReaction(reaction.id)}
          >
            <span className="text-5xl leading-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
              {reaction.emoji}
            </span>
            {reaction.name ? (
              <span className="max-w-[120px] truncate rounded-full bg-black/50 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">
                {reaction.name}
              </span>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
