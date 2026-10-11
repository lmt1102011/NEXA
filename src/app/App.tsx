import { RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { router } from '@/app/routes'

export default function App() {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={300}>
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  )
}
