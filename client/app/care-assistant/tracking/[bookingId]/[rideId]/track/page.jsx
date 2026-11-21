'use client';

/**
 * Route: /care-assistant/tracking/[bookingId]/[rideId]/track
 *
 * Server-component-free wrapper — only job here is:
 *   1. Pull bookingId + rideId straight off the URL (folder segments).
 *   2. Pull auth token + role from Redux.
 *   3. Mount SocketProvider scoped to this one booking room.
 *
 * isCareGps only true for the CA's OWN session — customer/admin viewing
 * the same URL must NOT auto-start GPS push (they have none to give).
 */

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import SocketProvider from '@/context/SocketProvider';
import { selectToken, selectCurrentUser } from '@/store/slices/userSlice';
import CareAssistantLiveTracking from './CareAssistantLiveTracking';

function TrackPageContent() {
  // Param keys MUST match folder bracket names exactly: [bookingId], [rideId]
  const { bookingId, rideId } = useParams();
  const searchParams = useSearchParams();
  const bookingType = searchParams.get('type'); // passed from BookingManagement nav

  const token = useSelector(selectToken);
  const user  = useSelector(selectCurrentUser); // single source — was split across 2 selectors before
  const role  = user?.role;

  // Token not hydrated yet (first paint, localStorage read pending) —
  // don't mount SocketProvider with token=undefined vs null ambiguity,
  // just wait. Avoids a connect→disconnect→reconnect flicker.
  if (token === undefined) return null;

  return (
    <SocketProvider
      token={token}
      bookingId={bookingId}
      role={role}
      isCareGps={role === 'care_assistant'}
    >
      <CareAssistantLiveTracking rideId={rideId} bookingType={bookingType} />
    </SocketProvider>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackPageContent />
    </Suspense>
  );
}