'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import Dialog from '../shared/Dialog';
import PresenceAvatar from '../shared/PresenceAvatar';
import API from '@/store/api';
import { GLOBAL_SEARCH_DEBOUNCE_MS } from '../../../features/support/constants/support.constants';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onAssign: (assignees: Array<{userId: string, role: string, department?: string}>, note: string) => Promise<void>,
 *   loading: boolean,
 * }} props
 */
export default function AssignmentModal({ open, onClose, onAssign, loading }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]); // [{userId, role, name, avatar, department}]
  const [note, setNote] = useState('');
  const debounceRef = useRef(null);

  const search = useCallback((term) => {
    setQuery(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // Reuses the existing platform-wide user search endpoint, not a
        // support-module-specific one — assignment can target any eligible
        // partner/staff user, so scope belongs to the shared users API.
        const { data } = await API.get('/users/admin/users', { params: { search: term, limit: 8 } });
        setResults(data.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
  }, []);

  const toggleSelect = (user) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.userId === user._id);
      if (exists) return prev.filter((s) => s.userId !== user._id);
      return [...prev, { userId: user._id, role: user.role, name: user.name, avatar: user.avatar, department: '' }];
    });
  };

  const setDepartment = (userId, department) => {
    setSelected((prev) => prev.map((s) => (s.userId === userId ? { ...s, department } : s)));
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    await onAssign(
      selected.map(({ userId, role, department }) => ({ userId, role, department: department || undefined })),
      note
    );
    setSelected([]);
    setNote('');
    setQuery('');
    setResults([]);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Assign Ticket" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="assign-search" className="label-text block mb-1.5">
            Search users, departments, or partners
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              id="assign-search"
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="input-field !pl-9"
            />
            {searching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
          </div>

          {results.length > 0 && (
            <ul className="mt-2 border border-base-300 rounded-field max-h-40 overflow-y-auto divide-y divide-base-300">
              {results.map((user) => {
                const isSelected = selected.some((s) => s.userId === user._id);
                return (
                  <li key={user._id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(user)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-base-200 ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <PresenceAvatar user={user} size="xs" showPresence={false} />
                      <span className="flex-1 min-w-0 text-sm truncate">{user.name}</span>
                      <span className="role-badge text-[10px]">{user.role}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected.length > 0 && (
          <div>
            <p className="label-text-alt mb-1.5">Selected ({selected.length})</p>
            <div className="space-y-2">
              {selected.map((s) => (
                <div key={s.userId} className="flex items-center gap-2 bg-base-200 rounded-field px-3 py-2">
                  <PresenceAvatar user={s} size="xs" showPresence={false} />
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate">{s.name}</span>
                  <input
                    type="text"
                    value={s.department}
                    onChange={(e) => setDepartment(s.userId, e.target.value)}
                    placeholder="Department (optional)"
                    className="input-field !w-32 !py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSelect({ _id: s.userId })}
                    className="btn btn-ghost btn-circle btn-xs"
                    aria-label={`Remove ${s.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="assign-note" className="label-text block mb-1.5">
            Note (optional)
          </label>
          <textarea
            id="assign-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add context for the assignee…"
            className="input-field resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected.length === 0 || loading}
            className="btn btn-primary btn-sm"
          >
            {loading ? 'Assigning…' : `Assign to ${selected.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
