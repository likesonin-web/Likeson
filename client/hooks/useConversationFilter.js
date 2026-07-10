// src/hooks/useConversationFilter.js
'use client';
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectConversations } from '@/store/slices/conversationSlice';

const TABS = ['all', 'unread', 'groups', 'complaints', 'pinned'];

export function useConversationFilter() {
  const [tab, setTab] = useState('all');
  const conversations = useSelector(selectConversations);

  const filtered = useMemo(() => {
    switch (tab) {
      case 'unread':
        return conversations.filter((i) => i.unreadCount > 0);
      case 'groups':
        return conversations.filter((i) => i.conversation.type === 'group');
      case 'complaints':
        return conversations.filter((i) => i.conversation.type === 'complaint');
      case 'pinned':
        return conversations.filter((i) => i.isPinned);
      default:
        return conversations;
    }
  }, [conversations, tab]);

  return { tab, setTab, tabs: TABS, filtered };
}
