// models/RidePaymentIntent.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const geoSchema = new Schema(
  { type: { type: String, default: "Point" }, coordinates: [Number], label: String, address: String, city: String },
  { _id: false }
);

const ridePaymentIntentSchema = new Schema({
  booking:       { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  bookingCode:   String,
  requestedBy:   { type: Schema.Types.ObjectId, ref: "User", required: true },
  requesterRole: { type: String, enum: ["customer", "care_assistant"], required: true },

  pickup:      { type: geoSchema, required: true },
  dropoff:     { type: geoSchema, required: true },
  scheduledAt: Date,
  notes:       String,

  distKm:        Number,
  ratePerKm:     Number,
  rateSource:    String,
  transportFee:  Number,

  paymentMethod:  { type: String, enum: ["razorpay", "wallet"], default: null },
  razorpayOrderId: String,

  status: { type: String, enum: ["pending", "paid", "failed", "expired"], default: "pending", index: true },
  createdRideId: { type: Schema.Types.ObjectId, ref: "Ride", default: null },

  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // TTL auto-cleanup
}, { timestamps: true });

export default mongoose.model("RidePaymentIntent", ridePaymentIntentSchema);