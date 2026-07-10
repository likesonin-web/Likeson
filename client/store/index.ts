import { configureStore } from "@reduxjs/toolkit";

import accountingReducer from "./slices/accountingSlice";
import adminAnalysticsReducer from "./slices/adminAnalyticsSlice";
import adminUserReducer from "./slices/adminUserSlice";
import adsReducer from "./slices/adsSlice";
import availabilityReducer from "./slices/availabilitySlice";
import bannersReducer from "./slices/bannerSlice";
import bloodbankReducer from "./slices/bloodbankSlice";
import bookingReducer from "./slices/bookingSlice";
import careAssistantReducer from "./slices/careAssistantSlice";
import partnerWalletReducer from "./slices/partnerWalletSlice";
import clinicalReducer from "./slices/clinicalSlice";
import consultationReducer from "./slices/consultationSlice";
 
 
import presenceReducer from './slices/presenceSlice';
import attachmentsReducer from './slices/attachmentSlice';
import customerProfileReducer from "./slices/customerProfileSlice";
import driverReducer from "./slices/driverSlice";
import faqReducer from "./slices/faqSlice";
import heroPageReducer from "./slices/heroPageSlice";
import hospitalManagerReducer from "./slices/hospitalManagerSlice";
import hospitalReducer from "./slices/hospitalSlice";
import labPartnerBookingsReducer from "./slices/labPartnerBookingSlice";
import labReducer from "./slices/labSlice";
import legalReducer from "./slices/legalSlice";
import marqueeReducer from "./slices/marqueeSlice";
import medicineReducer from "./slices/medicineSlice";
import meetingsReducer from "./slices/meetingSlice";
import notificationsReducer from "./slices/notificationSlice";
import operationsReducer from "./slices/operationsSlice";
import payAtServiceReducer from './slices/payAtServiceSlice';
import pharmacyOrderReducer from "./slices/pharmacyOrderSlice";
import pharmacyReducer from "./slices/pharmacySlice";
import pharmacyStoreReducer from "./slices/pharmacy/pharmacyStoreSlice";
import platformPricingReducer from "./slices/platformPricingSlice";
import promotionReducer from "./slices/promotionSlice";
import referralReducer from "./slices/referralSlice";
import rideRequestReducer from "./slices/rideRequestSlice";
import soloDriverReducer from "./slices/soloDriverSlice";
import subscriptionPlansReducer from "./slices/subscriptionPlanSlice";
import usersubscriptionPlansReducer from "./slices/subscriptionSlice";
import superadminReducer from "./slices/superadminSlice";
import transportPartnerReducer from "./slices/transportPartnerSlice";
import uploadReducer from "./slices/uploadSlice";
import userManagementReducer from "./slices/userManagementSlice";
import userReducer from "./slices/userSlice";
import walletReducer from "./slices/walletSlice";
import earningsReducer from './slices/earningsSlice';

import ticketReducer from './slices/ticketSlice';
import chatReducer from './slices/chatSlice';
import socketReducer from './slices/socketSlice';
import analyticsReducer from './slices/analyticsSlice';
// ─────────────────────────────────────────────────────────────────────────────
// STORE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    accounting: accountingReducer,
    adminAnalytics: adminAnalysticsReducer,
    adminUsers: adminUserReducer,
    ads: adsReducer,
    availability: availabilityReducer,
    banners: bannersReducer,
    bloodBank: bloodbankReducer,
    booking: bookingReducer,
    careAssistant: careAssistantReducer,
    attachments: attachmentsReducer, // Comma added here
    clinical: clinicalReducer,
    consultation: consultationReducer,
    // ── Support module ────────────────────────────────────────────────────
    ticket: ticketReducer,
    chat: chatReducer,
    supportSocket: socketReducer,
    supportAnalytics: analyticsReducer,
    presence: presenceReducer,
    customerProfile: customerProfileReducer,
    driver: driverReducer,
    faq: faqReducer,
    heroPage: heroPageReducer,
    hospital: hospitalReducer,
    hospitalManager: hospitalManagerReducer,
    labPartnerBookings: labPartnerBookingsReducer,
    labs: labReducer,
    legal: legalReducer,
    marquee: marqueeReducer,
    medicine: medicineReducer,
    meeting: meetingsReducer,
    notifications: notificationsReducer,
    operations: operationsReducer,
    payAtService: payAtServiceReducer,
    pharmacy: pharmacyReducer,
    pharmacyOrder: pharmacyOrderReducer,
    pharmacyStore: pharmacyStoreReducer,
    platformPricing: platformPricingReducer,
    promotion: promotionReducer,
    referral: referralReducer,
    rideRequest: rideRequestReducer,
    soloDriver: soloDriverReducer,
    subscriptionPlan: subscriptionPlansReducer,
    subscriptions: usersubscriptionPlansReducer,
    superadmin: superadminReducer,
    transportPartner: transportPartnerReducer,
    upload: uploadReducer,
    user: userReducer,
    userManagement: userManagementReducer,
    wallet: walletReducer,
    partnerWallet: partnerWalletReducer,
    earnings: earningsReducer,
  },
    middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Socket.IO client instances and Date objects pass through a couple of
      // support actions (presence/typing payloads) — serializableCheck stays
      // on for everything else, just narrowed for these specific paths.
      serializableCheck: {
        ignoredActions: ['supportSocket/setSocketInstance'],
        ignoredPaths: ['supportSocket.instance'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;