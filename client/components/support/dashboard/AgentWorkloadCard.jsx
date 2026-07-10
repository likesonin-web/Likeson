import PresenceAvatar from '../shared/PresenceAvatar';

/**
 * @param {{ agents: Array<{userId: string, name: string, avatar?: string, openCount: number, maxCapacity?: number}> }} props
 */
export default function AgentWorkloadCard({ agents }) {
  if (!agents?.length) return null;
  const maxSeen = Math.max(...agents.map((a) => a.openCount), 1);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold mb-4">Agent Workload</h3>
      <ul className="space-y-3">
        {agents.map((agent) => (
          <li key={agent.userId} className="flex items-center gap-3">
            <PresenceAvatar user={agent} size="xs" />
            <span className="text-sm font-semibold flex-1 min-w-0 truncate">{agent.name}</span>
            <div className="w-24 progress-bar">
              <div className="progress-bar-fill" style={{ width: `${(agent.openCount / maxSeen) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-base-content/60 w-6 text-right">{agent.openCount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
