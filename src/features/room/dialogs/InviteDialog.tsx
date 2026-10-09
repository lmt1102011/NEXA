import { Check, Copy, ExternalLink, Link2, QrCode, Share2, Users } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCopy } from '@/hooks'
import { buildInviteLink } from '@/lib/invite'
import { useT } from '@/lib/i18n'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'

export function InviteDialog() {
  const modal = useUiStore((state) => state.modal)
  const setModal = useUiStore((state) => state.setModal)
  const room = useRoomSessionStore((state) => state.room)
  const { copied, copy } = useCopy()
  const t = useT()

  if (!room) return null
  const link = typeof window !== 'undefined' ? buildInviteLink(room) : ''
  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share)

  async function handleShare() {
    try {
      await navigator.share({
        title: t('Join {name} on NEXA', { name: room?.name ?? '' }),
        text: t('Join my room "{name}" on NEXA', { name: room?.name ?? '' }),
        url: link,
      })
    } catch {
      // user cancelled the share sheet
    }
  }

  return (
    <Dialog
      open={modal === 'invite'}
      onOpenChange={(open) => {
        if (!open) setModal(null)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            {t('Invite people')}
          </DialogTitle>
          <DialogDescription>
            {t('Anyone with the link can ask to join “{name}”.', { name: room.name })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[12.5px] text-ink-subtle">{t('Room code')}</span>
            <Badge variant="accent" className="px-3 py-1 font-mono text-[15px] tracking-[0.2em]">
              {room.code}
            </Badge>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
            <Link2 className="h-4 w-4 shrink-0 text-ink-subtle" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-muted">{link}</span>
            <Button size="sm" onClick={() => void copy(link)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('Copied') : t('Copy')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => void copy(room.code)}>
              <QrCode className="h-4 w-4" />
              {t('Copy code')}
            </Button>
            {canShare ? (
              <Button variant="secondary" onClick={() => void handleShare()}>
                <Share2 className="h-4 w-4" />
                {t('Share…')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(t('Join "{name}" on NEXA: {link}', { name: room.name, link }))}`, '_blank', 'noopener')
                }}
              >
                <ExternalLink className="h-4 w-4" />
                WhatsApp
              </Button>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
