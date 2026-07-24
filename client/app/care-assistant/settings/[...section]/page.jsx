"use client";

/**
 * Settings & Preferences Page — corrected with [data-theme="care-assistant"]
 * Route: app/care-assistant/settings/[[...section]]/page.jsx
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, MapPin, Smartphone, Mail, Phone, Send, CheckCircle2,
  AlertCircle, Loader2, Save, X, Plus, Trash2, Wifi, WifiOff,
  Monitor, Tablet, Navigation, Info, SlidersHorizontal, Tag,
} from "lucide-react";
import {
  getSettings, updateNotifPrefs, updateServiceArea,
  registerDeviceToken, removeDeviceToken,
  selectSettings, selectProfile, selectLoading, selectErrors, clearError, getProfile,
} from "@/store/slices/careAssistantSlice";
import BackButton from "../../../../components/BackButton";

const links = [
  { name:"Notifications", href:"/care-assistant/settings/notifications", segments:["notifications"], icon:<Bell size={16}/>, note:"Control how and when Likeson contacts you" },
  { name:"Service Area",  href:"/care-assistant/settings/service-area",  segments:["service-area"],  icon:<MapPin size={16}/>, note:"Set your preferred service zones and max travel radius" },
  { name:"Devices",       href:"/care-assistant/settings",               segments:[],                icon:<Smartphone size={16}/>, note:"Manage devices registered for push notifications" },
];

const matchSection = (params) => {
  const seg = params?.section ?? [];
  if (!seg || seg.length === 0)    return "devices";
  if (seg[0] === "notifications")  return "notifications";
  if (seg[0] === "service-area")   return "service-area";
  return "devices";
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────
const NOTIF_CHANNELS = [
  { key:"push",      label:"Push Notifications", note:"Booking alerts, reminders & status updates on your phone",           icon:<Bell size={18}/>,  color:"var(--primary)" },
  { key:"sms",       label:"SMS Alerts",          note:"Critical booking confirmations sent as text messages",               icon:<Phone size={18}/>, color:"var(--success)" },
  { key:"email",     label:"Email Notifications", note:"Weekly summaries, KYC updates & payout receipts",                   icon:<Mail size={18}/>,  color:"var(--info)" },
  { key:"whatsapp",  label:"WhatsApp Messages",   note:"Booking details & patient info sent via WhatsApp",                  icon:<Send size={18}/>,  color:"var(--secondary)" },
];

function NotificationsSection({ settings, dispatch, loading }) {
  const notifPrefs = settings?.notifPrefs ?? {};
  const [local, setLocal] = useState({});
  const [saved, setSaved] = useState(false);

  const toggle = (key) => setLocal((p) => ({ ...p, [key]: !(p[key] ?? notifPrefs[key] ?? true) }));
  const hasChanges = Object.keys(local).length > 0;

  const handleSave = async () => {
    const res = await dispatch(updateNotifPrefs(local));
    if (!res.error) {
      setLocal({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      dispatch(getSettings());
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="glass-card p-4">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0 text-info" />
          <p className="text-xs text-base-content opacity-65">
            At least one channel must remain active to receive booking assignments. SMS cannot be
            fully disabled for safety alerts.
          </p>
        </div>
      </div>

      {NOTIF_CHANNELS.map((ch, i) => {
        const val = local[ch.key] ?? notifPrefs[ch.key] ?? true;
        return (
          <motion.div
            key={ch.key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="card p-4 flex items-center gap-4 cursor-pointer select-none"
            style={{ borderColor: val ? ch.color : "transparent" }}
            onClick={() => toggle(ch.key)}
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${ch.color}, transparent 82%)`, color: ch.color }}
            >
              {ch.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-base-content">{ch.label}</p>
              <p className="text-[11px] mt-0.5 leading-relaxed text-base-content opacity-52">
                {ch.note}
              </p>
            </div>
            <div
              className="w-12 h-6 rounded-full relative transition-colors duration-300 shrink-0"
              style={{ background: val ? ch.color : "var(--base-300)" }}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                animate={{ left: val ? "calc(100% - 20px)" : "4px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          </motion.div>
        );
      })}

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="sticky bottom-4"
          >
            <button
              onClick={handleSave}
              disabled={loading.settings}
              className="btn-primary-cta w-full flex items-center justify-center gap-2"
            >
              {loading.settings ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {loading.settings ? "Saving…" : saved ? "Preferences Saved!" : "Save Preferences"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── SERVICE AREA ─────────────────────────────────────────────────────────
const VIJAYAWADA_AREAS = [
  "Benz Circle","Governorpet","Suryaraopet","Moghalrajpuram","Patamata",
  "Gunadala","Kanuru","Krishna Lanka","Auto Nagar","Vidyadharapuram",
  "Gollapudi","Gannavaram","Nunna","Ajit Singh Nagar","Vijayawada Old Town",
];

function ServiceAreaSection({ settings, dispatch, loading }) {
  const [areas, setAreas]         = useState(settings?.preferredServiceAreas ?? []);
  const [radius, setRadius]       = useState(settings?.maxServiceRadiusKm ?? 10);
  const [inputArea, setInputArea] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    if (settings) {
      setAreas(settings.preferredServiceAreas ?? []);
      setRadius(settings.maxServiceRadiusKm ?? 10);
    }
  }, [settings]);

  const handleAreaInput = (v) => {
    setInputArea(v);
    if (v.length > 1) {
      setSuggestions(
        VIJAYAWADA_AREAS.filter(
          (a) => a.toLowerCase().includes(v.toLowerCase()) && !areas.includes(a)
        ).slice(0, 5)
      );
    } else setSuggestions([]);
  };

  const addArea    = (area) => { if (!areas.includes(area) && areas.length < 10) setAreas((p) => [...p, area]); setInputArea(""); setSuggestions([]); };
  const removeArea = (area) => setAreas((p) => p.filter((a) => a !== area));

  const handleSave = async () => {
    const res = await dispatch(updateServiceArea({ preferredServiceAreas: areas, maxServiceRadiusKm: radius }));
    if (!res.error) { setSaved(true); setTimeout(() => setSaved(false), 2500); dispatch(getSettings()); }
  };

  const RADIUS_MARKS = [5, 10, 15, 20, 25, 30];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="glass-card p-4">
        <div className="flex items-start gap-2">
          <Navigation size={14} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-xs text-base-content opacity-65">
            Bookings are matched to your service areas first. If none match, the platform widens
            the search to your max radius. Add up to 10 preferred areas.
          </p>
        </div>
      </div>

      {/* radius slider */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-base-content">Max Travel Radius</p>
            <p className="text-[11px] mt-0.5 text-base-content opacity-50">
              Maximum distance you will travel from your current location for a booking
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-2xl font-black text-sm shrink-0 bg-[color-mix(in srgb, var(--primary), transparent 87%)] text-primary"
           
          >
            {radius} km
          </div>
        </div>
        <div className="relative pt-2">
          <input
            type="range" min={1} max={30} value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--primary) ${((radius - 1) / 29) * 100}%, var(--base-300) ${((radius - 1) / 29) * 100}%)`,
              accentColor: "var(--primary)",
            }}
          />
          <div className="flex justify-between mt-2">
            {RADIUS_MARKS.map((m) => (
              <button
                key={m}
                onClick={() => setRadius(m)}
                className="text-[10px] font-semibold"
                style={{ color: radius === m ? "var(--primary)" : "var(--base-content)", opacity: radius === m ? 1 : 0.4 }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* service areas */}
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-base-content">Preferred Areas</p>
          <p className="text-[11px] mt-0.5 text-base-content opacity-50">
            Areas where you prefer to take bookings — up to 10.
          </p>
        </div>

        {areas.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            {areas.map((a) => (
              <motion.span
                key={a}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[color-mix(in srgb, var(--secondary), transparent 85%)] text-secondary"
               
              >
                <Tag size={10} />{a}
                <button onClick={() => removeArea(a)} className="ml-0.5"><X size={11} /></button>
              </motion.span>
            ))}
          </div>
        )}

        {areas.length < 10 && (
          <div className="relative">
            <div className="relative flex items-center">
              <MapPin size={14} className="absolute left-3 text-base-content opacity-40" />
              <input
                type="text"
                value={inputArea}
                onChange={(e) => handleAreaInput(e.target.value)}
                placeholder="Search area (e.g. Benz Circle)"
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                className="input-field w-full pl-9"
              />
              {inputArea && (
                <button
                  className="absolute right-3 text-base-content opacity-40"
                  onClick={() => { setInputArea(""); setSuggestions([]); }}
                 
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-30 left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-lg bg-base-200 border border-base-300"
                 
                >
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => addArea(s)}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2 transition-colors text-base-content"
                     
                    >
                      <Plus size={12} className="text-primary" />{s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {areas.length === 10 && (
          <p className="text-[11px] text-warning">
            Maximum 10 areas reached. Remove one to add another.
          </p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={loading.settings}
        className="btn-primary-cta w-full flex items-center justify-center gap-2"
      >
        {loading.settings ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
        {loading.settings ? "Saving…" : saved ? "Area Settings Saved!" : "Save Service Area"}
      </button>
    </motion.div>
  );
}

// ─── DEVICES ──────────────────────────────────────────────────────────────
const deviceIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("tablet") || n.includes("ipad")) return <Tablet size={18} />;
  if (n.includes("pc") || n.includes("windows") || n.includes("mac")) return <Monitor size={18} />;
  return <Smartphone size={18} />;
};

function DevicesSection({ settings, dispatch, loading, profile }) {
  const [newToken, setNewToken]     = useState("");
  const [tokenError, setTokenError] = useState("");

  const handleRegister = async () => {
    if (!newToken.trim()) { setTokenError("Token cannot be empty"); return; }
    const res = await dispatch(registerDeviceToken({ token: newToken.trim() }));
    if (!res.error) { setNewToken(""); setTokenError(""); }
  };

  const handleRemove = (token) => dispatch(removeDeviceToken({ token }));
  const tokens = profile?.deviceTokens ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0 text-info" />
          <p className="text-xs text-base-content opacity-65">
            Push notifications are sent to all registered devices. Remove devices you no longer use
            to keep your account secure.
          </p>
        </div>
      </div>

      {tokens.length === 0 ? (
        <div className="card p-6 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-base-200">
            <WifiOff size={24} className="text-base-content opacity-30" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-base-content">No devices registered</p>
            <p className="text-xs mt-1 text-base-content opacity-50">
              Devices are auto-registered when you log in via the mobile app
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token, i) => (
            <motion.div
              key={token}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-[color-mix(in srgb, var(--primary), transparent 85%)] text-primary"
               
              >
                {deviceIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Wifi size={11} className="text-success" />
                  <p className="text-[11px] font-semibold text-success">Active</p>
                </div>
                <p className="text-[11px] mt-0.5 font-mono truncate text-base-content opacity-45">
                  {token.slice(0, 24)}…
                </p>
              </div>
              <button
                onClick={() => handleRemove(token)}
                disabled={loading.settings}
                className="shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center transition-colors bg-[color-mix(in srgb, var(--error), transparent 88%)] text-error"
               
              >
                {loading.settings ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <div
        className="rounded-2xl p-4 space-y-3 bg-base-200 border border-dashed border-base-300"
       
      >
        <p className="text-xs font-semibold text-base-content opacity-60">
          Register device token manually
        </p>
        <p className="text-[11px] text-base-content opacity-40">
          In production, tokens are auto-captured on app login via Firebase.
        </p>
        <input
          type="text"
          value={newToken}
          onChange={(e) => { setNewToken(e.target.value); setTokenError(""); }}
          placeholder="Paste FCM token here"
          className={`input-field w-full text-xs font-mono ${tokenError ? "!border-[var(--error)]" : ""}`}
        />
        {tokenError && (
          <p className="text-[11px] flex items-center gap-1 text-error">
            <X size={11} /> {tokenError}
          </p>
        )}
        <button
          onClick={handleRegister}
          disabled={loading.settings}
          className="btn-secondary w-full flex items-center justify-center gap-2 !text-xs !py-2.5"
        >
          {loading.settings ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Register Token
        </button>
      </div>
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const params   = useParams();
  const dispatch = useDispatch();
  const settings = useSelector(selectSettings);
  const profile  = useSelector(selectProfile);
  const loading  = useSelector(selectLoading);
  const errors   = useSelector(selectErrors);

  const section = matchSection(params);

  useEffect(() => {
    if (!settings) dispatch(getSettings());
    if (!profile)  dispatch(getProfile());
  }, [dispatch, settings, profile]);

  const sectionTitle = {
    notifications: "Notification Preferences",
    "service-area":"Service Area",
    devices:       "Registered Devices",
  }[section];

  const sectionSubtitle = {
    notifications: "Choose how Likeson reaches you for bookings and updates",
    "service-area":"Define where you work and how far you'll travel",
    devices:       "Manage devices that receive your push notifications",
  }[section];

  const accentColor = {
    notifications: "var(--primary)",
    "service-area":"var(--secondary)",
    devices:       "var(--info)",
  }[section];

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">

      {/* ── sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                     <BackButton className='my-3' />
          
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accentColor }}>
            Settings & Preferences
          </p>
          <h1 className="!text-xl !font-black !leading-tight text-base-content">
            {sectionTitle}
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-50">
            {sectionSubtitle}
          </p>
        </motion.div>
      </div>

      {/* ── nav pills ── */}
      <div className="px-4 pt-4 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {links.map((l) => {
          const isActive =
            (section === "devices" && l.segments.length === 0) ||
            (section !== "devices" && l.segments[0] === section);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
              style={{
                background: isActive ? accentColor : `color-mix(in srgb, ${accentColor}, transparent 88%)`,
                color:      isActive ? "white" : accentColor,
              }}
            >
              {l.icon}{l.name}
            </Link>
          );
        })}
      </div>

      {/* ── active note ── */}
      <div className="px-4 mt-3">
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: `color-mix(in srgb, ${accentColor}, transparent 90%)` }}
        >
          <SlidersHorizontal size={12} style={{ color: accentColor }} />
          <p className="text-[11px]" style={{ color: accentColor }}>
            {links.find((l) =>
              (section === "devices" && l.segments.length === 0) ||
              (section !== "devices" && l.segments[0] === section)
            )?.note}
          </p>
        </div>
      </div>

      {/* ── server error ── */}
      <div className="px-4 mt-3">
        <AnimatePresence>
          {errors.settings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-error">
              <AlertCircle size={15} />
              <p className="text-xs flex-1">{errors.settings}</p>
              <button onClick={() => dispatch(clearError("settings"))}><X size={13} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── content ── */}
      <div className="px-4 py-5 pb-24">
        {loading.settings && !settings ? (
          <div className="space-y-3">
            {[1,2,3,4].map((i) => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {section === "notifications" && (
              <NotificationsSection key="notif" settings={settings} dispatch={dispatch} loading={loading} />
            )}
            {section === "service-area" && (
              <ServiceAreaSection key="area" settings={settings} dispatch={dispatch} loading={loading} />
            )}
            {section === "devices" && (
              <DevicesSection key="devices" settings={settings} dispatch={dispatch} loading={loading} profile={profile} />
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}