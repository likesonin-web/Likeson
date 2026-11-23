import {
   
  Package,
 
  FlaskConical,
  Layers,
 
  Pill,
  Syringe,
  Droplets,
  Wind,
  
  ChevronRight as ArrowRight,
  FileText,
  FlaskConical as Flask,
  ShieldCheck,
  Boxes,
 
  Camera,
  
} from "lucide-react";

export const SCHEDULE_INFO = {
  H: {
    label: "Schedule H",
    short: "Prescription only – dangerous if misused",
    detail:
      "Drugs that can only be sold on the prescription of a Registered Medical Practitioner. Includes antibiotics, steroids, and habit-forming medicines. Cannot be sold OTC.",
    color: "error",
  },
  H1: {
    label: "Schedule H1",
    short: "Strict Rx — antibiotics & high-risk drugs",
    detail:
      "Stricter sub-category of Schedule H covering specific antibiotics (e.g. 3rd/4th gen cephalosporins), anti-TB, and antiretroviral drugs. Requires recording patient details in a register.",
    color: "error",
  },
  G: {
    label: "Schedule G",
    short: "Caution — recommended under supervision",
    detail:
      "Drugs that should be taken under medical supervision. The label must bear the caution: 'Caution: It is dangerous to take this preparation except under medical supervision.' Includes hormonal and some cardiovascular medicines.",
    color: "warning",
  },
  X: {
    label: "Schedule X",
    short: "Narcotic / psychotropic — strict control",
    detail:
      "Narcotic and psychotropic substances requiring special license to stock and sell. Strict record-keeping and quantity limits apply (e.g. benzodiazepines, opioids). High abuse potential.",
    color: "error",
  },
  None: {
    label: "OTC / Unscheduled",
    short: "Over-the-counter — no prescription needed",
    detail:
      "Medicines that can be freely sold without a prescription. Generally considered safe for self-medication when used as directed (e.g. common analgesics, antacids, vitamins).",
    color: "success",
  },
};
 

export const SCHEDULE_BADGE = {
  H: "badge-error",
  H1: "badge-error",
  G: "badge-warning",
  X: "badge-error",
  None: "badge-success",
};

export const CATEGORY_COLORS = {
  Tablet: "badge-primary",
  Capsule: "badge-info",
  Syrup: "badge-success",
  Injection: "badge-error",
  Ointment: "badge-warning",
  Drops: "badge-info",
  Inhaler: "badge-warning",
  Powder: "badge-primary",
};

export const CATEGORY_ICONS = {
  Tablet: Pill,
  Capsule: Package,
  Syrup: Droplets,
  Injection: Syringe,
  Ointment: Layers,
  Drops: Droplets,
  Inhaler: Wind,
  Powder: FlaskConical,
};

//  ─── Form Steps Definition ────────────────────────────────────────────────────

export const FORM_STEPS = [
  {
    id: 1,
    title: "Basic Info",
    subtitle: "Brand & identification",
    icon: FileText,
    color: "primary",
  },
  {
    id: 2,
    title: "Medical Details",
    subtitle: "Dosage & composition",
    icon: Flask,
    color: "secondary",
  },
  {
    id: 3,
    title: "Regulatory",
    subtitle: "Schedule & safety",
    icon: ShieldCheck,
    color: "warning",
  },
  {
    id: 4,
    title: "Inventory",
    subtitle: "Stock & pricing",
    icon: Boxes,
    color: "success",
  },
  {
    id: 5,
    title: "Media",
    subtitle: "Images & keywords",
    icon: Camera,
    color: "info",
  },
];
