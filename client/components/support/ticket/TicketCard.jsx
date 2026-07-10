'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Paperclip, Users, Star } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import StatusBadge from '../shared/StatusBadge';
import PriorityBadge from '../shared/PriorityBadge';
import PresenceAvatar from '../shared/PresenceAvatar';
import { useTypingIndicator } from '../../../hooks/support/useTypingIndicator';
import { TICKET_TYPE_LABELS } from '../../../features/support/constants/support.constants';

dayjs.extend(relativeTime);

/**
 * @param {{
 *   ticket: object,
 *   href: string,
 *   currentUserId: string,
 *   unreadCount?: number,
 *   isPinned?: boolean,
 *   onTogglePin?: (ticketId: string) => void,
 * }} props
 */
export default function TicketCard({ ticket, href, currentUserId, unreadCount = 0, isPinned = false, onTogglePin }) {
  const { isAnyoneTyping } = useTypingIndicator(ticket._id, currentUserId);
  const assigneeAvatar = ticket.currentAssignees?.[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      <Link
        href={href}
        className={`card flex items-start gap-3 p-4 hover:border-primary/40 transition-colors ${
          unreadCount > 0 ? 'border-primary/30 bg-primary/5' : ''
        }`}
      >
        <PresenceAvatar user={{ _id: assigneeAvatar?.userId, name: ticket.contactSnapshot?.name }} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{ticket.subject}</p>
              <p className="text-xs text-base-content/50">
                {ticket.ticketNumber} · {TICKET_TYPE_LABELS[ticket.ticketType]}
              </p>
            </div>
            <span className="text-xs text-base-content/40 shrink-0 whitespace-nowrap">
              {dayjs(ticket.lastMessageAt || ticket.createdAt).fromNow()}
            </span>
          </div>

          <p className="text-sm text-base-content/70 truncate mt-1.5 min-h-[1.25rem]">
            {isAnyoneTyping ? (
              <span className="text-primary font-semibold italic">Typing…</span>
            ) : (
              ticket.lastMessagePreview || ticket.description
            )}
          </p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <StatusBadge status={ticket.status} size="xs" />
            <PriorityBadge priority={ticket.priority} size="xs" />

            {ticket.attachments?.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-base-content/50">
                <Paperclip className="w-3 h-3" /> {ticket.attachments.length}
              </span>
            )}

            {ticket.currentAssignees?.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-base-content/50">
                <Users className="w-3 h-3" /> {ticket.currentAssignees.length}
              </span>
            )}

            {unreadCount > 0 && (
              <span className="badge badge-primary badge-xs ml-auto">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
        </div>
      </Link>

      {onTogglePin && (
        <button
          type="button"
          onClick={() => onTogglePin(ticket._id)}
          className="absolute top-3 right-3 btn btn-ghost btn-circle btn-xs"
          aria-label={isPinned ? 'Unpin ticket' : 'Pin ticket'}
        >
          <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-warning text-warning' : 'text-base-content/30'}`} />
        </button>
      )}
    </motion.div>
  );
}
