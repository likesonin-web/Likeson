'use client';
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Navigation, Radio, Video, Check, RefreshCw, Phone, AlertTriangle, MessageSquare, FileText } from 'lucide-react';
import {
  fetchCareTrackingSnapshot,
  fetchConsultation,
  fetchConsultationJoinToken,
  confirmConsultation,
  acceptConsultation,
  startConsultation,
  endConsultation,
  submitConsultationConsent,
  sendConsultationChat,
  fetchAdminBookingById,
  selectCareTrackingSnapshot,
  selectCareTrackingLoading,
  selectConsultation,
  selectConsultationChat,
  selectConsultationLoading,
  selectConfirmConsultationLoading,
  selectStartConsultationLoading,
  selectEndConsultationLoading,
  selectConsultationJoinToken,
  selectJoinTokenLoading,
  selectCareRideStatus,
  selectRideParticipants,
  fetchRideParticipants,
} from '@/store/slices/operationsSlice';
import {
  statusBadge, fmtDate, currency, Spinner,
  SectionHeader, FieldNote, CallButton, resolveConsultId,
  CA_STATUS_LABELS, CA_STATUS_COLORS,
} from './shared';

// ── Care tracking panel ───────────────────────────────────────────────────────
export function CareTrackingPanel({ booking, dispatch }) {
  const snapshot = useSelector(selectCareTrackingSnapshot);
  const loading  = useSelector(selectCareTrackingLoading);
  const participants = useSelector(selectRideParticipants);
  const pollRef  = useRef(null);
  const [polling, setPolling] = useState(false);

  const rideId = booking.primaryRide?._id ?? booking.primaryRide;

  const loadSnapshot = () => dispatch(fetchCareTrackingSnapshot({ bookingId: booking._id }));

  const startPoll = () => {
    loadSnapshot();
    if (rideId) dispatch(fetchRideParticipants({ rideId }));
    setPolling(true);
    pollRef.current = setInterval(() => {
      loadSnapshot();
    }, 10000);
  };

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };

  useEffect(() => () => stopPoll(), []);

  const caStatus    = snapshot?.careAssistant?.status ?? 'not_joined';
  const caStatusLabel = CA_STATUS_LABELS[caStatus] ?? caStatus.replace(/_/g,' ');
  const caStatusClass = CA_STATUS_COLORS[caStatus] ?? 'text-base-content/50';

  const hasSos = snapshot?.hasActiveSos;

  return (
    <div className="flex flex-col gap-3">
      {/* SOS banner */}
      {hasSos && (
        <div className="flex items-center gap-2 rounded-xl border border-error/50 bg-error/10 px-3 py-2 text-xs text-error font-bold">
          <AlertTriangle size={13} /> Active SOS on this ride! Escalate immediately.
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={loadSnapshot} disabled={loading} className="btn btn-sm btn-outline gap-1.5">
          {loading ? <Spinner size={12} /> : <RefreshCw size={11} />} Refresh
        </button>
        {!polling ? (
          <button onClick={startPoll} className="btn btn-sm btn-primary gap-1.5">
            <Navigation size={11} /> Start Live Poll
          </button>
        ) : (
          <button onClick={stopPoll} className="btn btn-sm btn-ghost text-error gap-1.5">
            <Navigation size={11} /> Stop Poll
          </button>
        )}
        {polling && <span className="text-[10px] text-base-content/40 flex items-center gap-1"><Spinner size={10} /> Polling every 10s</span>}
      </div>

      {!snapshot ? (
        <div className="py-8 text-center text-xs text-base-content/40">No tracking data. Click Refresh.</div>
      ) : (
        <div className="flex flex-col gap-3">

          {/* Ride status */}
          <div className="rounded-xl border border-base-300 bg-base-200 p-3">
            <SectionHeader title="Ride Status" />
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-base-content/45">Ride</span>
              {statusBadge(snapshot.rideStatus)}
              {snapshot.rideStage && <><span className="text-base-content/45">Stage</span><span>{snapshot.rideStage.replace(/_/g,' ')}</span></>}
              {snapshot.route?.currentEtaMinutes != null && (
                <><span className="text-base-content/45">ETA</span><span className="text-success font-bold">{snapshot.route.currentEtaMinutes} min</span></>
              )}
              {snapshot.route?.estimatedDistanceKm != null && (
                <><span className="text-base-content/45">Distance</span><span>{snapshot.route.estimatedDistanceKm} km</span></>
              )}
            </div>
          </div>

          {/* Driver */}
          {snapshot.driver && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Driver" />
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-base-content/45">Name</span>
                <div className="flex items-center gap-1">
                  <span>{snapshot.driver.snapshot?.name ?? '—'}</span>
                  <CallButton phone={snapshot.driver.snapshot?.phone} label="" size="xs" />
                </div>
                {snapshot.driver.liveLocation && (
                  <>
                    <span className="text-base-content/45">Location</span>
                    <span>{snapshot.driver.liveLocation.lat?.toFixed(4)}, {snapshot.driver.liveLocation.lng?.toFixed(4)}</span>
                    <span className="text-base-content/45">Speed</span>
                    <span>{snapshot.driver.liveLocation.speedKmh ?? 0} km/h</span>
                  </>
                )}
                <span className="text-base-content/45">Vehicle</span>
                <span>{snapshot.driver.vehicleSnapshot?.registrationNumber ?? '—'}</span>
              </div>
            </div>
          )}

          {/* Care assistant */}
          {snapshot.careAssistant && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Care Assistant" />
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-base-content/45">Name</span>
                <div className="flex items-center gap-1">
                  <span>{snapshot.careAssistant.name ?? '—'}</span>
                  <CallButton phone={snapshot.careAssistant.phone} label="" size="xs" />
                </div>
                <span className="text-base-content/45">Status</span>
                <span className={`font-bold ${caStatusClass}`}>{caStatusLabel}</span>
                <span className="text-base-content/45">Joined Ride</span>
                <span>{snapshot.careAssistant.isLinkedToRide ? 'Yes' : 'No'}</span>
                {snapshot.careAssistant.liveLocation && (
                  <>
                    <span className="text-base-content/45">CA Location</span>
                    <span>{snapshot.careAssistant.liveLocation.lat?.toFixed(4)}, {snapshot.careAssistant.liveLocation.lng?.toFixed(4)}</span>
                  </>
                )}
              </div>

              {/* CA Join Point */}
              {snapshot.route?.caJoinWaypoint && (
                <div className="mt-2 p-2 rounded-lg bg-base-300/40">
                  <p className="text-[10px] font-bold text-base-content/45 uppercase tracking-widest mb-1">Join Point</p>
                  <div className="grid grid-cols-2 gap-y-0.5 text-[11px]">
                    <span className="text-base-content/40">Zone</span>
                    <span className="font-medium">{snapshot.route.caJoinWaypoint.zone?.replace(/_/g,' ')}</span>
                    <span className="text-base-content/40">CA Distance</span>
                    <span>{snapshot.route.caJoinWaypoint.distCaToJoinKm} km</span>
                    <span className="text-base-content/40">Completed</span>
                    <span className={snapshot.route.caJoinWaypoint.isCompleted ? 'text-success font-bold' : 'text-warning'}>
                      {snapshot.route.caJoinWaypoint.isCompleted ? 'Yes' : 'Pending'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestones */}
          {snapshot.milestones?.length > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Milestones (${snapshot.milestones.length})`} />
              <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto scrollbar-thin">
                {[...snapshot.milestones].reverse().slice(0,10).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] border-b border-base-300/60 last:border-0 py-1">
                    <span className="font-mono text-base-content/60">{m.name?.replace(/_/g,' ')}</span>
                    <span className="text-base-content/35">{fmtDate(m.recordedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RideParticipants */}
          {participants.length > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Participants (${participants.length})`} />
              {participants.map((p, i) => (
                <div key={p._id ?? i} className="flex items-center justify-between text-[11px] border-b border-base-300/60 last:border-0 py-1.5">
                  <div>
                    <span className="font-bold text-base-content/70">{p.role?.replace(/_/g,' ')}</span>
                    <span className="text-base-content/40 ml-2">{p.snapshot?.name}</span>
                  </div>
                  {statusBadge(p.status ?? 'PENDING')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Consultation panel ────────────────────────────────────────────────────────
export function ConsultationPanel({ booking, dispatch }) {
  const consultation  = useSelector(selectConsultation);
  const chat          = useSelector(selectConsultationChat);
  const token         = useSelector(selectConsultationJoinToken);
  const loadingCons   = useSelector(selectConsultationLoading);
  const loadingConf   = useSelector(selectConfirmConsultationLoading);
  const loadingStart  = useSelector(selectStartConsultationLoading);
  const loadingEnd    = useSelector(selectEndConsultationLoading);
  const loadingToken  = useSelector(selectJoinTokenLoading);

  const [chatMsg, setChatMsg]   = useState('');
  const [endReason, setEndReason] = useState('');
  const [endDone, setEndDone]   = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const consultId = resolveConsultId(booking.consultationSessionId ?? consultation?._id);

  useEffect(() => {
    if (consultId) dispatch(fetchConsultation({ bookingId: booking._id }));
  }, [booking._id, consultId, dispatch]);

  const handleConfirm = () => consultId && dispatch(confirmConsultation({ consultationId: consultId, consentAccepted: true }));
  const handleStart   = () => consultId && dispatch(startConsultation({ consultationId: consultId }));
  const handleGetToken= () => consultId && dispatch(fetchConsultationJoinToken({ consultationId: consultId }));

  const handleEnd = async () => {
    if (!consultId) return;
    await dispatch(endConsultation({ consultationId: consultId, reason: endReason, prescriptionUploaded: false })).unwrap();
    setEndDone(true);
    dispatch(fetchAdminBookingById({ bookingId: booking._id }));
  };

  const handleChat = async () => {
    if (!chatMsg.trim() || !consultId) return;
    setChatLoading(true);
    await dispatch(sendConsultationChat({ consultationId: consultId, message: chatMsg })).unwrap();
    setChatMsg('');
    setChatLoading(false);
  };

  if (!consultId) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-base-content/40">
        <Radio size={24} strokeWidth={1} />
        <p className="text-xs m-0">No consultation session linked</p>
        <FieldNote text="Auto-created for doctor_online on confirm. Or confirm status to trigger." />
      </div>
    );
  }

  if (loadingCons) return <div className="flex items-center gap-2 text-xs text-base-content/40 py-6 justify-center"><Spinner size={14} /> Loading consultation…</div>;

  return (
    <div className="flex flex-col gap-3">

      {/* Session info */}
      {consultation && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <SectionHeader title="Session" />
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-base-content/45">Status</span>
            {statusBadge(consultation.status)}
            <span className="text-base-content/45">Type</span>
            <span>{consultation.consultationType ?? '—'}</span>
            <span className="text-base-content/45">Scheduled</span>
            <span>{fmtDate(consultation.scheduledStartTime)}</span>
            <span className="text-base-content/45">Consent</span>
            <span className={consultation.telemedicineConsentAccepted ? 'text-success font-bold' : 'text-warning'}>
              {consultation.telemedicineConsentAccepted ? 'Accepted' : 'Pending'}
            </span>
            {consultation.roomId && (
              <><span className="text-base-content/45">Room</span><span className="font-mono text-[10px] truncate">{consultation.roomId}</span></>
            )}
            {consultation.actualDurationMinutes != null && (
              <><span className="text-base-content/45">Duration</span><span>{consultation.actualDurationMinutes} min</span></>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleConfirm} disabled={loadingConf || consultation?.status === 'completed'} className="btn btn-xs btn-primary gap-1">
          {loadingConf ? <Spinner size={10} /> : <Check size={10} />} Confirm
        </button>
        <button onClick={handleStart} disabled={loadingStart || consultation?.status !== 'waiting'} className="btn btn-xs btn-success gap-1">
          {loadingStart ? <Spinner size={10} /> : <Radio size={10} />} Start
        </button>
        <button onClick={handleGetToken} disabled={loadingToken} className="btn btn-xs btn-outline gap-1">
          {loadingToken ? <Spinner size={10} /> : <Video size={10} />} Get Token
        </button>
        {!['completed','cancelled'].includes(consultation?.status) && (
          <button onClick={handleEnd} disabled={loadingEnd || endDone} className="btn btn-xs btn-error gap-1">
            {loadingEnd ? <Spinner size={10} /> : endDone ? <Check size={10} /> : <FileText size={10} />}
            {endDone ? 'Ended' : 'End'}
          </button>
        )}
      </div>

      {/* End reason */}
      {!['completed','cancelled'].includes(consultation?.status) && (
        <input
          value={endReason}
          onChange={e => setEndReason(e.target.value)}
          placeholder="End reason (optional)"
          className="input-field text-xs"
        />
      )}

      {/* Token display */}
      {token && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3">
          <p className="text-[10px] font-bold text-success uppercase tracking-widest mb-1">Agora Token</p>
          <p className="text-[10px] font-mono text-success/70 break-all m-0">{token.token?.slice(0,40)}…</p>
          <p className="text-[10px] text-base-content/40 m-0 mt-1">Role: {token.role} · Expires in {token.expiresInSeconds}s</p>
        </div>
      )}

      {/* Chat */}
      {consultation?.chatEnabled !== false && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-2">
          <SectionHeader title={`Chat (${chat.length} messages)`} />
          <div className="max-h-40 overflow-y-auto scrollbar-thin flex flex-col gap-1">
            {chat.length === 0 ? (
              <p className="text-[10px] text-base-content/35 text-center py-3">No messages yet</p>
            ) : chat.slice(-10).map((m, i) => (
              <div key={i} className={`flex flex-col ${m.senderRole === 'admin' ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] text-base-content/35 mb-0.5">{m.senderRole}</span>
                <div className={`rounded-xl px-2.5 py-1.5 text-xs max-w-[80%] ${m.senderRole === 'admin' ? 'bg-primary/20 text-primary' : 'bg-base-300 text-base-content'}`}>
                  {m.message}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Type message…" className="input-field text-xs flex-1" />
            <button onClick={handleChat} disabled={chatLoading || !chatMsg.trim()} className="btn btn-xs btn-primary gap-1">
              {chatLoading ? <Spinner size={10} /> : <MessageSquare size={10} />} Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}