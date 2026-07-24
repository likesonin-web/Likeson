'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Search, RefreshCw, Plus, FlaskConical, MapPin, Phone, Mail,
  Star, ShieldCheck, Clock, Building2, Package, CheckCircle2,
  XCircle, Eye, EyeOff, Trash2, Edit3, ArrowUpRight, Wallet,
  Bell, Send, RotateCcw, BadgeCheck, Ban, PlayCircle, PauseCircle,
  FileCheck, CreditCard, TrendingUp, Activity, Zap, BarChart2,
  X, ChevronDown, Tag as TagIcon,
} from 'lucide-react';

import {
  adminFetchLabs,
  adminFetchLabById,
  adminFetchLabStats,
  adminCreateLab,
  adminUpdateLab,
  adminChangeLabStatus,
  adminSetLabPlatformFee,
  adminRemoveLabPlatformFee,
  adminAddLabTest,
  adminUpdateLabTest,
  adminDeleteLabTest,
  adminAddLabPackage,
  adminUpdateLabPackage,
  adminDeleteLabPackage,
  adminAddLabAccreditation,
  adminAddLabComplianceDoc,
  adminVerifyLabDoc,
  adminVerifyLabBank,
  adminFetchLabReviews,
  adminToggleReviewVisibility,
  adminDeleteLabReview,
  adminResendLabCredentials,
  adminSendLabNotification,
  selectAdminLabs,
  selectAdminSelectedLab,
  selectAdminStats,
  selectAdminPagination,
  selectAdminReviews,
  selectLabLoading,
  selectLabActionLoading,
} from '@/store/slices/labSlice';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CFG = {
  approved:     { label:'Approved',     icon:CheckCircle2, color:'#10b981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.3)'  },
  pending:      { label:'Pending',      icon:Clock,        color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.3)'  },
  under_review: { label:'Under Review', icon:Eye,          color:'#6366f1', bg:'rgba(99,102,241,0.1)', border:'rgba(99,102,241,0.3)'  },
  suspended:    { label:'Suspended',    icon:PauseCircle,  color:'#ef4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.3)'   },
  rejected:     { label:'Rejected',     icon:XCircle,      color:'#dc2626', bg:'rgba(220,38,38,0.1)',  border:'rgba(220,38,38,0.3)'   },
  deactivated:  { label:'Deactivated',  icon:Ban,          color:'#9ca3af', bg:'rgba(156,163,175,0.1)',border:'rgba(156,163,175,0.3)' },
};
const CHART_COLORS    = ['#7c3aed','#4f46e5','#10b981','#f59e0b','#ef4444','#6366f1'];
const LAB_TYPES       = ['Diagnostic Lab','Pathology Lab','Radiology Center','Microbiology Lab','Biochemistry Lab','Genetic Testing Lab','Molecular Lab','Immunology Lab','Multi-Specialty Lab'];
const OWNERSHIP_TYPES = ['Private','Corporate Chain','Franchise','Government','Trust / NGO'];
const ACCR_BODIES     = ['NABL','CAP','ISO','NABH','JCI','Other'];
const COMP_TYPES      = ['Lab_Registration_Certificate','PCB_NOC','Bio_Medical_Waste_License','Drug_License','GSTIN_Certificate','PAN_Card','Trade_License','MSME_Certificate','Other'];
const PAYOUT_FREQ     = ['Weekly','Bi-weekly','Monthly'];
const SAMPLE_MODES    = ['Walk-in','Home Collection','Both'];
const TABS = [
  { id:'overview',  label:'Overview',  icon:BarChart2    },
  { id:'tests',     label:'Tests',     icon:FlaskConical },
  { id:'packages',  label:'Packages',  icon:Package      },
  { id:'documents', label:'Documents', icon:FileCheck    },
  { id:'reviews',   label:'Reviews',   icon:Star         },
  { id:'financial', label:'Financial', icon:Wallet       },
];

// ─── Style atoms ─────────────────────────────────────────────────────────────

const inp = { width:'100%',borderRadius:8,border:'1px solid var(--base-300,#d1d5db)',background:'var(--base-200,#f9fafb)',padding:'9px 12px',fontSize:13,color:'var(--base-content,#111)',outline:'none',boxSizing:'border-box' };
const lbl = { fontSize:12,fontWeight:600,color:'var(--base-content,#374151)',marginBottom:4,display:'block' };

// ─── Atoms ───────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  const I = c.icon;
  return <span className="inline-flex items-center gap-[4px] py-[3px] px-[9px] rounded-[20px] text-[11px] font-bold tracking-[0.04em] uppercase" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}><I size={10} strokeWidth={2.5}/>{c.label}</span>;
};

const Chip = ({ children, color='#7c3aed' }) => (
  <span className="inline-flex items-center py-[2px] px-[7px] rounded-[20px] text-[11px] font-semibold" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{children}</span>
);

const Divider = ({ label }) => (
  <div className="flex items-center gap-[12px] mt-[18px] mx-[0px] mb-[10px]">
    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary whitespace-nowrap">{label}</span>
    <div className="flex-1 h-[1px] bg-base-300"/>
  </div>
);

const InfoRow = ({ label, value, icon:I }) => (
  <div className="flex items-start gap-[8px] py-[5px] px-[0px] border-b border-base-300">
    {I && <I size={12} strokeWidth={2} className="mt-[2px] shrink-0 text-primary"/>}
    <span className="text-[12px] text-base-content min-w-[130px] shrink-0">{label}</span>
    <span className="text-[12px] text-base-content font-semibold" style={{ wordBreak: 'break-all' }}>{value||'—'}</span>
  </div>
);

const StatCard = ({ label, value, icon:I, color }) => (
  <div className="bg-base-200 rounded-[11px] py-[13px] px-[16px] flex flex-col gap-[5px] border border-base-300">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-base-content font-bold uppercase tracking-[.06em]" style={{ opacity: .6 }}>{label}</span>
      <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center" style={{ background: `${color}18` }}><I size={12} color={color} strokeWidth={2}/></div>
    </div>
    <div className="text-[22px] font-extrabold text-base-content leading-[1]">{value??'—'}</div>
  </div>
);

const Btn = ({ label, icon:I, onClick, variant='default', disabled, size='md' }) => {
  const V = {
    default:{ bg:'var(--base-200,#f3f4f6)', color:'var(--base-content,#374151)', border:'var(--base-300,#d1d5db)' },
    primary:{ bg:'rgba(124,58,237,0.1)',     color:'#7c3aed',                     border:'rgba(124,58,237,0.3)' },
    success:{ bg:'rgba(16,185,129,0.1)',     color:'#059669',                     border:'rgba(16,185,129,0.3)' },
    danger: { bg:'rgba(239,68,68,0.1)',      color:'#dc2626',                     border:'rgba(239,68,68,0.3)'  },
    warning:{ bg:'rgba(245,158,11,0.1)',     color:'#b45309',                     border:'rgba(245,158,11,0.3)' },
    solid:  { bg:'#7c3aed',                  color:'#fff',                         border:'#7c3aed'              },
  };
  const v=V[variant]; const pad=size==='sm'?'5px 10px':'7px 13px'; const fs=size==='sm'?11:12;
  return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-[5px] rounded-[8px] font-bold whitespace-nowrap" style={{ padding: pad, border: `1px solid ${v.border}`, background: v.bg, color: v.color, fontSize: fs, cursor: disabled?'not-allowed':'pointer', opacity: disabled?.5:1, transition: 'all .15s' }}>{I&&<I size={size==='sm'?11:13} strokeWidth={2.5}/>}{label}</button>;
};

// ─── Modal Shell ─────────────────────────────────────────────────────────────

const Modal = ({ open, onClose, title, width=480, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/55 flex items-center justify-center p-[16px]">
      <motion.div initial={{ scale:.92,opacity:0 }} animate={{ scale:1,opacity:1 }} transition={{ duration:.15 }}
        className="bg-base-100 rounded-[16px] w-full shadow-[0_25px_60px_rgba(0,0,0,.25)] border border-base-300 max-h-[90vh] flex flex-col" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between pt-[18px] px-[22px] pb-[14px] border-b border-base-300 shrink-0">
          <h3 className="m-[0px] text-[16px] font-extrabold text-base-content">{title}</h3>
          <button onClick={onClose} className="border-none bg-transparent cursor-pointer p-[4px] rounded-[6px] text-[#9ca3af]"><X size={17}/></button>
        </div>
        <div className="py-[18px] px-[22px] overflow-y-auto flex-1">{children}</div>
      </motion.div>
    </div>
  );
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────

const ConfirmModal = ({ open, title, message, onConfirm, onCancel, requireReason, variant='danger' }) => {
  const [reason, setReason] = useState('');
  if (!open) return null;
  const bg = variant==='danger'?'#dc2626':variant==='success'?'#059669':'#7c3aed';
  return (
    <Modal open title={title} onClose={onCancel} width={420}>
      <p className="mt-[0px] mx-[0px] mb-[14px] text-[13px] text-base-content leading-[1.6]">{message}</p>
      {requireReason&&<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Enter reason (required)…" rows={3} className="resize-y mb-[4px]" style={{ ...inp }}/>}
      <div className="flex gap-[10px] justify-end mt-[14px]">
        <Btn label="Cancel" icon={X} onClick={()=>{onCancel();setReason('');}}/>
        <button onClick={()=>{onConfirm(reason);setReason('');}} disabled={requireReason&&!reason.trim()} className="py-[8px] px-[20px] rounded-[8px] border-none text-[#fff] cursor-pointer text-[13px] font-bold" style={{ background: bg, opacity: requireReason&&!reason.trim()?.5:1 }}>Confirm</button>
      </div>
    </Modal>
  );
};

// ─── Lab Form Modal (Create & Edit) ──────────────────────────────────────────

const LabFormModal = ({ open, onClose, onSave, initial, actionLoading }) => {
  const blank = { name:'',email:'',phone:'',labName:'',labType:'Diagnostic Lab',ownershipType:'Private',description:'',websiteUrl:'',registrationNumber:'',gstin:'',panNumber:'',establishedYear:'',sampleCollectionMode:'Both',homeCollectionRadius:'',homeCollectionFee:'',avgTurnaroundHours:'',payoutFrequency:'Monthly','addr.line1':'','addr.city':'','addr.state':'','addr.pincode':'','addr.district':'',logo:null,coverImage:null };
  const [form, setForm] = useState(blank);
  const isEdit = !!initial;

  useEffect(()=>{
    if (!open) return;
    if (initial) {
      setForm({ ...blank, labName:initial.labName??'', labType:initial.labType??'Diagnostic Lab', ownershipType:initial.ownershipType??'Private', description:initial.description??'', websiteUrl:initial.websiteUrl??'', registrationNumber:initial.registrationNumber??'', gstin:initial.gstin??'', panNumber:initial.panNumber??'', establishedYear:initial.establishedYear??'', sampleCollectionMode:initial.sampleCollectionMode??'Both', homeCollectionRadius:initial.homeCollectionRadius??'', homeCollectionFee:initial.homeCollectionFee??'', avgTurnaroundHours:initial.avgTurnaroundHours??'', payoutFrequency:initial.payoutFrequency??'Monthly', 'addr.line1':initial.registeredAddress?.line1??'', 'addr.city':initial.registeredAddress?.city??'', 'addr.state':initial.registeredAddress?.state??'', 'addr.pincode':initial.registeredAddress?.pincode??'', 'addr.district':initial.registeredAddress?.district??'' });
    } else { setForm(blank); }
  },[open,initial]);

  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const required = isEdit?(!form.labName||!form['addr.line1']||!form['addr.city']):(!form.name||!form.email||!form.labName||!form['addr.line1']||!form['addr.city']);

  const submit=()=>{
    const payload={ labName:form.labName,labType:form.labType,ownershipType:form.ownershipType,description:form.description,websiteUrl:form.websiteUrl,registrationNumber:form.registrationNumber,gstin:form.gstin,panNumber:form.panNumber,establishedYear:form.establishedYear,sampleCollectionMode:form.sampleCollectionMode,homeCollectionRadius:form.homeCollectionRadius,homeCollectionFee:form.homeCollectionFee,avgTurnaroundHours:form.avgTurnaroundHours,payoutFrequency:form.payoutFrequency,registeredAddress:{ line1:form['addr.line1'],city:form['addr.city'],state:form['addr.state'],pincode:form['addr.pincode'],district:form['addr.district'] } };
    if (!isEdit){ payload.name=form.name; payload.email=form.email; payload.phone=form.phone; }
    if (form.logo)       payload.logo=form.logo;
    if (form.coverImage) payload.coverImage=form.coverImage;
    onSave(payload);
  };

  const F=({ lbl:l, k, type='text', placeholder='', opts })=>(
    <div className="mb-[11px]">
      <label style={lbl}>{l}</label>
      {opts ? <select value={form[k]} onChange={e=>set(k,e.target.value)} style={inp}>{opts.map(o=><option key={o}>{o}</option>)}</select>
             : <input type={type} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={placeholder} style={inp}/>}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit — ${initial?.labName}`:'Create New Lab'} width={640}>
      {!isEdit&&<>
        <Divider label="Account Details"/>
        <div className="grid grid-cols-[1fr_1fr] gap-[12px]"><F lbl="Contact Name *" k="name" placeholder="Dr. John Doe"/><F lbl="Email *" k="email" type="email" placeholder="lab@example.com"/></div>
        <F lbl="Phone" k="phone" placeholder="+919876543210"/>
      </>}
      <Divider label="Lab Identity"/>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]"><F lbl="Lab Name *" k="labName" placeholder="ABC Diagnostics"/><F lbl="Lab Type *" k="labType" opts={LAB_TYPES}/></div>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]"><F lbl="Ownership Type" k="ownershipType" opts={OWNERSHIP_TYPES}/><F lbl="Established Year" k="establishedYear" type="number" placeholder="2018"/></div>
      <div className="mb-[11px]"><label style={lbl}>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} placeholder="Brief description…" className="resize-y" style={{ ...inp }}/></div>
      <F lbl="Website URL" k="websiteUrl" placeholder="https://example.com"/>
      <Divider label="Legal"/>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-[12px]"><F lbl="Registration No." k="registrationNumber" placeholder="AP-LAB-XXXX"/><F lbl="GSTIN" k="gstin" placeholder="27AABCU9603R1ZX"/><F lbl="PAN Number" k="panNumber" placeholder="AABCU9603R"/></div>
      <Divider label="Address"/>
      <F lbl="Address Line 1 *" k="addr.line1" placeholder="12 Main Road"/>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]"><F lbl="City *" k="addr.city" placeholder="Nellore"/><F lbl="District" k="addr.district" placeholder="Nellore District"/></div>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]"><F lbl="State *" k="addr.state" placeholder="Andhra Pradesh"/><F lbl="Pincode" k="addr.pincode" placeholder="524001"/></div>
      <Divider label="Operations"/>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]"><F lbl="Sample Collection Mode" k="sampleCollectionMode" opts={SAMPLE_MODES}/><F lbl="Payout Frequency" k="payoutFrequency" opts={PAYOUT_FREQ}/></div>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-[12px]"><F lbl="Home Radius (km)" k="homeCollectionRadius" type="number" placeholder="10"/><F lbl="Home Fee (₹)" k="homeCollectionFee" type="number" placeholder="100"/><F lbl="Avg TAT (hrs)" k="avgTurnaroundHours" type="number" placeholder="12"/></div>
      <Divider label="Images"/>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div><label style={lbl}>Logo</label><input type="file" accept="image/*" onChange={e=>set('logo',e.target.files[0])} className="text-[12px] text-base-content"/></div>
        <div><label style={lbl}>Cover Image</label><input type="file" accept="image/*" onChange={e=>set('coverImage',e.target.files[0])} className="text-[12px] text-base-content"/></div>
      </div>
      <div className="flex gap-[10px] justify-end mt-[16px] pt-[14px] border-t border-base-300">
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':(isEdit?'Save Changes':'Create Lab')} icon={isEdit?Edit3:Plus} variant="solid" onClick={submit} disabled={required||actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Test Form Modal ──────────────────────────────────────────────────────────

const TestFormModal = ({ open, onClose, onSave, initial, actionLoading }) => {
  const blank = { testCode:'',testName:'',category:'',sampleType:'',turnaroundHours:'',mrpPrice:'',partnerPrice:'',homeCollectionAvailable:'false',reportTemplate:null };
  const [form, setForm] = useState(blank);
  const isEdit = !!initial;
  useEffect(()=>{ if(open) setForm(initial?{ ...blank,testCode:initial.testCode??'',testName:initial.testName??'',category:initial.category??'',sampleType:initial.sampleType??'',turnaroundHours:initial.turnaroundHours??'',mrpPrice:initial.mrpPrice??'',partnerPrice:initial.partnerPrice??'',homeCollectionAvailable:initial.homeCollectionAvailable?'true':'false' }:blank); },[open,initial]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title={isEdit?'Edit Test':'Add Test'} width={520}>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Test Code</label><input value={form.testCode} onChange={e=>set('testCode',e.target.value)} placeholder="CBC-001" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Test Name *</label><input value={form.testName} onChange={e=>set('testName',e.target.value)} placeholder="Complete Blood Count" style={inp}/></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Category</label><input value={form.category} onChange={e=>set('category',e.target.value)} placeholder="Haematology" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Sample Type</label><input value={form.sampleType} onChange={e=>set('sampleType',e.target.value)} placeholder="Blood" style={inp}/></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>MRP (₹) *</label><input type="number" value={form.mrpPrice} onChange={e=>set('mrpPrice',e.target.value)} placeholder="350" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Partner (₹)</label><input type="number" value={form.partnerPrice} onChange={e=>set('partnerPrice',e.target.value)} placeholder="260" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>TAT (hrs)</label><input type="number" value={form.turnaroundHours} onChange={e=>set('turnaroundHours',e.target.value)} placeholder="6" style={inp}/></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Home Collection</label><select value={form.homeCollectionAvailable} onChange={e=>set('homeCollectionAvailable',e.target.value)} style={inp}><option value="true">Available</option><option value="false">Not Available</option></select></div>
        <div className="mb-[11px]"><label style={lbl}>Report Template</label><input type="file" accept=".pdf,image/*" onChange={e=>set('reportTemplate',e.target.files[0])} className="text-[12px] text-base-content"/></div>
      </div>
      <div className="flex gap-[10px] justify-end pt-[14px] border-t border-base-300">
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':(isEdit?'Update':'Add Test')} icon={isEdit?Edit3:Plus} variant="solid" onClick={()=>onSave({...form,homeCollectionAvailable:form.homeCollectionAvailable==='true'})} disabled={!form.testName||!form.mrpPrice||actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Package Form Modal ───────────────────────────────────────────────────────

const PkgFormModal = ({ open, onClose, onSave, initial, actionLoading }) => {
  const blank = { packageCode:'',packageName:'',description:'',mrpPrice:'',partnerPrice:'',validUntil:'' };
  const [form, setForm] = useState(blank);
  const isEdit = !!initial;
  useEffect(()=>{ if(open) setForm(initial?{ packageCode:initial.packageCode??'',packageName:initial.packageName??'',description:initial.description??'',mrpPrice:initial.mrpPrice??'',partnerPrice:initial.partnerPrice??'',validUntil:initial.validUntil?new Date(initial.validUntil).toISOString().split('T')[0]:'' }:blank); },[open,initial]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title={isEdit?'Edit Package':'Add Package'} width={500}>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Package Code</label><input value={form.packageCode} onChange={e=>set('packageCode',e.target.value)} placeholder="PKG-001" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Package Name *</label><input value={form.packageName} onChange={e=>set('packageName',e.target.value)} placeholder="Aarogyam Basic" style={inp}/></div>
      </div>
      <div className="mb-[11px]"><label style={lbl}>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} className="resize-y" style={{ ...inp }}/></div>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>MRP (₹) *</label><input type="number" value={form.mrpPrice} onChange={e=>set('mrpPrice',e.target.value)} placeholder="2499" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Partner (₹)</label><input type="number" value={form.partnerPrice} onChange={e=>set('partnerPrice',e.target.value)} placeholder="1850" style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} style={inp}/></div>
      </div>
      <div className="flex gap-[10px] justify-end pt-[14px] border-t border-base-300">
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':(isEdit?'Update':'Add Package')} icon={isEdit?Edit3:Plus} variant="solid" onClick={()=>onSave(form)} disabled={!form.packageName||!form.mrpPrice||actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Accreditation Modal ──────────────────────────────────────────────────────

const AccrModal = ({ open, onClose, onSave, actionLoading }) => {
  const [form, setForm] = useState({ body:'NABL',certificateNo:'',issuedOn:'',validUntil:'',certificate:null });
  useEffect(()=>{ if(open) setForm({ body:'NABL',certificateNo:'',issuedOn:'',validUntil:'',certificate:null }); },[open]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title="Add Accreditation" width={460}>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Body *</label><select value={form.body} onChange={e=>set('body',e.target.value)} style={inp}>{ACCR_BODIES.map(b=><option key={b}>{b}</option>)}</select></div>
        <div className="mb-[11px]"><label style={lbl}>Certificate No.</label><input value={form.certificateNo} onChange={e=>set('certificateNo',e.target.value)} placeholder="MC-4821" style={inp}/></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Issued On</label><input type="date" value={form.issuedOn} onChange={e=>set('issuedOn',e.target.value)} style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} style={inp}/></div>
      </div>
      <div className="mb-[11px]"><label style={lbl}>Certificate Document</label><input type="file" accept=".pdf,image/*" onChange={e=>set('certificate',e.target.files[0])} className="text-[12px] text-base-content"/></div>
      <div className="flex gap-[10px] justify-end pt-[14px] border-t border-base-300">
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':'Add Accreditation'} icon={Plus} variant="solid" onClick={()=>onSave(form)} disabled={actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Compliance Doc Modal ─────────────────────────────────────────────────────

const CompModal = ({ open, onClose, onSave, actionLoading }) => {
  const [form, setForm] = useState({ docType:'Lab_Registration_Certificate',docNumber:'',issuedOn:'',validUntil:'',remarks:'',document:null });
  useEffect(()=>{ if(open) setForm({ docType:'Lab_Registration_Certificate',docNumber:'',issuedOn:'',validUntil:'',remarks:'',document:null }); },[open]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} onClose={onClose} title="Add Compliance Document" width={480}>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Document Type *</label><select value={form.docType} onChange={e=>set('docType',e.target.value)} style={inp}>{COMP_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="mb-[11px]"><label style={lbl}>Document Number</label><input value={form.docNumber} onChange={e=>set('docNumber',e.target.value)} placeholder="AP-LAB-2019-04812" style={inp}/></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
        <div className="mb-[11px]"><label style={lbl}>Issued On</label><input type="date" value={form.issuedOn} onChange={e=>set('issuedOn',e.target.value)} style={inp}/></div>
        <div className="mb-[11px]"><label style={lbl}>Valid Until</label><input type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} style={inp}/></div>
      </div>
      <div className="mb-[11px]"><label style={lbl}>Remarks</label><textarea value={form.remarks} onChange={e=>set('remarks',e.target.value)} rows={2} className="resize-y" style={{ ...inp }}/></div>
      <div className="mb-[11px]"><label style={lbl}>Document File</label><input type="file" accept=".pdf,image/*" onChange={e=>set('document',e.target.files[0])} className="text-[12px] text-base-content"/></div>
      <div className="flex gap-[10px] justify-end pt-[14px] border-t border-base-300">
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label={actionLoading?'Saving…':'Add Document'} icon={Plus} variant="solid" onClick={()=>onSave(form)} disabled={actionLoading}/>
      </div>
    </Modal>
  );
};

// ─── Notification Modal ───────────────────────────────────────────────────────

const NotifModal = ({ open, onSend, onClose }) => {
  const [form, setForm] = useState({ title:'',body:'',sendEmail:false });
  useEffect(()=>{ if(open) setForm({title:'',body:'',sendEmail:false}); },[open]);
  return (
    <Modal open={open} onClose={onClose} title="Send Notification" width={460}>
      <div className="mb-[11px]"><label style={lbl}>Title *</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Notification title" style={inp}/></div>
      <div className="mb-[11px]"><label style={lbl}>Message *</label><textarea value={form.body} onChange={e=>setForm(p=>({...p,body:e.target.value}))} rows={4} placeholder="Body message…" className="resize-y" style={{ ...inp }}/></div>
      <label className="flex items-center gap-[8px] text-[13px] cursor-pointer mb-[14px]"><input type="checkbox" checked={form.sendEmail} onChange={e=>setForm(p=>({...p,sendEmail:e.target.checked}))}/>Also send via Email</label>
      <div className="flex gap-[10px] justify-end pt-[14px] border-t border-base-300">
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label="Send" icon={Send} variant="solid" onClick={()=>onSend(form)} disabled={!form.title.trim()||!form.body.trim()}/>
      </div>
    </Modal>
  );
};

// ─── Platform Fee Modal ───────────────────────────────────────────────────────

const FeeModal = ({ open, current, onSave, onRemove, onClose }) => {
  const [type,setType]=useState('percentage'); const [value,setValue]=useState('');
  useEffect(()=>{ if(open){ setType(current?.type??'percentage'); setValue(current?.value??''); } },[open,current]);
  return (
    <Modal open={open} onClose={onClose} title="Platform Fee Override" width={400}>
      {current&&<p className="mt-[0px] mx-[0px] mb-[12px] text-[12px] text-[#6b7280]">Current: <strong>{current.type} — {current.type==='percentage'?`${current.value}%`:`₹${current.value}`}</strong></p>}
      <div className="flex gap-[8px] mb-[13px]">
        {['percentage','fixed'].map(t=><button key={t} onClick={()=>setType(t)} className="flex-1 p-[8px] rounded-[8px] cursor-pointer text-[13px] font-semibold" style={{ border: `1px solid ${type===t?'#7c3aed':'var(--base-300,#d1d5db)'}`, background: type===t?'rgba(124,58,237,0.08)':'transparent', color: type===t?'#7c3aed':'var(--base-content,#374151)' }}>{t==='percentage'?'% Percentage':'₹ Fixed'}</button>)}
      </div>
      <div className="mb-[11px]"><label style={lbl}>Value</label><input type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder={type==='percentage'?'12':'100'} style={inp}/></div>
      <div className="flex gap-[8px] justify-end pt-[14px] border-t border-base-300">
        {current&&<Btn label="Remove Override" icon={Trash2} variant="danger" onClick={onRemove}/>}
        <Btn label="Cancel" icon={X} onClick={onClose}/>
        <Btn label="Save" icon={CheckCircle2} variant="solid" onClick={()=>onSave({type,value:Number(value)})} disabled={!value}/>
      </div>
    </Modal>
  );
};

// ─── Left Panel ───────────────────────────────────────────────────────────────

const LabListPanel = ({ labs, selectedId, onSelect, loading, pagination, onPageChange, onSearch, searchVal, onFilter, filterStatus, onCreateLab }) => (
  <div className="flex flex-col h-full">
    <div className="pt-[12px] px-[12px] pb-[10px] border-b border-base-300 flex flex-col gap-[8px]">
      <Btn label="Create Lab" icon={Plus} variant="solid" onClick={onCreateLab}/>
      <div className="relative">
        <Search size={13} className="absolute left-[9px] top-[50%] text-[#9ca3af]" style={{ transform: 'translateY(-50%)' }}/>
        <input value={searchVal} onChange={e=>onSearch(e.target.value)} placeholder="Search labs…" className="pl-[27px] pt-[7px] pb-[7px]" style={{ ...inp }}/>
      </div>
      <select value={filterStatus} onChange={e=>onFilter(e.target.value)} className="pt-[7px] pb-[7px]" style={{ ...inp }}>
        <option value="">All Statuses</option>
        {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>
    <div className="py-[5px] px-[12px] text-[11px] text-[#9ca3af] font-bold tracking-[0.04em]">{pagination?.total??labs.length} LABS</div>
    <div className="flex-1 overflow-y-auto">
      {loading&&!labs.length?<div className="p-[32px] text-center text-[#9ca3af] text-[13px]">Loading…</div>:labs.length===0?<div className="p-[32px] text-center text-[#9ca3af] text-[13px]">No labs found.</div>:labs.map(lab=>{
        const sel=lab._id===selectedId; const cfg=STATUS_CFG[lab.status]??STATUS_CFG.pending;
        return (
          <motion.div key={lab._id} onClick={()=>onSelect(lab._id)} whileHover={{ x:2 }}
            className="py-[10px] px-[12px] cursor-pointer border-b border-base-300" style={{ background: sel?'rgba(124,58,237,0.05)':'transparent', borderLeft: sel?'3px solid #7c3aed':'3px solid transparent', transition: 'all .15s' }}>
            <div className="flex items-start gap-[8px]">
              <div className="w-[32px] h-[32px] rounded-[8px] overflow-hidden shrink-0 bg-[rgba(124,58,237,0.1)] flex items-center justify-center">
                {lab.logoUrl?<Image src={lab.logoUrl} alt="" width={32} height={32} className="object-cover w-full h-full"/>:<FlaskConical size={14} color="#7c3aed" strokeWidth={2}/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-base-content whitespace-nowrap overflow-hidden text-ellipsis">{lab.labName}</div>
                <div className="text-[10px] text-[#9ca3af] mt-[1px]">{lab.labCode??'—'} · {lab.labType}</div>
                <div className="flex items-center gap-[4px] mt-[3px]">
                  <span className="inline-flex items-center gap-[2px] py-[1px] px-[6px] rounded-[20px] text-[9px] font-bold" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}><cfg.icon size={8} strokeWidth={2.5}/>{cfg.label}</span>
                  {lab.isVerified&&<span className="inline-flex items-center gap-[2px] py-[1px] px-[5px] rounded-[20px] text-[9px] font-bold bg-[rgba(16,185,129,0.1)] text-[#059669] border border-[rgba(16,185,129,0.3)]"><BadgeCheck size={8} strokeWidth={2.5}/>✓</span>}
                </div>
              </div>
              <div className="flex items-center gap-[2px] text-[#9ca3af] shrink-0"><Star size={9} strokeWidth={2}/><span className="text-[10px]">{lab.averageRating?.toFixed(1)??'—'}</span></div>
            </div>
            {lab.registeredAddress?.city&&<div className="flex items-center gap-[3px] mt-[4px] pl-[40px]"><MapPin size={8} color="#9ca3af"/><span className="text-[10px] text-[#9ca3af]">{lab.registeredAddress.city}, {lab.registeredAddress.state}</span></div>}
          </motion.div>
        );
      })}
    </div>
    {pagination?.totalPages>1&&<div className="py-[8px] px-[12px] border-t border-base-300 flex items-center justify-between">
      <Btn label="Prev" icon={ChevronDown} size="sm" onClick={()=>onPageChange(pagination.page-1)} disabled={pagination.page<=1}/>
      <span className="text-[11px] text-[#9ca3af]">{pagination.page}/{pagination.totalPages}</span>
      <Btn label="Next" icon={ChevronDown} size="sm" onClick={()=>onPageChange(pagination.page+1)} disabled={pagination.page>=pagination.totalPages}/>
    </div>}
  </div>
);

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab = ({ lab, onEdit }) => {
  const addr = lab.registeredAddress;
  const ratingDist = [1,2,3,4,5].map(n=>({ name:`${n}★`,count:lab.reviews?.filter(r=>Math.round(r.rating)===n).length??0 }));
  const monthlyData=(()=>{ const map={}; (lab.reviews??[]).forEach(r=>{ const k=new Date(r.createdAt).toLocaleDateString('en-IN',{month:'short',year:'2-digit'}); map[k]=(map[k]??0)+1; }); return Object.entries(map).slice(-6).map(([month,count])=>({month,count})); })();
  return (
    <div className="p-[22px]">
      <div className="flex items-center gap-[14px] mb-[18px] py-[14px] px-[18px] bg-[linear-gradient(135deg,rgba(124,58,237,0.06),rgba(79,70,229,0.03))] rounded-[13px] border border-[rgba(124,58,237,0.12)]">
        <div className="w-[56px] h-[56px] rounded-[12px] overflow-hidden bg-[rgba(124,58,237,0.1)] flex items-center justify-center shrink-0">
          {lab.logoUrl?<Image src={lab.logoUrl} alt="" width={56} height={56} className="object-cover w-full h-full"/>:<FlaskConical size={24} color="#7c3aed"/>}
        </div>
        <div className="flex-1">
          <div className="text-[18px] font-extrabold text-base-content">{lab.labName}</div>
          <div className="text-[11px] text-[#9ca3af] my-[2px] mx-[0px]">{lab.labCode} · {lab.labType} · {lab.ownershipType}</div>
          <div className="flex flex-wrap gap-[5px] mt-[5px]">
            <StatusBadge status={lab.status}/>{lab.isVerified&&<Chip color="#059669">Verified</Chip>}{lab.isFeatured&&<Chip color="#d97706">Featured</Chip>}{lab.isActive&&<Chip color="#6366f1">Active</Chip>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-[7px] shrink-0">
          <div className="text-right"><div className="text-[24px] font-extrabold text-[#7c3aed] leading-[1]">{lab.averageRating?.toFixed(1)??'—'}</div><div className="text-[11px] text-[#9ca3af]">{lab.totalReviews??0} reviews</div></div>
          <Btn label="Edit Lab" icon={Edit3} variant="primary" size="sm" onClick={onEdit}/>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-[9px] mb-[18px]">
        <StatCard label="Active Tests"  value={lab.labTests?.filter(t=>t.isActive).length??0}    icon={FlaskConical} color="#7c3aed"/>
        <StatCard label="Packages"      value={lab.labPackages?.filter(p=>p.isActive).length??0}  icon={Package}     color="#4f46e5"/>
        <StatCard label="Branches"      value={lab.branches?.filter(b=>b.isActive).length??0}     icon={Building2}   color="#10b981"/>
        <StatCard label="Commission"    value={`${lab.commissionRate??0}%`}                        icon={TrendingUp}  color="#f59e0b"/>
      </div>
      <Divider label="Lab Information"/>
      <div className="grid grid-cols-[1fr_1fr] gap-[0 22] mb-[14px]">
        <InfoRow label="Registration No." value={lab.registrationNumber} icon={FileCheck}/>
        <InfoRow label="GSTIN"            value={lab.gstin}              icon={TagIcon}/>
        <InfoRow label="PAN"              value={lab.panNumber}          icon={CreditCard}/>
        <InfoRow label="Est. Year"        value={lab.establishedYear}    icon={Clock}/>
        <InfoRow label="Sample Mode"      value={lab.sampleCollectionMode} icon={Activity}/>
        <InfoRow label="Home Radius"      value={lab.homeCollectionRadius?`${lab.homeCollectionRadius} km`:null} icon={MapPin}/>
        <InfoRow label="Home Fee"         value={lab.homeCollectionFee?`₹${lab.homeCollectionFee}`:null} icon={Wallet}/>
        <InfoRow label="Avg TAT"          value={lab.avgTurnaroundHours?`${lab.avgTurnaroundHours}h`:null} icon={Clock}/>
        <InfoRow label="Payout Freq."     value={lab.payoutFrequency}    icon={Zap}/>
        <InfoRow label="Website"          value={lab.websiteUrl}         icon={ArrowUpRight}/>
      </div>
      {addr&&<><Divider label="Address"/><div className="py-[9px] px-[13px] bg-base-200 rounded-[9px] text-[13px] text-base-content leading-[1.8]">{[addr.line1,addr.line2,addr.city,addr.district,addr.state,addr.pincode].filter(Boolean).join(', ')}</div></>}
      {lab.user&&<><Divider label="Account"/><div className="grid grid-cols-[1fr_1fr] gap-[0 22]"><InfoRow label="Name" value={lab.user.name} icon={BadgeCheck}/><InfoRow label="Email" value={lab.user.email} icon={Mail}/><InfoRow label="Phone" value={lab.user.phone} icon={Phone}/><InfoRow label="Last Login" value={lab.user.lastLoginAt?new Date(lab.user.lastLoginAt).toLocaleString('en-IN'):null} icon={Clock}/></div></>}
      {lab.contactPersons?.length>0&&<><Divider label="Contact Persons"/>{lab.contactPersons.map(c=><div key={c._id} className="py-[10px] px-[13px] bg-base-200 rounded-[9px] flex items-start gap-[9px] mb-[7px]"><div className="w-[32px] h-[32px] rounded-[8px] bg-[rgba(124,58,237,0.1)] flex items-center justify-center shrink-0"><span className="text-[12px] font-extrabold text-[#7c3aed]">{c.name?.charAt(0)}</span></div><div><div className="text-[13px] font-bold text-base-content">{c.name} {c.isPrimary&&<Chip color="#7c3aed">Primary</Chip>}</div><div className="text-[11px] text-[#9ca3af]">{c.designation}</div><div className="flex gap-[10px] mt-[3px]">{c.phone&&<span className="text-[11px] text-[#6b7280] flex items-center gap-[3px]"><Phone size={9}/>{c.phone}</span>}{c.email&&<span className="text-[11px] text-[#6b7280] flex items-center gap-[3px]"><Mail size={9}/>{c.email}</span>}</div></div></div>)}</>}
      {lab.timing?.length>0&&<><Divider label="Operating Hours"/><div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-[7px]">{lab.timing.map(t=><div key={t.day} className="py-[7px] px-[10px] rounded-[7px]" style={{ background: t.isClosed?'rgba(239,68,68,0.05)':'rgba(16,185,129,0.05)', border: `1px solid ${t.isClosed?'rgba(239,68,68,0.15)':'rgba(16,185,129,0.15)'}` }}><div className="text-[10px] font-bold text-base-content">{t.day}</div><div className="text-[11px] font-semibold" style={{ color: t.isClosed?'#ef4444':'#059669' }}>{t.isClosed?'Closed':`${t.openTime} – ${t.closeTime}`}</div></div>)}</div></>}
      {monthlyData.length>0&&<><Divider label="Review Trend"/><div className="h-[160px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyData}><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={.28}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/><XAxis dataKey="month" tick={{ fontSize:11 }}/><YAxis allowDecimals={false} tick={{ fontSize:11 }}/><Tooltip contentStyle={{ fontSize:12,borderRadius:8 }}/><Area type="monotone" dataKey="count" stroke="#7c3aed" fill="url(#rg)" strokeWidth={2} name="Reviews"/></AreaChart></ResponsiveContainer></div></>}
      {ratingDist.some(r=>r.count>0)&&<><Divider label="Rating Distribution"/><div className="h-[140px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={ratingDist} barSize={24}><CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/><XAxis dataKey="name" tick={{ fontSize:11 }}/><YAxis allowDecimals={false} tick={{ fontSize:11 }}/><Tooltip contentStyle={{ fontSize:12,borderRadius:8 }}/><Bar dataKey="count" name="Reviews" radius={[4,4,0,0]}>{ratingDist.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></div></>}
      {lab.tags?.length>0&&<><Divider label="Tags"/><div className="flex flex-wrap gap-[5px]">{lab.tags.map(t=><Chip key={t} color="#6366f1">{t}</Chip>)}</div></>}
    </div>
  );
};

// ─── Tests Tab ────────────────────────────────────────────────────────────────

const TestsTab = ({ lab, dispatch, actionLoading }) => {
  const [search,setSearch]=useState('');
  const [confirm,setConfirm]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [editTarget,setEditTarget]=useState(null);
  const tests=(lab.labTests??[]).filter(t=>!search||t.testName?.toLowerCase().includes(search.toLowerCase())||t.category?.toLowerCase().includes(search.toLowerCase()));
  const save=form=>{ editTarget?dispatch(adminUpdateLabTest({id:lab._id,testId:editTarget._id,...form})):dispatch(adminAddLabTest({id:lab._id,...form})); setShowForm(false); setEditTarget(null); };
  return (
    <div className="p-[22px]">
      <div className="flex items-center gap-[9px] mb-[14px]">
        <div className="relative flex-1"><Search size={12} className="absolute left-[9px] top-[50%] text-[#9ca3af]" style={{ transform: 'translateY(-50%)' }}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tests…" className="pl-[26px] pt-[7px] pb-[7px]" style={{ ...inp }}/></div>
        <span className="text-[12px] text-[#9ca3af] whitespace-nowrap">{tests.length} tests</span>
        <Btn label="Add Test" icon={Plus} variant="solid" size="sm" onClick={()=>{setEditTarget(null);setShowForm(true);}}/>
      </div>
      <div className="flex flex-col gap-[7px]">
        {tests.map(t=>(
          <motion.div key={t._id} initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }}
            className="py-[11px] px-[13px] bg-base-200 rounded-[9px] border border-base-300" style={{ opacity: t.isActive?1:.55 }}>
            <div className="flex items-start justify-between gap-[9px]">
              <div className="flex-1">
                <div className="flex items-center gap-[6px] flex-wrap">
                  <span className="text-[13px] font-bold text-base-content">{t.testName}</span>
                  {t.testCode&&<Chip color="#9ca3af">{t.testCode}</Chip>}{!t.isActive&&<Chip color="#ef4444">Inactive</Chip>}
                </div>
                <div className="flex gap-[9px] mt-[3px] flex-wrap">
                  {t.category&&<span className="text-[11px] text-[#9ca3af]">{t.category}</span>}{t.sampleType&&<span className="text-[11px] text-[#9ca3af]">{t.sampleType}</span>}{t.turnaroundHours&&<span className="text-[11px] text-[#9ca3af]">{t.turnaroundHours}h TAT</span>}{t.homeCollectionAvailable&&<Chip color="#10b981">Home</Chip>}
                </div>
              </div>
              <div className="text-right shrink-0"><div className="text-[14px] font-extrabold text-[#7c3aed]">₹{t.mrpPrice}</div>{t.partnerPrice&&<div className="text-[10px] text-[#9ca3af]">Partner: ₹{t.partnerPrice}</div>}</div>
            </div>
            <div className="flex gap-[6px] mt-[8px] justify-end">
              <Btn label="Edit" icon={Edit3} size="sm" variant="primary" onClick={()=>{setEditTarget(t);setShowForm(true);}}/>
              <Btn label={t.isActive?'Deactivate':'Activate'} icon={t.isActive?PauseCircle:PlayCircle} size="sm" variant={t.isActive?'warning':'success'} onClick={()=>dispatch(adminUpdateLabTest({id:lab._id,testId:t._id,isActive:!t.isActive}))}/>
              <Btn label="Remove" icon={Trash2} size="sm" variant="danger" onClick={()=>setConfirm({testId:t._id})}/>
            </div>
          </motion.div>
        ))}
        {tests.length===0&&<div className="text-center p-[32px] text-[#9ca3af] text-[13px]">No tests found.</div>}
      </div>
      <TestFormModal open={showForm} onClose={()=>{setShowForm(false);setEditTarget(null);}} onSave={save} initial={editTarget} actionLoading={actionLoading}/>
      <ConfirmModal open={!!confirm} title="Deactivate Test" message="Soft-deactivate this test?" variant="danger"
        onConfirm={()=>{dispatch(adminDeleteLabTest({id:lab._id,testId:confirm.testId}));setConfirm(null);}} onCancel={()=>setConfirm(null)}/>
    </div>
  );
};

// ─── Packages Tab ─────────────────────────────────────────────────────────────

const PackagesTab = ({ lab, dispatch, actionLoading }) => {
  const [confirm,setConfirm]=useState(null); const [showForm,setShowForm]=useState(false); const [editTarget,setEditTarget]=useState(null);
  const save=form=>{ editTarget?dispatch(adminUpdateLabPackage({id:lab._id,pkgId:editTarget._id,...form})):dispatch(adminAddLabPackage({id:lab._id,...form})); setShowForm(false); setEditTarget(null); };
  return (
    <div className="p-[22px]">
      <div className="flex justify-end mb-[12px]"><Btn label="Add Package" icon={Plus} variant="solid" size="sm" onClick={()=>{setEditTarget(null);setShowForm(true);}}/></div>
      <div className="flex flex-col gap-[9px]">
        {(lab.labPackages??[]).map(p=>(
          <motion.div key={p._id} initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }}
            className="py-[12px] px-[13px] bg-base-200 rounded-[11px] border border-base-300" style={{ opacity: p.isActive?1:.55 }}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-[6px] flex-wrap"><span className="text-[13px] font-bold text-base-content">{p.packageName}</span>{p.packageCode&&<Chip color="#6366f1">{p.packageCode}</Chip>}{!p.isActive&&<Chip color="#ef4444">Inactive</Chip>}</div>
                {p.description&&<p className="mt-[3px] mx-[0px] mb-[0px] text-[12px] text-[#6b7280] leading-[1.5]">{p.description}</p>}
                {p.validUntil&&<div className="text-[11px] text-[#9ca3af] mt-[2px]">Valid: {new Date(p.validUntil).toLocaleDateString('en-IN')}</div>}
              </div>
              <div className="text-right shrink-0"><div className="text-[15px] font-extrabold text-[#7c3aed]">₹{p.mrpPrice}</div>{p.partnerPrice&&<div className="text-[10px] text-[#9ca3af]">Partner: ₹{p.partnerPrice}</div>}</div>
            </div>
            <div className="flex gap-[6px] mt-[8px] justify-end">
              <Btn label="Edit" icon={Edit3} size="sm" variant="primary" onClick={()=>{setEditTarget(p);setShowForm(true);}}/>
              <Btn label={p.isActive?'Deactivate':'Activate'} icon={p.isActive?PauseCircle:PlayCircle} size="sm" variant={p.isActive?'warning':'success'} onClick={()=>dispatch(adminUpdateLabPackage({id:lab._id,pkgId:p._id,isActive:!p.isActive}))}/>
              <Btn label="Remove" icon={Trash2} size="sm" variant="danger" onClick={()=>setConfirm({pkgId:p._id})}/>
            </div>
          </motion.div>
        ))}
        {!(lab.labPackages??[]).length&&<div className="text-center p-[32px] text-[#9ca3af] text-[13px]">No packages configured.</div>}
      </div>
      <PkgFormModal open={showForm} onClose={()=>{setShowForm(false);setEditTarget(null);}} onSave={save} initial={editTarget} actionLoading={actionLoading}/>
      <ConfirmModal open={!!confirm} title="Deactivate Package" message="Soft-deactivate this package?" variant="danger"
        onConfirm={()=>{dispatch(adminDeleteLabPackage({id:lab._id,pkgId:confirm.pkgId}));setConfirm(null);}} onCancel={()=>setConfirm(null)}/>
    </div>
  );
};

// ─── Documents Tab ────────────────────────────────────────────────────────────

const DocRow = ({ doc, type, onVerify }) => (
  <div className="py-[10px] px-[13px] bg-base-200 rounded-[9px] mb-[7px]" style={{ border: `1px solid ${doc.isVerified?'rgba(16,185,129,0.2)':'var(--base-300,#e5e7eb)'}` }}>
    <div className="flex items-start justify-between gap-[9px]">
      <div className="flex-1">
        <div className="flex items-center gap-[6px] flex-wrap"><span className="text-[13px] font-bold text-base-content">{doc.docType??doc.body}</span>{doc.isVerified?<Chip color="#059669">Verified</Chip>:<Chip color="#f59e0b">Pending</Chip>}</div>
        {(doc.docNumber||doc.certificateNo)&&<div className="text-[11px] text-[#9ca3af] mt-[2px]">#{doc.docNumber??doc.certificateNo}</div>}
        <div className="flex gap-[9px] mt-[3px] flex-wrap">
          {doc.issuedOn&&<span className="text-[11px] text-[#9ca3af]">Issued: {new Date(doc.issuedOn).toLocaleDateString('en-IN')}</span>}
          {doc.validUntil&&<span className="text-[11px]" style={{ color: new Date(doc.validUntil)<new Date()?'#ef4444':'#9ca3af' }}>Expires: {new Date(doc.validUntil).toLocaleDateString('en-IN')}</span>}
        </div>
        {doc.remarks&&<div className="text-[11px] text-[#6b7280] mt-[2px]" style={{ fontStyle: 'italic' }}>{doc.remarks}</div>}
      </div>
      <div className="flex flex-col gap-[5px] items-end">
        {doc.documentUrl&&<a href={doc.documentUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#7c3aed] no-underline flex items-center gap-[3px] font-semibold"><ArrowUpRight size={11}/>View</a>}
        {!doc.isVerified&&<Btn label="Verify" icon={ShieldCheck} size="sm" variant="success" onClick={()=>onVerify(doc._id,type)}/>}
      </div>
    </div>
  </div>
);

const DocumentsTab = ({ lab, dispatch, actionLoading }) => {
  const [showAccr,setShowAccr]=useState(false); const [showComp,setShowComp]=useState(false);
  const verify=(docId,collection)=>dispatch(adminVerifyLabDoc({id:lab._id,docId,docCollection:collection}));
  return (
    <div className="p-[22px]">
      <div className="flex items-center justify-between"><Divider label="Accreditations"/><Btn label="Add" icon={Plus} size="sm" variant="primary" onClick={()=>setShowAccr(true)}/></div>
      {(lab.accreditations??[]).length>0?lab.accreditations.map(a=><DocRow key={a._id} doc={a} type="accreditations" onVerify={verify}/>):<div className="text-[13px] text-[#9ca3af] pb-[8px]">No accreditations on file.</div>}
      <div className="flex items-center justify-between"><Divider label="Compliance Documents"/><Btn label="Add" icon={Plus} size="sm" variant="primary" onClick={()=>setShowComp(true)}/></div>
      {(lab.complianceDocs??[]).length>0?lab.complianceDocs.map(d=><DocRow key={d._id} doc={d} type="complianceDocs" onVerify={verify}/>):<div className="text-[13px] text-[#9ca3af] pb-[8px]">No compliance docs on file.</div>}
      <Divider label="Bank Details"/>
      {lab.bankDetails?(
        <div className="py-[12px] px-[15px] bg-base-200 rounded-[11px]" style={{ border: `1px solid ${lab.bankDetails.isVerified?'rgba(16,185,129,0.2)':'var(--base-300,#e5e7eb)'}` }}>
          <div className="flex justify-between items-start">
            <div><div className="text-[14px] font-bold mb-[7px] text-base-content">{lab.bankDetails.accountHolderName} <span className="ml-[5px]">{lab.bankDetails.isVerified?<Chip color="#059669">Verified</Chip>:<Chip color="#f59e0b">Unverified</Chip>}</span></div>
              <InfoRow label="Bank" value={lab.bankDetails.bankName} icon={Building2}/><InfoRow label="IFSC" value={lab.bankDetails.ifscCode} icon={TagIcon}/><InfoRow label="Branch" value={lab.bankDetails.branchName} icon={MapPin}/><InfoRow label="Type" value={lab.bankDetails.accountType} icon={CreditCard}/>{lab.bankDetails.upiId&&<InfoRow label="UPI" value={lab.bankDetails.upiId} icon={Zap}/>}
            </div>
            {!lab.bankDetails.isVerified&&<Btn label="Verify Bank" icon={ShieldCheck} variant="success" onClick={()=>dispatch(adminVerifyLabBank(lab._id))}/>}
          </div>
        </div>
      ):<div className="text-[13px] text-[#9ca3af]">No bank details provided.</div>}
      <AccrModal  open={showAccr} onClose={()=>setShowAccr(false)} actionLoading={actionLoading} onSave={f=>{dispatch(adminAddLabAccreditation({id:lab._id,...f}));setShowAccr(false);}}/>
      <CompModal  open={showComp} onClose={()=>setShowComp(false)} actionLoading={actionLoading} onSave={f=>{dispatch(adminAddLabComplianceDoc({id:lab._id,...f}));setShowComp(false);}}/>
    </div>
  );
};

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

const ReviewsTab = ({ lab, reviews, dispatch }) => {
  useEffect(()=>{ if(lab?._id) dispatch(adminFetchLabReviews(lab._id)); },[lab?._id,dispatch]);
  const all=reviews?.length?reviews:(lab.reviews??[]);
  return (
    <div className="p-[22px]">
      <div className="flex items-center gap-[14px] py-[11px] px-[14px] bg-[linear-gradient(135deg,rgba(124,58,237,0.05),rgba(79,70,229,0.02))] rounded-[11px] mb-[16px] border border-[rgba(124,58,237,0.1)]">
        <div className="text-center"><div className="text-[28px] font-extrabold text-[#7c3aed]">{lab.averageRating?.toFixed(1)??'—'}</div><div className="text-[10px] text-[#9ca3af]">Avg</div></div>
        <div className="flex-1">{[5,4,3,2,1].map(n=>{ const count=all.filter(r=>Math.round(r.rating)===n).length; const pct=all.length?(count/all.length)*100:0; return(<div key={n} className="flex items-center gap-[6px] mb-[3px]"><span className="text-[10px] text-[#9ca3af] w-[12px] text-right">{n}</span><Star size={9} color="#f59e0b" fill="#f59e0b"/><div className="flex-1 h-[5px] rounded-[3px] bg-base-300 overflow-hidden"><div className="h-full bg-[#f59e0b] rounded-[3px]" style={{ width: `${pct}%`, transition: 'width .4s' }}/></div><span className="text-[10px] text-[#9ca3af] w-[16px]">{count}</span></div>); })}</div>
        <div className="text-center"><div className="text-[19px] font-extrabold text-base-content">{lab.totalReviews??0}</div><div className="text-[10px] text-[#9ca3af]">Total</div></div>
      </div>
      <div className="flex flex-col gap-[8px]">
        {all.map(r=>(
          <motion.div key={r._id} initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="py-[10px] px-[13px] bg-base-200 rounded-[9px] border border-base-300" style={{ opacity: r.isVisible?1:.5 }}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-[6px]"><div className="flex gap-[2px]">{[1,2,3,4,5].map(n=><Star key={n} size={11} fill={n<=r.rating?'#f59e0b':'none'} color={n<=r.rating?'#f59e0b':'#d1d5db'}/>)}</div>{!r.isVisible&&<Chip color="#9ca3af">Hidden</Chip>}<span className="text-[11px] text-[#9ca3af]">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span></div>
                {r.comment&&<p className="mt-[4px] mx-[0px] mb-[0px] text-[13px] text-base-content leading-[1.5]">{r.comment}</p>}
                {r.user?.name&&<div className="text-[11px] text-[#9ca3af] mt-[2px]">— {r.user.name}</div>}
              </div>
              <div className="flex gap-[5px] shrink-0">
                <Btn label={r.isVisible?'Hide':'Show'} icon={r.isVisible?EyeOff:Eye} size="sm" variant="warning" onClick={()=>dispatch(adminToggleReviewVisibility({id:lab._id,reviewId:r._id}))}/>
                <Btn label="Delete" icon={Trash2} size="sm" variant="danger" onClick={()=>dispatch(adminDeleteLabReview({id:lab._id,reviewId:r._id}))}/>
              </div>
            </div>
          </motion.div>
        ))}
        {all.length===0&&<div className="text-center p-[32px] text-[#9ca3af] text-[13px]">No reviews yet.</div>}
      </div>
    </div>
  );
};

// ─── Financial Tab ────────────────────────────────────────────────────────────

const FinancialTab = ({ lab, dispatch }) => {
  const [showFee,setShowFee]=useState(false);
  return (
    <div className="p-[22px]">
      <div className="grid grid-cols-[1fr_1fr] gap-[11px] mb-[18px]">
        <StatCard label="Commission Rate"  value={`${lab.commissionRate??0}%`}  icon={TrendingUp} color="#7c3aed"/>
        <StatCard label="Payout Frequency" value={lab.payoutFrequency??'—'}     icon={Clock}      color="#4f46e5"/>
        <StatCard label="Fee Type"         value={lab.platformFee?.type??'Global Default'} icon={CreditCard} color="#10b981"/>
        <StatCard label="Fee Value"        value={lab.platformFee?(lab.platformFee.type==='percentage'?`${lab.platformFee.value}%`:`₹${lab.platformFee.value}`):'—'} icon={Wallet} color="#f59e0b"/>
      </div>
      <Divider label="Platform Fee Override"/>
      <div className="py-[13px] px-[16px] bg-base-200 rounded-[11px] border border-base-300 mb-[18px]">
        <p className="mt-[0px] mx-[0px] mb-[10px] text-[13px] text-[#6b7280] leading-[1.6]">{lab.platformFee?`Custom override: ${lab.platformFee.type} — ${lab.platformFee.type==='percentage'?`${lab.platformFee.value}%`:`₹${lab.platformFee.value}`}. Remove to revert to global config.`:'No override. Using global pricing config.'}</p>
        <Btn label={lab.platformFee?'Edit Override':'Set Override'} icon={Edit3} variant="primary" onClick={()=>setShowFee(true)}/>
      </div>
      <Divider label="Status Log"/>
      <div className="flex flex-col gap-[6px]">
        {(lab.statusLog??[]).slice().reverse().map(log=>{ const cfg=STATUS_CFG[log.toStatus]??{}; return(<div key={log._id} className="py-[8px] px-[11px] bg-base-200 rounded-[7px] border border-base-300 flex items-start gap-[8px]"><div className="w-[6px] h-[6px] rounded-[50%] mt-[4px] shrink-0" style={{ background: cfg.color??'#9ca3af' }}/><div className="flex-1"><div className="text-[12px] font-bold text-base-content">{log.fromStatus??'(new)'} → {log.toStatus}</div>{log.reason&&<div className="text-[11px] text-[#9ca3af] mt-[1px]">{log.reason}</div>}<div className="text-[11px] text-[#9ca3af] mt-[1px]">{new Date(log.changedAt).toLocaleString('en-IN')}</div></div></div>); })}
        {!lab.statusLog?.length&&<div className="text-[13px] text-[#9ca3af]">No status changes logged.</div>}
      </div>
      <FeeModal open={showFee} current={lab.platformFee}
        onSave={({type,value})=>{dispatch(adminSetLabPlatformFee({id:lab._id,type,value}));setShowFee(false);}}
        onRemove={()=>{dispatch(adminRemoveLabPlatformFee(lab._id));setShowFee(false);}}
        onClose={()=>setShowFee(false)}/>
    </div>
  );
};

// ─── Control Panel ────────────────────────────────────────────────────────────

const ControlPanel = ({ lab, dispatch, isSuperAdmin, onNotif }) => {
  const [modal,setModal]=useState(null);
  const SA = {
    pending:      [{ action:'under_review',label:'Mark Under Review',icon:Eye,variant:'primary' },{ action:'reject',label:'Reject',icon:XCircle,variant:'danger',reason:true }],
    under_review: [...(isSuperAdmin?[{ action:'approve',label:'Approve Lab',icon:CheckCircle2,variant:'success' }]:[]),{ action:'reject',label:'Reject',icon:XCircle,variant:'danger',reason:true }],
    approved:     [{ action:'suspend',label:'Suspend',icon:PauseCircle,variant:'danger',reason:true },{ action:'deactivate',label:'Deactivate',icon:Ban,variant:'warning' }],
    suspended:    [{ action:'reactivate',label:'Reactivate',icon:PlayCircle,variant:'success' }],
    rejected:     [{ action:'under_review',label:'Re-Review',icon:RotateCcw,variant:'primary' }],
    deactivated:  [{ action:'reactivate',label:'Reactivate',icon:PlayCircle,variant:'success' }],
  };
  const actions=SA[lab.status]??[];
  return (
    <>
      <div className="py-[12px] px-[16px] bg-base-100 border-t border-base-300 shrink-0">
        <div className="text-[10px] font-bold text-[#9ca3af] tracking-[.07em] uppercase mb-[8px]">Actions</div>
        <div className="flex flex-wrap gap-[6px]">
          {actions.map(a=><Btn key={a.action} label={a.label} icon={a.icon} variant={a.variant} onClick={()=>setModal({action:a.action,requireReason:!!a.reason})}/>)}
          <Btn label="Send Notification" icon={Bell} variant="primary" onClick={onNotif}/>
          {isSuperAdmin&&<Btn label="Resend Credentials" icon={Send} variant="warning" onClick={()=>setModal({action:'__resend',requireReason:false})}/>}
        </div>
      </div>
      <ConfirmModal
        open={!!modal&&modal.action!=='__resend'}
        title={`Confirm: ${modal?.action}`}
        message={`Are you sure you want to ${modal?.action} this lab?`}
        requireReason={modal?.requireReason}
        variant={['approve','reactivate'].includes(modal?.action)?'success':'danger'}
        onConfirm={reason=>{dispatch(adminChangeLabStatus({id:lab._id,action:modal.action,reason}));setModal(null);}}
        onCancel={()=>setModal(null)}/>
      <ConfirmModal
        open={!!modal&&modal.action==='__resend'}
        title="Resend Credentials"
        message="Generate a new password and email it to the lab partner?"
        variant="warning"
        onConfirm={()=>{dispatch(adminResendLabCredentials(lab._id));setModal(null);}}
        onCancel={()=>setModal(null)}/>
    </>
  );
};

// ─── Right Panel ──────────────────────────────────────────────────────────────

const LabDetailPanel = ({ lab, loading, dispatch, isSuperAdmin, reviews, actionLoading, onRefresh }) => {
  const [activeTab,setActiveTab]=useState('overview');
  const [showNotif,setShowNotif]=useState(false);
  const [showEdit, setShowEdit] =useState(false);
  useEffect(()=>{ setActiveTab('overview'); },[lab?._id]);

  if (loading&&!lab) return <div className="flex-1 flex items-center justify-center flex-col gap-[10px] text-[#9ca3af]"><div className="w-[30px] h-[30px] rounded-[50%] border-[3px] border-[rgba(124,58,237,0.2)]" style={{ borderTopColor: '#7c3aed', animation: 'spin .8s linear infinite' }}/><span className="text-[13px]">Loading…</span></div>;
  if (!lab) return <div className="flex-1 flex items-center justify-center flex-col gap-[9px] text-[#9ca3af]"><FlaskConical size={44} strokeWidth={1} color="rgba(124,58,237,0.22)"/><div className="text-[14px] font-semibold text-base-content">Select a lab to view details</div><div className="text-[12px]">Choose from the list on the left</div></div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-[2px] pt-[8px] px-[13px] pb-[0px] border-b border-base-300 bg-base-100 overflow-x-auto shrink-0">
        {TABS.map(tab=>{ const I=tab.icon; const isA=activeTab===tab.id; return <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className="flex items-center gap-[5px] py-[7px] px-[12px] border-none bg-[transparent] cursor-pointer text-[12px] whitespace-nowrap mb-[-1px]" style={{ fontWeight: isA?700:500, color: isA?'#7c3aed':'var(--base-content,#6b7280)', borderBottom: isA?'2px solid #7c3aed':'2px solid transparent', transition: 'all .15s' }}><I size={12} strokeWidth={isA?2.5:2}/>{tab.label}</button>; })}
      </div>
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity:0,y:5 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-5 }} transition={{ duration:.12 }}>
            {activeTab==='overview'  && <OverviewTab  lab={lab} onEdit={()=>setShowEdit(true)}/>}
            {activeTab==='tests'     && <TestsTab     lab={lab} dispatch={dispatch} actionLoading={actionLoading}/>}
            {activeTab==='packages'  && <PackagesTab  lab={lab} dispatch={dispatch} actionLoading={actionLoading}/>}
            {activeTab==='documents' && <DocumentsTab lab={lab} dispatch={dispatch} actionLoading={actionLoading}/>}
            {activeTab==='reviews'   && <ReviewsTab   lab={lab} reviews={reviews}   dispatch={dispatch}/>}
            {activeTab==='financial' && <FinancialTab lab={lab} dispatch={dispatch}/>}
          </motion.div>
        </AnimatePresence>
      </div>
      <ControlPanel lab={lab} dispatch={dispatch} isSuperAdmin={isSuperAdmin} onNotif={()=>setShowNotif(true)}/>
      <NotifModal open={showNotif} onSend={f=>{dispatch(adminSendLabNotification({id:lab._id,...f}));setShowNotif(false);}} onClose={()=>setShowNotif(false)}/>
      <LabFormModal open={showEdit} onClose={()=>setShowEdit(false)} initial={lab} actionLoading={actionLoading}
        onSave={payload=>{ dispatch(adminUpdateLab({id:lab._id,...payload})).then(()=>{ setShowEdit(false); onRefresh(); }); }}/>
    </div>
  );
};

// ─── Stats Header ─────────────────────────────────────────────────────────────

const StatsHeader = ({ stats }) => {
  if (!stats) return null;
  const items=[
    { label:'Total',     value:stats.totalLabs,              icon:FlaskConical, color:'#7c3aed' },
    { label:'Active',    value:stats.activeLabs,             icon:Activity,     color:'#10b981' },
    { label:'Featured',  value:stats.featuredLabs,           icon:Zap,          color:'#f59e0b' },
    { label:'Approved',  value:stats.byStatus?.approved??0,  icon:CheckCircle2, color:'#059669' },
    { label:'Pending',   value:stats.byStatus?.pending??0,   icon:Clock,        color:'#f59e0b' },
    { label:'Suspended', value:stats.byStatus?.suspended??0, icon:PauseCircle,  color:'#ef4444' },
  ];
  return (
    <div className="grid grid-cols-[repeat(6,1fr)] gap-[8px] py-[11px] px-[16px] border-b border-base-300 shrink-0">
      {items.map(item=>(
        <div key={item.label} className="bg-base-200 rounded-[8px] py-[8px] px-[11px] border border-base-300">
          <div className="flex items-center gap-[4px] mb-[3px]"><item.icon size={10} color={item.color} strokeWidth={2.5}/><span className="text-[9px] text-[#9ca3af] font-bold uppercase tracking-[.05em]">{item.label}</span></div>
          <div className="text-[18px] font-extrabold text-base-content">{item.value??0}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LabManagement() {
  const dispatch      = useDispatch();
  const user          = useSelector(s => s.user?.user) ?? null;
  const labs          = useSelector(selectAdminLabs);
  const selectedLab   = useSelector(selectAdminSelectedLab);
  const stats         = useSelector(selectAdminStats);
  const pagination    = useSelector(selectAdminPagination);
  const reviews       = useSelector(selectAdminReviews);
  const loading       = useSelector(selectLabLoading);
  const actionLoading = useSelector(selectLabActionLoading);
  const isSuperAdmin  = user?.role === 'superadmin';

  const [page,           setPage]          = useState(1);
  const [filterStatus,   setFilterStatus]  = useState('');
  const [selectedId,     setSelectedId]    = useState(null);
  const [searchDebounce, setSearchDebounce]= useState('');
  const [search,         setSearch]        = useState('');
  const [showCreate,     setShowCreate]    = useState(false);

  useEffect(()=>{ dispatch(adminFetchLabStats()); },[dispatch]);

  useEffect(()=>{
    const p={ page,limit:20 };
    if (search)       p.search=search;
    if (filterStatus) p.status=filterStatus;
    dispatch(adminFetchLabs(p));
  },[dispatch,page,search,filterStatus]);

  useEffect(()=>{ const t=setTimeout(()=>{ setSearch(searchDebounce); setPage(1); },380); return()=>clearTimeout(t); },[searchDebounce]);

  const handleSelect=useCallback(id=>{ setSelectedId(id); dispatch(adminFetchLabById(id)); },[dispatch]);

  const handleRefresh=()=>{
    dispatch(adminFetchLabStats());
    const p={ page,limit:20 };
    if (search)       p.search=search;
    if (filterStatus) p.status=filterStatus;
    dispatch(adminFetchLabs(p));
    if (selectedId) dispatch(adminFetchLabById(selectedId));
  };

  const handleCreate=payload=>{
    dispatch(adminCreateLab(payload)).then(res=>{ if(!res.error){ setShowCreate(false); handleRefresh(); } });
  };

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(124,58,237,.2);border-radius:4px}::-webkit-scrollbar-thumb:hover{background:rgba(124,58,237,.4)}`}</style>

      <div data-theme="admin" className="flex flex-col h-[100vh] bg-base-100 text-base-content overflow-hidden" style={{ fontFamily: 'var(--font-family-poppins,"Poppins",system-ui,sans-serif)' }}>

        {/* Header */}
        <div className="flex items-center justify-between py-[11px] px-[16px] border-b border-base-300 bg-base-100 shrink-0 gap-[12px]">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-[linear-gradient(135deg,#7c3aed,#4f46e5)] flex items-center justify-center"><FlaskConical size={16} color="#fff" strokeWidth={2.5}/></div>
            <div><h1 className="m-[0px] text-[16px] font-extrabold text-base-content">Lab Management</h1><div className="text-[10px] text-[#9ca3af]">{isSuperAdmin?'Superadmin':'Admin'} · {user?.name??'Administrator'}</div></div>
          </div>
          <div className="flex items-center gap-[8px]">
            {actionLoading&&<div className="flex items-center gap-[5px] text-[12px] text-[#7c3aed]"><div className="w-[12px] h-[12px] rounded-[50%] border-[2px] border-[rgba(124,58,237,.2)]" style={{ borderTopColor: '#7c3aed', animation: 'spin .7s linear infinite' }}/>Processing…</div>}
            <Btn label="Refresh" icon={RefreshCw} onClick={handleRefresh}/>
          </div>
        </div>

        <StatsHeader stats={stats}/>

        {/* Split */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[294px] shrink-0 border-r border-base-300 flex flex-col overflow-hidden">
            <LabListPanel labs={labs} selectedId={selectedId} onSelect={handleSelect} loading={loading} pagination={pagination}
              onPageChange={setPage} onSearch={setSearchDebounce} searchVal={searchDebounce}
              onFilter={s=>{setFilterStatus(s);setPage(1);}} filterStatus={filterStatus} onCreateLab={()=>setShowCreate(true)}/>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <LabDetailPanel lab={selectedLab} loading={loading} dispatch={dispatch} isSuperAdmin={isSuperAdmin}
              reviews={reviews} actionLoading={actionLoading} onRefresh={handleRefresh}/>
          </div>
        </div>
      </div>

      {/* Create Lab Modal (outside layout so it overlays correctly) */}
      <LabFormModal open={showCreate} onClose={()=>setShowCreate(false)} onSave={handleCreate} actionLoading={actionLoading}/>
    </>
  );
}