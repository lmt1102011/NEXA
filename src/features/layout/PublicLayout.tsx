import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo, LogoMark } from '@/components/brand/logo'
import { LanguageToggle } from '@/components/app/language-toggle'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { useSessionStore } from '@/stores/session'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/cn'

function navLinkClass(isActive: boolean) {
  return cn(
    'rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-150',
    isActive ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  )
}

export default function PublicLayout() {
  const displayName = useSessionStore((state) => state.displayName)
  const avatarColor = useSessionStore((state) => state.avatarColor)
  const t = useT()

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header
        className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={t('NEXA home')}>
            <Logo className="hidden sm:inline-flex" />
            <Logo wordmark={false} className="sm:hidden" />
          </Link>

          <nav className="hidden min-[360px]:flex items-center gap-1" aria-label={t('Main')}>
            <NavLink to="/rooms" className={({ isActive }) => navLinkClass(isActive)}>
              {t('Rooms')}
            </NavLink>
            <NavLink to="/create" className={({ isActive }) => navLinkClass(isActive)}>
              {t('Create')}
            </NavLink>
          </nav>

          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <ThemeToggle />
            <Link to="/settings" aria-label={t('Settings')} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2">
              <Avatar name={displayName || t('You')} color={avatarColor} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-7 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size={22} />
            <span className="text-[13px] text-ink-subtle">
              NEXA — {t('Talk. Share. Connect.')}
            </span>
          </div>
          <nav className="flex items-center gap-5 text-[13px] text-ink-subtle" aria-label={t('Footer')}>
            <Link to="/rooms" className="transition-colors hover:text-ink">
              {t('Rooms')}
            </Link>
            <Link to="/create" className="transition-colors hover:text-ink">
              {t('Create room')}
            </Link>
            <Link to="/settings" className="transition-colors hover:text-ink">
              {t('Settings')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
