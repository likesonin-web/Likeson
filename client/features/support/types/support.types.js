// features/support/types/support.types.js
//
// Plain JS project — no TypeScript, no .ts/.tsx files anywhere. These JSDoc
// typedefs exist purely for editor intellisense (VS Code/WebStorm both read
// JSDoc without any TS toolchain) and as living documentation of the shapes
// flowing between this frontend and the backend Support Ticket module.
// They are never imported at runtime — .js files only, nothing compiled.

/**
 * @typedef {Object} SupportTicket
 * @property {string} _id
 * @property {string} ticketNumber
 * @property {string} ticketType
 * @property {string} subject
 * @property {string} description
 * @property {string} createdBy
 * @property {string} createdByRole
 * @property {string|null} booking
 * @property {string} status
 * @property {string} priority
 * @property {Array<{userId: string, role: string, department?: string, assignedAt: string}>} currentAssignees
 * @property {string[]} visibleTo
 * @property {Array<{attachment: string, url: string, fileType: string, uploadedAt: string}>} attachments
 * @property {Object} metadata
 * @property {{phone?: string, email?: string, name?: string}} contactSnapshot
 * @property {{firstResponseDueAt?: string, resolutionDueAt?: string, firstRespondedAt?: string|null, resolvedAt?: string|null, firstResponseBreached: boolean, resolutionBreached: boolean}} sla
 * @property {Array<{event: string, actor?: string, summary?: string, createdAt: string}>} timelineCache
 * @property {string|null} rating
 * @property {string|null} firstAssignedAt
 * @property {string|null} resolvedAt
 * @property {string|null} closedAt
 * @property {number} reopenedCount
 * @property {boolean} isEscalated
 * @property {string|null} lastMessageAt
 * @property {string} [lastMessagePreview]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} SupportMessage
 * @property {string} _id
 * @property {string} ticket
 * @property {string|{_id: string, name: string, role: string, avatar?: string}} sender
 * @property {string} senderRole
 * @property {string} messageType
 * @property {string} text
 * @property {SupportAttachment|null} attachment
 * @property {string|SupportMessage|null} replyTo
 * @property {string[]} mentions
 * @property {boolean} isInternalNote
 * @property {string} status
 * @property {Array<{userId: string, deliveredAt: string|null, readAt: string|null}>} receipts
 * @property {Array<{userId: string, emoji: string, createdAt: string}>} reactions
 * @property {string|null} clientMessageId
 * @property {boolean} isEdited
 * @property {boolean} isDeleted
 * @property {string} createdAt
 */

/**
 * @typedef {Object} SupportAttachment
 * @property {string} url
 * @property {string} fileId
 * @property {string} fileType
 * @property {string} originalName
 * @property {number} sizeBytes
 * @property {string} mimeType
 * @property {number} [durationSeconds]
 * @property {string|null} [thumbnailUrl]
 */

/**
 * @typedef {Object} SupportParticipant
 * @property {string} _id
 * @property {string} ticket
 * @property {{_id: string, name: string, role: string, avatar?: string, isOnline?: boolean, lastseen?: string}} userId
 * @property {string} role
 * @property {string} joinedAt
 * @property {string} joinedBy
 * @property {string|null} leftAt
 * @property {boolean} active
 * @property {string|null} lastReadMessage
 * @property {string|null} lastReadAt
 * @property {string|null} lastSeen
 * @property {boolean} isOnline
 * @property {boolean} isTyping
 * @property {boolean} isMuted
 */

/**
 * @typedef {Object} AssignmentHistoryEntry
 * @property {string} _id
 * @property {string} ticket
 * @property {'assigned'|'reassigned'|'unassigned'|'transferred'} action
 * @property {Array<{userId: {_id: string, name: string, role: string, avatar?: string}, role: string, department?: string}>} assignees
 * @property {Array<{userId: string, role: string, department?: string}>} previousAssignees
 * @property {{_id: string, name: string, role: string}} performedBy
 * @property {string} [note]
 * @property {string} createdAt
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {string} _id
 * @property {string} ticket
 * @property {string} event
 * @property {{_id: string, name: string, role: string, avatar?: string}|null} actor
 * @property {string} [actorRole]
 * @property {string} summary
 * @property {Object} metadata
 * @property {string|null} relatedMessage
 * @property {string} createdAt
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {Array<any>} items
 * @property {boolean} hasMore
 * @property {string|null} nextCursor
 */

/**
 * @typedef {Object} SocketConnectionState
 * @property {boolean} connected
 * @property {boolean} connecting
 * @property {boolean} reconnecting
 * @property {number} reconnectAttempt
 * @property {string|null} lastError
 */

export {};
