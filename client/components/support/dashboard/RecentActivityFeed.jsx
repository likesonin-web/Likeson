import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import StatusBadge from '../shared/StatusBadge';
import { EmptyState } from '../shared/StateViews';

dayjs.extend(relativeTime);

/**
 * @param {{ tickets: Array<object>, baseHref: string }} props
 */
export default function RecentActivityFeed({ tickets, baseHref }) {
  if (!tickets?.length) {
    return <EmptyState icon="inbox" title="No recent activity" description="New tickets will appear here as they come in." />;
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold mb-4">Recent Activity</h3>
      <ul className="divide-y divide-base-300">
        {tickets.slice(0, 8).map((t) => (
          <li key={t._id}>
            <Link href={`${baseHref}/${t._id}`} className="flex items-center gap-3 py-2.5 hover:bg-base-200 -mx-2 px-2 rounded-field">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{t.subject}</p>
                <p className="text-xs text-base-content/50">
                  {t.ticketNumber} · {dayjs(t.lastMessageAt || t.createdAt).fromNow()}
                </p>
              </div>
              <StatusBadge status={t.status} size="xs" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
