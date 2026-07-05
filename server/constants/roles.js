// constants/roles.js
// Reuses USER_ROLES already defined on the existing User model — do NOT redefine.

export const ADMIN_ROLES = ['admin', 'superadmin'];

export const PARTNER_ROLES = [
  'doctor',
  'hospital',
  'pharmacy',
  'care_assistant',
  'lab_partner',
  'blood_bank',
  'transportpartner',
  'driver',
  'solodriverpartner',
];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const isPartnerRole = (role) => PARTNER_ROLES.includes(role);
export const isCustomerRole = (role) => role === 'customer';
export const isFinanceRole = (role) => role === 'finance';
