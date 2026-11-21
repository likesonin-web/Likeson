import { verifyRazorpayPayment } from "@/store/slices/bookingSlice";
import {
  RAZORPAY_KEY,
  STEPS_MAP,
  STEP_LABELS_MAP,
  DEFAULT_STEPS,
  ALL_STEP_DEFS,
} from "./constants";

export const fmt = (n = 0) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const normalizeId = (id) => {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return id?.toString?.() ?? String(id);
};

export const getSteps = (bookingType) => {
  const keys =
    bookingType && STEPS_MAP[bookingType]
      ? STEPS_MAP[bookingType]
      : DEFAULT_STEPS;
  const labels =
    bookingType && STEP_LABELS_MAP[bookingType]
      ? STEP_LABELS_MAP[bookingType]
      : {};
  return keys.map((k, i) => ({
    ...ALL_STEP_DEFS[k],
    label: labels[k] || ALL_STEP_DEFS[k].label,
    num: i + 1,
  }));
};

export const toISOSafe = (dtLocal) => {
  if (!dtLocal) return undefined;
  let raw = String(dtLocal).trim();

  // If it's a standard datetime-local output (YYYY-MM-DDTHH:mm)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00+05:30`; // Force IST timezone explicitly
  }

  // If it already has seconds but no timezone (YYYY-MM-DDTHH:mm:ss)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw}+05:30`;
  }

  // Fallback for already formatted strings
  return raw;
};

export const loadRazorpay = () =>
  new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export const openRazorpay = async ({
  order,
  bookingId,
  name,
  description,
  prefill,
  onSuccess,
  onFailure,
  dispatch,
}) => {
  const activeKey = (order?.key_id || order?.razorpayKey || RAZORPAY_KEY || "").trim();
  if (!activeKey) {
    onFailure?.("Payment configuration missing. Contact support.");
    return;
  }
  if (
    !activeKey.startsWith("rzp_test_") &&
    !activeKey.startsWith("rzp_live_")
  ) {
    onFailure?.("Payment configuration error — invalid key. Contact support.");
    return;
  }
  const loaded = await loadRazorpay();
  if (!loaded) {
    onFailure?.("Razorpay failed to load. Check your internet connection.");
    return;
  }

  const options = {
    key: activeKey,
    amount: Math.round((order.amount || 0) * 100),
    currency: order.currency || "INR",
    name: "Likeson.in",
    description: description || "Healthcare Booking",
    order_id: order.orderId,
    prefill: prefill || {},
    theme: { color: "#4f46e5" },
    handler: async (response) => {
      try {
        if (dispatch && bookingId) {
          const verifyResult = await dispatch(
            verifyRazorpayPayment({
              bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          );
          if (
            verifyResult?.error ||
            verifyResult?.payload?.success === false ||
            !verifyResult?.payload?.success
          ) {
            onFailure?.(
              verifyResult?.error?.message ||
                "Payment verification failed — contact support with payment ID: " +
                  response.razorpay_payment_id,
            );
            return;
          }
        }
        onSuccess?.({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      } catch (err) {
        onFailure?.(
          err?.message || "Payment verification error — contact support.",
        );
      }
    },
    modal: { ondismiss: () => onFailure?.("Payment cancelled by user") },
  };
  const rz = new window.Razorpay(options);
  rz.on("payment.failed", (r) =>
    onFailure?.(r.error?.description || "Payment failed"),
  );
  rz.open();
};
