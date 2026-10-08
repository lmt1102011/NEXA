import { createHashRouter } from 'react-router-dom'
import PublicLayout from '@/features/layout/PublicLayout'

export const router = createHashRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/features/home/HomePage')).default }),
      },
      {
        path: 'rooms',
        lazy: async () => ({ Component: (await import('@/features/rooms/RoomsPage')).default }),
      },
      {
        path: 'create',
        lazy: async () => ({ Component: (await import('@/features/create/CreateRoomPage')).default }),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('@/features/settings/UserSettingsPage')).default }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/features/layout/NotFoundPage')).default }),
      },
    ],
  },
  {
    path: '/room/:roomId',
    lazy: async () => ({ Component: (await import('@/features/room/RoomLayout')).default }),
    children: [
      {
        path: 'settings',
        lazy: async () => ({
          Component: (await import('@/features/settings/RoomSettingsOverlay')).default,
        }),
      },
    ],
  },
])