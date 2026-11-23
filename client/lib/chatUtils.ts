/**
 * lib/chatUtils.js
 */

export function getConvoName(conversation, currentUserId) {
  if (!conversation) return '';
  if (conversation.type === 'group' || conversation.name) return conversation.name || 'Group';

  // Direct: show the OTHER person's name
  const other = conversation.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() !== currentUserId?.toString() && !p.isDeleted
  );
  return other?.user?.name || 'Unknown';
}

export function getConvoAvatar(conversation, currentUserId) {
  if (!conversation) return null;
  if (conversation.avatar) return conversation.avatar;
  if (conversation.type === 'group') return null;

  const other = conversation.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() !== currentUserId?.toString() && !p.isDeleted
  );
  return other?.user?.avatar || null;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

export function formatRelativeTime(dateStr: string | number | Date) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60)   return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;

  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}