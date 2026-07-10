'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { fetchTickets, selectAllTickets, selectTicketListLoading, selectTicketHasMore, selectTicketNextCursor, pinTicket, unpinTicket, selectPinnedTicketIds } from '@/store/slices/ticketSlice';
import { useTicketFilters } from '@/hooks/support/useTicketFilters';
import TicketCard from '@/components/support/ticket/TicketCard';
import FilterBar from '@/components/support/ticket/FilterBar';
import { TicketListSkeleton } from '@/components/support/shared/Skeletons';
import { EmptyState } from '@/components/support/shared/StateViews';
import InfiniteLoader from '@/components/support/shared/InfiniteLoader';

/**
 * @param {{ baseHref: string, currentUser: object, title?: string, showCreateButton?: boolean }} props
 */
export default function TicketListPage({ baseHref, currentUser, title = 'My Tickets', showCreateButton = true }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const tickets = useSelector(selectAllTickets);
  const loading = useSelector(selectTicketListLoading);
  const hasMore = useSelector(selectTicketHasMore);
  const nextCursor = useSelector(selectTicketNextCursor);
  const pinnedIds = useSelector(selectPinnedTicketIds);
  const { filters, setStatus, setPriority, setTicketType, setDateRange, clearFilters } = useTicketFilters();
  const scrollRef = useRef(null);

  useEffect(() => {
    dispatch(fetchTickets({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const virtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 108,
    overscan: 6,
  });

  const loadMore = () => {
    if (!hasMore || loading) return;
    dispatch(fetchTickets({ ...filters, cursor: nextCursor }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{title}</h1>
        {showCreateButton && (
          <button type="button" onClick={() => router.push(`${baseHref}/new`)} className="btn btn-primary-cta">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        )}
      </div>

      <FilterBar
        filters={filters}
        onStatusChange={setStatus}
        onPriorityChange={setPriority}
        onTypeChange={setTicketType}
        onDateRangeChange={setDateRange}
        onClear={clearFilters}
      />

      {loading && tickets.length === 0 ? (
        <TicketListSkeleton />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No tickets yet"
          description="When you need help, start a new support ticket and our team will jump in."
          action={showCreateButton ? { label: 'Create a ticket', onClick: () => router.push(`${baseHref}/new`) } : undefined}
        />
      ) : (
        <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const ticket = tickets[row.index];
              return (
                <div
                  key={ticket._id}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)`, paddingBottom: 10 }}
                >
                  <TicketCard
                    ticket={ticket}
                    href={`${baseHref}/${ticket._id}`}
                    currentUserId={currentUser._id}
                    isPinned={pinnedIds.includes(ticket._id)}
                    onTogglePin={(id) => dispatch(pinnedIds.includes(id) ? unpinTicket(id) : pinTicket(id))}
                  />
                </div>
              );
            })}
          </div>
          <InfiniteLoader onLoadMore={loadMore} hasMore={hasMore} loading={loading} />
        </div>
      )}
    </div>
  );
}
