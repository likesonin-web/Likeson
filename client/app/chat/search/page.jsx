'use client';
// src/app/chat/search/page.jsx
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft } from 'lucide-react';
import SearchBar from '../../../components/chat/common/SearchBar';
import { EmptyState } from '../../../components/chat/common/EmptyState';
import { SearchX } from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { searchMessages, selectSearchResults } from '@/store/slices/messageSlice';
import { formatConversationTimestamp, truncatePreview } from '../../../utils/chatFormatters';

/**
 * Handles both "search within a conversation" (conversationId query param
 * present) and a general search entry point. Global cross-conversation
 * search uses SearchService on the backend if wired to its own route;
 * this page defaults to the per-conversation search endpoint already built.
 */
export default function SearchMessagesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const conversationId = params.get('conversationId');
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);
  const results = useSelector(selectSearchResults(conversationId));

  useEffect(() => {
    if (conversationId && debouncedQuery.trim()) {
      dispatch(searchMessages({ conversationId, q: debouncedQuery.trim() }));
    }
  }, [debouncedQuery, conversationId, dispatch]);

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-base-300">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="btn btn-ghost btn-circle btn-sm">
          <ArrowLeft size={18} />
        </button>
        <SearchBar value={query} onChange={setQuery} placeholder="Search messages…" autoFocus className="flex-1" />
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!query.trim() ? (
          <EmptyState icon={SearchX} title="Search messages" description="Type to search within this conversation." />
        ) : results.length === 0 ? (
          <EmptyState icon={SearchX} title="No results" description={`No messages match "${query}".`} />
        ) : (
          <ul role="list" className="divide-y divide-base-300">
            {results.map((m) => (
              <li key={m._id}>
                <button
                  type="button"
                  onClick={() => router.push(`/chat/${conversationId}#${m._id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors"
                >
                  <p className="text-sm text-base-content truncate">{truncatePreview(m.body, 90)}</p>
                  <p className="text-xs text-base-content/45 mt-0.5">{formatConversationTimestamp(m.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
