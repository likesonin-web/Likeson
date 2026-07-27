'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, Mail, MapPin, Shield, Heart, Pill, FileText,
  Bell, Monitor, Key, Lock, ChevronRight, ChevronDown, ChevronUp,
  Plus, Trash2, Edit3, Upload, Eye, CheckCircle, Clock, AlertCircle,
  Activity, Droplets, Thermometer, Wind, Zap, Weight, Ruler,
  CreditCard, Building2, Star, LogOut, Smartphone, Globe,
  Settings, Camera, Download, X, Check, Calendar, Users,
  Stethoscope, ClipboardList, BookOpen, TrendingUp, Award,
  BarChart3, RefreshCw, Info,
} from 'lucide-react';

import {
  fetchMyProfile,
  updateMyUser,
  updateMyCustomerProfile,
  uploadKyc,
  fetchKyc,
  deleteKycByType,
  addGovernmentScheme,
  deleteGovernmentScheme,
  addPrivateInsurance,
  deletePrivateInsurance,
  updateConsent,
  fetchAuditSessions,
  deleteAuditSession,
  deleteAllAuditSessions,
  deleteDeviceToken,
  requestUnblock,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchSnapshot,
  updateSnapshot,
  fetchPrescriptions,
  fetchPrescriptionByRx,
  fetchReports,
  uploadReportFiles,
  deleteReportFile,
  selectCustomerUser,
  selectCustomerProfile,
  selectKyc,
  selectGovernmentSchemes,
  selectPrivateInsurances,
  selectConsent,
  selectMedicalTimeline,
  selectMedicineHistory,
  selectVitalsBaseline,
  selectChronicConditions,
  selectAllergies,
  selectPreferredLanguage,
  selectAuditSessions,
  selectDeviceTokens,
  selectNotifications,
  selectUnreadCount,
  selectPrescriptions,
  selectReports,
  selectProfileLoading,
  selectSectionLoading,
} from '@/store/slices/customerProfileSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',       icon: User },
  { id: 'personal',   label: 'Personal',        icon: Settings },
  { id: 'kyc',        label: 'KYC',             icon: Shield },
  { id: 'insurance',  label: 'Insurance',       icon: CreditCard },
  { id: 'medical',    label: 'Medical',         icon: Stethoscope },
  { id: 'medicines',  label: 'Medicines',       icon: Pill },
  { id: 'vitals',     label: 'Vitals',          icon: Activity },
  { id: 'consent',    label: 'Consent',         icon: CheckCircle },
  { id: 'rx',         label: 'Prescriptions',   icon: ClipboardList },
  { id: 'reports',    label: 'Reports',         icon: FileText },
  { id: 'notifs',     label: 'Notifications',   icon: Bell },
  { id: 'sessions',   label: 'Sessions',        icon: Monitor },
];

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-','Bombay Phenotype (hh)','Rh-null (Golden Blood)','Rare/Other'];
const GENDERS = ['Male','Female','Transgender','Other','Prefer not to say'];
const KYC_TYPES = ['Aadhaar','PAN','VoterID','Driving License','Passport','NREGA Job Card'];
const GOV_SCHEMES = [
  'Ayushman Bharat (PM-JAY)','Central Government Health Scheme (CGHS)',
  'Employees State Insurance (ESI)','Dr. YSR Aarogyasri (Andhra Pradesh)',
  'Mahatma Jyotiba Phule Jan Arogya Yojana','Biju Swasthya Kalyan Yojana',
  'Karunya Health Scheme','Tamil Nadu CMCHIS','Swasthya Sathi',
  'Aam Aadmi Bima Yojana','Rashtriya Swasthya Bima Yojana (RSBY)',
  'Other State Scheme',
];

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: 'easeOut' },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function FieldNote({ children }) {
  return (
    <p className="text-base-content/40 text-[11px] mt-1 flex items-center gap-1">
      <Info size={10} className="shrink-0" />
      {children}
    </p>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-1.5 rounded-lg">
          <Icon size={16} className="text-primary" />
        </div>
        <h3 className="font-montserrat font-extrabold text-base-content text-base">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-base-content/40">
      <Icon size={36} strokeWidth={1.2} />
      <p className="font-semibold text-xs">{message}</p>
      {sub && <p className="text-[11px]">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Verified:   'badge-success',
    Pending:    'badge-warning',
    'In-Review':'badge-info',
    Rejected:   'badge-error',
    issued:     'badge-info',
    dispensed:  'badge-success',
    cancelled:  'badge-error',
    expired:    'badge-error',
    draft:      'badge-warning',
  };
  return <span className={`badge ${map[status] || 'badge-secondary'} badge-sm`}>{status}</span>;
}

function LoadingRow({ count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="skeleton h-16 w-full rounded-xl mb-3" />
  ));
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="card bg-base-100 w-full mt-20 max-w-lg max-h-[60vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-base-300">
              <h4 className="font-montserrat font-extrabold text-base-content">{title}</h4>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function OverviewSection({ user, profile }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectSectionLoading('profile'));

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    workStatus: user?.workStatus || '',
    lastKnownAddress: user?.lastKnownAddress || '',
  });

  const handleSave = async () => {
    await dispatch(updateMyUser(form));
    setEditing(false);
  };

  const statItems = [
    { label: 'Bookings',       value: profile?.stats?.totalBookings        || 0, icon: Calendar },
    { label: 'Consultations',  value: profile?.stats?.totalConsultations   || 0, icon: Stethoscope },
    { label: 'Transport Rides',value: profile?.stats?.totalTransportRides  || 0, icon: TrendingUp },
    { label: 'Pharmacy Orders',value: profile?.stats?.totalPharmacyOrders  || 0, icon: Pill },
    { label: 'Diagnostic Tests',value:profile?.stats?.totalDiagnosticTests || 0, icon: BarChart3 },
    { label: 'Care Assists',   value: profile?.stats?.totalCareAssistUses  || 0, icon: Heart },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

      {/* Profile card */}
      <motion.div variants={fadeUp} className="card p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20">
              <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
            </div>
            <span className={`absolute -bottom-1 -right-1 status-dot ${user?.isOnline ? 'status-dot-success' : 'status-dot-error'} w-3 h-3 border-2 border-base-100`} />
          </div>

          <div className="flex-1 text-center sm:text-left">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="label-text">Full Name</label>
                  <input className="input-field" value={form.name} onChange={e => setForm(p=>({...p, name: e.target.value}))} />
                  <FieldNote>Legal name as on ID documents</FieldNote>
                </div>
                <div>
                  <label className="label-text">Phone Number</label>
                  <input className="input-field" value={form.phone} onChange={e => setForm(p=>({...p, phone: e.target.value}))} placeholder="+91XXXXXXXXXX" />
                  <FieldNote>Indian mobile number (+91). Used for OTP & alerts</FieldNote>
                </div>
                <div>
                  <label className="label-text">Work Status</label>
                  <input className="input-field" value={form.workStatus} onChange={e => setForm(p=>({...p, workStatus: e.target.value}))} placeholder="e.g. Employed, Self-Employed" />
                  <FieldNote>Helps tailor insurance and scheme suggestions</FieldNote>
                </div>
                <div>
                  <label className="label-text">Last Known Address</label>
                  <input className="input-field" value={form.lastKnownAddress} onChange={e => setForm(p=>({...p, lastKnownAddress: e.target.value}))} />
                  <FieldNote>Used for emergency dispatch and service area detection</FieldNote>
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
                    {loading ? <span className="loading loading-xs" /> : <Check size={14}/>} Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-montserrat font-extrabold text-2xl text-base-content">{user?.name}</h2>
                <p className="text-base-content/60 text-xs mt-0.5">{user?.email}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                  <span className="role-badge">{user?.role}</span>
                  {user?.isEmailVerified && <span className="badge badge-success badge-sm">Email Verified</span>}
                  {user?.isPhoneVerified && <span className="badge badge-success badge-sm">Phone Verified</span>}
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-4 text-xs text-base-content/60">
                  {user?.phone && <span className="flex items-center gap-1"><Phone size={13}/>{user.phone}</span>}
                  {user?.lastKnownAddress && <span className="flex items-center gap-1"><MapPin size={13}/>{user.lastKnownAddress}</span>}
                </div>
                <button className="btn btn-outline btn-sm mt-4" onClick={() => setEditing(true)}>
                  <Edit3 size={13}/> Edit Profile
                </button>
              </>
            )}
          </div>

          {/* Coins */}
          <div className="shrink-0 text-center">
            <div className="bg-accent/10 border border-accent/30 rounded-2xl px-6 py-4">
              <p className="text-2xl font-montserrat font-extrabold text-accent">{user?.coins?.toLocaleString() || 0}</p>
              <p className="text-[11px] font-semibold text-base-content/50 mt-0.5">COINS</p>
              <p className="text-[11px] text-base-content/40 mt-1">≈ ₹{((user?.coins || 0) / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Referral */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Award} title="Referral Program" />
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label-text">Your Referral Code</label>
            <div className="flex w-fit items-center gap-2 mt-1">
              <code className="bg-primary/10 text-primary font-bold px-4 py-2 rounded-lg text-xs tracking-widest flex-1">
                {user?.referralCode || '—'}
              </code>
              <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(user?.referralCode)}>
                Copy
              </button>
            </div>
            <FieldNote>Share to earn 1,000 coins per successful referral. Friend gets 500 coins</FieldNote>
          </div>
          <div className="sm:text-right">
            <p className="label-text">Coins Earned</p>
            <p className="text-success font-extrabold text-lg">{user?.coinsEarned?.toLocaleString() || 0}</p>
            <p className="label-text mt-2">Coins Redeemed</p>
            <p className="text-error font-extrabold text-lg">{user?.coinsRedeemed?.toLocaleString() || 0}</p>
          </div>
        </div>
        {user?.referralHistory?.length > 0 && (
          <div className="mt-4 border-t border-base-300 pt-4">
            <p className="label-text mb-2">Referral History ({user.referralHistory.length})</p>
            <div className="space-y-2">
              {user.referralHistory.slice(0,3).map((r) => (
                <div key={r._id} className="flex justify-between text-xs">
                  <span className="text-base-content/60">Referred user</span>
                  <span className="text-success font-semibold">+{r.coinsAwarded} coins</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={BarChart3} title="Activity Stats" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statItems.map(({ label, value, icon: Icon }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className="text-primary/60" />
                <span className="stat-card-label">{label}</span>
              </div>
              <span className="stat-card-value">{value}</span>
            </div>
          ))}
        </div>
        <FieldNote>Stats auto-update after each booking or service use</FieldNote>
      </motion.div>

      {/* Account info */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Settings} title="Account Info" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {[
            { label: 'Account Created',     value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '—', note: 'Date this account was registered' },
            { label: 'Last Login',          value: user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : '—', note: 'Most recent successful login timestamp' },
            { label: 'Last Login IP',       value: user?.lastLoginIp || '—', note: 'IP address of most recent login' },
            { label: 'Login Count',         value: user?.loginCount || 0, note: 'Total number of successful logins' },
            { label: 'Terms Accepted',      value: user?.termsAcceptedAt ? new Date(user.termsAcceptedAt).toLocaleDateString('en-IN') : 'Not accepted', note: 'Date you accepted the Terms of Service' },
            { label: 'Privacy Policy',      value: user?.privacyPolicyAcceptedAt ? new Date(user.privacyPolicyAcceptedAt).toLocaleDateString('en-IN') : 'Not accepted', note: 'Date you accepted the Privacy Policy' },
            { label: 'Password Changed',    value: user?.passwordChangedAt ? new Date(user.passwordChangedAt).toLocaleDateString('en-IN') : 'Never', note: 'Last time password was updated' },
            { label: 'Referred By',         value: user?.referredBy ? 'Another user' : 'Direct signup', note: 'Whether you joined via referral' },
          ].map(({ label, value, note }) => (
            <div key={label}>
              <p className="label-text text-base-content/50">{label}</p>
              <p className="text-base-content font-family-poppins font-medium">{String(value)}</p>
              <FieldNote>{note}</FieldNote>
            </div>
          ))}
        </div>
      </motion.div>

    </motion.div>
  );
}

// ─── Personal Section ─────────────────────────────────────────────────────────

function PersonalSection({ profile }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectSectionLoading('profile'));
  const [form, setForm] = useState({
    gender: profile?.gender || '',
    dob: profile?.dob ? profile.dob.slice(0,10) : '',
    bloodGroup: profile?.bloodGroup || '',
    preferredLanguage: profile?.preferredLanguage || 'English',
    address: profile?.address || {},
    emergencyContact: profile?.emergencyContact || {},
    chronicConditions: (profile?.chronicConditions || []).join(', '),
    allergies: (profile?.allergies || []).join(', '),
    notifPrefs: profile?.notifPrefs || { sms: true, email: true, push: true, whatsapp: true },
  });

  const handleSave = () => {
    dispatch(updateMyCustomerProfile({
      ...form,
      chronicConditions: form.chronicConditions.split(',').map(s=>s.trim()).filter(Boolean),
      allergies: form.allergies.split(',').map(s=>s.trim()).filter(Boolean),
    }));
  };

  const setAddr = (k,v) => setForm(p=>({...p, address: {...p.address,[k]:v}}));
  const setEC = (k,v) => setForm(p=>({...p, emergencyContact: {...p.emergencyContact,[k]:v}}));
  const setNotif = (k) => setForm(p=>({...p, notifPrefs: {...p.notifPrefs,[k]:!p.notifPrefs[k]}}));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

      {/* Basic Info */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={User} title="Basic Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Gender</label>
            <select className="input-field mt-1" value={form.gender} onChange={e=>setForm(p=>({...p,gender:e.target.value}))}>
              <option value="">Select gender</option>
              {GENDERS.map(g=><option key={g}>{g}</option>)}
            </select>
            <FieldNote>Used in medical records and personalised care</FieldNote>
          </div>
          <div>
            <label className="label-text">Date of Birth</label>
            <input type="date" className="input-field mt-1" value={form.dob} onChange={e=>setForm(p=>({...p,dob:e.target.value}))} />
            <FieldNote>Used to calculate age and age-appropriate health reminders</FieldNote>
          </div>
          <div>
            <label className="label-text">Blood Group</label>
            <select className="input-field mt-1" value={form.bloodGroup} onChange={e=>setForm(p=>({...p,bloodGroup:e.target.value}))}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
            </select>
            <FieldNote>Critical during emergencies and blood transfusions</FieldNote>
          </div>
          <div>
            <label className="label-text">Preferred Language</label>
            <input className="input-field mt-1" value={form.preferredLanguage} onChange={e=>setForm(p=>({...p,preferredLanguage:e.target.value}))} placeholder="e.g. Telugu, Hindi, English" />
            <FieldNote>Consultations and notifications will use this language where possible</FieldNote>
          </div>
        </div>
      </motion.div>

      {/* Address */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={MapPin} title="Address" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label-text">Street Address</label>
            <input className="input-field mt-1" value={form.address.street||''} onChange={e=>setAddr('street',e.target.value)} placeholder="House no., Street, Locality" />
            <FieldNote>Full street address for home visits and sample collection</FieldNote>
          </div>
          <div>
            <label className="label-text">City</label>
            <input className="input-field mt-1" value={form.address.city||''} onChange={e=>setAddr('city',e.target.value)} />
            <FieldNote>City helps match nearby service providers</FieldNote>
          </div>
          <div>
            <label className="label-text">State</label>
            <input className="input-field mt-1" value={form.address.state||''} onChange={e=>setAddr('state',e.target.value)} />
            <FieldNote>State determines applicable government health schemes</FieldNote>
          </div>
          <div>
            <label className="label-text">PIN Code</label>
            <input className="input-field mt-1" value={form.address.pinCode||''} onChange={e=>setAddr('pinCode',e.target.value)} placeholder="6-digit PIN" />
            <FieldNote>PIN code used for pinpoint area-based service matching</FieldNote>
          </div>
          <div>
            <label className="label-text">Country</label>
            <input className="input-field mt-1" value={form.address.country||'India'} onChange={e=>setAddr('country',e.target.value)} />
            <FieldNote>Service availability is currently India-only</FieldNote>
          </div>
          <div>
            <label className="label-text">GPS Latitude</label>
            <input type="number" className="input-field mt-1" value={form.address.coords?.lat||''} onChange={e=>setForm(p=>({...p,address:{...p.address,coords:{...p.address.coords,lat:e.target.value}}}))} placeholder="e.g. 16.5061" />
            <FieldNote>Optional — enables precise ambulance/care dispatch</FieldNote>
          </div>
          <div>
            <label className="label-text">GPS Longitude</label>
            <input type="number" className="input-field mt-1" value={form.address.coords?.lng||''} onChange={e=>setForm(p=>({...p,address:{...p.address,coords:{...p.address.coords,lng:e.target.value}}}))} placeholder="e.g. 80.6480" />
            <FieldNote>Optional — enables precise ambulance/care dispatch</FieldNote>
          </div>
        </div>
      </motion.div>

      {/* Emergency Contact */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Phone} title="Emergency Contact" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-text">Contact Name</label>
            <input className="input-field mt-1" value={form.emergencyContact.name||''} onChange={e=>setEC('name',e.target.value)} placeholder="Full name" />
            <FieldNote>Person to notify in a medical emergency</FieldNote>
          </div>
          <div>
            <label className="label-text">Contact Phone</label>
            <input className="input-field mt-1" value={form.emergencyContact.phone||''} onChange={e=>setEC('phone',e.target.value)} placeholder="+91XXXXXXXXXX" />
            <FieldNote>Must be reachable 24/7 — use a mobile number</FieldNote>
          </div>
          <div>
            <label className="label-text">Relationship</label>
            <input className="input-field mt-1" value={form.emergencyContact.relation||''} onChange={e=>setEC('relation',e.target.value)} placeholder="e.g. Spouse, Father" />
            <FieldNote>Relationship to you — helps responders communicate</FieldNote>
          </div>
        </div>
      </motion.div>

      {/* Health conditions */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Heart} title="Health Conditions" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Chronic Conditions</label>
            <textarea className="input-field mt-1 resize-none" rows={3} value={form.chronicConditions} onChange={e=>setForm(p=>({...p,chronicConditions:e.target.value}))} placeholder="Diabetes, Hypertension, Asthma..." />
            <FieldNote>Comma-separated. Shared with doctors during consultations for context</FieldNote>
          </div>
          <div>
            <label className="label-text">Allergies</label>
            <textarea className="input-field mt-1 resize-none" rows={3} value={form.allergies} onChange={e=>setForm(p=>({...p,allergies:e.target.value}))} placeholder="Penicillin, Peanuts, Dust..." />
            <FieldNote>Comma-separated. Alerts doctors before prescribing to avoid reactions</FieldNote>
          </div>
        </div>
      </motion.div>

      {/* Notification Preferences */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Bell} title="Notification Preferences" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'sms',      label: 'SMS',      note: 'Text alerts for bookings and emergencies' },
            { key: 'email',    label: 'Email',    note: 'Detailed reports and summaries via email' },
            { key: 'push',     label: 'Push',     note: 'App notifications for real-time updates' },
            { key: 'whatsapp', label: 'WhatsApp', note: 'Rich messages and prescription images' },
          ].map(({ key, label, note }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="label cursor-pointer gap-2">
                <input type="checkbox" className="checkbox checkbox-sm" checked={!!form.notifPrefs[key]} onChange={() => setNotif(key)} />
                <span className="label-text">{label}</span>
              </label>
              <FieldNote>{note}</FieldNote>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <button className="btn btn-primary w-full sm:w-auto" onClick={handleSave} disabled={loading}>
          {loading ? <span className="loading loading-sm" /> : <Check size={15}/>} Save Personal Info
        </button>
      </motion.div>

    </motion.div>
  );
}

// ─── KYC Section ─────────────────────────────────────────────────────────────

function KycSection() {
  const dispatch = useDispatch();
  const kyc = useSelector(selectKyc);
  const loading = useSelector(selectSectionLoading('kyc'));
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ type: '', documentNumber: '', holderName: '' });
  const [files, setFiles] = useState({});

  useEffect(() => { dispatch(fetchKyc()); }, [dispatch]);

  const handleSubmit = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k,v]) => v && fd.append(k,v));
    if (files.documentFile) fd.append('documentFile', files.documentFile);
    if (files.backSideFile)  fd.append('backSideFile',  files.backSideFile);
    dispatch(uploadKyc(fd)).then(() => { setModal(false); setForm({ type:'', documentNumber:'', holderName:'' }); setFiles({}); });
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader
          icon={Shield}
          title="KYC Documents"
          action={<button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={13}/>Add KYC</button>}
        />
        <p className="text-base-content/50 text-[11px] mb-4">Identity verification required for insurance claims and government scheme access.</p>

        {loading ? <LoadingRow /> : kyc.length === 0 ? (
          <EmptyState icon={Shield} message="No KYC documents" sub="Add at least one ID to verify your identity" />
        ) : (
          <div className="space-y-3">
            {kyc.map((doc) => (
              <motion.div key={doc._id} variants={fadeUp} className="glass-card p-4 flex items-center gap-4">
                <div className="bg-primary/10 p-2.5 rounded-xl shrink-0">
                  <Shield size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-xs text-base-content">{doc.type}</p>
                    <StatusBadge status={doc.verificationStatus} />
                  </div>
                  <p className="text-[11px] text-base-content/50 mt-0.5">
                    {doc.holderName && `Holder: ${doc.holderName} · `}
                    {doc.documentNumber && `#${doc.documentNumber}`}
                  </p>
                  {doc.rejectionReason && <p className="text-[11px] text-error mt-0.5">Reason: {doc.rejectionReason}</p>}
                  {doc.verifiedAt && <p className="text-[11px] text-success mt-0.5">Verified: {new Date(doc.verifiedAt).toLocaleDateString('en-IN')}</p>}
                </div>
                {doc.documentUrl && (
                  <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs btn-circle">
                    <Eye size={13} />
                  </a>
                )}
                <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => dispatch(deleteKycByType(doc.type))}>
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add KYC Document">
        <div className="space-y-4">
          <div>
            <label className="label-text">Document Type *</label>
            <select className="input-field mt-1" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
              <option value="">Select type</option>
              {KYC_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <FieldNote>Each document type can only have one active entry — re-uploading replaces the old one</FieldNote>
          </div>
          <div>
            <label className="label-text">Document Number</label>
            <input className="input-field mt-1" value={form.documentNumber} onChange={e=>setForm(p=>({...p,documentNumber:e.target.value}))} placeholder="e.g. XXXX XXXX XXXX" />
            <FieldNote>Exact number printed on the document — used for verification</FieldNote>
          </div>
          <div>
            <label className="label-text">Holder Name</label>
            <input className="input-field mt-1" value={form.holderName} onChange={e=>setForm(p=>({...p,holderName:e.target.value}))} placeholder="Name as on document" />
            <FieldNote>Must match the name on the document exactly</FieldNote>
          </div>
          <div>
            <label className="label-text">Front Side (required)</label>
            <input type="file" className="input-field mt-1" accept="image/*,application/pdf" onChange={e=>setFiles(p=>({...p,documentFile:e.target.files[0]}))} />
            <FieldNote>Clear photo or scan — max 10MB, JPG/PNG/PDF</FieldNote>
          </div>
          <div>
            <label className="label-text">Back Side (optional)</label>
            <input type="file" className="input-field mt-1" accept="image/*,application/pdf" onChange={e=>setFiles(p=>({...p,backSideFile:e.target.files[0]}))} />
            <FieldNote>Required for Aadhaar and Driving License back page</FieldNote>
          </div>
          <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={!form.type || loading}>
            {loading ? <span className="loading loading-sm"/> : <Upload size={14}/>} Upload Document
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

// ─── Insurance Section ─────────────────────────────────────────────────────────

function InsuranceSection({ profile }) {
  const dispatch = useDispatch();
  const govSchemes = useSelector(selectGovernmentSchemes);
  const privInsurances = useSelector(selectPrivateInsurances);
  const schemeLoading = useSelector(selectSectionLoading('schemes'));
  const insLoading = useSelector(selectSectionLoading('privateInsurances'));

  const [govModal, setGovModal] = useState(false);
  const [insModal, setInsModal] = useState(false);
  const [govForm, setGovForm] = useState({ schemeName: '', beneficiaryId: '', holderName: '' });
  const [insForm, setInsForm] = useState({ insurerName: '', policyNumber: '', tpaName: '', holderName: '', sumInsured: '', validFrom: '', validTo: '' });
  const [govFile, setGovFile] = useState(null);
  const [insFile, setInsFile] = useState(null);

  const submitGov = () => {
    const fd = new FormData();
    Object.entries(govForm).forEach(([k,v]) => v && fd.append(k,v));
    if (govFile) fd.append('documentFile', govFile);
    dispatch(addGovernmentScheme(fd)).then(() => { setGovModal(false); setGovForm({ schemeName:'', beneficiaryId:'', holderName:'' }); });
  };

  const submitIns = () => {
    const fd = new FormData();
    Object.entries(insForm).forEach(([k,v]) => v && fd.append(k,v));
    if (insFile) fd.append('cardFile', insFile);
    dispatch(addPrivateInsurance(fd)).then(() => { setInsModal(false); setInsForm({ insurerName:'', policyNumber:'', tpaName:'', holderName:'', sumInsured:'', validFrom:'', validTo:'' }); });
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

      {/* Government Schemes */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader
          icon={Building2}
          title="Government Health Schemes"
          action={<button className="btn btn-primary btn-sm" onClick={() => setGovModal(true)}><Plus size={13}/>Add Scheme</button>}
        />
        <p className="text-[11px] text-base-content/50 mb-4">Link your government-issued health scheme card for cashless treatment eligibility.</p>
        {schemeLoading ? <LoadingRow /> : govSchemes.length === 0 ? (
          <EmptyState icon={Building2} message="No government schemes linked" sub="Add PM-JAY, CGHS, ESI or state schemes" />
        ) : (
          <div className="space-y-3">
            {govSchemes.map((s) => (
              <div key={s._id} className="glass-card p-4 flex items-center gap-4">
                <div className="bg-success/10 p-2.5 rounded-xl shrink-0"><Building2 size={18} className="text-success"/></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs">{s.schemeName}</p>
                  <p className="text-[11px] text-base-content/50">{s.holderName} {s.beneficiaryId && `· ID: ${s.beneficiaryId}`}</p>
                  {s.isVerified ? <span className="badge badge-success badge-xs mt-1">Verified</span> : <span className="badge badge-warning badge-xs mt-1">Pending Verification</span>}
                </div>
                {s.documentUrl && <a href={s.documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs btn-circle"><Eye size={13}/></a>}
                <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => dispatch(deleteGovernmentScheme(s._id))}><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Private Insurance */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader
          icon={CreditCard}
          title="Private Health Insurance"
          action={<button className="btn btn-primary btn-sm" onClick={() => setInsModal(true)}><Plus size={13}/>Add Insurance</button>}
        />
        <p className="text-[11px] text-base-content/50 mb-4">Private health insurance cards for cashless hospitalisation and TPA coordination.</p>
        {insLoading ? <LoadingRow /> : privInsurances.length === 0 ? (
          <EmptyState icon={CreditCard} message="No private insurance linked" sub="Add Star Health, Niva Bupa, or any other insurer" />
        ) : (
          <div className="space-y-3">
            {privInsurances.map((ins) => (
              <div key={ins._id} className="glass-card p-4 flex items-start gap-4">
                <div className="bg-info/10 p-2.5 rounded-xl shrink-0"><CreditCard size={18} className="text-info"/></div>
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <div><span className="text-base-content/50">Insurer</span><p className="font-semibold text-xs text-base-content">{ins.insurerName}</p></div>
                  {ins.policyNumber && <div><span className="text-base-content/50">Policy No.</span><p className="font-semibold">{ins.policyNumber}</p></div>}
                  {ins.tpaName && <div><span className="text-base-content/50">TPA</span><p className="font-semibold">{ins.tpaName}</p></div>}
                  {ins.holderName && <div><span className="text-base-content/50">Holder</span><p className="font-semibold">{ins.holderName}</p></div>}
                  {ins.sumInsured && <div><span className="text-base-content/50">Sum Insured</span><p className="font-semibold">₹{Number(ins.sumInsured).toLocaleString('en-IN')}</p></div>}
                  {ins.validTo && <div><span className="text-base-content/50">Valid Until</span><p className="font-semibold">{new Date(ins.validTo).toLocaleDateString('en-IN')}</p></div>}
                  <div className="col-span-2">{ins.isVerified ? <span className="badge badge-success badge-xs">Verified</span> : <span className="badge badge-warning badge-xs">Pending</span>}</div>
                </div>
                {ins.cardUrl && <a href={ins.cardUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs btn-circle"><Eye size={13}/></a>}
                <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => dispatch(deletePrivateInsurance(ins._id))}><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Gov scheme modal */}
      <Modal open={govModal} onClose={() => setGovModal(false)} title="Add Government Scheme">
        <div className="space-y-4">
          <div>
            <label className="label-text">Scheme Name *</label>
            <select className="input-field mt-1" value={govForm.schemeName} onChange={e=>setGovForm(p=>({...p,schemeName:e.target.value}))}>
              <option value="">Select scheme</option>
              {GOV_SCHEMES.map(s=><option key={s}>{s}</option>)}
            </select>
            <FieldNote>Select the exact scheme you are enrolled in</FieldNote>
          </div>
          <div>
            <label className="label-text">Beneficiary ID / Card Number</label>
            <input className="input-field mt-1" value={govForm.beneficiaryId} onChange={e=>setGovForm(p=>({...p,beneficiaryId:e.target.value}))} placeholder="e.g. PMJAY-XXXX-XXXX" />
            <FieldNote>Printed on your scheme health card — used for cashless claims</FieldNote>
          </div>
          <div>
            <label className="label-text">Card Holder Name</label>
            <input className="input-field mt-1" value={govForm.holderName} onChange={e=>setGovForm(p=>({...p,holderName:e.target.value}))} />
            <FieldNote>Primary beneficiary name as on the card</FieldNote>
          </div>
          <div>
            <label className="label-text">Upload Card / Document</label>
            <input type="file" className="input-field mt-1" accept="image/*,application/pdf" onChange={e=>setGovFile(e.target.files[0])} />
            <FieldNote>Photo or scan of scheme card — required for admin verification</FieldNote>
          </div>
          <button className="btn btn-primary w-full" onClick={submitGov} disabled={!govForm.schemeName || schemeLoading}>
            {schemeLoading ? <span className="loading loading-sm"/> : <Plus size={14}/>} Add Scheme
          </button>
        </div>
      </Modal>

      {/* Private ins modal */}
      <Modal open={insModal} onClose={() => setInsModal(false)} title="Add Private Insurance">
        <div className="space-y-4">
          <div>
            <label className="label-text">Insurance Company *</label>
            <input className="input-field mt-1" value={insForm.insurerName} onChange={e=>setInsForm(p=>({...p,insurerName:e.target.value}))} placeholder="e.g. Star Health, Niva Bupa" />
            <FieldNote>Name of insurance company — not the TPA or broker</FieldNote>
          </div>
          <div>
            <label className="label-text">Policy Number</label>
            <input className="input-field mt-1" value={insForm.policyNumber} onChange={e=>setInsForm(p=>({...p,policyNumber:e.target.value}))} />
            <FieldNote>Unique policy number from your insurance document</FieldNote>
          </div>
          <div>
            <label className="label-text">TPA (Third Party Administrator)</label>
            <input className="input-field mt-1" value={insForm.tpaName} onChange={e=>setInsForm(p=>({...p,tpaName:e.target.value}))} placeholder="e.g. Medi Assist, Paramount" />
            <FieldNote>TPA handles cashless hospitalisation approvals on insurer's behalf</FieldNote>
          </div>
          <div>
            <label className="label-text">Primary Holder Name</label>
            <input className="input-field mt-1" value={insForm.holderName} onChange={e=>setInsForm(p=>({...p,holderName:e.target.value}))} />
            <FieldNote>Name of the primary insured person</FieldNote>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Sum Insured (₹)</label>
              <input type="number" className="input-field mt-1" value={insForm.sumInsured} onChange={e=>setInsForm(p=>({...p,sumInsured:e.target.value}))} placeholder="e.g. 500000" />
              <FieldNote>Total coverage amount in INR</FieldNote>
            </div>
            <div>{/* layout balance */}</div>
            <div>
              <label className="label-text">Valid From</label>
              <input type="date" className="input-field mt-1" value={insForm.validFrom} onChange={e=>setInsForm(p=>({...p,validFrom:e.target.value}))} />
              <FieldNote>Policy start date</FieldNote>
            </div>
            <div>
              <label className="label-text">Valid Until</label>
              <input type="date" className="input-field mt-1" value={insForm.validTo} onChange={e=>setInsForm(p=>({...p,validTo:e.target.value}))} />
              <FieldNote>Policy expiry — renew before this date to stay covered</FieldNote>
            </div>
          </div>
          <div>
            <label className="label-text">Insurance Card Photo</label>
            <input type="file" className="input-field mt-1" accept="image/*,application/pdf" onChange={e=>setInsFile(e.target.files[0])} />
            <FieldNote>Front of your insurance / TPA card for verification</FieldNote>
          </div>
          <button className="btn btn-primary w-full" onClick={submitIns} disabled={!insForm.insurerName || insLoading}>
            {insLoading ? <span className="loading loading-sm"/> : <Plus size={14}/>} Add Insurance
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

// ─── Medical Timeline Section (read-only) ─────────────────────────────────────

function MedicalSection() {
  const timeline = useSelector(selectMedicalTimeline);
  const loading = useSelector(selectSectionLoading('medicalTimeline'));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={ClipboardList} title="Medical Timeline" />
        <p className="text-[11px] text-base-content/50 mb-4">
          Chronological record of hospital visits, surgeries, diagnoses and medical events.
          Entries are added by your care team.
        </p>

        {loading ? <LoadingRow count={4} /> : timeline.length === 0 ? (
          <EmptyState icon={ClipboardList} message="No medical events recorded" sub="Events appear here once logged by a doctor or care assistant" />
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-base-300" />
            <div className="space-y-4">
              {timeline.map((ev) => (
                <motion.div key={ev._id} variants={fadeUp} className="flex gap-4">
                  <div className="relative z-10 shrink-0 w-3 h-3 rounded-full bg-primary mt-2 ml-[18px]" />
                  <div className="glass-card flex-1 p-4">
                    <p className="font-semibold text-xs text-base-content">{ev.eventTitle}</p>
                    <p className="text-[11px] text-base-content/50 mt-0.5">
                      {ev.hospitalName && `${ev.hospitalName} · `}
                      {ev.doctorName && `Dr. ${ev.doctorName} · `}
                      {ev.date ? new Date(ev.date).toLocaleDateString('en-IN') : ''}
                    </p>
                    {ev.description && <p className="text-[11px] text-base-content/60 mt-1">{ev.description}</p>}
                    {ev.reportUrls?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ev.reportUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="badge badge-info badge-xs">
                            Report {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Medicines Section (read-only) ─────────────────────────────────────────────

function MedicinesSection() {
  const medicines = useSelector(selectMedicineHistory);
  const loading = useSelector(selectSectionLoading('medicineHistory'));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Pill} title="Medicine History" />
        <p className="text-[11px] text-base-content/50 mb-4">
          Current and past medications, added by your prescribing doctor.
        </p>

        {loading ? <LoadingRow count={4} /> : medicines.length === 0 ? (
          <EmptyState icon={Pill} message="No medicines recorded" sub="Medicines appear here after a prescription is issued" />
        ) : (
          <div className="space-y-3">
            {medicines.map((m) => (
              <motion.div key={m._id} variants={fadeUp} className="glass-card p-4 flex items-start gap-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${m.isOngoing ? 'bg-success/10' : 'bg-base-300'}`}>
                  <Pill size={18} className={m.isOngoing ? 'text-success' : 'text-base-content/40'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-xs">{m.medicineName}</p>
                    {m.isOngoing ? <span className="badge badge-success badge-xs">Ongoing</span> : <span className="badge badge-secondary badge-xs">Stopped</span>}
                  </div>
                  <p className="text-[11px] text-base-content/50 mt-0.5">
                    {m.dosage && `${m.dosage} · `}{m.frequency && `${m.frequency} · `}
                    {m.prescribingDoctor && `Dr. ${m.prescribingDoctor}`}
                  </p>
                  <p className="text-[11px] text-base-content/40">
                    {m.startDate && `From ${new Date(m.startDate).toLocaleDateString('en-IN')}`}
                    {m.endDate && !m.isOngoing && ` to ${new Date(m.endDate).toLocaleDateString('en-IN')}`}
                  </p>
                  {m.instructions && <p className="text-[11px] text-base-content/50 italic mt-0.5">{m.instructions}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Vitals Section ────────────────────────────────────────────────────────────

function VitalsSection() {
  const dispatch = useDispatch();
  const vitals = useSelector(selectVitalsBaseline);
  const chronicConditions = useSelector(selectChronicConditions);
  const allergies = useSelector(selectAllergies);
  const preferredLanguage = useSelector(selectPreferredLanguage);
  const loading = useSelector(selectSectionLoading('snapshot'));

  const [form, setForm] = useState({
    vitals: {
      bloodPressure: vitals?.bloodPressure || '',
      pulseRate:     vitals?.pulseRate     || '',
      temperature:   vitals?.temperature   || '',
      spO2:          vitals?.spO2          || '',
      bloodSugar:    vitals?.bloodSugar    || '',
      weightKg:      vitals?.weightKg      || '',
      heightCm:      vitals?.heightCm      || '',
    },
    chronicConditions: chronicConditions.join(', '),
    allergies:         allergies.join(', '),
    preferredLanguage,
  });

  useEffect(() => { dispatch(fetchSnapshot()); }, [dispatch]);

  const vitalFields = [
    { key:'bloodPressure', label:'Blood Pressure', placeholder:'120/80',  icon: Activity,    unit:'mmHg', note:'Systolic/Diastolic — normal 120/80 mmHg' },
    { key:'pulseRate',     label:'Pulse Rate',      placeholder:'72',       icon: Heart,        unit:'bpm',  note:'Resting heart rate — normal 60–100 bpm' },
    { key:'temperature',   label:'Temperature',     placeholder:'98.6',     icon: Thermometer,  unit:'°F',   note:'Body temperature — normal 98–99°F' },
    { key:'spO2',          label:'SpO₂',            placeholder:'98',       icon: Wind,         unit:'%',    note:'Blood oxygen saturation — normal ≥95%' },
    { key:'bloodSugar',    label:'Blood Sugar',     placeholder:'100',      icon: Zap,          unit:'mg/dL',note:'Fasting blood glucose — normal 70–100 mg/dL' },
    { key:'weightKg',      label:'Weight',          placeholder:'70',       icon: Weight,       unit:'kg',   note:'Body weight in kilograms' },
    { key:'heightCm',      label:'Height',          placeholder:'170',      icon: Ruler,        unit:'cm',   note:'Height in centimetres' },
  ];

  const handleSave = () => {
    dispatch(updateSnapshot({
      vitals: form.vitals,
      chronicConditions: form.chronicConditions.split(',').map(s=>s.trim()).filter(Boolean),
      allergies: form.allergies.split(',').map(s=>s.trim()).filter(Boolean),
      preferredLanguage: form.preferredLanguage,
    }));
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Activity} title="Baseline Vitals" />
        <p className="text-[11px] text-base-content/50 mb-4">Stored as your baseline — not a log. Updated when a Care Assistant records vitals or you update manually. Emergency card reads from here.</p>
        {vitals?.lastUpdated && (
          <div className="alert alert-info mb-4">
            <Info size={14}/>
            <span className="text-[11px]">Last updated: {new Date(vitals.lastUpdated).toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vitalFields.map(({ key, label, placeholder, icon: Icon, unit, note }) => (
            <div key={key}>
              <label className="label-text flex items-center gap-1.5"><Icon size={13} className="text-primary/60"/>{label} <span className="text-base-content/40 font-normal text-[11px]">({unit})</span></label>
              <input
                type={key === 'bloodPressure' ? 'text' : 'number'}
                className="input-field mt-1"
                placeholder={placeholder}
                value={form.vitals[key]}
                onChange={e => setForm(p=>({ ...p, vitals: { ...p.vitals, [key]: e.target.value } }))}
              />
              <FieldNote>{note}</FieldNote>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Heart} title="Health Snapshot" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Chronic Conditions</label>
            <textarea className="input-field mt-1 resize-none" rows={3} value={form.chronicConditions} onChange={e=>setForm(p=>({...p,chronicConditions:e.target.value}))} placeholder="Diabetes Type 2, Hypertension..." />
            <FieldNote>Comma-separated — pre-fills doctor consultation forms automatically</FieldNote>
          </div>
          <div>
            <label className="label-text">Allergies</label>
            <textarea className="input-field mt-1 resize-none" rows={3} value={form.allergies} onChange={e=>setForm(p=>({...p,allergies:e.target.value}))} placeholder="Penicillin, Sulfa, Latex..." />
            <FieldNote>Comma-separated — alerts doctor and pharmacist before prescribing</FieldNote>
          </div>
          <div>
            <label className="label-text">Preferred Language</label>
            <input className="input-field mt-1" value={form.preferredLanguage} onChange={e=>setForm(p=>({...p,preferredLanguage:e.target.value}))} placeholder="e.g. Telugu" />
            <FieldNote>Consultations and reports will use this language where supported</FieldNote>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <button className="btn btn-primary w-full sm:w-auto" onClick={handleSave} disabled={loading}>
          {loading ? <span className="loading loading-sm"/> : <Check size={14}/>} Save Vitals & Snapshot
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Consent Section ──────────────────────────────────────────────────────────

function ConsentSection() {
  const dispatch = useDispatch();
  const consent = useSelector(selectConsent);
  const loading = useSelector(selectSectionLoading('consent'));
  const [form, setForm] = useState({
    telemedicineConsent: consent?.telemedicineConsent || false,
    dataSharingConsent:  consent?.dataSharingConsent  || false,
    marketingConsent:    consent?.marketingConsent    || false,
    recordingConsent:    consent?.recordingConsent    || false,
    consentVersion:      consent?.consentVersion      || '',
  });

  const consentItems = [
    { key: 'telemedicineConsent', label: 'Telemedicine Consent', note: 'Allows doctors to consult with you via video/audio call — required for online consultations' },
    { key: 'dataSharingConsent',  label: 'Data Sharing Consent', note: 'Permits sharing your anonymised health data with partnered labs and diagnostic centres' },
    { key: 'marketingConsent',    label: 'Marketing Consent',    note: 'Receive health tips, offers, and promotional messages via SMS, email, and push' },
    { key: 'recordingConsent',    label: 'Recording Consent',    note: 'Allows audio/video recording of consultations for quality and medico-legal purposes' },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={CheckCircle} title="Consent Preferences" />
        <p className="text-[11px] text-base-content/50 mb-5">Manage your legal consents. You can update these at any time. Changes take effect immediately.</p>
        <div className="space-y-5">
          {consentItems.map(({ key, label, note }) => (
            <div key={key} className="flex items-start gap-4">
              <input
                type="checkbox"
                className="checkbox checkbox-success mt-0.5"
                checked={!!form[key]}
                onChange={e => setForm(p=>({...p,[key]:e.target.checked}))}
              />
              <div>
                <p className="label-text">{label}</p>
                <FieldNote>{note}</FieldNote>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-base-300 pt-5">
          <label className="label-text">Consent Version Acknowledged</label>
          <input className="input-field mt-1 max-w-xs" value={form.consentVersion} onChange={e=>setForm(p=>({...p,consentVersion:e.target.value}))} placeholder="e.g. v2.1" />
          <FieldNote>Version of the Privacy Policy or Terms you are consenting to</FieldNote>
        </div>

        {consent?.consentUpdatedAt && (
          <p className="text-[11px] text-base-content/40 mt-3">
            Last updated: {new Date(consent.consentUpdatedAt).toLocaleString('en-IN')}
          </p>
        )}

        <button className="btn btn-primary mt-5 w-full sm:w-auto" onClick={() => dispatch(updateConsent(form))} disabled={loading}>
          {loading ? <span className="loading loading-sm"/> : <Check size={14}/>} Save Consent Preferences
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Prescriptions Section ────────────────────────────────────────────────────

function PrescriptionsSection() {
  const dispatch = useDispatch();
  const prescriptions = useSelector(selectPrescriptions);
  const loading = useSelector(selectSectionLoading('prescriptions'));
  const [expanded, setExpanded] = useState(null);
  const [rxSearch, setRxSearch] = useState('');

  useEffect(() => { dispatch(fetchPrescriptions()); }, [dispatch]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={ClipboardList} title="E-Prescriptions" />
        <div className="mb-4 flex gap-2">
          <input className="input-field flex-1" placeholder="Search by RX number..." value={rxSearch} onChange={e=>setRxSearch(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={() => rxSearch && dispatch(fetchPrescriptionByRx(rxSearch))}>
            Search
          </button>
        </div>
        <FieldNote>Prescriptions are issued by doctors post-consultation. Valid for 30 days from issue date.</FieldNote>
        <div className="mt-4">
          {loading ? <LoadingRow count={3}/> : prescriptions.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No prescriptions" sub="Prescriptions appear after a doctor consultation" />
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx) => (
                <motion.div key={rx._id} variants={fadeUp} className="glass-card overflow-hidden">
                  <button
                    className="w-full p-4 flex items-center gap-4 text-left"
                    onClick={() => setExpanded(expanded === rx._id ? null : rx._id)}
                  >
                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0">
                      <ClipboardList size={18} className="text-primary"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-xs">{rx.rxNumber}</p>
                        <StatusBadge status={rx.status} />
                      </div>
                      <p className="text-[11px] text-base-content/50 mt-0.5">
                        Dr. {rx.doctor?.name} · {rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('en-IN') : ''} · {rx.medicines?.length || 0} medicine(s)
                      </p>
                    </div>
                    {expanded === rx._id ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </button>

                  <AnimatePresence>
                    {expanded === rx._id && (
                      <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-base-300 pt-4 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                            {[
                              { label: 'Patient',     value: rx.patient?.name },
                              { label: 'Age/Gender',  value: `${rx.patient?.age||'—'} / ${rx.patient?.gender||'—'}` },
                              { label: 'Blood Group', value: rx.patient?.bloodGroup || '—' },
                              { label: 'Diagnosis',   value: rx.diagnosis || '—' },
                              { label: 'ICD-10',      value: rx.diagnosisCode || '—' },
                              { label: 'Expires',     value: rx.expiresAt ? new Date(rx.expiresAt).toLocaleDateString('en-IN') : '—' },
                              { label: 'Hospital',    value: rx.hospital?.name || '—' },
                              { label: 'Dispensed',   value: rx.dispensedAt ? new Date(rx.dispensedAt).toLocaleDateString('en-IN') : 'Not yet' },
                              { label: 'Follow-Up',   value: rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString('en-IN') : '—' },
                            ].map(({ label, value }) => (
                              <div key={label}><p className="text-base-content/40">{label}</p><p className="font-semibold text-base-content">{value}</p></div>
                            ))}
                          </div>

                          {rx.medicines?.length > 0 && (
                            <div>
                              <p className="label-text mb-2">Medicines</p>
                              <div className="space-y-2">
                                {rx.medicines.map((m) => (
                                  <div key={m._id} className="bg-base-200 rounded-xl px-3 py-2 text-[11px] flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-base-content">{m.medicineName} <span className="font-normal text-base-content/50">{m.dosage}</span></p>
                                      <p className="text-base-content/50">{m.frequency} · {m.timing} · {m.route} {m.durationDays && `· ${m.durationDays} days`}</p>
                                    </div>
                                    {m.isSubstitutable && <span className="badge badge-secondary badge-xs shrink-0">Generic OK</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {rx.labTests?.length > 0 && (
                            <div>
                              <p className="label-text mb-2">Lab Tests Ordered</p>
                              <div className="space-y-1">
                                {rx.labTests.map((t, i) => (
                                  <div key={i} className="flex items-center gap-2 text-[11px]">
                                    <span className="badge badge-info badge-xs">{t.urgency}</span>
                                    <span className="text-base-content">{t.testName}</span>
                                    {t.testCode && <span className="text-base-content/40">({t.testCode})</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {rx.advice && <div><p className="label-text">Advice</p><p className="text-[11px] text-base-content/60 mt-1">{rx.advice}</p></div>}
                          {rx.followUpInstructions && <div><p className="label-text">Follow-Up Instructions</p><p className="text-[11px] text-base-content/60 mt-1">{rx.followUpInstructions}</p></div>}
                          {rx.referralNote && <div><p className="label-text">Referral Note</p><p className="text-[11px] text-base-content/60 mt-1">{rx.referralNote}</p></div>}
                          {rx.qrCodeUrl && <div><p className="label-text mb-1">Verification QR</p><img src={rx.qrCodeUrl} alt="QR" className="w-24 h-24 rounded-lg border border-base-300"/></div>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Reports Section ──────────────────────────────────────────────────────────

function ReportsSection() {
  const dispatch = useDispatch();
  const reports = useSelector(selectReports);
  const loading = useSelector(selectSectionLoading('reports'));

  useEffect(() => { dispatch(fetchReports()); }, [dispatch]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader
          icon={FileText}
          title="Medical Reports"
          action={<button className="btn btn-ghost btn-sm" onClick={() => dispatch(fetchReports())}><RefreshCw size={13}/></button>}
        />
        <p className="text-[11px] text-base-content/50 mb-4">Reports are linked to medical timeline events.</p>
        {loading ? <LoadingRow count={3}/> : reports.length === 0 ? (
          <EmptyState icon={FileText} message="No reports found" sub="Reports appear once uploaded by your care team" />
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <motion.div key={r.eventId} variants={fadeUp} className="glass-card p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="bg-info/10 p-2.5 rounded-xl shrink-0"><FileText size={18} className="text-info"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs">{r.eventTitle}</p>
                    <p className="text-[11px] text-base-content/50">
                      {r.hospitalName && `${r.hospitalName} · `}
                      {r.doctorName && `Dr. ${r.doctorName} · `}
                      {r.date ? new Date(r.date).toLocaleDateString('en-IN') : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.reportUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs gap-1">
                          <Download size={11}/> File {i+1}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Notifications Section ────────────────────────────────────────────────────

function NotificationsSection() {
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectSectionLoading('notifications'));

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  const priorityColor = { High: 'badge-error', Medium: 'badge-warning', Low: 'badge-info' };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader
          icon={Bell}
          title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          action={
            unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => dispatch(markAllNotificationsRead())}>
                Mark all read
              </button>
            )
          }
        />
        {loading ? <LoadingRow count={5}/> : notifications.length === 0 ? (
          <EmptyState icon={Bell} message="No notifications" sub="Notifications appear here after bookings, security events, and updates" />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <motion.div
                key={n._id} variants={fadeUp}
                className={`glass-card p-4 flex items-start gap-4 cursor-pointer transition-opacity ${n.isRead ? 'opacity-60' : ''}`}
                onClick={() => !n.isRead && dispatch(markNotificationRead(n._id))}
              >
                <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${n.isRead ? 'bg-base-300' : 'bg-primary'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-xs text-base-content">{n.title}</p>
                    <span className={`badge ${priorityColor[n.priority] || 'badge-secondary'} badge-xs`}>{n.priority}</span>
                    <span className="badge badge-secondary badge-xs">{n.type?.replace('_',' ')}</span>
                  </div>
                  <p className="text-[11px] text-base-content/60 mt-0.5">{n.body}</p>
                  <p className="text-[11px] text-base-content/40 mt-1">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                </div>
                {n.isRead && <Check size={13} className="text-success shrink-0 mt-1"/>}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Sessions & Devices Section ───────────────────────────────────────────────

function SessionsSection({ user }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const sessions = useSelector(selectAuditSessions);
  const deviceTokens = useSelector(selectDeviceTokens);
  const loading = useSelector(selectSectionLoading('auditSessions'));

  useEffect(() => { dispatch(fetchAuditSessions()); }, [dispatch]);

  const platformIcon = { android: Smartphone, ios: Smartphone, web: Globe, desktop: Monitor };

  // Signing out of all devices includes the current session — send the
  // user back to login once the server confirms the sessions are cleared.
  const handleSignOutAll = async () => {
    const result = await dispatch(deleteAllAuditSessions());
    if (deleteAllAuditSessions.fulfilled?.match?.(result) ?? !result?.error) {
      router.push('/login');
    }
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

      {/* Audit Sessions */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader
          icon={Monitor}
          title="Active Sessions"
          action={
            sessions.length > 0 && (
              <button className="btn btn-error btn-sm" onClick={handleSignOutAll} disabled={loading}>
                {loading ? <span className="loading loading-xs"/> : <LogOut size={13}/>} Sign Out All
              </button>
            )
          }
        />
        <p className="text-[11px] text-base-content/50 mb-4">All devices currently or recently logged into your account. Remove any you don't recognise.</p>
        {loading ? <LoadingRow count={3}/> : sessions.length === 0 ? (
          <EmptyState icon={Monitor} message="No active sessions" />
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const PIcon = platformIcon[s.platform] || Monitor;
              return (
                <motion.div key={s._id} variants={fadeUp} className="glass-card p-4 flex items-center gap-4">
                  <div className="bg-primary/10 p-2.5 rounded-xl shrink-0"><PIcon size={18} className="text-primary"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs capitalize">{s.deviceName}</p>
                    <p className="text-[11px] text-base-content/50">
                      {s.platform} · {s.ipAddress} · {s.userAgent?.slice(0,40)}
                    </p>
                    <div className="flex gap-3 text-[11px] text-base-content/40 mt-0.5">
                      <span>Created: {new Date(s.createdAt).toLocaleDateString('en-IN')}</span>
                      <span>Active: {new Date(s.lastActiveAt).toLocaleString('en-IN')}</span>
                    </div>
                    <FieldNote>IP address and device of this login session</FieldNote>
                  </div>
                  <button className="btn btn-ghost btn-xs btn-circle text-error shrink-0" onClick={() => dispatch(deleteAuditSession(s._id))}>
                    <LogOut size={13}/>
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Device Tokens */}
      <motion.div variants={fadeUp} className="card p-5">
        <SectionHeader icon={Smartphone} title="Registered Devices (Push Tokens)" />
        <p className="text-[11px] text-base-content/50 mb-4">Devices registered for push notifications. Max 5 devices. Remove stale ones to free up slots.</p>
        {deviceTokens.length === 0 ? (
          <EmptyState icon={Smartphone} message="No devices registered" sub="Install the app and enable notifications to register" />
        ) : (
          <div className="space-y-3">
            {deviceTokens.map((d) => {
              const DIcon = platformIcon[d.platform] || Smartphone;
              return (
                <div key={d._id} className="glass-card p-4 flex items-center gap-4">
                  <div className="bg-secondary/10 p-2.5 rounded-xl shrink-0"><DIcon size={18} className="text-secondary"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs">{d.deviceName}</p>
                    <p className="text-[11px] text-base-content/50">{d.platform} · {d.ipAddress}</p>
                    <p className="text-[11px] text-base-content/40">Last used: {new Date(d.lastUsedAt).toLocaleString('en-IN')}</p>
                    <FieldNote>Push notification token for this device</FieldNote>
                  </div>
                  <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => dispatch(deleteDeviceToken(d._id))}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Account blocked state */}
      {user?.isBlocked && (
        <motion.div variants={fadeUp} className="card p-5">
          <SectionHeader icon={Lock} title="Account Blocked" />
          <div className="alert alert-error mb-4">
            <AlertCircle size={16}/>
            <div>
              <p className="font-semibold text-xs">Your account is currently blocked</p>
              {user.blockReason && <p className="text-[11px] mt-0.5">Reason: {user.blockReason}</p>}
              {user.unblockAt && <p className="text-[11px] mt-0.5">Auto-unblock: {new Date(user.unblockAt).toLocaleString('en-IN')}</p>}
            </div>
          </div>
          <RequestUnblockForm />
        </motion.div>
      )}

    </motion.div>
  );
}

function RequestUnblockForm() {
  const dispatch = useDispatch();
  const loading = useSelector(selectSectionLoading('unblock'));
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-3">
      <div>
        <label className="label-text">Your Statement</label>
        <textarea className="input-field mt-1 resize-none" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why you believe the block was incorrect or request a review..." />
        <FieldNote>Your statement is sent directly to the support team for review</FieldNote>
      </div>
      <button className="btn btn-warning w-full sm:w-auto" onClick={() => dispatch(requestUnblock(reason))} disabled={loading}>
        {loading ? <span className="loading loading-sm"/> : <Key size={14}/>} Submit Unblock Request
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomerProfilePage() {
  const dispatch = useDispatch();
  const user = useSelector(selectCustomerUser);
  const profile = useSelector(selectCustomerProfile);
  const loading = useSelector(selectProfileLoading);
  const unreadCount = useSelector(selectUnreadCount);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { dispatch(fetchMyProfile()); }, [dispatch]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-lg" />
          <p className="text-base-content/50 text-xs">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeTab) {
      case 'overview':   return <OverviewSection user={user} profile={profile} />;
      case 'personal':   return <PersonalSection profile={profile} />;
      case 'kyc':        return <KycSection />;
      case 'insurance':  return <InsuranceSection profile={profile} />;
      case 'medical':    return <MedicalSection />;
      case 'medicines':  return <MedicinesSection />;
      case 'vitals':     return <VitalsSection />;
      case 'consent':    return <ConsentSection />;
      case 'rx':         return <PrescriptionsSection />;
      case 'reports':    return <ReportsSection />;
      case 'notifs':     return <NotificationsSection />;
      case 'sessions':   return <SessionsSection user={user} />;
      default:           return null;
    }
  };

  return (
    <div className="min-h-screen bg-base-100" data-theme="customer">

      {/* Top bar — mobile */}
      <div className="lg:hidden sticky top-0 z-40 bg-base-100 border-b border-base-300 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0">
          <img src={user?.avatar} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-montserrat font-extrabold text-xs text-base-content truncate">{user?.name}</p>
          <p className="text-[11px] text-base-content/50 truncate">{user?.email}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-ghost btn-sm btn-circle relative" onClick={() => setActiveTab('notifs')}>
            <Bell size={18}/>
            <span className="absolute -top-0.5 -right-0.5 bg-error text-error-content text-[11px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-57px)] lg:min-h-screen">

        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 bg-base-100 border-r border-base-300 sticky top-0 h-screen overflow-y-auto">
          {/* Profile mini */}
          <div className="p-6 border-b border-base-300">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                <img src={user?.avatar} alt="" className="w-full h-full object-cover" />
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${user?.isOnline ? 'bg-success' : 'bg-base-300'}`} />
              </div>
              <div className="min-w-0">
                <p className="font-montserrat font-extrabold text-xs text-base-content truncate">{user?.name}</p>
                <p className="text-[11px] text-base-content/50 truncate">{user?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="bg-accent/10 text-accent text-[11px] font-bold px-2 py-0.5 rounded-full">{user?.coins?.toLocaleString() || 0} coins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-left relative
                  ${activeTab === id
                    ? 'bg-primary/10 text-primary'
                    : 'text-base-content/60 hover:bg-base-200 hover:text-base-content'
                  }`}
              >
                <Icon size={16} className="shrink-0" />
                {label}
                {id === 'notifs' && unreadCount > 0 && (
                  <span className="ml-auto bg-error text-error-content text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {activeTab === id && (
                  <motion.div layoutId="active-pill" className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-8">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-base-300 sticky top-0 bg-base-100 z-30">
            <div>
              <h1 className="font-montserrat font-extrabold text-xl text-base-content">
                {TABS.find(t => t.id === activeTab)?.label}
              </h1>
              <p className="text-[11px] text-base-content/40 mt-0.5">Manage your health profile and account settings</p>
            </div>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm relative" onClick={() => setActiveTab('notifs')}>
                <Bell size={16}/>
                <span className="absolute -top-1 -right-1 bg-error text-error-content text-[11px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </button>
            )}
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-base-100 border-t border-base-300 safe-bottom">
        <div className="flex overflow-x-auto scrollbar-thin">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[60px] shrink-0 text-center transition-all relative
                ${activeTab === id ? 'text-primary' : 'text-base-content/40'}`}
            >
              <div className="relative">
                <Icon size={18} />
                {id === 'notifs' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-error text-error-content text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-semibold leading-tight">{label}</span>
              {activeTab === id && (
                <motion.div layoutId="bottom-pill" className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}