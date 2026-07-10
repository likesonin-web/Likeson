'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  MessageCircleWarning,
  LifeBuoy,
  RotateCcw,
  Bug,
  Sparkles,
  CalendarClock,
  CreditCard,
  Repeat,
  Paperclip,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  DRAFT_AUTOSAVE_DEBOUNCE_MS,
} from '../../../features/support/constants/support.constants';

const TYPE_ICONS = {
  complaint: MessageCircleWarning,
  support_request: LifeBuoy,
  refund_request: RotateCcw,
  technical_bug: Bug,
  feature_request: Sparkles,
  booking_issue: CalendarClock,
  payment_issue: CreditCard,
  subscription_issue: Repeat,
  doctor_issue: LifeBuoy,
  hospital_issue: LifeBuoy,
  lab_issue: LifeBuoy,
  pharmacy_issue: LifeBuoy,
  transport_issue: LifeBuoy,
  care_assistant_issue: LifeBuoy,
  general_support: LifeBuoy,
  other: LifeBuoy,
};

const detailsSchema = z.object({
  ticketType: z.enum(TICKET_TYPES),
  subject: z.string().trim().min(5, 'Subject needs at least 5 characters').max(200),
  description: z.string().trim().min(10, 'Please add a bit more detail (10+ characters)').max(5000),
  priority: z.enum(TICKET_PRIORITIES),
  booking: z.string().nullable().optional(),
});

const DRAFT_KEY = 'support:create-ticket-draft';
const ALL_ALLOWED_MIMES = Object.values(ALLOWED_MIME_TYPES).flat();

const STEPS = ['Category', 'Details', 'Attachments', 'Review'];

/**
 * @param {{
 *   bookings: Array<{_id: string, bookingCode: string}>,
 *   onSubmit: (payload: object) => Promise<void>,
 *   submitting: boolean,
 * }} props
 */
export default function CreateTicketWizard({ bookings = [], onSubmit, submitting }) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: loadDraft(),
    mode: 'onChange',
  });

  const values = watch();

  // ── Autosave draft ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    }, DRAFT_AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [values]);

  const onDrop = useCallback((accepted, rejected) => {
    rejected.forEach((r) => {
      // Surfaced inline rather than toast — this is a form step, keep
      // feedback co-located with the dropzone.
      // eslint-disable-next-line no-console
      console.warn(`${r.file.name} rejected: ${r.errors[0]?.message}`);
    });
    setFiles((prev) => [...prev, ...accepted.map((f) => Object.assign(f, { preview: URL.createObjectURL(f) }))]);
  }, []);

  const dropzone = useDropzone({
    onDrop,
    accept: ALL_ALLOWED_MIMES.reduce((acc, m) => ({ ...acc, [m]: [] }), {}),
    maxSize: Math.max(...Object.values(MAX_FILE_SIZE_BYTES)),
  });

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const goNext = async () => {
    if (step === 0 && !values.ticketType) return;
    if (step === 1) {
      const valid = await trigger(['subject', 'description', 'priority']);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const submitHandler = handleSubmit(async (data) => {
    await onSubmit({ ...data, attachments: [], _localFiles: files });
    window.localStorage.removeItem(DRAFT_KEY);
    setFiles([]);
    setStep(0);
  });

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="card p-5 sm:p-8 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`text-xs font-bold ${i <= step ? 'text-primary' : 'text-base-content/30'}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="progress-bar">
          <motion.div
            className="progress-bar-fill"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-bold mb-1">What do you need help with?</h2>
            <p className="text-sm text-base-content/60 mb-5">Pick the category that fits best.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TICKET_TYPES.map((type) => {
                const Icon = TYPE_ICONS[type] ?? LifeBuoy;
                const active = values.ticketType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setValue('ticketType', type, { shouldValidate: true })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-box border-2 text-center transition-colors ${
                      active ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/40'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-base-content/50'}`} />
                    <span className="text-xs font-semibold">{TICKET_TYPE_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-bold mb-1">Tell us more</h2>

            <div>
              <label htmlFor="subject" className="label-text block mb-1.5">
                Subject
              </label>
              <input id="subject" {...register('subject')} className="input-field" placeholder="Short summary of the issue" />
              {errors.subject && <p className="text-xs text-error mt-1">{errors.subject.message}</p>}
            </div>

            <div>
              <label htmlFor="description" className="label-text block mb-1.5">
                Description
              </label>
              <textarea
                id="description"
                {...register('description')}
                rows={5}
                className="input-field resize-none"
                placeholder="Give us as much detail as you can — dates, amounts, what you expected to happen…"
              />
              {errors.description && <p className="text-xs text-error mt-1">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="priority" className="label-text block mb-1.5">
                  Priority
                </label>
                <select id="priority" {...register('priority')} className="input-field">
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TICKET_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              {bookings.length > 0 && (
                <div>
                  <label htmlFor="booking" className="label-text block mb-1.5">
                    Related booking (optional)
                  </label>
                  <Controller
                    control={control}
                    name="booking"
                    render={({ field }) => (
                      <select id="booking" {...field} value={field.value || ''} className="input-field">
                        <option value="">None</option>
                        {bookings.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.bookingCode}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-bold mb-1">Add attachments</h2>
            <p className="text-sm text-base-content/60 mb-4">Optional — screenshots, receipts, reports.</p>

            <div
              {...dropzone.getRootProps()}
              className={`border-2 border-dashed rounded-box p-8 text-center cursor-pointer transition-colors ${
                dropzone.isDragActive ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/40'
              }`}
            >
              <input {...dropzone.getInputProps()} />
              <Paperclip className="w-6 h-6 mx-auto mb-2 text-base-content/40" />
              <p className="text-sm font-semibold">Drag & drop files, or click to browse</p>
              <p className="text-xs text-base-content/40 mt-1">Images, PDF, video, audio — up to 100MB</p>
            </div>

            {files.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {files.map((file) => (
                  <li key={file.name} className="relative card p-2 flex items-center gap-2">
                    {file.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.preview} alt={file.name} className="w-10 h-10 object-cover rounded-field" />
                    ) : (
                      <div className="w-10 h-10 rounded-field bg-base-300 flex items-center justify-center">
                        <Paperclip className="w-4 h-4 text-base-content/40" />
                      </div>
                    )}
                    <span className="text-xs truncate flex-1">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.name)}
                      className="btn btn-ghost btn-circle btn-xs absolute -top-1.5 -right-1.5 bg-base-100"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-bold mb-4">Review & submit</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-base-content/50">Category</dt>
                <dd className="font-semibold">{TICKET_TYPE_LABELS[values.ticketType]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/50">Priority</dt>
                <dd className="font-semibold">{TICKET_PRIORITY_LABELS[values.priority]}</dd>
              </div>
              <div>
                <dt className="text-base-content/50 mb-1">Subject</dt>
                <dd className="font-semibold">{values.subject}</dd>
              </div>
              <div>
                <dt className="text-base-content/50 mb-1">Description</dt>
                <dd className="text-base-content/80 whitespace-pre-wrap">{values.description}</dd>
              </div>
              {files.length > 0 && (
                <div>
                  <dt className="text-base-content/50 mb-1">Attachments</dt>
                  <dd>{files.length} file(s)</dd>
                </div>
              )}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between mt-8 pt-4 border-t border-base-300">
        <button type="button" onClick={goBack} disabled={step === 0} className="btn btn-ghost btn-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} className="btn btn-primary btn-sm">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={submitHandler} disabled={submitting} className="btn btn-primary-cta">
            {submitting ? 'Submitting…' : (
              <>
                <Check className="w-4 h-4" /> Submit ticket
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function loadDraft() {
  if (typeof window === 'undefined') {
    return { ticketType: '', subject: '', description: '', priority: 'medium', booking: null };
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore malformed draft */
  }
  return { ticketType: '', subject: '', description: '', priority: 'medium', booking: null };
}
