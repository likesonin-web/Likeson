'use client';

import { Clock, Bell } from 'lucide-react';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
} from '../../features/support/constants/support.constants';

// SLA targets mirrored from backend constants/support.constants.js
// (SLA_FIRST_RESPONSE_MINUTES / SLA_RESOLUTION_MINUTES) — display only here;
// changing them is a backend deploy, not a client-side setting.
const SLA_TARGETS = {
  low: { firstResponse: '24h', resolution: '5 days' },
  medium: { firstResponse: '8h', resolution: '3 days' },
  high: { firstResponse: '2h', resolution: '24h' },
  critical: { firstResponse: '30m', resolution: '4h' },
};

export default function SupportSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold">Support Settings</h1>

      <div className="card p-5">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> SLA Targets
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>First Response</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            {TICKET_PRIORITIES.map((p) => (
              <tr key={p}>
                <td className="font-semibold">{TICKET_PRIORITY_LABELS[p]}</td>
                <td>{SLA_TARGETS[p].firstResponse}</td>
                <td>{SLA_TARGETS[p].resolution}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-base-content/40 mt-3">
          SLA targets are configured server-side. Contact engineering to adjust these.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Notification Preferences
        </h2>
        <p className="text-sm text-base-content/60">
          Notification delivery (push/email/in-app) is managed in your account settings and applies across the whole
          platform, not just Support.
        </p>
      </div>
    </div>
  );
}
