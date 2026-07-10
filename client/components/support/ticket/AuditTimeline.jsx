'use client';

import dayjs from 'dayjs';
import { ShieldCheck } from 'lucide-react';

/**
 * Staff-only view of the same timeline data, but surfacing the
 * before/after diff and device/IP metadata that Timeline.jsx deliberately
 * hides from the customer-facing rendering. Backed by the same
 * SupportTimeline entries — metadata is only populated for actions that
 * recorded a before/after snapshot (status/priority changes, assignment).
 *
 * @param {{ entries: Array<object> }} props
 */
export default function AuditTimeline({ entries }) {
  const auditableEntries = entries.filter((e) => e.metadata && Object.keys(e.metadata).length > 0);

  if (!auditableEntries.length) {
    return <p className="text-sm text-base-content/50 text-center py-8">No auditable changes recorded.</p>;
  }

  return (
    <div className="space-y-3">
      {auditableEntries.map((entry) => (
        <div key={entry._id} className="card p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {entry.actor?.name || 'System'}{' '}
                <span className="font-normal text-base-content/60">
                  {entry.event.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">{dayjs(entry.createdAt).format('MMM D, YYYY h:mm:ss A')}</p>

              {(entry.metadata.from !== undefined || entry.metadata.to !== undefined) && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="badge badge-secondary badge-xs">{String(entry.metadata.from ?? '—')}</span>
                  <span className="text-base-content/30">→</span>
                  <span className="badge badge-primary badge-xs">{String(entry.metadata.to ?? '—')}</span>
                </div>
              )}

              {entry.metadata.assignees && (
                <p className="text-xs text-base-content/50 mt-1.5">
                  {entry.metadata.assignees.length} assignee(s) —{' '}
                  {entry.metadata.assignees.map((a) => a.role).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
