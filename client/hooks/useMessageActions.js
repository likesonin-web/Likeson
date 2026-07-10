// src/hooks/useMessageActions.js
'use client';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { isAdminRole } from '../constants/chatConstants';
import { MESSAGE_EDIT_WINDOW_MS } from '../constants/chatConstants';

/** Computes which actions (reply/edit/delete/forward/pin) are valid for a
 * given message + current user, mirroring PermissionService rules on the backend. */
export function useMessageActions(message) {
  const currentUser = useSelector(selectCurrentUser);

  return useMemo(() => {
    if (!message || !currentUser) {
      return { canReply: false, canEdit: false, canDeleteForMe: false, canDeleteForEveryone: false, canForward: false, canPin: false, canReact: false };
    }

    const isOwner = message.sender === currentUser._id || message.sender?._id === currentUser._id;
    const isAdmin = isAdminRole(currentUser.role);
    const isDeleted = message.isDeletedForEveryone || message.type === 'deleted';
    const withinEditWindow = Date.now() - new Date(message.createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS;

    return {
      canReply: !isDeleted,
      canEdit: isOwner && !isDeleted && withinEditWindow && message.type === 'text',
      canDeleteForMe: !isDeleted,
      canDeleteForEveryone: (isOwner || isAdmin) && !isDeleted,
      canForward: !isDeleted,
      canPin: isAdmin,
      canReact: !isDeleted,
    };
  }, [message, currentUser]);
}
