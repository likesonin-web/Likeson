import Image from 'next/image';
import { useOnlineUsers } from '../../../hooks/support/useOnlineUsers';

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
};

/**
 * @param {{ user: {_id: string, name: string, avatar?: string}, size?: 'xs'|'sm'|'md'|'lg', showPresence?: boolean }} props
 */
export default function PresenceAvatar({ user, size = 'sm', showPresence = true }) {
  const { isOnline } = useOnlineUsers();
  const px = SIZE_MAP[size];
  const online = user?._id ? isOnline(user._id) : false;
  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span className="avatar relative inline-block" style={{ width: px, height: px }}>
      <span style={{ width: px, height: px }} className="rounded-full overflow-hidden block bg-primary/10">
        {user?.avatar ? (
          <Image src={user.avatar} alt={user.name || 'User'} width={px} height={px} className="object-cover w-full h-full" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-primary font-bold" style={{ fontSize: px * 0.38 }}>
            {initials}
          </span>
        )}
      </span>
      {showPresence && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-base-100 ${
            online ? 'bg-success' : 'bg-base-300'
          }`}
          style={{ width: Math.max(px * 0.28, 8), height: Math.max(px * 0.28, 8) }}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  );
}
