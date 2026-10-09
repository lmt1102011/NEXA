import { cn } from '@/lib/cn'

export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  const iconWidth = Math.round(size * 0.74)
  const iconHeight = Math.round((iconWidth * 158) / 177)
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-[7px] bg-[#111A2E]', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={iconWidth} height={iconHeight} viewBox="289 305 177 158" fill="none">
        <path
          fill="#F3F6FC"
          d="M302.773 436.409C302.848 416.226 302.811 396.042 302.662 375.859C302.598 359.909 299.401 337.994 311.37 326.226C316.706 320.984 323.926 318.109 331.404 318.25C340.97 318.486 347.748 322.735 354.132 329.506C373.982 350.557 394.39 371.079 414.328 392.04C418.945 396.885 424.251 404.534 431.263 404.765C437.235 405.05 442.668 401.389 443.234 395.034C444.435 381.537 443.695 367.487 443.71 353.861L451.68 353.794C451.846 371.401 451.884 389.009 451.796 406.616C451.765 412.674 451.599 418.828 451.603 424.885C451.613 438.217 439.399 449.284 426.32 449.174C415.531 449.028 407.97 443.43 400.758 436.03L355.458 388.654C347.88 380.624 340.468 372.145 332.268 364.725C324.705 357.883 313.308 360.118 311.421 370.877C310.103 378.779 310.603 387.754 310.616 395.796L310.728 436.284C329.251 448.085 302.671 465.305 297.477 446.673C296.458 443.015 299.883 438.538 302.773 436.409Z"
        />
        <path
          fill="#4388FF"
          d="M443.71 353.861C443.697 347.545 444.481 337.529 443.133 331.359C441.577 328.613 437.857 327.5 437.642 323.865C437.315 318.33 440.592 313.093 446.649 312.762C449.488 312.61 452.268 313.618 454.351 315.554C460.314 321.154 456.105 327.125 451.712 331.583C451.617 338.935 451.687 346.429 451.68 353.794L443.71 353.861Z"
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
