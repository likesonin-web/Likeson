// services/search.service.js
//
// ticket.service.js#listTickets handles the common filter/search case with
// a plain find() (fast, index-backed). This service exists specifically for
// the search-by-RELATED-ENTITY-NAME case (doctor name, hospital name,
// partner name) which requires a $lookup since SupportTicket only stores
// the assignee's userId/role, not a denormalized name — an aggregation
// pipeline, kept separate so the hot-path listTickets() query never pays
// for a $lookup it doesn't need.

import SupportTicket from '../models/SupportTicket.js';
import { STAFF_ROLES, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/support.constants.js';

export async function searchTicketsByEntityName({ actor, term, page = 1, limit = DEFAULT_PAGE_SIZE }) {
  const safeLimit = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * safeLimit;

  const visibilityMatch =
    STAFF_ROLES.includes(actor.role) && actor.role !== 'finance' ? {} : { visibleTo: actor._id };

  const pipeline = [
    { $match: visibilityMatch },
    {
      $lookup: {
        from: 'users',
        localField: 'currentAssignees.userId',
        foreignField: '_id',
        as: 'assigneeUsers',
      },
    },
    {
      $match: {
        $or: [
          { ticketNumber: { $regex: term, $options: 'i' } },
          { 'contactSnapshot.name': { $regex: term, $options: 'i' } },
          { 'contactSnapshot.phone': { $regex: term, $options: 'i' } },
          { 'contactSnapshot.email': { $regex: term, $options: 'i' } },
          { 'assigneeUsers.name': { $regex: term, $options: 'i' } },
          { 'metadata.transactionId': { $regex: term, $options: 'i' } },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: safeLimit },
    {
      $project: {
        ticketNumber: 1,
        ticketType: 1,
        status: 1,
        priority: 1,
        subject: 1,
        createdAt: 1,
        contactSnapshot: 1,
        currentAssignees: 1,
        'assigneeUsers.name': 1,
        'assigneeUsers.role': 1,
      },
    },
  ];

  const [results, totalCountResult] = await Promise.all([
    SupportTicket.aggregate(pipeline),
    SupportTicket.aggregate([
      { $match: visibilityMatch },
      {
        $lookup: { from: 'users', localField: 'currentAssignees.userId', foreignField: '_id', as: 'assigneeUsers' },
      },
      {
        $match: {
          $or: [
            { ticketNumber: { $regex: term, $options: 'i' } },
            { 'contactSnapshot.name': { $regex: term, $options: 'i' } },
            { 'assigneeUsers.name': { $regex: term, $options: 'i' } },
          ],
        },
      },
      { $count: 'total' },
    ]),
  ]);

  return {
    items: results,
    total: totalCountResult[0]?.total ?? 0,
    page,
    limit: safeLimit,
  };
}
