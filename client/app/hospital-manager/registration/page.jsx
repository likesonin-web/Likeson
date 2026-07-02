"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hospital,
  MapPin,
  Clock,
  ImageIcon,
  FileText,
  ChevronRight,
  Save,
  Upload,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Globe,
  Phone,
  Mail,
  Building2,
  Shield,
  Loader2,
  Eye,
  Camera,
  ExternalLink,
  Hash,
  Calendar,
  RefreshCw,
  Navigation,
  Search,
  Map,
} from "lucide-react";
import {
  fetchHospitalProfile,
  updateBasicProfile,
  updateLocation,
  uploadLogo,
  uploadGalleryImages,
  deleteGalleryImage,
  uploadLicenseDocument,
  fetchOperatingHours,
  updateOperatingHours,
  updateRegistration,
  selectHospital,
  selectOperatingHours,
  isLoading,
  getError,
} from "@/store/slices/hospitalManagerSlice";

// ─── Google Maps Loader ───────────────────────────────────────────────────────

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

let mapsLoaded = false;
let mapsLoading = false;
let mapsCallbacks = [];

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (mapsLoaded) return resolve(window.google);
    mapsCallbacks.push({ resolve, reject });
    if (mapsLoading) return;
    mapsLoading = true;

    window.__googleMapsCallback = () => {
      mapsLoaded = true;
      mapsLoading = false;
      mapsCallbacks.forEach(cb => cb.resolve(window.google));
      mapsCallbacks = [];
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsLoading = false;
      mapsCallbacks.forEach(cb => cb.reject(new Error("Google Maps failed to load")));
      mapsCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "profile",  label: "Hospital Profile", icon: Hospital  },
  { id: "location", label: "Location & GPS",   icon: MapPin    },
  { id: "hours",    label: "Operating Hours",  icon: Clock     },
  { id: "gallery",  label: "Gallery & Logo",   icon: ImageIcon },
  { id: "legal",    label: "Legal & Licenses", icon: FileText  },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const SPECIALTIES_OPTIONS = [
  "Cardiology","Neurology","Orthopedics","Oncology","Pediatrics",
  "Gynecology","Dermatology","General Medicine","Emergency Medicine",
  "Radiology","Gastroenterology","Urology","Psychiatry","Ophthalmology",
];

const ACCREDITATION_OPTIONS = ["NABH","NABL","JCI","ISO","AHPI","Other"];

const FACILITY_FLAGS = [
  { key: "isEmergencyReady",    label: "Emergency Ready",   icon: "🚑" },
  { key: "hasICU",              label: "ICU Available",     icon: "🏥" },
  { key: "hasBloodBank",        label: "Blood Bank",        icon: "🩸" },
  { key: "hasPharmacy",         label: "In-house Pharmacy", icon: "💊" },
  { key: "hasDiagnostics",      label: "Diagnostics Lab",   icon: "🔬" },
  { key: "hasAmbulance",        label: "Ambulance Service", icon: "🚐" },
  { key: "hasWheelchairAccess", label: "Wheelchair Access", icon: "♿" },
  { key: "is24x7",              label: "24×7 Open",         icon: "⏰" },
];

const DEFAULT_LAT = 16.506145;
const DEFAULT_LNG = 80.648018;

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

const FieldNote = ({ children }) => (
  <p className="mt-1.5 text-xs text-[var(--base-content)]/50 flex items-start gap-1">
    <Info size={11} className="mt-0.5 shrink-0 text-[var(--primary)]/60" />
    <span>{children}</span>
  </p>
);

const SectionHeader = ({ title, subtitle, icon: Icon }) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
        <Icon size={20} className="text-[var(--primary)]" />
      </div>
      <h2 className="text-xl font-bold text-[var(--base-content)] font-montserrat tracking-tight">{title}</h2>
    </div>
    {subtitle && <p className="text-sm text-[var(--base-content)]/55 ml-13">{subtitle}</p>}
  </div>
);

const Label = ({ children, required }) => (
  <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--base-content)]/60 mb-1.5">
    {children}{required && <span className="text-[var(--error)] ml-1">*</span>}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full px-4 py-2.5 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]
      text-[var(--base-content)] text-sm placeholder:text-[var(--base-content)]/30
      focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/60
      transition-all duration-200 hover:border-[var(--primary)]/40 ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`w-full px-4 py-2.5 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]
      text-[var(--base-content)] text-sm placeholder:text-[var(--base-content)]/30
      focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/60
      transition-all duration-200 hover:border-[var(--primary)]/40 resize-none ${className}`}
    {...props}
  />
);

const Select = ({ className = "", children, ...props }) => (
  <select
    className={`w-full px-4 py-2.5 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]
      text-[var(--base-content)] text-sm
      focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/60
      transition-all duration-200 hover:border-[var(--primary)]/40 ${className}`}
    {...props}
  >
    {children}
  </select>
);

const SaveButton = ({ loading, onClick, label = "Save Changes" }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-content)]
      text-sm font-semibold shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
  >
    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
    {loading ? "Saving…" : label}
  </motion.button>
);

const Toast = ({ message, type = "success", onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -10, scale: 0.95 }}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl ${
      type === "success"
        ? "bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]"
        : "bg-[var(--error)]/10 border-[var(--error)]/30 text-[var(--error)]"
    }`}
  >
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    <span>{message}</span>
    <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
  </motion.div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-[var(--base-100)] border border-[var(--base-300)] rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, colorOn = "bg-[var(--primary)]" }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${
      checked ? colorOn : "bg-[var(--base-300)]"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

// ─── Google Map Component ─────────────────────────────────────────────────────

const GoogleMapPicker = ({ lat, lng, onLocationChange }) => {
  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const markerObj = useRef(null);
  const acRef     = useRef(null);
  const inputRef  = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const centerLat = parseFloat(lat) || DEFAULT_LAT;
  const centerLng = parseFloat(lng) || DEFAULT_LNG;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapRef.current) return;

        const position = { lat: centerLat, lng: centerLng };

        mapObj.current = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          ],
        });

        markerObj.current = new google.maps.Marker({
          position,
          map: mapObj.current,
          draggable: true,
          animation: google.maps.Animation.DROP,
          title: "Hospital Location",
        });

        markerObj.current.addListener("dragend", () => {
          const pos = markerObj.current.getPosition();
          onLocationChange(pos.lat(), pos.lng());
        });

        mapObj.current.addListener("click", (e) => {
          const pos = e.latLng;
          markerObj.current.setPosition(pos);
          onLocationChange(pos.lat(), pos.lng());
        });

        if (inputRef.current) {
          acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            types: ["establishment", "geocode"],
            componentRestrictions: { country: "in" },
            fields: ["geometry", "name", "formatted_address"],
          });

          acRef.current.addListener("place_changed", () => {
            const place = acRef.current.getPlace();
            if (!place.geometry?.location) return;
            const loc = place.geometry.location;
            mapObj.current.setCenter(loc);
            mapObj.current.setZoom(17);
            markerObj.current.setPosition(loc);
            onLocationChange(loc.lat(), loc.lng());
          });
        }

        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError("Failed to load Google Maps. Check API key.");
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady || !markerObj.current || !mapObj.current) return;
    const newLat = parseFloat(lat);
    const newLng = parseFloat(lng);
    if (!isNaN(newLat) && !isNaN(newLng)) {
      const pos = { lat: newLat, lng: newLng };
      markerObj.current.setPosition(pos);
      mapObj.current.panTo(pos);
    }
  }, [lat, lng, mapReady]);

  if (mapError) {
    return (
      <div className="h-64 rounded-xl bg-[var(--base-200)] border border-[var(--error)]/30 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={28} className="text-[var(--error)] mx-auto mb-2" />
          <p className="text-sm text-[var(--base-content)]/60">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40 z-10" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for hospital name, address, or landmark…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]
            text-[var(--base-content)] text-sm placeholder:text-[var(--base-content)]/30
            focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]/60
            transition-all duration-200"
        />
      </div>

      <div className="relative rounded-xl overflow-hidden border border-[var(--base-300)] shadow-sm" style={{ height: 340 }}>
        {!mapReady && (
          <div className="absolute inset-0 bg-[var(--base-200)] flex items-center justify-center z-10">
            <Loader2 size={28} className="animate-spin text-[var(--primary)]" />
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
        {mapReady && (
          <div className="absolute bottom-3 left-3 bg-[var(--base-100)]/90 backdrop-blur-sm border border-[var(--base-300)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--base-content)]/60 shadow">
            <span className="font-semibold text-[var(--primary)]">Lat:</span> {parseFloat(lat || DEFAULT_LAT).toFixed(6)}  
            <span className="font-semibold text-[var(--primary)]">Lng:</span> {parseFloat(lng || DEFAULT_LNG).toFixed(6)}
          </div>
        )}
      </div>

      <FieldNote>Click on the map or drag the marker to set your exact hospital location. Use the search bar to jump to any address.</FieldNote>
    </div>
  );
};

// ─── Section: Hospital Profile ────────────────────────────────────────────────

const ProfileSection = ({ hospital, dispatch }) => {
  const loading = useSelector(isLoading(updateBasicProfile));
  const [form, setForm] = useState({
    name: "", description: "", contact: {}, specialties: [],
    accreditations: [], bedCount: { total: 0, icu: 0 },
    nabledLabAvailable: false, isEmergencyReady: false, hasICU: false,
    hasBloodBank: false, hasPharmacy: false, hasDiagnostics: false,
    hasAmbulance: false, hasWheelchairAccess: false, is24x7: false,
    facilities: [], acceptedSchemes: [],
  });
  const [toast, setToast] = useState(null);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newScheme, setNewScheme] = useState("");

  useEffect(() => {
    if (!hospital) return;
    setForm({
      name:                hospital.name                || "",
      description:         hospital.description         || "",
      contact:             hospital.contact             || {},
      specialties:         hospital.specialties         || [],
      accreditations:      hospital.accreditations      || [],
      bedCount:            hospital.bedCount            || { total: 0, icu: 0 },
      nabledLabAvailable:  hospital.nabledLabAvailable  || false,
      isEmergencyReady:    hospital.isEmergencyReady    || false,
      hasICU:              hospital.hasICU              || false,
      hasBloodBank:        hospital.hasBloodBank        || false,
      hasPharmacy:         hospital.hasPharmacy         || false,
      hasDiagnostics:      hospital.hasDiagnostics      || false,
      hasAmbulance:        hospital.hasAmbulance        || false,
      hasWheelchairAccess: hospital.hasWheelchairAccess || false,
      is24x7:              hospital.is24x7              || false,
      facilities:          hospital.facilities          || [],
      acceptedSchemes:     hospital.acceptedSchemes     || [],
    });
  }, [hospital]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setContact = (key, val) => setForm(f => ({ ...f, contact: { ...f.contact, [key]: val } }));

  const addTag = (key, val, setter) => {
    if (!val.trim()) return;
    setForm(f => ({ ...f, [key]: [...(f[key] || []), val.trim()] }));
    setter("");
  };
  
  const removeTag = (key, idx) =>
    setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));

  const toggleAccreditation = (acc) =>
    setForm(f => ({
      ...f,
      accreditations: f.accreditations.includes(acc)
        ? f.accreditations.filter(a => a !== acc)
        : [...f.accreditations, acc],
    }));

  const handleSave = async () => {
    const result = await dispatch(updateBasicProfile(form));
    if (!result.error) setToast({ msg: "Hospital profile updated successfully.", type: "success" });
    else setToast({ msg: result.payload || "Failed to update.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Hospital Profile" subtitle="Core details visible to patients and staff on the platform." icon={Hospital} />

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Basic Information</h3>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <Label required>Hospital Name</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Apollo Multispecialty Hospital" />
            <FieldNote>Public-facing name shown on patient pages and search results.</FieldNote>
          </div>
          <div>
            <Label>About / Description</Label>
            <Textarea rows={4} value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Describe your hospital's mission, key services, and what sets you apart…" />
            <FieldNote>Keep under 1000 characters. Patients read this to understand your hospital's strengths.</FieldNote>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Total Beds</Label>
              <Input type="number" min={0} value={form.bedCount.total}
                onChange={e => set("bedCount", { ...form.bedCount, total: Number(e.target.value) })} />
              <FieldNote>Total inpatient bed capacity.</FieldNote>
            </div>
            <div>
              <Label>ICU Beds</Label>
              <Input type="number" min={0} value={form.bedCount.icu}
                onChange={e => set("bedCount", { ...form.bedCount, icu: Number(e.target.value) })} />
              <FieldNote>Setting  0 auto-enables "Has ICU" flag.</FieldNote>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Contact Details</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { key: "phone",          label: "Primary Phone",   ph: "+91 9XXXXXXXXX",     note: "Main reception. Shown to patients for appointment inquiries.", icon: Phone },
            { key: "emergencyPhone", label: "Emergency Phone", ph: "+91 9XXXXXXXXX",     note: "Direct emergency contact. Listed on emergency cards.",          icon: Phone },
            { key: "alternatePhone", label: "Alternate Phone", ph: "+91 9XXXXXXXXX",     note: "Backup number if primary is unreachable.",                      icon: Phone },
            { key: "email",          label: "Official Email",  ph: "info@hospital.com",  note: "Used for official correspondence and patient queries.",          icon: Mail  },
            { key: "website",        label: "Website URL",     ph: "https://hospital.com", note: "Official website. Opens in new tab on your profile.",         icon: Globe },
            { key: "whatsapp",       label: "WhatsApp",        ph: "+91 9XXXXXXXXX",     note: "Patients can message for quick non-emergency queries.",          icon: Phone },
          ].map(({ key, label, ph, note, icon: Ico }) => (
            <div key={key}>
              <Label>{label}</Label>
              <div className="relative">
                <Ico size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
                <Input className="pl-9" value={form.contact[key] || ""} onChange={e => setContact(key, e.target.value)} placeholder={ph} />
              </div>
              <FieldNote>{note}</FieldNote>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Accreditations & Certifications</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {ACCREDITATION_OPTIONS.map(acc => (
              <button key={acc} onClick={() => toggleAccreditation(acc)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${
                  form.accreditations.includes(acc)
                    ? "bg-[var(--primary)] text-[var(--primary-content)] border-[var(--primary)] shadow-lg"
                    : "bg-[var(--base-200)] text-[var(--base-content)]/60 border-[var(--base-300)] hover:border-[var(--primary)]/40"
                }`}
              >{acc}</button>
            ))}
          </div>
          <FieldNote>Select all certifications your hospital holds. These appear as trust badges on your patient-facing profile.</FieldNote>
          <div className="flex items-center gap-3 pt-2">
            <Toggle
              checked={form.nabledLabAvailable}
              onChange={v => set("nabledLabAvailable", v)}
            />
            <span className="text-sm font-medium text-[var(--base-content)]">NABL Lab Available</span>
          </div>
          <FieldNote>Enable if your hospital has a NABL-accredited in-house diagnostic laboratory.</FieldNote>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Medical Specialties</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex gap-2">
            <Select value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} className="flex-1">
              <option value="">Select a specialty to add…</option>
              {SPECIALTIES_OPTIONS.filter(s => !form.specialties.includes(s)).map(s => <option key={s}>{s}</option>)}
            </Select>
            <button onClick={() => addTag("specialties", newSpecialty, setNewSpecialty)}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-content)] text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.specialties.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-xs font-semibold">
                {s}
                <button onClick={() => removeTag("specialties", i)} className="hover:text-[var(--error)] transition-colors"><X size={11} /></button>
              </span>
            ))}
          </div>
          <FieldNote>Specialties help patients find the right care. Used in search filters and prominently shown on your hospital page.</FieldNote>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Facility Features</h3>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FACILITY_FLAGS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => set(key, !form[key])}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all duration-200 ${
                form[key]
                  ? "bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]"
                  : "bg-[var(--base-200)] border-[var(--base-300)] text-[var(--base-content)]/50 hover:border-[var(--primary)]/30"
              }`}>
              <span className="text-lg">{icon}</span>
              <span className="text-xs font-semibold leading-tight flex-1">{label}</span>
              {form[key] && <CheckCircle2 size={12} className="shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-6 pb-5">
          <FieldNote>Only enable features currently active and accessible to patients.</FieldNote>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Accepted Insurance & Govt. Schemes</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex gap-2">
            <Input value={newScheme} onChange={e => setNewScheme(e.target.value)}
              placeholder="e.g. PMJAY, ESI, CGHS, Arogyasri…"
              onKeyDown={e => e.key === "Enter" && addTag("acceptedSchemes", newScheme, setNewScheme)} />
            <button onClick={() => addTag("acceptedSchemes", newScheme, setNewScheme)}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-content)] text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.acceptedSchemes.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 text-xs font-semibold">
                {s}<button onClick={() => removeTag("acceptedSchemes", i)} className="hover:text-[var(--error)] transition-colors"><X size={11} /></button>
              </span>
            ))}
          </div>
          <FieldNote>Press Enter or click + to add. Listing schemes helps eligible patients choose your hospital.</FieldNote>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Location & GPS ──────────────────────────────────────────────────

const LocationSection = ({ hospital, dispatch }) => {
  const loading = useSelector(isLoading(updateLocation));
  const [form, setForm] = useState({
    lat: "", lng: "", googleMapsUrl: "",
    address: { line1: "", line2: "", landmark: "", city: "Vijayawada", state: "Andhra Pradesh", pincode: "" },
  });
  const [toast, setToast] = useState(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!hospital) return;
    setForm({
      lat:           hospital.location?.coordinates?.[1]?.toString() || DEFAULT_LAT.toString(),
      lng:           hospital.location?.coordinates?.[0]?.toString() || DEFAULT_LNG.toString(),
      googleMapsUrl: hospital.googleMapsUrl || "",
      address: {
        line1:    hospital.address?.line1    || "",
        line2:    hospital.address?.line2    || "",
        landmark: hospital.address?.landmark || "",
        city:     hospital.address?.city     || "Vijayawada",
        state:    hospital.address?.state    || "Andhra Pradesh",
        pincode:  hospital.address?.pincode  || "",
      },
    });
  }, [hospital]);

  const setAddr = (key, val) => setForm(f => ({ ...f, address: { ...f.address, [key]: val } }));

  const handleMapLocationChange = useCallback((lat, lng) => {
    setForm(f => ({
      ...f,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));

    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results[0]) return;
      const components = results[0].address_components;
      const get = (type) =>
        components.find(c => c.types.includes(type))?.long_name || "";

      setForm(f => ({
        ...f,
        address: {
          ...f.address,
          line1:    get("route") || get("sublocality_level_2") || f.address.line1,
          line2:    get("sublocality_level_1") || get("sublocality") || f.address.line2,
          landmark: f.address.landmark,
          city:     get("locality") || f.address.city,
          state:    get("administrative_area_level_1") || f.address.state,
          pincode:  get("postal_code") || f.address.pincode,
        },
      }));
    });
  }, []);

  const handleGps = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported in this browser.");
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      p => {
        handleMapLocationChange(p.coords.latitude, p.coords.longitude);
        setDetecting(false);
      },
      () => {
        alert("Could not detect location. Please grant location permission.");
        setDetecting(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return setToast({ msg: "Invalid coordinates. Use the map or enter valid lat/lng.", type: "error" });
    }
    const result = await dispatch(updateLocation({
      lat,
      lng,
      address:      form.address,
      googleMapsUrl: form.googleMapsUrl, 
    }));
    if (!result.error) setToast({ msg: "Location updated successfully.", type: "success" });
    else setToast({ msg: result.payload || "Failed to update location.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Location & GPS" subtitle="Accurate location ensures patients can navigate to your hospital." icon={MapPin} />

      <Card>
        <div className="p-6 border-b border-[var(--base-300)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Interactive Map</h3>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleGps} disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--primary)]/40 text-[var(--primary)] text-xs font-semibold hover:bg-[var(--primary)]/5 transition-all duration-200 disabled:opacity-60">
            {detecting ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
            {detecting ? "Detecting…" : "Auto-detect GPS"}
          </motion.button>
        </div>
        <div className="p-6">
          <GoogleMapPicker
            lat={form.lat}
            lng={form.lng}
            onLocationChange={handleMapLocationChange}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">GPS Coordinates</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label required>Latitude</Label>
            <Input type="number" step="0.000001"
              value={form.lat}
              onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
              placeholder="e.g. 16.506145" />
            <FieldNote>Decimal degrees. Range: −90 to 90.</FieldNote>
          </div>
          <div>
            <Label required>Longitude</Label>
            <Input type="number" step="0.000001"
              value={form.lng}
              onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
              placeholder="e.g. 80.648018" />
            <FieldNote>Decimal degrees. Range: −180 to 180.</FieldNote>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Physical Address</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "line1",    label: "Address Line 1", ph: "Building / Street name",    note: "Primary address: building name and street.", required: true },
            { key: "line2",    label: "Address Line 2", ph: "Area / Colony",              note: "Secondary details like area or colony." },
            { key: "landmark", label: "Landmark",       ph: "Near…",                     note: "Nearby landmark helps patients locate you." },
            { key: "city",     label: "City",           ph: "Vijayawada",                note: "City of operation. Defaults to Vijayawada." },
            { key: "state",    label: "State",          ph: "Andhra Pradesh",            note: "State of registration." },
            { key: "pincode",  label: "PIN Code",       ph: "520001",                    note: "6-digit Indian PIN code.", required: true },
          ].map(({ key, label, ph, note, required }) => (
            <div key={key}>
              <Label required={required}>{label}</Label>
              <Input value={form.address[key] || ""} onChange={e => setAddr(key, e.target.value)} placeholder={ph} />
              <FieldNote>{note}</FieldNote>
            </div>
          ))}

          <div>
            <Label>Google Maps URL</Label>
            <div className="relative">
              <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
              <Input className="pl-9"
                value={form.googleMapsUrl}
                onChange={e => setForm(f => ({ ...f, googleMapsUrl: e.target.value }))}
                placeholder="https://maps.google.com/…" />
            </div>
            <FieldNote>Paste a direct Google Maps share link. Shown as "Get Directions" button on your profile page.</FieldNote>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Operating Hours ─────────────────────────────────────────────────

const HoursSection = ({ dispatch }) => {
  const loading      = useSelector(isLoading(updateOperatingHours));
  const savedHours   = useSelector(selectOperatingHours);

  const [hours, setHours] = useState(
    DAYS.map(day => ({ day, openTime: "08:00", closeTime: "20:00", is24Hours: false, isClosed: false }))
  );
  const [is24x7, setIs24x7] = useState(false);
  const [toast, setToast]   = useState(null);

  useEffect(() => {
    dispatch(fetchOperatingHours());
  }, [dispatch]);

  useEffect(() => {
    if (!savedHours) return;

    const arr     = Array.isArray(savedHours) ? savedHours : savedHours.operatingHours;
    const flag24  = savedHours.is24x7 ?? false;

    if (arr?.length) {
      setHours(
        DAYS.map(day => {
          const existing = arr.find(d => d.day === day);
          return existing
            ? { day, openTime: existing.openTime || "08:00", closeTime: existing.closeTime || "20:00", is24Hours: existing.is24Hours || false, isClosed: existing.isClosed || false }
            : { day, openTime: "08:00", closeTime: "20:00", is24Hours: false, isClosed: false };
        })
      );
    }
    setIs24x7(flag24);
  }, [savedHours]);

  const updateDay = (dayName, key, val) =>
    setHours(h => h.map(d => d.day === dayName ? { ...d, [key]: val } : d));

  const applyAllWeekdays = () => {
    const monday = hours.find(d => d.day === "Monday");
    if (!monday) return;
    setHours(h =>
      h.map(d =>
        ["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(d.day)
          ? { ...d, openTime: monday.openTime, closeTime: monday.closeTime, is24Hours: monday.is24Hours, isClosed: monday.isClosed }
          : d
      )
    );
  };

  const handleSave = async () => {
    const result = await dispatch(updateOperatingHours({ operatingHours: hours, is24x7 }));
    if (!result.error) setToast({ msg: "Operating hours saved.", type: "success" });
    else setToast({ msg: result.payload || "Failed to save.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Operating Hours" subtitle="Define when your hospital is open. Patients see these before booking." icon={Clock} />

      <Card>
        <div className="p-6 border-b border-[var(--base-300)] flex items-center justify-between gap-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Weekly Schedule</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--base-content)]/60">24×7 Hospital</span>
            <Toggle checked={is24x7} onChange={setIs24x7} />
          </div>
        </div>
        <div className="p-6">
          <div className="mb-5">
            <button onClick={applyAllWeekdays}
              className="text-xs text-[var(--primary)] font-semibold hover:underline flex items-center gap-1">
              <RefreshCw size={11} /> Apply Monday hours to all weekdays
            </button>
            <FieldNote>Set open/close times per day. "24hr" overrides times. "Closed" means no bookings that day.</FieldNote>
          </div>

          <div className="space-y-3">
            {hours.map((d, i) => (
              <motion.div
                key={d.day}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200 ${
                  d.isClosed
                    ? "bg-[var(--base-200)]/40 border-[var(--base-300)] opacity-70"
                    : "bg-[var(--base-100)] border-[var(--base-300)] hover:border-[var(--primary)]/30"
                }`}
              >
                {/* Day Label */}
                <span className="w-24 shrink-0 text-sm font-bold text-[var(--base-content)]/80 uppercase tracking-wide">
                  {d.day}
                </span>

                {/* Time Inputs / Status Message Container */}
                <div className="flex-1 flex items-center gap-3 min-w-[240px]">
                  {d.isClosed ? (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--error)]/60 bg-[var(--error)]/5 px-4 py-2 rounded-lg border border-[var(--error)]/10">
                      Closed
                    </span>
                  ) : d.is24Hours ? (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--success)]/60 bg-[var(--success)]/5 px-4 py-2 rounded-lg border border-[var(--success)]/10">
                      Open 24 Hours
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Input 
                        type="time" 
                        className="w-[120px] h-10 text-sm px-3"
                        value={d.openTime}
                        onChange={e => updateDay(d.day, "openTime", e.target.value)} 
                      />
                      <span className="text-[var(--base-content)]/40 text-[10px] font-bold uppercase">to</span>
                      <Input 
                        type="time" 
                        className="w-[120px] h-10 text-sm px-3"
                        value={d.closeTime}
                        onChange={e => updateDay(d.day, "closeTime", e.target.value)} 
                      />
                    </div>
                  )}
                </div>

                {/* Toggle Controls - Adjusted to side-by-side flex-row layout */}
                <div className="flex items-center gap-6 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-xs font-bold text-[var(--base-content)]/50 group-hover:text-[var(--success)] transition-colors">24H</span>
                    <Toggle
                      checked={d.is24Hours}
                      colorOn="bg-[var(--success)]"
                      onChange={v => {
                        updateDay(d.day, "is24Hours", v);
                        if (v) updateDay(d.day, "isClosed", false);
                      }}
                    />
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-xs font-bold text-[var(--base-content)]/50 group-hover:text-[var(--error)] transition-colors">Closed</span>
                    <Toggle
                      checked={d.isClosed}
                      colorOn="bg-[var(--error)]"
                      onChange={v => {
                        updateDay(d.day, "isClosed", v);
                        if (v) updateDay(d.day, "is24Hours", false);
                      }}
                    />
                  </label>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4">
            <FieldNote>The "24×7 Hospital" toggle overrides all individual day settings when enabled.</FieldNote>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Gallery & Logo ──────────────────────────────────────────────────

const GallerySection = ({ hospital, dispatch }) => {
  const logoLoading    = useSelector(isLoading(uploadLogo));
  const galleryLoading = useSelector(isLoading(uploadGalleryImages));
  const logoRef = useRef(null);
  const galRef  = useRef(null);
  const [toast, setToast] = useState(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    const result = await dispatch(uploadLogo(fd));
    if (!result.error) setToast({ msg: "Logo uploaded successfully.", type: "success" });
    else setToast({ msg: result.payload || "Upload failed.", type: "error" });
    e.target.value = "";
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append("images", f));
    const result = await dispatch(uploadGalleryImages(fd));
    if (!result.error) setToast({ msg: `${result.payload?.uploaded?.length || 0} image(s) uploaded.`, type: "success" });
    else setToast({ msg: result.payload || "Upload failed.", type: "error" });
    e.target.value = "";
  };

  const handleDelete = async (url) => {
    if (!confirm("Remove this image from the gallery?")) return;
    const result = await dispatch(deleteGalleryImage(url));
    if (!result.error) setToast({ msg: "Image removed.", type: "success" });
    else setToast({ msg: result.payload || "Delete failed.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Gallery & Logo" subtitle="Upload visual assets that represent your hospital to patients." icon={ImageIcon} />

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Hospital Logo</h3>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-start gap-6">
          <div className="w-28 h-28 rounded-2xl bg-[var(--base-200)] border-2 border-dashed border-[var(--base-300)] flex items-center justify-center overflow-hidden shrink-0">
            {hospital?.logo
              ? <img src={hospital.logo} alt="logo" className="w-full h-full object-contain p-2" />
              : <Hospital size={40} className="text-[var(--base-content)]/20" />}
          </div>
          <div className="flex-1 space-y-3">
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => logoRef.current?.click()} disabled={logoLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-content)] text-sm font-semibold shadow-lg transition-all duration-200 disabled:opacity-60">
              {logoLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {logoLoading ? "Uploading…" : "Upload Logo"}
            </motion.button>
            <div className="space-y-1">
              <FieldNote>Recommended: Square PNG with transparent background, at least 512×512 px.</FieldNote>
              <FieldNote>Accepted: JPEG, PNG, WebP, GIF. Max 10 MB.</FieldNote>
              <FieldNote>Logo appears on patient pages, invoices, and appointment emails.</FieldNote>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Photo Gallery</h3>
            <p className="text-xs text-[var(--base-content)]/40 mt-1">{hospital?.images?.length || 0} / 20 images used</p>
          </div>
          <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => galRef.current?.click()} disabled={galleryLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--primary)]/40 text-[var(--primary)] text-sm font-semibold hover:bg-[var(--primary)]/5 transition-all duration-200 disabled:opacity-60">
            {galleryLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {galleryLoading ? "Uploading…" : "Add Photos"}
          </motion.button>
        </div>
        <div className="p-6">
          {!hospital?.images?.length ? (
            <div className="h-40 flex flex-col items-center justify-center rounded-xl bg-[var(--base-200)] border-2 border-dashed border-[var(--base-300)] text-[var(--base-content)]/30">
              <ImageIcon size={32} className="mb-2" />
              <p className="text-sm font-medium">No gallery images yet</p>
              <p className="text-xs mt-1">Click "Add Photos" to upload up to 5 at a time</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {hospital.images.map((url, i) => (
                <motion.div key={url}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative group aspect-square rounded-xl overflow-hidden bg-[var(--base-200)] border border-[var(--base-300)]">
                  <img src={url} alt={`gallery-${i}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <a href={url} target="_blank" rel="noreferrer"
                      className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
                      <Eye size={14} />
                    </a>
                    <button onClick={() => handleDelete(url)}
                      className="p-2 rounded-full bg-[var(--error)]/90 text-white hover:bg-[var(--error)] transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded-md">{i + 1}</span>
                </motion.div>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-1">
            <FieldNote>Upload up to 5 images at a time. 20 max total.</FieldNote>
            <FieldNote>High-quality photos of wards, OPD, and exterior improve patient trust and booking rates.</FieldNote>
            <FieldNote>Accepted: JPEG, PNG, WebP. Max 10 MB each. Hover over an image to delete.</FieldNote>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Legal & Licenses ────────────────────────────────────────────────

const LegalSection = ({ hospital, dispatch }) => {
  const regLoading = useSelector(isLoading(updateRegistration));
  const docLoading = useSelector(isLoading(uploadLicenseDocument));
  const docRef = useRef(null);
  const [form, setForm]   = useState({ licenseNumber: "", gstNumber: "", panNumber: "", licenseExpiry: "" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!hospital?.registrationDetails) return;
    const r = hospital.registrationDetails;
    setForm({
      licenseNumber: r.licenseNumber || "",
      gstNumber:     r.gstNumber     || "",
      panNumber:     r.panNumber     || "",
      licenseExpiry: r.licenseExpiry
        ? new Date(r.licenseExpiry).toISOString().split("T")[0]
        : "",
    });
  }, [hospital]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    const result = await dispatch(updateRegistration({
      ...form,
      licenseExpiry: form.licenseExpiry || undefined,
    }));
    if (!result.error) setToast({ msg: "Registration details updated.", type: "success" });
    else setToast({ msg: result.payload || "Update failed.", type: "error" });
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("document", file);
    const result = await dispatch(uploadLicenseDocument(fd));
    if (!result.error) setToast({ msg: "License document uploaded.", type: "success" });
    else setToast({ msg: result.payload || "Upload failed.", type: "error" });
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Legal & Licenses" subtitle="Regulatory documents required for platform verification." icon={FileText} />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning)]/8 border border-[var(--warning)]/25">
        <AlertCircle size={16} className="text-[var(--warning)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--base-content)]/70 leading-relaxed">
          <span className="font-bold text-[var(--warning)]">Important:</span> Inaccurate or expired legal details may result in your hospital being suspended. All documents are reviewed by the Likeson compliance team.
        </p>
      </div>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">Registration Details</h3>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <Label required>License Number</Label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
              <Input className="pl-9" value={form.licenseNumber} onChange={e => set("licenseNumber", e.target.value)} placeholder="e.g. AP/HOS/2024/001234" />
            </div>
            <FieldNote>State medical/hospital registration authority license number. Must be unique on the platform.</FieldNote>
          </div>
          <div>
            <Label>GST Number</Label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
              <Input className="pl-9" value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)} placeholder="e.g. 37AABCU9603R1Z2" />
            </div>
            <FieldNote>15-character GSTIN. Required for GST-compliant patient invoices.</FieldNote>
          </div>
          <div>
            <Label>PAN Number</Label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
              <Input className="pl-9 uppercase" value={form.panNumber}
                onChange={e => set("panNumber", e.target.value.toUpperCase())}
                placeholder="e.g. AABCU9603R" maxLength={10} />
            </div>
            <FieldNote>10-character PAN: AAAAA9999A format. Used for TDS, settlements, financial reporting.</FieldNote>
          </div>
          <div>
            <Label>License Expiry Date</Label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
              <Input type="date" className="pl-9" value={form.licenseExpiry} onChange={e => set("licenseExpiry", e.target.value)} />
            </div>
            <FieldNote>Platform sends renewal reminders 60 and 30 days before expiry. Expired licenses trigger account review.</FieldNote>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-[var(--base-300)]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">License Document</h3>
        </div>
        <div className="p-6">
          <input ref={docRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleDocUpload} />

          {hospital?.registrationDetails?.documentUrl ? (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--success)]/8 border border-[var(--success)]/25 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--success)]/15 flex items-center justify-center shrink-0">
                <FileText size={22} className="text-[var(--success)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--base-content)]">Document Uploaded</p>
                <p className="text-xs text-[var(--base-content)]/50 truncate mt-0.5">
                  {hospital.registrationDetails.documentUrl}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={hospital.registrationDetails.documentUrl} target="_blank" rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-[var(--base-200)] transition-colors text-[var(--primary)]">
                  <Eye size={16} />
                </a>
                <button onClick={() => docRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-[var(--base-200)] transition-colors text-[var(--base-content)]/60">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center rounded-xl bg-[var(--base-200)] border-2 border-dashed border-[var(--base-300)] mb-4">
              <Upload size={24} className="text-[var(--base-content)]/30 mb-2" />
              <p className="text-sm text-[var(--base-content)]/50">No document uploaded yet</p>
            </div>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} disabled={docLoading}
            onClick={() => docRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--primary)]/40 text-[var(--primary)] text-sm font-semibold hover:bg-[var(--primary)]/5 transition-all duration-200 disabled:opacity-60">
            {docLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {docLoading ? "Uploading…" : hospital?.registrationDetails?.documentUrl ? "Replace Document" : "Upload Document"}
          </motion.button>

          <div className="mt-3 space-y-1">
            <FieldNote>Accepted: PDF, JPEG, PNG, WebP. Max 10 MB.</FieldNote>
            <FieldNote>Upload a scanned copy or digital certificate of your hospital registration license.</FieldNote>
            <FieldNote>Reviewed by the Likeson compliance team during verification.</FieldNote>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={regLoading} onClick={handleSave} label="Save Registration Details" />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FacilityManagement() {
  const dispatch = useDispatch();
  const hospital = useSelector(selectHospital);
  const [active, setActive] = useState("legal");

  useEffect(() => {
    dispatch(fetchHospitalProfile());
  }, [dispatch]);

  const SECTIONS = {
    profile:  <ProfileSection  hospital={hospital} dispatch={dispatch} />,
    location: <LocationSection hospital={hospital} dispatch={dispatch} />,
    hours:    <HoursSection    dispatch={dispatch} />,
    gallery:  <GallerySection  hospital={hospital} dispatch={dispatch} />,
    legal:    <LegalSection    hospital={hospital} dispatch={dispatch} />,
  };

  return (
    <div className="min-h-screen bg-[var(--base-200)]/50" data-theme="hospital">
      <div className="bg-[var(--base-100)] border-b border-[var(--base-300)] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto  py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
              <Building2 size={18} className="text-[var(--primary)]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--base-content)] font-montserrat leading-tight">Facility Management</h1>
              <p className="text-xs text-[var(--base-content)]/45">{hospital?.name || "Loading…"}</p>
            </div>
          </div>
          {hospital?.isVerified ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/25 text-[var(--success)] text-xs font-bold">
              <Shield size={11} /> Verified
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--warning)]/10 border border-[var(--warning)]/25 text-[var(--warning)] text-xs font-bold">
              <AlertCircle size={11} /> Pending Verification
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto 6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          <aside className="lg:w-60 shrink-0">
            <div className="sticky top-24">
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--base-300)]">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/40">Sections</p>
                </div>
                <nav className="p-2 space-y-0.5">
                  {NAV_SECTIONS.map(({ id, label, icon: Ico }) => {
                    const isActive = active === id;
                    return (
                      <motion.button
                        key={id}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActive(id)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-[var(--primary)] text-[var(--primary-content)] shadow-md"
                            : "text-[var(--base-content)]/60 hover:bg-[var(--base-200)] hover:text-[var(--base-content)]"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Ico size={15} className={isActive ? "text-[var(--primary-content)]/80" : "text-[var(--base-content)]/40"} />
                          {label}
                        </span>
                        <ChevronRight size={13} className={`transition-transform duration-200 ${isActive ? "opacity-80" : "opacity-30"}`} />
                      </motion.button>
                    );
                  })}
                </nav>

                <div className="px-4 py-4 border-t border-[var(--base-300)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[var(--base-content)]/50">Profile Complete</span>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {hospital?.onboarding?.isComplete ? "100%" : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--base-300)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: hospital?.onboarding?.isComplete ? "100%" : "40%" }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {SECTIONS[active]}
              </motion.div>
            </AnimatePresence>
          </main>

        </div>
      </div>
    </div>
  );
}