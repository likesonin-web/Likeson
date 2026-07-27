import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * Notification Model — Likeson.in
 *
 * FIXES applied to this file:
 *  1. priority enum: added 'Normal' — the subscription router passes
 *     priority: 'Normal' in 7 out of 11 Notification.create() calls.
 *     Without 'Normal' in the enum every one of those creates throws a
 *     Mongoose ValidationError at runtime.
 *     'Normal' is treated as equivalent to 'Medium' in the sort order.
 *     TODO (router): migrate all priority: 'Normal' → priority: 'Medium'
*     and then remove 'Normal' from this enum.
 *
 * All other fields are unchanged from the reviewed version.
 */

// ── Channel Delivery Sub-schema ───────────────────────────────────────────────

const channelDeliverySchema = new Schema(
  {
    channel:       { type: String, enum: ['Push', 'SMS', 'WhatsApp', 'Email', 'InApp'], required: true },
    status:        { type: String, enum: ['Queued', 'Sent', 'Delivered', 'Read', 'Failed'], default: 'Queued' },
    sentAt:        { type: Date },
    deliveredAt:   { type: Date },
    readAt:        { type: Date },
    failureReason: { type: String },
    gatewayMsgId:  { type: String },  // SMS / WhatsApp / push gateway reference
    retryCount:    { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const notificationSchema = new Schema(
  {
    // ── Recipient ─────────────────────────────────────────────────────────
    recipient: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    // ── Content ───────────────────────────────────────────────────────────
    title:    { type: String, required: true, trim: true },
    body:     { type: String, required: true, trim: true },
    imageUrl: { type: String },    // rich push image

    // ── Type ──────────────────────────────────────────────────────────────
    type: {
      type:     String,
      required: true,
      enum: [
        // ── Booking / Ride lifecycle ─────────────────────────────────
        'Booking_Confirmed',
        'Booking_Cancelled',
        'Booking_Completed',
        'Booking_No_Show',

        // ── Driver / Ride ────────────────────────────────────────────
        'Ride_Request',
        'Ride_Update',
        'Driver_Assigned',
        'Driver_Arriving',
        'Driver_Arrived',

        // ── Care Assistant ───────────────────────────────────────────
        'Care_Assistant_Assigned',
        'Care_Assistant_Arriving',
        'Care_Task_Started',
        'Care_Task_Completed',
        'Leg_Update',

        // ── Doctor / Consultation ────────────────────────────────────
        'Appointment_Reminder',
        'Appointment_Confirmed',
        'Consultation_Started',
        'Prescription_Added',
        'Prescription_Update',
        'Follow_Up_Due',

        // ── Pharmacy / Medicine ──────────────────────────────────────
        'Order_Placed',
        'Order_Update',
        'Medicine_Ready',
        'Out_For_Delivery',
        'Order_Delivered',
        'Order_Cancelled',
        'Return_Verification',
        'Refund_Update',
        'Auto_Refill_Reminder',

        // ── Diagnostics / Lab ────────────────────────────────────────
        'Sample_Collection_Scheduled',
        'Sample_Collected',
        'Lab_Report_Ready',

        // ── Payments & Wallet ────────────────────────────────────────
        'Payment_Success',
        'Payment_Failed',
        'Refund_Processed',

        // ── Subscription ─────────────────────────────────────────────
        'Subscription_Activated',
        'Subscription_Expiring_Soon',
        'Subscription_Expired',
        'Subscription_Renewed',
        'Subscription_Renewal_Failed',

        // ── KYC & Account ────────────────────────────────────────────
        'KYC_Approved',
        'KYC_Rejected',
        'Account_Security',
        'Account_Status',       // used by subscriptionRouter for all sub events

        // ── Referral & Coins ─────────────────────────────────────────
        'Referral_Bonus',
        'Coins_Credited',
        'Coins_Redeemed',

        // ── Admin & Marketing ────────────────────────────────────────
        'SOS_Alert',
        'Promo_Marketing',
        'Admin_Announcement',
      ],
    },

    // ── Priority ─────────────────────────────────────────────────────────
    /**
     * FIX: 'Normal' added to prevent Mongoose ValidationError.
     *
     * The subscription router passes priority: 'Normal' in every
     * Notification.create() call that is not 'High' (7 occurrences).
     * Without this value in the enum all of those creates fail silently
     * with a validation error.
     *
     * Intended priority scale (high → low):
     *   Critical > High > Medium ≈ Normal > Low
     *
     * TODO: Once the router is updated to use 'Medium' instead of 'Normal'
     * everywhere, remove 'Normal' from this enum.
     */
    priority: {
      type:    String,
      enum:    ['Critical', 'High', 'Medium', 'Normal', 'Low'],
      default: 'Medium',
    },

    // ── Deep Link (actionable navigation) ────────────────────────────────
    deepLink: {
      screen:      { type: String },
      referenceId: { type: Schema.Types.ObjectId },
    },
    actionUrl: { type: String },

    // ── Linked Entity (polymorphic) ───────────────────────────────────────
    relatedEntityType: {
      type:    String,
      enum:    ['Booking', 'PharmacyOrder', 'UserSubscription', 'User', 'LabReport', null],
      default: null,
    },
    relatedEntityId: { type: Schema.Types.ObjectId, default: null },

    // ── Multi-channel Delivery Tracking ──────────────────────────────────
    channels: { type: [channelDeliverySchema], default: [] },

    // ── Read Status (root-level for fast unread-count queries) ────────────
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },

    // ── Scheduling ────────────────────────────────────────────────────────
    scheduledAt: { type: Date, default: null },
    expiresAt:   { type: Date, default: null },

    // ── Source ────────────────────────────────────────────────────────────
    triggeredBy: {
      type:    String,
      enum:    ['system', 'admin', 'automation'],
      default: 'system',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

notificationSchema.add({
  dedupeKey: { type: String, default: undefined }, // not null
});

notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true, sparse: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
 
 

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;