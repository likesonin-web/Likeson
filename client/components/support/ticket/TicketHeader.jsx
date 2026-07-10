'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Link2 } from 'lucide-react';
import dayjs from 'dayjs';
import StatusBadge from '../shared/StatusBadge';
import PriorityBadge from '../shared/PriorityBadge';
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TRANSITIONS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
} from '../../../features/support/constants/support.constants';

/**
 * @param {{
 *   ticket: object,
 *   isStaff: boolean,
 *   backHref: string,
 *   onChangeStatus: (status: string) => void,
 *   onChangePriority: (priority: string) => void,
 *   onOpenAssign: () => void,
 * }} props
 */
export default function TicketHeader({ ticket, isStaff, backHref, onChangeStatus, onChangePriority, onOpenAssign }) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const legalNextStatuses = TICKET_STATUS_TRANSITIONS[ticket.status] || [];

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Link href={backHref} className="btn btn-ghost btn-circle btn-sm mt-0.5" aria-label="Back to tickets">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold truncate">{ticket.subject}</h1>
          </div>
          <p className="text-xs text-base-content/50 mt-0.5">
            {ticket.ticketNumber} · {TICKET_TYPE_LABELS[ticket.ticketType]} · Created{' '}
            {dayjs(ticket.createdAt).format('MMM D, YYYY h:mm A')}
          </p>

          {ticket.booking && (
            <Link
              href={`/bookings/${ticket.booking}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              <Link2 className="w-3 h-3" /> Linked booking
            </Link>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {isStaff ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((o) => !o)}
                  className="cursor-pointer"
                  aria-haspopup="menu"
                  aria-expanded={statusMenuOpen}
                >
                  <StatusBadge status={ticket.status} />
                </button>
                {statusMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 card bg-base-100 shadow-depth-lg z-20 py-1" role="menu">
                    {legalNextStatuses.length === 0 && (
                      <p className="px-3 py-2 text-xs text-base-content/50">No further transitions</p>
                    )}
                    {legalNextStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          onChangeStatus(s);
                          setStatusMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                      >
                        {TICKET_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <StatusBadge status={ticket.status} />
            )}

            {isStaff ? (
              <select
                value={ticket.priority}
                onChange={(e) => onChangePriority(e.target.value)}
                className="input-field !w-auto !py-1 text-xs"
                aria-label="Priority"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TICKET_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            ) : (
              <PriorityBadge priority={ticket.priority} />
            )}
          </div>

          {isStaff && (
            <button type="button" onClick={onOpenAssign} className="btn btn-outline btn-sm">
              Assign
            </button>
          )}

          {ticket.sla?.resolutionDueAt && (
            <span className="flex items-center gap-1 text-xs text-base-content/50">
              <Calendar className="w-3 h-3" />
              Due {dayjs(ticket.sla.resolutionDueAt).format('MMM D, h:mm A')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
