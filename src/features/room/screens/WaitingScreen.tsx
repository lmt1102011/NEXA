import { AnimatePresence, motion } from 'framer-motion'
import { Camera, CameraOff, CheckCircle2, Mic, MicOff, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useCallStore } from '@/stores/call'

export default function WaitingScreen() {
  const room = useRoomSessionStore((state) => state.room)
  const self = useRoomSessionStore((state) => state.self)
  const setStatus = useRoomSessionStore((state) => state.setStatus)
  const nameTaken = useRoomSessionStore((state) => state.nameTaken)
  const micOn = useCallStore((state) => state.micOn)
  const cameraOn = useCallStore((state) => state.cameraOn)

  if (!room) return null

  const nameBlocked =
    !!nameTaken && !!self && self.name.trim().toLowerCase() === nameTaken.toLowerCase()

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto h-28 w-28">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border border-accent/30"
            animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border border-accent/40"
            animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 1.1 }}
          />
          <div className="absolute inset-2 grid place-items-center rounded-full border border-line bg-surface">
            <Avatar name={self?.name || 'You'} color={self?.avatarColor} size="xl" />
          </div>
        </div>

        <h1 className="mt-6 text-xl font-semibold text-ink">Waiting for the host…</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-subtle">
          Your request to join <span className="text-ink">{room.name}</span> has been sent. This page updates
          automatically — no need to refresh.
        </p>

        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
          <span className="relative grid h-5 w-5 place-items-center">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative h-2 w-2 rounded-full bg-accent-solid" />
          </span>
          <span className="text-[12.5px] font-medium text-ink-muted">Request sent just now</span>
        </div>

        <AnimatePresence>
          {self ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-4 flex items-center justify-center gap-2"
            >
              <Badge variant={micOn ? 'default' : 'danger'}>
                {micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                Mic {micOn ? 'on' : 'off'}
              </Badge>
              <Badge variant={cameraOn ? 'default' : 'danger'}>
                {cameraOn ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
                Camera {cameraOn ? 'on' : 'off'}
              </Badge>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {nameBlocked && self ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-4 rounded-xl border border-danger/50 bg-danger-soft px-4 py-3 text-left"
            >
              <p className="text-[13px] font-medium text-danger">
                The name “{nameTaken}” is already used by someone else in this room.
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-subtle">
                The host did not accept this request. Pick another name before trying again.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button variant="secondary" onClick={() => setStatus('prejoin')}>
            {nameBlocked ? <PencilLine className="h-4 w-4" /> : null}
            {nameBlocked ? 'Change name' : 'Cancel request'}
          </Button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12.5px] text-ink-subtle">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Your devices stay ready while you wait
        </p>
      </div>
    </div>
  )
}
