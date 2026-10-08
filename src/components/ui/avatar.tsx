import { cn } from '@/lib/cn'
import { initials } from '@/lib/utils'

const sizes = {
  xs: 'h-6 w-6 text-[9.5px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[13px]',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-24 w-24 text-2xl',
} as const

export interface AvatarProps {
  name: string
  color?: string
  size?: keyof typeof sizes
  speaking?: boolean
  className?: string
  title?: string
}

export function Avatar({ name, color = '#4f46e5', size = 'md', speaking = false, className, title }: AvatarProps) {
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-offset-2 ring-offset-[var(--nx-bg)] transition-shadow duration-200',
        sizes[size],
        speaking && 'ring-2 ring-success',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  )
}
