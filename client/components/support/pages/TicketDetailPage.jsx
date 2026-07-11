'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  fetchTicketById,
  fetchParticipants,
  fetchTicketTimeline,
  changeTicketStatus,
  changeTicketPriority,
  assignTicket,
  removeParticipant,
  rateTicket,
  touchRecentlyViewed,
  selectActiveTicket,
  selectActiveTicketLoading,
  selectActiveTicketError,
  selectParticipantsForTicket,
  selectTimelineForTicket,
  selectTicketLoaders,
} from '@/store/slices/ticketSlice';
import { isStaff } from '@/features/support/utils/permissions';
import ChatWindow from '@/components/support/chat/ChatWindow';
import TicketHeader from '@/components/support/ticket/TicketHeader';
import ParticipantList from '@/components/support/ticket/ParticipantList';
import Timeline from '@/components/support/ticket/Timeline';
import AuditTimeline from '@/components/support/ticket/AuditTimeline';
import AssignmentModal from '@/components/support/ticket/AssignmentModal';
import { MessageThreadSkeleton } from '@/components/support/shared/Skeletons';
import { ErrorState } from '@/components/support/shared/StateViews';

const TABS = ['Timeline', 'Participants', 'Audit'];

/**
 * @param {{ ticketId: string, backHref: string, currentUser: object }} props
 */
export default function TicketDetailPage({ ticketId, backHref, currentUser, loginHref = '/login' }) {
  const dispatch = useDispatch();
  const ticket = useSelector(selectActiveTicket);
  const loading = useSelector(selectActiveTicketLoading);
  const ticketError = useSelector(selectActiveTicketError);
  const participants = useSelector(selectParticipantsForTicket(ticketId));
  const timeline = useSelector(selectTimelineForTicket(ticketId));
  const loaders = useSelector(selectTicketLoaders);

  const [activeTab, setActiveTab] = useState('Timeline');
  const [assignOpen, setAssignOpen] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    dispatch(fetchTicketById(ticketId));
    dispatch(fetchParticipants(ticketId));
    dispatch(fetchTicketTimeline({ ticketId }));
    dispatch(touchRecentlyViewed(ticketId));
  }, [ticketId, dispatch, currentUser]);

  // No one logged in at all — show this before anything below ever touches
  // `currentUser.role`, which used to throw here instead of rendering a
  // message when currentUser was missing.
  if (!currentUser) {
    return (
      <ErrorState
        icon="lock"
        title="Please log in"
        description="You need to be signed in to view this conversation."
        action={{ label: 'Log in', onClick: () => window.location.assign(loginHref) }}
      />
    );
  }

  const staff = isStaff(currentUser.role);

  if (loading && !ticket) return <MessageThreadSkeleton />;

  // Logged in, but not allowed to see THIS ticket (wrong role / not a
  // participant) — a distinct message from a plain "doesn't exist", so
  // people aren't left guessing which one it is.
  if (!ticket && ticketError?.status === 403) {
    return (
      <ErrorState
        icon="lock"
        title="You don't have access to this ticket"
        description="This conversation belongs to a different account or role. If you think this is a mistake, contact support."
        action={{ label: 'Go back', onClick: () => window.location.assign(backHref) }}
      />
    );
  }

  if (!ticket) {
    return (
      <ErrorState
        title="Ticket not found"
        description="It may have been removed, or the link is incorrect."
        action={{ label: 'Go back', onClick: () => window.location.assign(backHref) }}
      />
    );
  }

  const isOwner = ticket.createdBy === currentUser._id || ticket.createdBy?._id === currentUser._id;
  const canRate = isOwner && ticket.status === 'resolved' && !ratingSubmitted;

  return (
    <div className="space-y-4">
      <TicketHeader
        ticket={ticket}
        isStaff={staff}
        backHref={backHref}
        onChangeStatus={(status) => dispatch(changeTicketStatus({ ticketId, status }))}
        onChangePriority={(priority) => dispatch(changeTicketPriority({ ticketId, priority }))}
        onOpenAssign={() => setAssignOpen(true)}
      />

      {canRate && (
        <RatingPrompt
          onSubmit={(rating, comment) => {
            dispatch(rateTicket({ ticketId, rating, comment }));
            setRatingSubmitted(true);
          }}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden" style={{ height: '65vh' }}>
          <ChatWindow ticketId={ticketId} currentUser={currentUser} />
        </div>

        <div className="card p-4 overflow-y-auto" style={{ height: '65vh' }}>
          <div className="flex gap-1 mb-4 border-b border-base-300">
            {TABS.filter((t) => t !== 'Audit' || staff).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-base-content/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            {activeTab === 'Timeline' && <Timeline entries={timeline} />}
            {activeTab === 'Participants' && (
              <ParticipantList
                participants={participants}
                isStaff={staff}
                onRemove={staff ? (userId) => dispatch(removeParticipant({ ticketId, userId })) : undefined}
              />
            )}
            {activeTab === 'Audit' && staff && <AuditTimeline entries={timeline} />}
          </motion.div>
        </div>
      </div>

      <AssignmentModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssign={async (assignees, note) => {
          await dispatch(assignTicket({ ticketId, assignees, note }));
          setAssignOpen(false);
        }}
        loading={loaders.assign}
      />
    </div>
  );
}

function RatingPrompt({ onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <div className="card p-4 bg-success/5 border-success/30">
      <p className="text-sm font-bold mb-2">How did we do?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="text-2xl" aria-label={`${n} stars`}>
            {n <= rating ? '★' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Any additional feedback? (optional)"
        rows={2}
        className="input-field resize-none mb-3"
      />
      <button type="button" onClick={() => onSubmit(rating, comment)} disabled={rating === 0} className="btn btn-success btn-sm">
        Submit & close ticket
      </button>
    </div>
  );
}