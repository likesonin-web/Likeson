// path app/store/slices/userSlice
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../api";
import toast from "react-hot-toast";

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  SAFE STORAGE HELPERS  (SSR-safe, never throws)
// ═══════════════════════════════════════════════════════════════════════════════

const storage = {
  get: (key) => {
    try {
      if (typeof window === "undefined") return null;
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },

  getString: (key) => {
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  saveAuth: (token, user) => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    } catch {
      /* silent */
    }
  },

  clearAuth: () => {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      /* silent */
    }
  },

  patchUser: (updatedUser) => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch {
      /* silent */
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  ERROR EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════════

const extractError = (
  err,
  fallback = "Something went wrong. Please try again.",
) => {
  const serverMsg = err?.response?.data?.message;
  const errors = err?.response?.data?.errors;

  if (Array.isArray(errors) && errors.length > 0)
    return errors
      .map((e) => e.msg || e.message || "")
      .filter(Boolean)
      .join(". ");

  if (typeof serverMsg === "string" && serverMsg.length < 300) return serverMsg;
  if (err?.message === "Network Error")
    return "No internet connection. Please check your network.";

  return fallback;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── Identity ───────────────────────────────────────────────────────────────
  user: storage.get("user"), // Hydrated from localStorage on load
  token: storage.getString("token"), // JWT string
  profile: null, // Role-specific profile

  // ── Audit sessions ─────────────────────────────────────────────────────────
  activeSessions: [],

  // ── Push notification device tokens ───────────────────────────────────────
  deviceTokens: [],

  // ── Wallet ─────────────────────────────────────────────────────────────────
  wallet: {
    balance: 0,
    currency: "INR",
    isActive: true,
    withdrawableBalance: 0,
    lockedBalance: 0,
    availableBalance: 0,
    transactions: [],
    pagination: {
      total: 0,
      page: 1,
      pages: 1,
      limit: 20,
    },
  },

  // ── Referral ───────────────────────────────────────────────────────────────
  referral: {
    referralCode: null,
    totalReferrals: 0,
    coins: 0,
    coinsInRupees: 0,
    coinsEarned: 0,
    coinsRedeemed: 0,
    referredBy: null,
    referralHistory: [],
  },

  // ── Referral validation (public, no-auth) ──────────────────────────────────
  referralValidation: null, // { valid, referrerName, bonusCoins, bonusRupees }

  // ── Customer Settings ──────────────────────────────────────────────────────
  settings: null,
  activity: null,

  // ── Admin ──────────────────────────────────────────────────────────────────
  allUsers: {
    data: [],
    total: 0,
    pages: 1,
    currentPage: 1,
  },

  // ── Cookie Consent ─────────────────────────────────────────────────────────
  cookieConsent: null,

  adminUserCoins: null,
  adminUserSessions: null,

  // ── Global async state ─────────────────────────────────────────────────────
  loading: false,
  error: null,

  // ── Fine-grained per-feature loaders ──────────────────────────────────────
  loaders: {
    // Auth
    login: false,
    signup: false,
    logout: false,
    otpRequest: false,
    requestOtpLogin: false,
    otpLogin: false,
    verifyEmail: false,
    forgotPassword: false,
    resetPassword: false,
    googleCallback: false,
    isLoggingOut: false,
    cookieConsent: false,
    getCookieConsent: false,
    updateCookieConsent: false,
    withdrawCookieConsent: false,
    // admin
    adminUserCookieConsent: false,
    // Profile
    profile: false,
    updateProfile: false,
    changePassword: false,
    deleteAccount: false,

    // Sessions
    sessions: false,
    revokeSession: false,
    revokeAllSessions: false,

    // Device tokens
    deviceTokens: false,
    registerDeviceToken: false,
    removeDeviceToken: false,

    // Heartbeat
    heartbeat: false,

    // Location
    locationByAddress: false,
    locationByCoords: false,

    // Wallet
    wallet: false,
    redeemCoins: false,

    // Referral
    referralCode: false,
    referralValidate: false,
    applyReferral: false,

    // Settings
    settings: false,
    verifyPhone: false,
    verifyPhoneConfirm: false,
    requestEmailChange: false,
    confirmEmailChange: false,
    googleUnlink: false,
    activity: false,
    legalAccept: false,
    deactivate: false,

    // Admin
    adminUsers: false,
    adminUpdateRole: false,
    adminSuspend: false,
    adminUnblock: false,
    adminResetOtp: false,
    adminUserCoins: false,
    adminCreditCoins: false,
    adminUserSessions: false,
    adminForceSignOut: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  ASYNC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 4.1  PUBLIC AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/users/signup
 * @body { name, email, password, phone?, role?, referralCode? }
 * Response: { status, token, user, referral?: { message, coinsReceived, coinsInRupees } }
 */
export const signup = createAsyncThunk(
  "user/signup",
  async (userData, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/signup", userData);
      storage.saveAuth(data.token, data.user);
      const baseMsg = "Account created successfully!";
      const coinMsg = data.referral?.message ? ` ${data.referral.message}` : "";
      toast.success(baseMsg + coinMsg);
      return data;
    } catch (err) {
      const msg = extractError(err, "Signup failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/login
 * @body { identifier: email|phone|name, password, fcmToken?, platform?, deviceName? }
 * Response: { status, token, sessionId, user, expiresIn }
 */
export const login = createAsyncThunk(
  "user/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/login", credentials);
      storage.saveAuth(data.token, data.user);
      const firstName = data.user?.name?.split(" ")[0] ?? "back";
      toast.success(`Welcome back, ${firstName}!`);
      return data;
    } catch (err) {
      const msg = extractError(err, "Login failed. Check your credentials.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/logout
 * Also clears all local auth state regardless of server response.
 */
export const logout = createAsyncThunk(
  "user/logout",
  async (_, { rejectWithValue }) => {
    try {
      await API.post("/users/logout");
    } catch {
      /* always clear local state regardless */
    }
    storage.clearAuth();
    return null;
  },
);

/**
 * POST /api/users/otp-request
 * @body { email }
 */
export const requestOtp = createAsyncThunk(
  "user/requestOtp",
  async (email, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/otp-request", { email });
      toast.success("OTP sent via email and SMS.");
      return data;
    } catch (err) {
      const msg = extractError(err, "OTP request failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/request-otp-login
 * @body { identifier }
 */
export const requestOtpLogin = createAsyncThunk(
  "user/requestOtpLogin",
  async (identifier, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/request-otp-login", {
        identifier,
      });
      toast.success("Login OTP sent via email and SMS.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Could not send OTP.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/otp-login
 * @body { identifier, otp, fcmToken?, platform?, deviceName? }
 * Response: { status, token, sessionId, user }
 */
export const otpLogin = createAsyncThunk(
  "user/otpLogin",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/otp-login", payload);
      storage.saveAuth(data.token, data.user);
      toast.success("Logged in successfully!");
      return data;
    } catch (err) {
      const msg = extractError(err, "OTP login failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/verify-email
 * @body { email, otp }
 */
export const verifyEmail = createAsyncThunk(
  "user/verifyEmail",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/verify-email", payload);
      toast.success("Email verified successfully!");
      return data;
    } catch (err) {
      const msg = extractError(err, "Verification failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/forgot-password
 * @body { identifier } or { email }
 */
export const forgotPassword = createAsyncThunk(
  "user/forgotPassword",
  async (identifier, { rejectWithValue }) => {
    try {
      const payload =
        typeof identifier === "string" ? { identifier } : identifier;
      const { data } = await API.post("/users/forgot-password", payload);
      toast.success("Reset code sent. Check your email and SMS.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Password reset request failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/reset-password
 * @body { identifier, otp, newPassword }
 * Side-effect: clears local auth (user must log in again).
 */
export const resetPassword = createAsyncThunk(
  "user/resetPassword",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/reset-password", payload);
      storage.clearAuth();
      toast.success("Password reset! Please log in again.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Password reset failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.2  GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger browser redirect to Google OAuth — NOT a thunk.
 * Call this directly from your login button handler.
 */
export const loginWithGoogle = () => {
  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/users/google`;
};

/**
 * Handle token returned from GET /users/google/callback
 * → frontend lands on /auth-success?token=...&sessionId=...&role=...
 * @param { token, user?, role, sessionId? }
 */
export const handleGoogleCallback = createAsyncThunk(
  "user/googleCallback",
  async (payload, { rejectWithValue }) => {
    if (!payload?.token)
      return rejectWithValue(
        "Google authentication failed. No token received.",
      );
    storage.saveAuth(payload.token, payload.user ?? null);
    return payload;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.3  PROFILE  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/profile
 * Response: { success: true, data: { ...user, profile: {} } }
 */
export const getProfile = createAsyncThunk(
  "user/getProfile",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/profile");
      if (data?.data) storage.patchUser(data.data);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Profile fetch failed."));
    }
  },
);

/**
 * PUT /api/users/profile
 * @body { name?, phone?, avatar?, roleProfileData? }
 */
export const updateProfile = createAsyncThunk(
  "user/updateProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put("/users/profile", payload);
      if (data?.data?.user) storage.patchUser(data.data.user);
      toast.success("Profile updated successfully!");
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Profile update failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * PUT /api/users/change-password
 * @body { oldPassword, newPassword }
 */
export const changePassword = createAsyncThunk(
  "user/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put("/users/change-password", payload);
      toast.success("Password updated successfully!");
      return data;
    } catch (err) {
      const msg = extractError(err, "Password change failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * DELETE /api/users/delete-account
 * Wipes local auth on success.
 */
export const deleteAccount = createAsyncThunk(
  "user/deleteAccount",
  async (_, { rejectWithValue }) => {
    try {
      await API.delete("/users/delete-account");
      storage.clearAuth();
      toast.success("Account permanently deleted.");
      return null;
    } catch (err) {
      const msg = extractError(err, "Account deletion failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.4  AUDIT SESSION MANAGEMENT  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/sessions
 * Response: { status, count, data: [...sessions with hasPushToken flag] }
 */
export const getActiveSessions = createAsyncThunk(
  "user/getActiveSessions",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/sessions");
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Session fetch failed."));
    }
  },
);

/**
 * DELETE /api/users/sessions/:sessionId
 * @param sessionId — Mongo ObjectId string
 * Response: { message, sessionId, deviceSignedOut: true }
 */
export const revokeSession = createAsyncThunk(
  "user/revokeSession",
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/users/sessions/${sessionId}`);
      toast.success("Device signed out successfully.");
      return { sessionId, ...data };
    } catch (err) {
      const msg = extractError(err, "Session revoke failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * DELETE /api/users/sessions  — revoke ALL sessions + ALL device tokens
 * Side-effect: clears local auth completely.
 */
export const revokeAllSessions = createAsyncThunk(
  "user/revokeAllSessions",
  async (_, { rejectWithValue }) => {
    try {
      await API.delete("/users/sessions");
      storage.clearAuth();
      toast.success("Signed out from all devices.");
      return null;
    } catch (err) {
      const msg = extractError(err, "Global sign-out failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.5  DEVICE TOKEN MANAGEMENT  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/device-tokens
 */
export const getDeviceTokens = createAsyncThunk(
  "user/getDeviceTokens",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/device-tokens");
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Device token fetch failed."));
    }
  },
);

/**
 * POST /api/users/device-tokens
 * @body { token, platform: 'android'|'ios'|'web'|'desktop', deviceName? }
 */
export const registerDeviceToken = createAsyncThunk(
  "user/registerDeviceToken",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/device-tokens", payload);
      return data;
    } catch (err) {
      return rejectWithValue(
        extractError(err, "Device token registration failed."),
      );
    }
  },
);

/**
 * DELETE /api/users/device-tokens/:token
 * @param token — raw FCM/APNs token string
 */
export const removeDeviceToken = createAsyncThunk(
  "user/removeDeviceToken",
  async (token, { rejectWithValue }) => {
    try {
      await API.delete(`/users/device-tokens/${encodeURIComponent(token)}`);
      return token;
    } catch (err) {
      return rejectWithValue(extractError(err, "Device token removal failed."));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.6  HEARTBEAT  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/users/heartbeat
 * Call every 30–60 s while the app is in the foreground.
 * Silent — never disrupts UX on failure.
 */
export const sendHeartbeat = createAsyncThunk(
  "user/heartbeat",
  async (_, { rejectWithValue }) => {
    try {
      await API.post("/users/heartbeat");
      return true;
    } catch {
      return rejectWithValue(null);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.7  LOCATION  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/users/update-location-by-address
 * @body { address: string }
 */
export const updateLocationByAddress = createAsyncThunk(
  "user/updateLocationByAddress",
  async (address, { rejectWithValue }) => {
    try {
      const { data } = await API.patch("/users/update-location-by-address", {
        address,
      });
      if (data?.data?.user) storage.patchUser(data.data.user);
      toast.success(`Location set: ${data?.data?.address ?? address}`);
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Location update failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * PATCH /api/users/update-location
 * @body { lat, lng, address? }
 */
export const updateLocationByCoords = createAsyncThunk(
  "user/updateLocationByCoords",
  async (coords, { rejectWithValue }) => {
    try {
      const { data } = await API.patch("/users/update-location", coords);
      if (data?.data?.user) storage.patchUser(data.data.user);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, "GPS location update failed."));
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.8  WALLET  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/wallet
 * @query { page?, limit? }
 */
export const getWallet = createAsyncThunk(
  "user/getWallet",
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/users/wallet?page=${page}&limit=${limit}`,
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Wallet fetch failed."));
    }
  },
);

/**
 * POST /api/users/wallet/redeem-coins
 * @body { coins: number }  — min 500 coins
 */
export const redeemCoins = createAsyncThunk(
  "user/redeemCoins",
  async (coins, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/wallet/redeem-coins", { coins });
      toast.success(data.message ?? `${coins} coins redeemed successfully!`);
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Coin redemption failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.9  REFERRAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/referral/my-code  (Protected)
 */
export const getReferralCode = createAsyncThunk(
  "user/getReferralCode",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/referral/my-code");
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Referral code fetch failed."));
    }
  },
);

/**
 * GET /api/users/referral/validate?code=XYZ  (Public — no auth)
 * @param code — referral code string (6–12 chars)
 */
export const validateReferralCode = createAsyncThunk(
  "user/validateReferralCode",
  async (code, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/users/referral/validate?code=${encodeURIComponent(code)}`,
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(
        extractError(err, "Referral code validation failed."),
      );
    }
  },
);

/**
 * POST /api/users/referral/apply  (Protected)
 * @body { referralCode: string }
 * One-time. Server blocks if referredBy is already set.
 */
export const applyReferralCode = createAsyncThunk(
  "user/applyReferralCode",
  async (referralCode, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/referral/apply", {
        referralCode,
      });
      toast.success(data.message ?? "Referral code applied successfully!");
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Referral apply failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.10  CUSTOMER SETTINGS  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/settings
 */
export const getSettings = createAsyncThunk(
  "user/getSettings",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/settings");
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Settings fetch failed."));
    }
  },
);

/**
 * POST /api/users/settings/verify-phone
 */
export const verifyPhone = createAsyncThunk(
  "user/verifyPhone",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/settings/verify-phone");
      toast.success("OTP sent to your phone number.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Could not send phone OTP.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/settings/verify-phone/confirm
 * @body { otp: string (6 digits) }
 */
export const confirmPhoneVerification = createAsyncThunk(
  "user/verifyPhoneConfirm",
  async (otp, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/settings/verify-phone/confirm", {
        otp,
      });
      toast.success("Phone number verified!");
      return data;
    } catch (err) {
      const msg = extractError(err, "Phone verification failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/settings/request-email-change
 * @body { newEmail: string }
 */
export const requestEmailChange = createAsyncThunk(
  "user/requestEmailChange",
  async (newEmail, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/settings/request-email-change", {
        newEmail,
      });
      toast.success("Verification OTP sent to your current email.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Email change request failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/settings/confirm-email-change
 * @body { otp: string (6 digits) }
 * Response: { success, message, newEmail }
 */
export const confirmEmailChange = createAsyncThunk(
  "user/confirmEmailChange",
  async (otp, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/settings/confirm-email-change", {
        otp,
      });
      toast.success("Email changed! Please verify your new email address.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Email change confirmation failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * DELETE /api/users/settings/google-unlink
 */
export const unlinkGoogle = createAsyncThunk(
  "user/googleUnlink",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete("/users/settings/google-unlink");
      toast.success("Google account unlinked.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Google unlink failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * GET /api/users/settings/activity
 */
export const getAccountActivity = createAsyncThunk(
  "user/getActivity",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/settings/activity");
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Activity fetch failed."));
    }
  },
);

/**
 * PATCH /api/users/settings/legal
 * @body { acceptTerms?: boolean, acceptPrivacy?: boolean }
 */
export const acceptLegal = createAsyncThunk(
  "user/acceptLegal",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch("/users/settings/legal", payload);
      toast.success("Legal acceptance recorded.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Could not record legal acceptance.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/settings/deactivate
 * @body { password: string }
 * Side-effect: clears local auth.
 */
export const deactivateAccount = createAsyncThunk(
  "user/deactivate",
  async (password, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/settings/deactivate", {
        password,
      });
      storage.clearAuth();
      toast.success("Account deactivated. Contact support to reactivate.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Account deactivation failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.11  ADMIN / SUPERADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/admin/users
 * @query { page?, limit?, role?, isBlocked?, search? }
 */
export const adminGetAllUsers = createAsyncThunk(
  "user/adminGetAllUsers",
  async (
    { page = 1, limit = 20, role, isBlocked, search } = {},
    { rejectWithValue },
  ) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (role !== undefined) params.set("role", role);
      if (isBlocked !== undefined) params.set("isBlocked", isBlocked);
      if (search) params.set("search", search);
      const { data } = await API.get(`/users/admin/users?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, "User list fetch failed."));
    }
  },
);

/**
 * PATCH /api/users/admin/update-role/:id
 * @body { role: string }
 */
export const adminUpdateRole = createAsyncThunk(
  "user/adminUpdateRole",
  async ({ id, role }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/users/admin/update-role/${id}`, {
        role,
      });
      toast.success(`Role changed to ${role}.`);
      return data;
    } catch (err) {
      const msg = extractError(err, "Role update failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * PATCH /api/users/admin/suspend/:id
 * @body { reason?, durationDays? }
 */
export const adminSuspendUser = createAsyncThunk(
  "user/adminSuspendUser",
  async ({ id, reason, durationDays }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/users/admin/suspend/${id}`, {
        reason,
        durationDays,
      });
      toast.success("User suspended successfully.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Suspension failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * PATCH /api/users/admin/unblock/:id
 */
export const adminUnblockUser = createAsyncThunk(
  "user/adminUnblockUser",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/users/admin/unblock/${id}`);
      toast.success("User unblocked successfully.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Unblock failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * POST /api/users/admin/reset-otp/:email
 */
export const adminResetOtp = createAsyncThunk(
  "user/adminResetOtp",
  async (email, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/users/admin/reset-otp/${email}`);
      toast.success("OTP state cleared.");
      return data;
    } catch (err) {
      const msg = extractError(err, "OTP reset failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * GET /api/users/admin/user/:id/coins
 */
export const adminGetUserCoins = createAsyncThunk(
  "user/adminGetUserCoins",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/users/admin/user/${userId}/coins`);
      return data.data;
    } catch (err) {
      return rejectWithValue(
        extractError(err, "User coin details fetch failed."),
      );
    }
  },
);

/**
 * POST /api/users/admin/credit-coins/:id  (superadmin only)
 * @body { coins: number, reason: string }
 */
export const adminCreditCoins = createAsyncThunk(
  "user/adminCreditCoins",
  async ({ id, coins, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/users/admin/credit-coins/${id}`, {
        coins,
        reason,
      });
      toast.success(data.message ?? `${coins} coins credited.`);
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Coin credit failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * GET /api/users/admin/user/:id/sessions
 */
export const adminGetUserSessions = createAsyncThunk(
  "user/adminGetUserSessions",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/users/admin/user/${userId}/sessions`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, "User session fetch failed."));
    }
  },
);

/**
 * DELETE /api/users/admin/user/:id/sessions
 * Force signs out ALL sessions for any user.
 */
export const adminForceSignOut = createAsyncThunk(
  "user/adminForceSignOut",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/users/admin/user/${userId}/sessions`);
      toast.success("User has been signed out from all devices.");
      return { userId, ...data };
    } catch (err) {
      const msg = extractError(err, "Force sign-out failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4.11b  COOKIE CONSENT  (Protected)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/users/cookie-consent */
export const getCookieConsent = createAsyncThunk(
  "user/getCookieConsent",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/users/cookie-consent");
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, "Cookie consent fetch failed."));
    }
  },
);

/**
 * POST /api/users/cookie-consent
 * @body { acceptAll: true }
 *   OR
 * @body { preferences: { analytics?, marketing?, functional? } }
 */
export const saveCookieConsent = createAsyncThunk(
  "user/saveCookieConsent",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/users/cookie-consent", payload);
      toast.success("Cookie preferences saved.");
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Could not save cookie preferences.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/**
 * PATCH /api/users/cookie-consent
 * @body { preferences: { analytics?, marketing?, functional? } }
 */
export const patchCookieConsent = createAsyncThunk(
  "user/patchCookieConsent",
  async (preferences, { rejectWithValue }) => {
    try {
      const { data } = await API.patch("/users/cookie-consent", {
        preferences,
      });
      toast.success("Cookie preferences updated.");
      return data.data;
    } catch (err) {
      const msg = extractError(err, "Cookie preference update failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/** DELETE /api/users/cookie-consent — GDPR withdraw */
export const withdrawCookieConsent = createAsyncThunk(
  "user/withdrawCookieConsent",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete("/users/cookie-consent");
      toast.success("Cookie consent withdrawn.");
      return data;
    } catch (err) {
      const msg = extractError(err, "Consent withdrawal failed.");
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

/** GET /api/users/admin/user/:id/cookie-consent  (admin/superadmin) */
export const adminGetUserCookieConsent = createAsyncThunk(
  "user/adminGetUserCookieConsent",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/users/admin/user/${userId}/cookie-consent`,
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(
        extractError(err, "User cookie consent fetch failed."),
      );
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  ACTION TYPE SETS  (O(1) lookup for extraReducers)
// ═══════════════════════════════════════════════════════════════════════════════

/** Actions that write token + base user into state */
const AUTH_FULFILLED = new Set([
  signup.fulfilled.type,
  login.fulfilled.type,
  otpLogin.fulfilled.type,
  handleGoogleCallback.fulfilled.type,
]);

/** Actions that sync the full user / profile object */
const PROFILE_FULFILLED = new Set([
  getProfile.fulfilled.type,
  updateProfile.fulfilled.type,
  updateLocationByAddress.fulfilled.type,
  updateLocationByCoords.fulfilled.type,
]);

/**
 * Actions that fully wipe auth state.
 * autoLogout is handled separately (in reducers) so it can be dispatched
 * synchronously by the api.js interceptor without going through createAsyncThunk.
 */
const CLEANUP_FULFILLED = new Set([
  logout.fulfilled.type,
  deleteAccount.fulfilled.type,
  revokeAllSessions.fulfilled.type,
  resetPassword.fulfilled.type,
  deactivateAccount.fulfilled.type,
]);

/** Admin single-user patch (update allUsers list entry) */
const ADMIN_USER_PATCH = new Set([
  adminUpdateRole.fulfilled.type,
  adminSuspendUser.fulfilled.type,
  adminUnblockUser.fulfilled.type,
]);

// ── Fine-grained loader key map ────────────────────────────────────────────────
const LOADER_MAP = {
  // Auth
  "user/login": "login",
  "user/signup": "signup",
  "user/logout": "logout",
  "user/requestOtp": "otpRequest",
  "user/requestOtpLogin": "requestOtpLogin",
  "user/otpLogin": "otpLogin",
  "user/verifyEmail": "verifyEmail",
  "user/forgotPassword": "forgotPassword",
  "user/resetPassword": "resetPassword",
  "user/googleCallback": "googleCallback",

  // Profile
  "user/getProfile": "profile",
  "user/updateProfile": "updateProfile",
  "user/changePassword": "changePassword",
  "user/deleteAccount": "deleteAccount",

  // Sessions
  "user/getActiveSessions": "sessions",
  "user/revokeSession": "revokeSession",
  "user/revokeAllSessions": "revokeAllSessions",

  // Device tokens
  "user/getDeviceTokens": "deviceTokens",
  "user/registerDeviceToken": "registerDeviceToken",
  "user/removeDeviceToken": "removeDeviceToken",

  // Heartbeat
  "user/heartbeat": "heartbeat",

  // Location
  "user/updateLocationByAddress": "locationByAddress",
  "user/updateLocationByCoords": "locationByCoords",

  // Wallet
  "user/getWallet": "wallet",
  "user/redeemCoins": "redeemCoins",

  // Referral
  "user/getReferralCode": "referralCode",
  "user/validateReferralCode": "referralValidate",
  "user/applyReferralCode": "applyReferral",

  // Settings
  "user/getSettings": "settings",
  "user/verifyPhone": "verifyPhone",
  "user/verifyPhoneConfirm": "verifyPhoneConfirm",
  "user/requestEmailChange": "requestEmailChange",
  "user/confirmEmailChange": "confirmEmailChange",
  "user/googleUnlink": "googleUnlink",
  "user/getActivity": "activity",
  "user/acceptLegal": "legalAccept",
  "user/deactivate": "deactivate",

  // Admin
  "user/adminGetAllUsers": "adminUsers",
  "user/adminUpdateRole": "adminUpdateRole",
  "user/adminSuspendUser": "adminSuspend",
  "user/adminUnblockUser": "adminUnblock",
  "user/adminResetOtp": "adminResetOtp",
  "user/adminGetUserCoins": "adminUserCoins",
  "user/adminCreditCoins": "adminCreditCoins",
  "user/adminGetUserSessions": "adminUserSessions",
  "user/adminForceSignOut": "adminForceSignOut",
  "user/getCookieConsent": "getCookieConsent",
  "user/saveCookieConsent": "cookieConsent",
  "user/patchCookieConsent": "updateCookieConsent",
  "user/withdrawCookieConsent": "withdrawCookieConsent",
  "user/adminGetUserCookieConsent": "adminUserCookieConsent",
};

const getLoaderKey = (actionType) => {
  const base = actionType.split("/").slice(0, 2).join("/");
  return LOADER_MAP[base] ?? null;
};

// ── Shared auth wipe helper (used by both autoLogout reducer and CLEANUP_FULFILLED) ──
const wipeAuthState = (state) => {
  state.user = null;
  state.token = null;
  state.profile = null;
  state.activeSessions = [];
  state.deviceTokens = [];
  state.referral = initialState.referral;
  state.settings = null;
  state.activity = null;
  state.referralValidation = null;
  state.adminUserCoins = null;
  state.adminUserSessions = null;
  // NOTE: intentionally do NOT reset isLoggingOut here —
  // it stays true until the user successfully logs in again
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const userSlice = createSlice({
  name: "user",
  initialState,

  // ── Synchronous actions ──────────────────────────────────────────────────────
  reducers: {
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Full reset — used on hard logout or token expiry detected client-side.
     */
    resetAuthState: (state) => {
      wipeAuthState(state);
      state.error = null;
      storage.clearAuth();
    },

    /**
     * autoLogout — dispatched by api.js interceptor when the server returns
     * a 401 with one of the recognised auto-logout codes:
     *
     *   TOKEN_EXPIRED        — JWT has expired (12h default)
     *   TOKEN_INVALID        — JWT malformed / wrong secret
     *   SESSION_REVOKED      — session deleted via remote sign-out
     *   USER_NOT_FOUND       — account deleted while token was valid
     *   ACCOUNT_BLOCKED      — account suspended server-side
     *
     * This is a synchronous reducer so it fires immediately in the interceptor
     * without needing to await a thunk, giving the fastest possible logout UX.
     *
     * @param action.payload — the error code string from the server
     */
    autoLogout: (state, action) => {
      // ── Guard: only fire once per session ─────────────────
      if (state.isLoggingOut) return; // ← swallow all duplicate calls
      state.isLoggingOut = true;
      // ──────────────────────────────────────────────────────

      const code = action.payload ?? "SESSION_EXPIRED";
      const messages = {
        TOKEN_EXPIRED: "Your session has expired. Please log in again.",
        TOKEN_INVALID: "Invalid session. Please log in again.",
        SESSION_REVOKED: "You were signed out from another device.",
        USER_NOT_FOUND: "Your account no longer exists.",
        ACCOUNT_BLOCKED: "Your account has been suspended.",
      };

      setTimeout(() => {
        toast.error(messages[code] ?? "Session ended. Please log in again.");
      }, 0);

      wipeAuthState(state);
      state.error = messages[code] ?? "Session ended.";
      storage.clearAuth();
    },

    /**
     * Patch user fields locally (e.g. WebSocket push or optimistic update).
     * Keeps localStorage in sync.
     */
    patchUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        storage.patchUser(state.user);
      }
    },

    /** Set isOnline flag locally from WebSocket events */
    setOnlineStatus: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, isOnline: action.payload };
      }
    },

    /**
     * Patch coin fields on the user object locally (e.g. real-time WS event).
     * @payload { coins?, coinsEarned?, coinsRedeemed? }
     */
    patchCoins: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        storage.patchUser(state.user);
      }
      if (action.payload.coins !== undefined)
        state.referral.coins = action.payload.coins;
      if (action.payload.coinsEarned !== undefined)
        state.referral.coinsEarned = action.payload.coinsEarned;
      if (action.payload.coinsRedeemed !== undefined)
        state.referral.coinsRedeemed = action.payload.coinsRedeemed;
    },

    /** Optimistically prepend a new audit session */
    addLocalSession: (state, action) => {
      state.activeSessions = [action.payload, ...state.activeSessions];
    },

    /** Update wallet balance locally (e.g. after WS notification) */
    patchWalletBalance: (state, action) => {
      state.wallet.balance = action.payload;
    },

    clearAdminUserCoins: (state) => {
      state.adminUserCoins = null;
    },

    clearAdminUserSessions: (state) => {
      state.adminUserSessions = null;
    },

    clearReferralValidation: (state) => {
      state.referralValidation = null;
    },

    clearSettings: (state) => {
      state.settings = null;
      state.activity = null;
    },
  },

  // ── Async matchers ───────────────────────────────────────────────────────────
  extraReducers: (builder) => {
    builder

      // ── PENDING ─────────────────────────────────────────────────────────────
      .addMatcher(
        (action) => action.type.endsWith("/pending"),
        (state, action) => {
          state.loading = true;
          state.error = null;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = true;
        },
      )

      // ── REJECTED ────────────────────────────────────────────────────────────
      .addMatcher(
        (action) => action.type.endsWith("/rejected"),
        (state, action) => {
          state.loading = false;
          state.error = action.payload ?? "An unexpected error occurred.";
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = false;
        },
      )

      // ── FULFILLED ────────────────────────────────────────────────────────────
      .addMatcher(
        (action) => action.type.endsWith("/fulfilled"),
        (state, action) => {
          state.loading = false;
          state.error = null;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = false;

          // ── 1. AUTH: write token + base user ──────────────────────────────
          if (AUTH_FULFILLED.has(action.type)) {
            state.user = action.payload?.user ?? null;
            state.token = action.payload?.token ?? null;
            state.isLoggingOut = false; // ← reset the guard on fresh login
          }

          // ── 2. PROFILE: full sync ─────────────────────────────────────────
          if (PROFILE_FULFILLED.has(action.type)) {
            const source = action.payload?.data ?? action.payload;
            if (source) {
              if (action.type === getProfile.fulfilled.type) {
                const { profile, ...userFields } = source;
                state.user = userFields;
                state.profile = profile ?? null;
                storage.patchUser(userFields);
              } else {
                if (source.user) {
                  state.user = source.user;
                  storage.patchUser(source.user);
                }
                if (source.profile !== undefined)
                  state.profile = source.profile;
              }
            }
          }

          // ── 3. CLEANUP: wipe all auth state ──────────────────────────────
          if (CLEANUP_FULFILLED.has(action.type)) {
            wipeAuthState(state);
          }

          // ── 4. SESSIONS ───────────────────────────────────────────────────
          if (action.type === getActiveSessions.fulfilled.type) {
            state.activeSessions = action.payload?.data ?? [];
          }

          if (action.type === revokeSession.fulfilled.type) {
            const sessionId = action.payload?.sessionId;
            if (sessionId) {
              state.activeSessions = state.activeSessions.filter(
                (s) => s._id !== sessionId,
              );
            }
            if (state.activity?.activeSessions) {
              state.activity.activeSessions =
                state.activity.activeSessions.filter(
                  (s) => s._id !== action.payload?.sessionId,
                );
            }
          }

          // ── 5. DEVICE TOKENS ──────────────────────────────────────────────
          if (action.type === getDeviceTokens.fulfilled.type) {
            state.deviceTokens = action.payload?.data ?? [];
          }

          if (action.type === removeDeviceToken.fulfilled.type) {
            state.deviceTokens = state.deviceTokens.filter(
              (t) => t.token !== action.payload,
            );
            if (state.activity?.registeredDevices) {
              state.activity.registeredDevices =
                state.activity.registeredDevices.filter(
                  (d) => d.token !== action.payload,
                );
            }
          }

          // ── 6. WALLET ─────────────────────────────────────────────────────
          if (action.type === getWallet.fulfilled.type && action.payload) {
            state.wallet.balance = action.payload.balance ?? 0;
            state.wallet.currency = action.payload.currency ?? "INR";
            state.wallet.isActive = action.payload.isActive ?? true;
            state.wallet.withdrawableBalance =
              action.payload.withdrawableBalance ?? 0;
            state.wallet.lockedBalance = action.payload.lockedBalance ?? 0;
            state.wallet.availableBalance =
              action.payload.availableBalance ?? 0;
            state.wallet.transactions = action.payload.transactions ?? [];
            state.wallet.pagination =
              action.payload.pagination ?? state.wallet.pagination;
          }

          // ── 7. REDEEM COINS ───────────────────────────────────────────────
          if (action.type === redeemCoins.fulfilled.type && action.payload) {
            const p = action.payload;

            state.wallet.balance = p.walletBalance ?? state.wallet.balance;

            if (p.coinsRedeemed && p.rupeesEarned) {
              state.wallet.transactions = [
                {
                  type: "Credit",
                  amount: p.rupeesEarned,
                  purpose: "Coin_Conversion",
                  description: `${p.coinsRedeemed} coins redeemed → ₹${p.rupeesEarned}`,
                  balanceAfter: p.walletBalance,
                  status: "Success",
                  timestamp: new Date().toISOString(),
                },
                ...state.wallet.transactions,
              ];
            }

            if (state.user) {
              state.user = {
                ...state.user,
                coins: p.remainingCoins ?? state.user.coins,
                coinsRedeemed: p.totalCoinsRedeemed ?? state.user.coinsRedeemed,
              };
              storage.patchUser(state.user);
            }

            state.referral.coins = p.remainingCoins ?? state.referral.coins;
            state.referral.coinsInRupees =
              p.remainingRupees ?? state.referral.coinsInRupees;
            state.referral.coinsRedeemed =
              p.totalCoinsRedeemed ?? state.referral.coinsRedeemed;

            if (state.settings?.coins) {
              state.settings.coins.balance =
                p.remainingCoins ?? state.settings.coins.balance;
              state.settings.coins.balanceRupees =
                p.remainingRupees ?? state.settings.coins.balanceRupees;
              state.settings.coins.redeemed =
                p.totalCoinsRedeemed ?? state.settings.coins.redeemed;
            }
          }

          // ── 8. REFERRAL: fetch my code ────────────────────────────────────
          if (
            action.type === getReferralCode.fulfilled.type &&
            action.payload
          ) {
            const p = action.payload;
            state.referral = {
              referralCode: p.referralCode ?? null,
              totalReferrals: p.totalReferrals ?? 0,
              coins: p.coins ?? 0,
              coinsInRupees: p.coinsInRupees ?? 0,
              coinsEarned: p.coinsEarned ?? 0,
              coinsRedeemed: p.coinsRedeemed ?? 0,
              referredBy: p.referredBy ?? null,
              referralHistory: p.referralHistory ?? [],
            };
            if (state.user) {
              state.user = {
                ...state.user,
                coins: p.coins ?? state.user.coins,
                coinsEarned: p.coinsEarned ?? state.user.coinsEarned,
                coinsRedeemed: p.coinsRedeemed ?? state.user.coinsRedeemed,
                referralCode: p.referralCode ?? state.user.referralCode,
              };
              storage.patchUser(state.user);
            }
          }

          // ── 9. REFERRAL: validate (public) ───────────────────────────────
          if (action.type === validateReferralCode.fulfilled.type) {
            state.referralValidation = action.payload ?? null;
          }

          // ── 10. REFERRAL: apply a code post-signup ─────────────────────
          if (
            action.type === applyReferralCode.fulfilled.type &&
            action.payload
          ) {
            const p = action.payload;
            if (state.user) {
              state.user = {
                ...state.user,
                coins: p.yourCoins ?? state.user.coins,
              };
              storage.patchUser(state.user);
            }
            state.referral.coins = p.yourCoins ?? state.referral.coins;
            state.referral.coinsInRupees =
              p.yourCoinsRupees ?? state.referral.coinsInRupees;
          }

          // ── 11. SETTINGS: full snapshot ───────────────────────────────────
          if (action.type === getSettings.fulfilled.type && action.payload) {
            state.settings = action.payload;
          }

          // ── 12. SETTINGS: phone verified ──────────────────────────────────
          if (action.type === confirmPhoneVerification.fulfilled.type) {
            if (state.user) {
              state.user = { ...state.user, isPhoneVerified: true };
              storage.patchUser(state.user);
            }
            if (state.settings?.verification) {
              state.settings.verification.isPhoneVerified = true;
            }
          }

          // ── 13. SETTINGS: email change confirmed ──────────────────────────
          if (
            action.type === confirmEmailChange.fulfilled.type &&
            action.payload?.newEmail
          ) {
            const newEmail = action.payload.newEmail;
            if (state.user) {
              state.user = {
                ...state.user,
                email: newEmail,
                isEmailVerified: false,
              };
              storage.patchUser(state.user);
            }
            if (state.settings?.profile)
              state.settings.profile.email = newEmail;
            if (state.settings?.verification)
              state.settings.verification.isEmailVerified = false;
          }

          // ── 14. SETTINGS: email verified (via verify-email route) ─────────
          if (action.type === verifyEmail.fulfilled.type && state.user) {
            state.user = { ...state.user, isEmailVerified: true };
            storage.patchUser(state.user);
            if (state.settings?.verification) {
              state.settings.verification.isEmailVerified = true;
            }
          }

          // ── 15. SETTINGS: Google unlinked ─────────────────────────────────
          if (action.type === unlinkGoogle.fulfilled.type) {
            if (state.user) {
              state.user = {
                ...state.user,
                googleAuth: { googleId: null, isVerified: false },
              };
              storage.patchUser(state.user);
            }
            if (state.settings?.verification) {
              state.settings.verification.isGoogleLinked = false;
              state.settings.verification.googleVerified = false;
            }
          }

          // ── 16. SETTINGS: legal acceptance ────────────────────────────────
          if (
            action.type === acceptLegal.fulfilled.type &&
            action.payload?.updated
          ) {
            const upd = action.payload.updated;
            if (state.settings?.legal) {
              if (upd.termsAcceptedAt)
                state.settings.legal.termsAcceptedAt = upd.termsAcceptedAt;
              if (upd.privacyPolicyAcceptedAt)
                state.settings.legal.privacyPolicyAcceptedAt =
                  upd.privacyPolicyAcceptedAt;
            }
            if (state.user) {
              state.user = { ...state.user, ...upd };
              storage.patchUser(state.user);
            }
          }

          // ── 17. SETTINGS: activity snapshot ──────────────────────────────
          if (
            action.type === getAccountActivity.fulfilled.type &&
            action.payload
          ) {
            state.activity = action.payload;
          }

          // ── 18. ADMIN: paginated user list ────────────────────────────────
          if (action.type === adminGetAllUsers.fulfilled.type) {
            state.allUsers.data = action.payload?.data ?? [];
            state.allUsers.total = action.payload?.total ?? 0;
            state.allUsers.pages = action.payload?.pages ?? 1;
            state.allUsers.currentPage = action.payload?.currentPage ?? 1;
          }

          // ── 19. ADMIN: optimistic single-user patch in list ───────────────
          if (ADMIN_USER_PATCH.has(action.type)) {
            const updated = action.payload?.user;
            if (updated?._id) {
              state.allUsers.data = state.allUsers.data.map((u) =>
                u._id === updated._id ? updated : u,
              );
            }
          }

          // ── 20. ADMIN: single user coin detail ────────────────────────────
          if (action.type === adminGetUserCoins.fulfilled.type) {
            state.adminUserCoins = action.payload ?? null;
          }

          // ── 21. ADMIN: credit coins → patch list entry ────────────────────
          if (
            action.type === adminCreditCoins.fulfilled.type &&
            action.payload?.userId
          ) {
            const { userId, newBalance } = action.payload;
            state.allUsers.data = state.allUsers.data.map((u) =>
              u._id === userId ? { ...u, coins: newBalance } : u,
            );
            if (
              state.adminUserCoins &&
              state.adminUserCoins.userId === userId
            ) {
              state.adminUserCoins.coins = newBalance;
            }
          }

          // ── 22. ADMIN: user sessions view ─────────────────────────────────
          if (action.type === adminGetUserSessions.fulfilled.type) {
            state.adminUserSessions = action.payload ?? null;
          }

          // ── 23. ADMIN: force sign-out ─────────────────────────────────────
          if (action.type === adminForceSignOut.fulfilled.type) {
            state.adminUserSessions = null;
            const userId = action.payload?.userId;
            if (userId) {
              state.allUsers.data = state.allUsers.data.map((u) =>
                u._id === userId ? { ...u, isOnline: false } : u,
              );
            }
          }
          // ── 17b. COOKIE CONSENT ───────────────────────────────────────────────────
          if (
            action.type === getCookieConsent.fulfilled.type ||
            action.type === saveCookieConsent.fulfilled.type ||
            action.type === patchCookieConsent.fulfilled.type
          ) {
            if (action.payload) state.cookieConsent = action.payload;
          }

          if (action.type === withdrawCookieConsent.fulfilled.type) {
            state.cookieConsent = {
              consentGiven: false,
              preferences: {
                necessary: true,
                analytics: false,
                marketing: false,
                functional: false,
              },
            };
          }

          // ── 24. isOnline sync after sign-out events ───────────────────────
          if (
            action.type === logout.fulfilled.type ||
            action.type === revokeAllSessions.fulfilled.type ||
            action.type === deactivateAccount.fulfilled.type
          ) {
            if (state.user) state.user = { ...state.user, isOnline: false };
          }
        },
      );
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────────────────────────────────
export const selectUser = (s) => s.user.user;
export const selectCurrentUser = (s) => s.user.user;
export const selectToken = (s) => s.user.token;
export const selectProfile = (s) => s.user.profile;
export const selectIsLoggedIn = (s) => !!s.user.token;

// ── Coins (single source of truth = user object) ──────────────────────────────
export const selectCoins = (s) => s.user.user?.coins ?? 0;
export const selectCoinsEarned = (s) => s.user.user?.coinsEarned ?? 0;
export const selectCoinsRedeemed = (s) => s.user.user?.coinsRedeemed ?? 0;
export const selectCoinsRupees = (s) =>
  +((s.user.user?.coins ?? 0) / 100).toFixed(2);

// ── Referral ──────────────────────────────────────────────────────────────────
export const selectReferral = (s) => s.user.referral;
export const selectReferralValidation = (s) => s.user.referralValidation;

// ── Sessions & device tokens ──────────────────────────────────────────────────
export const selectActiveSessions = (s) => s.user.activeSessions;
export const selectDeviceTokens = (s) => s.user.deviceTokens;

// ── Wallet ────────────────────────────────────────────────────────────────────
export const selectWallet = (s) => s.user.wallet;
export const selectWalletBalance = (s) => s.user.wallet.balance;
export const selectWithdrawableBalance = (s) =>
  s.user.wallet.withdrawableBalance;
export const selectAvailableBalance = (s) => s.user.wallet.availableBalance;

// ── Customer Settings ─────────────────────────────────────────────────────────
export const selectSettings = (s) => s.user.settings;
export const selectActivity = (s) => s.user.activity;

// ── Admin ─────────────────────────────────────────────────────────────────────
export const selectAllUsers = (s) => s.user.allUsers;
export const selectAdminUserCoins = (s) => s.user.adminUserCoins;
export const selectAdminUserSessions = (s) => s.user.adminUserSessions;

// ── Cookie Consent ────────────────────────────────────────────────────────────
export const selectCookieConsent = (s) => s.user.cookieConsent;
export const selectCookieConsentGiven = (s) =>
  s.user.cookieConsent?.consentGiven ?? false;
export const selectCookiePreferences = (s) =>
  s.user.cookieConsent?.preferences ?? null;
export const selectAnalyticsCookieAllowed = (s) =>
  s.user.cookieConsent?.preferences?.analytics ?? false;
export const selectMarketingCookieAllowed = (s) =>
  s.user.cookieConsent?.preferences?.marketing ?? false;

// ── Global / per-feature loaders ──────────────────────────────────────────────
export const selectLoading = (s) => s.user.loading;
export const selectError = (s) => s.user.error;
export const selectLoaders = (s) => s.user.loaders;
export const selectLoader = (key) => (s) => s.user.loaders[key] ?? false;

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  clearError,
  resetAuthState,
  autoLogout, // ← dispatched by api.js interceptor on TOKEN_EXPIRED / SESSION_REVOKED etc.
  patchUser,
  setOnlineStatus,
  patchCoins,
  addLocalSession,
  patchWalletBalance,
  clearAdminUserCoins,
  clearAdminUserSessions,
  clearReferralValidation,
  clearSettings,
} = userSlice.actions;

export default userSlice.reducer;
