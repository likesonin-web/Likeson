export function TicketCardSkeleton() {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="skeleton w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="flex gap-2 mt-2">
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function TicketListSkeleton({ count = 6 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading tickets">
      {Array.from({ length: count }).map((_, i) => (
        <TicketCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MessageBubbleSkeleton({ align = 'left' }) {
  return (
    <div className={`flex gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className="skeleton w-8 h-8 rounded-full shrink-0" />
      <div className={`skeleton h-10 rounded-2xl ${align === 'right' ? 'w-40' : 'w-56'}`} />
    </div>
  );
}

export function MessageThreadSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading messages">
      <MessageBubbleSkeleton align="left" />
      <MessageBubbleSkeleton align="right" />
      <MessageBubbleSkeleton align="left" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="skeleton h-8 w-20 rounded mb-2" />
      <div className="skeleton h-3 w-28 rounded" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <div className="skeleton h-4 w-full rounded" />
        </td>
      ))}
    </tr>
  );
}
