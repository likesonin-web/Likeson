import { ShieldAlert, ShieldCheck } from 'lucide-react';

/**
 * @param {{ sla: { firstResponseCompliance: number, resolutionCompliance: number, breachedCount: number } | null }} props
 */
export default function SLADashboardWidget({ sla }) {
  if (!sla) return null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" /> SLA Compliance
      </h3>

      <div className="space-y-4">
        <ComplianceBar label="First response" value={sla.firstResponseCompliance} />
        <ComplianceBar label="Resolution" value={sla.resolutionCompliance} />
      </div>

      {sla.breachedCount > 0 && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-base-300 text-error text-xs font-semibold">
          <ShieldAlert className="w-4 h-4" />
          {sla.breachedCount} ticket(s) currently breached
        </div>
      )}
    </div>
  );
}

function ComplianceBar({ label, value }) {
  const color = value >= 90 ? 'success' : value >= 75 ? 'warning' : 'error';
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span className="text-base-content/60">{label}</span>
        <span className={`text-${color}`}>{value}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-bar-fill bg-${color}`} style={{ width: `${value}%`, background: `var(--${color})` }} />
      </div>
    </div>
  );
}
