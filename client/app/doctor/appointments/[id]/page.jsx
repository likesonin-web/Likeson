'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Clock, User, Phone, Activity,
  Stethoscope, Video, FileText, MapPin, CreditCard,
  CheckCircle2, AlertCircle, XCircle, Clock3, BadgeCheck,
  Droplet, Weight, PenLine, Home, Mail, Hash, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';

// Redux
import {
  fetchDoctorAppointmentById,
  selectSelectedDoctorAppointment,
  selectClinicalLoading,
  selectClinicalError,
  clearSelectedDoctorAppointment
} from '@/store/slices/clinicalSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig = (status) => {
  const map = {
    pending:     { label: 'Pending',     bg: 'bg-warning/10',  text: 'text-warning',  Icon: Clock3       },
    created:     { label: 'Created',     bg: 'bg-warning/10',  text: 'text-warning',  Icon: Clock3       },
    waiting:     { label: 'Waiting',     bg: 'bg-info/10',     text: 'text-info',     Icon: Clock        },
    scheduled:   { label: 'Scheduled',   bg: 'bg-info/10',     text: 'text-info',     Icon: Calendar     },
    confirmed:   { label: 'Confirmed',   bg: 'bg-info/10',     text: 'text-info',     Icon: BadgeCheck   },
    active:      { label: 'Active',      bg: 'bg-primary/10',  text: 'text-primary',  Icon: Activity     },
    in_progress: { label: 'In Progress', bg: 'bg-primary/10',  text: 'text-primary',  Icon: Activity     },
    completed:   { label: 'Completed',   bg: 'bg-success/10',  text: 'text-success',  Icon: CheckCircle2 },
    cancelled:   { label: 'Cancelled',   bg: 'bg-error/10',    text: 'text-error',    Icon: XCircle      },
    no_show:     { label: 'No Show',     bg: 'bg-error/10',    text: 'text-error',    Icon: AlertCircle  },
  };
  return map[status] ?? { label: status || 'Unknown', bg: 'bg-base-200', text: 'text-base-content', Icon: Clock3 };
};

const getConsultIcon = (type) => {
  if (type === 'video')     return <Video size={16} className="text-info" />;
  if (type === 'homeVisit') return <Home size={16} className="text-accent" />;
  return <Stethoscope size={16} className="text-primary" />;
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return '—'; }
};

const getPatientData = (b) => {
  const info = b?.patientInfo || {};
  const cust = b?.customer || {};
  return {
    name:   info.name   ?? cust.name  ?? 'Unknown Patient',
    phone:  info.phone  ?? cust.phone ?? '—',
    email:  cust.email  ?? '—',
    age:    info.age    ?? '—',
    gender: info.gender ?? '—',
    blood:  info.bloodGroup ?? '—',
    weight: info.weight ? `${info.weight} kg` : '—',
    initial: (info.name?.[0] ?? cust.name?.[0] ?? '?').toUpperCase()
  };
};

const formatAddress = (address) => {
  if (!address) return '—';
  const parts = [
    address.line1,
    address.line2,
    address.landmark,
    address.city,
    address.state,
    address.pincode
  ].filter(Boolean);
  return parts.join(', ');
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
};

const canJoinConsult = (b) =>
  ['doctor_online'].includes(b?.bookingType) || b?.consultationType === 'video';

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────

const DetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-24 bg-base-300 rounded-2xl w-full"></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="h-64 bg-base-300 rounded-2xl w-full"></div>
        <div className="h-48 bg-base-300 rounded-2xl w-full"></div>
      </div>
      <div className="h-96 bg-base-300 rounded-2xl w-full"></div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AppointmentDetails() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  
  const id = params?.id;

  // Redux Selectors
  const appointment = useSelector(selectSelectedDoctorAppointment);
  const loading     = useSelector(selectClinicalLoading('fetchDoctorAppointmentById'));
  const error       = useSelector(selectClinicalError('fetchDoctorAppointmentById'));

  useEffect(() => {
    if (id) {
      dispatch(fetchDoctorAppointmentById(id));
    }
    return () => {
      dispatch(clearSelectedDoctorAppointment());
    };
  }, [dispatch, id]);

  const patient = useMemo(() => getPatientData(appointment), [appointment]);
  const statusInfo = statusConfig(appointment?.status);
  const StatusIcon = statusInfo.Icon;

  // Render Error
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-error mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2">Failed to Load</h2>
          <p className="text-base-content/60 mb-6">{error}</p>
          <button className="btn btn-outline" onClick={() => router.back()}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render Loading
  if (loading || !appointment) {
    return (
      <div className="min-h-screen bg-base-100 p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content pb-12">
      
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-4 md:px-8 py-4"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black leading-tight flex items-center gap-3">
                Appointment Summary
                <span className={`badge ${statusInfo.bg} ${statusInfo.text} border-0 ml-2 hidden sm:inline-flex`}>
                  <StatusIcon size={12} className="mr-1" />
                  {statusInfo.label}
                </span>
              </h1>
              <p className="font-mono text-sm text-base-content/50 mt-0.5 flex items-center gap-2">
                <Hash size={12} /> {appointment.bookingCode || appointment._id}
              </p>
            </div>
          </div>
          
          {/* Quick Actions Header */}
          <div className="hidden md:flex gap-2">
            <button
              className="btn btn-outline btn-sm gap-2"
              onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${appointment._id}`)}
            >
              <PenLine size={14} /> Prescribe
            </button>
            {canJoinConsult(appointment) && (
              <button
                className="btn btn-info btn-sm gap-2"
                onClick={() => router.push(`/doctor/consultation/${appointment.consultationSessionId?.consultationId || appointment.consultationSessionId || appointment._id}`)}
              >
                <Video size={14} /> Join Call
              </button>
            )}
          </div>
        </div>
      </motion.header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 mt-8">
        
        {/* Mobile Status Badge */}
        <div className="sm:hidden mb-6 flex justify-between items-center bg-base-200 p-3 rounded-xl border border-base-300">
          <span className="text-sm font-semibold">Current Status</span>
          <span className={`badge ${statusInfo.bg} ${statusInfo.text} border-0`}>
            <StatusIcon size={12} className="mr-1" />
            {statusInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* ── Left Column (Details) ── */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            
            {/* Patient Info Card */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6 md:p-8 border border-base-200"
            >
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <User size={20} className="text-primary" /> Patient Information
              </h2>
              
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="avatar placeholder">
                  <div className="w-24 h-24 rounded-2xl bg-primary/10 text-primary text-4xl font-black shadow-sm">
                    <span>{patient.initial}</span>
                  </div>
                </div>
                
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                  <div>
                    <p className="label-text-alt uppercase tracking-widest mb-1 text-base-content/60">Full Name</p>
                    <p className="font-semibold text-lg">{patient.name}</p>
                    {appointment.patientInfo?.isSelf === false && (
                      <span className="badge badge-sm badge-ghost mt-1">Booked for Someone Else</span>
                    )}
                  </div>
                  <div>
                    <p className="label-text-alt uppercase tracking-widest mb-1 text-base-content/60">Contact Details</p>
                    <div className="space-y-1">
                      <p className="font-medium text-sm flex items-center gap-2">
                        <Phone size={14} className="text-base-content/40" /> 
                        {patient.phone}
                      </p>
                      <p className="font-medium text-sm flex items-center gap-2 break-all">
                        <Mail size={14} className="text-base-content/40" /> 
                        {patient.email}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 col-span-1 sm:col-span-2 bg-base-200/50 p-4 rounded-xl border border-base-300/50 mt-2">
                    <div>
                      <p className="label-text-alt mb-1 text-base-content/60">Age / Gender</p>
                      <p className="font-semibold text-sm">{patient.age} Yrs • {patient.gender}</p>
                    </div>
                    <div>
                      <p className="label-text-alt mb-1 text-base-content/60">Blood Group</p>
                      <p className="font-semibold text-sm flex items-center gap-1">
                        <Droplet size={14} className="text-error" /> {patient.blood}
                      </p>
                    </div>
                    <div>
                      <p className="label-text-alt mb-1 text-base-content/60">Weight</p>
                      <p className="font-semibold text-sm flex items-center gap-1">
                        <Weight size={14} className="text-info" /> {patient.weight}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Appointment Details Card */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6 md:p-8 border border-base-200"
            >
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Calendar size={20} className="text-primary" /> Appointment Details
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-info/10 text-info mt-1 shadow-sm">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="label-text-alt uppercase tracking-widest mb-1 text-base-content/60">Scheduled For</p>
                      <p className="font-semibold text-base">{formatDate(appointment.scheduledAt)}</p>
                      <p className="text-xs text-base-content/50 mt-0.5">Created: {formatDate(appointment.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-1 shadow-sm">
                      {getConsultIcon(appointment.consultationType)}
                    </div>
                    <div>
                      <p className="label-text-alt uppercase tracking-widest mb-1 text-base-content/60">Consultation Type</p>
                      <p className="font-semibold text-base capitalize">
                        {appointment.consultationType?.replace(/([A-Z])/g, ' $1').trim() || 'In Person'}
                      </p>
                      <p className="text-xs text-base-content/50 mt-0.5 capitalize">
                        {appointment.bookingType?.replace(/_/g, ' ') || 'Standard'}
                      </p>
                    </div>
                  </div>
                </div>

                {appointment.opRecord && (
                  <div className="sm:col-span-2 border-t border-base-200 pt-5 mt-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-accent/10 text-accent mt-1 shadow-sm">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="label-text-alt uppercase tracking-widest mb-1 text-base-content/60">OP Record</p>
                        <p className="font-mono font-semibold text-base">{appointment.opRecord.opNumber}</p>
                        {appointment.opRecord.followUpExpiry && (
                          <p className="text-xs text-base-content/50 mt-0.5">
                            Valid until: {formatDate(appointment.opRecord.followUpExpiry)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {appointment.hospital && (
                  <div className="sm:col-span-2 border-t border-base-200 pt-5 mt-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-base-200 text-base-content mt-1 shadow-sm">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="label-text-alt uppercase tracking-widest mb-1 text-base-content/60">Location / Hospital</p>
                        <p className="font-semibold text-base">{appointment.hospital.name}</p>
                        <p className="text-sm text-base-content/70 mt-1 leading-relaxed">
                          {formatAddress(appointment.hospital.address)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>

          </div>

          {/* ── Right Column (Payment & Actions) ── */}
          <div className="space-y-6 lg:space-y-8">
            
            {/* Financial Summary Card */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6 border border-base-300/50"
            >
              <h2 className="text-base font-bold mb-5 flex items-center gap-2">
                <Receipt size={18} className="text-primary" /> Fare Breakdown
              </h2>
              
              <div className="space-y-3 text-sm">
                
                <div className="flex justify-between items-center text-base-content/80">
                  <span>Consultation Fee</span>
                  <span className="font-medium">{formatCurrency(appointment.fareBreakdown?.consultationFee)}</span>
                </div>
                
                {appointment.fareBreakdown?.careAssistantFee > 0 && (
                  <div className="flex justify-between items-center text-base-content/80">
                    <span>Care Assistant Fee</span>
                    <span className="font-medium">{formatCurrency(appointment.fareBreakdown.careAssistantFee)}</span>
                  </div>
                )}

                {appointment.fareBreakdown?.discount > 0 && (
                  <div className="flex justify-between items-center text-success">
                    <span>Discount Applied</span>
                    <span className="font-medium">-{formatCurrency(appointment.fareBreakdown.discount)}</span>
                  </div>
                )}

                <div className="divider my-2"></div>

                <div className="flex justify-between items-center pb-2">
                  <span className="font-bold text-base">Total Amount</span>
                  <span className="font-mono font-bold text-lg">{formatCurrency(appointment.fareBreakdown?.totalAmount)}</span>
                </div>

                <div className="flex justify-between items-center bg-base-200/50 p-3 rounded-lg border border-base-300">
                  <span className="text-sm text-base-content/70 font-medium">Payment Status</span>
                  <span className={`badge badge-sm border-0 font-bold ${
                    appointment.paymentStatus === 'paid' ? 'bg-success/20 text-success' : 
                    ['unpaid', 'failed'].includes(appointment.paymentStatus) ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                  }`}>
                    {appointment.paymentStatus?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>

                {appointment.payAtService?.enabled && (
                  <div className="mt-3 p-3 bg-info/10 rounded-lg text-info text-xs flex items-center gap-2">
                    <BadgeCheck size={14} className="shrink-0" />
                    <span>Pay at service is enabled for this appointment.</span>
                  </div>
                )}

              </div>
            </motion.section>

            {/* Quick Actions Card */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card p-6 bg-base-200/50 border border-base-300"
            >
              <h2 className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-4">
                Clinical Actions
              </h2>
              
              <div className="space-y-3">
                {canJoinConsult(appointment) && (
                  <button 
                    onClick={() => router.push(`/doctor/consultation/${appointment.consultationSessionId?.consultationId || appointment.consultationSessionId || appointment._id}`)}
                    className="btn btn-info w-full justify-start gap-3 h-12 shadow-sm"
                  >
                    <Video size={18} /> Join Video Consultation
                  </button>
                )}

                <button 
                  onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${appointment._id}`)}
                  className="btn btn-primary w-full justify-start gap-3 h-12 shadow-primary"
                >
                  <PenLine size={18} /> Write Prescription
                </button>

                <button 
                  onClick={() => router.push(`/doctor/prescriptions?bookingId=${appointment._id}`)}
                  className="btn btn-outline w-full justify-start gap-3 h-12 bg-base-100"
                >
                  <FileText size={18} /> View Past Prescriptions
                </button>

                {appointment.opRecord?._id && (
                  <button 
                    onClick={() => router.push(`/doctor/op-records/${appointment.opRecord._id}`)}
                    className="btn w-full justify-start gap-3 h-12 bg-base-100 border-base-300 hover:border-accent hover:text-accent transition-colors"
                  >
                    <Activity size={18} /> Open OP Record
                  </button>
                )}
              </div>
            </motion.section>
            
          </div>
        </div>
      </main>
    </div>
  );
}