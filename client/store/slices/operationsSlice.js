import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

import API from "../api";
import socketService, { DRIVER_STATUS } from "@/services/socketService";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BASE      = "/bookings";
const RIDE_OPS  = "/ride-ops";

const mkThunk = (type, fn) =>
  createAsyncThunk(type, async (arg, api) => {
    try {
      return await fn(arg, api);
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || "Something went wrong";
      toast.error(msg);
      return api.rejectWithValue(msg);
    }
  });

const downloadBlob = (data, filename, mime = "application/octet-stream") => {
  const url = window.URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL CARE RIDE STATUS SHAPE
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_CARE_RIDE_STATUS = {
  status: null,
  activeTarget: null,
  activeNavigationTarget: null,
  rideStage: null,
  currentLeg: null,
  patientPickedUp: false,
  careAssistantJoined: false,
  hospitalReached: false,
  handoverCompleted: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Lists ─────────────────────────────────────────────────────────────────
  adminBookings: [],
  adminBookingsMeta: { total: 0, page: 1, pages: 1 },
  adminStats: null,

  adminOps: [],
  adminOpsMeta: { total: 0, page: 1, pages: 1 },

  // SOS
  adminActiveSos: [],
  adminActiveSosMeta: { total: 0, page: 1, pages: 1 },

  // Destination audit
  destinationAudit: [],

  tpAssignedBookings: [],
  tpAvailableDrivers: [],

  careAssignedBookings: [],

  hospitalUpcoming: [],
  hospitalOps: [],
  hospitalOpsMeta: { total: 0, page: 1, pages: 1 },
  hospitalValidOps: [],
  hospitalValidOpsMeta: { total: 0, page: 1, pages: 1 },

  doctorOps: [],
  doctorOpsMeta: { total: 0, page: 1, pages: 1 },

  driverAssignedRides: [],
  driverInfo: null,

  nearbyDrivers: [],
  nearbyCareAssistants: [],
  nearbyTPs: [],
  nearbyHospitals: [],
  careRideNearby: null,

  // ── Ride Operations (rideOperationsRouter) ─────────────────────────────────
  rideParticipants: [],
  rideStops: [],
  rideJoinPoints: [],
  rideRouteVersions: [],
  activeRouteVersion: null,
bookingAssignmentHistory: [],
  rideAssignmentHistory: [],
  bookingSosEvents: [],
  bookingStatusHistory: [],
  vehicleReplacement: null,

  // ── Consultation ───────────────────────────────────────────────────────────
  consultation: null,
  consultationJoinToken: null,
  consultationChat: [],

  // ── CA tracking state ──────────────────────────────────────────────────────
  careTrackingSnapshot: null,
  careAssistantLocation: null,
  careAssistantStatus: null,
  careAssistantJoined: null,
  careRideStatus: { ...INITIAL_CARE_RIDE_STATUS },
  caJoinPoint: null,

  // ── Single-record ──────────────────────────────────────────────────────────
  selectedBooking: null,
  selectedOp: null,
  selectedFollowUps: [],
  bookingSnapshot: null,
  activeRide: null,

  // CA view mode
  caViewMode: null,
  caHasJoined: false,
  caAtJoinPoint: false,

  // ── Admin operation results ────────────────────────────────────────────────
  adminStatusUpdate: null,
  adminAssignment: null,
  adminRefund: null,
  adminOpStatusUpdate: null,

  // ── Socket / live state ────────────────────────────────────────────────────
  liveLocation: null,
  etaUpdate: null,
  rideStatus: null,
  bookingStatus: null,
  navigationTarget: null,
  sosAlert: null,
  routeDeviation: null,
  otpResult: null,
  gpsTracking: false,
  socketConnected: false,

  // ── Loading / error maps ───────────────────────────────────────────────────
  loading: {},
  errors: {},
};

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — TRANSPORT PARTNER  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchTpAssignedBookings = mkThunk(
  "operations/fetchTpAssignedBookings",
  async () => {
    const { data } = await API.get(`${BASE}/tp/assigned`);
    return data.data;
  }
);

export const fetchTpAvailableDrivers = mkThunk(
  "operations/fetchTpAvailableDrivers",
  async () => {
    const { data } = await API.get(`${BASE}/tp/drivers/available`);
    return data.data;
  }
);

export const tpAssignDriver = mkThunk(
  "operations/tpAssignDriver",
  async ({ bookingId, driverId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/tp/assign-driver`, {
      driverId,
    });
    toast.success("Driver assigned");
    return data.data;
  }
);

export const tpReassignDriver = mkThunk(
  "operations/tpReassignDriver",
  async ({ bookingId, newDriverId }) => {
    const { data } = await API.patch(
      `${BASE}/${bookingId}/tp/reassign-driver`,
      { newDriverId }
    );
    toast.success("Driver reassigned");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — CONSULTATION  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /consultations/:bookingId */
export const fetchConsultation = mkThunk(
  "operations/fetchConsultation",
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/consultations/${bookingId}`);
    return data.data;
  }
);

/** PATCH /consultations/:consultationId/confirm */
export const confirmConsultation = mkThunk(
  "operations/confirmConsultation",
  async ({ consultationId, consentAccepted = false }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/confirm`,
      { consentAccepted }
    );
    toast.success("Consultation confirmed — OP sent to patient");
    return data.data;
  }
);

/** PATCH /consultations/:consultationId/accept */
export const acceptConsultation = mkThunk(
  "operations/acceptConsultation",
  async ({ consultationId }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/accept`
    );
    toast.success("Consultation accepted — patient notified");
    return data.data;
  }
);

/** PATCH /consultations/:consultationId/start */
export const startConsultation = mkThunk(
  "operations/startConsultation",
  async ({ consultationId }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/start`
    );
    toast.success("Consultation started");
    return data.data;
  }
);

/** PATCH /consultations/:consultationId/end */
export const endConsultation = mkThunk(
  "operations/endConsultation",
  async ({ consultationId, reason, prescriptionUploaded = false }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/end`,
      { reason, prescriptionUploaded }
    );
    toast.success("Consultation ended");
    return data.data;
  }
);

/** PATCH /consultations/:consultationId/consent */
export const submitConsultationConsent = mkThunk(
  "operations/submitConsultationConsent",
  async ({ consultationId, consentType = "telemedicine", accepted = true }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/consent`,
      { consentType, accepted }
    );
    return data.data;
  }
);

/** POST /consultations/:consultationId/chat */
export const sendConsultationChat = mkThunk(
  "operations/sendConsultationChat",
  async ({ consultationId, message, messageType = "text" }) => {
    const { data } = await API.post(
      `${BASE}/consultations/${consultationId}/chat`,
      { message, messageType }
    );
    return data.data;
  }
);

/** GET /consultations/:consultationId/join-token */
export const fetchConsultationJoinToken = mkThunk(
  "operations/fetchConsultationJoinToken",
  async ({ consultationId }) => {
    const { data } = await API.get(
      `${BASE}/consultations/${consultationId}/join-token`
    );
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — CARE ASSISTANT  (bookingRouter2 + bookingRouter3)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchCareAssignedBookings = mkThunk(
  "operations/fetchCareAssignedBookings",
  async () => {
    const { data } = await API.get(`${BASE}/care/assigned`);
    return data.data;
  }
);

export const markCareArrived = mkThunk(
  "operations/markCareArrived",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/arrived`);
    toast.success("Arrival marked");
    return data;
  }
);

export const markCareStart = mkThunk(
  "operations/markCareStart",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/start`);
    toast.success("Task started");
    return data;
  }
);

export const markCareComplete = mkThunk(
  "operations/markCareComplete",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/complete`);
    toast.success("Task completed");
    return data;
  }
);

export const updateCareLocation = mkThunk(
  "operations/updateCareLocation",
  async ({ lat, lng, bookingId, status }) => {
    const { data } = await API.patch(`${BASE}/care/location`, {
      lat,
      lng,
      bookingId,
      status,
    });
    return data;
  }
);

/** POST /:id/care/request-ride (care_assistant role — bookingRouter3) */
export const careRequestRide = mkThunk(
  "operations/careRequestRide",
  async ({ bookingId, pickupLocation, destinationLocation }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/care/request-ride`, {
      pickupLocation,
      destinationLocation,
    });
    toast.success("Ride requested");
    return data.data;
  }
);

/** POST /:id/care/join-ride — CA attaches to RideTracking doc (bookingRouter2) */
export const careJoinRide = mkThunk(
  "operations/careJoinRide",
  async ({ bookingId, currentLat, currentLng }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/care/join-ride`, {
      currentLat,
      currentLng,
    });
    toast.success("Joined ride session");
    return data.data;
  }
);

/** PATCH /:id/care/reached-jp — CA signals arrived at join point */
export const careReachedJoinPoint = mkThunk(
  "operations/careReachedJoinPoint",
  async ({ bookingId, lat, lng }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/reached-jp`, {
      lat,
      lng,
    });
    toast.success("Marked as reached join point");
    return data.data;
  }
);

/** PATCH /:id/care/ride-status */
export const careUpdateRideStatus = mkThunk(
  "operations/careUpdateRideStatus",
  async ({ bookingId, status, lat, lng }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/ride-status`, {
      status,
      lat,
      lng,
    });
    return data.data;
  }
);

/** GET /:id/care/tracking-snapshot */
export const fetchCareTrackingSnapshot = mkThunk(
  "operations/fetchCareTrackingSnapshot",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/${bookingId}/care/tracking-snapshot`
    );
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — HOSPITAL  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchHospitalUpcoming = mkThunk(
  "operations/fetchHospitalUpcoming",
  async () => {
    const { data } = await API.get(`${BASE}/hospital/upcoming`);
    return data.data;
  }
);

export const hospitalConfirmBooking = mkThunk(
  "operations/hospitalConfirmBooking",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/hospital/confirm`);
    toast.success("Appointment confirmed");
    return data;
  }
);

export const fetchHospitalOps = mkThunk(
  "operations/fetchHospitalOps",
  async ({ hospitalId, status, doctorId, date, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/hospital/${hospitalId}/ops`, {
      params: { status, doctorId, date, page, limit },
    });
    return data.data;
  }
);

export const fetchHospitalValidOps = mkThunk(
  "operations/fetchHospitalValidOps",
  async ({ hospitalId, doctorId, patientId, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/hospital/${hospitalId}/valid-ops`, {
      params: { doctorId, patientId, page, limit },
    });
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — DOCTOR  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchDoctorOps = mkThunk(
  "operations/fetchDoctorOps",
  async ({
    status,
    hospitalId,
    patientId,
    date,
    page = 1,
    limit = 20,
  } = {}) => {
    const { data } = await API.get(`${BASE}/doctor/ops`, {
      params: { status, hospitalId, patientId, date, page, limit },
    });
    return data.data;
  }
);

export const fetchDoctorOpByNumber = mkThunk(
  "operations/fetchDoctorOpByNumber",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/doctor/ops/${opNumber}`);
    return data.data;
  }
);

export const completeOp = mkThunk(
  "operations/completeOp",
  async ({
    bookingId,
    doctorNotes,
    prescriptionUrl,
    diagnosisCode,
    reasonForVisit,
  }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/op/complete`, {
      doctorNotes,
      prescriptionUrl,
      diagnosisCode,
      reasonForVisit,
    });
    toast.success("OP completed — sent to patient");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — OP CARD  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchOpByNumber = mkThunk(
  "operations/fetchOpByNumber",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}`);
    return data.data;
  }
);

export const fetchOpFollowUps = mkThunk(
  "operations/fetchOpFollowUps",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}/follow-ups`);
    return data.data;
  }
);

export const downloadOpCard = mkThunk(
  "operations/downloadOpCard",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}/download`, {
      responseType: "blob",
    });
    downloadBlob(data, `${opNumber}.zip`, "application/zip");
    return { opNumber };
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — DRIVER  (bookingRouter3)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchDriverAssignedRides = mkThunk(
  "operations/fetchDriverAssignedRides",
  async () => {
    const { data } = await API.get(`${BASE}/driver/assigned`);
    return data.data;
  }
);

export const acceptRide = mkThunk(
  "operations/acceptRide",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/accept`);
    toast.success("Ride accepted");
    return data.data;
  }
);

export const rejectRide = mkThunk(
  "operations/rejectRide",
  async ({ bookingId, reason }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/reject`, {
      reason,
    });
    toast.success("Ride rejected");
    return data;
  }
);

export const markDriverArrived = mkThunk(
  "operations/markDriverArrived",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/arrived`);
    toast.success("Arrival marked — OTP sent to customer");
    return data;
  }
);

/** PATCH /:id/ride/verify-otp */
export const verifyRideOtp = mkThunk(
  "operations/verifyRideOtp",
  async ({ bookingId, otp }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/verify-otp`, {
      otp,
    });
    toast.success("OTP verified — ride started");
    return data.data;
  }
);

/** PATCH /:id/ride/arrived-stop — driver marks arrival at any stop */
export const markArrivedStop = mkThunk(
  "operations/markArrivedStop",
  async ({ bookingId, stopId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/arrived-stop`, {
      stopId,
    });
    toast.success(`Arrived at stop`);
    return data.data;
  }
);

/** PATCH /:id/ride/depart-stop — driver departs from current stop */
export const departStop = mkThunk(
  "operations/departStop",
  async ({ bookingId, stopId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/depart-stop`, {
      stopId,
    });
    toast.success("Departed from stop");
    return data.data;
  }
);

export const endRide = mkThunk(
  "operations/endRide",
  async ({ bookingId, dropPhotoUrl, actualDistanceKm }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/ride/end`, {
      dropPhotoUrl,
      actualDistanceKm,
    });
    toast.success(data.message || "Ride completed");
    return data.data;
  }
);

export const updateDriverLocationHttp = mkThunk(
  "operations/updateDriverLocationHttp",
  async ({ lat, lng, heading, speed, bookingId }) => {
    const { data } = await API.patch(`${BASE}/driver/location`, {
      lat,
      lng,
      heading,
      speed,
      bookingId,
    });
    return data;
  }
);

/** POST /:id/ride/sos — driver triggers SOS */
export const driverTriggerSos = mkThunk(
  "operations/driverTriggerSos",
  async ({ bookingId, sosType, description, coordinates }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/ride/sos`, {
      sosType,
      description,
      coordinates,
    });
    toast.error("SOS triggered — admin notified");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — CUSTOMER  (bookingRouter3)
// ═════════════════════════════════════════════════════════════════════════════

export const customerRequestRide = mkThunk(
  "operations/customerRequestRide",
  async ({ bookingId, pickupLocation, destinationLocation }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/request-ride`, {
      pickupLocation,
      destinationLocation,
    });
    toast.success(data.message || "Ride requested");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN BOOKINGS  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchAdminBookings = mkThunk(
  "operations/fetchAdminBookings",
  async ({
    status,
    bookingType,
    city,
    date,
    page = 1,
    limit = 20,
    search,
    from,
    to,
  } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings`, {
      params: { status, bookingType, city, date, page, limit, search, from, to },
    });
    return data.data;
  }
);

export const fetchAdminBookingStats = mkThunk(
  "operations/fetchAdminBookingStats",
  async ({ from, to } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings/stats`, {
      params: { from, to },
    });
    return data.data;
  }
);

export const exportAdminBookings = mkThunk(
  "operations/exportAdminBookings",
  async ({ from, to, status, bookingType } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings/export`, {
      params: { from, to, status, bookingType },
      responseType: "blob",
    });
    downloadBlob(data, `bookings-${Date.now()}.csv`, "text/csv");
    return { exported: true };
  }
);

export const fetchAdminBookingById = mkThunk(
  "operations/fetchAdminBookingById",
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}`);
    return data.data;
  }
);

export const updateAdminBookingStatus = mkThunk(
  "operations/updateAdminBookingStatus",
  async ({ bookingId, status, note }) => {
    const { data } = await API.patch(
      `${BASE}/admin/bookings/${bookingId}/status`,
      { status, note }
    );
    toast.success("Status updated");
    return data.data;
  }
);

/**
 * PATCH /admin/bookings/:id/destination
 * bookingRouter2 version — changes destination, recalculates route, creates new RouteVersion.
 * Body: { newDestination: { coordinates, address, city }, reason }
 */
export const adminChangeDestination = mkThunk(
  "operations/adminChangeDestination",
  async ({ bookingId, newDestination, reason }) => {
    const { data } = await API.patch(
      `${BASE}/admin/bookings/${bookingId}/destination`,
      { newDestination, reason }
    );
    toast.success("Destination updated");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN NEARBY  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchNearbyCareAssistants = mkThunk(
  "operations/fetchNearbyCareAssistants",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/care-assistants`
    );
    return data.data;
  }
);

export const fetchNearbySoloDrivers = mkThunk(
  "operations/fetchNearbySoloDrivers",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/solo-drivers`
    );
    return data.data;
  }
);

export const fetchNearbyTransportPartners = mkThunk(
  "operations/fetchNearbyTransportPartners",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/transport-partners`
    );
    return data.data;
  }
);

export const fetchNearbyHospitals = mkThunk(
  "operations/fetchNearbyHospitals",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/hospitals`
    );
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN ASSIGN / REASSIGN  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const adminAssignSoloDriver = mkThunk(
  "operations/adminAssignSoloDriver",
  async ({ bookingId, soloDriverPartnerId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/solo-driver`,
      { soloDriverPartnerId }
    );
    toast.success("Solo driver assigned");
    return data.data;
  }
);

export const adminAssignTransportPartner = mkThunk(
  "operations/adminAssignTransportPartner",
  async ({ bookingId, transportPartnerId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/transport-partner`,
      { transportPartnerId }
    );
    toast.success("Transport partner assigned");
    return data.data;
  }
);

export const adminAssignCareAssistant = mkThunk(
  "operations/adminAssignCareAssistant",
  async ({ bookingId, careAssistantId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/care-assistant`,
      { careAssistantId }
    );
    toast.success("Care assistant assigned");
    return data.data;
  }
);

export const adminAssignHospital = mkThunk(
  "operations/adminAssignHospital",
  async ({ bookingId, hospitalId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/hospital`,
      { hospitalId }
    );
    toast.success("Hospital linked");
    return data.data;
  }
);

export const adminReassignCareAssistant = mkThunk(
  "operations/adminReassignCareAssistant",
  async ({ bookingId, newCareAssistantId }) => {
    const { data } = await API.patch(
      `${BASE}/admin/bookings/${bookingId}/reassign/care`,
      { newCareAssistantId }
    );
    toast.success("Care assistant reassigned");
    return data;
  }
);

export const adminProcessRefund = mkThunk(
  "operations/adminProcessRefund",
  async ({ bookingId, refundAmount, reason }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/refund`,
      { refundAmount, reason }
    );
    toast.success("Refund initiated");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN OPS  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

export const fetchAdminOps = mkThunk(
  "operations/fetchAdminOps",
  async ({
    doctorId,
    hospitalId,
    date,
    page = 1,
    limit = 20,
    status,
    patientId,
  } = {}) => {
    const { data } = await API.get(`${BASE}/admin/ops`, {
      params: { doctorId, hospitalId, date, page, limit, status, patientId },
    });
    return data.data;
  }
);

export const updateAdminOpStatus = mkThunk(
  "operations/updateAdminOpStatus",
  async ({ opId, status, doctorNotes }) => {
    const { data } = await API.patch(`${BASE}/admin/ops/${opId}/status`, {
      status,
      doctorNotes,
    });
    toast.success("OP status updated");
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN SOS  (bookingRouter2)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /admin/sos/active — bookingRouter2 version (no pagination) */
export const fetchAdminActiveSos = mkThunk(
  "operations/fetchAdminActiveSos",
  async () => {
    const { data } = await API.get(`${BASE}/admin/sos/active`);
    return data.data;
  }
);

/** PATCH /admin/sos/:sosEventId/resolve — bookingRouter2 */
export const resolveAdminSos = mkThunk(
  "operations/resolveAdminSos",
  async ({ sosEventId, resolutionNotes }) => {
    const { data } = await API.patch(
      `${BASE}/admin/sos/${sosEventId}/resolve`,
      { resolutionNotes }
    );
    toast.success("SOS resolved");
    return data.data;
  }
);

/** GET /admin/destination-audit/:bookingId — bookingRouter2 */
export const fetchAdminDestinationAudit = mkThunk(
  "operations/fetchAdminDestinationAudit",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/destination-audit/${bookingId}`
    );
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN CARE-RIDE  (bookingRouter3)
// ═════════════════════════════════════════════════════════════════════════════

export const adminRequestCareRide = mkThunk(
  "operations/adminRequestCareRide",
  async ({
    bookingId,
    customerId,
    requesterType,
    careAssistantId,
    pickupLocation,
    destinationLocation,
  }) => {
    const { data } = await API.post(`${BASE}/admin/care-ride/request`, {
      bookingId,
      customerId,
      requesterType,
      careAssistantId,
      pickupLocation,
      destinationLocation,
    });
    toast.success(data.message || "Care-ride created");
    return data.data;
  }
);

export const fetchAdminCareRideNearby = mkThunk(
  "operations/fetchAdminCareRideNearby",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/care-ride/${bookingId}/nearby`
    );
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — RIDE OPERATIONS ROUTER  (/api/ride-ops)
// ═════════════════════════════════════════════════════════════════════════════

// ── Participants ──────────────────────────────────────────────────────────────

/** GET /ride-ops/rides/:rideId/participants */
export const fetchRideParticipants = mkThunk(
  "operations/fetchRideParticipants",
  async ({ rideId }) => {
    const { data } = await API.get(`${RIDE_OPS}/rides/${rideId}/participants`);
    return data.data;
  }
);

/** POST /ride-ops/rides/:rideId/participants */
export const assignRideParticipant = mkThunk(
  "operations/assignRideParticipant",
  async ({ rideId, role, refModel, refId, joinMode, snapshot, reason }) => {
    const { data } = await API.post(
      `${RIDE_OPS}/rides/${rideId}/participants`,
      { role, refModel, refId, joinMode, snapshot, reason }
    );
    toast.success("Participant assigned");
    return data.data;
  }
);

/** GET /ride-ops/rides/:rideId/participants/:participantId */
export const fetchRideParticipant = mkThunk(
  "operations/fetchRideParticipant",
  async ({ rideId, participantId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/rides/${rideId}/participants/${participantId}`
    );
    return data.data;
  }
);

/** PATCH /ride-ops/rides/:rideId/participants/:participantId/status */
export const updateParticipantStatus = mkThunk(
  "operations/updateParticipantStatus",
  async ({ rideId, participantId, status, lat, lng }) => {
    const { data } = await API.patch(
      `${RIDE_OPS}/rides/${rideId}/participants/${participantId}/status`,
      { status, lat, lng }
    );
    return data.data;
  }
);

/** DELETE /ride-ops/rides/:rideId/participants/:participantId */
export const removeRideParticipant = mkThunk(
  "operations/removeRideParticipant",
  async ({ rideId, participantId, reason }) => {
    const { data } = await API.delete(
      `${RIDE_OPS}/rides/${rideId}/participants/${participantId}`,
      { data: { reason } }
    );
    toast.success("Participant removed");
    return data;
  }
);

// ── Join Points ───────────────────────────────────────────────────────────────

/**
 * POST /ride-ops/admin/bookings/:bookingId/join-point
 * Admin calculates + locks CA join point on active ride.
 */
export const adminCalculateJoinPoint = mkThunk(
  "operations/adminCalculateJoinPoint",
  async ({ bookingId, careAssistantId, caCurrentLat, caCurrentLng }) => {
    const { data } = await API.post(
      `${RIDE_OPS}/admin/bookings/${bookingId}/join-point`,
      { careAssistantId, caCurrentLat, caCurrentLng }
    );
    toast.success("Join point calculated");
    return data.data;
  }
);

/**
 * POST /ride-ops/admin/bookings/:bookingId/join-point/recalc
 * Admin recalculates JP after MISSED event.
 */
export const adminRecalcJoinPoint = mkThunk(
  "operations/adminRecalcJoinPoint",
  async ({ bookingId, careAssistantId, caCurrentLat, caCurrentLng, reason }) => {
    const { data } = await API.post(
      `${RIDE_OPS}/admin/bookings/${bookingId}/join-point/recalc`,
      { careAssistantId, caCurrentLat, caCurrentLng, reason }
    );
    toast.success("Join point recalculated");
    return data.data;
  }
);

/** GET /ride-ops/rides/:rideId/join-points */
export const fetchRideJoinPoints = mkThunk(
  "operations/fetchRideJoinPoints",
  async ({ rideId }) => {
    const { data } = await API.get(`${RIDE_OPS}/rides/${rideId}/join-points`);
    return data.data;
  }
);

/** PATCH /ride-ops/rides/:rideId/join-points/:jpId/status */
export const updateJoinPointStatus = mkThunk(
  "operations/updateJoinPointStatus",
  async ({ rideId, jpId, status, lat, lng }) => {
    const { data } = await API.patch(
      `${RIDE_OPS}/rides/${rideId}/join-points/${jpId}/status`,
      { status, lat, lng }
    );
    return data.data;
  }
);

// ── Ride Stops ────────────────────────────────────────────────────────────────

/** GET /ride-ops/rides/:rideId/stops */
export const fetchRideStops = mkThunk(
  "operations/fetchRideStops",
  async ({ rideId }) => {
    const { data } = await API.get(`${RIDE_OPS}/rides/${rideId}/stops`);
    return data.data;
  }
);

/** GET /ride-ops/rides/:rideId/stops/:stopId */
export const fetchRideStop = mkThunk(
  "operations/fetchRideStop",
  async ({ rideId, stopId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/rides/${rideId}/stops/${stopId}`
    );
    return data.data;
  }
);

/** PATCH /ride-ops/rides/:rideId/stops/:stopId/otp */
export const verifyStopOtp = mkThunk(
  "operations/verifyStopOtp",
  async ({ rideId, stopId, otp }) => {
    const { data } = await API.patch(
      `${RIDE_OPS}/rides/${rideId}/stops/${stopId}/otp`,
      { otp }
    );
    toast.success("OTP verified");
    return data.data;
  }
);

/** PATCH /ride-ops/rides/:rideId/stops/:stopId/status */
export const updateStopStatus = mkThunk(
  "operations/updateStopStatus",
  async ({ rideId, stopId, status, lat, lng }) => {
    const { data } = await API.patch(
      `${RIDE_OPS}/rides/${rideId}/stops/${stopId}/status`,
      { status, lat, lng }
    );
    return data.data;
  }
);

// ── Route Versions ────────────────────────────────────────────────────────────

/** GET /ride-ops/rides/:rideId/route-versions */
export const fetchRouteVersions = mkThunk(
  "operations/fetchRouteVersions",
  async ({ rideId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/rides/${rideId}/route-versions`
    );
    return data.data;
  }
);

/** GET /ride-ops/rides/:rideId/route-versions/active */
export const fetchActiveRouteVersion = mkThunk(
  "operations/fetchActiveRouteVersion",
  async ({ rideId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/rides/${rideId}/route-versions/active`
    );
    return data.data;
  }
);

// ── SOS  (rideOperationsRouter) ───────────────────────────────────────────────

/** POST /ride-ops/bookings/:bookingId/sos — any participant triggers SOS */
export const triggerBookingSos = mkThunk(
  "operations/triggerBookingSos",
  async ({ bookingId, sosType, description, lat, lng, rideId }) => {
    const { data } = await API.post(
      `${RIDE_OPS}/bookings/${bookingId}/sos`,
      { sosType, description, lat, lng, rideId }
    );
    toast.error("SOS triggered — admin notified");
    return data.data;
  }
);

/** GET /ride-ops/bookings/:bookingId/sos */
export const fetchBookingSosEvents = mkThunk(
  "operations/fetchBookingSosEvents",
  async ({ bookingId }) => {
    const { data } = await API.get(`${RIDE_OPS}/bookings/${bookingId}/sos`);
    return data.data;
  }
);

/** PATCH /ride-ops/sos/:sosId/resolve */
export const resolveRideOpsSos = mkThunk(
  "operations/resolveRideOpsSos",
  async ({ sosId, resolutionNotes }) => {
    const { data } = await API.patch(`${RIDE_OPS}/sos/${sosId}/resolve`, {
      resolutionNotes,
    });
    toast.success("SOS resolved");
    return data.data;
  }
);

/**
 * GET /ride-ops/admin/sos/active — paginated version (rideOperationsRouter).
 * Distinct from fetchAdminActiveSos (bookingRouter2 — no pagination).
 */
export const fetchAdminActiveSosPaginated = mkThunk(
  "operations/fetchAdminActiveSosPaginated",
  async ({ sosType, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${RIDE_OPS}/admin/sos/active`, {
      params: { sosType, page, limit },
    });
    return data.data;
  }
);

// ── Destination (rideOperationsRouter version) ────────────────────────────────

/**
 * PATCH /ride-ops/admin/bookings/:bookingId/destination
 * rideOperationsRouter version — requires destinationLockedAt (driver accepted).
 * Body: { newLng, newLat, newAddress, reason }
 * Different from adminChangeDestination (bookingRouter2) which uses newDestination object.
 */
export const rideOpsChangeDestination = mkThunk(
  "operations/rideOpsChangeDestination",
  async ({ bookingId, newLng, newLat, newAddress, reason }) => {
    const { data } = await API.patch(
      `${RIDE_OPS}/admin/bookings/${bookingId}/destination`,
      { newLng, newLat, newAddress, reason }
    );
    toast.success("Destination updated — route recalculated");
    return data.data;
  }
);

/** GET /ride-ops/admin/bookings/:bookingId/destination-history */
export const fetchDestinationHistory = mkThunk(
  "operations/fetchDestinationHistory",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/admin/bookings/${bookingId}/destination-history`
    );
    return data.data;
  }
);

// ── Assignment History ────────────────────────────────────────────────────────

// ── Vehicle Replacement ───────────────────────────────────────────────────

/** PATCH /ride-ops/admin/rides/:rideId/replace-vehicle */
export const adminReplaceVehicle = mkThunk(
  "operations/adminReplaceVehicle",
  async ({ rideId, newVehicleId, reason }) => {
    const { data } = await API.patch(
      `${RIDE_OPS}/admin/rides/${rideId}/replace-vehicle`,
      { newVehicleId, reason }
    );
    toast.success("Vehicle replaced");
    return data.data;
  }
);

// ── Booking Status History (permanent, uncapped) ──────────────────────────

/** GET /ride-ops/bookings/:bookingId/status-history */
export const fetchBookingStatusHistory = mkThunk(
  "operations/fetchBookingStatusHistory",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/bookings/${bookingId}/status-history`
    );
    return data.data;
  }
);

// ── Assignment History ────────────────────────────────────────────────────

/** GET /ride-ops/rides/:rideId/assignment-history */
export const fetchRideAssignmentHistory = mkThunk(
  "operations/fetchRideAssignmentHistory",
  async ({ rideId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/rides/${rideId}/assignment-history`
    );
    return data.data;
  }
);

/** GET /ride-ops/bookings/:bookingId/assignment-history */
export const fetchBookingAssignmentHistory = mkThunk(
  "operations/fetchBookingAssignmentHistory",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${RIDE_OPS}/bookings/${bookingId}/assignment-history`
    );
    return data.data;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — SOCKET (no HTTP route; not part of the 3 routers, kept as infra)
// ═════════════════════════════════════════════════════════════════════════════

export const joinBookingRoom = createAsyncThunk(
  "operations/joinBookingRoom",
  ({ bookingId }) => {
    socketService.joinBookingRoom(bookingId);
    return { bookingId };
  }
);

export const leaveBookingRoom = createAsyncThunk(
  "operations/leaveBookingRoom",
  ({ bookingId }) => {
    socketService.leaveBookingRoom(bookingId);
    return { bookingId };
  }
);

export const joinTpRoom = createAsyncThunk(
  "operations/joinTpRoom",
  ({ tpId }) => {
    socketService.joinTpRoom(tpId);
    return { tpId };
  }
);

export const leaveTpRoom = createAsyncThunk(
  "operations/leaveTpRoom",
  ({ tpId }) => {
    socketService.leaveTpRoom(tpId);
    return { tpId };
  }
);

export const verifyOtpSocket = mkThunk(
  "operations/verifyOtpSocket",
  async ({ bookingId, rideId, otp }) => {
    const result = await socketService.verifyOtpAsync({ bookingId, rideId, otp });
    toast.success("OTP verified — ride started");
    return result;
  }
);

export const updateDriverStatusSocket = createAsyncThunk(
  "operations/updateDriverStatusSocket",
  ({ bookingId, rideId, status, lat, lng, meta }) => {
    socketService.updateDriverStatus({ bookingId, rideId, status, lat, lng, meta });
    return { bookingId, rideId, status };
  }
);

export const startGpsTracking = createAsyncThunk(
  "operations/startGpsTracking",
  ({ bookingId } = {}) => {
    socketService.startGpsTracking({ bookingId });
    return { tracking: true };
  }
);

export const stopGpsTracking = createAsyncThunk(
  "operations/stopGpsTracking",
  () => {
    socketService.stopGpsTracking();
    return { tracking: false };
  }
);

export const startCareGpsTracking = createAsyncThunk(
  "operations/startCareGpsTracking",
  ({ bookingId, status } = {}) => {
    socketService.startCareGpsTracking({ bookingId, status });
    return { tracking: true };
  }
);

export const stopCareGpsTracking = createAsyncThunk(
  "operations/stopCareGpsTracking",
  () => {
    socketService.stopCareGpsTracking();
    return { tracking: false };
  }
);

export const triggerSos = createAsyncThunk(
  "operations/triggerSos",
  ({ bookingId, rideId, lat, lng, sosType = "other", description }) => {
    socketService.triggerSos({ bookingId, rideId, lat, lng, sosType, description });
    toast.error("SOS triggered — help notified");
    return { bookingId, rideId, sosType };
  }
);

export const reportRouteDeviation = createAsyncThunk(
  "operations/reportRouteDeviation",
  ({ bookingId, rideId, lat, lng, deviationKm, driverReason }) => {
    socketService.reportRouteDeviation({
      bookingId, rideId, lat, lng, deviationKm, driverReason,
    });
    return { bookingId, rideId, deviationKm };
  }
);

export const requestBookingState = mkThunk(
  "operations/requestBookingState",
  async ({ bookingId }) => {
    const snapshot = await socketService.requestBookingStateAsync(bookingId);
    return snapshot;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// SLICE
// ═════════════════════════════════════════════════════════════════════════════

const key = (type) => type.split("/")[1];

const operationsSlice = createSlice({
  name: "operations",
  initialState,

  reducers: {
    setCareRideWorkflow(state, { payload }) {
      state.careRideStatus = {
        ...state.careRideStatus,
        ...payload,
        ...(payload.activeNavigationTarget
          ? { activeTarget: payload.activeNavigationTarget }
          : {}),
      };
    },

    setLiveLocation(state, { payload }) {
      state.liveLocation = payload;
    },

    setEtaUpdate(state, { payload }) {
      state.etaUpdate = payload;
    },

    setRideStatus(state, { payload }) {
      state.rideStatus = payload;
      if (payload?.rideStage || payload?.activeNavigationTarget) {
        state.careRideStatus = {
          ...state.careRideStatus,
          ...(payload.rideStage ? { rideStage: payload.rideStage } : {}),
          ...(payload.activeNavigationTarget
            ? {
                activeNavigationTarget: payload.activeNavigationTarget,
                activeTarget: payload.activeNavigationTarget,
              }
            : {}),
        };
      }
    },

    setBookingStatus(state, { payload }) {
      state.bookingStatus = payload;
    },

    setNavigationTarget(state, { payload }) {
      state.navigationTarget = payload;
    },

    setSosAlert(state, { payload }) {
      state.sosAlert = payload;
    },

    clearSosAlert(state) {
      state.sosAlert = null;
    },

    setRouteDeviation(state, { payload }) {
      state.routeDeviation = payload;
    },

    clearOtpResult(state) {
      state.otpResult = null;
    },

    clearSelectedBooking(state) {
      state.selectedBooking = null;
      state.bookingSnapshot = null;
      state.liveLocation = null;
      state.etaUpdate = null;
      state.rideStatus = null;
      state.bookingStatus = null;
      state.navigationTarget = null;
      state.sosAlert = null;
      state.routeDeviation = null;
    },

    clearAdminBookingDetail(state) {
      state.selectedBooking = null;
      state.selectedOp = null;
      state.selectedFollowUps = [];
      state.bookingSnapshot = null;
      state.liveLocation = null;
      state.etaUpdate = null;
      state.rideStatus = null;
      state.bookingStatus = null;
      state.navigationTarget = null;
      state.sosAlert = null;
      state.routeDeviation = null;
      state.rideParticipants = [];
      state.rideStops = [];
      state.rideJoinPoints = [];
      state.destinationAudit = [];
      state.bookingAssignmentHistory = [];
    },

    clearSelectedOp(state) {
      state.selectedOp = null;
      state.selectedFollowUps = [];
    },

    clearNearby(state) {
      state.nearbyDrivers = [];
      state.nearbyCareAssistants = [];
      state.nearbyTPs = [];
      state.nearbyHospitals = [];
    },

    clearNearbyResults(state) {
      state.nearbyDrivers = [];
      state.nearbyCareAssistants = [];
      state.nearbyTPs = [];
      state.nearbyHospitals = [];
    },

    clearErrors(state) {
      state.errors = {};
    },

    resetAdminStatusUpdate(state) {
      state.adminStatusUpdate = null;
    },
    resetAdminAssignment(state) {
      state.adminAssignment = null;
    },
    resetAdminRefund(state) {
      state.adminRefund = null;
    },
    resetAdminOpStatusUpdate(state) {
      state.adminOpStatusUpdate = null;
    },

    // Consultation reducers
    clearConsultation(state) {
      state.consultation = null;
      state.consultationJoinToken = null;
      state.consultationChat = [];
    },

    setConsultationFromSocket(state, { payload }) {
      if (state.consultation?._id === payload?._id || !state.consultation) {
        state.consultation = { ...(state.consultation ?? {}), ...payload };
      }
    },

    appendConsultationChatMessage(state, { payload }) {
      state.consultationChat = [...state.consultationChat, payload];
    },

    setCaAtJoinPoint(state) {
      state.careRideStatus = { ...state.careRideStatus, status: "at_pickup" };
      state.caAtJoinPoint = true;
    },

    setCaHasJoined(state) {
      state.caHasJoined = true;
      state.caViewMode = "driver_tracking_only";
      state.caAtJoinPoint = false;
      state.careRideStatus = {
        ...state.careRideStatus,
        status: "in_ride",
        careAssistantJoined: true,
      };
      if (state.careTrackingSnapshot?.route?.caJoinWaypoint) {
        state.careTrackingSnapshot.route.caJoinWaypoint.isCompleted = true;
        state.careTrackingSnapshot.route.caJoinWaypoint.completedAt =
          new Date().toISOString();
      }
    },

    setJpWaypointCompleted(state, { payload }) {
      if (state.caJoinPoint) {
        state.caJoinPoint = {
          ...state.caJoinPoint,
          isCompleted: true,
          completedAt: payload?.timestamp || new Date().toISOString(),
        };
      }
      if (state.careTrackingSnapshot?.route?.caJoinWaypoint) {
        state.careTrackingSnapshot.route.caJoinWaypoint.isCompleted = true;
        state.careTrackingSnapshot.route.caJoinWaypoint.completedAt =
          payload?.timestamp || new Date().toISOString();
      }
    },

    setCaViewMode(state, { payload }) {
      state.caViewMode = payload;
    },

    // Socket-pushed ride stop/JP events
    setRideStopsFromSocket(state, { payload }) {
      if (payload?.stops) state.rideStops = payload.stops;
    },

    setParticipantsFromSocket(state, { payload }) {
      if (payload?.participants) state.rideParticipants = payload.participants;
    },

    // ── CA socket reducers ──────────────────────────────────────────────────

    setCareAssistantLocation(state, { payload }) {
      state.careAssistantLocation = payload;
      if (payload?.role === "care_assistant") {
        state.liveLocation = payload;
      }
    },

    setCareAssistantStatus(state, { payload }) {
      state.careAssistantStatus = payload;
      if (payload?.careAssistantStatus) {
        state.careRideStatus = {
          ...state.careRideStatus,
          status: payload.careAssistantStatus,
        };
      }
    },

    setCareAssistantJoined(state, { payload }) {
      state.careAssistantJoined = payload;
      if (payload?.caJoinPoint) {
        state.caJoinPoint = payload.caJoinPoint;
      }
      state.careRideStatus = {
        ...state.careRideStatus,
        careAssistantJoined: true,
        status: "en_route_to_pickup",
      };
      if (state.careTrackingSnapshot?.careAssistant) {
        state.careTrackingSnapshot.careAssistant.status = "en_route_to_pickup";
        state.careTrackingSnapshot.careAssistant.joinedAt =
          payload?.joinedAt ?? null;
        state.careTrackingSnapshot.careAssistant.isLinkedToRide = true;
        if (payload?.caJoinPoint && state.careTrackingSnapshot.route) {
          state.careTrackingSnapshot.route.caJoinWaypoint = payload.caJoinPoint;
        }
      }
    },

    clearCareRideState(state) {
      state.careTrackingSnapshot = null;
      state.careAssistantLocation = null;
      state.careAssistantStatus = null;
      state.careAssistantJoined = null;
      state.caJoinPoint = null;
      state.careRideStatus = { ...INITIAL_CARE_RIDE_STATUS };
    },

    setSocketConnected(state, { payload }) {
      state.socketConnected = Boolean(payload);
    },
  },

  extraReducers: (builder) => {
    const pending = (state, action) => {
      state.loading[key(action.type)] = true;
      delete state.errors[key(action.type)];
    };
    const rejected = (state, action) => {
      state.loading[key(action.type)] = false;
      state.errors[key(action.type)] = action.payload || "Error";
    };

    const wire = (thunk, fulfilled) => {
      builder
        .addCase(thunk.pending, pending)
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          fulfilled(state, action);
        })
        .addCase(thunk.rejected, rejected);
    };

    // ── Transport Partner ───────────────────────────────────────────────────
    wire(fetchTpAssignedBookings, (state, { payload }) => {
      state.tpAssignedBookings = payload?.bookings ?? [];
    });
    wire(fetchTpAvailableDrivers, (state, { payload }) => {
      state.tpAvailableDrivers = payload?.drivers ?? [];
    });
    wire(tpAssignDriver, (state, { payload }) => {
      if (state.selectedBooking && payload?.ride)
        state.selectedBooking.primaryRide = payload.ride;
    });
    wire(tpReassignDriver, () => {});

    // ── Consultation ────────────────────────────────────────────────────────
    wire(fetchConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? null;
      if (payload?.consultation?.chatMessages) {
        state.consultationChat = payload.consultation.chatMessages;
      }
    });
    wire(confirmConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(acceptConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(startConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(endConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(submitConsultationConsent, (state, { payload }) => {
      if (state.consultation) {
        if (payload?.consentType === "telemedicine") {
          state.consultation.telemedicineConsentAccepted =
            payload?.accepted ?? false;
        }
        if (payload?.consentType === "recording") {
          state.consultation.recordingConsentAccepted =
            payload?.accepted ?? false;
        }
      }
    });
    wire(sendConsultationChat, (state, { payload }) => {
      if (payload?.message) {
        state.consultationChat = [...state.consultationChat, payload.message];
      }
    });
    wire(fetchConsultationJoinToken, (state, { payload }) => {
      state.consultationJoinToken = payload ?? null;
    });

    // ── Care Assistant ──────────────────────────────────────────────────────
    wire(fetchCareAssignedBookings, (state, { payload }) => {
      state.careAssignedBookings = payload?.bookings ?? [];
    });
    wire(markCareArrived, () => {});
    wire(markCareStart, (state) => {
      if (state.selectedBooking) state.selectedBooking.status = "in_progress";
    });
    wire(markCareComplete, (state) => {
      if (state.selectedBooking) state.selectedBooking.status = "completed";
    });
    wire(updateCareLocation, () => {});
    wire(careRequestRide, (state, { payload }) => {
      if (payload?.rideId) state.activeRide = payload;
    });

    wire(careReachedJoinPoint, (state) => {
      state.caAtJoinPoint = true;
      state.careRideStatus = { ...state.careRideStatus, status: "at_pickup" };
    });

    // POST /:id/care/join-ride
    wire(careJoinRide, (state, { payload }) => {
      state.caHasJoined = true;
      state.caViewMode = "driver_tracking_only";
      state.caAtJoinPoint = false;
      state.careRideStatus = {
        ...state.careRideStatus,
        status: "in_ride",
        careAssistantJoined: true,
      };
      if (payload?.jpCompleted && state.caJoinPoint) {
        state.caJoinPoint = { ...state.caJoinPoint, isCompleted: true };
      }
      if (state.careTrackingSnapshot?.careAssistant) {
        state.careTrackingSnapshot.careAssistant.isLinkedToRide = true;
        state.careTrackingSnapshot.careAssistant.status = "in_ride";
      }
    });

    wire(careUpdateRideStatus, (state, { payload }) => {
      if (payload?.status) {
        state.careRideStatus = { ...state.careRideStatus, status: payload.status };
      }
      if (state.careTrackingSnapshot?.careAssistant && payload?.status) {
        state.careTrackingSnapshot.careAssistant.status = payload.status;
      }
    });

    wire(fetchCareTrackingSnapshot, (state, { payload }) => {
      state.careTrackingSnapshot = payload ?? null;
      if (payload?.careAssistant?.liveLocation) {
        state.careAssistantLocation = payload.careAssistant.liveLocation;
        if (payload?.bookingType === "care_assistant") {
          state.liveLocation = payload.careAssistant.liveLocation;
        }
      }
      if (payload?.careAssistant?.status) {
        state.careRideStatus = {
          ...state.careRideStatus,
          status: payload.careAssistant.status,
        };
      }
      if (payload?.rideStage) {
        state.careRideStatus = {
          ...state.careRideStatus,
          rideStage: payload.rideStage,
        };
      }
      if (payload?.route?.caJoinWaypoint) {
        state.caJoinPoint = payload.route.caJoinWaypoint;
      }
    });

    // ── Hospital ────────────────────────────────────────────────────────────
    wire(fetchHospitalUpcoming, (state, { payload }) => {
      state.hospitalUpcoming = payload?.bookings ?? [];
    });
    wire(hospitalConfirmBooking, () => {});
    wire(fetchHospitalOps, (state, { payload }) => {
      state.hospitalOps = payload?.ops ?? [];
      state.hospitalOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(fetchHospitalValidOps, (state, { payload }) => {
      state.hospitalValidOps = payload?.ops ?? [];
      state.hospitalValidOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    // ── Doctor ──────────────────────────────────────────────────────────────
    wire(fetchDoctorOps, (state, { payload }) => {
      state.doctorOps = payload?.ops ?? [];
      state.doctorOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(fetchDoctorOpByNumber, (state, { payload }) => {
      state.selectedOp = payload?.op ?? null;
      state.selectedFollowUps = payload?.followUps ?? [];
    });
    wire(completeOp, (state, { payload }) => {
      state.selectedOp = payload?.op ?? state.selectedOp;
    });

    // ── OP Card ─────────────────────────────────────────────────────────────
    wire(fetchOpByNumber, (state, { payload }) => {
      state.selectedOp = payload?.op ?? null;
      state.selectedFollowUps = payload?.followUps ?? [];
    });
    wire(fetchOpFollowUps, (state, { payload }) => {
      state.selectedFollowUps = payload?.followUps ?? [];
    });
    wire(downloadOpCard, () => {});

    // ── Driver ──────────────────────────────────────────────────────────────
    wire(fetchDriverAssignedRides, (state, { payload }) => {
      state.driverAssignedRides = payload?.rides ?? [];
      state.driverInfo = payload?.driver ?? null;
    });
    wire(acceptRide, (state, { payload }) => {
      state.activeRide = payload?.ride ?? null;
      if (payload?.ride) {
        state.driverAssignedRides = state.driverAssignedRides.map((r) =>
          r._id === payload.ride._id ? { ...r, ...payload.ride } : r
        );
      }
    });
    wire(rejectRide, () => {});
    wire(markDriverArrived, () => {});
    wire(verifyRideOtp, (state, { payload }) => {
      state.otpResult = payload ?? null;
      if (payload?.rideId) {
        state.driverAssignedRides = state.driverAssignedRides.map((r) =>
          r._id === payload.rideId ? { ...r, status: "otp_verified" } : r
        );
      }
    });
    wire(markArrivedStop, (state, { payload }) => {
      if (payload?.stopId && state.rideStops.length) {
        state.rideStops = state.rideStops.map((s) =>
          s.stopId === payload.stopId ? { ...s, status: "ARRIVED" } : s
        );
      }
    });
    wire(departStop, (state, { payload }) => {
      if (payload?.stopId && state.rideStops.length) {
        state.rideStops = state.rideStops.map((s) =>
          s.stopId === payload.stopId ? { ...s, status: "COMPLETED" } : s
        );
      }
    });
    wire(endRide, (state, { payload }) => {
      state.activeRide = null;
      if (payload?.booking) state.selectedBooking = payload.booking;
    });
    wire(updateDriverLocationHttp, () => {});
    wire(driverTriggerSos, (state, { payload }) => {
      state.sosAlert = payload ?? null;
    });

    // ── Customer ────────────────────────────────────────────────────────────
    wire(customerRequestRide, (state, { payload }) => {
      state.activeRide = payload ?? null;
    });

    // ── Admin Bookings ──────────────────────────────────────────────────────
    wire(fetchAdminBookings, (state, { payload }) => {
      state.adminBookings = payload?.bookings ?? [];
      state.adminBookingsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(fetchAdminBookingStats, (state, { payload }) => {
      state.adminStats = payload ?? null;
    });
    wire(exportAdminBookings, () => {});
    wire(fetchAdminBookingById, (state, { payload }) => {
      state.selectedBooking = payload?.booking ?? null;
      if (payload?.opRecord) state.selectedOp = payload.opRecord;
      if (payload?.followUps) state.selectedFollowUps = payload.followUps;
      if (payload?.consultation) state.consultation = payload.consultation;
      // Seed rideStops + participants from admin detail response
      if (payload?.rideStops) state.rideStops = payload.rideStops;
      if (payload?.participants) state.rideParticipants = payload.participants;
      if (payload?.joinPoints) state.rideJoinPoints = payload.joinPoints;
    });
    wire(updateAdminBookingStatus, (state, { payload }) => {
      state.adminStatusUpdate = payload ?? null;
      state.selectedBooking = payload?.booking ?? state.selectedBooking;
      state.adminBookings = state.adminBookings.map((b) =>
        b._id === payload?.booking?._id
          ? { ...b, status: payload.booking.status }
          : b
      );
    });
    wire(adminChangeDestination, (state, { payload }) => {
      if (state.selectedBooking && payload?.booking) {
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      }
    });

    // ── Admin Nearby ────────────────────────────────────────────────────────
    wire(fetchNearbyCareAssistants, (state, { payload }) => {
      state.nearbyCareAssistants = payload?.results ?? [];
    });
    wire(fetchNearbySoloDrivers, (state, { payload }) => {
      state.nearbyDrivers = payload?.results ?? [];
    });
    wire(fetchNearbyTransportPartners, (state, { payload }) => {
      state.nearbyTPs = payload?.results ?? [];
    });
    wire(fetchNearbyHospitals, (state, { payload }) => {
      state.nearbyHospitals = payload?.results ?? [];
    });

    // ── Admin Assign / Reassign ─────────────────────────────────────────────
    wire(adminAssignSoloDriver, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
    });
    wire(adminAssignTransportPartner, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
    });
    wire(adminAssignCareAssistant, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      if (payload?.caJoinPoint) {
        state.caJoinPoint = payload.caJoinPoint;
        if (state.careTrackingSnapshot?.route) {
          state.careTrackingSnapshot.route.caJoinWaypoint = payload.caJoinPoint;
        }
      }
    });
    wire(adminAssignHospital, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
    });
    wire(adminReassignCareAssistant, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
    });
    wire(adminProcessRefund, (state, { payload }) => {
      state.adminRefund = payload ?? null;
      state.selectedBooking = payload?.booking ?? state.selectedBooking;
      state.adminBookings = state.adminBookings.map((b) =>
        b._id === payload?.booking?._id
          ? { ...b, status: "refunded", paymentStatus: "refunded" }
          : b
      );
    });

    // ── Admin OP ────────────────────────────────────────────────────────────
    wire(fetchAdminOps, (state, { payload }) => {
      state.adminOps = payload?.ops ?? [];
      state.adminOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(updateAdminOpStatus, (state, { payload }) => {
      const updated = payload?.op;
      state.adminOpStatusUpdate = updated ?? null;
      if (updated) {
        state.adminOps = state.adminOps.map((o) =>
          o._id === updated._id ? { ...o, status: updated.status } : o
        );
        if (state.selectedOp?._id === updated._id)
          state.selectedOp = { ...state.selectedOp, ...updated };
      }
    });

    // ── Admin SOS ───────────────────────────────────────────────────────────
    wire(fetchAdminActiveSos, (state, { payload }) => {
      state.adminActiveSos = payload?.events ?? [];
      state.adminActiveSosMeta = {
        total: payload?.total ?? 0,
        page: 1,
        pages: 1,
      };
    });
    wire(resolveAdminSos, (state, { payload }) => {
      const id = payload?.sosEvent?._id;
      if (id) {
        state.adminActiveSos = state.adminActiveSos.filter(
          (e) => e._id !== id
        );
      }
    });
    wire(fetchAdminDestinationAudit, (state, { payload }) => {
      state.destinationAudit = payload?.audits ?? [];
    });

    // ── Admin Care-Ride ─────────────────────────────────────────────────────
    wire(adminRequestCareRide, (state, { payload }) => {
      state.activeRide = payload ?? null;
      state.careRideNearby = payload
        ? {
            nearbyDrivers: payload.nearbyDrivers,
            nearbyTPs: payload.nearbyTPs,
          }
        : null;
    });
    wire(fetchAdminCareRideNearby, (state, { payload }) => {
      state.careRideNearby = payload ?? null;
    });

    // ── Ride Operations Router ──────────────────────────────────────────────

    // Participants
    wire(fetchRideParticipants, (state, { payload }) => {
      state.rideParticipants = payload?.participants ?? [];
    });
    wire(assignRideParticipant, (state, { payload }) => {
      if (payload?.participant) {
        state.rideParticipants = [
          ...state.rideParticipants.filter(
            (p) => p._id !== payload.participant._id
          ),
          payload.participant,
        ];
      }
    });
    wire(fetchRideParticipant, (state, { payload }) => {
      // Update single participant in list
      if (payload?.participant) {
        const idx = state.rideParticipants.findIndex(
          (p) => p._id === payload.participant._id
        );
        if (idx >= 0) {
          state.rideParticipants[idx] = {
            ...state.rideParticipants[idx],
            ...payload.participant,
            liveLocation: payload.liveLocation ?? null,
          };
        }
      }
    });
    wire(updateParticipantStatus, (state, { payload }) => {
      if (payload?.participant) {
        state.rideParticipants = state.rideParticipants.map((p) =>
          p._id === payload.participant._id
            ? { ...p, status: payload.participant.status }
            : p
        );
      }
    });
    wire(removeRideParticipant, (state, action) => {
      // Soft remove — mark inactive locally (server sets isActive=false)
      const participantId = action.meta?.arg?.participantId;
      if (participantId) {
        state.rideParticipants = state.rideParticipants.filter(
          (p) => p._id !== participantId
        );
      }
    });

    // Join Points
    wire(adminCalculateJoinPoint, (state, { payload }) => {
      if (payload?.joinPoint) {
        state.caJoinPoint = payload.joinPoint;
        state.rideJoinPoints = [...state.rideJoinPoints, payload.joinPoint];
        if (state.careTrackingSnapshot?.route) {
          state.careTrackingSnapshot.route.caJoinWaypoint = payload.joinPoint;
        }
      }
    });
    wire(adminRecalcJoinPoint, (state, { payload }) => {
      if (payload?.joinPoint) {
        state.caJoinPoint = payload.joinPoint;
        state.rideJoinPoints = [...state.rideJoinPoints, payload.joinPoint];
        if (state.careTrackingSnapshot?.route) {
          state.careTrackingSnapshot.route.caJoinWaypoint = payload.joinPoint;
        }
      }
      // Sync new stop into rideStops
      if (payload?.newStopId && state.rideStops.length) {
        state.rideStops = state.rideStops.filter(
          (s) => s.stopType !== "CARE_ASSISTANT_JOIN"
        );
      }
    });
    wire(fetchRideJoinPoints, (state, { payload }) => {
      state.rideJoinPoints = payload?.joinPoints ?? [];
    });
    wire(updateJoinPointStatus, (state, { payload }) => {
      if (payload?.joinPoint) {
        state.rideJoinPoints = state.rideJoinPoints.map((jp) =>
          jp._id === payload.joinPoint._id
            ? { ...jp, status: payload.joinPoint.status }
            : jp
        );
        if (state.caJoinPoint?._id === payload.joinPoint._id) {
          state.caJoinPoint = { ...state.caJoinPoint, ...payload.joinPoint };
        }
      }
    });

    // Ride Stops
    wire(fetchRideStops, (state, { payload }) => {
      state.rideStops = payload?.stops ?? [];
    });
    wire(fetchRideStop, (state, { payload }) => {
      if (payload?.stop) {
        const idx = state.rideStops.findIndex(
          (s) => s._id === payload.stop._id
        );
        if (idx >= 0) state.rideStops[idx] = payload.stop;
        else state.rideStops = [...state.rideStops, payload.stop];
      }
    });
    wire(verifyStopOtp, () => {});
    wire(updateStopStatus, (state, { payload }) => {
      if (payload?.stop) {
        state.rideStops = state.rideStops.map((s) =>
          s._id === payload.stop._id
            ? { ...s, status: payload.stop.status }
            : s
        );
      }
    });

    // Route Versions
    wire(fetchRouteVersions, (state, { payload }) => {
      state.rideRouteVersions = payload?.versions ?? [];
    });
    wire(fetchActiveRouteVersion, (state, { payload }) => {
      state.activeRouteVersion = payload ?? null;
      // Sync stops from active version response
      if (payload?.stops) state.rideStops = payload.stops;
    });

    // SOS (rideOperationsRouter)
    wire(triggerBookingSos, (state, { payload }) => {
      state.sosAlert = payload ?? null;
    });
    wire(fetchBookingSosEvents, (state, { payload }) => {
      state.bookingSosEvents = payload?.events ?? [];
    });
    wire(resolveRideOpsSos, (state, { payload }) => {
      const id = payload?.sos?._id;
      if (id) {
        state.bookingSosEvents = state.bookingSosEvents.map((e) =>
          e._id === id ? { ...e, isResolved: true } : e
        );
        state.adminActiveSos = state.adminActiveSos.filter((e) => e._id !== id);
      }
    });
    wire(fetchAdminActiveSosPaginated, (state, { payload }) => {
      state.adminActiveSos = payload?.events ?? [];
      state.adminActiveSosMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    // Destination (rideOps version)
    wire(rideOpsChangeDestination, (state, { payload }) => {
      if (state.selectedBooking && payload?.audit?.newDestination) {
        state.selectedBooking.destinationLocation =
          payload.audit.newDestination;
      }
      state.destinationAudit = [
        payload?.audit ?? {},
        ...state.destinationAudit,
      ];
      if (payload?.newRouteVersion) {
        state.activeRouteVersion = payload.newRouteVersion;
        state.rideRouteVersions = [
          ...state.rideRouteVersions.filter(
            (v) => v._id !== payload.newRouteVersion._id
          ),
          payload.newRouteVersion,
        ];
      }
    });
    wire(fetchDestinationHistory, (state, { payload }) => {
      state.destinationAudit = payload?.history ?? [];
    });

// Assignment History
    wire(fetchRideAssignmentHistory, (state, { payload }) => {
      state.rideAssignmentHistory = payload?.history ?? [];
    });
    wire(fetchBookingAssignmentHistory, (state, { payload }) => {
      state.bookingAssignmentHistory = payload?.history ?? [];
    });
    wire(fetchBookingStatusHistory, (state, { payload }) => {
      state.bookingStatusHistory = payload?.history ?? [];
    });
    wire(adminReplaceVehicle, (state, { payload }) => {
      state.vehicleReplacement = payload ?? null;
      if (state.selectedBooking?.primaryRide && payload?.ride) {
        state.selectedBooking.primaryRide = {
          ...state.selectedBooking.primaryRide,
          vehicleSnapshot: payload.ride.vehicleSnapshot,
        };
      }
    });

    // ── Socket Thunks ───────────────────────────────────────────────────────
    wire(joinBookingRoom, () => {});
    wire(leaveBookingRoom, () => {});
    wire(joinTpRoom, () => {});
    wire(leaveTpRoom, () => {});
    wire(verifyOtpSocket, (state, { payload }) => {
      state.otpResult = payload ?? null;
    });
    wire(requestBookingState, (state, { payload }) => {
      state.bookingSnapshot = payload ?? null;
    });

    builder
      .addCase(updateDriverStatusSocket.fulfilled, (state, { payload }) => {
        state.rideStatus = payload ?? null;
      })
      .addCase(startGpsTracking.fulfilled, (state) => {
        state.gpsTracking = true;
      })
      .addCase(stopGpsTracking.fulfilled, (state) => {
        state.gpsTracking = false;
      })
      .addCase(startCareGpsTracking.fulfilled, (state) => {
        state.gpsTracking = true;
      })
      .addCase(stopCareGpsTracking.fulfilled, (state) => {
        state.gpsTracking = false;
      })
      .addCase(triggerSos.fulfilled, (state, { payload }) => {
        state.sosAlert = payload ?? null;
      })
      .addCase(reportRouteDeviation.fulfilled, (state, { payload }) => {
        state.routeDeviation = payload ?? null;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  setLiveLocation,
  setEtaUpdate,
  setRideStatus,
  setBookingStatus,
  setNavigationTarget,
  setSosAlert,
  clearSosAlert,
  setRouteDeviation,
  clearOtpResult,
  clearSelectedBooking,
  clearAdminBookingDetail,
  clearSelectedOp,
  clearNearby,
  clearNearbyResults,
  clearErrors,
  resetAdminStatusUpdate,
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminOpStatusUpdate,
  setSocketConnected,
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  clearCareRideState,
  setCareRideWorkflow,
  clearConsultation,
  setConsultationFromSocket,
  appendConsultationChatMessage,
  setCaAtJoinPoint,
  setCaHasJoined,
  setJpWaypointCompleted,
  setCaViewMode,
  setRideStopsFromSocket,
  setParticipantsFromSocket,
} = operationsSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// CA view
export const selectCaViewMode       = (s) => s.operations.caViewMode;
export const selectCaHasJoined      = (s) => s.operations.caHasJoined;
export const selectCaAtJoinPoint    = (s) => s.operations.caAtJoinPoint;
export const selectCaJoinPoint      = (s) => s.operations.caJoinPoint;

// Loading helpers
export const selectCareReachedJpLoading      = (s) => s.operations.loading["careReachedJoinPoint"] ?? false;
export const selectCareJoinRideLoading       = (s) => s.operations.loading["careJoinRide"] ?? false;

// Admin bookings
export const selectAdminBookings          = (s) => s.operations.adminBookings;
export const selectAdminBookingsMeta      = (s) => s.operations.adminBookingsMeta;
export const selectAdminStats             = (s) => s.operations.adminStats;
export const selectAdminOps               = (s) => s.operations.adminOps;
export const selectAdminOpsMeta           = (s) => s.operations.adminOpsMeta;
export const selectAdminBookingDetail     = (s) => s.operations.selectedBooking;
export const selectAdminOpRecord          = (s) => s.operations.selectedOp;
export const selectAdminBookingFollowUps  = (s) => s.operations.selectedFollowUps;
export const selectAdminStatusUpdate      = (s) => s.operations.adminStatusUpdate;
export const selectAdminAssignment        = (s) => s.operations.adminAssignment;
export const selectAdminRefund            = (s) => s.operations.adminRefund;
export const selectAdminOpStatusUpdate    = (s) => s.operations.adminOpStatusUpdate;

// SOS
export const selectAdminActiveSos         = (s) => s.operations.adminActiveSos;
export const selectAdminActiveSosMeta     = (s) => s.operations.adminActiveSosMeta;
export const selectBookingSosEvents       = (s) => s.operations.bookingSosEvents;
export const selectDestinationAudit       = (s) => s.operations.destinationAudit;

// TP
export const selectTpAssignedBookings     = (s) => s.operations.tpAssignedBookings;
export const selectTpAvailableDrivers     = (s) => s.operations.tpAvailableDrivers;

// Care
export const selectCareAssignedBookings   = (s) => s.operations.careAssignedBookings;

// Hospital
export const selectHospitalUpcoming       = (s) => s.operations.hospitalUpcoming;
export const selectHospitalOps            = (s) => s.operations.hospitalOps;
export const selectHospitalOpsMeta        = (s) => s.operations.hospitalOpsMeta;
export const selectHospitalValidOps       = (s) => s.operations.hospitalValidOps;
export const selectHospitalValidOpsMeta   = (s) => s.operations.hospitalValidOpsMeta;

// Doctor
export const selectDoctorOps              = (s) => s.operations.doctorOps;
export const selectDoctorOpsMeta          = (s) => s.operations.doctorOpsMeta;

// Driver
export const selectDriverAssignedRides    = (s) => s.operations.driverAssignedRides;
export const selectDriverInfo             = (s) => s.operations.driverInfo;

// Nearby
export const selectNearbyDrivers          = (s) => s.operations.nearbyDrivers;
export const selectNearbyCareAssistants   = (s) => s.operations.nearbyCareAssistants;
export const selectNearbyTPs              = (s) => s.operations.nearbyTPs;
export const selectNearbyHospitals        = (s) => s.operations.nearbyHospitals;
export const selectCareRideNearby         = (s) => s.operations.careRideNearby;

// Selected
export const selectSelectedBooking        = (s) => s.operations.selectedBooking;
export const selectSelectedOp             = (s) => s.operations.selectedOp;
export const selectSelectedFollowUps      = (s) => s.operations.selectedFollowUps;
export const selectBookingSnapshot        = (s) => s.operations.bookingSnapshot;
export const selectActiveRide             = (s) => s.operations.activeRide;
export const selectAdminBookingMapRoute   = (s) => s.operations.selectedBooking?.route ?? null;

// Ride Operations
export const selectRideParticipants       = (s) => s.operations.rideParticipants;
export const selectRideStops              = (s) => s.operations.rideStops;
export const selectCurrentStopId          = (s) => {
  const stops = s.operations.rideStops || [];
  if (!stops.length) return null;
  const sorted = [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const arrived = sorted.find((st) => st.status === 'ARRIVED');
  if (arrived) return arrived._id ?? arrived.stopId;
  const pending = sorted.find((st) => !['COMPLETED', 'SKIPPED'].includes(st.status));
  return pending ? (pending._id ?? pending.stopId) : null;
};
export const selectRideJoinPoints         = (s) => s.operations.rideJoinPoints;
export const selectRideRouteVersions      = (s) => s.operations.rideRouteVersions;
export const selectActiveRouteVersion     = (s) => s.operations.activeRouteVersion;
export const selectRideAssignmentHistory  = (s) => s.operations.rideAssignmentHistory;
export const selectBookingAssignmentHistory = (s) => s.operations.bookingAssignmentHistory;
export const selectBookingStatusHistory   = (s) => s.operations.bookingStatusHistory;
export const selectVehicleReplacement     = (s) => s.operations.vehicleReplacement;

// Live state
export const selectLiveLocation           = (s) => s.operations.liveLocation;
export const selectEtaUpdate              = (s) => s.operations.etaUpdate;
export const selectRideStatus             = (s) => s.operations.rideStatus;
export const selectBookingStatus          = (s) => s.operations.bookingStatus;
export const selectNavigationTarget       = (s) => s.operations.navigationTarget;
export const selectSosAlert               = (s) => s.operations.sosAlert;
export const selectRouteDeviation         = (s) => s.operations.routeDeviation;
export const selectOtpResult              = (s) => s.operations.otpResult;
export const selectGpsTracking            = (s) => s.operations.gpsTracking;
export const selectSocketConnected        = (s) => s.operations.socketConnected;
export const selectLoading                = (k) => (s) => s.operations.loading[k] ?? false;
export const selectError                  = (k) => (s) => s.operations.errors[k] ?? null;

// Consultation
export const selectConsultation               = (s) => s.operations.consultation;
export const selectConsultationJoinToken      = (s) => s.operations.consultationJoinToken;
export const selectConsultationChat           = (s) => s.operations.consultationChat;
export const selectConsultationLoading        = (s) => s.operations.loading["fetchConsultation"] ?? false;
export const selectConfirmConsultationLoading = (s) => s.operations.loading["confirmConsultation"] ?? false;
export const selectAcceptConsultationLoading  = (s) => s.operations.loading["acceptConsultation"] ?? false;
export const selectStartConsultationLoading   = (s) => s.operations.loading["startConsultation"] ?? false;
export const selectEndConsultationLoading     = (s) => s.operations.loading["endConsultation"] ?? false;
export const selectJoinTokenLoading           = (s) => s.operations.loading["fetchConsultationJoinToken"] ?? false;
export const selectSendChatLoading            = (s) => s.operations.loading["sendConsultationChat"] ?? false;

// CA Tracking
export const selectCareTrackingSnapshot   = (s) => s.operations.careTrackingSnapshot;
export const selectCareAssistantLocation  = (s) => s.operations.careAssistantLocation;
export const selectCareAssistantStatus    = (s) => s.operations.careAssistantStatus;
export const selectCareAssistantJoined    = (s) => s.operations.careAssistantJoined;
export const selectCareRideStatus         = (s) => s.operations.careRideStatus;
export const selectRideStageOps           = (s) => s.operations.careRideStatus?.rideStage ?? null;
export const selectActiveNavigationTarget = (s) => s.operations.careRideStatus?.activeNavigationTarget ?? null;
export const selectCareTrackingLoading    = (s) => s.operations.loading["fetchCareTrackingSnapshot"] ?? false;
export const selectCareJoinLoading        = (s) => s.operations.loading["careJoinRide"] ?? false;

// Loading convenience selectors
export const selectAdminBookingsLoading       = (s) => s.operations.loading["fetchAdminBookings"] ?? false;
export const selectAdminBookingDetailLoading  = (s) => s.operations.loading["fetchAdminBookingById"] ?? false;
export const selectAdminStatsLoading          = (s) => s.operations.loading["fetchAdminBookingStats"] ?? false;
export const selectAdminExportLoading         = (s) => s.operations.loading["exportAdminBookings"] ?? false;
export const selectAdminOpsLoading            = (s) => s.operations.loading["fetchAdminOps"] ?? false;
export const selectAdminRefundLoading         = (s) => s.operations.loading["adminProcessRefund"] ?? false;
export const selectNearbyLoading = (s) =>
  (s.operations.loading["fetchNearbyCareAssistants"] ?? false) ||
  (s.operations.loading["fetchNearbySoloDrivers"] ?? false) ||
  (s.operations.loading["fetchNearbyTransportPartners"] ?? false) ||
  (s.operations.loading["fetchNearbyHospitals"] ?? false);
export const selectAdminAssignLoading = (s) =>
  (s.operations.loading["adminAssignSoloDriver"] ?? false) ||
  (s.operations.loading["adminAssignTransportPartner"] ?? false) ||
  (s.operations.loading["adminAssignCareAssistant"] ?? false) ||
  (s.operations.loading["adminAssignHospital"] ?? false) ||
  (s.operations.loading["adminReassignCareAssistant"] ?? false);
export const selectRideOpsLoading = (s) =>
  (s.operations.loading["fetchRideParticipants"] ?? false) ||
  (s.operations.loading["fetchRideStops"] ?? false) ||
  (s.operations.loading["fetchRideJoinPoints"] ?? false) ||
  (s.operations.loading["fetchRouteVersions"] ?? false);
export const selectAdminSosLoading = (s) =>
  (s.operations.loading["fetchAdminActiveSos"] ?? false) ||
  (s.operations.loading["fetchAdminActiveSosPaginated"] ?? false);

export { DRIVER_STATUS };
export default operationsSlice.reducer;