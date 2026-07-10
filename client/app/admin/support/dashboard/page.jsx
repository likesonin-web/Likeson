'use client';

import SupportShell from '../../../../components/support/layout/SupportShell';
import DashboardOverview from '../../../../components/support/dashboard/DashboardOverview';

export default function AdminSupportDashboardPage() {
  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/admin/support' }, { label: 'Dashboard' }]}>
      <DashboardOverview baseHref="/admin/support" />
    </SupportShell>
  );
}
