'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Inbox, UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fetchAnalyticsOverview, fetchAnalyticsAgentWorkload, selectAnalyticsOverview, selectAnalyticsAgentWorkload, selectAnalyticsLoaders } from '../../../store/slices/analyticsSlice';
import { selectAllTickets, selectOverdueTickets } from '../../../store/slices/ticketSlice';
import StatCard from './StatCard';
import SLADashboardWidget from './SLADashboardWidget';
import AgentWorkloadCard from './AgentWorkloadCard';
import RecentActivityFeed from './RecentActivityFeed';
import { StatCardSkeleton } from '../shared/Skeletons';

export default function DashboardOverview({ baseHref = '/admin/support' }) {
  const dispatch = useDispatch();
  const overview = useSelector(selectAnalyticsOverview);
  const agentWorkload = useSelector(selectAnalyticsAgentWorkload);
  const loaders = useSelector(selectAnalyticsLoaders);
  const tickets = useSelector(selectAllTickets);
  const overdueTickets = useSelector(selectOverdueTickets);

  useEffect(() => {
    dispatch(fetchAnalyticsOverview({}));
    dispatch(fetchAnalyticsAgentWorkload({}));
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div className="grid-responsive">
        {loaders.overview ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Open Tickets" value={overview?.openCount ?? 0} icon={Inbox} trend={overview?.openTrend} />
            <StatCard label="Assigned to me" value={overview?.assignedToMeCount ?? 0} icon={UserCheck} />
            <StatCard label="Resolved (30d)" value={overview?.resolvedCount ?? 0} icon={CheckCircle2} trend={overview?.resolvedTrend} />
            <StatCard label="Overdue" value={overdueTickets.length} icon={AlertTriangle} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivityFeed tickets={tickets} baseHref={baseHref} />
        </div>
        <div className="space-y-6">
          <SLADashboardWidget sla={overview?.sla} />
          <AgentWorkloadCard agents={agentWorkload} />
        </div>
      </div>
    </div>
  );
}
