// constants/complaintConstants.js

export const COMPLAINT_STATUSES = [
  'Open', 'Assigned', 'In Progress', 'Waiting Customer', 'Resolved', 'Closed',
];

export const COMPLAINT_STATUS_TRANSITIONS = {
  Open:               ['Assigned', 'Closed'],
  Assigned:           ['In Progress', 'Waiting Customer', 'Closed'],
  'In Progress':      ['Waiting Customer', 'Resolved', 'Closed'],
  'Waiting Customer':  ['In Progress', 'Resolved', 'Closed'],
  Resolved:           ['Closed', 'In Progress'],
  Closed:             [], // terminal — reopen must create a new complaint
};

export const COMPLAINT_CATEGORIES = [
  'Payment', 'Settlement', 'Booking', 'Technical Issue', 'Verification',
  'KYC', 'Customer Abuse', 'Partner Abuse', 'Feature Request',
  'Bug Report', 'Emergency', 'Other',
];

export const COMPLAINT_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent', 'Critical'];

export const isValidStatusTransition = (from, to) =>
  Array.isArray(COMPLAINT_STATUS_TRANSITIONS[from]) &&
  COMPLAINT_STATUS_TRANSITIONS[from].includes(to);
