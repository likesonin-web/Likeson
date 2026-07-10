import Breadcrumbs from './Breadcrumbs';
import GlobalSearchPalette from './GlobalSearchPalette';
import NotificationBell from './NotificationBell';
import SocketStatusIndicator from './SocketStatusIndicator';
import ThemeToggle from './ThemeToggle';
import ProfileMenu from './ProfileMenu';

/**
 * @param {{ user: object, breadcrumbs?: Array<{label: string, href?: string}> }} props
 */
export default function Header({ user, breadcrumbs = [] }) {
  return (
    <header className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300">
      <div className="flex items-center gap-4 px-4 sm:px-6 h-16">
        <div className="flex-1 min-w-0 flex items-center gap-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <GlobalSearchPalette />
          <SocketStatusIndicator />
          <NotificationBell />
          <ThemeToggle />
          <div className="w-px h-6 bg-base-300 hidden sm:block" />
          <ProfileMenu user={user} />
        </div>
      </div>
    </header>
  );
}
