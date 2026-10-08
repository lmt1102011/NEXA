import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <p className="font-mono text-[13px] font-medium tracking-widest text-accent">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-relaxed text-ink-subtle">
          The page you are looking for doesn’t exist or has moved.
        </p>
        <div className="mt-6 flex justify-center gap-2.5">
          <Link to="/">
            <Button>
              <Compass className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <Link to="/rooms">
            <Button variant="secondary">Browse rooms</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export function RoomNotFoundState({ withAction = true }: { withAction?: boolean }) {
  return (
    <EmptyState
      icon={<Compass className="h-5 w-5" />}
      title="Room not found"
      description="The room may have expired or no longer exists."
      action={
        withAction ? (
          <Link to="/">
            <Button variant="secondary">Back to Home</Button>
          </Link>
        ) : undefined
      }
    />
  )
}
