'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye, RefreshCw, Video, Edit2, UserCheck, Wallet,
  Stethoscope, Heart, Navigation, Radio, QrCode,
  Phone, Mail, Calendar, ArrowRight, FileText,
  XCircle, Clock, Route, History, AlertTriangle, MapPin,
} from 'lucide-react';
import {
  fetchAdminBookingById,
  clearAdminBookingDetail,
  fetchAdminOps,
  selectAdminBookingDetail,
  selectAdminBookingFollowUps,
  selectAdminBookingDetailLoading,
} from '@/store/slices/operationsSlice';
import { StatusPanel, OpPanel }                        from './StatusOpPanels';
import { NearbyAssignPanel }                           from './NearbyAssignPanel';
import { PayAtServicePanel, RefundPanel, CareRidePanel } from './PaymentPanels';
import { ConsultationPanel, CareTrackingPanel }         from './TrackingConsultPanels';
import { RideOpsPanel }                                 from './RideOpsPanel';
import RideOpsLiveTracking                              from './RideLiveTracking';
import { BookingSosPanelInline, DestinationHistoryPanel } from './SosDestinationPanel';
import {
  TYPE_ACTION_TABS, resolveConsultId, getDriverAssignmentState,
  fmt, fmtDate, currency, statusBadge, typeIcon,
  Spinner, SectionHeader, InfoRow, PartnerStatusBanner,
  RideHistoryList, CallButton, FieldNote,
} from './shared';

// ── Tab registry (all 10 tabs) ────────────────────────────────────────────────
const TAB_META = {
  status:       { label: 'Status',       icon: Edit2          },
  assign:       { label: 'Assign',       icon: UserCheck      },
  refund:       { label: 'Refund',       icon: Wallet         },
  op:           { label: 'OP',           icon: Stethoscope    },
  care_ride:    { label: 'Care Ride',    icon: Heart          },
  tracking:     { label: 'Tracking',     icon: Navigation     },
  consultation: { label: 'Consult',      icon: Radio          },
  payment:      { label: 'Payment',      icon: QrCode         },
  ride_ops:     { label: 'Ride Ops',     icon: Route          },
  sos:          { label: 'SOS',          icon: AlertTriangle  },
  destination:  { label: 'Destination',  icon: MapPin         },
};

// Merge ride_ops, sos, destination into allowed tabs for every booking that has a ride
const ALWAYS_SHOW_TABS = ['ride_ops', 'sos', 'destination'];

export function BookingDetailPanel({ bookingId, dispatch, onTabNavigate }) {
  const router    = useRouter();
  const booking   = useSelector(selectAdminBookingDetail);
  const followUps = useSelector(selectAdminBookingFollowUps);
  const loading   = useSelector(selectAdminBookingDetailLoading);
  const [actionTab, setActionTab] = useState('status');

  useEffect(() => {
    if (bookingId) {
      dispatch(fetchAdminBookingById({ bookingId }));
      dispatch(fetchAdminOps({ page: 1, limit: 10 }));
    }
    return () => dispatch(clearAdminBookingDetail());
  }, [bookingId, dispatch]);

  useEffect(() => {
    if (onTabNavigate && TAB_META[onTabNavigate]) setActionTab(onTabNavigate);
  }, [onTabNavigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/40">
        <Spinner size={20} />
        <p className="text-sm m-0">Loading booking…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/30">
        <Eye size={36} strokeWidth={1} />
        <p className="text-sm font-semibold m-0">Select a booking to view details</p>
        <p className="text-xs m-0">Click any card on the left</p>
      </div>
    );
  }

  const consultId   = resolveConsultId(booking.consultationSessionId);
  const driverState = getDriverAssignmentState(booking);
  const baseTabs    = TYPE_ACTION_TABS[booking.bookingType] ?? Object.keys(TAB_META);

  // Always include ride_ops, sos, destination (de-dup)
  const allowedTabs = [...new Set([...baseTabs, ...ALWAYS_SHOW_TABS])];
  const safeTab     = allowedTabs.includes(actionTab) ? actionTab : allowedTabs[0];

  const canJoinVideo = !!consultId &&
    ['doctor_online', 'full_care_ride'].includes(booking.bookingType) &&
    ['confirmed', 'in_progress', 'waiting'].includes(booking.status);

  return (
    <div className="flex flex-col h-full  ">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-3.5 border-b border-base-300 bg-base-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {typeIcon(booking.bookingType)}
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{booking.bookingCode}</span>
              {statusBadge(booking.status)}
              {driverState.state === 'rejected' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border border-error/40 bg-error/10 text-error">
                  <XCircle size={9} /> Partner Rejected
                </span>
              )}
              {canJoinVideo && (
                <button
                  onClick={() => router.push(`/doctor/consultation/${consultId}`)}
                  className="btn btn-success btn-xs gap-1 ml-auto"
                >
                  <Video size={10} /> Join Video
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-base-content m-0 truncate">{booking.patientInfo?.name ?? '—'}</p>
              <CallButton phone={booking.customer?.phone} label="Call Patient" size="xs" />
            </div>
            <p className="text-[11px] text-base-content/45 m-0 mt-0.5">
              {booking.bookingType?.replace(/_/g, ' ')} · {fmt(booking.scheduledAt)}
            </p>
          </div>
          <button
            onClick={() => dispatch(fetchAdminBookingById({ bookingId: booking._id }))}
            className="btn btn-ghost btn-sm btn-circle shrink-0"
            title="Refresh booking"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── Action tabs ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-base-300 bg-base-200/60 px-4 pt-3 pb-4">
        {/* Tab buttons — split into two rows for readability */}
        <div className="flex gap-1 flex-wrap mb-3">
          {allowedTabs.map((id) => {
            const meta = TAB_META[id];
            if (!meta) return null;
            const { icon: Icon, label } = meta;
            const isSos = id === 'sos';
            return (
              <button
                key={id}
                onClick={() => setActionTab(id)}
                className={`btn btn-xs gap-1.5 ${
                  id === safeTab
                    ? isSos ? 'btn-error' : 'btn-primary'
                    : 'bg-base-300 text-base-content'
                }`}
              >
                <Icon size={9} /> {label}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={safeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.13 }}
          >
            {safeTab === 'status'       && <StatusPanel       booking={booking} dispatch={dispatch} />}
            {safeTab === 'assign'       && <NearbyAssignPanel booking={booking} dispatch={dispatch} />}
            {safeTab === 'refund'       && <RefundPanel       booking={booking} dispatch={dispatch} />}
            {safeTab === 'op'           && <OpPanel           booking={booking} dispatch={dispatch} />}
            {safeTab === 'care_ride'    && <CareRidePanel     booking={booking} dispatch={dispatch} />}
            {safeTab === 'tracking'     && <CareTrackingPanel booking={booking} dispatch={dispatch} />}
            {safeTab === 'consultation' && <ConsultationPanel booking={booking} dispatch={dispatch} />}
            {safeTab === 'payment'      && <PayAtServicePanel booking={booking} dispatch={dispatch} />}
            {safeTab === 'ride_ops'     && (
              <>
                {/* Live map/status/SOS/stops/participants tracker — only meaningful
                    once a ride actually exists on this booking. Falls back to just
                    RideOpsPanel (ride request/assignment controls) if no ride yet,
                    instead of mounting RideLiveTracking with an undefined rideId
                    (which would otherwise fire fetchRideTracking(undefined) and
                    spam 400s against the API on every booking that hasn't been
                    assigned a ride yet). */}
                {booking.primaryRide?._id && (
                  <div className="mb-4 overflow-auto">
                    <RideOpsLiveTracking
                      bookingId={booking._id}
                      rideId={booking.primaryRide._id}
                    />
                  </div>
                )}
                <RideOpsPanel booking={booking} dispatch={dispatch} />
              </>
            )}
            {safeTab === 'sos'          && <BookingSosPanelInline booking={booking} dispatch={dispatch} />}
            {safeTab === 'destination'  && <DestinationHistoryPanel booking={booking} dispatch={dispatch} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Scrollable detail body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="flex flex-col gap-5">

          <PartnerStatusBanner booking={booking} />

          {/* Patient + Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Patient" />
              <p className="text-xs font-bold text-base-content m-0">{booking.patientInfo?.name ?? '—'}</p>
              <p className="text-[11px] text-base-content/50 m-0 mt-0.5">
                {booking.patientInfo?.age ? `${booking.patientInfo.age} y` : ''} {booking.patientInfo?.gender ?? ''}
              </p>
              {booking.patientInfo?.bloodGroup && (
                <span className="badge badge-error badge-xs mt-1">{booking.patientInfo.bloodGroup}</span>
              )}
              <FieldNote text="Patient may differ from account holder" />
            </div>
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Customer" />
              <p className="text-xs font-bold text-base-content m-0">{booking.customer?.name ?? '—'}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[11px] text-base-content/50 m-0 flex items-center gap-1">
                  <Phone size={9} /> {booking.customer?.phone ?? '—'}
                </p>
                <CallButton phone={booking.customer?.phone} label="Call" size="xs" />
              </div>
              <p className="text-[11px] text-base-content/50 m-0 mt-0.5 flex items-center gap-1 truncate">
                <Mail size={9} /> {booking.customer?.email ?? '—'}
              </p>
              <FieldNote text="Billing and notification contact" />
            </div>
          </div>

          {/* Fare breakdown */}
          <div className="rounded-xl border border-base-300 bg-base-200 p-3">
            <SectionHeader title="Fare Breakdown" />
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Total',      v: currency(booking.fareBreakdown?.totalAmount),     highlight: true },
                { l: 'Paid',       v: currency(booking.fareBreakdown?.amountPaid)                       },
                { l: 'Refunded',   v: currency(booking.fareBreakdown?.refundAmount)                     },
                { l: 'Transport',  v: currency(booking.fareBreakdown?.transportFee)                     },
                { l: 'Consult',    v: currency(booking.fareBreakdown?.consultationFee)                  },
                { l: 'Care Asst.', v: currency(booking.fareBreakdown?.careAssistantFee)                 },
              ].map(({ l, v, highlight }) => (
                <div key={l}>
                  <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">{l}</p>
                  <p className={`text-xs font-bold m-0 mt-0.5 ${highlight ? 'text-success' : 'text-base-content'}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-base-300/60">
              <span className="text-[10px] text-base-content/40">Payment Status</span>
              {statusBadge(booking.paymentStatus ?? 'unpaid')}
            </div>
          </div>

          {/* Locations */}
          {(booking.patientLocation || booking.destinationLocation) && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Locations" />
              {booking.patientLocation && (
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className="w-2 h-2 rounded-full bg-success mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-base-content/40 m-0">Pickup</p>
                    <p className="text-xs text-base-content m-0 mt-0.5 break-words">
                      {booking.patientLocation.address ?? `${booking.patientLocation.coordinates?.[1]}, ${booking.patientLocation.coordinates?.[0]}`}
                    </p>
                  </div>
                </div>
              )}
              {booking.destinationLocation && (
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-error mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-base-content/40 m-0">Destination</p>
                    <p className="text-xs text-base-content m-0 mt-0.5 break-words">
                      {booking.destinationLocation.address ?? `${booking.destinationLocation.coordinates?.[1]}, ${booking.destinationLocation.coordinates?.[0]}`}
                    </p>
                    {booking.destinationLockedAt && (
                      <p className="text-[10px] text-warning m-0 mt-0.5">
                        🔒 Locked at {fmtDate(booking.destinationLockedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assignments */}
          <div className="rounded-xl border border-base-300 bg-base-200 p-3">
            <SectionHeader title="Assignments" sub="All linked service partners" />
            <InfoRow label="Doctor"             value={booking.doctorSnapshot?.name}                            sub={booking.doctorSnapshot?.specialization}                             note="Assigned doctor profile" />
            <InfoRow label="Care Assistant"     value={booking.careAssistantSnapshot?.name}                     sub={booking.careAssistantSnapshot?.phone}   callPhone={booking.careAssistantSnapshot?.phone} note="Assigned CA profile" />
            <InfoRow label="Driver"             value={booking.primaryRide?.driverSnapshot?.legalName}          sub={driverState.state === 'rejected' ? 'Rejected' : booking.primaryRide?.driverSnapshot?.phone} callPhone={driverState.state !== 'rejected' ? booking.primaryRide?.driverSnapshot?.phone : null} note="Solo or TP-assigned driver" />
            <InfoRow label="Transport Partner"  value={booking.transportPartner?.businessName ?? (booking.transportPartner ? 'TP Assigned' : null)} note="Fleet agency" />
            <InfoRow label="Hospital"           value={booking.hospital?.name ?? (booking.hospital ? 'Linked' : null)} note="Appointment hospital" />
            <InfoRow label="Primary Ride"       value={booking.primaryRide?.status?.replace(/_/g,' ')}         sub={booking.primaryRide?.rideCode}    mono note="Current active ride status" />
            <InfoRow label="Consultation"       value={consultId ? 'Linked' : null}                            sub="Telemedicine session"                                                note="Agora room ID" />
            <InfoRow label="Destination Locked" value={booking.destinationLockedAt ? fmtDate(booking.destinationLockedAt) : null} note="Set when driver accepts" />
          </div>

          {/* Consultation quick-link */}
          {consultId && (
            <div className="rounded-xl border border-violet-300/30 bg-violet-50/10 p-3">
              <SectionHeader title="Telemedicine Session" action={
                <button onClick={() => router.push(`/doctor/consultation/${consultId}`)} className="btn btn-xs btn-success gap-1">
                  <Video size={9} /> Join
                </button>
              } />
              <div className="flex items-center gap-2">
                <Radio size={12} className="text-violet-400" />
                <span className="text-xs font-mono text-base-content/60 truncate">{consultId}</span>
              </div>
            </div>
          )}

          {/* Status log */}
          {(booking.statusLog?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Status History" sub={`${booking.statusLog.length} events`} />
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto scrollbar-thin">
                {[...booking.statusLog].reverse().slice(0, 10).map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-base-300/40 last:border-0">
                    <div className="flex items-center gap-2">
                      <ArrowRight size={8} className="text-base-content/30" />
                      <span className="font-medium text-base-content/70">{log.toStatus?.replace(/_/g, ' ')}</span>
                      {log.reason && <span className="text-base-content/35 truncate max-w-28">{log.reason}</span>}
                    </div>
                    <span className="text-base-content/35 shrink-0 ml-2">{fmtDate(log.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ride history */}
          {(booking.rides?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Ride Attempts (${booking.rides.length})`} sub="All driver assignments" />
              <RideHistoryList rides={booking.rides} />
            </div>
          )}

          {/* Follow-ups */}
          {(followUps?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Follow-ups (${followUps.length})`} />
              {followUps.slice(0, 5).map((f, i) => (
                <div key={f._id ?? i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-base-300/60 last:border-0">
                  <span className="text-base-content/55 font-mono">{f.opNumber ?? `#${i + 1}`}</span>
                  <span className="text-base-content/40">{fmtDate(f.scheduledAt)}</span>
                  {statusBadge(f.status)}
                </div>
              ))}
            </div>
          )}

          {/* Documents */}
          {(booking.documents?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Documents (${booking.documents.length})`} />
              {booking.documents.slice(0, 4).map((doc, i) => (
                <div key={doc._id ?? i} className="flex items-center justify-between py-1.5 border-b border-base-300/60 last:border-0">
                  <div className="flex items-center gap-2">
                    <FileText size={10} className="text-base-content/40" />
                    <span className="text-[11px] text-base-content/60">{doc.docType?.replace(/_/g, ' ')}</span>
                  </div>
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">View</a>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}