/**
 * Centralized chat permission rules.
 *
 * Every chat component derives its button/action visibility from this file
 * instead of re-deriving role checks inline. Pass the raw conversation
 * object (with populated `participants`) and the logged-in user.
 */

const EDIT_WINDOW_MS = 15 * 60 * 1000; // mirrors backend EDIT_WINDOW_MS in chatService.js

const getParticipant = (conversation, userId) => {
  if (!conversation?.participants || !userId) return null;
  return (
    conversation.participants.find((p) => {
      const pid = p.user?._id || p.user;
      return pid?.toString() === userId.toString();
    }) || null
  );
};

export function getChatPermissions(conversation, currentUser) {
  const userId = currentUser?._id;
  const participant = getParticipant(conversation, userId);

  const isParticipant = Boolean(participant) && !participant?.isDeleted;
  const isDirect = conversation?.type === 'direct';
  const isGroup = conversation?.type === 'group';
  const isLinked = ['order', 'service', 'support'].includes(conversation?.type);
  const isGroupAdmin = isGroup && Boolean(participant?.isAdmin);
  const isBlocked = Boolean(conversation?.isBlocked);

  return {
    isParticipant,
    isDirect,
    isGroup,
    isLinked,
    isGroupAdmin,
    isBlocked,

    // Conversation-level actions
    canSendMessage: isParticipant && !isBlocked,
    canCall: isParticipant && !isBlocked && (isDirect || isGroup),
    canVideoCall: isParticipant && !isBlocked && (isDirect || isGroup),
    canViewInfo: isParticipant,
    canMute: isParticipant,
    canArchive: isParticipant,
    canClear: isParticipant,
    canBlock: isDirect && isParticipant,
    canSearch: isParticipant,
    canForward: isParticipant,
    canReply: isParticipant && !isBlocked,
    canReact: isParticipant && !isBlocked,
    canPinMessage: isParticipant && (isDirect || isGroupAdmin),

    // Group management — only group admins, never against the group creator
    canManageGroup: isGroup && isGroupAdmin,
    canEditGroupInfo: isGroup && isGroupAdmin,
    canAddMembers: isGroup && isGroupAdmin,
    canLeaveGroup: isGroup && isParticipant,
    canRemoveMember: (memberId) =>
      isGroup &&
      isGroupAdmin &&
      memberId?.toString() !== conversation?.createdBy?.toString(),
    canToggleAdmin: (memberId) =>
      isGroup &&
      isGroupAdmin &&
      memberId?.toString() !== conversation?.createdBy?.toString(),

    // Per-message actions
    canEditMessage: (message) =>
      isParticipant &&
      message?.type === 'text' &&
      !message?.isDeleted &&
      !message?.deletedForAll &&
      (message?.sender?._id || message?.sender)?.toString() === userId?.toString() &&
      Date.now() - new Date(message?.createdAt).getTime() < EDIT_WINDOW_MS,

    canDeleteForAll: (message) =>
      isParticipant &&
      !message?.deletedForAll &&
      (message?.sender?._id || message?.sender)?.toString() === userId?.toString(),

    canDeleteForMe: (message) => isParticipant && !message?.deletedForAll,
  };
}

export default getChatPermissions;
