import React from 'react';

export interface TicketListSkeletonProps {
  count?: number;
}

export interface TableRowSkeletonProps {
  cols?: number;
}

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export interface ChatBubbleSkeletonProps {
  align?: 'left' | 'right';
}

export function TicketCardSkeleton(): React.ReactElement {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-5 w-3/4" />
      <div className="skeleton h-4 w-full" />
      <div className="flex items-center gap-2">
        <div className="skeleton h-8 w-8 rounded-full" />
        <div className="skeleton h-3 w-20" />
      </div>
    </div>
  );
}

export function TicketListSkeleton({ count = 6 }: TicketListSkeletonProps): React.ReactElement {
  return (
    <div className="grid-responsive">
      {Array.from({ length: count }).map((_, i) => <TicketCardSkeleton key={i} />)}
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: TableRowSkeletonProps): React.ReactElement {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><div className="skeleton h-4 w-full" /></td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: TableSkeletonProps): React.ReactElement {
  return (
    <>{Array.from({ length: rows }).map((_, i) => <TableRowSkeleton key={i} cols={cols} />)}</>
  );
}

export function ChatBubbleSkeleton({ align = 'left' }: ChatBubbleSkeletonProps): React.ReactElement {
  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="skeleton h-10 w-48 rounded-box" />
    </div>
  );
}

export function StatCardSkeleton(): React.ReactElement {
  return (
    <div className="stat-card space-y-3">
      <div className="skeleton h-8 w-20" />
      <div className="skeleton h-3 w-24" />
    </div>
  );
}
