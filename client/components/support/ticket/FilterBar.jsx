'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
} from '../../../features/support/constants/support.constants';

/**
 * @param {{
 *   filters: object,
 *   onStatusChange: (v: string|null) => void,
 *   onPriorityChange: (v: string|null) => void,
 *   onTypeChange: (v: string|null) => void,
 *   onDateRangeChange: (from: string|null, to: string|null) => void,
 *   onClear: () => void,
 * }} props
 */
export default function FilterBar({ filters, onStatusChange, onPriorityChange, onTypeChange, onDateRangeChange, onClear }) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = [filters.status, filters.priority, filters.ticketType, filters.dateFrom].filter(Boolean).length;

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={`btn btn-sm ${expanded || activeCount > 0 ? 'btn-primary' : 'btn-ghost'}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && <span className="badge badge-xs bg-primary-content/20 text-primary-content ml-1">{activeCount}</span>}
        </button>

        {/* Quick status chips for the most common filter */}
        {['open', 'in_progress', 'escalated'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusChange(filters.status === status ? null : status)}
            className={`badge badge-sm cursor-pointer ${
              filters.status === status ? 'badge-primary' : 'badge-secondary opacity-60 hover:opacity-100'
            }`}
          >
            {TICKET_STATUS_LABELS[status]}
          </button>
        ))}

        {activeCount > 0 && (
          <button type="button" onClick={onClear} className="btn btn-ghost btn-xs text-error ml-auto">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-base-300">
          <div>
            <label htmlFor="filter-status" className="label-text-alt block mb-1">
              Status
            </label>
            <select
              id="filter-status"
              value={filters.status || ''}
              onChange={(e) => onStatusChange(e.target.value || null)}
              className="input-field"
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-priority" className="label-text-alt block mb-1">
              Priority
            </label>
            <select
              id="filter-priority"
              value={filters.priority || ''}
              onChange={(e) => onPriorityChange(e.target.value || null)}
              className="input-field"
            >
              <option value="">All priorities</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TICKET_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-type" className="label-text-alt block mb-1">
              Category
            </label>
            <select
              id="filter-type"
              value={filters.ticketType || ''}
              onChange={(e) => onTypeChange(e.target.value || null)}
              className="input-field"
            >
              <option value="">All categories</option>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TICKET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-date" className="label-text-alt block mb-1">
              Created after
            </label>
            <input
              id="filter-date"
              type="date"
              value={filters.dateFrom ? filters.dateFrom.slice(0, 10) : ''}
              onChange={(e) => onDateRangeChange(e.target.value || null, filters.dateTo)}
              className="input-field"
            />
          </div>
        </div>
      )}
    </div>
  );
}
