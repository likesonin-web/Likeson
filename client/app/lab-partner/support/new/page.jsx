'use client';

import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../../../store/slices/userSlice';
import { createTicket, selectTicketLoaders } from '../../../store/slices/ticketSlice';
import SupportShell from '../../../components/support/layout/SupportShell';
import CreateTicketWizard from '../../../components/support/ticket/CreateTicketWizard';

export default function PartnerNewTicketPage() {
  const user = useSelector(selectUser);
  const loaders = useSelector(selectTicketLoaders);
  const dispatch = useDispatch();
  const router = useRouter();
  if (!user) return null;

  const handleSubmit = async (payload) => {
    const result = await dispatch(createTicket(payload));
    if (createTicket.fulfilled.match(result)) {
      router.push(`/lab/support/${result.payload._id}`);
    }
  };

  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/lab/support' }, { label: 'New Ticket' }]}>
      <CreateTicketWizard bookings={[]} onSubmit={handleSubmit} submitting={loaders.create} />
    </SupportShell>
  );
}
