// services/timeline.service.js

import SupportTimeline from '../models/SupportTimeline.js';
import SupportTicket from '../models/SupportTicket.js';
import { MAX_INLINE_TIMELINE_ENTRIES } from '../constants/support.constants.js';

/**
 * Records a timeline event to BOTH the permanent SupportTimeline collection
 * and the ticket's bounded inline cache, in one call, so no caller can ever
 * write to one and forget the other.
 *
 * @param {Object} params
 * @param {import('mongoose').ClientSession} [params.session]  active txn session, if any
 */
export async function recordTimelineEvent({
  ticketId,
  event,
  actor = null,
  actorRole = null,
  summary = '',
  metadata = {},
  relatedMessage = null,
  session = null,
}) {
  const [entry] = await SupportTimeline.create(
    [{ ticket: ticketId, event, actor, actorRole, summary, metadata, relatedMessage }],
    session ? { session } : {}
  );

  await SupportTicket.updateOne(
    { _id: ticketId },
    {
      $push: {
        timelineCache: {
          $each: [{ event, actor, summary, createdAt: entry.createdAt }],
          $slice: -MAX_INLINE_TIMELINE_ENTRIES,
        },
      },
    },
    session ? { session } : {}
  );

  return entry;
}

/**
 * Full chronological timeline for a ticket (uncapped, paginated).
 */
export async function getTicketTimeline(ticketId, { limit = 100, before = null } = {}) {
  const filter = { ticket: ticketId };
  if (before) filter.createdAt = { $lt: before };

  return SupportTimeline.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'name role avatar')
    .lean();
}
