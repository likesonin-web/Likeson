'use client';
// src/app/chat/[conversationId]/page.jsx
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import ChatLayout from '../../../components/chat/layout/ChatLayout';
import ConversationHeader from '../../../components/chat/conversation/ConversationHeader';
import ConversationMenu from '../../../components/chat/conversation/ConversationMenu';
import MessageContainer from '../../../components/chat/message/MessageContainer';
import MessageInput from '../../../components/chat/message/MessageInput';
import { LoadingState } from '../../../components/chat/common/LoadingState';
import { useChat } from '../../../hooks/useChat';
import { archiveConversation, pinConversation, muteConversation, deleteConversation } from '@/store/slices/conversationSlice';
import ConfirmationModal from '../../../components/chat/common/ConfirmationModal';

export default function ConversationPage() {
  const { conversationId } = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const [replyingTo, setReplyingTo] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    conversation, messages, hasMore, isLoading, loadMore, typingUserIds,
    notifyTyping, stopTyping, sentinelRef, send, edit, removeForMe, removeForEveryone, forward,
  } = useChat(conversationId);

  if (!conversation) return <LoadingState fullHeight label="Loading conversation…" />;

  // Redirect group/complaint types to their dedicated page shells (different header/actions).
  if (conversation.type === 'group') router.replace(`/chat/group/${conversationId}`);
  if (conversation.type === 'complaint') router.replace(`/chat/complaint/${conversationId}`);

  const otherUser = conversation.otherParticipant;

  return (
    <ChatLayout showSidebarOnMobile={false}>
      <ConversationHeader
        conversation={conversation}
        otherUser={otherUser}
        onOpenInfo={() => setShowInfo(true)}
        onPin={() => dispatch(pinConversation({ conversationId, pinned: true }))}
        onMute={() => dispatch(muteConversation({ conversationId, muted: true }))}
        onArchive={() => dispatch(archiveConversation({ conversationId, archived: true }))}
        onDelete={() => setShowDeleteConfirm(true)}
      />

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

      <ConversationMenu
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        otherUser={otherUser}
        isPinned={false}
        isMuted={false}
        onPin={() => dispatch(pinConversation({ conversationId, pinned: true }))}
        onMute={() => dispatch(muteConversation({ conversationId, muted: true }))}
        onArchive={() => dispatch(archiveConversation({ conversationId, archived: true }))}
        onDelete={() => setShowDeleteConfirm(true)}
        onSearchMessages={() => router.push(`/chat/search?conversationId=${conversationId}`)}
        onViewAttachments={() => router.push(`/chat/${conversationId}/attachments`)}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete conversation?"
        description="This will remove the conversation. This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await dispatch(deleteConversation(conversationId));
          setShowDeleteConfirm(false);
          router.push('/chat');
        }}
      />
    </ChatLayout>
  );
}
