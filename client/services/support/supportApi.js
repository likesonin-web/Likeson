// services/support/supportApi.js
//
// Thin wrapper around the EXISTING shared axios instance (services/api.js —
// same one userSlice/bookingSlice import as `API`). No new axios instance,
// no new interceptors, no new auth handling — all of that is inherited.

import API from '@/store/api';

const BASE = '/support/tickets';

// ── Tickets ─────────────────────────────────────────────────────────────────

export const supportApi = {
  createTicket: (payload) => API.post(BASE, payload).then((r) => r.data),

  listTickets: (params) => API.get(BASE, { params }).then((r) => r.data),

  getTicket: (ticketId) => API.get(`${BASE}/${ticketId}`).then((r) => r.data),

  updateTicket: (ticketId, updates) => API.patch(`${BASE}/${ticketId}`, updates).then((r) => r.data),

  changeStatus: (ticketId, { status, reason }) =>
    API.patch(`${BASE}/${ticketId}/status`, { status, reason }).then((r) => r.data),

  changePriority: (ticketId, { priority, reason }) =>
    API.patch(`${BASE}/${ticketId}/priority`, { priority, reason }).then((r) => r.data),

  assignTicket: (ticketId, { assignees, note }) =>
    API.post(`${BASE}/${ticketId}/assign`, { assignees, note }).then((r) => r.data),

  getAssignmentHistory: (ticketId) => API.get(`${BASE}/${ticketId}/assignment-history`).then((r) => r.data),

  getTimeline: (ticketId, params) => API.get(`${BASE}/${ticketId}/timeline`, { params }).then((r) => r.data),

  rateTicket: (ticketId, { rating, comment }) =>
    API.post(`${BASE}/${ticketId}/rate`, { rating, comment }).then((r) => r.data),

  // ── Participants ────────────────────────────────────────────────────────
  listParticipants: (ticketId) => API.get(`${BASE}/${ticketId}/participants`).then((r) => r.data),

  addParticipant: (ticketId, { userId, role }) =>
    API.post(`${BASE}/${ticketId}/participants`, { userId, role }).then((r) => r.data),

  removeParticipant: (ticketId, userId, reason) =>
    API.delete(`${BASE}/${ticketId}/participants/${userId}`, { data: { reason } }).then((r) => r.data),

  // ── Messages ────────────────────────────────────────────────────────────
  listMessages: (ticketId, params) => API.get(`${BASE}/${ticketId}/messages`, { params }).then((r) => r.data),

  sendMessage: (ticketId, payload) => API.post(`${BASE}/${ticketId}/messages`, payload).then((r) => r.data),

  sendMediaMessage: (ticketId, formData, onUploadProgress) =>
    API.post(`${BASE}/${ticketId}/messages/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }).then((r) => r.data),

  editMessage: (ticketId, messageId, text) =>
    API.patch(`${BASE}/${ticketId}/messages/${messageId}`, { text }).then((r) => r.data),

  deleteMessage: (ticketId, messageId, reason) =>
    API.delete(`${BASE}/${ticketId}/messages/${messageId}`, { data: { reason } }).then((r) => r.data),

  reactToMessage: (ticketId, messageId, emoji) =>
    API.post(`${BASE}/${ticketId}/messages/${messageId}/react`, { emoji }).then((r) => r.data),

  markRead: (ticketId, upToMessageId) =>
    API.post(`${BASE}/${ticketId}/messages/read`, { upToMessageId }).then((r) => r.data),

  // ── Search (aggregation-based, related-entity-name search) ────────────────
  searchByEntityName: (params) => API.get(`${BASE}/search/entities`, { params }).then((r) => r.data),

  // ── Analytics ───────────────────────────────────────────────────────────
  getAnalyticsOverview: (params) => API.get('/support/analytics/overview', { params }).then((r) => r.data),
  getAnalyticsVolume: (params) => API.get('/support/analytics/volume', { params }).then((r) => r.data),
  getAnalyticsResponseTimes: (params) => API.get('/support/analytics/response-times', { params }).then((r) => r.data),
  getAnalyticsSLA: (params) => API.get('/support/analytics/sla', { params }).then((r) => r.data),
  getAnalyticsCategoryBreakdown: (params) =>
    API.get('/support/analytics/categories', { params }).then((r) => r.data),
  getAnalyticsAgentWorkload: (params) => API.get('/support/analytics/agent-workload', { params }).then((r) => r.data),
  getAnalyticsCSAT: (params) => API.get('/support/analytics/csat', { params }).then((r) => r.data),
  exportAnalytics: (params) =>
    API.get('/support/analytics/export', { params, responseType: 'blob' }).then((r) => r.data),
};

export default supportApi;