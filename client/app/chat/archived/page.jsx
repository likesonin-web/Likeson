'use client';
// src/app/chat/archived/page.jsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArchiveX } from 'lucide-react';
import ConversationList from '../../../components/chat/conversation/ConversationList';
import { fetchConversations, selectConversations } from '@/store/slices/conversationSlice';

export default function ArchivedConversationsPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const items = useSelector(selectConversations);

  useEffect(() => {
    dispatch(fetchConversations({ archived: true }));
  }, [dispatch]);

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-base-300">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="btn btn-ghost btn-circle btn-sm">
          <ArrowLeft size={18} />
        </button>
        <ArchiveX size={16} className="text-base-content/50" />
        <h1 className="text-sm font-bold">Archived Conversations</h1>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ConversationList items={items} />
      </div>
    </div>
  );
}
