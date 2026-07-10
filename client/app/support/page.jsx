'use client';

import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/userSlice';
import SupportShell from '../../components/support/layout/SupportShell';
import TicketListPage from '../../components/support/pages/TicketListPage';

export default function CustomerSupportPage() {
  const user = useSelector(selectUser);
  if (!user) return null;

  return (
    <SupportShell breadcrumbs={[{ label: 'Support' }]}>
      <TicketListPage baseHref="/support" currentUser={user} title="My Tickets" />
    </SupportShell>
  );
}
