import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/cn'

export function Slider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full bg-accent-solid" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-4 w-4 rounded-full border border-line-strong bg-white shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none"
      />
    </SliderPrimitive.Root>
  )
}
