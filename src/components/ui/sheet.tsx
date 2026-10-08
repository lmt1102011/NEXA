import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'

interface SheetProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  side?: 'bottom' | 'right'
}

export function Sheet({ side = 'bottom', ...props }: SheetProps) {
  return <Dialog {...props} />
}

export interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'bottom' | 'right'
  title: string
  description?: string
}

export function SheetContent({ side = 'bottom', title, description, className, children, ...props }: SheetContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-label={title}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border border-line bg-surface shadow-lg focus:outline-none',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[min(86dvh,var(--radix-dialog-content-available-height))] rounded-t-2xl data-[state=open]:animate-slide-up',
          side === 'right' &&
            'inset-y-0 right-0 w-[min(420px,100vw)] border-y-0 border-r-0 data-[state=open]:animate-fade-in',
          'pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
          className,
        )}
        {...props}
      >
        {side === 'bottom' ? (
          <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden />
        ) : null}
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <DialogTitle className="text-[15px] font-semibold text-ink">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-0.5 text-[12.5px] text-ink-subtle">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Close panel"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto nx-scroll px-5 pb-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
