// Client-side mirror of backend haversineKm (bookingRouterShared.js).
// Used ONLY for the pre-quote live estimate shown while the user is still
// picking pickup/destination. The real fare/rate ALWAYS comes from the
// /ride-requests/quote API response — this is a preview, never the charge.

export const DEFAULT_KM_RATE = 21; // ₹/km fallback, matches backend DEFAULT_KM_RATE

export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateFare(distanceKm, ratePerKm = DEFAULT_KM_RATE) {
  if (!distanceKm || distanceKm <= 0) return 0;
  return +(distanceKm * ratePerKm).toFixed(2);
}

export function estimateEtaMinutes(distanceKm, avgSpeedKmh = 28) {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}