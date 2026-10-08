import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  disabled?: boolean
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  className?: string
  size?: 'sm' | 'md'
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = 'md',
}: SegmentedProps<T>) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('relative flex gap-1 rounded-lg border border-line bg-surface-2 p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex-1 rounded-md px-3 font-medium transition-colors duration-150 disabled:opacity-45',
              size === 'sm' ? 'h-7 text-[12.5px]' : 'h-8 text-[13px]',
              selected ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-md bg-surface-3 shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
