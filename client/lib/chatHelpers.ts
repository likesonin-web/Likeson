/**
 * Pure display/formatting helpers shared across components/chat/*.
 * No React, no side effects — safe to unit test in isolation.
 */

export function getOtherParticipant(conversation, currentUserId) {
  if (!conversation?.participants) return null;
  return (
    conversation.participants.find((p) => {
      const id = p.user?._id || p.user;
      return id?.toString() !== currentUserId?.toString();
    }) || null
  );
}

export function getConversationDisplay(conversation, currentUserId) {
  if (!conversation) return { name: 'Unknown', avatar: null, subtitle: '', online: false };

  if (conversation.type === 'direct') {
    const other = getOtherParticipant(conversation, currentUserId);
    const user = other?.user || {};
    return {
      name: user.name || 'Unknown user',
      avatar: user.avatar || null,
      subtitle: user.role || '',
      online: Boolean(user.isOnline),
      lastseen: user.lastseen,
      userId: user._id,
    };
  }

  return {
    name: conversation.name || 'Group chat',
    avatar: conversation.avatar || null,
    subtitle: `${conversation.participants?.filter((p) => !p.isDeleted).length || 0} members`,
    online: false,
  };
}

export function formatMessageTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatListTimestamp(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(
    [],
    sameYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' },
  );
}

export function formatLastSeen(date) {
  if (!date) return 'Offline';
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function groupMessagesByDay(messages = []) {
  const groups = [];
  let current = null;
  for (const msg of messages) {
    const day = new Date(msg.createdAt).toDateString();
    if (!current || current.day !== day) {
      current = { day, date: msg.createdAt, items: [] };
      groups.push(current);
    }
    current.items.push(msg);
  }
  return groups;
}

export function dayLabel(date) {
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });
}

export const MESSAGE_TYPE_LABEL = {
  image: 'Photo',
  video: 'Video',
  audio: 'Voice message',
  file: 'Document',
  location: 'Location',
  contact: 'Contact',
  sticker: 'Sticker',
  call_log: 'Call',
  system: 'System',
  order_card: 'Order update',
};
