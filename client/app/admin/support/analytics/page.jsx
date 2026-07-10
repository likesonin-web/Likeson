'use client';

import SupportShell from '../../../../components/support/layout/SupportShell';
import AnalyticsDashboard from '../../../../components/support/analytics/AnalyticsDashboard';

export default function AdminSupportAnalyticsPage() {
  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/admin/support' }, { label: 'Analytics' }]}>
      <AnalyticsDashboard />
    </SupportShell>
  );
}
