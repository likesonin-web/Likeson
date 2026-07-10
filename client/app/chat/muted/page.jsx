'use client';
// src/app/chat/muted/page.jsx
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { ArrowLeft, BellOff } from 'lucide-react';
import ConversationList from '../../../components/chat/conversation/ConversationList';
import { selectConversations } from '@/store/slices/conversationSlice';

export default function MutedConversationsPage() {
  const router = useRouter();
  const conversations = useSelector(selectConversations);
  const mutedOnly = conversations.filter((i) => i.isMuted);

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-base-300">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="btn btn-ghost btn-circle btn-sm">
          <ArrowLeft size={18} />
        </button>
        <BellOff size={16} className="text-base-content/50" />
        <h1 className="text-sm font-bold">Muted Conversations</h1>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ConversationList items={mutedOnly} />
      </div>
    </div>
  );
}
