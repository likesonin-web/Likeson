'use client';
// src/app/chat/group/[conversationId]/members/page.jsx
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft } from 'lucide-react';
import GroupMembers from '../../../../../components/chat/group/GroupMembers';
import { LoadingState } from '../../../../../components/chat/common/LoadingState';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { isAdminRole } from '../../../../../constants/chatConstants';
import {
  fetchGroupMembers,
  assignModerator,
  muteGroupMember,
  removeGroupMember,
  selectGroupMembers,
} from '@/store/slices/groupSlice';

export default function GroupMembersPage() {
  const { conversationId } = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = isAdminRole(currentUser?.role);
  const members = useSelector(selectGroupMembers(conversationId));

  useEffect(() => {
    dispatch(fetchGroupMembers(conversationId));
  }, [dispatch, conversationId]);

  const handleAssignModerator = (userId) => {
    dispatch(assignModerator({ conversationId, userId }));
  };

  const handleMute = (userId, muted) => {
    dispatch(muteGroupMember({ conversationId, userId, muted }));
  };

  const handleRemove = (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    dispatch(removeGroupMember({ conversationId, userId }));
  };

  if (!members) return <LoadingState fullHeight label="Loading members…" />;

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-base-300">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="btn btn-ghost btn-circle btn-sm">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-bold">Group Members ({members.length})</h1>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <GroupMembers
          members={members}
          isAdmin={isAdmin}
          onAssignModerator={handleAssignModerator}
          onMute={handleMute}
          onRemove={handleRemove}
        />
      </div>
    </div>
  );
}