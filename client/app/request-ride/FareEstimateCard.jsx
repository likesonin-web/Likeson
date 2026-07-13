'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { IndianRupee, Route, Clock, Info, Sparkles, BadgePercent, CheckCircle2 } from 'lucide-react';
import { haversineKm, estimateFare, estimateEtaMinutes, DEFAULT_KM_RATE } from '@/lib/geo';

const RATE_SOURCE_LABEL = {
  subscription:      'Subscription discount applied',
  care_ride_config:  'Standard care ride rate',
  default:           'Standard rate',
};

/**
 * FareEstimateCard
 * - Before a quote exists: shows a client-side preview (haversine distance ×
 *   fallback rate). Clearly marked "Estimate" — never the real charge.
 * - Once `quote` (from POST /ride-requests/quote) is passed in: switches to
 *   showing the OFFICIAL server-computed fare, including whether a
 *   subscription discount was applied.
 */
export default function FareEstimateCard({ pickup, destination, ratePerKm = DEFAULT_KM_RATE, quote = null }) {
  const canPreview = Boolean(pickup?.coordinates && destination?.coordinates);
  const isOfficial = Boolean(quote);

  const distanceKm = isOfficial
    ? quote.distKm
    : canPreview
      ? haversineKm(pickup.coordinates, destination.coordinates)
      : 0;

  const fare = isOfficial ? quote.transportFee : (canPreview ? estimateFare(distanceKm, ratePerKm) : 0);
  const eta = canPreview || isOfficial ? estimateEtaMinutes(distanceKm) : 0;

  const visible = isOfficial || canPreview;
  const isSubscriptionDiscount = quote?.rateSource === 'subscription';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className={`relative rounded-2xl border p-5 shadow-sm ${
            isOfficial
              ? 'border-success/25 bg-gradient-to-br from-success/[0.06] via-base-100 to-success/[0.03]'
              : 'border-primary/15 bg-gradient-to-br from-primary/[0.06] via-base-100 to-secondary/[0.04]'
          }`}>
            <div className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 ${
              isOfficial ? 'bg-success/10' : 'bg-primary/10'
            }`}>
              {isOfficial ? (
                <CheckCircle2 className="w-3 h-3 text-success" />
              ) : (
                <Sparkles className="w-3 h-3 text-primary" />
              )}
              <span className={`text-[9px] font-black uppercase tracking-widest ${
                isOfficial ? 'text-success' : 'text-primary'
              }`}>
                {isOfficial ? 'Confirmed Quote' : 'Estimate'}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${
                isOfficial ? 'bg-success/10' : 'bg-primary/10'
              }`}>
                <IndianRupee className={`w-5 h-5 ${isOfficial ? 'text-success' : 'text-primary'}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-base-content/50 uppercase tracking-wide">
                  {isOfficial ? 'Fare to pay' : 'Estimated fare'}
                </p>
                <p className={`text-3xl font-black leading-tight tabular-nums ${
                  isOfficial ? 'text-success' : 'text-primary'
                }`}>
                  ₹{fare.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {isOfficial && quote?.rateSource && (
              <div className={`flex items-center gap-1.5 mt-3 rounded-lg px-3 py-1.5 ${
                isSubscriptionDiscount ? 'bg-success/10' : 'bg-base-200/70'
              }`}>
                <BadgePercent className={`w-3.5 h-3.5 shrink-0 ${
                  isSubscriptionDiscount ? 'text-success' : 'text-base-content/40'
                }`} />
                <p className={`text-[11px] font-semibold ${
                  isSubscriptionDiscount ? 'text-success' : 'text-base-content/50'
                }`}>
                  {RATE_SOURCE_LABEL[quote.rateSource] ?? 'Standard rate'} — ₹{quote.ratePerKm}/km
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="flex items-center gap-2 rounded-xl bg-base-200/70 px-3 py-2">
                <Route className="w-3.5 h-3.5 text-secondary shrink-0" />
                <div>
                  <p className="text-[9px] font-semibold text-base-content/40 uppercase tracking-wide">
                    Distance
                  </p>
                  <p className="text-sm font-bold tabular-nums">{distanceKm.toFixed(1)} km</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-base-200/70 px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-info shrink-0" />
                <div>
                  <p className="text-[9px] font-semibold text-base-content/40 uppercase tracking-wide">
                    ETA
                  </p>
                  <p className="text-sm font-bold tabular-nums">~{eta} min</p>
                </div>
              </div>
            </div>

            {!isOfficial && (
              <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-base-300/60">
                <Info className="w-3 h-3 mt-0.5 shrink-0 text-error" />
                <p className="text-[10.5px] leading-snug text-error text-base-content/45">
                  Approximate only — get an official quote to see your real fare,
                  including any subscription discount.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}