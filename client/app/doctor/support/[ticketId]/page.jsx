'use client';

import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser } from '@/store/slices/userSlice';
import SupportShell from '@/components/support/layout/SupportShell';
import TicketDetailPage from '@/components/support/pages/TicketDetailPage';

export default function PartnerTicketDetail() {
  const { ticketId } = useParams();
  const user = useSelector(selectUser);
  if (!user) return null;

  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/doctor/support' }, { label: 'Ticket' }]}>
      <TicketDetailPage ticketId={ticketId} backHref="/doctor/support" currentUser={user} />
    </SupportShell>
  );
}
