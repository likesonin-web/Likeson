'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, MapPin, Shield, DollarSign, Image, Trash2,
  Link, Unlink, CheckCircle, XCircle, ToggleLeft, ToggleRight,
  Upload, Edit3, Settings, Lock, Send, Plus,
  ChevronRight, ChevronDown, Search, RefreshCw, AlertTriangle,
  Star, Bed, Stethoscope, Activity,
  BarChart2, TrendingUp, Camera, X, Check,
  Hospital, Layers, Zap,
  Info, Paperclip, LinkIcon,
} from 'lucide-react';
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

import {
  fetchAllHospitals, fetchHospitalById, createHospital,
  updateHospitalProfile, updateHospitalSettings, updateHospitalSecurity,
  updateHospitalConsultationPricing,
  resendHospitalManagerCredentials, uploadHospitalImages, deleteHospitalImage,
  updateHospitalLocation, linkDoctorToHospital, unlinkDoctorFromHospital,
  verifyHospital, toggleHospitalActive, deleteHospital,
  fetchAllDoctors, fetchDoctorsByHospital,
  createDoctorProfile, updateDoctorProfile, updateDoctorSettings,
  updateDoctorBankDetails, updateDoctorKyc,
  updateDoctorPlatformFee,
  updateDoctorPartnership, verifyDoctorKyc, toggleDoctorActive,
  resendDoctorCredentials, deleteDoctorProfile,
  fetchHospitalEffectivePricing,
  clearSelectedHospital, clearHospitalDoctors,
} from '@/store/slices/hospitalSlice';

import {
  selectHospitals, selectSelectedHospital, selectHospitalDoctors,
  selectHospitalLoading, selectHospitalError,
  selectDoctors, selectHospitalTotal, selectHospitalPages,
} from '@/store/slices/hospitalSlice';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const HOSPITAL_TYPES  = ['Multi-Specialty', 'Super-Specialty', 'Trust', 'Government', 'Clinic', 'Nursing Home'];
const MANAGED_TYPES   = ['Multi-Specialty', 'Super-Specialty', 'Trust', 'Government'];
const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
  'Oncologist', 'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist',
  'Dermatologist', 'Urologist', 'Psychiatry', 'Physiotherapist',
];
const ACCREDITATIONS       = ['NABH', 'NABL', 'JCI', 'ISO', 'AHPI', 'Other'];
const PARTNERSHIP_STATUSES = ['Pending', 'Active', 'Inactive', 'Suspended'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir',
  'Ladakh', 'Puducherry',
];
const ACCEPTED_SCHEMES = [
  'Ayushman Bharat', 'PMJAY', 'CGHS', 'ECHS', 'ESI',
  'State Govt Scheme', 'Insurance', 'Cash Only',
];
const SPECIALTIES_LIST = [
  'Cardiology', 'Neurology', 'Oncology', 'Orthopedics', 'Gynecology',
  'Pediatrics', 'Dermatology', 'Urology', 'Psychiatry', 'Gastroenterology',
  'Pulmonology', 'Nephrology', 'Endocrinology', 'Rheumatology', 'ENT',
  'Ophthalmology', 'Dental', 'Physiotherapy', 'Radiology', 'Pathology',
];
const FACILITIES_LIST = [
  'ICU', 'NICU', 'PICU', 'Burns Unit', 'Dialysis', 'Cath Lab',
  'Operation Theatre', 'Modular OT', 'Blood Bank', 'Pharmacy', 'Ambulance',
  'Canteen', 'Parking', 'WiFi', 'ATM', 'Wheelchair Access',
];

const SECTION_TABS = [
  { id: 'overview',     label: 'Overview',    icon: BarChart2   },
  { id: 'profile',      label: 'Profile',     icon: Edit3       },
  { id: 'settings',     label: 'Settings',    icon: Settings    },
  { id: 'security',     label: 'Security',    icon: Lock        },
  { id: 'pricing',      label: 'Pricing',     icon: DollarSign  },
  { id: 'images',       label: 'Images',      icon: Image       },
  { id: 'location',     label: 'Location',    icon: MapPin      },
  { id: 'doctors',      label: 'Doctors',     icon: Stethoscope },
  { id: 'verification', label: 'Verify',      icon: Shield      },
];

const CHART_COLORS = [
  'var(--chart-1)', 
  'var(--chart-2)', 
  'var(--chart-3)', 
  'var(--chart-4)', 
  'var(--chart-5)', 
  'var(--chart-6)'
];

// ─────────────────────────────────────────────────────────────────────────────
//  TINY REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Spinner = ({ size = 'sm' }) => (
  <div
    className={`inline-block rounded-full border-2 border-primary/30 border-t-primary animate-spin ${
      size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
    }`}
  />
);

const SectionCard = ({ title, icon: Icon, children, action }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm"
  >
    <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 bg-base-200">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={16} className="text-primary" />}
        <span className="font-bold text-sm text-base-content font-montserrat">{title}</span>
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </motion.div>
);

const Field = ({ label, note, children }) => (
  <div className="flex flex-col gap-1">
    {label && (
      <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">
        {label}
      </label>
    )}
    {children}
    {note && (
      <span className="flex items-center gap-1 text-[10px] text-base-content/40 leading-snug">
        <Info size={9} className="shrink-0" />
        {note}
      </span>
    )}
  </div>
);

const InputField = ({ label, note, value, onChange, type = 'text', placeholder, disabled, required }) => (
  <Field label={label} note={note}>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className="input-field w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </Field>
);

const SelectField = ({ label, note, value, onChange, options, disabled, placeholder }) => (
  <Field label={label} note={note}>
    <select
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className="input-field w-full text-sm disabled:opacity-50"
    >
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  </Field>
);

const TextareaField = ({ label, note, value, onChange, rows = 3, placeholder }) => (
  <Field label={label} note={note}>
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="input-field w-full text-sm resize-none"
    />
  </Field>
);

const Toggle = ({ label, note, checked, onChange }) => (
  <div className="flex flex-col gap-0.5">
    <label className="flex items-center gap-3 cursor-pointer group">
      <span className="text-sm text-base-content/80 font-medium">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-base-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </div>
    </label>
    {note && (
      <span className="flex items-center gap-1 text-[10px] text-base-content/40 ml-0.5">
        <Info size={9} />
        {note}
      </span>
    )}
  </div>
);

const MultiSelect = ({ label, note, options, selected, onChange }) => {
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Field label={label} note={note}>
      <div className="flex flex-wrap gap-1.5 p-2.5 bg-base-200 border border-base-300 rounded-xl">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all duration-150 ${
              selected.includes(o)
                ? 'bg-primary text-primary-content border-primary'
                : 'bg-base-100 text-base-content/60 border-base-300 hover:border-primary/50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </Field>
  );
};

const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-base-100 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-base-300"
    >
      <div className="flex items-start gap-3 mb-5">
        <AlertTriangle size={20} className="text-warning mt-0.5 shrink-0" />
        <p className="text-sm text-base-content leading-relaxed">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary text-xs px-4 py-2">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="btn btn-error text-xs px-4 py-2"
        >
          Confirm
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  DUAL UPLOAD FIELD  (file picker + URL paste)
// ─────────────────────────────────────────────────────────────────────────────
const DualUploadField = ({
  label, note, url, onUrlChange, onFileChange, file,
  accept = 'image/jpeg,image/png,image/webp', multiple = false,
}) => {
  const ref = useRef();
  return (
    <Field label={label} note={note}>
      <div className="flex flex-col gap-2 p-3 bg-base-200 border border-base-300 rounded-xl">
        <div className="flex items-center gap-2">
          <LinkIcon size={12} className="text-base-content/40 shrink-0" />
          <input
            type="url"
            value={url ?? ''}
            onChange={(e) => onUrlChange?.(e.target.value)}
            placeholder="Paste CDN / hosted URL…"
            className="input-field flex-1 text-xs py-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-base-300" />
          <span className="text-[10px] text-base-content/30 font-bold uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-base-300" />
        </div>
        <div className="flex items-center gap-2">
          <Paperclip size={12} className="text-base-content/40 shrink-0" />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5"
          >
            <Upload size={11} /> Choose File{multiple ? 's' : ''}
          </button>
          {file && (
            <span className="text-[10px] text-base-content/50 truncate max-w-[140px]">
              {Array.isArray(file) ? `${file.length} file(s)` : file.name}
            </span>
          )}
          <input
            ref={ref}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => onFileChange?.(multiple ? Array.from(e.target.files ?? []) : e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </Field>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  HOSPITAL CARD  (left panel)
// ─────────────────────────────────────────────────────────────────────────────
const HospitalCard = ({ hospital, isSelected, onClick }) => {
  const isMgd = MANAGED_TYPES.includes(hospital.hospitalType);
  return (
    <motion.div
      layout
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl border transition-all duration-200 overflow-hidden group ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200'
      }`}
    >
      {isSelected && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-xl" />}
      <div className="px-4 py-3 pl-5">
        <div className="flex items-start gap-3">
          {hospital.logo ? (
            <img src={hospital.logo} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-base-300" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-base-content truncate leading-tight">{hospital.name}</p>
            <p className="text-[10px] text-base-content/50 truncate mt-0.5">
              {hospital.address?.city}, {hospital.address?.state}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className={`badge ${isMgd ? 'badge-primary' : 'badge-info'}`}>
                {hospital.hospitalType}
              </span>
              <span className={`badge ${hospital.isVerified ? 'badge-success' : 'badge-warning'}`}>
                {hospital.isVerified ? 'Verified' : 'Unverified'}
              </span>
              {!hospital.isActive && <span className="badge badge-error">Inactive</span>}
            </div>
          </div>
          <ChevronRight
            size={14}
            className={`shrink-0 mt-1 transition-colors ${
              isSelected ? 'text-primary' : 'text-base-content/30 group-hover:text-base-content/50'
            }`}
          />
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-base-content/40">
          <span className="flex items-center gap-1">
            <Users size={10} />
            {hospital.linkedDoctors?.length ?? 0} doctors
          </span>
          <span className="flex items-center gap-1">
            <Bed size={10} />
            {hospital.bedCount?.total ?? 0} beds
          </span>
          <span className="flex items-center gap-1">
            <Star size={10} />
            {hospital.rating?.averageRating?.toFixed(1) ?? '0.0'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE HOSPITAL MODAL
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'basic',      label: 'Basic Info',      icon: Building2 },
  { id: 'contact',    label: 'Contact',         icon: Users     },
  { id: 'address',    label: 'Address',         icon: MapPin    },
  { id: 'facilities', label: 'Facilities',      icon: Zap       },
  { id: 'legal',      label: 'Legal / Reg.',    icon: Lock      },
  { id: 'media',      label: 'Logo & Images',   icon: Camera    },
  { id: 'manager',    label: 'Manager Account', icon: Users     },
];

const CreateHospitalModal = ({ onClose, dispatch, loading }) => {
  const [step, setStep] = useState(0);

  const [f, setF] = useState({
    name: '', hospitalType: 'Multi-Specialty', description: '',
    specialties: [], accreditations: [], nabledLabAvailable: false,
    'contact.phone': '', 'contact.email': '', 'contact.website': '',
    'contact.whatsapp': '', 'contact.emergencyPhone': '', 'contact.alternatePhone': '',
    'address.line1': '', 'address.line2': '', 'address.landmark': '',
    'address.city': 'Vijayawada', 'address.state': 'Andhra Pradesh', 'address.pincode': '',
    googleMapsUrl: '',
    isEmergencyReady: false, hasICU: false, hasBloodBank: false,
    hasPharmacy: false, hasDiagnostics: false, hasAmbulance: false,
    hasWheelchairAccess: false, is24x7: false,
    'bedCount.total': 0, 'bedCount.icu': 0,
    facilities: [], acceptedSchemes: [],
    'registrationDetails.licenseNumber': '',
    'registrationDetails.licenseExpiry': '',
    'registrationDetails.gstNumber': '',
    'registrationDetails.panNumber': '',
    docUrl: '', docFile: null,
    logoUrl: '', logoFile: null,
    imageUrls: '', imageFiles: [],
    managerName: '', managerEmail: '', managerPhone: '',
    specialization: 'General Physician', experienceYears: 0,
  });

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isMgd = MANAGED_TYPES.includes(f.hospitalType);

  const stepValid = [
    () => f.name.trim() && f.hospitalType,
    () => f['contact.phone'].trim(),
    () => f['address.line1'].trim() && f['address.pincode'].trim(),
    () => true,
    () => f['registrationDetails.licenseNumber'].trim(),
    () => true,
    () => f.managerName.trim() && f.managerEmail.trim(),
  ];

  const handleSubmit = async () => {
    const payload = {
      name: f.name.trim(),
      hospitalType: f.hospitalType,
      description: f.description,
      specialties: f.specialties,
      accreditations: f.accreditations,
      nabledLabAvailable: f.nabledLabAvailable,
      contact: {
        phone: f['contact.phone'],
        email: f['contact.email'],
        website: f['contact.website'],
        whatsapp: f['contact.whatsapp'],
        emergencyPhone: f['contact.emergencyPhone'],
        alternatePhone: f['contact.alternatePhone'],
      },
      address: {
        line1: f['address.line1'],
        line2: f['address.line2'],
        landmark: f['address.landmark'],
        city: f['address.city'],
        state: f['address.state'],
        pincode: f['address.pincode'],
      },
      googleMapsUrl: f.googleMapsUrl,
      isEmergencyReady: f.isEmergencyReady,
      hasICU: f.hasICU,
      hasBloodBank: f.hasBloodBank,
      hasPharmacy: f.hasPharmacy,
      hasDiagnostics: f.hasDiagnostics,
      hasAmbulance: f.hasAmbulance,
      hasWheelchairAccess: f.hasWheelchairAccess,
      is24x7: f.is24x7,
      bedCount: { total: Number(f['bedCount.total']), icu: Number(f['bedCount.icu']) },
      facilities: f.facilities,
      acceptedSchemes: f.acceptedSchemes,
      registrationDetails: {
        licenseNumber: f['registrationDetails.licenseNumber'],
        licenseExpiry: f['registrationDetails.licenseExpiry'] || undefined,
        gstNumber: f['registrationDetails.gstNumber'],
        panNumber: f['registrationDetails.panNumber'],
        documentUrl: f.docUrl || undefined,
      },
      ...(f.logoUrl ? { logo: f.logoUrl } : {}),
      managerName: f.managerName.trim(),
      managerEmail: f.managerEmail.trim(),
      managerPhone: f.managerPhone || undefined,
      specialization: f.specialization,
      experienceYears: Number(f.experienceYears),
    };

    const result = await dispatch(createHospital(payload));
    if (!result.error) {
      const hospitalId = result.payload?.data?.hospital?._id;
      if (hospitalId) {
        const hasLogoFile = !!f.logoFile;
        const hasImgFiles = f.imageFiles?.length > 0;
        const hasImgUrls = f.imageUrls.trim();

        if (hasLogoFile || hasImgFiles) {
          await dispatch(
            uploadHospitalImages({
              id: hospitalId,
              logo: f.logoFile || undefined,
              images: f.imageFiles.length > 0 ? f.imageFiles : undefined,
            })
          );
        }
        if (hasImgUrls && !hasImgFiles) {
          const urls = f.imageUrls.split('\n').map((u) => u.trim()).filter(Boolean);
          if (urls.length > 0) {
            await dispatch(updateHospitalProfile({ id: hospitalId, images: urls }));
          }
        }
      }
      onClose();
    }
  };

  const canNext = stepValid[step]?.() ?? true;
  const isLast = step === STEPS.length - 1;

  const facilityFlags = [
    ['isEmergencyReady', 'Emergency Ready', 'Has 24/7 emergency services'],
    ['hasICU', 'Has ICU', 'Intensive Care Unit available'],
    ['hasBloodBank', 'Has Blood Bank', 'On-site blood bank present'],
    ['hasPharmacy', 'Has Pharmacy', 'In-house pharmacy'],
    ['hasDiagnostics', 'Has Diagnostics', 'Lab / diagnostic centre on site'],
    ['hasAmbulance', 'Has Ambulance', 'Ambulance services available'],
    ['hasWheelchairAccess', 'Wheelchair Access', 'Fully wheelchair accessible'],
    ['is24x7', 'Open 24×7', 'Round-the-clock operations'],
    ['nabledLabAvailable', 'NABL Lab', 'NABL-accredited lab on site'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-base-300"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus size={15} className="text-primary" />
            </div>
            <div>
              <span className="font-black text-base-content font-montserrat">Create Hospital</span>
              <p className="text-[10px] text-base-content/40">
                Step {step + 1} of {STEPS.length} — {STEPS[step].label}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-base-200 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center px-6 py-3 gap-1 border-b border-base-300 bg-base-200 shrink-0 overflow-x-auto scrollbar-thin">
          {STEPS.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all duration-150 ${
                i === step
                  ? 'bg-primary text-primary-content'
                  : i < step
                  ? 'bg-primary/10 text-primary cursor-pointer'
                  : 'text-base-content/30 cursor-default'
              }`}
            >
              <Icon size={10} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{i + 1}</span>
              {i < step && <Check size={9} />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
            >
              {step === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <InputField
                      label="Hospital Name *"
                      note="Official registered name of the hospital / clinic."
                      value={f.name}
                      onChange={(v) => set('name', v)}
                      placeholder="e.g. Apollo Hospitals, Vijayawada"
                      required
                    />
                  </div>
                  <SelectField
                    label="Hospital Type *"
                    note="Multi-Specialty / Super-Specialty / Trust / Government → hospital-manager model. Clinic / Nursing Home → doctor-owner model."
                    value={f.hospitalType}
                    onChange={(v) => set('hospitalType', v)}
                    options={HOSPITAL_TYPES}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">
                      Management Model
                    </label>
                    <div
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        isMgd
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-info/10 text-info border-info/30'
                      }`}
                    >
                      {isMgd ? '🏥 Hospital-Manager' : '👨‍⚕️ Doctor-Owner'}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-base-content/40">
                      <Info size={9} />
                      Auto-derived from Hospital Type. Cannot be set manually.
                    </span>
                  </div>
                  <div className="col-span-2">
                    <TextareaField
                      label="Description"
                      note="Brief description of the hospital — specialties, highlights, patient experience. Max 1000 characters."
                      value={f.description}
                      onChange={(v) => set('description', v)}
                      rows={3}
                      placeholder="Describe the hospital's services, specialties, and unique features…"
                    />
                  </div>
                  <div className="col-span-2">
                    <MultiSelect
                      label="Specialties"
                      note="Select all medical specialties offered. Helps patients find the right care."
                      options={SPECIALTIES_LIST}
                      selected={f.specialties}
                      onChange={(v) => set('specialties', v)}
                    />
                  </div>
                  <div className="col-span-2">
                    <MultiSelect
                      label="Accreditations"
                      note="National / international certifications held by this hospital."
                      options={ACCREDITATIONS}
                      selected={f.accreditations}
                      onChange={(v) => set('accreditations', v)}
                    />
                  </div>
                  <Toggle
                    label="NABL Lab Available"
                    note="Check if an NABL-accredited diagnostics lab is present on site."
                    checked={f.nabledLabAvailable}
                    onChange={(v) => set('nabledLabAvailable', v)}
                  />
                  {!isMgd && (
                    <>
                      <SelectField
                        label="Doctor Specialization *"
                        note="Primary specialization of the doctor-owner who will manage this clinic/nursing home."
                        value={f.specialization}
                        onChange={(v) => set('specialization', v)}
                        options={SPECIALIZATIONS}
                      />
                      <InputField
                        label="Doctor Experience (years) *"
                        note="Years of active medical practice."
                        type="number"
                        value={f.experienceYears}
                        onChange={(v) => set('experienceYears', v)}
                      />
                    </>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Primary Phone *"
                    note="Main helpline number. Will be shown to patients. E.g. +91XXXXXXXXXX."
                    value={f['contact.phone']}
                    onChange={(v) => set('contact.phone', v)}
                    placeholder="+91 9876543210"
                    required
                  />
                  <InputField
                    label="Emergency Phone"
                    note="Dedicated emergency / casualty number, if different from primary."
                    value={f['contact.emergencyPhone']}
                    onChange={(v) => set('contact.emergencyPhone', v)}
                    placeholder="+91 9876500000"
                  />
                  <InputField
                    label="Alternate Phone"
                    note="Second helpline or front-desk number."
                    value={f['contact.alternatePhone']}
                    onChange={(v) => set('contact.alternatePhone', v)}
                    placeholder="+91 9876511111"
                  />
                  <InputField
                    label="WhatsApp Number"
                    note="WhatsApp contact for appointment / queries. Leave blank if same as primary."
                    value={f['contact.whatsapp']}
                    onChange={(v) => set('contact.whatsapp', v)}
                    placeholder="+91 9876543210"
                  />
                  <InputField
                    label="Email Address"
                    note="Official hospital email for correspondence & notifications."
                    type="email"
                    value={f['contact.email']}
                    onChange={(v) => set('contact.email', v)}
                    placeholder="hospital@example.com"
                  />
                  <InputField
                    label="Website URL"
                    note="Hospital's official website. Include https://."
                    value={f['contact.website']}
                    onChange={(v) => set('contact.website', v)}
                    placeholder="https://www.hospital.com"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <InputField
                      label="Address Line 1 *"
                      note="Building name, street name, house/plot number."
                      value={f['address.line1']}
                      onChange={(v) => set('address.line1', v)}
                      placeholder="e.g. 42, Bandar Road, Moghalrajpuram"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <InputField
                      label="Address Line 2"
                      note="Additional address details — area, colony, sector."
                      value={f['address.line2']}
                      onChange={(v) => set('address.line2', v)}
                      placeholder="Near Kanaka Durga Temple"
                    />
                  </div>
                  <InputField
                    label="Landmark"
                    note="Nearby well-known landmark for easier navigation."
                    value={f['address.landmark']}
                    onChange={(v) => set('address.landmark', v)}
                    placeholder="Opp. RTC Bus Stand"
                  />
                  <InputField
                    label="City"
                    note="City / town where the hospital is located."
                    value={f['address.city']}
                    onChange={(v) => set('address.city', v)}
                    placeholder="Vijayawada"
                  />
                  <SelectField
                    label="State *"
                    note="Indian state / union territory."
                    value={f['address.state']}
                    onChange={(v) => set('address.state', v)}
                    options={INDIAN_STATES}
                  />
                  <InputField
                    label="PIN Code *"
                    note="6-digit Indian postal code. Must not start with 0."
                    value={f['address.pincode']}
                    onChange={(v) => set('address.pincode', v)}
                    placeholder="520001"
                    required
                  />
                  <div className="col-span-2">
                    <InputField
                      label="Google Maps URL"
                      note="Paste the 'Share → Copy link' URL from Google Maps for this hospital."
                      value={f.googleMapsUrl}
                      onChange={(v) => set('googleMapsUrl', v)}
                      placeholder="https://goo.gl/maps/…"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {facilityFlags.map(([key, label, note]) => (
                      <Toggle key={key} label={label} note={note} checked={f[key]} onChange={(v) => set(key, v)} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-base-300">
                    <InputField
                      label="Total Beds"
                      note="Total number of inpatient beds in this hospital."
                      type="number"
                      value={f['bedCount.total']}
                      onChange={(v) => set('bedCount.total', v)}
                    />
                    <InputField
                      label="ICU Beds"
                      note="Dedicated ICU bed count. Setting this > 0 auto-enables 'Has ICU'."
                      type="number"
                      value={f['bedCount.icu']}
                      onChange={(v) => set('bedCount.icu', v)}
                    />
                  </div>
                  <MultiSelect
                    label="Facilities & Amenities"
                    note="Select all facilities available inside or on-campus."
                    options={FACILITIES_LIST}
                    selected={f.facilities}
                    onChange={(v) => set('facilities', v)}
                  />
                  <MultiSelect
                    label="Accepted Insurance / Schemes"
                    note="Insurance panels and government health schemes accepted."
                    options={ACCEPTED_SCHEMES}
                    selected={f.acceptedSchemes}
                    onChange={(v) => set('acceptedSchemes', v)}
                  />
                </div>
              )}

              {step === 4 && (
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="License / Registration Number *"
                    note="Medical Council or State Health Dept registration number. Must be unique across the platform."
                    value={f['registrationDetails.licenseNumber']}
                    onChange={(v) => set('registrationDetails.licenseNumber', v)}
                    placeholder="AP/MED/2024/XXXXX"
                    required
                  />
                  <InputField
                    label="License Expiry Date"
                    note="Expiry date of the registration / operating license."
                    type="date"
                    value={f['registrationDetails.licenseExpiry']}
                    onChange={(v) => set('registrationDetails.licenseExpiry', v)}
                  />
                  <InputField
                    label="GST Number"
                    note="15-digit GSTIN if the hospital is GST-registered."
                    value={f['registrationDetails.gstNumber']}
                    onChange={(v) => set('registrationDetails.gstNumber', v)}
                    placeholder="29AABCU9603R1ZX"
                  />
                  <InputField
                    label="PAN Number"
                    note="10-character PAN of the hospital entity (for TDS / settlement)."
                    value={f['registrationDetails.panNumber']}
                    onChange={(v) => set('registrationDetails.panNumber', v)}
                    placeholder="AABCU9603R"
                  />
                  <div className="col-span-2">
                    <DualUploadField
                      label="License / Registration Document"
                      note="Upload or paste the URL of the scanned license/registration document (PDF or image). The backend stores this as registrationDetails.documentUrl; uploading a raw file here does not auto-attach unless your ImageKit pipeline supports documents — paste a hosted URL for reliability."
                      url={f.docUrl}
                      onUrlChange={(v) => set('docUrl', v)}
                      file={f.docFile}
                      onFileChange={(v) => set('docFile', v)}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                    />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <DualUploadField
                    label="Hospital Logo"
                    note="Square or landscape logo. Recommended: 512×512 px, PNG/WebP. Max 5 MB. Paste an ImageKit CDN URL or upload a new file — both work."
                    url={f.logoUrl}
                    onUrlChange={(v) => set('logoUrl', v)}
                    file={f.logoFile}
                    onFileChange={(v) => set('logoFile', v)}
                    accept="image/jpeg,image/png,image/webp"
                  />
                  {(f.logoUrl || f.logoFile) && (
                    <div className="flex items-center gap-3 p-3 bg-base-200 rounded-xl border border-base-300">
                      {f.logoUrl && (
                        <img src={f.logoUrl} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-base-300" />
                      )}
                      <div className="text-xs text-base-content/60">
                        {f.logoFile ? `📎 ${f.logoFile.name}` : '🔗 CDN URL provided — will be set on creation.'}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-base-300 pt-4">
                    <Field
                      label="Gallery Images (max 20)"
                      note="Upload multiple images OR paste one URL per line. Files are uploaded to ImageKit after hospital creation. Both methods can be used together."
                    >
                      <div className="flex flex-col gap-2 p-3 bg-base-200 border border-base-300 rounded-xl">
                        <div className="flex items-start gap-2">
                          <LinkIcon size={12} className="text-base-content/40 shrink-0 mt-2" />
                          <textarea
                            value={f.imageUrls}
                            onChange={(e) => set('imageUrls', e.target.value)}
                            rows={3}
                            placeholder={'https://ik.imagekit.io/img1.jpg\nhttps://ik.imagekit.io/img2.jpg'}
                            className="input-field flex-1 text-xs resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-base-300" />
                          <span className="text-[10px] text-base-content/30 font-bold uppercase tracking-widest">or</span>
                          <div className="flex-1 h-px bg-base-300" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Paperclip size={12} className="text-base-content/40 shrink-0" />
                          <label className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5 cursor-pointer">
                            <Upload size={11} /> Choose Files
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              className="hidden"
                              onChange={(e) => set('imageFiles', Array.from(e.target.files ?? []))}
                            />
                          </label>
                          {f.imageFiles?.length > 0 && (
                            <span className="text-[10px] text-base-content/50">{f.imageFiles.length} file(s) selected</span>
                          )}
                        </div>
                      </div>
                    </Field>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div
                      className={`flex items-start gap-3 p-4 rounded-xl border mb-4 ${
                        isMgd
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-info/10 border-info/30'
                      }`}
                    >
                      <Info size={15} className={`shrink-0 mt-0.5 ${isMgd ? 'text-primary' : 'text-info'}`} />
                      <div className="text-xs leading-relaxed">
                        {isMgd ? (
                          <>
                            <strong>Hospital-Manager account</strong> will be created with role{' '}
                            <code className="bg-primary/10 px-1 py-0.5 rounded text-[10px]">hospital</code>. This person
                            manages consultation pricing and linked doctors for this managed hospital type.
                          </>
                        ) : (
                          <>
                            <strong>Doctor-Owner account</strong> will be created with role{' '}
                            <code className="bg-info/10 px-1 py-0.5 rounded text-[10px]">doctor</code>. This doctor owns and
                            manages the Clinic / Nursing Home and sets their own pricing.
                          </>
                        )}
                        <br />
                        <span className="text-base-content/50 mt-1 block">
                          Login credentials will be sent to the email below automatically.
                        </span>
                      </div>
                    </div>
                  </div>
                  <InputField
                    label="Manager / Owner Full Name *"
                    note="Full name of the person who will log in and manage this hospital."
                    value={f.managerName}
                    onChange={(v) => set('managerName', v)}
                    placeholder="Dr. Ravi Kumar"
                    required
                  />
                  <InputField
                    label="Manager Email Address *"
                    note="Login email. A temporary password will be emailed here. Must be unique on the platform."
                    type="email"
                    value={f.managerEmail}
                    onChange={(v) => set('managerEmail', v)}
                    placeholder="manager@hospital.com"
                    required
                  />
                  <InputField
                    label="Manager Phone"
                    note="Optional contact phone for the manager user account."
                    value={f.managerPhone}
                    onChange={(v) => set('managerPhone', v)}
                    placeholder="+91 9876543210"
                  />
                  <div className="col-span-2 mt-2">
                    <div className="p-4 bg-base-200 rounded-xl border border-base-300 text-xs space-y-1.5">
                      <p className="font-bold text-base-content mb-2 flex items-center gap-1.5">
                        <CheckCircle size={12} className="text-success" /> Summary before creation
                      </p>
                      {[
                        ['Hospital', f.name || '—'],
                        ['Type', f.hospitalType],
                        ['Model', isMgd ? 'Hospital-Manager' : 'Doctor-Owner'],
                        ['City', `${f['address.city']}, ${f['address.state']}`],
                        ['License No.', f['registrationDetails.licenseNumber'] || '—'],
                        ['Manager', f.managerName || '—'],
                        ['Manager Email', f.managerEmail || '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-base-content/40 w-24 shrink-0">{k}</span>
                          <span className="font-semibold text-base-content truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-100">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">
              Cancel
            </button>
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="btn-secondary text-xs px-4 py-2">
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === step ? 'bg-primary w-3' : i < step ? 'bg-primary/50' : 'bg-base-300'
                  }`}
                />
              ))}
            </div>
            {!isLast ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="btn-primary-cta text-xs px-5 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                Next → <span className="hidden sm:inline">{STEPS[step + 1]?.label}</span>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading.createHospital || !canNext}
                className="btn-primary-cta text-xs px-6 py-2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading.createHospital ? <Spinner /> : <Plus size={13} />}
                Create & Send Credentials
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE DOCTOR MODAL
// ─────────────────────────────────────────────────────────────────────────────
const CreateDoctorModal = ({ hospitalId, onClose, dispatch, loading }) => {
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    specialization: 'General Physician', experienceYears: 0,
    registrationNumber: '', registrationCouncil: '', biography: '',
    'fees.inPersonFee': 0, 'fees.videoFee': 0, 'fees.homeVisitFee': 0,
    primaryHospital: hospitalId ?? '',
    'consultationTypes.inPerson': true,
    'consultationTypes.video': false,
    'consultationTypes.homeVisit': false,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    dispatch(
      createDoctorProfile({
        name: form.name,
        email: form.email,
        phone: form.phone,
        specialization: form.specialization,
        experienceYears: Number(form.experienceYears),
        registrationNumber: form.registrationNumber,
        registrationCouncil: form.registrationCouncil,
        biography: form.biography,
        fees: {
          inPersonFee: Number(form['fees.inPersonFee']),
          videoFee: Number(form['fees.videoFee']),
          homeVisitFee: Number(form['fees.homeVisitFee']),
        },
        consultationTypes: {
          inPerson: form['consultationTypes.inPerson'],
          video: form['consultationTypes.video'],
          homeVisit: form['consultationTypes.homeVisit'],
        },
        primaryHospital: form.primaryHospital,
      })
    ).then((r) => {
      if (!r.error) onClose();
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-base-300"
      >
        <div className="sticky top-0 bg-base-100 flex items-center justify-between px-6 py-4 border-b border-base-300 z-10">
          <span className="font-black text-base-content font-montserrat">Add Doctor</span>
          <button onClick={onClose} className="p-1.5 hover:bg-base-200 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <InputField label="Full Name *" note="Doctor's full legal name." value={form.name} onChange={(v) => set('name', v)} required />
          <InputField
            label="Email *"
            note="Login email — credentials sent here."
            type="email"
            value={form.email}
            onChange={(v) => set('email', v)}
            required
          />
          <InputField label="Phone" note="Contact number with country code." value={form.phone} onChange={(v) => set('phone', v)} />
          <SelectField
            label="Specialization *"
            note="Primary medical specialty."
            value={form.specialization}
            onChange={(v) => set('specialization', v)}
            options={SPECIALIZATIONS}
          />
          <InputField
            label="Experience (years) *"
            note="Years of active clinical practice."
            type="number"
            value={form.experienceYears}
            onChange={(v) => set('experienceYears', v)}
          />
          <InputField
            label="Reg. Number"
            note="MCI / State Medical Council registration ID."
            value={form.registrationNumber}
            onChange={(v) => set('registrationNumber', v)}
          />
          <InputField
            label="Registration Council"
            note="e.g. Andhra Pradesh Medical Council."
            value={form.registrationCouncil}
            onChange={(v) => set('registrationCouncil', v)}
          />
          <div />
          <div className="col-span-2">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Consultation Types</p>
            <div className="flex gap-4">
              {[['inPerson', 'In-Person'], ['video', 'Video'], ['homeVisit', 'Home Visit']].map(([k, l]) => (
                <Toggle
                  key={k}
                  label={l}
                  note=""
                  checked={form[`consultationTypes.${k}`]}
                  onChange={(v) => set(`consultationTypes.${k}`, v)}
                />
              ))}
            </div>
          </div>
          <InputField
            label="In-Person Fee (₹)"
            note="Charged per in-person consultation."
            type="number"
            value={form['fees.inPersonFee']}
            onChange={(v) => set('fees.inPersonFee', v)}
          />
          <InputField
            label="Video Fee (₹)"
            note="Charged per video/telemedicine call."
            type="number"
            value={form['fees.videoFee']}
            onChange={(v) => set('fees.videoFee', v)}
          />
          <InputField
            label="Home Visit Fee (₹)"
            note="Charged per home visit appointment."
            type="number"
            value={form['fees.homeVisitFee']}
            onChange={(v) => set('fees.homeVisitFee', v)}
          />
          <div />
          <div className="col-span-2">
            <TextareaField
              label="Biography"
              note="Doctor's professional summary shown to patients. Max 1000 chars."
              value={form.biography}
              onChange={(v) => set('biography', v)}
              rows={3}
              placeholder="Brief professional bio…"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-base-300">
          <button onClick={onClose} className="btn-secondary text-sm px-5 py-2.5">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading.createDoctorProfile}
            className="btn-primary-cta text-sm px-5 py-2.5 flex items-center gap-2"
          >
            {loading.createDoctorProfile ? <Spinner /> : <Plus size={14} />} Create Doctor
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  LINK DOCTOR MODAL
// ─────────────────────────────────────────────────────────────────────────────
const LinkDoctorModal = ({ hospitalId, onClose, dispatch, loading, allDoctors }) => {
  const [doctorId, setDoctorId] = useState('');
  const [q, setQ] = useState('');
  const filtered = (allDoctors || []).filter((d) => !q || d.user?.name?.toLowerCase().includes(q.toLowerCase()));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md border border-base-300"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
          <span className="font-black text-base-content font-montserrat">Link Existing Doctor</span>
          <button onClick={onClose} className="p-1.5 hover:bg-base-200 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-base-content/50 mb-3">
            Select a doctor already registered on the platform to link to this hospital.
          </p>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              className="input-field w-full pl-8 text-sm"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1 border border-base-300 rounded-xl p-2 scrollbar-thin">
            {filtered.map((d) => (
              <div
                key={d._id}
                onClick={() => setDoctorId(d._id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                  doctorId === d._id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-base-200'
                }`}
              >
                {d.profilePhotoUrl || d.user?.avatar ? (
                  <img src={d.profilePhotoUrl || d.user?.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Stethoscope size={12} className="text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold">{d.user?.name ?? 'Doctor'}</p>
                  <p className="text-[10px] text-base-content/40">{d.specialization}</p>
                </div>
                {doctorId === d._id && <Check size={13} className="ml-auto text-primary" />}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-center text-base-content/40 py-4">No doctors found</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-base-300">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
          <button
            onClick={() => {
              if (doctorId) {
                dispatch(linkDoctorToHospital({ hospitalId, doctorId })).then((r) => {
                  if (!r.error) onClose();
                });
              }
            }}
            disabled={!doctorId || loading.linkDoctorToHospital}
            className="btn-primary-cta text-sm px-4 py-2 flex items-center gap-2"
          >
            {loading.linkDoctorToHospital ? <Spinner /> : <Link size={13} />} Link Doctor
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────
const OverviewTab = ({ hospital }) => {
  const doctors = hospital.linkedDoctors ?? [];
  const specCount = {};
  doctors.forEach((d) => {
    const s = d.specialization ?? 'Other';
    specCount[s] = (specCount[s] ?? 0) + 1;
  });
  const specData = Object.entries(specCount).map(([name, value]) => ({ name, value }));

  const facilityData = [
    { name: 'ICU', active: hospital.hasICU },
    { name: 'Blood Bank', active: hospital.hasBloodBank },
    { name: 'Pharmacy', active: hospital.hasPharmacy },
    { name: 'Ambulance', active: hospital.hasAmbulance },
    { name: 'Emergency', active: hospital.isEmergencyReady },
    { name: '24×7', active: hospital.is24x7 },
    { name: 'Diagnostics', active: hospital.hasDiagnostics },
    { name: 'Wheelchair', active: hospital.hasWheelchairAccess },
    { name: 'NABL Lab', active: hospital.nabledLabAvailable },
  ];

  const statsItems = [
    { label: 'Total Doctors', value: hospital.linkedDoctors?.length ?? 0, icon: Users, color: 'text-primary' },
    { label: 'Total Beds', value: hospital.bedCount?.total ?? 0, icon: Bed, color: 'text-info' },
    { label: 'ICU Beds', value: hospital.bedCount?.icu ?? 0, icon: Activity, color: 'text-error' },
    { label: 'Avg Rating', value: (hospital.rating?.averageRating ?? 0).toFixed(1), icon: Star, color: 'text-warning' },
    { label: 'Total Ratings', value: hospital.rating?.totalRatings ?? 0, icon: TrendingUp, color: 'text-success' },
    { label: 'Specialties', value: hospital.specialties?.length ?? 0, icon: Layers, color: 'text-secondary' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {statsItems.map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-base-200 rounded-xl p-3.5 border border-base-300"
          >
            <Icon size={16} className={`${color} mb-2`} />
            <p className="text-xl font-black text-base-content font-montserrat">{value}</p>
            <p className="text-[10px] text-base-content/50 font-medium mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {specData.length > 0 && (
          <SectionCard title="Doctor Specializations" icon={Stethoscope}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={specData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {specData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        )}
        <SectionCard title="Facilities" icon={Zap}>
          <div className="grid grid-cols-2 gap-2">
            {facilityData.map(({ name, active }) => (
              <div
                key={name}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold ${
                  active
                    ? 'bg-success/10 text-success'
                    : 'bg-base-200 text-base-content/40'
                }`}
              >
                {active ? <CheckCircle size={12} /> : <XCircle size={12} />} {name}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Hospital Info" icon={Building2}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Type', hospital.hospitalType],
            ['Model', hospital.managementModel],
            ['Status', hospital.isActive ? 'Active' : 'Inactive'],
            ['Verified', hospital.isVerified ? 'Yes' : 'No'],
            ['City', hospital.address?.city],
            ['Pincode', hospital.address?.pincode],
            ['Phone', hospital.contact?.phone],
            ['Email', hospital.contact?.email],
            ['License', hospital.registrationDetails?.licenseNumber],
            ['GST', hospital.registrationDetails?.gstNumber ?? '—'],
            ['Specialties', hospital.specialties?.join(', ') || '—'],
            ['Accreditations', hospital.accreditations?.join(', ') || '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-base-200 rounded-lg px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 block">{k}</span>
              <span className="text-xs font-semibold text-base-content truncate block">{v ?? '—'}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
const ProfileTab = ({ hospital, dispatch, loading }) => {
  const [form, setForm] = useState({
    name: hospital.name ?? '',
    description: hospital.description ?? '',
    hospitalType: hospital.hospitalType ?? '',
    'contact.phone': hospital.contact?.phone ?? '',
    'contact.email': hospital.contact?.email ?? '',
    'contact.website': hospital.contact?.website ?? '',
    'contact.whatsapp': hospital.contact?.whatsapp ?? '',
    'contact.emergencyPhone': hospital.contact?.emergencyPhone ?? '',
    'contact.alternatePhone': hospital.contact?.alternatePhone ?? '',
    'address.line1': hospital.address?.line1 ?? '',
    'address.line2': hospital.address?.line2 ?? '',
    'address.landmark': hospital.address?.landmark ?? '',
    'address.city': hospital.address?.city ?? '',
    'address.state': hospital.address?.state ?? '',
    'address.pincode': hospital.address?.pincode ?? '',
    googleMapsUrl: hospital.googleMapsUrl ?? '',
    specialties: hospital.specialties ?? [],
    accreditations: hospital.accreditations ?? [],
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () =>
    dispatch(
      updateHospitalProfile({
        id: hospital._id,
        name: form.name,
        description: form.description,
        hospitalType: form.hospitalType,
        contact: {
          phone: form['contact.phone'],
          email: form['contact.email'],
          website: form['contact.website'],
          whatsapp: form['contact.whatsapp'],
          emergencyPhone: form['contact.emergencyPhone'],
          alternatePhone: form['contact.alternatePhone'],
        },
        address: {
          line1: form['address.line1'],
          line2: form['address.line2'],
          landmark: form['address.landmark'],
          city: form['address.city'],
          state: form['address.state'],
          pincode: form['address.pincode'],
        },
        googleMapsUrl: form.googleMapsUrl,
        specialties: form.specialties,
        accreditations: form.accreditations,
      })
    );

  return (
    <SectionCard
      title="Edit Profile"
      icon={Edit3}
      action={
        <button onClick={handleSave} disabled={loading.updateHospitalProfile} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
          {loading.updateHospitalProfile ? <Spinner /> : <Check size={12} />} Save
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Hospital Name" note="Official registered name." value={form.name} onChange={(v) => set('name', v)} />
        <SelectField
          label="Hospital Type"
          note="Changing type will change the management model."
          value={form.hospitalType}
          onChange={(v) => set('hospitalType', v)}
          options={HOSPITAL_TYPES}
        />
        <div className="col-span-2">
          <TextareaField
            label="Description"
            note="Max 1000 characters."
            value={form.description}
            onChange={(v) => set('description', v)}
            rows={2}
          />
        </div>
        <InputField label="Primary Phone" note="Main helpline." value={form['contact.phone']} onChange={(v) => set('contact.phone', v)} />
        <InputField
          label="Emergency Phone"
          note="Casualty / emergency line."
          value={form['contact.emergencyPhone']}
          onChange={(v) => set('contact.emergencyPhone', v)}
        />
        <InputField
          label="Alternate Phone"
          note="Second front-desk number."
          value={form['contact.alternatePhone']}
          onChange={(v) => set('contact.alternatePhone', v)}
        />
        <InputField label="WhatsApp" note="WhatsApp chat number." value={form['contact.whatsapp']} onChange={(v) => set('contact.whatsapp', v)} />
        <InputField label="Email" type="email" note="Official email." value={form['contact.email']} onChange={(v) => set('contact.email', v)} />
        <InputField label="Website" note="Include https://." value={form['contact.website']} onChange={(v) => set('contact.website', v)} />
        <div className="col-span-2">
          <InputField label="Address Line 1" note="Street / building number." value={form['address.line1']} onChange={(v) => set('address.line1', v)} />
        </div>
        <InputField label="Address Line 2" note="Area / colony." value={form['address.line2']} onChange={(v) => set('address.line2', v)} />
        <InputField label="Landmark" note="Nearby landmark." value={form['address.landmark']} onChange={(v) => set('address.landmark', v)} />
        <InputField label="City" note="City or town." value={form['address.city']} onChange={(v) => set('address.city', v)} />
        <SelectField label="State" note="Indian state / UT." value={form['address.state']} onChange={(v) => set('address.state', v)} options={INDIAN_STATES} />
        <InputField label="Pincode" note="6-digit Indian PIN." value={form['address.pincode']} onChange={(v) => set('address.pincode', v)} />
        <div className="col-span-2">
          <InputField label="Google Maps URL" note="Share link from Google Maps." value={form.googleMapsUrl} onChange={(v) => set('googleMapsUrl', v)} />
        </div>
        <div className="col-span-2">
          <MultiSelect
            label="Specialties"
            note="Select all offered medical specialties."
            options={SPECIALTIES_LIST}
            selected={form.specialties}
            onChange={(v) => set('specialties', v)}
          />
        </div>
        <div className="col-span-2">
          <MultiSelect
            label="Accreditations"
            note="Active certifications held."
            options={ACCREDITATIONS}
            selected={form.accreditations}
            onChange={(v) => set('accreditations', v)}
          />
        </div>
      </div>
    </SectionCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────────
const SettingsTab = ({ hospital, dispatch, loading }) => {
  const [form, setForm] = useState({
    isEmergencyReady: hospital.isEmergencyReady ?? false,
    hasICU: hospital.hasICU ?? false,
    hasBloodBank: hospital.hasBloodBank ?? false,
    hasPharmacy: hospital.hasPharmacy ?? false,
    hasDiagnostics: hospital.hasDiagnostics ?? false,
    hasAmbulance: hospital.hasAmbulance ?? false,
    hasWheelchairAccess: hospital.hasWheelchairAccess ?? false,
    is24x7: hospital.is24x7 ?? false,
    nabledLabAvailable: hospital.nabledLabAvailable ?? false,
    'bedCount.total': hospital.bedCount?.total ?? 0,
    'bedCount.icu': hospital.bedCount?.icu ?? 0,
    facilities: hospital.facilities ?? [],
    acceptedSchemes: hospital.acceptedSchemes ?? [],
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () =>
    dispatch(
      updateHospitalSettings({
        id: hospital._id,
        isEmergencyReady: form.isEmergencyReady,
        hasICU: form.hasICU,
        hasBloodBank: form.hasBloodBank,
        hasPharmacy: form.hasPharmacy,
        hasDiagnostics: form.hasDiagnostics,
        hasAmbulance: form.hasAmbulance,
        hasWheelchairAccess: form.hasWheelchairAccess,
        is24x7: form.is24x7,
        nabledLabAvailable: form.nabledLabAvailable,
        bedCount: { total: Number(form['bedCount.total']), icu: Number(form['bedCount.icu']) },
        facilities: form.facilities,
        acceptedSchemes: form.acceptedSchemes,
      })
    );

  const flags = [
    ['isEmergencyReady', 'Emergency Ready', 'Has 24/7 emergency / casualty services.'],
    ['hasICU', 'Has ICU', 'ICU beds > 0 auto-enables this.'],
    ['hasBloodBank', 'Has Blood Bank', 'On-site blood bank.'],
    ['hasPharmacy', 'Has Pharmacy', 'In-house pharmacy.'],
    ['hasDiagnostics', 'Has Diagnostics', 'Lab / diagnostic centre on campus.'],
    ['hasAmbulance', 'Has Ambulance', 'Ambulance fleet operated by hospital.'],
    ['hasWheelchairAccess', 'Wheelchair Access', 'Ramps, lifts, and accessible restrooms.'],
    ['is24x7', 'Open 24×7', 'Round-the-clock operations (OPD, Emergency, etc).'],
    ['nabledLabAvailable', 'NABL Lab', 'NABL-accredited lab present on site.'],
  ];

  return (
    <SectionCard
      title="Facility Settings"
      icon={Settings}
      action={
        <button onClick={handleSave} disabled={loading.updateHospitalSettings} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
          {loading.updateHospitalSettings ? <Spinner /> : <Check size={12} />} Save
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
        {flags.map(([key, label, note]) => (
          <Toggle key={key} label={label} note={note} checked={form[key]} onChange={(v) => set(key, v)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-base-300">
        <InputField label="Total Beds" note="All inpatient beds combined." type="number" value={form['bedCount.total']} onChange={(v) => set('bedCount.total', v)} />
        <InputField label="ICU Beds" note="Setting > 0 auto-enables Has ICU flag." type="number" value={form['bedCount.icu']} onChange={(v) => set('bedCount.icu', v)} />
      </div>
      <div className="mt-4 space-y-4">
        <MultiSelect label="Facilities & Amenities" note="Select all on-campus facilities." options={FACILITIES_LIST} selected={form.facilities} onChange={(v) => set('facilities', v)} />
        <MultiSelect label="Accepted Insurance / Schemes" note="All insurance/govt schemes accepted." options={ACCEPTED_SCHEMES} selected={form.acceptedSchemes} onChange={(v) => set('acceptedSchemes', v)} />
      </div>
    </SectionCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  SECURITY TAB
// ─────────────────────────────────────────────────────────────────────────────
const SecurityTab = ({ hospital, dispatch, loading }) => {
  const [docUrl, setDocUrl] = useState(hospital.registrationDetails?.documentUrl ?? '');
  const [docFile, setDocFile] = useState(null);
  const [form, setForm] = useState({
    licenseNumber: hospital.registrationDetails?.licenseNumber ?? '',
    gstNumber: hospital.registrationDetails?.gstNumber ?? '',
    panNumber: hospital.registrationDetails?.panNumber ?? '',
    licenseExpiry: hospital.registrationDetails?.licenseExpiry?.slice?.(0, 10) ?? '',
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () =>
    dispatch(
      updateHospitalSecurity({
        id: hospital._id,
        ...form,
        documentUrl: docUrl || undefined,
      })
    );

  return (
    <div className="space-y-4">
      <SectionCard
        title="Registration Details"
        icon={Lock}
        action={
          <button onClick={handleSave} disabled={loading.updateHospitalSecurity} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
            {loading.updateHospitalSecurity ? <Spinner /> : <Check size={12} />} Save
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <InputField label="License Number" note="Must be unique. Changing requires admin approval." value={form.licenseNumber} onChange={(v) => set('licenseNumber', v)} />
          <InputField label="License Expiry" note="Expiry date of the operating license." type="date" value={form.licenseExpiry} onChange={(v) => set('licenseExpiry', v)} />
          <InputField label="GST Number" note="15-digit GSTIN (optional)." value={form.gstNumber} onChange={(v) => set('gstNumber', v)} />
          <InputField label="PAN Number" note="10-char PAN for TDS and settlement." value={form.panNumber} onChange={(v) => set('panNumber', v)} />
          <div className="col-span-2">
            <DualUploadField
              label="Registration Document"
              note="License scan, certificate, or registration letter. Paste an ImageKit/hosted URL — saved directly as registrationDetails.documentUrl."
              url={docUrl}
              onUrlChange={setDocUrl}
              file={docFile}
              onFileChange={setDocFile}
              accept="image/jpeg,image/png,image/webp,application/pdf"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Manager Credentials" icon={Send}>
        <p className="text-xs text-base-content/60 mb-4">
          Generate a new password and resend login credentials to the hospital manager.
        </p>
        <button
          onClick={() => dispatch(resendHospitalManagerCredentials(hospital._id))}
          disabled={loading.resendHospitalManagerCredentials}
          className="btn-primary-cta text-sm px-5 py-2.5 flex items-center gap-2"
        >
          {loading.resendHospitalManagerCredentials ? <Spinner /> : <Send size={13} />} Resend Credentials
        </button>
      </SectionCard>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM FEE SECTION
// ─────────────────────────────────────────────────────────────────────────────
const PlatformFeeSection = ({ doctor, dispatch, loading }) => {
  const current = doctor?.platformFee;
  const [type, setType] = useState(current?.type ?? 'percentage');
  const [value, setValue] = useState(current?.value ?? '');
  const [clear, setClear] = useState(false);

  const handleSave = () => {
    const pf = clear ? null : { type, value: Number(value) };
    dispatch(updateDoctorPlatformFee({ id: doctor._id, platformFee: pf }));
  };

return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-[10px] text-base-content/45 leading-relaxed">
        <Info size={11} className="shrink-0 mt-0.5" />
        Note: priority order is Doctor override → Hospital override → Likeson global default. Setting a value here always wins over hospital/global.
      </p>
      <Toggle
        label="Clear override (revert to global default)"
        note="Global platform pricing config applies when cleared."
        checked={clear}
        onChange={setClear}
      />
      {!clear && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Fee Type"
            note="Fixed = flat ₹ amount. Percentage = % of consultation fee."
            value={type}
            onChange={setType}
            options={[{ value: 'fixed', label: 'Fixed (₹)' }, { value: 'percentage', label: 'Percentage (%)' }]}
          />
          <InputField
            label={type === 'fixed' ? 'Amount (₹)' : 'Percent (%)'}
            note={type === 'percentage' ? 'Must be between 0–100.' : 'Flat rupee amount charged per booking.'}
            type="number"
            value={value}
            onChange={setValue}
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={loading.updateDoctorPlatformFee} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
          {loading.updateDoctorPlatformFee ? <Spinner /> : <Check size={12} />}
          {clear ? 'Clear Override' : 'Set Override'}
        </button>
        {current && <p className="text-xs text-base-content/40">Current: {current.type} = {current.value}</p>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PRICING TAB
// ─────────────────────────────────────────────────────────────────────────────
const PricingTab = ({ hospital, dispatch, loading }) => {
  const isMgd = MANAGED_TYPES.includes(hospital.hospitalType);
  const cp = hospital.consultationPricing ?? {};

  const [form, setForm] = useState({
    inPersonFee: cp.inPersonFee ?? 600,
    videoFee: cp.videoFee ?? 500,
    homeVisitFee: cp.homeVisitFee ?? 1000,
    inPersonHonorarium: cp.inPersonHonorarium ?? 400,
    videoHonorarium: cp.videoHonorarium ?? 350,
    homeVisitHonorarium: cp.homeVisitHonorarium ?? 700,
    followUpFee: cp.followUpFee ?? 0,
    followUpDiscountPercent: cp.followUpDiscountPercent ?? 20,
    followUpValidDays: cp.followUpValidDays ?? 7,
    'ct.inPerson': cp.consultationTypes?.inPerson ?? true,
    'ct.video': cp.consultationTypes?.video ?? false,
    'ct.homeVisit': cp.consultationTypes?.homeVisit ?? false,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () =>
    dispatch(
      updateHospitalConsultationPricing({
        id: hospital._id,
        inPersonFee: Number(form.inPersonFee),
        videoFee: Number(form.videoFee),
        homeVisitFee: Number(form.homeVisitFee),
        inPersonHonorarium: Number(form.inPersonHonorarium),
        videoHonorarium: Number(form.videoHonorarium),
        homeVisitHonorarium: Number(form.homeVisitHonorarium),
        followUpFee: Number(form.followUpFee),
        followUpDiscountPercent: Number(form.followUpDiscountPercent),
        followUpValidDays: Number(form.followUpValidDays),
        consultationTypes: { inPerson: form['ct.inPerson'], video: form['ct.video'], homeVisit: form['ct.homeVisit'] },
      })
    );

  if (!isMgd) {
    return (
      <SectionCard title="Pricing" icon={DollarSign}>
        <div className="flex items-start gap-3 p-4 bg-warning/10 rounded-xl border border-warning/30">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-warning">
            This is a <strong>doctor-owner</strong> hospital (Clinic / Nursing Home). Pricing is managed at the individual{' '}
            <strong>doctor profile level</strong>. Use the Doctors tab to update fees per doctor.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Consultation Pricing"
      icon={DollarSign}
      action={
        <button
          onClick={handleSave}
          disabled={loading.updateHospitalConsultationPricing}
          className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5"
        >
          {loading.updateHospitalConsultationPricing ? <Spinner /> : <Check size={12} />} Save
        </button>
      }
    >
     <div className="flex items-start gap-2 p-3 mb-4 bg-info/10 border border-info/30 rounded-xl">
        <Info size={13} className="text-info shrink-0 mt-0.5" />
        <p className="text-[11px] text-base-content/60 leading-relaxed">
          Note: this is <strong>hospital-wide</strong> pricing — it applies to every doctor linked
          to this hospital. There is no per-doctor fee override for hospital-manager type hospitals.
        </p>
      </div>
      <div className="mb-5 space-y-2">
        <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Consultation Types Offered</p>
        <div className="flex flex-wrap gap-5">
          <Toggle label="In-Person" note="OPD / walk-in consultations." checked={form['ct.inPerson']} onChange={(v) => set('ct.inPerson', v)} />
          <Toggle label="Video" note="Telemedicine / online consultations." checked={form['ct.video']} onChange={(v) => set('ct.video', v)} />
          <Toggle label="Home Visit" note="Doctor visits patient at home." checked={form['ct.homeVisit']} onChange={(v) => set('ct.homeVisit', v)} />
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Fees Charged to Patient & Doctor Honorarium</p>
        {[
          ['In-Person Fee (₹)', 'inPersonFee', 'Amount charged to patient for in-person visit.', 'In-Person Honorarium (₹)', 'inPersonHonorarium', 'Amount paid to the doctor per in-person consultation.'],
          ['Video Fee (₹)', 'videoFee', 'Amount charged to patient for video call.', 'Video Honorarium (₹)', 'videoHonorarium', 'Amount paid to the doctor per video consultation.'],
          ['Home Visit Fee (₹)', 'homeVisitFee', 'Amount charged to patient for home visit.', 'Home Visit Honorarium (₹)', 'homeVisitHonorarium', 'Amount paid to the doctor per home visit.'],
        ].map(([l1, k1, n1, l2, k2, n2]) => (
          <div key={k1} className="grid grid-cols-2 gap-3">
            <InputField label={l1} note={n1} type="number" value={form[k1]} onChange={(v) => set(k1, v)} />
            <InputField label={l2} note={n2} type="number" value={form[k2]} onChange={(v) => set(k2, v)} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 pt-4 mt-3 border-t border-base-300">
        <InputField label="Follow-up Fee (₹)" note="Set 0 for free follow-ups." type="number" value={form.followUpFee} onChange={(v) => set('followUpFee', v)} />
        <InputField label="Follow-up Discount %" note="% discount on full fee for follow-up visits. 0–100." type="number" value={form.followUpDiscountPercent} onChange={(v) => set('followUpDiscountPercent', v)} />
        <InputField label="Follow-up Valid Days" note="Days after first visit during which follow-up pricing applies. 1–90." type="number" value={form.followUpValidDays} onChange={(v) => set('followUpValidDays', v)} />
      </div>
    </SectionCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGES TAB  (dual upload)
// ─────────────────────────────────────────────────────────────────────────────
const ImagesTab = ({ hospital, dispatch, loading }) => {
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [imgUrls, setImgUrls] = useState('');
  const [imgFiles, setImgFiles] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const handleUpload = async () => {
    if (logoFile || imgFiles.length > 0) {
      await dispatch(
        uploadHospitalImages({
          id: hospital._id,
          logo: logoFile || undefined,
          images: imgFiles.length > 0 ? imgFiles : undefined,
        })
      );
      setLogoFile(null);
      setImgFiles([]);
    }
    if (logoUrl || imgUrls) {
      const newUrls = imgUrls.split('\n').map((u) => u.trim()).filter(Boolean);
      await dispatch(
        updateHospitalProfile({
          id: hospital._id,
          ...(logoUrl ? { logo: logoUrl } : {}),
          ...(newUrls.length > 0 ? { images: [...(hospital.images ?? []), ...newUrls] } : {}),
        })
      );
      setLogoUrl('');
      setImgUrls('');
    }
  };

  return (
    <>
      <AnimatePresence>{confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}</AnimatePresence>
      <div className="space-y-4">
        <SectionCard title="Logo" icon={Camera}>
          <div className="flex items-start gap-4">
            {hospital.logo && <img src={hospital.logo} alt="logo" className="w-16 h-16 rounded-xl object-cover border border-base-300 shrink-0" />}
            <div className="flex-1">
              <DualUploadField
                label="Hospital Logo"
                note="512×512 px recommended. PNG/WebP. Max 5 MB. Paste a CDN URL or choose a file — both supported."
                url={logoUrl}
                onUrlChange={setLogoUrl}
                file={logoFile}
                onFileChange={setLogoFile}
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Gallery Images" icon={Image}>
          <DualUploadField
            label={`Gallery Images (max 20 total — currently ${hospital.images?.length ?? 0})`}
            note="Paste one URL per line OR select multiple files. Both methods can be combined."
            url={imgUrls}
            onUrlChange={setImgUrls}
            file={imgFiles}
            onFileChange={setImgFiles}
            accept="image/jpeg,image/png,image/webp"
            multiple
          />
          <button
            onClick={handleUpload}
            disabled={loading.uploadHospitalImages || loading.updateHospitalProfile || (!logoFile && !imgFiles.length && !logoUrl && !imgUrls)}
            className="btn-primary-cta text-xs px-5 py-2.5 flex items-center gap-2 mt-4"
          >
            {loading.uploadHospitalImages || loading.updateHospitalProfile ? <Spinner /> : <Upload size={13} />} Upload / Save All
          </button>

          {hospital.images?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
                Current Gallery ({hospital.images.length}/20)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {hospital.images.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-base-300 aspect-video bg-base-200">
                    <img src={url} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() =>
                          setConfirm({
                            message: 'Delete this gallery image permanently?',
                            onConfirm: () => {
                              dispatch(deleteHospitalImage({ id: hospital._id, imageIndex: idx }));
                              setConfirm(null);
                            },
                          })
                        }
                        className="btn btn-error btn-xs rounded-lg px-2 py-1.5 flex items-center justify-center"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 text-[9px] text-white/70 bg-black/40 px-1 rounded">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  LOCATION TAB
// ─────────────────────────────────────────────────────────────────────────────
const LocationTab = ({ hospital, dispatch, loading }) => {
  const coords = hospital.location?.coordinates ?? [80.648, 16.506];
  const [lat, setLat] = useState(coords[1]);
  const [lng, setLng] = useState(coords[0]);
  const [mapsUrl, setMapsUrl] = useState(hospital.googleMapsUrl ?? '');

  const handleSave = () =>
    dispatch(
      updateHospitalLocation({
        id: hospital._id,
        lat: Number(lat),
        lng: Number(lng),
        googleMapsUrl: mapsUrl || undefined,
      })
    );

  return (
    <SectionCard
      title="Hospital Location"
      icon={MapPin}
      action={
        <button onClick={handleSave} disabled={loading.updateHospitalLocation} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
          {loading.updateHospitalLocation ? <Spinner /> : <Check size={12} />} Save
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <InputField
          label="Latitude"
          note="Decimal latitude (e.g. 16.506 for Vijayawada). Obtained from Google Maps → right-click the pin."
          type="number"
          value={lat}
          onChange={setLat}
          placeholder="16.506"
        />
        <InputField
          label="Longitude"
          note="Decimal longitude (e.g. 80.648 for Vijayawada)."
          type="number"
          value={lng}
          onChange={setLng}
          placeholder="80.648"
        />
        <div className="col-span-2">
          <InputField
            label="Google Maps URL"
            note="Paste the share link from Google Maps for quick patient navigation."
            value={mapsUrl}
            onChange={setMapsUrl}
            placeholder="https://goo.gl/maps/…"
          />
        </div>
      </div>
      <div className="p-3 bg-base-200 rounded-xl border border-base-300">
        <p className="text-xs text-base-content/50 mb-1 font-semibold">Current Stored Coordinates</p>
        <p className="text-xs font-mono text-base-content">
          [lng: {coords[0]}, lat: {coords[1]}]
        </p>
      </div>
    </SectionCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  DOCTORS TAB
// ─────────────────────────────────────────────────────────────────────────────
const DoctorsTab = ({ hospital, dispatch, loading, allDoctors }) => {
  const hospitalDoctors = useSelector(selectHospitalDoctors);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [expandedDoctor, setExpandedDoctor] = useState(null);

  useEffect(() => {
    dispatch(fetchDoctorsByHospital({ hospitalId: hospital._id }));
  }, [hospital._id, dispatch]);

  const handleUnlink = (doctorId) =>
    setConfirm({
      message: 'Unlink this doctor from the hospital?',
      onConfirm: () => {
        dispatch(unlinkDoctorFromHospital({ hospitalId: hospital._id, doctorId }));
        setConfirm(null);
      },
    });

  const handleDeleteDoctor = (doctorId) =>
    setConfirm({
      message: 'Permanently delete this doctor profile? This cannot be undone.',
      onConfirm: () => {
        dispatch(deleteDoctorProfile(doctorId));
        setConfirm(null);
      },
    });

  return (
    <>
      <AnimatePresence>
        {showCreate && <CreateDoctorModal hospitalId={hospital._id} onClose={() => setShowCreate(false)} dispatch={dispatch} loading={loading} />}
        {showLink && (
          <LinkDoctorModal hospitalId={hospital._id} onClose={() => setShowLink(false)} dispatch={dispatch} loading={loading} allDoctors={allDoctors} />
        )}
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      </AnimatePresence>

      <SectionCard
        title={`Doctors (${hospitalDoctors.length})`}
        icon={Stethoscope}
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowLink(true)} className="btn-secondary text-[11px] px-3 py-1.5 flex items-center gap-1.5">
              <Link size={11} /> Link Existing
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary-cta text-[11px] px-3 py-1.5 flex items-center gap-1.5">
              <Plus size={11} /> Create New
            </button>
          </div>
        }
      >
        {hospitalDoctors.length === 0 ? (
          <div className="text-center py-8 text-base-content/40">
            <Stethoscope size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No doctors linked yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hospitalDoctors.map((doc) => (
              <DoctorRow
                key={doc._id}
                doc={doc}
                dispatch={dispatch}
                loading={loading}
                expanded={expandedDoctor === doc._id}
                onExpand={() => setExpandedDoctor(expandedDoctor === doc._id ? null : doc._id)}
                onUnlink={() => handleUnlink(doc._id)}
                onDelete={() => handleDeleteDoctor(doc._id)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
};

// Doctor Row (expandable)
const DoctorRow = ({ doc, dispatch, loading, expanded, onExpand, onUnlink, onDelete }) => {
  const [tab, setTab] = useState('profile');
  const [dForm, setDForm] = useState({
    specialization: doc.specialization ?? '',
    experienceYears: doc.experienceYears ?? 0,
    biography: doc.biography ?? '',
    'fees.inPersonFee': doc.fees?.inPersonFee ?? 0,
    'fees.videoFee': doc.fees?.videoFee ?? 0,
    'fees.homeVisitFee': doc.fees?.homeVisitFee ?? 0,
    partnershipStatus: doc.partnershipStatus ?? 'Pending',
    adminNotes: '',
    kycRejectionReason: '',
    isOnline: doc.isOnline ?? false,
    photoUrl: '',
    regNum: doc.registrationNumber ?? '',
    regCouncil: doc.registrationCouncil ?? '',
  });
  const set = (k, v) => setDForm((p) => ({ ...p, [k]: v }));

  const DOCTOR_TABS = ['profile', 'partnership', 'kyc', 'platform-fee', 'resend'];
  
  const kycClass = {
    'not-submitted': 'bg-base-300 text-base-content',
    'pending': 'badge-warning',
    'under-review': 'badge-info',
    'verified': 'badge-success',
    'rejected': 'badge-error'
  }[doc.kycStatus] ?? 'bg-base-300 text-base-content';

  const partClass = {
    'Pending': 'badge-warning',
    'Active': 'badge-success',
    'Inactive': 'bg-base-300 text-base-content',
    'Suspended': 'badge-error'
  }[doc.partnershipStatus] ?? 'bg-base-300 text-base-content';

  return (
    <motion.div layout className="border border-base-300 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-base-200 cursor-pointer" onClick={onExpand}>
        {doc.profilePhotoUrl || doc.user?.avatar ? (
          <img src={doc.profilePhotoUrl || doc.user?.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-base-300 shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Stethoscope size={13} className="text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{doc.user?.name ?? 'Doctor'}</p>
          <p className="text-[10px] text-base-content/40">{doc.specialization}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`badge ${kycClass}`}>{doc.kycStatus}</span>
          <span className={`badge ${partClass}`}>{doc.partnershipStatus}</span>
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''} text-base-content/40`} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex gap-0 border-b border-base-300 bg-base-100">
              {DOCTOR_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-2 transition-colors border-b-2 ${
                    tab === t ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/70'
                  }`}
                >
                  {t}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 pr-2">
                <button onClick={onUnlink} title="Unlink" className="p-1.5 hover:bg-warning/10 rounded text-warning">
                  <Unlink size={11} />
                </button>
                <button onClick={onDelete} title="Delete" className="p-1.5 hover:bg-error/10 rounded text-error">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            <div className="p-4">
              {tab === 'profile' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Specialization" note="Primary specialty." value={dForm.specialization} onChange={(v) => set('specialization', v)} options={SPECIALIZATIONS} />
                    <InputField label="Experience (yrs)" note="Years of practice." type="number" value={dForm.experienceYears} onChange={(v) => set('experienceYears', v)} />
                    <InputField label="In-Person Fee (₹)" note="Only for doctor-owner hospitals." type="number" value={dForm['fees.inPersonFee']} onChange={(v) => set('fees.inPersonFee', v)} />
                    <InputField label="Video Fee (₹)" note="Only for doctor-owner hospitals." type="number" value={dForm['fees.videoFee']} onChange={(v) => set('fees.videoFee', v)} />
                    <InputField label="Home Visit Fee (₹)" note="Only for doctor-owner hospitals." type="number" value={dForm['fees.homeVisitFee']} onChange={(v) => set('fees.homeVisitFee', v)} />
                    <InputField label="Reg. Number" note="MCI / State Council registration ID." value={dForm.regNum} onChange={(v) => set('regNum', v)} />
                    <div className="col-span-2">
                      <InputField label="Registration Council" note="e.g. Andhra Pradesh Medical Council." value={dForm.regCouncil} onChange={(v) => set('regCouncil', v)} />
                    </div>
                  </div>
                  <TextareaField label="Biography" note="Shown on doctor's public profile. Max 1000 chars." value={dForm.biography} onChange={(v) => set('biography', v)} rows={2} />
                  <Toggle
                    label="Online Status"
                    note="Marks doctor as currently available online."
                    checked={dForm.isOnline}
                    onChange={(v) => {
                      set('isOnline', v);
                      dispatch(updateDoctorSettings({ id: doc._id, isOnline: v }));
                    }}
                  />
                  <InputField
                    label="Profile Photo URL"
                    note="Paste an ImageKit CDN URL to update the doctor's photo directly."
                    value={dForm.photoUrl}
                    onChange={(v) => set('photoUrl', v)}
                    placeholder="https://ik.imagekit.io/…"
                  />
                  {dForm.photoUrl && (
                    <button
                      onClick={() => dispatch(updateDoctorProfile({ id: doc._id, profilePhotoUrl: dForm.photoUrl }))}
                      className="btn-secondary text-[10px] px-3 py-1.5"
                    >
                      Set Photo URL
                    </button>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        dispatch(
                          updateDoctorProfile({
                            id: doc._id,
                            specialization: dForm.specialization,
                            experienceYears: Number(dForm.experienceYears),
                            biography: dForm.biography,
                            fees: {
                              inPersonFee: Number(dForm['fees.inPersonFee']),
                              videoFee: Number(dForm['fees.videoFee']),
                              homeVisitFee: Number(dForm['fees.homeVisitFee']),
                            },
                            registrationNumber: dForm.regNum,
                            registrationCouncil: dForm.regCouncil,
                          })
                        )
                      }
                      disabled={loading.updateDoctorProfile}
                      className="btn-primary-cta text-[10px] px-4 py-2 flex items-center gap-1"
                    >
                      {loading.updateDoctorProfile ? <Spinner /> : <Check size={11} />} Save Profile
                    </button>
                  </div>
                </div>
              )}

              {tab === 'partnership' && (
                <div className="space-y-3">
                  <SelectField label="Partnership Status" note="Controls if doctor is bookable via Likeson." value={dForm.partnershipStatus} onChange={(v) => set('partnershipStatus', v)} options={PARTNERSHIP_STATUSES} />
                  <TextareaField label="Admin Notes" note="Internal notes. Not visible to doctor or patients." value={dForm.adminNotes} onChange={(v) => set('adminNotes', v)} rows={2} />
                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        dispatch(
                          updateDoctorPartnership({
                            id: doc._id,
                            partnershipStatus: dForm.partnershipStatus,
                            adminNotes: dForm.adminNotes || undefined,
                          })
                        )
                      }
                      disabled={loading.updateDoctorPartnership}
                      className="btn-primary-cta text-[10px] px-4 py-2 flex items-center gap-1"
                    >
                      {loading.updateDoctorPartnership ? <Spinner /> : <Check size={11} />} Save
                    </button>
                  </div>
                </div>
              )}

              {tab === 'kyc' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-base-content/60">Status:</span>
                    <span className={`badge ${kycClass}`}>{doc.kycStatus}</span>
                    {doc.kycVerifiedAt && (
                      <span className="text-[10px] text-base-content/40">
                        Verified {new Date(doc.kycVerifiedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {doc.kycRejectionReason && (
                    <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">Reason: {doc.kycRejectionReason}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => dispatch(verifyDoctorKyc({ id: doc._id, action: 'approve' }))}
                      disabled={loading.verifyDoctorKyc}
                      className="btn btn-success text-white text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5"
                    >
                      {loading.verifyDoctorKyc ? <Spinner /> : <CheckCircle size={12} />} Approve KYC
                    </button>
                    <div className="space-y-1">
                      <input
                        value={dForm.kycRejectionReason}
                        onChange={(e) => set('kycRejectionReason', e.target.value)}
                        placeholder="Rejection reason (required)…"
                        className="input-field w-full text-xs"
                      />
                      <button
                        onClick={() => dispatch(verifyDoctorKyc({ id: doc._id, action: 'reject', rejectionReason: dForm.kycRejectionReason }))}
                        disabled={loading.verifyDoctorKyc || !dForm.kycRejectionReason}
                        className="btn btn-error text-white text-xs px-4 py-2 rounded-lg w-full flex items-center justify-center gap-1.5"
                      >
                        <XCircle size={12} /> Reject KYC
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-base-300">
                    <Toggle
                      label="Active Status"
                      note="Inactive doctors are hidden from public listing."
                      checked={doc.isActive ?? true}
                      onChange={() => dispatch(toggleDoctorActive(doc._id))}
                    />
                  </div>
                </div>
              )}

              {tab === 'platform-fee' && <PlatformFeeSection doctor={doc} dispatch={dispatch} loading={loading} />}

              {tab === 'resend' && (
                <div className="space-y-3">
                  <p className="text-xs text-base-content/60">
                    Generate a new password and resend login credentials to <strong>{doc.user?.email}</strong>.
                  </p>
                  <button
                    onClick={() => dispatch(resendDoctorCredentials(doc._id))}
                    disabled={loading.resendDoctorCredentials}
                    className="btn-primary-cta text-xs px-5 py-2.5 flex items-center gap-2"
                  >
                    {loading.resendDoctorCredentials ? <Spinner /> : <Send size={13} />} Resend Credentials
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  VERIFICATION TAB
// ─────────────────────────────────────────────────────────────────────────────
const VerificationTab = ({ hospital, dispatch, loading }) => {
  const [confirm, setConfirm] = useState(null);

  return (
    <>
      <AnimatePresence>{confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}</AnimatePresence>
      <div className="space-y-4">
        <SectionCard title="Verification Status" icon={Shield}>
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                hospital.isVerified
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              }`}
            >
              {hospital.isVerified ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              {hospital.isVerified ? 'Verified' : 'Not Verified'}
            </div>
            {hospital.verifiedAt && (
              <p className="text-xs text-base-content/40">Since {new Date(hospital.verifiedAt).toLocaleDateString()}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() =>
                setConfirm({
                  message: 'Verify this hospital?',
                  onConfirm: () => {
                    dispatch(verifyHospital({ id: hospital._id, isVerified: true }));
                    setConfirm(null);
                  },
                })
              }
              disabled={hospital.isVerified || loading.verifyHospital}
              className="btn btn-success text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"
            >
              {loading.verifyHospital ? <Spinner /> : <CheckCircle size={14} />} Verify
            </button>
            <button
              onClick={() =>
                setConfirm({
                  message: 'Unverify this hospital?',
                  onConfirm: () => {
                    dispatch(verifyHospital({ id: hospital._id, isVerified: false }));
                    setConfirm(null);
                  },
                })
              }
              disabled={!hospital.isVerified || loading.verifyHospital}
              className="btn btn-warning text-warning-content text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"
            >
              <XCircle size={14} /> Unverify
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Active Status" icon={ToggleRight}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-base-content">{hospital.isActive ? 'Hospital is Active' : 'Hospital is Inactive'}</p>
              <p className="text-xs text-base-content/50 mt-0.5">
                {hospital.isActive ? 'Visible to patients and bookable.' : 'Hidden from public listing and booking.'}
              </p>
            </div>
            <button
              onClick={() =>
                setConfirm({
                  message: `${hospital.isActive ? 'Deactivate' : 'Activate'} this hospital?`,
                  onConfirm: () => {
                    dispatch(toggleHospitalActive(hospital._id));
                    setConfirm(null);
                  },
                })
              }
              disabled={loading.toggleHospitalActive}
              className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg font-bold transition-colors ${
                hospital.isActive ? 'bg-warning/10 text-warning hover:bg-warning/20' : 'bg-success/10 text-success hover:bg-success/20'
              }`}
            >
              {loading.toggleHospitalActive ? <Spinner /> : hospital.isActive ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
              {hospital.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Danger Zone" icon={AlertTriangle}>
          <div className="p-4 border border-error/30 rounded-xl bg-error/10">
            <p className="text-sm font-bold text-error mb-1">Delete Hospital Permanently</p>
            <p className="text-xs text-error/70 mb-4">This will remove the hospital, unlink all doctors, and cannot be reversed.</p>
            <button
              onClick={() =>
                setConfirm({
                  message: 'PERMANENTLY delete this hospital and unlink all doctors?',
                  onConfirm: () => {
                    dispatch(deleteHospital(hospital._id));
                    setConfirm(null);
                  },
                })
              }
              disabled={loading.deleteHospital}
              className="btn btn-error text-error-content text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"
            >
              {loading.deleteHospital ? <Spinner /> : <Trash2 size={13} />} Delete Permanently
            </button>
          </div>
        </SectionCard>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function HospitalManagementPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.user?.user) ?? null;
  const hospitals = useSelector(selectHospitals);
  const selectedHosp = useSelector(selectSelectedHospital);
  const loading = useSelector(selectHospitalLoading);
  const error = useSelector(selectHospitalError);
  const total = useSelector(selectHospitalTotal);
  const pages = useSelector(selectHospitalPages);
  const allDoctors = useSelector(selectDoctors);

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // verified: 'false' tells the controller to NOT restrict to isVerified=true,
    // so admins see both verified and unverified hospitals in this dashboard.
    dispatch(fetchAllHospitals({ verified: 'false', page: currentPage, limit: 20 }));
    dispatch(fetchAllDoctors({ page: 1, limit: 100 }));
  }, [dispatch, currentPage]);

  useEffect(() => {
    if (selectedHosp?._id) dispatch(fetchHospitalEffectivePricing(selectedHosp._id));
  }, [selectedHosp?._id, dispatch]);

  const handleSelectHospital = useCallback(
    (h) => {
      dispatch(fetchHospitalById(h._id));
      setActiveTab('overview');
      dispatch(clearHospitalDoctors());
    },
    [dispatch]
  );

  const displayedHospitals = (hospitals || []).filter((h) => {
    const matchQ =
      !searchQ || h.name?.toLowerCase().includes(searchQ.toLowerCase()) || h.address?.city?.toLowerCase().includes(searchQ.toLowerCase());
    const matchType = !filterType || h.hospitalType === filterType;
    const matchStat =
      !filterStatus ||
      (filterStatus === 'verified' && h.isVerified) ||
      (filterStatus === 'unverified' && !h.isVerified) ||
      (filterStatus === 'active' && h.isActive) ||
      (filterStatus === 'inactive' && !h.isActive);
    return matchQ && matchType && matchStat;
  });

  const tabContent = () => {
    if (!selectedHosp) return null;
    switch (activeTab) {
      case 'overview':
        return <OverviewTab hospital={selectedHosp} />;
      case 'profile':
        return <ProfileTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      case 'settings':
        return <SettingsTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      case 'security':
        return <SecurityTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      case 'pricing':
        return <PricingTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      case 'images':
        return <ImagesTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      case 'location':
        return <LocationTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      case 'doctors':
        return <DoctorsTab hospital={selectedHosp} dispatch={dispatch} loading={loading} allDoctors={allDoctors} />;
      case 'verification':
        return <VerificationTab hospital={selectedHosp} dispatch={dispatch} loading={loading} />;
      default:
        return null;
    }
  };

  return (
    <>
      <AnimatePresence>{showCreate && <CreateHospitalModal onClose={() => setShowCreate(false)} dispatch={dispatch} loading={loading} />}</AnimatePresence>

      <div data-theme='admin' className="flex h-[calc(100vh-64px)] bg-base-200 overflow-hidden font-poppins">
        {/* LEFT PANEL */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-[320px] shrink-0 flex flex-col bg-base-100 border-r border-base-300"
        >
          <div className="px-4 py-4 border-b border-base-300">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-base font-black text-base-content font-montserrat leading-tight">Hospital Management</h1>
                <p className="text-[10px] text-base-content/40 mt-0.5">{total} hospitals total</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity">
                <Plus size={15} className="text-primary-content" />
              </button>
            </div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search hospitals…"
                className="input-field w-full pl-8 py-2 text-xs"
              />
              {searchQ && (
                <button onClick={() => setSearchQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X size={12} className="text-base-content/40" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field flex-1 py-1.5 text-[10px]">
                <option value="">All Types</option>
                {HOSPITAL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field flex-1 py-1.5 text-[10px]">
                <option value="">All Status</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {loading.fetchAllHospitals && hospitals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Spinner size="md" />
                <p className="text-xs text-base-content/40">Loading hospitals…</p>
              </div>
            ) : displayedHospitals.length === 0 ? (
              <div className="text-center py-12 text-base-content/40">
                <Building2 size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No hospitals match your filters.</p>
              </div>
            ) : (
              displayedHospitals.map((h) => (
                <HospitalCard key={h._id} hospital={h} isSelected={selectedHosp?._id === h._id} onClick={() => handleSelectHospital(h)} />
              ))
            )}
          </div>

          {pages > 1 && (
            <div className="px-4 py-3 border-t border-base-300 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="text-xs px-3 py-1.5 rounded-lg border border-base-300 hover:bg-base-200 disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="text-[10px] text-base-content/50">
                {currentPage} / {pages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                disabled={currentPage >= pages}
                className="text-xs px-3 py-1.5 rounded-lg border border-base-300 hover:bg-base-200 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </motion.aside>

        {/* RIGHT PANEL */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedHosp ? (
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/30">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
                <Hospital size={52} className="opacity-20 mb-4" />
              </motion.div>
              <p className="text-sm font-semibold">Select a hospital to manage</p>
              <p className="text-xs mt-1 opacity-60">All admin controls will appear here.</p>
            </div>
          ) : (
            <>
              <motion.div
                key={selectedHosp._id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-base-100 border-b border-base-300 px-6 py-4 flex items-center gap-4 shrink-0"
              >
                {selectedHosp.logo ? (
                  <img src={selectedHosp.logo} alt="" className="w-12 h-12 rounded-xl object-cover border border-base-300 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={20} className="text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-base-content font-montserrat truncate">{selectedHosp.name}</h2>
                    <span className={`badge ${MANAGED_TYPES.includes(selectedHosp.hospitalType) ? 'badge-primary' : 'badge-info'}`}>
                      {selectedHosp.hospitalType}
                    </span>
                    <span className={`badge ${selectedHosp.isVerified ? 'badge-success' : 'badge-warning'}`}>
                      {selectedHosp.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                    {!selectedHosp.isActive && <span className="badge badge-error">Inactive</span>}
                  </div>
                  <p className="text-xs text-base-content/50 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />
                    {selectedHosp.address?.line1}, {selectedHosp.address?.city} — {selectedHosp.managementModel}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => dispatch(fetchHospitalById(selectedHosp._id))} className="p-2 hover:bg-base-200 rounded-lg transition-colors" title="Refresh">
                    <RefreshCw size={14} className={loading.fetchHospitalById ? 'animate-spin text-primary' : 'text-base-content/50'} />
                  </button>
                  <button onClick={() => dispatch(clearSelectedHospital())} className="p-2 hover:bg-base-200 rounded-lg transition-colors">
                    <X size={14} className="text-base-content/50" />
                  </button>
                </div>
              </motion.div>

              <div className="bg-base-100 border-b border-base-300 px-6 flex gap-0 overflow-x-auto shrink-0 scrollbar-thin">
                {SECTION_TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === id ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/70'
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-error/10 border-b border-error/30 px-6 py-2 flex items-center gap-2"
                  >
                    <AlertTriangle size={13} className="text-error shrink-0" />
                    <p className="text-xs text-error">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab + selectedHosp._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    {tabContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}