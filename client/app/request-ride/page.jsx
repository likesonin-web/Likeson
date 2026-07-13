'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import {
  MapPin,
  Navigation,
  Calendar,
  Hash,
  FileText,
  Loader2,
  CheckCircle2,
  IndianRupee,
  ArrowRight,
  AlertTriangle,
  Wallet as WalletIcon,
  CreditCard,
  Gift,
} from 'lucide-react';

import LocationAutocomplete from './LocationAutocomplete';
import FareEstimateCard from './FareEstimateCard';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { DEFAULT_KM_RATE } from '@/lib/geo';
import {
  quoteRide,
  confirmRide,
  selectQuote,
  selectCreatedRide,
  selectRideLoading,
  selectRideErrors,
  clearQuote,
  clearCreatedRide,
} from '@/store/slices/rideRequestSlice';
import {
  fetchWalletDetails,
  selectWalletBalance,
  selectWalletLoading as selectWalletDetailsLoading,
} from '@/store/slices/walletSlice';

// "Now" rounded to the current minute, in the format datetime-local expects.
function getMinScheduleValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function sameLocation(a, b) {
  if (!a?.coordinates || !b?.coordinates) return false;
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  return Math.abs(lng1 - lng2) < 0.0001 && Math.abs(lat1 - lat2) < 0.0001;
}

// Adjust this path/shape if your auth slice differs.
// Expected shape: state.auth.user = { _id, name, role: 'customer' | 'care_assistant' | ... }
function useCurrentUserRole() {
  return useSelector((s) => s.user?.user?.role) || 'customer';
}

export default function RequestRidePage() {
  const dispatch = useDispatch();
  const role = useCurrentUserRole(); // 'customer' | 'care_assistant'
  const isCareAssistant = role === 'care_assistant';

  const quote = useSelector(selectQuote);
  const createdRide = useSelector(selectCreatedRide);
  const loading = useSelector(selectRideLoading) ?? {};
  const errors = useSelector(selectRideErrors) ?? {};

  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useGoogleMaps();

  // FIX: live wallet balance from walletSlice — not just the snapshot
  // baked into the /quote response, which can go stale (e.g. user tops
  // up wallet in another tab while this page is open).
  const liveWalletBalance = useSelector(selectWalletBalance);
  const walletDetailsLoading = useSelector(selectWalletDetailsLoading);

  useEffect(() => {
    dispatch(fetchWalletDetails());
  }, [dispatch]);

  // FIX: preview should reflect the user's OWN subscription transport rate
  // (if any benefit exists) instead of always falling back to ₹21/km —
  // avoids a scary mismatch between preview and the official quote.
  // Adjust selector path to match your subscription slice.
  const mySubTransportRate = useSelector(
    (s) => s.subscription?.mySubscription?.limits?.transportRatePerKm
  );
  const previewRatePerKm =
    mySubTransportRate != null && mySubTransportRate > 0
      ? mySubTransportRate
      : DEFAULT_KM_RATE;

  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [paying, setPaying] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const isQuoting = Boolean(loading.quote);
  const isConfirming = Boolean(loading.confirm);
  const minScheduleValue = useMemo(() => getMinScheduleValue(), []);

  const locationsIdentical = sameLocation(pickup, destination);
  const canQuote =
    Boolean(pickup?.coordinates) &&
    Boolean(destination?.coordinates) &&
    !locationsIdentical &&
    Boolean(bookingId.trim()) &&
    !isQuoting &&
    !isConfirming;

  useEffect(() => {
    if (!locationsIdentical && formError === "Pickup and drop-off can't be the same place.") {
      setFormError('');
    }
  }, [locationsIdentical, formError]);

  // ── Step 1: get an official, subscription-aware quote ────────────────────
  const handleGetQuote = useCallback(
    (e) => {
      e.preventDefault();
      if (isQuoting || isConfirming) return;

      if (!bookingId.trim()) {
        setFormError('Booking ID is required — every ride must be linked to a booking.');
        return;
      }
      if (!pickup?.coordinates || !destination?.coordinates) {
        setFormError('Please select both a pickup and a drop-off location from the suggestions.');
        return;
      }
      if (locationsIdentical) {
        setFormError("Pickup and drop-off can't be the same place.");
        return;
      }
      setFormError('');

      dispatch(
        quoteRide({
          bookingId: bookingId.trim(),
          bookingCode: bookingId.trim(), // FIX: same input, sent as both keys — backend tries valid ObjectId first, falls back to bookingCode
          pickupLocation: pickup,
          destinationLocation: destination,
          scheduledAt: scheduledAt || undefined,
          notes: notes.trim() || undefined,
        }),
      );
    },
    [dispatch, pickup, destination, scheduledAt, bookingId, notes, isQuoting, isConfirming, locationsIdentical],
  );

  // ── Step 2a: free ride (₹0 fare, e.g. fully covered by subscription) ─────
  // Auto-confirm the moment a zero-fee quote arrives — no payment step needed.
  useEffect(() => {
    if (quote && !quote.requiresPayment && !createdRide && !isConfirming) {
      dispatch(confirmRide({ intentId: quote.intentId }));
    }
  }, [quote, createdRide, isConfirming, dispatch]);

  // ── Step 2b: pay via Razorpay ──────────────────────────────────────────
  const payWithRazorpay = useCallback(() => {
    if (!quote?.razorpay || !razorpayReady || typeof window === 'undefined' || !window.Razorpay) {
      setFormError('Payment gateway still loading — please wait a moment and try again.');
      return;
    }
    setPaying(true);
    const rzp = new window.Razorpay({
      key: quote.razorpay.keyId,
      amount: Math.round(quote.razorpay.amount * 100),
      currency: 'INR',
      order_id: quote.razorpay.orderId,
      name: 'Likeson Healthcare',
      description: 'Ride transport fee',
      theme: { color: '#0f3460' },
      handler: (response) => {
        dispatch(
          confirmRide({
            intentId: quote.intentId,
            paymentMethod: 'razorpay',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        ).finally(() => setPaying(false));
      },
      modal: {
        ondismiss: () => setPaying(false),
      },
    });
    rzp.on('payment.failed', () => setPaying(false));
    rzp.open();
  }, [quote, razorpayReady, dispatch]);

  // ── Step 2c: pay from wallet ──────────────────────────────────────────
  const payWithWallet = useCallback(() => {
    if (!quote) return;
    setPaying(true);
    dispatch(confirmRide({ intentId: quote.intentId, paymentMethod: 'wallet' }))
      .finally(() => {
        setPaying(false);
        dispatch(fetchWalletDetails()); // refresh live balance after debit
      });
  }, [quote, dispatch]);

  const handleReset = useCallback(() => {
    dispatch(clearCreatedRide());
    dispatch(clearQuote());
    setPickup(null);
    setDestination(null);
    setScheduledAt('');
    setBookingId('');
    setNotes('');
    setFormError('');
  }, [dispatch]);

  const handleEditQuote = useCallback(() => {
    dispatch(clearQuote());
  }, [dispatch]);

  const displayError = formError || errors.quote || errors.confirm;

  return (
    <div data-theme={isCareAssistant ? 'care_assistant' : 'customer'} className="min-h-screen bg-base-100 py-8 px-4">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRazorpayReady(true)}
      />

      <div className="container-custom max-w-lg">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="section-heading !mb-1 flex items-center gap-2">
            <Navigation className="w-7 h-7 text-primary" />
            {isCareAssistant ? 'Request a Ride for Patient' : 'Request a Ride'}
          </h1>
          <p className="section-subheading !mb-0">
            {isCareAssistant
              ? "Enter the patient's booking, pickup and drop-off to get a fare quote."
              : 'Enter your pickup and drop-off to get an instant fare quote.'}
          </p>
        </motion.div>

        {mapsLoadError && (
          <div className="alert alert-warning mb-4" role="alert">
            <p className="text-sm">
              Location search failed to load. You can still submit if the API is restored — try refreshing the page.
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── SUCCESS ── */}
          {createdRide ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="btn-circle bg-success/10">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Ride requested</h3>
                  <p className="label-text-alt !mt-0">Waiting for driver assignment.</p>
                </div>
              </div>

              <div className="stat-card mb-3">
                <p className="stat-card-label">Fare paid</p>
                <p className="stat-card-value flex items-center gap-1">
                  <IndianRupee className="w-6 h-6" />
                  {Number(createdRide.transportFee ?? 0).toLocaleString('en-IN')}
                </p>
              </div>

              <button type="button" onClick={handleReset} className="btn btn-outline w-full">
                Request another ride
              </button>
            </motion.div>
          ) : quote ? (
            /* ── QUOTE / PAYMENT STEP ── */
            <motion.div
              key="quote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card p-5 space-y-5"
            >
              <FareEstimateCard pickup={pickup} destination={destination} quote={quote} />

              {quote.requiresPayment ? (
                <div className="space-y-2.5">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    Choose payment method
                  </p>

                  <button
                    type="button"
                    onClick={payWithRazorpay}
                    disabled={paying || isConfirming || !razorpayReady}
                    className="btn-primary-cta w-full flex items-center justify-center gap-2"
                  >
                    {paying || isConfirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Pay ₹{quote.transportFee.toLocaleString('en-IN')} Online (Razorpay)
                  </button>

                  <button
                    type="button"
                    onClick={payWithWallet}
                    disabled={paying || isConfirming || liveWalletBalance < quote.transportFee}
                    className="btn btn-outline w-full flex items-center justify-center gap-2"
                  >
                    <WalletIcon className="w-4 h-4" />
                    {walletDetailsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Pay from Wallet (₹{liveWalletBalance.toLocaleString('en-IN')} available)</>
                    )}
                  </button>

                  {liveWalletBalance < quote.transportFee && !walletDetailsLoading && (
                    <p className="text-xs text-warning flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Wallet balance is insufficient for this fare.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleEditQuote}
                    disabled={paying || isConfirming}
                    className="btn btn-ghost btn-sm w-full"
                  >
                    ← Edit ride details
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center py-4 text-success">
                  <Gift className="w-5 h-5" />
                  <p className="text-sm font-semibold">Free ride — confirming automatically…</p>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}

              {displayError && (
                <div className="alert alert-error" role="alert" aria-live="polite">
                  <p className="text-sm">{displayError}</p>
                </div>
              )}
            </motion.div>
          ) : (
            /* ── FORM ── */
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleGetQuote}
              className="card p-5 space-y-5"
              aria-busy={isQuoting}
            >
              <fieldset disabled={isQuoting} className="space-y-5 contents">
                <div>
                  <label htmlFor="bookingId" className="label-text mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-primary" />
                    Booking ID or Code
                    <span className="text-error">*</span>
                  </label>
                  <input
                    id="bookingId"
                    type="text"
                    required
                    className="input-field"
                    placeholder={isCareAssistant ? "Patient's booking ID or code" : 'Your booking ID or code'}
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    maxLength={64}
                  />
                  <p className="label-text-alt mt-1">
                    Booking ID or booking code both work — every ride must be linked to a booking.
                  </p>
                </div>

                <LocationAutocomplete
                  label="Pickup location"
                  note={isCareAssistant ? "Where should the driver pick the patient up from?" : 'Where should the driver pick you up from?'}
                  placeholder="Search pickup address"
                  icon={MapPin}
                  value={pickup}
                  onChange={setPickup}
                  isLoaded={mapsLoaded}
                  loadError={mapsLoadError}
                  required
                />

                <LocationAutocomplete
                  label="Drop-off location"
                  note="Hospital, clinic, or destination address."
                  placeholder="Search destination address"
                  icon={Navigation}
                  value={destination}
                  onChange={setDestination}
                  isLoaded={mapsLoaded}
                  loadError={mapsLoadError}
                  required
                />

                {locationsIdentical && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Pickup and drop-off look like the same place.
                  </p>
                )}

                <FareEstimateCard pickup={pickup} destination={destination} ratePerKm={previewRatePerKm} />

                <div>
                  <label htmlFor="scheduledAt" className="label-text mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Scheduled time
                  </label>
                  <input
                    id="scheduledAt"
                    type="datetime-local"
                    className="input-field"
                    min={minScheduleValue}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  <p className="label-text-alt mt-1">Leave blank to request a ride immediately.</p>
                </div>

                <div>
                  <label htmlFor="notes" className="label-text mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Notes for driver
                  </label>
                  <textarea
                    id="notes"
                    className="input-field resize-none"
                    rows={3}
                    placeholder="E.g. wheelchair needed, call on arrival..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={300}
                  />
                  <p className="label-text-alt mt-1">
                    Anything the driver or admin should know before assigning your ride.
                  </p>
                </div>
              </fieldset>

              {displayError && (
                <div className="alert alert-error" role="alert" aria-live="polite">
                  <p className="text-sm">{displayError}</p>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={!canQuote}
                className="btn-primary-cta w-full flex items-center justify-center gap-2"
              >
                {isQuoting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Getting quote...
                  </>
                ) : (
                  <>
                    Get Fare Quote
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}