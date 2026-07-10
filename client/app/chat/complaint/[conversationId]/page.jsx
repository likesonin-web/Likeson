'use client';
// src/app/chat/complaint/[conversationId]/page.jsx
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import ChatLayout from '../../../../components/chat/layout/ChatLayout';
import ComplaintHeader from '../../../../components/chat/complaint/ComplaintHeader';
import ComplaintTimeline from '../../../../components/chat/complaint/ComplaintTimeline';
import AdminAssignmentCard from '../../../../components/chat/complaint/AdminAssignmentCard';
import MessageContainer from '../../../../components/chat/message/MessageContainer';
import MessageInput from '../../../../components/chat/message/MessageInput';
import { LoadingState } from '../../../../components/chat/common/LoadingState';
import { useChat } from '../../../../hooks/useChat';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { isAdminRole } from '../../../../constants/chatConstants';
import API from '@/store/api';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

export default function ComplaintChatPage() {
  const { conversationId } = useParams();
  const currentUser = useSelector(selectCurrentUser);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);

  const {
    conversation, messages, hasMore, isLoading, loadMore, typingUserIds,
    notifyTyping, stopTyping, sentinelRef, send, edit, removeForMe, removeForEveryone, forward,
  } = useChat(conversationId);

  const isAdmin = isAdminRole(currentUser?.role);

  const loadTimeline = async () => {
    try {
      const { data } = await API.get(`/support/complaints/${conversationId}/timeline`);
      setTimelineEvents(data.data ?? []);
    } catch {
      toast.error('Could not load timeline.');
    }
  };

  useEffect(() => { if (showTimeline) loadTimeline(); }, [showTimeline]);

  const handleStatusChange = async (status) => {
    try {
      await API.patch(`/support/complaints/${conversationId}/status`, { status });
      toast.success(`Status updated to ${status}.`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update status.');
    }
  };

  if (!conversation) return <LoadingState fullHeight label="Loading complaint…" />;

  return (
    <ChatLayout showSidebarOnMobile={false}>
      <ComplaintHeader conversation={conversation} onOpenTimeline={() => setShowTimeline(true)} />

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0">
          <MessageContainer
            messages={messages}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            typingUserIds={typingUserIds}
            sentinelRef={sentinelRef}
            onReply={setReplyingTo}
            onEdit={(msg) => {
              const newBody = window.prompt('Edit message:', msg.body);
              if (newBody && newBody !== msg.body) edit(msg._id, newBody);
            }}
            onForward={(msg) => {
              const targetId = window.prompt('Forward to conversation ID:');
              if (targetId) forward(msg._id, targetId);
            }}
            onDeleteForMe={removeForMe}
            onDeleteForEveryone={removeForEveryone}
          />

          <MessageInput
            conversationId={conversationId}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onSend={send}
            onTyping={notifyTyping}
            onStopTyping={stopTyping}
          />
        </div>

        {isAdmin && (
          <aside className="hidden lg:block w-72 border-l border-base-300 p-4 overflow-y-auto scrollbar-thin">
            <AdminAssignmentCard
              complaint={conversation.complaint}
              assignee={conversation.complaint?.assignedTo}
              onStatusChange={handleStatusChange}
            />
          </aside>
        )}
      </div>

      <AnimatePresence>
        {showTimeline && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowTimeline(false)} className="fixed inset-0 z-40 bg-black/30" />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-base-100 border-l border-base-300 p-4 overflow-y-auto scrollbar-thin"
            >
              <h2 className="text-sm font-bold mb-4">Complaint Timeline</h2>
              <ComplaintTimeline events={timelineEvents} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </ChatLayout>
  );
}
