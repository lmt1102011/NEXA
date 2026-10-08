import { forwardRef } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/cn'

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-out-soft disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent-solid data-[state=unchecked]:bg-surface-3',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-out-soft data-[state=checked]:translate-x-[20px]" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

interface ToggleRowProps {
  label: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function ToggleRow({ label, description, checked, onCheckedChange, disabled, className }: ToggleRowProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={typeof label === 'string' ? label : undefined} />
    </div>
  )
}
