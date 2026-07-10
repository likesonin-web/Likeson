'use client';
// src/app/chat/admin/page.jsx
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Megaphone, BarChart3 } from 'lucide-react';
import ComplaintStatusBadge, { ComplaintPriorityBadge } from '../../../components/chat/complaint/ComplaintStatusBadge';
import { LoadingState } from '../../../components/chat/common/LoadingState';
import { EmptyState } from '../../../components/chat/common/EmptyState';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { isAdminRole } from '../../../constants/chatConstants';
import API from '../../../redux/api';
import { formatConversationTimestamp } from '../../../utils/chatFormatters';

/**
 * Admin/Superadmin Communication Dashboard: complaint queue + response-time
 * metrics. Superadmin-only sections (global announcements, platform-wide
 * analytics) are gated separately below.
 */
export default function AdminChatDashboardPage() {
  const router = useRouter();
  const currentUser = useSelector(selectCurrentUser);
  const [complaints, setComplaints] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const isSuperadmin = currentUser?.role === 'superadmin';

  const loadData = async () => {
    try {
      const [complaintsRes, metricsRes] = await Promise.all([
        API.get('/support/complaints/dashboard', { params: { status: statusFilter || undefined, limit: 30 } }),
        API.get('/support/complaints/metrics'),
      ]);
      setComplaints(complaintsRes.data.data);
      setMetrics(metricsRes.data.data);
    } catch {
      setComplaints([]);
    }
  };

  useEffect(() => { loadData(); }, [statusFilter]);

  if (!isAdminRole(currentUser?.role)) {
    return <EmptyState title="Access denied" description="This dashboard is for admins and superadmins only." />;
  }

  if (!complaints) return <LoadingState fullHeight label="Loading dashboard…" />;

  return (
    <div className="h-[100dvh] overflow-y-auto scrollbar-thin p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold font-display">Communication Dashboard</h1>
        {isSuperadmin && (
          <button type="button" onClick={() => router.push('/chat/admin/announcement')} className="btn btn-primary-cta btn-sm">
            <Megaphone size={15} /> New Announcement
          </button>
        )}
      </div>

      {metrics && (
        <div className="grid-responsive">
          <div className="stat-card">
            <p className="stat-card-value">{metrics.totalComplaints}</p>
            <p className="stat-card-label">Total Complaints</p>
          </div>
          <div className="stat-card">
            <p className="stat-card-value">
              {metrics.avgFirstResponseMinutes ? `${Math.round(metrics.avgFirstResponseMinutes)}m` : '—'}
            </p>
            <p className="stat-card-label">Avg First Response</p>
          </div>
          <div className="stat-card">
            <p className="stat-card-value">
              {metrics.avgResolutionMinutes ? `${Math.round(metrics.avgResolutionMinutes / 60)}h` : '—'}
            </p>
            <p className="stat-card-label">Avg Resolution Time</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h2 className="text-sm font-bold flex items-center gap-2"><BarChart3 size={16} /> Complaint Queue</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-40 py-1.5 text-xs">
            <option value="">All statuses</option>
            <option value="Open">Open</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Waiting Customer">Waiting Customer</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {complaints.length === 0 ? (
          <EmptyState title="No complaints" description="Nothing matches the selected filter." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c._id} className="cursor-pointer" onClick={() => router.push(`/chat/complaint/${c._id}`)}>
                  <td className="font-semibold">{c.title}</td>
                  <td>{c.complaint?.category}</td>
                  <td><ComplaintPriorityBadge priority={c.complaint?.priority} size="xs" /></td>
                  <td><ComplaintStatusBadge status={c.complaint?.status} size="xs" /></td>
                  <td className="text-xs text-base-content/50">{formatConversationTimestamp(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
