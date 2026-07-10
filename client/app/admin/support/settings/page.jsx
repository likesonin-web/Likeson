'use client';

import SupportShell from '../../../../components/support/layout/SupportShell';
import SupportSettingsPage from '../../../../components/support/pages/SupportSettingsPage';

export default function AdminSupportSettingsPage() {
  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/admin/support' }, { label: 'Settings' }]}>
      <SupportSettingsPage />
    </SupportShell>
  );
}
