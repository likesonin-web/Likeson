// support-module/utils/idGenerator.js
import { customAlphabet } from 'nanoid';
import Ticket from '../models/Ticket.js';
import Case from '../models/Case.js';

const suffix = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

const datePart = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

export const generateTicketNumber = async () => {
  for (let i = 0; i < 10; i++) {
    const candidate = `TCK-${datePart()}-${suffix()}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Ticket.exists({ ticketNumber: candidate }).setOptions({ includeDeleted: true });
    if (!exists) return candidate;
  }
  throw new Error('Ticket number generation failed after 10 attempts');
};

export const generateCaseNumber = async () => {
  for (let i = 0; i < 10; i++) {
    const candidate = `CASE-${datePart()}-${suffix()}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Case.exists({ caseNumber: candidate }).setOptions({ includeDeleted: true });
    if (!exists) return candidate;
  }
  throw new Error('Case number generation failed after 10 attempts');
};