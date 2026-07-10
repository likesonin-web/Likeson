'use client';

import dayjs from 'dayjs';
import { UserMinus } from 'lucide-react';
import PresenceAvatar from '../shared/PresenceAvatar';
import { EmptyState } from '../shared/StateViews';

/**
 * @param {{ participants: Array<object>, isStaff: boolean, onRemove?: (userId: string) => void }} props
 */
export default function ParticipantList({ participants, isStaff, onRemove }) {
  if (!participants?.length) {
    return <EmptyState icon="inbox" title="No participants yet" description="Assign this ticket to bring people in." />;
  }

  return (
    <ul className="divide-y divide-base-300">
      {participants.map((p) => {
        const user = p.userId || {};
        return (
          <li key={p._id} className="flex items-center gap-3 py-3">
            <PresenceAvatar user={user} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.name || 'Unknown user'}</p>
              <p className="text-xs text-base-content/50">
                {p.role} · joined {dayjs(p.joinedAt).format('MMM D')}
              </p>
            </div>
            {p.isMuted && <span className="badge badge-secondary badge-xs">Muted</span>}
            {isStaff && onRemove && user._id && (
              <button
                type="button"
                onClick={() => onRemove(user._id)}
                className="btn btn-ghost btn-circle btn-xs text-error"
                aria-label={`Remove ${user.name}`}
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
