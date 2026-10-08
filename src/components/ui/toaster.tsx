import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { cn } from '@/lib/cn'

const variantStyles = {
  default: { icon: Info, className: 'text-accent', bg: 'bg-accent-soft' },
  info: { icon: Info, className: 'text-info', bg: 'bg-info-soft' },
  success: { icon: Check, className: 'text-success', bg: 'bg-success-soft' },
  warning: { icon: TriangleAlert, className: 'text-warning', bg: 'bg-warning-soft' },
  danger: { icon: CircleAlert, className: 'text-danger', bg: 'bg-danger-soft' },
} as const

export function Toaster() {
  const toasts = useUiStore((state) => state.toasts)
  const dismiss = useUiStore((state) => state.dismissToast)

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 top-4 z-[110] flex flex-col gap-2.5 sm:inset-x-auto sm:right-4 sm:w-[370px]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const style = variantStyles[item.variant ?? 'default']
          const Icon = style.icon
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface-2 py-3 pl-3.5 pr-9 shadow-lg"
            >
              <span
                className={cn(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg',
                  style.bg,
                  style.className,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium leading-snug text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-subtle">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
