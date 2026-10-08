import { cn } from '@/lib/cn'

export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-[7px] bg-[#101118]', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={Math.round(size * 0.64)} height={Math.round(size * 0.64)} viewBox="0 0 32 32" fill="none">
        <path
          d="M9.5 23V9.5L22.5 22.5V9"
          stroke="#7c74ff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function Logo({
  size = 26,
  wordmark = true,
  className,
}: {
  size?: number
  wordmark?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {wordmark ? (
        <span className="text-[15px] font-semibold leading-none tracking-[0.16em] text-ink">NEXA</span>
      ) : null}
    </span>
  )
}
