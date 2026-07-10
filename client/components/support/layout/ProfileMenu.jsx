'use client';

import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Settings, User as UserIcon, ChevronDown } from 'lucide-react';
import { logout } from '../../../store/slices/userSlice';
import PresenceAvatar from '../shared/PresenceAvatar';

/**
 * @param {{ user: {_id: string, name: string, role: string, avatar?: string} }} props
 */
export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await dispatch(logout());
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-field hover:bg-base-300/60 transition-colors"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <PresenceAvatar user={user} size="sm" showPresence={false} />
        <span className="hidden sm:block text-sm font-semibold max-w-[9rem] truncate">{user.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-base-content/50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-56 card bg-base-100 shadow-depth-lg z-50 overflow-hidden"
            role="menu"
          >
            <div className="px-4 py-3 border-b border-base-300">
              <p className="text-sm font-bold truncate">{user.name}</p>
              <p className="text-xs text-base-content/50 truncate">{user.email}</p>
              <span className="role-badge mt-2 inline-flex">{user.role}</span>
            </div>
            <ul className="py-1">
              <li>
                <a href="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-base-200">
                  <UserIcon className="w-4 h-4 text-base-content/50" /> My Profile
                </a>
              </li>
              <li>
                <a href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-base-200">
                  <Settings className="w-4 h-4 text-base-content/50" /> Settings
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error hover:bg-error/10"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
