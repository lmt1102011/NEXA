import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/cn'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 8,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 rounded-xl border border-line bg-surface-2 p-1.5 shadow-lg outline-none data-[state=open]:animate-scale-in [transform-origin:var(--radix-popover-content-transform-origin)]',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
