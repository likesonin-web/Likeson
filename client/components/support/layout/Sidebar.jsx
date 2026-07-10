'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Ticket,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  LifeBuoy,
  Clock,
  Star,
} from 'lucide-react';
import { STAFF_ROLES, ROLE_SUPPORT_ROUTE } from '../../../features/support/constants/support.constants';

function getNavItems(role) {
  const base = ROLE_SUPPORT_ROUTE[role] || '/support';

  if (STAFF_ROLES.includes(role)) {
    return [
      { label: 'Dashboard', href: '/admin/support/dashboard', icon: LayoutDashboard },
      { label: 'All Tickets', href: '/admin/support/tickets', icon: Ticket },
      { label: 'My Assigned', href: '/admin/support?filter=assigned', icon: Users },
      { label: 'Analytics', href: '/admin/support/analytics', icon: BarChart3 },
      { label: 'Settings', href: '/admin/support/settings', icon: Settings },
    ];
  }

  return [
    { label: 'My Tickets', href: base, icon: Ticket },
    { label: 'New Ticket', href: `${base}/new`, icon: LifeBuoy },
    { label: 'Recently Viewed', href: `${base}?view=recent`, icon: Clock },
    { label: 'Pinned', href: `${base}?view=pinned`, icon: Star },
  ];
}

export default function Sidebar({ role }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getNavItems(role);

  const NavList = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1 p-3" aria-label="Support navigation">
      {items.map(({ label, href, icon: Icon }) => {
        const active = pathname === href.split('?')[0];
        return (
          <Link
            key={label}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-field text-sm font-semibold transition-colors ${
              active ? 'bg-primary/10 text-primary' : 'text-base-content/70 hover:bg-base-300/60 hover:text-base-content'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-base-300 bg-base-100">
        <div className="px-5 py-5 border-b border-base-300">
          <span className="font-display font-black text-lg text-gradient-primary">Support Center</span>
        </div>
        <NavList />
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-4 left-4 z-40 btn btn-primary btn-circle shadow-primary"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="md:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral/40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute left-0 top-0 bottom-0 w-72 bg-base-100 shadow-depth-lg flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-base-300">
                <span className="font-display font-black text-lg text-gradient-primary">Support Center</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-ghost btn-circle btn-sm"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
