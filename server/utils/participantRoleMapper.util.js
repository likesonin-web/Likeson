// utils/participantRoleMapper.util.js

const ASSIGNED_ROLE_MAP = {
  doctor: 'assigned_doctor',
  hospital: 'assigned_hospital',
  pharmacy: 'assigned_pharmacy',
  driver: 'assigned_driver',
  solodriverpartner: 'assigned_driver',
  transportpartner: 'assigned_transport_partner',
  lab_partner: 'assigned_lab',
  blood_bank: 'assigned_blood_bank',
  care_assistant: 'assigned_care_assistant',
};

/**
 * @param {string} platformRole   req.user.role
 * @param {boolean} isCreator     is this the ticket's original creator
 */
export function mapToParticipantRole(platformRole, isCreator) {
  if (isCreator) return 'customer';
  if (['admin', 'superadmin', 'finance'].includes(platformRole)) return platformRole;
  return ASSIGNED_ROLE_MAP[platformRole] ?? 'assigned_partner';
}
