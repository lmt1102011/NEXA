import { Keyboard } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/feedback'
import { useUiStore } from '@/stores/ui'

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['M'], description: 'Toggle microphone' },
  { keys: ['V'], description: 'Toggle camera' },
  { keys: ['S'], description: 'Share / stop sharing screen' },
  { keys: ['C'], description: 'Open or close chat' },
  { keys: ['P'], description: 'Open or close participants' },
  { keys: ['I'], description: 'Open invite dialog' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close dialogs and panels' },
]

export function ShortcutsDialog() {
  const shortcutsOpen = useUiStore((state) => state.shortcutsOpen)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)

  return (
    <Dialog
      open={shortcutsOpen}
      onOpenChange={(open) => {
        if (!open) setShortcutsOpen(false)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-accent" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Move faster without leaving the keyboard.</DialogDescription>
        </DialogHeader>

        <DialogBody className="pb-5">
          <ul className="divide-y divide-[var(--nx-line)]">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.description} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-[13.5px] text-ink-muted">{shortcut.description}</span>
                <span className="flex shrink-0 gap-1">
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
