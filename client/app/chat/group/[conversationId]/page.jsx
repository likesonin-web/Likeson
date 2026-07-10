'use client';
// src/app/chat/group/[conversationId]/page.jsx
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import ChatLayout from '../../../../components/chat/layout/ChatLayout';
import GroupHeader from '../../../../components/chat/group/GroupHeader';
import MessageContainer from '../../../../components/chat/message/MessageContainer';
import MessageInput from '../../../../components/chat/message/MessageInput';
import { LoadingState } from '../../../../components/chat/common/LoadingState';
import { useChat } from '../../../../hooks/useChat';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { isAdminRole } from '../../../../constants/chatConstants';
import { renameGroup, lockGroup, archiveGroup, deleteGroup } from '@/store/slices/groupSlice';

export default function GroupChatPage() {
  const { conversationId } = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const [replyingTo, setReplyingTo] = useState(null);

  const {
    conversation, messages, hasMore, isLoading, loadMore, typingUserIds,
    notifyTyping, stopTyping, sentinelRef, send, edit, removeForMe, removeForEveryone, forward,
  } = useChat(conversationId);

  if (!conversation) return <LoadingState fullHeight label="Loading group…" />;

  const isAdmin = isAdminRole(currentUser?.role);
  const isLocked = conversation.group?.isLocked;
  const canPost = isAdmin || !isLocked;

  const handleRename = () => {
    const title = window.prompt('New group name:', conversation.title);
    if (!title) return;
    dispatch(renameGroup({ conversationId, title }));
  };

  const handleLockToggle = () => {
    dispatch(lockGroup({ conversationId, locked: !isLocked }));
  };

  const handleArchive = () => {
    dispatch(archiveGroup({ conversationId, archived: true }));
    router.push('/chat');
  };

  const handleDelete = () => {
    if (!window.confirm('Delete this group? This cannot be undone.')) return;
    dispatch(deleteGroup(conversationId));
    router.push('/chat');
  };

  return (
    <ChatLayout showSidebarOnMobile={false}>
      <GroupHeader
        conversation={conversation}
        isAdmin={isAdmin}
        onRename={handleRename}
        onLockToggle={handleLockToggle}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onOpenMembers={() => router.push(`/chat/group/${conversationId}/members`)}
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
        disabled={!canPost}
        disabledReason="This group is locked. Only admins can post."
      />
    </ChatLayout>
  );
}