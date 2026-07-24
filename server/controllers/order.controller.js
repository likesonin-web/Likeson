import mongoose       from 'mongoose';
import Razorpay       from 'razorpay';
import crypto         from 'crypto';
import jwt            from 'jsonwebtoken';
import ImageKit       from 'imagekit';
import multer         from 'multer';
import { protect }    from '../middleware/authMiddleware.js';

// ── Models ────────────────────────────────────────────────────────────────────
import Medicine             from '../models/Medicine.js';
import Cart                 from '../models/Cart.js';
import PharmacyOrder        from '../models/PharmacyOrder.js';
import PharmacyStore        from '../models/PharmacyStore.js';
import UserSubscription     from '../models/UserSubscription.js';
import Wallet               from '../models/Wallet.js';
import Notification         from '../models/Notification.js';
import User                 from '../models/User.js';
import PromotionCoupon      from '../models/PromotionCoupon.js';
import SystemLog            from '../models/SystemLog.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import InventoryMovement    from '../models/InventoryMovement.js';
import MedicineInventory    from '../models/MedicineInventory.js';

// ── Utilities ─────────────────────────────────────────────────────────────────
import sendEmail from '../utils/sendEmail.js';
import {
  buildOrderEmailHtml,
  buildStatusUpdateEmail,
  buildRefundEmail,
  transactionalTemplate,
} from '../utils/emailTemplates.js';
import { generateInvoice } from '../utils/invoiceGenerator.js';
import cache from '../middleware/cache.js';


// ═══════════════════════════════════════════════════════════════════════════════
// § CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || 'rzp_test_SJTh9WQJSGGnIT';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '0IT2SC59bGq578K2QnUEleFX';

// ── Platform fee: flat ₹5 per order ──────────────────────────────────────────
const PLATFORM_FEE_FLAT = 5;

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPEG, PNG, WEBP, and PDF files are allowed for prescriptions.'));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// § LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

const logAudit = (action, meta = {}) =>
  console.log(`[AUDIT][${new Date().toISOString()}] ${action}`, meta);

const logError = (action, err, ctx = {}) =>
  console.error(`[ERROR][${new Date().toISOString()}] ${action}: ${err.message}`, { stack: err.stack, ctx });

const syslog = async (level, category, message, opts = {}) => {
  try {
    await SystemLog.createLog({ level, category, message, ...opts });
  } catch (err) {
    console.error('[syslog] Failed:', err.message);
  }
};

const actorFromReq = (req) => ({
  userId:    req.user?._id    ?? null,
  name:      req.user?.name   ?? 'anonymous',
  email:     req.user?.email  ?? null,
  role:      req.user?.role   ?? 'anonymous',
  ip:        req.ip           ?? 'unknown',
  userAgent: req.headers['user-agent'] ?? null,
  platform:  'web',
});

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logError('ASYNC_HANDLER', err, { userId: req.user?._id });
    logError('ASYNC_HANDLER', err, { path: req.originalUrl });
    next(err);
  });

// ═══════════════════════════════════════════════════════════════════════════════
// § OTP GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ═══════════════════════════════════════════════════════════════════════════════
// § OPTIONAL JWT USER
// ═══════════════════════════════════════════════════════════════════════════════

const getOptionalUserId = async (req) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer')) return null;
    const token   = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    return decoded.id;
  } catch { return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SAFE ORDER LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

const findOrderSafe = async (identifier, extraFilter = {}, session = null) => {
  if (!identifier) return null;
  const str = String(identifier).trim();
  const orConditions = [{ orderId: str }];
  if (mongoose.Types.ObjectId.isValid(str))
    orConditions.push({ _id: new mongoose.Types.ObjectId(str) });
  const query = PharmacyOrder.findOne({ $or: orConditions, ...extraFilter });
  if (session) query.session(session);
  try { return await query; }
  catch (err) { logError('FIND_ORDER_SAFE', err, { identifier }); return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § NOTIFICATION + EMAIL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchNotification = async (userId, payload, orderData = null, storeName = null, emailOverrideHtml = null) => {
  try {
    const { title, body, type, emailSubject, actionLink, headerNote = '' } = payload;
    await Notification.create({
      recipient: userId, title, body, type, priority: 'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: orderData?._id },
    });
    const user = await User.findById(userId).select('email name').lean();
    if (!user?.email) return;
    let html;
    if (emailOverrideHtml) {
      html = emailOverrideHtml;
    } else if (orderData) {
      html = buildOrderEmailHtml({
        userName: user.name, order: orderData, orderItems: orderData.items || [],
        billing: orderData.billing, storeName, actionLink: actionLink || 'https://likeson.in/dashboard', headerNote,
      });
    } else {
      html = transactionalTemplate({
        header: 'LIKESON HEALTHCARE', title: emailSubject || title,
        body: payload.emailBody || body, buttonText: 'View Details',
        buttonLink: actionLink || 'https://likeson.in/dashboard', userName: user.name,
      });
    }
    await sendEmail({ email: user.email, subject: `[Likeson Healthcare] ${emailSubject || title}`, html });
  } catch (err) {
    logError('NOTIFICATION_DISPATCH', err, { userId });
  }
};

const dispatchStatusUpdateEmail = async (order, newStatus, storeName = null) => {
  try {
    const user = await User.findById(order.customer).select('email name').lean();
    if (!user?.email) return;
    const html = buildStatusUpdateEmail({
      userName: user.name, order, orderItems: order.items || [], billing: order.billing,
      storeName, actionLink: `https://likeson.in/pharmacy/orders/${order._id}`, newStatus,
    });
    await sendEmail({ email: user.email, subject: `[Likeson Healthcare] Order #${order.orderId} — Status Updated`, html });
    await Notification.create({
      recipient: order.customer, title: 'Order Status Updated',
      body: `Your order #${order.orderId} is now: ${newStatus}`,
      type: 'Order_Update', priority: 'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id },
    });
  } catch (err) {
    logError('STATUS_UPDATE_EMAIL', err, { orderId: order.orderId });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § ORDER CONFIRMATION EMAIL WITH MEDICINE IMAGES
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchOrderConfirmationEmail = async (userId, order, storeName, headerNote = '') => {
  try {
    const user = await User.findById(userId).select('email name').lean();
    if (!user?.email) return;

    const enrichedItems = await Promise.all(
      (order.items || []).map(async (item) => {
        if (item.medicineImage) return item;
        try {
          const med = await Medicine.findById(item.medicine).select('images brandName genericName').lean();
          return { ...item, medicineImage: med?.images?.[0]?.url || null };
        } catch { return item; }
      })
    );

    const html = buildOrderEmailHtml({
      userName:    user.name,
      order,
      orderItems:  enrichedItems,
      billing:     order.billing,
      storeName,
      actionLink:  `https://likeson.in/pharmacy/orders/${order._id}`,
      headerNote,
      statusLabel: 'Order Placed Successfully!',
      statusIcon:  '✅',
      statusColor: '#15803d',
      statusBg:    '#f0fdf4',
      statusBorder:'#bbf7d0',
    });

    await sendEmail({
      email:   user.email,
      subject: `[Likeson Healthcare] Order Confirmed — #${order.orderId}`,
      html,
    });

    await Notification.create({
      recipient:  userId,
      title:      'Order Placed Successfully',
      body:       `Your order #${order.orderId} has been confirmed. Check your email for details.`,
      type:       'Order_Placed',
      priority:   'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id },
    });
  } catch (err) {
    logError('ORDER_CONFIRMATION_EMAIL', err, { userId, orderId: order?.orderId });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § IMAGEKIT UPLOAD HELPER
// ═══════════════════════════════════════════════════════════════════════════════

const uploadToImageKit = async (buffer, fileName, folder = '/prescriptions') => {
  const timestamp  = Date.now();
  const safeName   = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${timestamp}_${safeName}`;
  const response   = await imagekit.upload({
    file: buffer.toString('base64'), fileName: uniqueName,
    folder, useUniqueFileName: true, tags: ['prescription', 'pharmacy'],
  });
  return response.url;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const toObjectId = (value, label = 'id') => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (value && typeof value === 'object' && value._id) {
    const inner = value._id;
    if (mongoose.Types.ObjectId.isValid(inner)) return new mongoose.Types.ObjectId(inner.toString());
  }
  if (value && typeof value === 'object' && value.$oid)
    return new mongoose.Types.ObjectId(value.$oid);
  const str = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (mongoose.Types.ObjectId.isValid(str)) return new mongoose.Types.ObjectId(str);
  throw new Error(`Invalid ${label}: "${str}" is not a valid ObjectId.`);
};

const extractStoreId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id)  return value._id.toString();
  if (typeof value === 'object' && value.$oid)  return value.$oid.toString();
  return value.toString();
};

const validatePhoneNumber = (phone) => /^[0-9]{10}$/.test(phone.replace(/[^\d]/g, ''));
const validatePincode     = (pincode) => /^[0-9]{6}$/.test(pincode);

const validateDeliveryAddress = (address) => {
  const required = ['fullName', 'line1', 'pincode', 'phone'];
  const missing  = required.filter((f) => !address[f]);
  if (missing.length) throw new Error(`Missing required address fields: ${missing.join(', ')}`);
  if (!validatePhoneNumber(address.phone)) throw new Error('Invalid phone number format');
  if (!validatePincode(address.pincode))   throw new Error('Invalid pincode format');
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HAVERSINE DISTANCE
// ═══════════════════════════════════════════════════════════════════════════════

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDistanceKm = (store, customerCoords) => {
  const sc = store.address?.coordinates;
  if (!sc || sc.lat == null || sc.lng == null) return null;
  if (
    !Array.isArray(customerCoords) ||
    customerCoords.length < 2 ||
    (customerCoords[0] === 0 && customerCoords[1] === 0)
  ) return null;
  return haversineKm(customerCoords, [sc.lng, sc.lat]);
};

// ═══════════════════════════════════════════════════════════════════════════════
// § DELIVERY CHARGE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────
// Priority:
//   1. Express delivery → platform config expressDeliveryCharge always applies
//      (no free-delivery waiver for express)
//   2. Customer has active sub plan → check plan.pharmacy.deliveryChargePerOrder
//      null/0 = free delivery for sub customer regardless of order value
//   3. No sub plan or plan has delivery charge → check freeDeliveryMinOrderValue
//      orderTotal >= threshold → free; else deliveryAgentPayout charged to customer
// ═══════════════════════════════════════════════════════════════════════════════

const resolveDeliveryCharge = async ({
  userId,
  orderTotal,
  deliveryType = 'Standard', // 'Standard' | 'Express'
  platformConfig,
  subPlan = null,             // populated SubscriptionPlan doc or null
}) => {
  const pharmacy = platformConfig?.pharmacy ?? {};

  // Express: always charge platform express fee
  if (deliveryType === 'Express') {
    return {
      charge:    pharmacy.expressDeliveryCharge ?? 49,
      isFree:    false,
      reason:    'express_delivery',
    };
  }

  // Standard: check sub plan benefit first
  if (subPlan) {
    const planDelivery = subPlan.pharmacy?.deliveryChargePerOrder;
    // null or 0 = free delivery as plan benefit
    if (planDelivery == null || planDelivery === 0) {
      return {
        charge: 0,
        isFree: true,
        reason: 'subscription_free_delivery',
      };
    }
    // Plan specifies a delivery charge (e.g. Basic Care = ₹10)
    return {
      charge: planDelivery,
      isFree: false,
      reason: 'subscription_plan_charge',
    };
  }

  // No sub plan: check free-delivery minimum order threshold
  const freeMin = pharmacy.freeDeliveryMinOrderValue ?? 200;
  if (orderTotal >= freeMin) {
    return {
      charge: 0,
      isFree: true,
      reason: 'free_above_minimum',
    };
  }

  // Below threshold: customer pays agent payout
  return {
    charge: pharmacy.deliveryAgentPayout ?? 30,
    isFree: false,
    reason: 'below_min_order',
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SUBSCRIPTION DISCOUNT RESOLVER
// Returns { pharmacyDiscountPct, planDoc } for a user
// ═══════════════════════════════════════════════════════════════════════════════

const resolveSubscriptionBenefits = async (userId) => {
  if (!userId) return { pharmacyDiscountPct: 0, planDoc: null, subDoc: null };
  try {
    const sub = await UserSubscription.findOne({
      user:   userId,
      status: { $in: ['Active', 'Trial'] },
    })
      .populate('plan', 'pharmacy consultations transport diagnostics careAssistant')
      .select('limits plan status')
      .lean();

    if (!sub) return { pharmacyDiscountPct: 0, planDoc: null, subDoc: null };

    return {
      pharmacyDiscountPct: sub.limits?.pharmacyDiscountPercent ?? 0,
      planDoc:             sub.plan ?? null,
      subDoc:              sub,
    };
  } catch {
    return { pharmacyDiscountPct: 0, planDoc: null, subDoc: null };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § COUPON HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const validateAndApplyCoupon = async (code, userId, orderTotal, session = null) => {
  if (!code || typeof code !== 'string') throw new Error('Coupon code is required.');
  const query = PromotionCoupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (session) query.session(session);
  const coupon = await query.lean();
  if (!coupon) throw new Error(`Coupon "${code}" is invalid or deactivated.`);
  const now = new Date();
  if (coupon.validity?.from && now < coupon.validity.from) throw new Error(`Coupon "${code}" is not yet active.`);
  if (coupon.validity?.to   && now > coupon.validity.to)   throw new Error(`Coupon "${code}" has expired.`);
  if (coupon.usage?.totalPlatformLimit != null && coupon.usage.currentUses >= coupon.usage.totalPlatformLimit)
    throw new Error(`Coupon "${code}" has reached its usage limit.`);
  const userUseCount = await PharmacyOrder.countDocuments({
    customer: userId, 'billing.promoCode': code.toUpperCase(), 'payment.status': { $in: ['Paid', 'Pending'] },
  }).session(session);
  if (userUseCount >= (coupon.usage?.limitPerUser ?? 1))
    throw new Error(`You have already used coupon "${code}" the maximum number of times.`);
  if (coupon.eligibility?.minOrderValue && orderTotal < coupon.eligibility.minOrderValue)
    throw new Error(`Minimum order value ₹${coupon.eligibility.minOrderValue} required.`);
  if (coupon.eligibility?.type === 'New_User_Only') {
    const any = await PharmacyOrder.exists({ customer: userId }).session(session);
    if (any) throw new Error(`Coupon "${code}" is only for new users.`);
  }
  if (coupon.eligibility?.type === 'First_Booking') {
    const prior = await PharmacyOrder.exists({ customer: userId, 'payment.status': 'Paid' }).session(session);
    if (prior) throw new Error(`Coupon "${code}" is only valid on your first order.`);
  }
  let discountAmount = 0;
  if (coupon.benefit?.type === 'Percentage') {
    discountAmount = parseFloat(((orderTotal * coupon.benefit.value) / 100).toFixed(2));
    if (coupon.benefit?.maxCap) discountAmount = Math.min(discountAmount, coupon.benefit.maxCap);
  } else if (coupon.benefit?.type === 'Flat_Amount') {
    discountAmount = Math.min(coupon.benefit.value, orderTotal);
  }
  return { coupon, discountAmount: parseFloat(discountAmount.toFixed(2)) };
};

const commitCouponUsage = async (couponId, session = null) => {
  const q = PromotionCoupon.findByIdAndUpdate(couponId, { $inc: { 'usage.currentUses': 1 } }, { new: true });
  if (session) q.session(session);
  return await q;
};

// ── Prescription helpers ──────────────────────────────────────────────────────

const cartHasPrescriptionItems = (items) =>
  items.some((i) => i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true);

const getMissingPrescriptionItems = (items) =>
  items.filter(
    (i) =>
      (i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true) &&
      !i.prescription?.imageUrl,
  );

const buildOrderPrescription = (cartItems) => {
  const requiresRx = cartItems.some(
    (i) => i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true,
  );
  if (!requiresRx) return { isRequired: false };
  const rxItem = cartItems.find(
    (i) =>
      (i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true) &&
      i.prescription?.imageUrl,
  );
  return {
    isRequired: true, imageUrl: rxItem?.prescription?.imageUrl ?? null,
    uploadedAt: rxItem?.prescription?.uploadedAt ?? null, isVerified: false,
    verificationStatus: rxItem?.prescription?.imageUrl ? 'Pending' : 'Not_Uploaded',
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § STORE SCORING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// Composite score for store selection priority.
// Lower score = better (rank ascending).
//
// Weights (tunable):
//   1. Price:            40% — normalised unit price vs cheapest available
//   2. Distance:         25% — normalised km vs furthest candidate
//   3. Stock:            15% — inverse of stock availability ratio
//   4. Delivery SLA:     10% — standardEtaMinutes normalised
//   5. Store Rating:      7% — inverse of avgRating (higher rating = lower penalty)
//   6. Partner Priority:  3% — Owned > Partnered; admin priorityScore bonus
//
// Returns 0–100 (lower = preferred). Falls back gracefully when data missing.
// ═══════════════════════════════════════════════════════════════════════════════

const scoreStore = ({
  pricePerUnit,
  minPriceAcrossStores,
  maxPriceAcrossStores,
  distanceKm,
  maxDistanceKm,
  stockQuantity,
  maxStockAcrossStores,
  etaMinutes,
  maxEtaAcrossStores,
  avgRating,
  storeType,
  priorityScore,
}) => {
  // ── 1. Price score (40) ───────────────────────────────────────────────────
  let priceScore = 0;
  if (maxPriceAcrossStores > minPriceAcrossStores) {
    priceScore = ((pricePerUnit - minPriceAcrossStores) / (maxPriceAcrossStores - minPriceAcrossStores)) * 40;
  }

  // ── 2. Distance score (25) ────────────────────────────────────────────────
  let distScore = 12.5; // neutral if no coords
  if (distanceKm !== null && maxDistanceKm > 0) {
    distScore = (distanceKm / maxDistanceKm) * 25;
  }

  // ── 3. Stock score (15) ───────────────────────────────────────────────────
  let stockScore = 15; // penalise max if no stock info
  if (maxStockAcrossStores > 0) {
    stockScore = (1 - (stockQuantity / maxStockAcrossStores)) * 15;
  }

  // ── 4. SLA score (10) ─────────────────────────────────────────────────────
  let slaScore = 5; // neutral
  if (etaMinutes != null && maxEtaAcrossStores > 0) {
    slaScore = (etaMinutes / maxEtaAcrossStores) * 10;
  }

  // ── 5. Rating score (7) ───────────────────────────────────────────────────
  // avgRating 0–5; higher rating should REDUCE score penalty
  const ratingPenalty = avgRating > 0 ? (1 - avgRating / 5) * 7 : 3.5;

  // ── 6. Partner priority score (3) ────────────────────────────────────────
  // Owned stores preferred; higher platformPriorityScore = lower penalty
  let partnerScore = storeType === 'Owned' ? 0 : 1.5;
  if (priorityScore != null) {
    partnerScore += (1 - priorityScore / 100) * 1.5;
  }

  const total = priceScore + distScore + stockScore + slaScore + ratingPenalty + partnerScore;
  return parseFloat(total.toFixed(4));
};

// ═══════════════════════════════════════════════════════════════════════════════
// § MULTI-STORE CART FULFILMENT  (REWRITTEN WITH SCORING + DELIVERY TYPE)
// ═══════════════════════════════════════════════════════════════════════════════

const resolveMultiStoreForCart = async (cartItems, customerUser) => {
  const now            = new Date();
  const customerCoords = customerUser?.location?.coordinates; // [lng, lat]

  // ── Step 1: fetch all medicine documents ──────────────────────────────────
  const medicineIds = cartItems.map((item) =>
    (item.medicine?._id ?? item.medicine).toString()
  );

  // Use MedicineInventory collection for accurate per-store pricing/stock
  const inventoryRecords = await MedicineInventory.find({
    medicineId: { $in: medicineIds.map((id) => toObjectId(id)) },
    isActive:   true,
    isDeleted:  false,
  }).lean();

  // Build: medicineId → [inventoryRecord]
  const invByMed = new Map();
  for (const inv of inventoryRecords) {
    const mid = inv.medicineId.toString();
    if (!invByMed.has(mid)) invByMed.set(mid, []);
    invByMed.get(mid).push(inv);
  }

  // ── Step 2: collect all candidate store IDs ───────────────────────────────
  const allStoreIds = new Set();
  for (const invList of invByMed.values()) {
    for (const inv of invList) {
      if (inv.availableStock > 0) allStoreIds.add(inv.storeId.toString());
    }
  }

  if (!allStoreIds.size) {
    return { groups: [], unavailableItems: cartItems.map((i) => ({
      medicineId: (i.medicine?._id ?? i.medicine).toString(),
      name: i.medicine?.brandName ?? 'Medicine',
      reason: 'Out of stock everywhere',
    })) };
  }

  // ── Step 3: fetch open + verified stores ─────────────────────────────────
  const openStores = await PharmacyStore.find({
    _id:        { $in: Array.from(allStoreIds) },
    status:     'Open',
    isVerified: true,
    isDeleted:  false,
    'operationalCapacity.isAcceptingOrders': true,
  }).lean();

  const storeMap = new Map(openStores.map((s) => [s._id.toString(), s]));

  // ── Step 4: compute distances ─────────────────────────────────────────────
  const storeDistances = new Map();
  for (const store of openStores) {
    storeDistances.set(store._id.toString(), getDistanceKm(store, customerCoords));
  }

  // ── Step 5: for each cart item, score all eligible stores and pick best ───
  const reservedQty      = new Map(); // `${medId}:${storeId}` → qty reserved
  const storeGroups      = new Map(); // storeId → { storeDoc, items[] }
  const unavailableItems = [];

  const medicines = await Medicine.find({ _id: { $in: medicineIds.map((id) => toObjectId(id)) } }).lean();
  const medMap    = new Map(medicines.map((m) => [m._id.toString(), m]));

  for (const cartItem of cartItems) {
    const medId    = (cartItem.medicine?._id ?? cartItem.medicine).toString();
    const medicine = medMap.get(medId);
    const qty      = parseInt(cartItem.quantity, 10);
    const name     = medicine?.brandName ?? medicine?.genericName ?? 'Medicine';

    if (!qty || isNaN(qty) || qty <= 0) {
      unavailableItems.push({ medicineId: medId, name, reason: `Invalid quantity: ${cartItem.quantity}` });
      continue;
    }
    if (!medicine || medicine.isDiscontinued) {
      unavailableItems.push({ medicineId: medId, name, reason: 'discontinued' });
      continue;
    }

    const eligibleInvs = (invByMed.get(medId) || []).filter((inv) => {
      const storeIdStr   = inv.storeId.toString();
      const reserveKey   = `${medId}:${storeIdStr}`;
      const alreadyUsed  = reservedQty.get(reserveKey) ?? 0;
      return (
        storeMap.has(storeIdStr) &&
        inv.availableStock - alreadyUsed >= qty
      );
    });

    if (!eligibleInvs.length) {
      const totalAvail = (invByMed.get(medId) || []).reduce((s, i) => s + (i.availableStock || 0), 0);
      unavailableItems.push({
        medicineId: medId,
        name,
        reason: totalAvail === 0 ? 'Out of stock at all stores' : `Insufficient stock (need ${qty})`,
      });
      continue;
    }

    // ── Scoring context ────────────────────────────────────────────────────
    const prices      = eligibleInvs.map((i) => i.finalPrice ?? i.sellingPrice ?? 0);
    const minPrice    = Math.min(...prices);
    const maxPrice    = Math.max(...prices);
    const stocks      = eligibleInvs.map((i) => i.availableStock ?? 0);
    const maxStock    = Math.max(...stocks);
    const distances   = eligibleInvs.map((i) => storeDistances.get(i.storeId.toString()) ?? null).filter(Boolean);
    const maxDist     = distances.length ? Math.max(...distances) : 0;
    const etas        = eligibleInvs.map((i) => {
      const s = storeMap.get(i.storeId.toString());
      return s?.deliverySettings?.standardEtaMinutes ?? 120;
    });
    const maxEta      = Math.max(...etas, 1);

    // Prefer store already used in this cart (consolidation) — heavy bonus
    const scoredCandidates = eligibleInvs.map((inv) => {
      const storeIdStr  = inv.storeId.toString();
      const store       = storeMap.get(storeIdStr);
      const distKm      = storeDistances.get(storeIdStr) ?? null;
      const etaMin      = store?.deliverySettings?.standardEtaMinutes ?? 120;
      const alreadyUsed = storeGroups.has(storeIdStr);

      const baseScore = scoreStore({
        pricePerUnit:            inv.finalPrice ?? inv.sellingPrice ?? 0,
        minPriceAcrossStores:    minPrice,
        maxPriceAcrossStores:    maxPrice,
        distanceKm:              distKm,
        maxDistanceKm:           maxDist,
        stockQuantity:           inv.availableStock ?? 0,
        maxStockAcrossStores:    maxStock,
        etaMinutes:              etaMin,
        maxEtaAcrossStores:      maxEta,
        avgRating:               store?.performanceMetrics?.avgRating ?? 0,
        storeType:               store?.storeType ?? 'Partnered',
        priorityScore:           store?.priorityScore ?? 50,
      });

      // Consolidation bonus: -10 to prefer same store
      const consolidationBonus = alreadyUsed ? -10 : 0;

      return { inv, storeIdStr, score: baseScore + consolidationBonus, distKm };
    });

    scoredCandidates.sort((a, b) => a.score - b.score);
    const best = scoredCandidates[0];

    // Reserve qty
    const reserveKey = `${medId}:${best.storeIdStr}`;
    reservedQty.set(reserveKey, (reservedQty.get(reserveKey) ?? 0) + qty);

    if (!storeGroups.has(best.storeIdStr)) {
      storeGroups.set(best.storeIdStr, {
        storeDoc: storeMap.get(best.storeIdStr),
        items:    [],
      });
    }

    storeGroups.get(best.storeIdStr).items.push({
      medicine,
      quantity:               qty,
      pricePerUnit:           best.inv.finalPrice ?? best.inv.sellingPrice ?? medicine.mrp,
      gstPercentage:          cartItem.gstPercentage ?? medicine.gstPercentage ?? 5,
      isPrescriptionRequired: cartItem.isPrescriptionRequired ?? medicine.isPrescriptionRequired ?? false,
      prescription:           cartItem.prescription ?? null,
      _resolvedInv:           best.inv,
      _distanceKm:            best.distKm,
      _score:                 best.score,
    });
  }

  return {
    groups:           Array.from(storeGroups.values()),
    unavailableItems,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SINGLE-MEDICINE STORE RESOLUTION  (uses MedicineInventory + scoring)
// ═══════════════════════════════════════════════════════════════════════════════

const resolveStoreForMedicine = async (medicineId, requiredQty, customerUser, preferredStoreId = null) => {
  const medicine = await Medicine.findById(medicineId).lean();
  if (!medicine)               throw new Error('Medicine not found.');
  if (medicine.isDiscontinued) throw new Error(`"${medicine.brandName}" is discontinued.`);

  const invRecords = await MedicineInventory.find({
    medicineId: toObjectId(medicineId),
    isActive:   true,
    isDeleted:  false,
    availableStock: { $gte: requiredQty },
  }).lean();

  if (!invRecords.length) {
    const allInv = await MedicineInventory.find({
      medicineId: toObjectId(medicineId),
      isActive:   true,
      isDeleted:  false,
    }).lean();
    const totalAvailable = allInv.reduce((s, i) => s + (i.availableStock || 0), 0);
    if (totalAvailable === 0)
      throw new Error(`"${medicine.brandName}" is out of stock across all stores.`);
    const maxAvailable = Math.max(...allInv.map((i) => i.availableStock || 0));
    throw new Error(
      `"${medicine.brandName}" insufficient stock (requested: ${requiredQty}, max at any store: ${maxAvailable}).`
    );
  }

  const storeIds  = invRecords.map((i) => i.storeId);
  const stores    = await PharmacyStore.find({
    _id:        { $in: storeIds },
    status:     'Open',
    isVerified: true,
    isDeleted:  false,
    'operationalCapacity.isAcceptingOrders': true,
  }).lean();

  if (!stores.length)
    throw new Error(`"${medicine.brandName}" — all stocking stores are closed or unverified.`);

  const storeMap       = new Map(stores.map((s) => [s._id.toString(), s]));
  const customerCoords = customerUser?.location?.coordinates;

  const prices   = invRecords.map((i) => i.finalPrice ?? i.sellingPrice ?? 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const stocks   = invRecords.map((i) => i.availableStock ?? 0);
  const maxStock = Math.max(...stocks);
  const distances = invRecords.map((i) => {
    const s = storeMap.get(i.storeId.toString());
    return s ? getDistanceKm(s, customerCoords) : null;
  }).filter(Boolean);
  const maxDist = distances.length ? Math.max(...distances) : 0;
  const etas    = invRecords.map((i) => {
    const s = storeMap.get(i.storeId.toString());
    return s?.deliverySettings?.standardEtaMinutes ?? 120;
  });
  const maxEta = Math.max(...etas, 1);

  let candidates = invRecords
    .filter((inv) => storeMap.has(inv.storeId.toString()))
    .map((inv) => {
      const store    = storeMap.get(inv.storeId.toString());
      const distKm   = getDistanceKm(store, customerCoords);
      const etaMin   = store?.deliverySettings?.standardEtaMinutes ?? 120;
      const score    = scoreStore({
        pricePerUnit:            inv.finalPrice ?? inv.sellingPrice ?? 0,
        minPriceAcrossStores:    minPrice,
        maxPriceAcrossStores:    maxPrice,
        distanceKm:              distKm,
        maxDistanceKm:           maxDist,
        stockQuantity:           inv.availableStock ?? 0,
        maxStockAcrossStores:    maxStock,
        etaMinutes:              etaMin,
        maxEtaAcrossStores:      maxEta,
        avgRating:               store?.performanceMetrics?.avgRating ?? 0,
        storeType:               store?.storeType ?? 'Partnered',
        priorityScore:           store?.priorityScore ?? 50,
      });
      return { store, inventoryEntry: inv, distanceKm: distKm, score };
    });

  candidates.sort((a, b) => a.score - b.score);

  // Honour explicit preferred store if it has sufficient stock
  if (preferredStoreId) {
    const prefObjId = toObjectId(preferredStoreId, 'preferredStoreId');
    const prefCand  = candidates.find((c) => c.store._id.equals(prefObjId));
    if (prefCand) {
      return {
        store:          prefCand.store,
        inventoryEntry: prefCand.inventoryEntry,
        medicine,
        distanceKm:     prefCand.distanceKm,
      };
    }
  }

  const best = candidates[0];
  return {
    store:          best.store,
    inventoryEntry: best.inventoryEntry,
    medicine,
    distanceKm:     best.distanceKm,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § STOCK HELPERS  (now use MedicineInventory, not embedded inventory)
// ═══════════════════════════════════════════════════════════════════════════════

const decrementStock = async (items, storeId, session) => {
  const storeObjId = toObjectId(storeId, 'storeId');

  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!qty || isNaN(qty) || qty <= 0)
      throw new Error(`Invalid quantity for "${item.name ?? item.medicine}": ${item.quantity}.`);

    const updated = await MedicineInventory.findOneAndUpdate(
      {
        medicineId:     toObjectId(item.medicine, 'medicine'),
        storeId:        storeObjId,
        isActive:       true,
        isDeleted:      false,
        availableStock: { $gte: qty },
      },
      {
        $inc: {
          stockQuantity:  -qty,
          availableStock: -qty,
        },
      },
      { new: true, session }
    );

    if (!updated) {
      const inv = await MedicineInventory.findOne({
        medicineId: toObjectId(item.medicine, 'medicine'),
        storeId:    storeObjId,
        isActive:   true,
        isDeleted:  false,
      }).session(session);

      const available = inv?.availableStock ?? 0;
      if (available === 0) {
        throw new Error(`"${item.name}" is not stocked at the selected store.`);
      }
      throw new Error(
        `Concurrent stock conflict for "${item.name}". Available: ${available}, requested: ${qty}. Please retry.`
      );
    }

    // Log inventory movement
    try {
      await InventoryMovement.create([{
        storeId:         storeObjId,
        medicineId:      toObjectId(item.medicine, 'medicine'),
        batchId:         updated.batchId ?? new mongoose.Types.ObjectId(), // fallback if no batch linked
        movementType:    'Sale',
        quantityChanged: qty,
        previousStock:   updated.stockQuantity + qty,
        newStock:        updated.stockQuantity,
        referenceModel:  'PharmacyOrder',
        reason:          'Order fulfilment',
      }], { session });
    } catch (e) {
      // Movement log failure is non-fatal; order must not fail because of it
      logError('INVENTORY_MOVEMENT_LOG', e, { medicineId: item.medicine, storeId });
    }

    // Flag low-stock
    if (updated.availableStock <= (updated.reorderLevel ?? 10)) {
      await MedicineInventory.findByIdAndUpdate(
        updated._id,
        { $set: { isLowStock: true, isOutOfStock: updated.availableStock <= 0 } },
        { session }
      );
    }
  }
};

const incrementStock = async (items, storeId, session) => {
  const storeObjId = toObjectId(storeId, 'storeId');
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    const updated = await MedicineInventory.findOneAndUpdate(
      { medicineId: toObjectId(item.medicine, 'medicine'), storeId: storeObjId, isDeleted: false },
      {
        $inc: {
          stockQuantity:  qty,
          availableStock: qty,
        },
        $set: { isOutOfStock: false },
      },
      { new: true, session }
    );
    if (updated && updated.availableStock > (updated.reorderLevel ?? 10)) {
      await MedicineInventory.findByIdAndUpdate(
        updated._id,
        { $set: { isLowStock: false } },
        { session }
      );
    }

    // Movement log
    try {
      await InventoryMovement.create([{
        storeId:         storeObjId,
        medicineId:      toObjectId(item.medicine, 'medicine'),
        batchId:         updated?.batchId ?? new mongoose.Types.ObjectId(),
        movementType:    'Return',
        quantityChanged: qty,
        previousStock:   (updated?.stockQuantity ?? qty) - qty,
        newStock:        updated?.stockQuantity ?? qty,
        referenceModel:  'PharmacyOrder',
        reason:          'Order cancellation stock release',
      }], { session });
    } catch (e) {
      logError('INVENTORY_MOVEMENT_LOG_RETURN', e, { medicineId: item.medicine, storeId });
    }
  }
};

const clearCart = async (userId, session = null) => {
  const q = Cart.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        items:       [],
        store:       null,
        billSummary: { itemsTotal: 0, estimatedTax: 0, totalAmount: 0 },
      },
    },
    { new: true }
  );
  if (session) q.session(session);
  return await q;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § BILLING BUILDER
// ─────────────────────────────────────────────────────────────────────────────
// Centralised function to compute final billing for any order group.
// Handles: subscription discount → coupon discount → delivery → platform fee
//
// Returns billing object ready to store in PharmacyOrder.billing
// ═══════════════════════════════════════════════════════════════════════════════

const buildBilling = async ({
  orderItems,
  userId,
  deliveryType,         // 'Standard' | 'Express'
  platformConfig,
  subPlanDoc,           // SubscriptionPlan lean doc or null
  couponCode,           // string or null
  subscriptionDiscountPct,
  session,
}) => {
  const subTotal = parseFloat(orderItems.reduce((s, i) => s + i.totalPrice, 0).toFixed(2));

  // ── 1. Subscription discount ──────────────────────────────────────────────
  const subDiscAmt = parseFloat(((subTotal * subscriptionDiscountPct) / 100).toFixed(2));
  const afterSubDisc = parseFloat(Math.max(0, subTotal - subDiscAmt).toFixed(2));

  // ── 2. Coupon discount ────────────────────────────────────────────────────
  let couponDiscountAmt = 0;
  let appliedCoupon     = null;
  if (couponCode) {
    const r = await validateAndApplyCoupon(couponCode, userId, afterSubDisc, session);
    couponDiscountAmt = r.discountAmount;
    appliedCoupon     = r.coupon;
  }

  const totalDiscountAmount = parseFloat((subDiscAmt + couponDiscountAmt).toFixed(2));
  const afterAllDiscounts   = parseFloat(Math.max(0, subTotal - totalDiscountAmount).toFixed(2));

  // ── 3. Delivery charge ────────────────────────────────────────────────────
  const deliveryResult = await resolveDeliveryCharge({
    userId,
    orderTotal: afterAllDiscounts,
    deliveryType,
    platformConfig,
    subPlan: subPlanDoc,
  });
  const deliveryCharges = deliveryResult.charge;

  // ── 4. Platform fee ────────────────────────────────────────────────────────
  const platformFee = PLATFORM_FEE_FLAT; // ₹5 flat per order

  // ── 5. GST on paid amount (post-discount, pre-delivery) ────────────────────
  let gstAmount = 0;
  const discountFactor = subTotal > 0 ? afterAllDiscounts / subTotal : 0;
  orderItems.forEach((item) => {
    const itemPaidShare  = item.totalPrice * discountFactor;
    item.taxAmount       = parseFloat((itemPaidShare * item.gstPercentage / (100 + item.gstPercentage)).toFixed(2));
    gstAmount           += item.taxAmount;
  });
  gstAmount = parseFloat(gstAmount.toFixed(2));

  // ── 6. Grand total ─────────────────────────────────────────────────────────
  const totalPayable = parseFloat(
    (afterAllDiscounts + deliveryCharges + platformFee).toFixed(2)
  );

  return {
    billing: {
      subTotal,
      gstAmount,
      deliveryCharges,
      platformFee,
      discountAmount:   totalDiscountAmount,
      walletAmountUsed: 0, // set at payment time
      promoCode:        appliedCoupon?.code ?? undefined,
      totalPayable,
    },
    appliedCoupon,
    couponDiscountAmt,
    deliveryResult,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § ROUTES — CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 0. POST /api/pharmacy/upload/prescription
// ─────────────────────────────────────────────────────────────────────────────


// POST '/upload/prescription'
export const postUploadPrescription = asyncHandler(async (req, res) => {
    let imageUrl;

    if (req.file) {
      try {
        imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/prescriptions');
      } catch (err) {
        logError('IMAGEKIT_UPLOAD', err, { userId: req.user._id });
        return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
      }
      return res.status(200).json({
        success: true, message: 'Prescription uploaded successfully.',
        imageUrl, fileName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype,
      });
    }

    const { base64, fileName = 'prescription.jpg' } = req.body;
    if (base64) {
      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      try {
        const response = await imagekit.upload({
          file: cleanBase64,
          fileName: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
          folder: '/prescriptions', useUniqueFileName: true, tags: ['prescription', 'pharmacy'],
        });
        imageUrl = response.url;
      } catch (err) {
        logError('IMAGEKIT_BASE64_UPLOAD', err, { userId: req.user._id });
        return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
      }
      return res.status(200).json({ success: true, message: 'Prescription uploaded successfully.', imageUrl });
    }

    return res.status(400).json({ success: false, message: 'No file provided.' });
  });

// GET '/upload/auth'
export const getUploadAuth = asyncHandler(async (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    return res.status(200).json({
      success: true, ...authParams,
      publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate upload authentication.' });
  }
});

// GET '/medicines'
export const getMedicines = asyncHandler(async (req, res) => {
  const { search, category, storeId, page = 1, limit = 12, sort = 'createdAt_desc' } = req.query;

  const filter = { isDiscontinued: false, isApproved: true, isDeleted: false };
  if (search)   filter.$text = { $search: search };
  if (category) filter.category = { $in: category.split(',') };

  const sortMap  = {
    mrp_asc:       { mrp: 1 },
    mrp_desc:      { mrp: -1 },
    createdAt_desc:{ createdAt: -1 },
    name_asc:      { name: 1 },
  };
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  let medicineQuery = Medicine.find(filter)
    .sort(sortMap[sort] || { createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const [medicines, total] = await Promise.all([
    medicineQuery,
    Medicine.countDocuments(filter),
  ]);

  // Enrich with MedicineInventory data per medicine
  const medicineIds = medicines.map((m) => m._id);
  const invRecords  = await MedicineInventory.find({
    medicineId: { $in: medicineIds },
    isActive:   true,
    isDeleted:  false,
    availableStock: { $gt: 0 },
  })
    .populate('storeId', 'storeName address status deliverySettings performanceMetrics storeType priorityScore')
    .lean();

  // Attach inventory summary to each medicine
  const invByMed = new Map();
  for (const inv of invRecords) {
    const mid = inv.medicineId.toString();
    if (!invByMed.has(mid)) invByMed.set(mid, []);
    invByMed.get(mid).push(inv);
  }

  // If storeId filter requested, filter further
  const enriched = medicines.map((med) => {
    let invs = invByMed.get(med._id.toString()) || [];
    if (storeId) invs = invs.filter((i) => i.storeId?._id?.toString() === storeId);
    const cheapest = invs.length
      ? invs.reduce((min, i) => (i.finalPrice < min.finalPrice ? i : min), invs[0])
      : null;
    return {
      ...med,
      lowestPrice:       cheapest?.finalPrice ?? null,
      isAvailable:       invs.length > 0,
      storeCount:        invs.length,
      storeOptions:      invs.slice(0, 5).map((i) => ({
        storeId:       i.storeId?._id,
        storeName:     i.storeId?.storeName,
        price:         i.finalPrice,
        discountPct:   i.discountPercent,
        availableStock:i.availableStock,
        etaMinutes:    i.storeId?.deliverySettings?.standardEtaMinutes,
        rating:        i.storeId?.performanceMetrics?.avgRating,
      })),
    };
  });

  res.status(200).json({
    success: true,
    pagination: { total, pages: Math.ceil(total / limitNum), page: pageNum, limit: limitNum },
    medicines: enriched,
  });
});

// GET '/medicines/:id/stores'
export const getMedicinesByIdStores = asyncHandler(async (req, res) => {
  const { id }           = req.params;
  const qty              = Math.max(1, parseInt(req.query.qty, 10) || 1);
  const deliveryType     = req.query.deliveryType === 'Express' ? 'Express' : 'Standard';
  const userId           = await getOptionalUserId(req);
  const customerUser     = userId ? await User.findById(userId).select('location').lean() : null;
  const customerCoords   = customerUser?.location?.coordinates;

  const medicine = await Medicine.findById(id).select('brandName genericName isDiscontinued').lean();
  if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
  if (medicine.isDiscontinued)
    return res.status(400).json({ success: false, message: `"${medicine.brandName}" is discontinued.` });

  const invRecords = await MedicineInventory.find({
    medicineId:     toObjectId(id),
    isActive:       true,
    isDeleted:      false,
    availableStock: { $gte: qty },
  }).lean();

  if (!invRecords.length)
    return res.status(200).json({ success: true, stores: [], message: 'No stock available.' });

  const storeIds = invRecords.map((i) => i.storeId);
  const stores   = await PharmacyStore.find({
    _id:        { $in: storeIds },
    status:     'Open',
    isVerified: true,
    isDeleted:  false,
  }).lean();
  const storeMap = new Map(stores.map((s) => [s._id.toString(), s]));

  // Load platform config for delivery charge preview
  const platformConfig = await PlatformPricingConfig.getGlobal();

  // Load user subscription if logged in
  const { planDoc: subPlanDoc } = userId
    ? await resolveSubscriptionBenefits(userId)
    : { planDoc: null };

  const prices   = invRecords.map((i) => i.finalPrice ?? i.sellingPrice ?? 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const stocks   = invRecords.map((i) => i.availableStock ?? 0);
  const maxStock = Math.max(...stocks);
  const dists    = invRecords
    .map((i) => {
      const s = storeMap.get(i.storeId.toString());
      return s ? getDistanceKm(s, customerCoords) : null;
    })
    .filter(Boolean);
  const maxDist = dists.length ? Math.max(...dists) : 0;
  const etas    = invRecords.map((i) => {
    const s = storeMap.get(i.storeId.toString());
    return s?.deliverySettings?.standardEtaMinutes ?? 120;
  });
  const maxEta = Math.max(...etas, 1);

  const scored = await Promise.all(
    invRecords
      .filter((inv) => storeMap.has(inv.storeId.toString()))
      .map(async (inv) => {
        const store   = storeMap.get(inv.storeId.toString());
        const distKm  = getDistanceKm(store, customerCoords);
        const etaMin  = store?.deliverySettings?.standardEtaMinutes ?? 120;
        const price   = inv.finalPrice ?? inv.sellingPrice ?? 0;
        const score   = scoreStore({
          pricePerUnit:         price,
          minPriceAcrossStores: minPrice,
          maxPriceAcrossStores: maxPrice,
          distanceKm:           distKm,
          maxDistanceKm:        maxDist,
          stockQuantity:        inv.availableStock ?? 0,
          maxStockAcrossStores: maxStock,
          etaMinutes:           etaMin,
          maxEtaAcrossStores:   maxEta,
          avgRating:            store?.performanceMetrics?.avgRating ?? 0,
          storeType:            store?.storeType ?? 'Partnered',
          priorityScore:        store?.priorityScore ?? 50,
        });

        // Delivery charge preview for this store
        const delResult = await resolveDeliveryCharge({
          userId,
          orderTotal: price * qty,
          deliveryType,
          platformConfig,
          subPlan: subPlanDoc,
        });

        return {
          storeId:          store._id,
          storeName:        store.storeName,
          storeType:        store.storeType,
          address:          store.address,
          distanceKm:       distKm ? parseFloat(distKm.toFixed(2)) : null,
          price,
          discountPercent:  inv.discountPercent ?? 0,
          mrp:              inv.mrp,
          availableStock:   inv.availableStock,
          etaMinutes:       etaMin,
          expressAvailable: store.deliverySettings?.expressDelivery ?? false,
          expressEtaMinutes:store.deliverySettings?.expressEtaMinutes ?? 30,
          avgRating:        store.performanceMetrics?.avgRating ?? 0,
          totalReviews:     store.performanceMetrics?.totalReviews ?? 0,
          deliveryCharge:   delResult.charge,
          deliveryFree:     delResult.isFree,
          deliveryReason:   delResult.reason,
          score,
          codAvailable:     store.deliverySettings?.codAvailable ?? true,
          isRecommended:    false, // will be set on first item
        };
      })
  );

  scored.sort((a, b) => a.score - b.score);
  if (scored.length) scored[0].isRecommended = true;

  res.status(200).json({
    success: true,
    medicine: { _id: medicine._id, brandName: medicine.brandName },
    storeCount: scored.length,
    stores:     scored,
    sortCriteria: ['price', 'distance', 'stock', 'eta', 'rating', 'partnerPriority'],
  });
});

// GET '/cart'
export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id })
    .populate('items.medicine', 'brandName genericName images gstPercentage isPrescriptionRequired')
    .populate('store', 'storeName address contact deliverySettings status')
    .lean();

  const result = cart || { items: [], billSummary: { itemsTotal: 0, estimatedTax: 0, totalAmount: 0 } };

  if (result.items?.length) {
    result.prescriptionSummary = {
      hasRxItems:     cartHasPrescriptionItems(result.items),
      missingUploads: getMissingPrescriptionItems(result.items).map((i) => ({
        medicineId: i.medicine?._id || i.medicine,
        name:       i.medicine?.brandName || 'Medicine',
      })),
    };
  }
  res.status(200).json({ success: true, cart: result });
});

// POST '/cart/add'
export const postCartAdd = asyncHandler(async (req, res) => {
  const { medicineId, quantity = 1, prescription } = req.body;
  const preferredStoreId = extractStoreId(req.body.storeId) || null;

  if (!medicineId)
    return res.status(400).json({ success: false, message: 'medicineId is required.' });

  const quantityNum  = Math.max(1, parseInt(quantity, 10));
  const userId       = await getOptionalUserId(req);
  const customerUser = userId ? await User.findById(userId).select('location').lean() : null;

  let resolvedStore, inventoryEntry, medicine;
  try {
    ({ store: resolvedStore, inventoryEntry, medicine } = await resolveStoreForMedicine(
      medicineId, quantityNum, customerUser, preferredStoreId
    ));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const resolvedStoreIdStr = resolvedStore._id.toString();
  const storeOverridden    = preferredStoreId && preferredStoreId !== resolvedStoreIdStr;

  if (!userId) {
    return res.status(200).json({
      success: true, isGuest: true,
      item: {
        medicine:               medicineId,
        quantity:               quantityNum,
        pricePerUnit:           inventoryEntry.finalPrice ?? inventoryEntry.sellingPrice ?? medicine.mrp,
        isPrescriptionRequired: medicine.isPrescriptionRequired ?? false,
      },
      ...(storeOverridden && { notice: `Sourced from "${resolvedStore.storeName}" (preferred store had insufficient stock).` }),
    });
  }

  let cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const pricePerUnit = inventoryEntry.finalPrice ?? inventoryEntry.sellingPrice ?? medicine.mrp;
  const prescriptionData = {
    isRequired: medicine.isPrescriptionRequired ?? false,
    imageUrl:   prescription?.imageUrl || null,
    uploadedAt: prescription?.imageUrl ? new Date() : null,
  };

  const itemIdx = cart.items.findIndex(
    (i) => i.medicine.toString() === medicineId.toString()
  );

  if (itemIdx > -1) {
    const newQty = cart.items[itemIdx].quantity + quantityNum;
    if (newQty > inventoryEntry.availableStock) {
      return res.status(400).json({
        success: false,
        message: `Total quantity (${newQty}) exceeds available stock (${inventoryEntry.availableStock}).`,
        availableStock: inventoryEntry.availableStock,
      });
    }
    cart.items[itemIdx].quantity = newQty;
    if (prescription?.imageUrl) cart.items[itemIdx].prescription = prescriptionData;
  } else {
    cart.items.push({
      medicine:               toObjectId(medicineId, 'medicineId'),
      quantity:               quantityNum,
      pricePerUnit,
      gstPercentage:          medicine.gstPercentage ?? 5,
      isPrescriptionRequired: medicine.isPrescriptionRequired ?? false,
      prescription:           prescriptionData,
    });
  }

  cart.store = resolvedStore._id;
  await cart.save();
  await cart.populate('items.medicine', 'brandName genericName images dosage packaging isPrescriptionRequired');
  
  // FIX: Added 'operationalCapacity', 'timings', 'isOnline', and 'deliverySettings' 
  // so the virtuals in the PharmacyStore model do not crash when toObject() is called.
  await cart.populate('store', 'storeName address status deliverySettings operationalCapacity timings isOnline');

  res.status(200).json({
    success: true,
    cart:    cart.toObject(),
    ...(storeOverridden && { notice: `Sourced from "${resolvedStore.storeName}" (preferred store had insufficient stock).` }),
  });
});

// POST '/cart/update'
export const postCartUpdate = asyncHandler(async (req, res) => {
  const { medicineId, quantity } = req.body;
  if (!medicineId || quantity === undefined)
    return res.status(400).json({ success: false, message: 'medicineId and quantity are required.' });

  const quantityNum = parseInt(quantity, 10);
  if (quantityNum < 0)
    return res.status(400).json({ success: false, message: 'Quantity must be positive.' });

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart?.items?.length)
    return res.status(404).json({ success: false, message: 'Cart is empty.' });

  const itemIdx = cart.items.findIndex((i) => i.medicine.toString() === medicineId);
  if (itemIdx === -1)
    return res.status(404).json({ success: false, message: 'Item not in cart.' });

  if (quantityNum === 0) {
    cart.items.splice(itemIdx, 1);
    if (cart.items.length === 0) cart.store = null;
  } else {
    const inv = await MedicineInventory.findOne({
      medicineId: toObjectId(medicineId),
      isActive:   true,
      isDeleted:  false,
    })
      .sort({ availableStock: -1 })
      .lean();

    const maxAvailable = inv?.availableStock ?? 0;
    if (!maxAvailable)
      return res.status(400).json({ success: false, message: 'Item is out of stock.' });
    if (quantityNum > maxAvailable)
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Maximum available: ${maxAvailable}.`,
        availableStock: maxAvailable,
      });

    cart.items[itemIdx].quantity = quantityNum;
  }

  await cart.save();
  await cart.populate('items.medicine', 'brandName genericName images isPrescriptionRequired');
  res.status(200).json({ success: true, cart: cart.toObject() });
});

// DELETE '/cart'
export const deleteCart = asyncHandler(async (req, res) => {
  await clearCart(req.user._id);
  res.status(200).json({ success: true, message: 'Cart cleared.' });
});

// POST '/cart/prescription'
export const postCartPrescription = asyncHandler(async (req, res) => {
  const { medicineId, imageUrl } = req.body;
  if (!medicineId) return res.status(400).json({ success: false, message: 'medicineId is required.' });
  if (!imageUrl)   return res.status(400).json({ success: false, message: 'imageUrl is required.' });
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http'))
    return res.status(400).json({ success: false, message: 'imageUrl must be a valid URL.' });

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart?.items?.length) return res.status(404).json({ success: false, message: 'Cart is empty.' });

  const itemIdx = cart.items.findIndex((i) => i.medicine.toString() === medicineId.toString());
  if (itemIdx === -1) return res.status(404).json({ success: false, message: 'Medicine not in cart.' });
  if (!cart.items[itemIdx].isPrescriptionRequired)
    return res.status(400).json({ success: false, message: 'This medicine does not require a prescription.' });

  cart.items[itemIdx].prescription = { isRequired: true, imageUrl, uploadedAt: new Date() };
  await cart.save();
  await cart.populate('items.medicine', 'brandName genericName images isPrescriptionRequired');

  res.status(200).json({ success: true, message: 'Prescription uploaded.', cart: cart.toObject() });
});

// POST '/cart/prescription/upload'
export const postCartPrescriptionUpload = asyncHandler(async (req, res) => {
    const { medicineId } = req.body;
    if (!medicineId) return res.status(400).json({ success: false, message: 'medicineId is required.' });
    if (!req.file)   return res.status(400).json({ success: false, message: 'Prescription file is required.' });

    let imageUrl;
    try {
      imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/prescriptions/cart');
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart?.items?.length) return res.status(404).json({ success: false, message: 'Cart is empty.' });

    const itemIdx = cart.items.findIndex((i) => i.medicine.toString() === medicineId.toString());
    if (itemIdx === -1) return res.status(404).json({ success: false, message: 'Medicine not in cart.' });
    if (!cart.items[itemIdx].isPrescriptionRequired)
      return res.status(400).json({ success: false, message: 'This medicine does not require a prescription.' });

    cart.items[itemIdx].prescription = { isRequired: true, imageUrl, uploadedAt: new Date() };
    await cart.save();
    await cart.populate('items.medicine', 'brandName genericName images isPrescriptionRequired');

    res.status(200).json({ success: true, message: 'Prescription uploaded and saved to cart.', imageUrl, cart: cart.toObject() });
  });

// POST '/coupon/validate'
export const postCouponValidate = asyncHandler(async (req, res) => {
  const { couponCode, orderTotal } = req.body;
  if (!couponCode) return res.status(400).json({ success: false, message: 'couponCode is required.' });
  const orderTotalNum = parseFloat(orderTotal);
  if (!orderTotalNum || orderTotalNum <= 0)
    return res.status(400).json({ success: false, message: 'Valid orderTotal required.' });
  try {
    const { coupon, discountAmount } = await validateAndApplyCoupon(couponCode, req.user._id, orderTotalNum);
    res.status(200).json({
      success: true, message: `Coupon applied! You save ₹${discountAmount}.`,
      couponCode: coupon.code, discountAmount,
      benefitType: coupon.benefit?.type, benefitValue: coupon.benefit?.value,
      maxCap: coupon.benefit?.maxCap ?? null,
      finalTotal: parseFloat((orderTotalNum - discountAmount).toFixed(2)),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET '/coupon/eligibility'
export const getCouponEligibility = asyncHandler(async (req, res) => {
  const { couponCode, orderTotal } = req.query;

  if (!couponCode || !couponCode.trim())
    return res.status(400).json({ success: false, message: 'couponCode is required.' });

  const orderTotalNum = parseFloat(orderTotal);
  if (!orderTotal || isNaN(orderTotalNum) || orderTotalNum <= 0)
    return res.status(400).json({ success: false, message: 'Valid orderTotal is required.' });

  const code   = couponCode.trim().toUpperCase();
  const coupon = await PromotionCoupon.findOne({ code, isActive: true }).lean();

  if (!coupon) {
    return res.status(200).json({ success: true, eligible: false, reason: `Coupon "${code}" is invalid or deactivated.`, couponCode: code });
  }

  const now     = new Date();
  const userId  = req.user._id;
  const reasons = [];

  if (coupon.validity?.from && now < coupon.validity.from)
    reasons.push(`Coupon not yet active. Valid from ${coupon.validity.from.toDateString()}.`);
  if (coupon.validity?.to && now > coupon.validity.to)
    reasons.push(`Coupon expired on ${coupon.validity.to.toDateString()}.`);
  if (coupon.usage?.totalPlatformLimit != null && coupon.usage.currentUses >= coupon.usage.totalPlatformLimit)
    reasons.push('Coupon has reached its total usage limit.');

  const userUseCount = await PharmacyOrder.countDocuments({
    customer: userId, 'billing.promoCode': code, 'payment.status': { $in: ['Paid', 'Pending'] },
  });
  const perUserLimit = coupon.usage?.limitPerUser ?? 1;
  if (userUseCount >= perUserLimit)
    reasons.push(perUserLimit === 1 ? 'Already used this coupon.' : `Used ${userUseCount}/${perUserLimit} times.`);

  if (coupon.eligibility?.minOrderValue && orderTotalNum < coupon.eligibility.minOrderValue)
    reasons.push(`Min order ₹${coupon.eligibility.minOrderValue} required. Your total: ₹${orderTotalNum.toFixed(2)}.`);

  if (coupon.eligibility?.type === 'New_User_Only') {
    const has = await PharmacyOrder.exists({ customer: userId });
    if (has) reasons.push('Only for new users.');
  }
  if (coupon.eligibility?.type === 'First_Booking') {
    const has = await PharmacyOrder.exists({ customer: userId, 'payment.status': 'Paid' });
    if (has) reasons.push('Only valid on your first order.');
  }

  if (reasons.length > 0) {
    return res.status(200).json({
      success: true, eligible: false, couponCode: code,
      reason: reasons[0], allReasons: reasons,
      benefit: { type: coupon.benefit?.type, value: coupon.benefit?.value, maxCap: coupon.benefit?.maxCap ?? null },
    });
  }

  let discountAmount = 0;
  if (coupon.benefit?.type === 'Percentage') {
    discountAmount = parseFloat(((orderTotalNum * coupon.benefit.value) / 100).toFixed(2));
    if (coupon.benefit?.maxCap) discountAmount = Math.min(discountAmount, coupon.benefit.maxCap);
  } else if (coupon.benefit?.type === 'Flat_Amount') {
    discountAmount = Math.min(coupon.benefit.value, orderTotalNum);
  }
  discountAmount = parseFloat(discountAmount.toFixed(2));

  const usesRemaining = coupon.usage?.totalPlatformLimit != null
    ? coupon.usage.totalPlatformLimit - coupon.usage.currentUses
    : null;

  return res.status(200).json({
    success: true, eligible: true, couponCode: code,
    message: `Coupon valid! You save ₹${discountAmount}.`,
    benefit: { type: coupon.benefit?.type, value: coupon.benefit?.value, maxCap: coupon.benefit?.maxCap ?? null, discountAmount, finalTotal: parseFloat((orderTotalNum - discountAmount).toFixed(2)) },
    validity: { from: coupon.validity?.from ?? null, to: coupon.validity?.to ?? null },
    usage: { usedByYou: userUseCount, limitPerUser: perUserLimit, usesRemaining },
  });
});

// GET '/checkout/preview'
export const getCheckoutPreview = asyncHandler(async (req, res) => {
  const { couponCode, deliveryType = 'Standard' } = req.query;

  const cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path:   'items.medicine',
      select: 'brandName genericName gstPercentage mrp isPrescriptionRequired isDiscontinued',
    })
    .lean();

  if (!cart?.items?.length)
    return res.status(400).json({ success: false, message: 'Cart is empty.' });

  const [platformConfig, { pharmacyDiscountPct, planDoc }] = await Promise.all([
    PlatformPricingConfig.getGlobal(),
    resolveSubscriptionBenefits(req.user._id),
  ]);

  const customerUser = await User.findById(req.user._id).select('location').lean();
  const { groups, unavailableItems } = await resolveMultiStoreForCart(cart.items, customerUser);

  if (!groups.length)
    return res.status(400).json({ success: false, message: 'No items available at any open store.', unavailableItems });

  const orderPreviews = [];
  for (const group of groups) {
    const { storeDoc, items: groupItems } = group;

    const orderItems = groupItems.map((item) => {
      const med          = item.medicine;
      const pricePerUnit = item._resolvedInv?.finalPrice ?? item._resolvedInv?.sellingPrice ?? med.mrp ?? 0;
      const gstPct       = Number(med?.gstPercentage) || 5;
      const qty          = parseInt(item.quantity, 10);
      return {
        medicine:      med._id,
        name:          med.brandName ?? med.genericName,
        quantity:      qty,
        pricePerUnit,
        gstPercentage: gstPct,
        taxAmount:     0,
        totalPrice:    parseFloat((pricePerUnit * qty).toFixed(2)),
        isPrescriptionRequired: item.isPrescriptionRequired ?? med.isPrescriptionRequired ?? false,
      };
    });

    const { billing, appliedCoupon, deliveryResult } = await buildBilling({
      orderItems,
      userId:                 req.user._id,
      deliveryType:           deliveryType === 'Express' ? 'Express' : 'Standard',
      platformConfig,
      subPlanDoc:             planDoc,
      couponCode:             couponCode || null,
      subscriptionDiscountPct: pharmacyDiscountPct,
      session:                null,
    });

    orderPreviews.push({
      storeId:        storeDoc._id,
      storeName:      storeDoc.storeName,
      itemCount:      orderItems.length,
      billing,
      couponApplied:  appliedCoupon ? { code: appliedCoupon.code, saved: billing.discountAmount } : null,
      deliveryInfo:   deliveryResult,
      platformFee:    PLATFORM_FEE_FLAT,
    });
  }

  const grandTotal = orderPreviews.reduce((s, o) => s + o.billing.totalPayable, 0);

  res.status(200).json({
    success: true,
    preview: {
      orderCount:   orderPreviews.length,
      orders:       orderPreviews,
      grandTotal:   parseFloat(grandTotal.toFixed(2)),
      platformFee:  PLATFORM_FEE_FLAT,
      subscriptionDiscountApplied: pharmacyDiscountPct > 0,
      subscriptionDiscountPct:     pharmacyDiscountPct,
    },
    ...(unavailableItems.length > 0 && { unavailableItems }),
  });
});

// POST '/order/checkout'
export const postOrderCheckout = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      address,
      paymentMethod  = 'Razorpay',
      couponCode,
      deliveryType   = 'Standard',  // 'Standard' | 'Express'
    } = req.body;

    try { validateDeliveryAddress(address); }
    catch (error) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!['Razorpay', 'Wallet', 'COD'].includes(paymentMethod)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid payment method.' });
    }

    const resolvedDeliveryType = deliveryType === 'Express' ? 'Express' : 'Standard';

    // ── Load cart ────────────────────────────────────────────────────────────
    const cart = await Cart.findOne({ user: req.user._id })
      .populate({
        path:   'items.medicine',
        select: 'brandName genericName images gstPercentage isPrescriptionRequired mrp isDiscontinued hsnCode',
      })
      .session(session);

    if (!cart?.items?.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    const cartItemsPlain = cart.items.map((item) => {
      const qty = parseInt(item.quantity, 10);
      return {
        medicine:               item.medicine,
        quantity:               isNaN(qty) ? 0 : qty,
        pricePerUnit:           Number(item.pricePerUnit) || null,
        gstPercentage:          Number(item.gstPercentage) || 5,
        isPrescriptionRequired: Boolean(item.isPrescriptionRequired),
        prescription:           item.prescription
          ? { isRequired: item.prescription.isRequired, imageUrl: item.prescription.imageUrl ?? null, uploadedAt: item.prescription.uploadedAt ?? null }
          : null,
      };
    });

    const customerUser = await User.findById(req.user._id).select('location').lean();
    let groups, unavailableItems;
    try {
      ({ groups, unavailableItems } = await resolveMultiStoreForCart(cartItemsPlain, customerUser));
    } catch (error) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!groups.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'None of your cart items are available at any open store.',
        unavailableItems,
      });
    }

    // ── Platform config + subscription ────────────────────────────────────────
    const [platformConfig, { pharmacyDiscountPct, planDoc }] = await Promise.all([
      PlatformPricingConfig.getGlobal(),
      resolveSubscriptionBenefits(req.user._id),
    ]);

    // ── Wallet preflight ─────────────────────────────────────────────────────
    let wallet = null;
    if (paymentMethod === 'Wallet') {
      wallet = await Wallet.findOne({ user: req.user._id }).session(session);
      if (!wallet)          throw new Error('Wallet not found.');
      if (!wallet.isActive) throw new Error('Wallet is inactive.');
      // Full preflight after billing computed per group below
    }

    // ── Create orders per store group ─────────────────────────────────────────
    const createdOrders   = [];
    let globalCouponCode  = couponCode || null;
    let globalCouponUsed  = false;

    for (const group of groups) {
      const { storeDoc, items: groupItems } = group;
      const storeId    = storeDoc._id.toString();
      const storeObjId = storeDoc._id;

      const orderItems = groupItems.map((item) => {
        const med          = item.medicine;
        const qty          = parseInt(item.quantity, 10);
        if (!qty || isNaN(qty) || qty <= 0)
          throw new Error(`Invalid quantity for "${med?.brandName ?? 'Medicine'}".`);

        const pricePerUnit = Number(item._resolvedInv?.finalPrice) || Number(item._resolvedInv?.sellingPrice) || Number(med?.mrp);
        if (!pricePerUnit || isNaN(pricePerUnit))
          throw new Error(`Missing price for "${med?.brandName ?? 'Medicine'}".`);

        const gstPct = Number(med?.gstPercentage) || 5;
        return {
          medicine:               med._id,
          name:                   med.brandName ?? med.genericName ?? 'Medicine',
          brandName:              med.brandName,
          genericName:            med.genericName,
          medicineImage:          med.images?.[0]?.url || null,
          hsnCode:                med.hsnCode,
          gstPercentage:          gstPct,
          quantity:               qty,
          pricePerUnit:           parseFloat(pricePerUnit.toFixed(2)),
          taxAmount:              0,
          totalPrice:             parseFloat((pricePerUnit * qty).toFixed(2)),
          isPrescriptionRequired: Boolean(item.isPrescriptionRequired ?? med.isPrescriptionRequired),
        };
      });

      // Apply coupon only to first store group to avoid double-use
      const thisCouponCode = !globalCouponUsed ? globalCouponCode : null;

      const { billing, appliedCoupon, deliveryResult } = await buildBilling({
        orderItems,
        userId:                  req.user._id,
        deliveryType:            resolvedDeliveryType,
        platformConfig,
        subPlanDoc:              planDoc,
        couponCode:              thisCouponCode,
        subscriptionDiscountPct: pharmacyDiscountPct,
        session,
      });

      if (appliedCoupon) globalCouponUsed = true;

      // ── Live stock re-validation ─────────────────────────────────────────
      for (const orderItem of orderItems) {
        const liveInv = await MedicineInventory.findOne({
          medicineId: toObjectId(orderItem.medicine, 'medicine'),
          storeId:    storeObjId,
          isActive:   true,
          isDeleted:  false,
        }).session(session);

        if (!liveInv || liveInv.availableStock < orderItem.quantity) {
          throw new Error(
            `Stock changed for "${orderItem.name}" at "${storeDoc.storeName}". ` +
            `Available: ${liveInv?.availableStock ?? 0}, requested: ${orderItem.quantity}. Please retry.`
          );
        }
      }

      const orderPrescription = buildOrderPrescription(groupItems);

      const order = new PharmacyOrder({
        customer:     req.user._id,
        store:        storeObjId,
        items:        orderItems,
        prescription: orderPrescription,
        billing,
        delivery: {
          address,
          // Set express delivery fields if applicable
          ...(resolvedDeliveryType === 'Express' && {
            estimatedArrival: new Date(Date.now() + (storeDoc.deliverySettings?.expressEtaMinutes ?? 30) * 60 * 1000),
          }),
          ...(resolvedDeliveryType === 'Standard' && {
            estimatedArrival: new Date(Date.now() + (storeDoc.deliverySettings?.standardEtaMinutes ?? 120) * 60 * 1000),
          }),
        },
        payment: { method: paymentMethod },
      });
      // Store delivery type hint in admin notes
      order.adminNotes.push({
        text:    `Delivery type: ${resolvedDeliveryType}. Store: ${storeDoc.storeName}. Charge: ₹${billing.deliveryCharges}. Reason: ${deliveryResult.reason}.`,
        addedAt: new Date(),
      });

      // ── Payment ──────────────────────────────────────────────────────────
      if (paymentMethod === 'Razorpay') {
        const rzpOrder = await razorpay.orders.create({
          amount:   Math.round(billing.totalPayable * 100),
          currency: 'INR',
          receipt:  order._id.toString(),
        });
        order.payment.razorpayOrderId = rzpOrder.id;
      }

      if (paymentMethod === 'COD') {
        await decrementStock(orderItems, storeId, session);
        order.delivery.status = 'Placed';
      }

      if (paymentMethod === 'Wallet') {
        if (wallet.balance < billing.totalPayable)
          throw new Error(
            `Insufficient wallet balance. Required: ₹${billing.totalPayable}, Available: ₹${wallet.balance}.`
          );
        const balanceBefore = wallet.balance;
        wallet.balance      = parseFloat((wallet.balance - billing.totalPayable).toFixed(2));
        wallet.transactions.push({
          transactionId: `TXN-${Date.now()}-${storeId.slice(-4)}`,
          type:          'Debit',
          amount:        billing.totalPayable,
          purpose:       'Medicine_Purchase',
          referenceId:   order._id,
          onModel:       'PharmacyOrder',
          status:        'Success',
          balanceBefore,
          balanceAfter:  wallet.balance,
          description:   `Payment for Order #${order.orderId} — ${storeDoc.storeName}`,
        });
        await decrementStock(orderItems, storeId, session);
        order.payment.status  = 'Paid';
        order.payment.paidAt  = new Date();
        order.delivery.status = 'Placed';
      }

      await order.save({ session });
      if (appliedCoupon) await commitCouponUsage(appliedCoupon._id, session);
      createdOrders.push({ order: order.toObject(), storeDoc });
    }

    if (paymentMethod === 'Wallet' && wallet) await wallet.save({ session });
    await clearCart(req.user._id, session);
    await session.commitTransaction();

    logAudit('ORDER_CHECKOUT_MULTI', {
      userId: req.user._id, orderCount: createdOrders.length, paymentMethod, deliveryType: resolvedDeliveryType,
    });

    if (paymentMethod !== 'Razorpay') {
      for (const { order, storeDoc } of createdOrders) {
        const headerNote = order.billing.promoCode ? `Coupon applied — you saved!` : '';
        dispatchOrderConfirmationEmail(req.user._id, order, storeDoc.storeName, headerNote);
      }
    }

    res.status(201).json({
      success:     true,
      order:       createdOrders[0]?.order,
      orders:      createdOrders.map((o) => o.order),
      razorpayKey: RAZORPAY_KEY_ID,
      orderCount:  createdOrders.length,
      ...(unavailableItems.length > 0 && {
        warning: { message: 'Some items were unavailable.', unavailableItems },
      }),
    });
  } catch (err) {
    await session.abortTransaction();
    logError('CHECKOUT_ERROR', err, { userId: req.user._id });
    throw err;
  } finally { session.endSession(); }
});

// POST '/order/verify'
export const postOrderVerify = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment verification details.' });

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

  if (hmac !== razorpay_signature)
    return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await PharmacyOrder.findOne({
      'payment.razorpayOrderId': razorpay_order_id, customer: req.user._id,
    }).session(session);

    if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }
    if (order.payment?.status === 'Paid') { await session.abortTransaction(); return res.status(200).json({ success: true, message: 'Already paid.', order }); }

    await decrementStock(order.items, order.store.toString(), session);
    order.payment.status            = 'Paid';
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paidAt            = new Date();
    order.delivery.status           = 'Placed';
    await order.save({ session });
    await session.commitTransaction();

    const storeDoc = await PharmacyStore.findById(order.store).select('storeName').lean();
    dispatchOrderConfirmationEmail(req.user._id, order.toObject(), storeDoc?.storeName ?? 'Likeson Pharmacy');

    res.status(200).json({ success: true, order });
  } catch (err) {
    await session.abortTransaction();
    logError('PAYMENT_VERIFICATION_ERROR', err, { userId: req.user._id });
    throw err;
  } finally { session.endSession(); }
});

// POST '/wallet/pay'
export const postWalletPay = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await findOrderSafe(orderId, { customer: req.user._id }, session);
    if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }
    if (order.payment?.status === 'Paid') { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Order already paid.' }); }

    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet)          throw new Error('Wallet not found.');
    if (!wallet.isActive) throw new Error('Wallet is inactive.');
    if (wallet.balance < order.billing.totalPayable)
      throw new Error(`Insufficient wallet balance. Required: ₹${order.billing.totalPayable}, Available: ₹${wallet.balance}.`);

    const balanceBefore = wallet.balance;
    wallet.balance      = parseFloat((wallet.balance - order.billing.totalPayable).toFixed(2));
    wallet.transactions.push({
      transactionId: `TXN-${Date.now()}`,
      type:          'Debit',
      amount:        order.billing.totalPayable,
      purpose:       'Medicine_Purchase',
      referenceId:   order._id,
      onModel:       'PharmacyOrder',
      status:        'Success',
      balanceBefore,
      balanceAfter:  wallet.balance,
      description:   `Payment for Order #${order.orderId}`,
    });

    await decrementStock(order.items, order.store.toString(), session);
    order.payment.status  = 'Paid';
    order.payment.paidAt  = new Date();
    order.delivery.status = 'Confirmed';
    await wallet.save({ session });
    await order.save({ session });
    await clearCart(req.user._id, session);
    await session.commitTransaction();

    const storeDoc   = await PharmacyStore.findById(order.store).select('storeName').lean();
    dispatchOrderConfirmationEmail(req.user._id, order.toObject(), storeDoc?.storeName ?? 'Likeson Pharmacy', `Remaining wallet balance: ₹${wallet.balance}`);

    res.status(200).json({ success: true, order });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    logError('WALLET_PAYMENT_ERROR', error, { userId: req.user._id });
    throw error;
  } finally { session.endSession(); }
});

// GET '/orders/my-orders'
export const getOrdersMyOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;
  
  // ✅ Explicitly ensure we exclude soft-deleted/archived data
  const filter   = { customer: req.user._id, isArchived: false }; 
  if (status) filter['delivery.status'] = status;

  const [orders, total] = await Promise.all([
    PharmacyOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
      // ✅ Added comprehensive populations so frontend has full data
      .populate('store', 'storeName address contact status storeType isOnline timings operationalCapacity deliverySettings')
      .populate('items.medicine', 'name brandName genericName images category dosage packaging')
      .lean({ virtuals: true }),
    PharmacyOrder.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    pagination: { total, pages: Math.ceil(total / limitNum), page: pageNum, limit: limitNum },
    orders,
  });
});

// GET '/orders/:id'
export const getOrdersById = asyncHandler(async (req, res) => {
  const order = await findOrderSafe(req.params.id, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  await order.populate('store', 'storeName address contact');
  await order.populate('items.medicine', 'brandName genericName dosage packaging images');
  await order.populate('prescription.verifiedBy', 'name email');
  res.status(200).json({ success: true, order });
});

// POST '/order/upload-prescription'
export const postOrderUploadPrescription = asyncHandler(async (req, res) => {
  const { orderId, imageUrl } = req.body;
  if (!orderId)  return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!imageUrl) return res.status(400).json({ success: false, message: 'imageUrl is required.' });
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http'))
    return res.status(400).json({ success: false, message: 'imageUrl must be a valid URL.' });

  const order = await findOrderSafe(orderId, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (!order.prescription?.isRequired)
    return res.status(400).json({ success: false, message: 'No prescription required for this order.' });

  const notAllowed = ['Delivered', 'Cancelled', 'Return_Requested', 'Return_Accepted', 'Pickup_Assigned', 'Pickup_Done', 'Returned'];
  if (notAllowed.includes(order.delivery.status))
    return res.status(400).json({ success: false, message: `Cannot upload prescription for status: ${order.delivery.status}.` });
  if (order.prescription.verificationStatus === 'Approved')
    return res.status(400).json({ success: false, message: 'Prescription already approved.' });

  order.prescription.imageUrl           = imageUrl;
  order.prescription.uploadedAt         = new Date();
  order.prescription.verificationStatus = 'Pending';
  await order.save();

  res.status(200).json({
    success: true, message: 'Prescription uploaded. Pending pharmacist verification.',
    prescription: order.prescription,
  });
});

// POST '/order/upload-prescription/file'
export const postOrderUploadPrescriptionFile = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Prescription file is required.' });

    const order = await findOrderSafe(orderId, { customer: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.prescription?.isRequired)
      return res.status(400).json({ success: false, message: 'No prescription required for this order.' });

    const notAllowed = ['Delivered', 'Cancelled', 'Return_Requested', 'Return_Accepted', 'Pickup_Assigned', 'Pickup_Done', 'Returned'];
    if (notAllowed.includes(order.delivery.status))
      return res.status(400).json({ success: false, message: `Cannot upload prescription for status: ${order.delivery.status}.` });
    if (order.prescription.verificationStatus === 'Approved')
      return res.status(400).json({ success: false, message: 'Prescription already approved.' });

    let imageUrl;
    try {
      imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/prescriptions/orders');
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
    }

    order.prescription.imageUrl           = imageUrl;
    order.prescription.uploadedAt         = new Date();
    order.prescription.verificationStatus = 'Pending';
    await order.save();

    res.status(200).json({
      success: true, message: 'Prescription uploaded. Pending pharmacist verification.',
      imageUrl, prescription: order.prescription,
    });
  });

// GET '/medicines/:id/similar'
export const getMedicinesByIdSimilar = asyncHandler(async (req, res) => {
  const { id }  = req.params;
  const limit   = parseInt(req.query.limit, 10) || 10;

  const baseMedicine = await Medicine.findById(id)
    .select('category genericName therapeuticClass pharmacologicalClass')
    .lean();
  if (!baseMedicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

  const similarityConditions = [];
  if (baseMedicine.genericName)           similarityConditions.push({ genericName: baseMedicine.genericName });
  if (baseMedicine.therapeuticClass)      similarityConditions.push({ therapeuticClass: baseMedicine.therapeuticClass });
  if (baseMedicine.pharmacologicalClass)  similarityConditions.push({ pharmacologicalClass: baseMedicine.pharmacologicalClass });

  const matchQuery = {
    _id:            { $ne: id },
    isDiscontinued: false,
    isApproved:     true,
    isDeleted:      false,
    category:       baseMedicine.category,
    ...(similarityConditions.length && { $or: similarityConditions }),
  };

  const similarMedicines = await Medicine.find(matchQuery)
    .limit(limit)
    .lean();

  // Enrich with lowest price from MedicineInventory
  const medIds = similarMedicines.map((m) => m._id);
  const invs   = await MedicineInventory.find({
    medicineId: { $in: medIds }, isActive: true, isDeleted: false, availableStock: { $gt: 0 },
  }).lean();
  const invByMed = new Map();
  for (const inv of invs) {
    const mid = inv.medicineId.toString();
    if (!invByMed.has(mid)) invByMed.set(mid, []);
    invByMed.get(mid).push(inv);
  }

  const enriched = similarMedicines.map((med) => {
    const invList = invByMed.get(med._id.toString()) || [];
    const lowest  = invList.length ? Math.min(...invList.map((i) => i.finalPrice ?? Infinity)) : null;
    return { ...med, lowestPrice: lowest, isAvailable: invList.length > 0 };
  }).sort((a, b) => (a.isAvailable === b.isAvailable ? 0 : a.isAvailable ? -1 : 1));

  res.status(200).json({ success: true, category: baseMedicine.category, medicines: enriched });
});

// GET '/orders/:id/invoice'
export const getOrdersByIdInvoice = asyncHandler(async (req, res) => {
  const order = await findOrderSafe(req.params.id, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  await order.populate('store', 'storeName address contact legal');
  const user  = await User.findById(req.user._id).select('name email phone').lean();
  const store = order.store;

  const { html, invoiceUrl } = await generateInvoice({
    order: order.toObject(), user,
    store: store ? (typeof store.toObject === 'function' ? store.toObject() : store) : null,
  });

  if (invoiceUrl) {
    PharmacyOrder.findByIdAndUpdate(order._id, { $set: { 'billing.invoiceUrl': invoiceUrl } })
      .catch((e) => logError('INVOICE_URL_SAVE', e));
  }

  if (user?.email) {
    sendEmail({ email: user.email, subject: `[Likeson Healthcare] Invoice — Order #${order.orderId}`, html })
      .catch((err) => logError('INVOICE_EMAIL_ERROR', err));
  }

  if (invoiceUrl) res.setHeader('X-Invoice-Url', invoiceUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

// GET '/orders/:id/invoice/download'
export const getOrdersByIdInvoiceDownload = asyncHandler(async (req, res) => {
  const order = await findOrderSafe(req.params.id, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  await order.populate('store', 'storeName address contact legal');
  const user  = await User.findById(req.user._id).select('name email phone').lean();
  const store = order.store;

  const { html, invoiceUrl } = await generateInvoice({
    order: order.toObject(), user,
    store: store ? (typeof store.toObject === 'function' ? store.toObject() : store) : null,
  });

  if (invoiceUrl) res.setHeader('X-Invoice-Url', invoiceUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.html"`);
  res.status(200).send(html);
});

// POST '/order/cancel'
export const postOrderCancel = asyncHandler(async (req, res) => {
  const { orderId, reason = 'Customer requested cancellation' } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await findOrderSafe(orderId, { customer: req.user._id }, session);
    if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }

    const nonCancellable = ['Delivered', 'Return_Requested', 'Return_Accepted', 'Pickup_Assigned', 'Pickup_Done', 'Returned'];
    if (nonCancellable.includes(order.delivery.status)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Cannot cancel order with status: ${order.delivery.status}.` });
    }

    order.cancellation.isCancelled = true;
    order.cancellation.reason      = reason;
    order.cancellation.cancelledBy = req.user._id;
    order.cancellation.cancelledAt = new Date();
    order.delivery.status          = 'Cancelled';

    if (order.payment?.status === 'Paid') {
      order.cancellation.refundAmount = order.billing.totalPayable;
      await incrementStock(order.items, order.store.toString(), session);

      if (order.payment?.method === 'Wallet') {
        const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
        if (wallet) {
          const balanceBefore = wallet.balance;
          wallet.balance      = parseFloat((wallet.balance + order.billing.totalPayable).toFixed(2));
          wallet.transactions.push({
            transactionId: `TXN-${Date.now()}`,
            type:          'Credit',
            amount:        order.billing.totalPayable,
            purpose:       'Refund',
            referenceId:   order._id,
            onModel:       'PharmacyOrder',
            status:        'Success',
            balanceBefore,
            balanceAfter:  wallet.balance,
            description:   `Refund for cancelled order #${order.orderId}`,
          });
          await wallet.save({ session });
          order.cancellation.refundStatus = 'Processed';
          order.cancellation.refundMethod = 'Wallet';
        }
      } else if (order.payment?.method === 'Razorpay') {
        order.cancellation.selectedRefundMethod = order.cancellation.selectedRefundMethod || 'Online';
        order.cancellation.refundStatus         = 'Requested';
        order.cancellation.refundMethod         = 'Original_Source';
        order.$locals._triggerCancellationRefund = true;
      } else {
        order.cancellation.refundStatus = 'None';
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    if (order.$locals?._triggerCancellationRefund) {
      import('../services/refundService.js')
        .then(({ initiateRefund }) => initiateRefund(order._id.toString(), { adminNote: `Auto-refund: order cancelled by customer` }))
        .catch((err) => console.error('[cancel] Auto-refund failed', order.orderId, err.message));
    }

    dispatchNotification(req.user._id, {
      title:        'Order Cancelled',
      body:         `Order #${order.orderId} has been cancelled.`,
      type:         'Order_Cancelled',
      emailSubject: 'Order Cancellation Confirmation',
      emailBody:    `Your order #${order.orderId} has been cancelled.${
        order.payment.status === 'Paid' ? ` A refund of ₹${order.billing.totalPayable} will be processed.` : ''
      }`,
      actionLink: `https://likeson.in/pharmacy/orders/${order._id}`,
    });

    res.status(200).json({ success: true, message: 'Order cancelled.', order });
  } catch (error) {
    await session.abortTransaction();
    logError('CANCEL_ERROR', error, { orderId });
    throw error;
  } finally { session.endSession(); }
});

// POST '/order/request-return'
export const postOrderRequestReturn = asyncHandler(async (req, res) => {
  const { orderId, returnReason, evidence, refundMethod, bankDetails } = req.body;

  if (!orderId)      return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!returnReason) return res.status(400).json({ success: false, message: 'returnReason is required.' });
  if (returnReason.length < 10)
    return res.status(400).json({ success: false, message: 'returnReason must be at least 10 characters.' });
  if (!evidence || !Array.isArray(evidence) || evidence.length === 0)
    return res.status(400).json({ success: false, message: 'Evidence required. Upload at least one image or video.' });

  for (const item of evidence) {
    if (!item.url) return res.status(400).json({ success: false, message: 'Each evidence item must have a url.' });
    if (!['image', 'video'].includes(item.mediaType))
      return res.status(400).json({ success: false, message: 'Evidence mediaType must be "image" or "video".' });
  }

  const validRefundMethods = ['Wallet', 'Online', 'Bank_Transfer', 'Custom_Bank'];
  if (!refundMethod || !validRefundMethods.includes(refundMethod))
    return res.status(400).json({ success: false, message: `refundMethod required. Valid: ${validRefundMethods.join(', ')}.` });

  if (['Bank_Transfer', 'Custom_Bank'].includes(refundMethod)) {
    if (!bankDetails) return res.status(400).json({ success: false, message: 'bankDetails required for bank transfer refund.' });
    const reqFields = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName'];
    const missing   = reqFields.filter((f) => !bankDetails[f]);
    if (missing.length)
      return res.status(400).json({ success: false, message: `Missing bank details: ${missing.join(', ')}.` });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(bankDetails.ifscCode))
      return res.status(400).json({ success: false, message: 'Invalid IFSC code format.' });
  }

  const order = await findOrderSafe(orderId, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (order.delivery.status !== 'Delivered')
    return res.status(400).json({ success: false, message: `Cannot return order with status: ${order.delivery.status}.` });
  if (order.cancellation?.isReturnRequested)
    return res.status(400).json({ success: false, message: 'Return already requested.' });

  const deliveredAt = order.delivery.deliveredAt || order.updatedAt;
  const daysElapsed = (Date.now() - deliveredAt) / (1000 * 60 * 60 * 24);
  if (daysElapsed > 7)
    return res.status(400).json({ success: false, message: 'Return window closed. Returns allowed within 7 days of delivery.' });

  order.cancellation.isReturnRequested    = true;
  order.cancellation.returnReason         = returnReason;
  order.cancellation.returnRequestedAt    = new Date();
  order.cancellation.returnRequestedBy    = req.user._id;
  order.cancellation.returnDecision       = 'Pending';
  order.cancellation.returnEvidence       = evidence.map((e) => ({ mediaType: e.mediaType, url: e.url, uploadedAt: new Date() }));
  order.cancellation.selectedRefundMethod = refundMethod;
  if (['Bank_Transfer', 'Custom_Bank'].includes(refundMethod) && bankDetails)
    order.cancellation.bankDetails = bankDetails;
  order.delivery.status = 'Return_Requested';
  await order.save();

  dispatchNotification(req.user._id, {
    title:        'Return Request Submitted',
    body:         `Return request for order #${order.orderId} submitted.`,
    type:         'Return_Requested',
    emailSubject: 'Return Request Confirmed',
    emailBody:    `Your return request for order #${order.orderId} has been received. Our team will review within 24 hours.\n\nRefund method: ${refundMethod}.`,
    actionLink:   `https://likeson.in/pharmacy/orders/${order._id}`,
  });

  res.status(200).json({ success: true, message: 'Return request submitted.', order });
});

// POST '/order/submit-feedback'
export const postOrderSubmitFeedback = asyncHandler(async (req, res) => {
  const { orderId, rating, comment } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ success: false, message: 'Rating must be 1–5.' });
  if (comment && comment.length > 500)
    return res.status(400).json({ success: false, message: 'Comment max 500 chars.' });

  const order = await findOrderSafe(orderId, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (order.delivery.status !== 'Delivered')
    return res.status(400).json({ success: false, message: 'Only delivered orders can be reviewed.' });
  if (order.customerFeedback?.createdAt)
    return res.status(400).json({ success: false, message: 'Feedback already submitted.' });

  order.customerFeedback = { rating: parseInt(rating, 10), comment: comment || '', createdAt: new Date() };
  await order.save();

  res.status(200).json({ success: true, message: 'Thank you for your feedback!', order });
});

// POST '/wallet/add-money'
export const postWalletAddMoney = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || parseFloat(amount) < 100)
    return res.status(400).json({ success: false, message: 'Minimum top-up is ₹100.' });
  const amountNum = parseFloat(amount);
  if (amountNum > 100000)
    return res.status(400).json({ success: false, message: 'Maximum top-up is ₹1,00,000.' });

  const rzpOrder = await razorpay.orders.create({
    amount:   Math.round(amountNum * 100),
    currency: 'INR',
    receipt:  `TOPUP_${req.user._id}_${Date.now()}`,
  });

  res.status(200).json({ success: true, rzpOrder, razorpayKey: RAZORPAY_KEY_ID });
});

// POST '/wallet/verify-topup'
export const postWalletVerifyTopup = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment verification details.' });
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
    return res.status(400).json({ success: false, message: 'Valid amount is required.' });

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

  if (hmac !== razorpay_signature)
    return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

  const alreadyCredited = await Wallet.findOne({
    user: req.user._id, 'transactions.transactionId': razorpay_payment_id,
  }).lean();
  if (alreadyCredited) return res.status(200).json({ success: true, message: 'Payment already processed.', alreadyProcessed: true });

  let wallet = await Wallet.findOne({ user: req.user._id });
  if (!wallet) wallet = await Wallet.create({ user: req.user._id, balance: 0, createdBy: req.user._id });
  if (!wallet.isActive) return res.status(403).json({ success: false, message: 'Wallet is inactive.' });

  const amountNum = parseFloat(parseFloat(amount).toFixed(2));
  await wallet.credit(amountNum, 'Add_Money', {
    transactionId: razorpay_payment_id,
    description:   `Wallet top-up of ₹${amountNum} via Razorpay`,
    note:          `razorpayOrderId: ${razorpay_order_id}`,
  });

  const updatedWallet = await Wallet.findOne({ user: req.user._id }).lean();

  return res.status(200).json({
    success: true,
    message: `Wallet topped up with ₹${amountNum}.`,
    wallet: {
      balance:             updatedWallet.balance,
      withdrawableBalance: updatedWallet.withdrawableBalance,
      lastTransactionAt:   updatedWallet.lastTransactionAt,
    },
  });
});

// POST '/order/direct'
export const postOrderDirect = asyncHandler(async (req, res) => {
  const {
    medicineId,
    quantity,
    address,
    paymentMethod  = 'Razorpay',
    couponCode,
    prescription,
    deliveryType   = 'Standard',
  } = req.body;
  const preferredStoreId = extractStoreId(req.body.storeId) || null;

  if (!medicineId || !quantity || !address)
    return res.status(400).json({ success: false, message: 'medicineId, quantity, and address are required.' });

  try { validateDeliveryAddress(address); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }

  if (!['Razorpay', 'Wallet', 'COD'].includes(paymentMethod))
    return res.status(400).json({ success: false, message: 'Invalid payment method.' });

  const quantityNum        = parseInt(quantity, 10);
  const resolvedDeliveryType = deliveryType === 'Express' ? 'Express' : 'Standard';

  if (quantityNum < 1)
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });

  const customerUser = await User.findById(req.user._id).select('location').lean();
  let resolvedStore, inventoryEntry, medicine;
  try {
    ({ store: resolvedStore, inventoryEntry, medicine } = await resolveStoreForMedicine(
      medicineId, quantityNum, customerUser, preferredStoreId
    ));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const storeObjId       = resolvedStore._id;
  const storeIdStr       = storeObjId.toString();
  const storeOverridden  = preferredStoreId && preferredStoreId !== storeIdStr;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [platformConfig, { pharmacyDiscountPct, planDoc }] = await Promise.all([
      PlatformPricingConfig.getGlobal(),
      resolveSubscriptionBenefits(req.user._id),
    ]);

    const unitPrice   = Number(inventoryEntry.finalPrice) || Number(inventoryEntry.sellingPrice) || Number(medicine.mrp);
    const gstPct      = Number(medicine.gstPercentage) || 5;

    const orderItem = {
      medicine:               medicine._id,
      name:                   medicine.brandName ?? medicine.genericName ?? 'Medicine',
      brandName:              medicine.brandName,
      genericName:            medicine.genericName,
      medicineImage:          medicine.images?.[0]?.url || null,
      hsnCode:                medicine.hsnCode,
      gstPercentage:          gstPct,
      quantity:               quantityNum,
      pricePerUnit:           unitPrice,
      taxAmount:              0,
      totalPrice:             parseFloat((unitPrice * quantityNum).toFixed(2)),
      isPrescriptionRequired: medicine.isPrescriptionRequired ?? false,
    };

    const { billing, appliedCoupon, deliveryResult } = await buildBilling({
      orderItems:              [orderItem],
      userId:                  req.user._id,
      deliveryType:            resolvedDeliveryType,
      platformConfig,
      subPlanDoc:              planDoc,
      couponCode:              couponCode || null,
      subscriptionDiscountPct: pharmacyDiscountPct,
      session,
    });

    const orderPrescription = medicine.isPrescriptionRequired
      ? {
          isRequired:         true,
          imageUrl:           prescription?.imageUrl ?? null,
          uploadedAt:         prescription?.imageUrl ? new Date() : null,
          verificationStatus: prescription?.imageUrl ? 'Pending' : 'Not_Uploaded',
        }
      : { isRequired: false };

    const order = new PharmacyOrder({
      customer:     req.user._id,
      store:        storeObjId,
      items:        [orderItem],
      prescription: orderPrescription,
      billing,
      delivery: {
        address,
        estimatedArrival: new Date(
          Date.now() +
          (resolvedDeliveryType === 'Express'
            ? (resolvedStore.deliverySettings?.expressEtaMinutes ?? 30)
            : (resolvedStore.deliverySettings?.standardEtaMinutes ?? 120)
          ) * 60 * 1000
        ),
      },
      payment: { method: paymentMethod },
    });
    order.adminNotes.push({
      text:    `Delivery: ${resolvedDeliveryType}. Charge: ₹${billing.deliveryCharges}. Reason: ${deliveryResult.reason}. Platform fee: ₹${billing.platformFee}.`,
      addedAt: new Date(),
    });

    if (paymentMethod === 'COD') {
      await decrementStock([orderItem], storeIdStr, session);
      order.delivery.status = 'Placed';
    }

    if (paymentMethod === 'Wallet') {
      const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
      if (!wallet)          throw new Error('Wallet not found.');
      if (!wallet.isActive) throw new Error('Wallet is inactive.');
      if (wallet.balance < billing.totalPayable)
        throw new Error(`Insufficient wallet balance. Required: ₹${billing.totalPayable}, Available: ₹${wallet.balance}.`);

      const balanceBefore = wallet.balance;
      wallet.balance      = parseFloat((wallet.balance - billing.totalPayable).toFixed(2));
      wallet.transactions.push({
        transactionId: `TXN-${Date.now()}`,
        type:          'Debit',
        amount:        billing.totalPayable,
        purpose:       'Medicine_Purchase',
        referenceId:   order._id,
        onModel:       'PharmacyOrder',
        status:        'Success',
        balanceBefore,
        balanceAfter:  wallet.balance,
        description:   `Direct purchase: ${medicine.brandName} — Order #${order.orderId}`,
      });
      await wallet.save({ session });
      await decrementStock([orderItem], storeIdStr, session);
      order.payment.status  = 'Paid';
      order.payment.paidAt  = new Date();
      order.delivery.status = 'Confirmed';
    }

    if (paymentMethod === 'Razorpay') {
      const rzpOrder = await razorpay.orders.create({
        amount:   Math.round(billing.totalPayable * 100),
        currency: 'INR',
        receipt:  order._id.toString(),
      });
      order.payment.razorpayOrderId = rzpOrder.id;
    }

    await order.save({ session });
    if (appliedCoupon) await commitCouponUsage(appliedCoupon._id, session);
    await session.commitTransaction();

    if (paymentMethod !== 'Razorpay') {
      const headerNote = appliedCoupon ? `Coupon ${appliedCoupon.code} applied!` : '';
      dispatchOrderConfirmationEmail(req.user._id, order.toObject(), resolvedStore.storeName, headerNote);
    }

    res.status(201).json({
      success:           true,
      order,
      razorpayKey:       RAZORPAY_KEY_ID,
      resolvedStoreName: resolvedStore.storeName,
      billing,
      ...(storeOverridden && { notice: `Preferred store had insufficient stock. Order placed from "${resolvedStore.storeName}".` }),
    });
  } catch (err) {
    await session.abortTransaction();
    logError('DIRECT_ORDER_ERROR', err, { userId: req.user._id, medicineId });
    throw err;
  } finally { session.endSession(); }
});

// POST '/order/direct/verify'
export const postOrderDirectVerify = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment verification details.' });

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  if (hmac !== razorpay_signature)
    return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await PharmacyOrder.findOne({
      'payment.razorpayOrderId': razorpay_order_id, customer: req.user._id,
    }).session(session);

    if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }
    if (order.payment?.status === 'Paid') { await session.abortTransaction(); return res.status(200).json({ success: true, message: 'Already paid.', order }); }

    await decrementStock(order.items, order.store.toString(), session);
    order.payment.status            = 'Paid';
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paidAt            = new Date();
    order.delivery.status           = 'Confirmed';
    await order.save({ session });
    await session.commitTransaction();

    const storeDoc = await PharmacyStore.findById(order.store).select('storeName').lean();
    dispatchOrderConfirmationEmail(req.user._id, order.toObject(), storeDoc?.storeName ?? 'Likeson Pharmacy');

    res.status(200).json({ success: true, order });
  } catch (err) {
    await session.abortTransaction();
    logError('DIRECT_PAYMENT_ERROR', err, { userId: req.user._id });
    throw err;
  } finally { session.endSession(); }
});

// POST '/order/verify-delivery-otp'
export const postOrderVerifyDeliveryOtp = asyncHandler(async (req, res) => {
  const { orderId, otp } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!otp)     return res.status(400).json({ success: false, message: 'otp is required.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await findOrderSafe(orderId, {}, session);
    if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }

    const orderWithOtp = await PharmacyOrder.findById(order._id)
      .select('+deliveryOtp.code +deliveryOtp.expiresAt +deliveryOtp.verified')
      .session(session);

    if (!orderWithOtp.deliveryOtp?.code)
      return res.status(400).json({ success: false, message: 'No OTP generated for this order.' });
    if (orderWithOtp.deliveryOtp.verified)
      return res.status(400).json({ success: false, message: 'OTP already used.' });
    if (new Date() > orderWithOtp.deliveryOtp.expiresAt)
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    if (orderWithOtp.deliveryOtp.code !== String(otp))
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    orderWithOtp.deliveryOtp.verified = true;
    orderWithOtp.delivery.status      = 'Delivered';
    orderWithOtp.delivery.deliveredAt = new Date();
    await orderWithOtp.save({ session });
    await session.commitTransaction();

    const storeDoc = await PharmacyStore.findById(orderWithOtp.store).select('storeName').lean();
    dispatchStatusUpdateEmail(orderWithOtp.toObject(), 'Delivered', storeDoc?.storeName);

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed. Order marked as Delivered.',
      order:   orderWithOtp,
    });
  } catch (err) {
    await session.abortTransaction();
    logError('OTP_VERIFY_ERROR', err, { orderId });
    throw err;
  } finally { session.endSession(); }
});

// GET '/delivery/pricing'
export const getDeliveryPricing = asyncHandler(async (req, res) => {
  const { orderTotal, deliveryType = 'Standard' } = req.query;
  const orderTotalNum = parseFloat(orderTotal);
  if (!orderTotal || isNaN(orderTotalNum) || orderTotalNum < 0)
    return res.status(400).json({ success: false, message: 'Valid orderTotal required.' });

  const [platformConfig, { pharmacyDiscountPct, planDoc }] = await Promise.all([
    PlatformPricingConfig.getGlobal(),
    resolveSubscriptionBenefits(req.user._id),
  ]);

  const standardResult = await resolveDeliveryCharge({
    userId:       req.user._id,
    orderTotal:   orderTotalNum,
    deliveryType: 'Standard',
    platformConfig,
    subPlan:      planDoc,
  });

  const expressResult = await resolveDeliveryCharge({
    userId:       req.user._id,
    orderTotal:   orderTotalNum,
    deliveryType: 'Express',
    platformConfig,
    subPlan:      planDoc,
  });

  const freeMinOrderValue = platformConfig?.pharmacy?.freeDeliveryMinOrderValue ?? 200;
  const amountNeededForFree = Math.max(0, freeMinOrderValue - orderTotalNum);

  res.status(200).json({
    success: true,
    orderTotal: orderTotalNum,
    platformFee: PLATFORM_FEE_FLAT,
    delivery: {
      standard: {
        charge:  standardResult.charge,
        isFree:  standardResult.isFree,
        reason:  standardResult.reason,
        etaInfo: 'Delivery within 2–4 hours (store dependent)',
      },
      express: {
        charge:  expressResult.charge,
        isFree:  expressResult.isFree,
        reason:  expressResult.reason,
        etaInfo: 'Express delivery in 30–60 minutes',
      },
    },
    subscriptionBenefit: {
      active:      planDoc !== null,
      freeDelivery: planDoc ? (planDoc.pharmacy?.deliveryChargePerOrder == null || planDoc.pharmacy?.deliveryChargePerOrder === 0) : false,
    },
    freeDeliveryThreshold: freeMinOrderValue,
    amountNeededForFree:   planDoc ? 0 : amountNeededForFree,
  });
});

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  logError('UNHANDLED_ERROR', err, { path: req.originalUrl, method: req.method });

  syslog('error', 'api', `Unhandled router error: ${err.message}`, {
    actor:    req.user ? actorFromReq(req) : { role: 'anonymous', ip: req.ip },
    request:  { method: req.method, path: req.originalUrl, statusCode },
    metadata: { stack: err.stack?.slice(0, 500) },
  });

  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB.' });
  if (err.message?.includes('Only JPEG'))
    return res.status(400).json({ success: false, message: err.message });
  if (err.name === 'ValidationError')
    return res.status(400).json({ success: false, message: 'Validation error', errors: Object.values(err.errors).map((e) => e.message) });
  if (err.code === 11000)
    return res.status(400).json({ success: false, message: 'Duplicate entry', field: Object.keys(err.keyValue)[0] });
  if (err.name === 'JsonWebTokenError')
    return res.status(401).json({ success: false, message: 'Invalid token' });
  if (err.name === 'TokenExpiredError')
    return res.status(401).json({ success: false, message: 'Token expired' });

  res.status(statusCode).json({ success: false, message: err.message || 'Internal Server Error' });
};
