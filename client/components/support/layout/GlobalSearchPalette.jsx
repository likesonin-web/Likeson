'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Ticket as TicketIcon } from 'lucide-react';
import { useTicketSearch } from '../../../hooks/support/useTicketSearch';
import StatusBadge from '../shared/StatusBadge';

export default function GlobalSearchPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { query, results, loading, search, clear } = useTicketSearch();

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = (ticketId) => {
    setOpen(false);
    clear();
    router.push(`/admin/support/${ticketId}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input-field flex items-center gap-2 !w-auto cursor-pointer text-base-content/50 hover:border-primary/50"
        aria-label="Open search (Cmd+K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search tickets…</span>
        <kbd className="hidden sm:inline text-xs bg-base-300/60 px-1.5 py-0.5 rounded ml-2">⌘K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global ticket search"
        className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4"
      >
        <div className="absolute inset-0 bg-neutral/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
        <div className="relative w-full max-w-xl card bg-base-100 shadow-depth-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 border-b border-base-300">
            <Search className="w-4 h-4 text-base-content/40 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={search}
              placeholder="Search by ticket number, customer, phone, doctor, hospital…"
              className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-base-content/40"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {loading && <div className="px-3 py-6 text-center text-sm text-base-content/50">Searching…</div>}
            {!loading && query.length >= 2 && results.length === 0 && (
              <Command.Empty className="px-3 py-6 text-center text-sm text-base-content/50">
                No tickets match &quot;{query}&quot;.
              </Command.Empty>
            )}
            {results.map((ticket) => (
              <Command.Item
                key={ticket._id}
                value={ticket._id}
                onSelect={() => handleSelect(ticket._id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-field cursor-pointer data-[selected=true]:bg-primary/10"
              >
                <TicketIcon className="w-4 h-4 text-base-content/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{ticket.subject}</div>
                  <div className="text-xs text-base-content/50 truncate">
                    {ticket.ticketNumber} · {ticket.contactSnapshot?.name}
                  </div>
                </div>
                <StatusBadge status={ticket.status} size="xs" />
              </Command.Item>
            ))}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
