'use client';

import SupportShell from '../../../../components/support/layout/SupportShell';
import TicketTablePage from '../../../../components/support/pages/TicketTablePage';

export default function AdminAllTicketsPage() {
  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/admin/support' }, { label: 'All Tickets' }]}>
      <TicketTablePage />
    </SupportShell>
  );
}
