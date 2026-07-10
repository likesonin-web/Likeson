'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../../../store/slices/userSlice';
import { createTicket, selectTicketLoaders } from '../../../store/slices/ticketSlice';
import SupportShell from '../../../components/support/layout/SupportShell';
import CreateTicketWizard from '../../../components/support/ticket/CreateTicketWizard';

export default function NewTicketPage() {
  const user = useSelector(selectUser);
  const loaders = useSelector(selectTicketLoaders);
  const dispatch = useDispatch();
  const router = useRouter();
  const [bookings] = useState([]); // wire to bookingSlice.selectMyBookings if linking is desired here

  if (!user) return null;

  const handleSubmit = async (payload) => {
    const result = await dispatch(createTicket(payload));
    if (createTicket.fulfilled.match(result)) {
      router.push(`/support/${result.payload._id}`);
    }
  };

  return (
    <SupportShell breadcrumbs={[{ label: 'Support', href: '/support' }, { label: 'New Ticket' }]}>
      <CreateTicketWizard bookings={bookings} onSubmit={handleSubmit} submitting={loaders.create} />
    </SupportShell>
  );
}
