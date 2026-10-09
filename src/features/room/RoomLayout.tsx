import { useEffect } from 'react'
import { Outlet, useParams, useSearchParams } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useBreakpoint, useHotkeys } from '@/hooks'
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor'
import { t, useT } from '@/lib/i18n'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useRoomsStore } from '@/stores/rooms'
import { useDirectoryStore } from '@/stores/directory'
import { useUiStore } from '@/stores/ui'
import { roomFromInviteParams } from '@/lib/invite'
import { initRoom, markEnteredViaRoomLink, toggleCamera, toggleMic, toggleScreenShare } from '@/features/room/session/sessionController'
import { RoomHeader } from '@/features/room/RoomHeader'
import { RoomRail } from '@/features/room/RoomRail'
import { NameConflictBar } from '@/features/room/NameConflictBar'
import { RoomPanel } from '@/features/room/RoomPanel'
import RoomStage from '@/features/room/RoomStage'
import { ControlBar } from '@/features/room/ControlBar'
import { InviteDialog } from '@/features/room/dialogs/InviteDialog'
import { DeviceSettingsDialog } from '@/features/room/dialogs/DeviceSettingsDialog'
import { ShortcutsDialog } from '@/features/room/dialogs/ShortcutsDialog'
import { LeaveDialog } from '@/features/room/dialogs/LeaveDialog'
import { MoreSheet } from '@/features/room/dialogs/MoreSheet'
import PreJoinScreen from '@/features/room/screens/PreJoinScreen'
import WaitingScreen from '@/features/room/screens/WaitingScreen'
import RoomStatusScreen, { RoomLoading } from '@/features/room/screens/StatusScreen'
import type { RoomPanel as RoomPanelKey } from '@/types'

const PANEL_TITLES: Record<RoomPanelKey, string> = {
  chat: t('Chat'),
  participants: t('Participants'),
  activities: t('Activities'),
  settings: t('Room settings'),
}

export default function RoomLayout() {
  const t = useT()
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const status = useRoomSessionStore((state) => state.status)
  const panel = useUiStore((state) => state.panel)
  const setPanel = useUiStore((state) => state.setPanel)
  const setModal = useUiStore((state) => state.setModal)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const { isMobile } = useBreakpoint()

  useEffect(() => {
    if (roomId && !useRoomsStore.getState().findRoom(roomId)) {
      const invited = roomFromInviteParams(roomId, searchParams)
      const remote = invited ?? useDirectoryStore.getState().findRoom(roomId)
      if (remote) {
        useRoomsStore.getState().addRoom(remote)
        markEnteredViaRoomLink()
      }
    }
    return initRoom(roomId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, searchParams.toString()])

  useConnectionMonitor(status === 'joined')

  useEffect(() => {
    if (status === 'joined') return
    setPanel(null)
    setModal(null)
    setShortcutsOpen(false)
  }, [status, setPanel, setModal, setShortcutsOpen])

  useHotkeys([
    { key: 'm', handler: () => void toggleMic(), enabled: status === 'joined' },
    { key: 'v', handler: () => void toggleCamera(), enabled: status === 'joined' },
    { key: 's', handler: () => void toggleScreenShare(), enabled: status === 'joined' },
    { key: 'c', handler: () => setPanel('chat'), enabled: status === 'joined' },
    { key: 'p', handler: () => setPanel('participants'), enabled: status === 'joined' },
    { key: 'i', handler: () => setModal('invite'), enabled: status === 'joined' },
    { key: '?', handler: () => setShortcutsOpen(true), enabled: status === 'joined' },
    {
      key: 'escape',
      allowInInput: true,
      enabled: status === 'joined',
      handler: () => {
        const ui = useUiStore.getState()
        if (ui.modal) ui.setModal(null)
        else if (ui.shortcutsOpen) ui.setShortcutsOpen(false)
        else if (ui.panel) ui.setPanel(null)
      },
    },
  ])

  if (status === 'loading') return <RoomLoading />
  if (status === 'prejoin') return <PreJoinScreen />
  if (status === 'awaiting') return <WaitingScreen />
  if (status !== 'joined') return <RoomStatusScreen />

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <RoomHeader />
      <NameConflictBar />

      <div className="flex min-h-0 flex-1">
        <RoomRail />

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <RoomStage />
          <Outlet />
        </div>

        {!isMobile && panel ? <RoomPanel className="w-[340px] shrink-0 border-l border-line" /> : null}
      </div>

      <ControlBar />

      <InviteDialog />
      <DeviceSettingsDialog />
      <ShortcutsDialog />
      <LeaveDialog />
      <MoreSheet />

      {isMobile && panel ? (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setPanel(null)
          }}
        >
          <SheetContent
            side="bottom"
            title={PANEL_TITLES[panel]}
            description={panel === 'chat' ? t('Messages for everyone in the room.') : undefined}
            className="flex flex-col"
          >
            <div className="-mx-5 -mb-5 h-[72dvh] shrink-0">
              <RoomPanel embedded={false} className="border-t border-line" />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}
