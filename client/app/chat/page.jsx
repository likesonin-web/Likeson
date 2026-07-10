'use client';
// src/app/chat/page.jsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import ChatLayout from '../../components/chat/layout/ChatLayout';
import { EmptyState } from '../../components/chat/common/EmptyState';
import { MessageSquarePlus } from 'lucide-react';
import { createDirectConversation } from '@/store/slices/conversationSlice';
import { useChatNotifications } from '../../hooks/useChatNotifications';

/**
 * Chat Dashboard — the default /chat route. On desktop, shows sidebar +
 * this empty state. On mobile, shows only the conversation list
 * (ChatLayout hides the empty pane on mobile automatically).
 */
export default function ChatDashboardPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  useChatNotifications();

  const handleNewChat = async () => {
    // In production, open a UserPicker modal here; wired directly for brevity.
    const targetUserId = window.prompt('Enter user ID to start a conversation with:');
    if (!targetUserId) return;
    const result = await dispatch(createDirectConversation(targetUserId));
    if (result.payload?._id) router.push(`/chat/${result.payload._id}`);
  };

  const handleNewGroup = () => router.push('/chat/group/new');

  return (
    <ChatLayout onNewChat={handleNewChat} onNewGroup={handleNewGroup}>
      <EmptyState
        icon={MessageSquarePlus}
        title="Select a conversation"
        description="Choose a conversation from the list, or start a new one."
        className="h-full justify-center"
      />
    </ChatLayout>
  );
}
