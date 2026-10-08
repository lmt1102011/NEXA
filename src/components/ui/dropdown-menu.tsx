import * as Menu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/cn'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 8,
  ...props
}: React.ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 min-w-[190px] overflow-hidden rounded-xl border border-line bg-surface-2 p-1.5 shadow-lg outline-none data-[state=open]:animate-scale-in [transform-origin:var(--radix-dropdown-menu-content-transform-origin)]',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-muted outline-none transition-colors data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        destructive && 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn('px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1.5 my-1 h-px bg-line', className)} {...props} />
}
