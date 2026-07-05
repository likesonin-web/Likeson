'use client';
// path: components/ui/Pagination.jsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onChange, disabled }) {
  if (pages <= 1) return null;

  const goTo = (p) => { if (p >= 1 && p <= pages && p !== page) onChange(p); };

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(pages, windowStart + 4);
  const nums = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button className="btn btn-ghost btn-sm btn-circle" disabled={disabled || page === 1} onClick={() => goTo(page - 1)}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      {nums.map((n) => (
        <button
          key={n}
          className={`btn btn-sm btn-circle ${n === page ? 'btn-primary' : 'btn-ghost'}`}
          disabled={disabled}
          onClick={() => goTo(n)}
        >
          {n}
        </button>
      ))}
      <button className="btn btn-ghost btn-sm btn-circle" disabled={disabled || page === pages} onClick={() => goTo(page + 1)}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
