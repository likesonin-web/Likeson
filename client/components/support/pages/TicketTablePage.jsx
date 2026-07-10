'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { fetchTickets, selectAllTickets, selectTicketListLoading } from '../../store/slices/ticketSlice';
import { useTicketFilters } from '../../hooks/support/useTicketFilters';
import StatusBadge from '../support/shared/StatusBadge';
import PriorityBadge from '../support/shared/PriorityBadge';
import FilterBar from '../support/ticket/FilterBar';
import Pagination from '../support/shared/Pagination';
import { TableRowSkeleton } from '../support/shared/Skeletons';
import { EmptyState } from '../support/shared/StateViews';
import { TICKET_TYPE_LABELS } from '../../features/support/constants/support.constants';

const PAGE_SIZE = 20;

export default function TicketTablePage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const tickets = useSelector(selectAllTickets);
  const loading = useSelector(selectTicketListLoading);
  const { filters, setStatus, setPriority, setTicketType, setDateRange, setSort, clearFilters } = useTicketFilters();
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchTickets({ limit: 200 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const pageItems = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    const nextOrder = filters.sortBy === field && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    setSort(field, nextOrder);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">All Tickets</h1>

      <FilterBar
        filters={filters}
        onStatusChange={setStatus}
        onPriorityChange={setPriority}
        onTypeChange={setTicketType}
        onDateRangeChange={setDateRange}
        onClear={clearFilters}
      />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Category</th>
              <th className="cursor-pointer" onClick={() => toggleSort('priority')}>
                Priority
              </th>
              <th>Status</th>
              <th>Assignee</th>
              <th className="cursor-pointer" onClick={() => toggleSort('createdAt')}>
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && tickets.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} columns={6} />)
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="search" title="No tickets match your filters" />
                </td>
              </tr>
            ) : (
              pageItems.map((t) => (
                <tr
                  key={t._id}
                  onClick={() => router.push(`/admin/support/${t._id}`)}
                  className="cursor-pointer"
                >
                  <td>
                    <p className="font-semibold">{t.subject}</p>
                    <p className="text-xs text-base-content/40">{t.ticketNumber}</p>
                  </td>
                  <td className="text-xs">{TICKET_TYPE_LABELS[t.ticketType]}</td>
                  <td>
                    <PriorityBadge priority={t.priority} size="xs" />
                  </td>
                  <td>
                    <StatusBadge status={t.status} size="xs" />
                  </td>
                  <td className="text-xs">
                    {t.currentAssignees?.length ? `${t.currentAssignees.length} assigned` : 'Unassigned'}
                  </td>
                  <td className="text-xs text-base-content/50">{dayjs(t.createdAt).format('MMM D, YYYY')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
