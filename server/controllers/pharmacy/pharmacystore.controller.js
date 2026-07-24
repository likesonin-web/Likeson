import mongoose         from 'mongoose';
import Razorpay         from 'razorpay';
import multer           from 'multer';
import axios            from 'axios';
import FormData         from 'form-data';
import xlsx             from 'xlsx';
import * as pdfParse from 'pdf-parse';

import { protect, authorize, attachPharmacyStore } from '../../middleware/authMiddleware.js';
import PharmacyOrder       from '../../models/PharmacyOrder.js';
import PharmacyProfile     from '../../models/PharmacyProfile.js';
import PharmacyStore       from '../../models/PharmacyStore.js';
import HsnCode             from '../../models/HsnCode.js';
import Medicine            from '../../models/Medicine.js';
import MedicineInventory   from '../../models/MedicineInventory.js';
import MedicineBatch       from '../../models/MedicineBatch.js';
import InventoryMovement   from '../../models/InventoryMovement.js';
import PurchaseOrder       from '../../models/PurchaseOrder.js';
import Supplier            from '../../models/Supplier.js';
import PlatformPricingConfig from '../../models/PlatformPricingConfig.js';
import User             from '../../models/User.js';
import Notification     from '../../models/Notification.js';
import Wallet           from '../../models/Wallet.js';
import PaymentAccount   from '../../models/PaymentAccount.js';
import SystemLog        from '../../models/SystemLog.js';
import sendEmail        from '../../utils/sendEmail.js';
import { generateDeliveryLabel } from '../../utils/deliveryLabel.utils.js';
import redisClient      from '../../config/redis.js';
import {
  buildStatusUpdateEmail,
  buildDeliveryOtpEmail,
  buildInvoiceHtml,
  buildRefundEmail,
  transactionalTemplate,
  buildStoreInvoiceHtml,
  buildLowStockAlertEmail,
  buildBatchExpiryAlertEmail,
  buildSettlementEmail,
} from '../../utils/emailTemplates.js';


// ═══════════════════════════════════════════════════════════════════════════════
// § RAZORPAY
// ═══════════════════════════════════════════════════════════════════════════════

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ═══════════════════════════════════════════════════════════════════════════════
// § CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ITEMS_PER_PAGE      = 20;
const MAX_ITEMS_PER_PAGE  = 100;
const LOW_STOCK_THRESHOLD = 5;
const EXPIRY_ALERT_DAYS   = 30;
const MAX_FILE_SIZE_MB    = 20;
const MAX_FILE_BYTES      = MAX_FILE_SIZE_MB * 1024 * 1024;
const VALID_GST_SLABS     = [0, 5, 12, 18, 28];

const IMAGEKIT = {
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  id:          process.env.IMAGEKITID,
  uploadUrl:   'https://upload.imagekit.io/api/v1/files/upload',
  folder:      '/likeson/hsn-uploads',
};

const HSN_COLUMN_ALIASES = {
  hsnCode:        ['hsn code', 'hsncode', 'hsn', 'code', 'hsn_code'],
  description:    ['description', 'desc', 'product description', 'item description'],
  chapterHeading: ['chapter heading', 'chapter', 'heading', 'chapter_heading'],
  gstPercentage:  ['gst %', 'gst%', 'gst percentage', 'tax %', 'rate', 'igst %', 'gst rate', 'tax rate'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// § MULTER
// ═══════════════════════════════════════════════════════════════════════════════

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`❌ [${req.method} ${req.path}] ${err.message}`);
    next(err);
  });

const logAudit = (action, meta = {}) =>
  console.log(`[AUDIT][${new Date().toISOString()}] ${action}`, meta);

const logError = (action, err, ctx = {}) =>
  console.error(`[ERROR][${new Date().toISOString()}] ${action}: ${err.message}`, { stack: err.stack, ctx });

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const findOrderByIdOrString = async (orderId, storeId) => {
  if (!orderId) return null;
  const base    = { store: new mongoose.Types.ObjectId(storeId), isArchived: false };
  const isValid = mongoose.Types.ObjectId.isValid(orderId);
  try {
    if (!isValid) return await PharmacyOrder.findOne({ ...base, orderId });
    const byId = await PharmacyOrder.findOne({ ...base, _id: new mongoose.Types.ObjectId(orderId) });
    return byId || await PharmacyOrder.findOne({ ...base, orderId });
  } catch (err) {
    logError('FIND_ORDER_ERROR', err, { orderId });
    return null;
  }
};

const findOrderPopulated = async (orderId, storeId) => {
  if (!orderId) return null;
  const base    = { store: new mongoose.Types.ObjectId(storeId), isArchived: false };
  const isValid = mongoose.Types.ObjectId.isValid(orderId);

  const buildQuery = (filter) =>
    PharmacyOrder.findOne(filter)
      .populate('customer',                      'name email phone avatar')
      .populate('delivery.internalPartner',      'name phone avatar')
      .populate('delivery.pickupPartner',        'name phone avatar')
      .populate('prescription.verifiedBy',       'name role')
      .populate('items.medicine',                'name brandName genericName images hsnCode gstPercentage category')
      .populate('cancellation.cancelledBy',      'name role')
      .populate('cancellation.returnDecisionBy', 'name role')
      .populate('cancellation.pickupVerifiedBy', 'name role')
      .populate('adminNotes.addedBy',            'name role')
      .populate('store',                         'storeName contact address legal status storeType bankDetails');

  try {
    let order = null;
    if (isValid) {
      order = await buildQuery({ ...base, _id: new mongoose.Types.ObjectId(orderId) });
    }
    if (!order) {
      order = await buildQuery({ ...base, orderId });
    }
    return order;
  } catch (err) {
    logError('FIND_ORDER_POPULATED_ERROR', err, { orderId });
    return null;
  }
};

const parseDateFilter = (dateFilter, startDate, endDate) => {
  const now   = new Date();
  const start = new Date(now);
  const end   = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (dateFilter === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (dateFilter === 'yesterday') {
    start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);     end.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'last7days') {
    start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
  } else if (dateFilter === 'last30days') {
    start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0);
  } else if (dateFilter === 'custom' && startDate && endDate) {
    return { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  return { $gte: start, $lte: end };
};

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page, 10)  || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || ITEMS_PER_PAGE), MAX_ITEMS_PER_PAGE);
  return { page, limit, skip: (page - 1) * limit };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § PRICING CALCULATOR (platform + store margin per order)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * computeOrderPricingBreakdown
 * Returns full financial breakdown for one order:
 *   - What customer paid (billing fields)
 *   - Platform fee (from PlatformPricingConfig)
 *   - Store margin / net payout
 *   - COD: how much store must remit to platform
 *
 * Owned stores: use ownStoreMarginPercent (100% revenue stays, platform takes fee)
 * Partnered stores: use commissionPercent from store's bankDetails
 */
const computeOrderPricingBreakdown = async (order, store) => {
  const config = await PlatformPricingConfig.getGlobal();
  const pharmacyCfg = config?.pharmacy || {};

  const platformFee      = pharmacyCfg.platformFee || { type: 'percentage', value: 10 };
  const ownStoreMarginPc = pharmacyCfg.ownStoreMarginPercent || 30; // platform keeps 30% on own stores
  const partnerCommPc    = store?.bankDetails?.commissionPercent || 0;

  const total      = order.billing?.totalPayable   || 0;
  const subTotal   = order.billing?.subTotal        || 0;
  const gst        = order.billing?.gstAmount       || 0;
  const delivery   = order.billing?.deliveryCharges || 0;
  const discount   = order.billing?.discountAmount  || 0;
  const walletUsed = order.billing?.walletAmountUsed|| 0;
  const platformFeeAmt   = order.billing?.platformFee || 0; // snapshot from order creation

  // Platform cut on this order
  let platformCut = 0;
  if (platformFee.type === 'percentage') {
    platformCut = parseFloat(((subTotal * platformFee.value) / 100).toFixed(2));
  } else {
    platformCut = platformFee.value;
  }

  // Store type determines margin logic
  const isOwnedStore = store?.storeType === 'Owned';
  let storePayout   = 0;
  let storeMarginPc = 0;
  let platformRevenue = 0;

  if (isOwnedStore) {
    // Owned: platform keeps ownStoreMarginPercent of subTotal, store gets rest
    platformRevenue = parseFloat(((subTotal * ownStoreMarginPc) / 100).toFixed(2));
    storePayout     = parseFloat((subTotal - platformRevenue).toFixed(2));
    storeMarginPc   = 100 - ownStoreMarginPc;
  } else {
    // Partnered: store pays commissionPercent to platform
    platformRevenue = parseFloat(((subTotal * partnerCommPc) / 100).toFixed(2));
    storePayout     = parseFloat((subTotal - platformRevenue).toFixed(2));
    storeMarginPc   = 100 - partnerCommPc;
  }

  // Delivery agent payout (from config)
  const deliveryAgentPayout = delivery > 0
    ? Math.min(delivery, pharmacyCfg.deliveryAgentPayout || 30)
    : 0;

  // COD: store physically collects cash from customer
  // Store must remit: platformRevenue + GST (platform handles GST accounting)
  const isCOD      = order.payment?.method === 'COD';
  const codRemitTo  = isCOD ? parseFloat((platformRevenue + gst).toFixed(2)) : 0;
  const codStoreNet = isCOD ? parseFloat((storePayout - deliveryAgentPayout).toFixed(2)) : 0;

  // Online: platform collects, pays out to store
  const onlineStoreNet = !isCOD
    ? parseFloat((storePayout - deliveryAgentPayout).toFixed(2))
    : 0;

  return {
    order: {
      orderId:            order.orderId,
      paymentMethod:      order.payment?.method,
      paymentStatus:      order.payment?.status,
      deliveryStatus:     order.delivery?.status,
    },
    customerPaid: {
      subTotal,
      gst,
      deliveryCharges:    delivery,
      discountDeducted:   discount,
      walletDeducted:     walletUsed,
      totalPayable:       total,
    },
    platformConfig: {
      feeType:            platformFee.type,
      feeValue:           platformFee.value,
      storeType:          store?.storeType,
      commissionPercent:  isOwnedStore ? ownStoreMarginPc : partnerCommPc,
      ownStoreMarginPc:   isOwnedStore ? ownStoreMarginPc : null,
    },
    breakdown: {
      platformRevenue,
      platformFeeAmt,      // as stored on order at creation time
      storePayout,
      storeMarginPercent:  storeMarginPc,
      deliveryAgentPayout,
      gstOnOrder:         gst,
    },
    cod: isCOD ? {
      storeCollectedCash: total,
      mustRemitToPlatform: codRemitTo,
      storeNetAfterRemit:  codStoreNet,
      remitBreakdown: {
        platformRevenue,
        gstPayable: gst,
      },
    } : null,
    online: !isCOD ? {
      platformCollected: total,
      storeNetPayout:    onlineStoreNet,
      estimatedPayoutAfterCycle: onlineStoreNet,
    } : null,
    pricingConfigSnapshot: {
      configName:          config?.configName,
      pharmacyPlatformFee: pharmacyCfg.platformFee,
      freeDeliveryAbove:   pharmacyCfg.freeDeliveryMinOrderValue,
      expressDeliveryCharge: pharmacyCfg.expressDeliveryCharge,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § REDIS CACHE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

const cache = (ttlSeconds = 60, keyFn = null) => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const cacheKey = keyFn ? keyFn(req) : `${req.method}:${req.originalUrl}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(JSON.parse(cached)); }
  } catch (err) { console.error('[Cache READ]', err.message); }

  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try { await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(body)); }
      catch (err) { console.error('[Cache WRITE]', err.message); }
    }
    res.setHeader('X-Cache', 'MISS');
    return originalJson(body);
  };
  next();
};

const invalidateStoreCache = async (storeId) => {
  try {
    const keys = await redisClient.keys(`pharmacy:${storeId}:*`);
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) { console.error('[Cache INVALIDATE store]', err.message); }
};

const invalidateHsnCache = async () => {
  try {
    const keys = await redisClient.keys('GET:*hsn*');
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) { console.error('[Cache INVALIDATE hsn]', err.message); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SYSTEM LOG HELPER
// ═══════════════════════════════════════════════════════════════════════════════

const sysLog = async (req, {
  level      = 'info',
  category   = 'system',
  message,
  details,
  relatedEntity,
  metadata,
  statusCode,
  durationMs,
}) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';

    await SystemLog.createLog({
      level,
      category,
      message,
      details,
      actor: {
        userId:    req.user?._id    || null,
        name:      req.user?.name   || 'system',
        email:     req.user?.email  || null,
        role:      req.user?.role   || 'system',
        ip,
        userAgent: req.headers['user-agent'] || null,
        platform:  'web',
      },
      relatedEntity: relatedEntity || {},
      request: {
        method:     req.method,
        path:       req.originalUrl,
        statusCode: statusCode || null,
        durationMs: durationMs || null,
      },
      metadata,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    });
  } catch (err) {
    console.error('[SystemLog.createLog failed]', err.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § NOTIFICATION + EMAIL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchStatusNotification = async (order, newStatus, storeName = null) => {
  try {
    const customer = await User.findById(order.customer).select('email name').lean();
    if (!customer) return;
    await Notification.create({
      recipient:  order.customer,
      title:      'Order Status Updated',
      body:       `Your order #${order.orderId} is now: ${newStatus}`,
      type:       'Order_Update',
      priority:   'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id },
    });
    if (customer.email) {
      const html = buildStatusUpdateEmail({
        userName: customer.name, order, orderItems: order.items || [],
        billing: order.billing, storeName,
        actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}`,
        newStatus,
      });
      await sendEmail({
        email:   customer.email,
        subject: `[Likeson Healthcare] Order #${order.orderId} — ${newStatus.replace(/_/g, ' ')}`,
        html,
      });
    }
  } catch (err) { logError('STATUS_NOTIFICATION_ERROR', err, { orderId: order.orderId }); }
};

const dispatchSimpleNotification = async (userId, { title, body, type, emailSubject, emailBody, actionLink }) => {
  try {
    await Notification.create({
      recipient: userId, title, body, type, priority: 'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN' },
    });
    const user = await User.findById(userId).select('email name').lean();
    if (!user?.email) return;
    const html = transactionalTemplate({
      header: 'LIKESON HEALTHCARE', title: emailSubject || title,
      body: emailBody || body, buttonText: 'View Details',
      buttonLink: actionLink || 'https://likeson.in/dashboard', userName: user.name,
    });
    await sendEmail({ email: user.email, subject: `[Likeson Healthcare] ${emailSubject || title}`, html });
  } catch (err) { logError('SIMPLE_NOTIFICATION_ERROR', err, { userId }); }
};

const dispatchLowStockAlert = async (medicine, storeId, stockQuantity, pharmacyUserId) => {
  try {
    const [pharmacyUser, store] = await Promise.all([
      User.findById(pharmacyUserId).select('email name').lean(),
      PharmacyStore.findById(storeId).select('storeName').lean(),
    ]);
    if (!pharmacyUser) return;

    await Notification.create({
      recipient: pharmacyUserId,
      title:     '🔴 Low Stock Alert',
      body:      `${medicine.brandName || medicine.name} is critically low (${stockQuantity} units) at ${store?.storeName || 'your store'}. Please restock immediately.`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { medicineId: medicine._id, storeId, stockQuantity },
    });

    if (pharmacyUser.email) {
      const html = buildLowStockAlertEmail({
        userName:  pharmacyUser.name,
        storeName: store?.storeName || 'Your Store',
        items: [{
          name:          medicine.brandName || medicine.name,
          brandName:     medicine.brandName,
          category:      medicine.category,
          stockQuantity,
          threshold:     LOW_STOCK_THRESHOLD,
        }],
        threshold: LOW_STOCK_THRESHOLD,
      });
      sendEmail({
        email:   pharmacyUser.email,
        subject: `[Likeson Healthcare] 🔴 Low Stock: ${medicine.brandName || medicine.name} — Restock Required`,
        html,
      }).catch((err) => logError('LOW_STOCK_EMAIL_ERROR', err));
    }
  } catch (err) { logError('LOW_STOCK_ALERT_ERROR', err, { medicineId: medicine._id, storeId }); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HSN PARSE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const normalizeHsnRow = (raw) => {
  const lower = {};
  for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase().trim()] = String(v ?? '').trim();
  const get = (aliases) => { for (const a of aliases) { if (lower[a] !== undefined && lower[a] !== '') return lower[a]; } return ''; };
  const gstRaw = get(HSN_COLUMN_ALIASES.gstPercentage);
  const gstNum = parseFloat(gstRaw.replace('%', '').trim());
  return {
    hsnCode:        get(HSN_COLUMN_ALIASES.hsnCode).toUpperCase().replace(/\s/g, ''),
    description:    get(HSN_COLUMN_ALIASES.description),
    chapterHeading: get(HSN_COLUMN_ALIASES.chapterHeading),
    gstPercentage:  isNaN(gstNum) ? null : gstNum,
  };
};

const parseExcelBuffer = (buffer) => {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sn = wb.SheetNames[0];
  if (!sn) throw new Error('Excel file contains no sheets.');
  return xlsx.utils.sheet_to_json(wb.Sheets[sn], { defval: '', raw: true, blankrows: false });
};

const parsePdfBuffer = async (buffer) => {
  const data  = await pdfParse(buffer);
  const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows  = [];
  for (const line of lines) {
    const match = line.match(/^(\d{4,8})\s{1,10}(.+?)\s{1,10}(Chapter\s+\d+[^0-9]*)?\s{0,10}(\d{1,2})\s*%?$/i);
    if (match) rows.push({ 'HSN Code': match[1].trim(), Description: match[2].trim(), 'Chapter Heading': match[3]?.trim() || '', 'GST %': match[4].trim() });
  }
  if (!rows.length) throw new Error('Could not extract HSN rows from the PDF. Use the Excel template.');
  return rows;
};

const uploadToImageKit = async (buffer, fileName, folder = IMAGEKIT.folder) => {
  const formData = new FormData();
  formData.append('file',             buffer, { filename: fileName });
  formData.append('fileName',         fileName);
  formData.append('folder',           folder);
  formData.append('useUniqueFileName', 'true');

  const auth = Buffer.from(`${IMAGEKIT.privateKey}:`).toString('base64');

  const response = await axios.post(IMAGEKIT.uploadUrl, formData, {
    headers: {
      ...formData.getHeaders(),
      Authorization: `Basic ${auth}`,
    },
    maxBodyLength: MAX_FILE_BYTES + 1024,
    timeout:       30_000,
  });

  return response.data;
};

const upsertHsnRows = async (rows, userId, source = 'manual') => {
  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];
  for (const raw of rows) {
    const row = normalizeHsnRow(raw);
    if (!row.hsnCode) { errors.push(`Skipped — missing HSN code: ${JSON.stringify(raw)}`); skipped++; continue; }
    if (!/^\d{4,8}$/.test(row.hsnCode)) { errors.push(`Skipped — invalid HSN format: ${row.hsnCode}`); skipped++; continue; }
    if (row.gstPercentage === null || !VALID_GST_SLABS.includes(row.gstPercentage)) {
      errors.push(`Skipped — invalid GST slab for ${row.hsnCode}: ${row.gstPercentage}. Allowed: ${VALID_GST_SLABS.join(', ')}`);
      skipped++; continue;
    }
    if (!row.description) { errors.push(`Skipped — missing description for: ${row.hsnCode}`); skipped++; continue; }
    try {
      const ex = await HsnCode.findOne({ hsnCode: row.hsnCode });
      if (ex) {
        ex.description    = row.description    || ex.description;
        ex.chapterHeading = row.chapterHeading || ex.chapterHeading;
        ex.gstPercentage  = row.gstPercentage;
        ex.uploadedBy     = userId;
        ex.uploadSource   = source;
        ex.isActive       = true;
        await ex.save();
        updated++;
      } else {
        await HsnCode.create({ hsnCode: row.hsnCode, description: row.description, chapterHeading: row.chapterHeading, gstPercentage: row.gstPercentage, uploadedBy: userId, uploadSource: source, isActive: true });
        inserted++;
      }
    } catch (err) {
      errors.push(err.code === 11000 ? `Duplicate skip: ${row.hsnCode}` : `Error on ${row.hsnCode}: ${err.message}`);
    }
  }
  return { inserted, updated, skipped, errors };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION C — HSN CODE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════


// GET '/hsn'
export const getHsn = asyncHandler(async (req, res) => {
    const { search, gst, isActive = 'true', page = 1, limit = 20, sort = 'hsnCode' } = req.query;
    const query = {};
    if (isActive !== 'all') query.isActive = isActive !== 'false';
    if (gst) { const g = parseFloat(gst); if (VALID_GST_SLABS.includes(g)) query.gstPercentage = g; }
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ hsnCode: { $regex: esc, $options: 'i' } }, { description: { $regex: esc, $options: 'i' } }];
    }
    const sortMap = { hsnCode: { hsnCode: 1 }, hsnCode_desc: { hsnCode: -1 }, gst_asc: { gstPercentage: 1 }, newest: { createdAt: -1 } };
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const [codes, total] = await Promise.all([
      HsnCode.find(query).sort(sortMap[sort] || { hsnCode: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      HsnCode.countDocuments(query),
    ]);
    res.status(200).json({ success: true, total, metadata: { currentPage: pageNum, totalPages: Math.ceil(total / limitNum), pageSize: limitNum }, data: codes });
  });

// GET '/hsn/stats'
export const getHsnStats = asyncHandler(async (req, res) => {
    const stats = await HsnCode.aggregate([{ $facet: {
      gstDistribution:  [{ $group: { _id: '$gstPercentage', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      sourceBreakdown:  [{ $group: { _id: '$uploadSource', count: { $sum: 1 } } }],
      activeVsInactive: [{ $group: { _id: '$isActive', count: { $sum: 1 } } }],
      totals:           [{ $group: { _id: null, total: { $sum: 1 } } }],
    }}]);
    res.status(200).json({ success: true, data: stats[0], generatedAt: new Date() });
  });

// POST '/hsn/bulk-delete'
export const postHsnBulkDelete = asyncHandler(async (req, res) => {
    const { codes } = req.body;
    if (!Array.isArray(codes) || !codes.length) return res.status(400).json({ success: false, message: 'Provide a non-empty array of HSN codes.' });
    const normalized = codes.map((c) => String(c).toUpperCase().replace(/\s/g, '').trim());
    const result = await HsnCode.updateMany({ hsnCode: { $in: normalized }, isActive: true }, { $set: { isActive: false } });
    await invalidateHsnCache();
    await sysLog(req, { level: 'warning', category: 'system', message: `Bulk deactivated ${result.modifiedCount} HSN codes`, metadata: { codes: normalized } });
    res.status(200).json({ success: true, message: `${result.modifiedCount} HSN code(s) deactivated.`, matched: result.matchedCount, deactivated: result.modifiedCount });
  });

// POST '/hsn/upload'
export const postHsnUpload = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded. Send multipart/form-data with field "file".' });
    const { buffer, originalname, mimetype, size } = req.file;
    const ext = (originalname.split('.').pop() || '').toLowerCase();

    let ikResult;
    try {
      const safeName = `${originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}_${Date.now()}.${ext}`;
      ikResult = await uploadToImageKit(buffer, safeName);
    } catch (err) {
      logError('HSN_IK_UPLOAD', err);
      return res.status(502).json({ success: false, message: 'ImageKit upload failed. Try again.', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }

    let rows, source;
    const isExcel = ['xlsx','xls','csv'].includes(ext) || mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype === 'text/csv';
    const isPdf   = ext === 'pdf' || mimetype === 'application/pdf';
    try {
      if (isExcel)      { rows = parseExcelBuffer(buffer); source = 'excel'; }
      else if (isPdf)   { rows = await parsePdfBuffer(buffer); source = 'pdf'; }
      else { try { rows = parseExcelBuffer(buffer); source = 'excel'; } catch { return res.status(415).json({ success: false, message: `Unsupported type: ${mimetype || ext}`, imagekitUrl: ikResult.url }); } }
    } catch (err) { return res.status(422).json({ success: false, message: `Parse failed: ${err.message}`, imagekitUrl: ikResult.url }); }
    if (!rows?.length) return res.status(422).json({ success: false, message: 'No data rows found.', imagekitUrl: ikResult.url });

    const result = await upsertHsnRows(rows, req.user._id, source);
    await invalidateHsnCache();
    await sysLog(req, {
      level: 'success', category: 'system',
      message: `HSN bulk upload: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`,
      metadata: { source, file: originalname, size, imagekitUrl: ikResult.url, ...result },
    });
    const hasErrors = result.errors.length > 0;
    res.status(hasErrors ? 207 : 200).json({
      success: true,
      message: hasErrors ? 'Upload completed with some row errors.' : 'Upload successful.',
      upload:  { imagekitUrl: ikResult.url, imagekitFileId: ikResult.fileId, originalName: originalname, source },
      result:  { ...result, errors: result.errors.slice(0, 50) },
    });
  });

// GET '/hsn/:code'
export const getHsnByCode = asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, message: 'Invalid HSN code format. Must be 4–8 digits.' });
    const hsn = await HsnCode.findOne({ hsnCode: code, isActive: true }).lean();
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found or inactive.` });
    res.status(200).json({ success: true, data: { _id: hsn._id, hsnCode: hsn.hsnCode, description: hsn.description, chapterHeading: hsn.chapterHeading, gstPercentage: hsn.gstPercentage, cgstPercentage: hsn.cgstPercentage, sgstPercentage: hsn.sgstPercentage, igstPercentage: hsn.igstPercentage } });
  });

// POST '/hsn'
export const postHsn = asyncHandler(async (req, res) => {
    const { hsnCode, description, chapterHeading, gstPercentage } = req.body;
    if (!hsnCode || !description || gstPercentage === undefined) return res.status(400).json({ success: false, message: 'hsnCode, description, and gstPercentage are required.' });
    const code   = String(hsnCode).toUpperCase().replace(/\s/g, '').trim();
    if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, message: 'hsnCode must be 4–8 digits.' });
    const gstNum = parseFloat(gstPercentage);
    if (!VALID_GST_SLABS.includes(gstNum)) return res.status(400).json({ success: false, message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}` });
    const existing = await HsnCode.findOne({ hsnCode: code });
    if (existing) return res.status(409).json({ success: false, message: `HSN code '${code}' already exists.`, existingId: existing._id });
    const hsn = await HsnCode.create({ hsnCode: code, description: String(description).trim(), chapterHeading: chapterHeading?.trim(), gstPercentage: gstNum, uploadedBy: req.user._id, uploadSource: 'manual' });
    await invalidateHsnCache();
    await sysLog(req, { level: 'success', category: 'system', message: `HSN code ${code} created`, metadata: { gstPercentage: gstNum } });
    res.status(201).json({ success: true, data: hsn });
  });

// PATCH '/hsn/:code'
export const patchHsnByCode = asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const hsn  = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found.` });
    const { description, chapterHeading, gstPercentage, isActive } = req.body;
    if (description    !== undefined) hsn.description    = String(description).trim();
    if (chapterHeading !== undefined) hsn.chapterHeading = String(chapterHeading).trim();
    if (isActive       !== undefined) hsn.isActive       = Boolean(isActive);
    if (gstPercentage  !== undefined) {
      const g = parseFloat(gstPercentage);
      if (!VALID_GST_SLABS.includes(g)) return res.status(400).json({ success: false, message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}` });
      hsn.gstPercentage = g;
    }
    hsn.uploadedBy = req.user._id; hsn.uploadSource = 'manual';
    await hsn.save();
    await invalidateHsnCache();
    await sysLog(req, { level: 'info', category: 'system', message: `HSN code ${code} updated` });
    res.status(200).json({ success: true, data: hsn });
  });

// DELETE '/hsn/:code'
export const deleteHsnByCode = asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const hsn  = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found.` });
    if (!hsn.isActive) return res.status(409).json({ success: false, message: `HSN code '${code}' is already inactive.` });
    hsn.isActive = false;
    await hsn.save();
    await invalidateHsnCache();
    await sysLog(req, { level: 'warning', category: 'system', message: `HSN code ${code} deactivated` });
    res.status(200).json({ success: true, message: `HSN code '${code}' has been deactivated.` });
  });

// GET '/orders'
export const getOrders = asyncHandler(async (req, res) => {
    const { status, dateFilter = 'today', startDate, endDate, paymentStatus, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    
    // Ensure store ID is strictly matched
    const filter = { store: req.pharmacy.store._id, isArchived: false };
    if (status)        filter['delivery.status'] = status;
    if (paymentStatus) filter['payment.status']  = paymentStatus;
    filter.createdAt = parseDateFilter(dateFilter, startDate, endDate);
    
    const allowedSort = ['createdAt', 'updatedAt', 'billing.totalPayable'];
    const sortField   = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    
    const [orders, totalCount] = await Promise.all([
      PharmacyOrder.find(filter)
        // ✅ Populating dependencies for virtuals AND extra relations
        .populate('store', 'storeName contact address status storeType isOnline timings operationalCapacity deliverySettings')
        .populate('customer', 'name email phone avatar location')
        .populate('delivery.internalPartner', 'name phone')
        .populate('prescription.verifiedBy', 'name role')
        .populate('items.medicine', 'name brandName genericName images category dosage packaging isPrescriptionRequired hsnCode gstPercentage')
        .sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      PharmacyOrder.countDocuments(filter),
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount, itemsPerPage: limit },
      },
    });
  });

// GET '/orders/:orderId'
export const getOrdersByOrderId = asyncHandler(async (req, res) => {
    const order = await findOrderPopulated(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: `Order ${req.params.orderId} not found.` });
    res.status(200).json({ success: true, data: { order: order.toObject({ virtuals: true }) } });
  });

// GET '/orders/:orderId/pricing-breakdown'
export const getOrdersByOrderIdPricingBreakdown = asyncHandler(async (req, res) => {
    const order = await findOrderPopulated(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const store = await PharmacyStore.findById(req.pharmacy.store._id).lean();
    const breakdown = await computeOrderPricingBreakdown(order.toObject({ virtuals: true }), store);

    res.status(200).json({ success: true, data: breakdown });
  });

// POST '/orders/:orderId/verify-prescription'
export const postOrdersByOrderIdVerifyPrescription = asyncHandler(async (req, res) => {
    const { isVerified, verificationNotes = '', rejectionReason = '' } = req.body;
    if (typeof isVerified !== 'boolean') return res.status(400).json({ success: false, message: 'isVerified must be boolean.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    order.prescription.isVerified          = isVerified;
    order.prescription.verificationStatus  = isVerified ? 'Approved' : 'Rejected';
    order.prescription.verificationNotes   = verificationNotes;
    order.prescription.rejectionReason     = rejectionReason;
    order.prescription.verifiedBy          = req.user._id;
    order.prescription.verifiedAt          = new Date();
    await order.save();
    await sysLog(req, {
      level: isVerified ? 'success' : 'warning', category: 'user',
      message: `Prescription ${isVerified ? 'approved' : 'rejected'} for order ${order.orderId}`,
      relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId },
    });
    dispatchSimpleNotification(order.customer, {
      title:        isVerified ? 'Prescription Approved' : 'Prescription Rejected',
      body:         isVerified ? `Your prescription for #${order.orderId} has been approved.` : `Prescription for #${order.orderId} was rejected. ${rejectionReason || ''}`,
      type:         'Prescription_Update',
      emailSubject: isVerified ? 'Prescription Approved' : 'Prescription Rejected',
      emailBody:    isVerified ? `Your prescription for #${order.orderId} has been verified.` : `Your prescription for #${order.orderId} was rejected. Please re-upload.`,
      actionLink:   `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}`,
    });
    res.status(200).json({ success: true, message: isVerified ? 'Prescription approved.' : 'Prescription rejected.', data: { order: order.toObject({ virtuals: true }) } });
  });

// POST '/orders/:orderId/confirm'
export const postOrdersByOrderIdConfirm = asyncHandler(async (req, res) => {
    const { deliveryType, internalPartner, externalPartner } = req.body;
    if (!['Internal', 'Third-Party'].includes(deliveryType)) return res.status(400).json({ success: false, message: 'Invalid deliveryType.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.delivery.status !== 'Placed') return res.status(400).json({ success: false, message: 'Order must be in Placed status.' });
    order.delivery.status       = 'Confirmed';
    order.delivery.deliveryType = deliveryType;
    if (deliveryType === 'Internal'     && internalPartner) order.delivery.internalPartner = internalPartner;
    if (deliveryType === 'Third-Party'  && externalPartner) order.delivery.externalPartner = externalPartner;
    await order.save();
    logAudit('ORDER_CONFIRMED', { orderId: order.orderId, staffId: req.user._id });
    await sysLog(req, { level: 'success', category: 'user', message: `Order ${order.orderId} confirmed`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId } });
    const storeDoc = await PharmacyStore.findById(req.pharmacy.store._id).select('storeName').lean();
    dispatchStatusNotification(order.toObject({ virtuals: true }), 'Confirmed', storeDoc?.storeName);
    res.status(200).json({ success: true, message: 'Order confirmed.', data: { order: order.toObject({ virtuals: true }) } });
  });

// PATCH '/orders/:orderId/status'
export const patchOrdersByOrderIdStatus = asyncHandler(async (req, res) => {
    const { status, note, estimatedArrival } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const validTransitions = {
      Placed:             ['Confirmed', 'Cancelled'],
      Confirmed:          ['Processing', 'Cancelled'],
      Processing:         ['Out-for-Delivery', 'Cancelled'],
      'Out-for-Delivery': ['Delivered', 'Cancelled'],
      Delivered:          ['Return_Requested'],
      Return_Requested:   ['Return_Accepted', 'Return_Rejected'],
      Return_Accepted:    ['Pickup_Assigned'],
      Pickup_Assigned:    ['Pickup_Done'],
      Pickup_Done:        ['Returned'],
    };

    const currentStatus = order.delivery.status;
    if (!validTransitions[currentStatus]?.includes(status))
      return res.status(400).json({ success: false, message: `Cannot transition from ${currentStatus} to ${status}.` });

    order.delivery.status = status;

    if (!Array.isArray(order.delivery.statusHistory)) order.delivery.statusHistory = [];
    order.delivery.statusHistory.push({
      status,
      changedBy: req.user._id,
      note:      note || undefined,
      timestamp: new Date(),
    });

    if (estimatedArrival && status === 'Out-for-Delivery') {
      order.delivery.estimatedArrival = new Date(estimatedArrival);
    }
    if (status === 'Delivered') {
      order.delivery.deliveredAt = new Date();
    }
    if (status === 'Out-for-Delivery') {
      const otpCode = generateOtp();
      order.deliveryOtp = { code: otpCode, expiresAt: new Date(Date.now() + 30 * 60 * 1000), verified: false, sentAt: new Date() };
      const customer = await User.findById(order.customer).select('email name').lean();
      if (customer?.email) {
        const otpHtml = buildDeliveryOtpEmail({ userName: customer.name, order: order.toObject(), otpCode });
        sendEmail({ email: customer.email, subject: `[Likeson Healthcare] Delivery OTP for Order #${order.orderId}`, html: otpHtml })
          .catch((err) => logError('OTP_EMAIL', err));
      }
    }

    await order.save();
    logAudit('STATUS_UPDATED', { orderId: order.orderId, from: currentStatus, to: status, staffId: req.user._id });
    await sysLog(req, {
      level: 'info', category: 'user',
      message: `Order ${order.orderId} status: ${currentStatus} → ${status}`,
      relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId },
      metadata: { from: currentStatus, to: status, note },
    });
    const storeDoc = await PharmacyStore.findById(req.pharmacy.store._id).select('storeName').lean();
    dispatchStatusNotification(order.toObject({ virtuals: true }), status, storeDoc?.storeName);
    res.status(200).json({ success: true, message: `Status updated to ${status}.`, data: { order: order.toObject({ virtuals: true }) } });
  });

// POST '/orders/:orderId/return-accept'
export const postOrdersByOrderIdReturnAccept = asyncHandler(async (req, res) => {
    const { pickupPartner, pickupEstimatedAt } = req.body;
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.delivery.status !== 'Return_Requested') return res.status(400).json({ success: false, message: 'Order must be in Return_Requested status.' });
    order.delivery.status               = 'Return_Accepted';
    order.delivery.pickupPartner        = pickupPartner;
    if (pickupEstimatedAt) order.delivery.pickupEstimatedAt = new Date(pickupEstimatedAt);
    order.cancellation.returnDecision   = 'Accepted';
    order.cancellation.returnDecisionBy = req.user._id;
    order.cancellation.returnDecisionAt = new Date();
    await order.save();
    await sysLog(req, { level: 'info', category: 'user', message: `Return accepted for ${order.orderId}`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id } });
    const storeDoc = await PharmacyStore.findById(req.pharmacy.store._id).select('storeName').lean();
    dispatchStatusNotification(order.toObject({ virtuals: true }), 'Return_Accepted', storeDoc?.storeName);
    res.status(200).json({ success: true, message: 'Return accepted.', data: { order: order.toObject({ virtuals: true }) } });
  });

// POST '/orders/:orderId/process-refund'
export const postOrdersByOrderIdProcessRefund = asyncHandler(async (req, res) => {
    const { amount, reason } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.payment.razorpayPaymentId) return res.status(400).json({ success: false, message: 'No Razorpay payment found.' });
    try {
      const refund = await razorpay.payments.refund(order.payment.razorpayPaymentId, { amount: Math.round(amount * 100), notes: { orderId: order.orderId, reason } });
      order.cancellation.refundId     = refund.id;
      order.cancellation.refundStatus = 'Processed';
      order.cancellation.refundedAt   = new Date();
      order.payment.status            = 'Refunded';
      await order.save();
      logAudit('REFUND_PROCESSED', { orderId: order.orderId, amount, razorpayRefundId: refund.id });
      await sysLog(req, { level: 'success', category: 'payment', message: `Refund ₹${amount} processed for ${order.orderId}`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id }, metadata: { amount, razorpayRefundId: refund.id } });
      const customer = await User.findById(order.customer).select('email name').lean();
      if (customer?.email) {
        const refundHtml = buildRefundEmail({ userName: customer.name, order: order.toObject(), refundAmount: amount, refundMethod: order.cancellation.refundMethod || 'Original_Source', bankDetails: order.cancellation.bankDetails, actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}` });
        sendEmail({ email: customer.email, subject: `[Likeson Healthcare] Refund Initiated — Order #${order.orderId}`, html: refundHtml }).catch((err) => logError('REFUND_EMAIL', err));
        Notification.create({ recipient: order.customer, title: 'Refund Initiated', body: `Refund of ₹${amount} initiated for order #${order.orderId}.`, type: 'Refund_Update', priority: 'High', actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id } });
      }
      res.status(200).json({ success: true, message: 'Refund processed.', data: { order: order.toObject({ virtuals: true }), refundId: refund.id } });
    } catch (error) {
      logError('REFUND_ERROR', error, { orderId: order.orderId });
      await sysLog(req, { level: 'error', category: 'payment', message: `Refund failed for ${order.orderId}: ${error.message}` });
      return res.status(400).json({ success: false, message: `Refund failed: ${error.message}` });
    }
  });

// POST '/orders/:orderId/add-admin-note'
export const postOrdersByOrderIdAddAdminNote = asyncHandler(async (req, res) => {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, message: 'Note is required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!Array.isArray(order.adminNotes)) order.adminNotes = [];
    order.adminNotes.push({ text: note.trim(), addedBy: req.user._id, addedAt: new Date() });
    await order.save();
    res.status(200).json({ success: true, message: 'Note added.', data: { order: order.toObject({ virtuals: true }) } });
  });

// POST '/orders/:orderId/assign-delivery-partner'
export const postOrdersByOrderIdAssignDeliveryPartner = asyncHandler(async (req, res) => {
    const { deliveryPartnerId } = req.body;
    if (!deliveryPartnerId) return res.status(400).json({ success: false, message: 'deliveryPartnerId is required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    order.delivery.internalPartner = deliveryPartnerId;
    await order.save();
    await sysLog(req, { level: 'info', category: 'user', message: `Delivery partner ${deliveryPartnerId} assigned to ${order.orderId}` });
    dispatchSimpleNotification(order.customer, { title: 'Delivery Partner Assigned', body: `A delivery partner has been assigned for order #${order.orderId}.`, type: 'Order_Update', emailSubject: 'Delivery Partner Assigned', emailBody: `A delivery partner has been assigned for your order #${order.orderId}.`, actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}` });
    res.status(200).json({ success: true, message: 'Partner assigned.', data: { order: order.toObject({ virtuals: true }) } });
  });

// GET '/orders/:orderId/export'
export const getOrdersByOrderIdExport = asyncHandler(async (req, res) => {
    const order = await findOrderPopulated(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.status(200).json({ success: true, data: { order: order.toObject({ virtuals: true }) } });
  });

// POST '/orders/:orderId/pickup-verify'
export const postOrdersByOrderIdPickupVerify = asyncHandler(async (req, res) => {
    const { pickupConditionGood, pickupConditionNotes = '' } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await PharmacyOrder.findOne({
        store: req.pharmacy.store._id, isArchived: false,
        $or: [
          { orderId: req.params.orderId },
          ...(mongoose.Types.ObjectId.isValid(req.params.orderId)
            ? [{ _id: new mongoose.Types.ObjectId(req.params.orderId) }]
            : []),
        ],
      }).session(session);

      if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }
      if (order.delivery.status !== 'Pickup_Done') { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Order must be in Pickup_Done status.' }); }

      order.delivery.status                   = 'Returned';
      order.cancellation.pickupConditionGood  = pickupConditionGood;
      order.cancellation.pickupConditionNotes = pickupConditionNotes;
      order.cancellation.pickupVerifiedBy     = req.user._id;
      order.cancellation.pickupVerifiedAt     = new Date();

      if (pickupConditionGood) {
        order.cancellation.refundStatus = 'Requested';
        order.cancellation.refundAmount = order.billing.totalPayable;

        const selectedMethod = order.cancellation.selectedRefundMethod || 'Original_Source';
        const refundMethodMap = {
          Wallet:          'Wallet',
          Online:          'Original_Source',
          Original_Source: 'Original_Source',
          Bank_Transfer:   'Bank_Transfer',
          Custom_Bank:     'Bank_Transfer',
        };
        order.cancellation.refundMethod = refundMethodMap[selectedMethod] || 'Original_Source';

        if (selectedMethod === 'Wallet') {
          const wallet = await Wallet.findOne({ user: order.customer }).session(session);
          if (wallet) {
            const balanceBefore = wallet.balance;
            wallet.balance = parseFloat((wallet.balance + order.billing.totalPayable).toFixed(2));
            wallet.transactions.push({
              transactionId: `TXN-${Date.now()}`,
              type: 'Credit',
              amount: order.billing.totalPayable,
              purpose: 'Return_Refund',
              referenceId: order._id,
              onModel: 'PharmacyOrder',
              status: 'Success',
              balanceBefore,
              balanceAfter: wallet.balance,
              description: `Refund for returned order #${order.orderId}`,
            });
            await wallet.save({ session });
          }
          order.cancellation.refundStatus = 'Processed';
          order.cancellation.refundedAt   = new Date();
        }
      }

      await order.save({ session });
      await session.commitTransaction();

      logAudit('PICKUP_VERIFIED', { orderId: order.orderId, conditionGood: pickupConditionGood });
      await sysLog(req, {
        level: pickupConditionGood ? 'success' : 'warning', category: 'user',
        message: `Pickup verified for ${order.orderId} — condition: ${pickupConditionGood ? 'good' : 'bad'}`,
        relatedEntity: { model: 'PharmacyOrder', entityId: order._id },
      });

      const customer = await User.findById(order.customer).select('email name').lean();
      if (pickupConditionGood && customer?.email) {
        const refundHtml = buildRefundEmail({ userName: customer.name, order: order.toObject(), refundAmount: order.billing.totalPayable, refundMethod: order.cancellation.refundMethod, bankDetails: order.cancellation.bankDetails, actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}` });
        sendEmail({ email: customer.email, subject: `[Likeson Healthcare] Refund Initiated — Order #${order.orderId}`, html: refundHtml }).catch((err) => logError('REFUND_EMAIL', err));
      }
      Notification.create({ recipient: order.customer, title: pickupConditionGood ? 'Refund Initiated' : 'Return Rejected', body: pickupConditionGood ? `Refund of ₹${order.billing.totalPayable} initiated for #${order.orderId}.` : `Return for #${order.orderId} was rejected. Items not in return condition.`, type: 'Return_Verification', priority: 'High', actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id } });
      res.status(200).json({ success: true, message: pickupConditionGood ? 'Return verified. Refund initiated.' : 'Return rejected.', data: { order: order.toObject({ virtuals: true }) } });
    } catch (err) {
      await session.abortTransaction();
      logError('PICKUP_VERIFY_ERROR', err, { orderId: req.params.orderId });
      throw err;
    } finally { session.endSession(); }
  });

// GET '/orders/:orderId/invoice'
export const getOrdersByOrderIdInvoice = asyncHandler(async (req, res) => {
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    await order.populate('store', 'storeName address');

    const customer     = await User.findById(order.customer).select('name email phone').lean();
    const storeDoc     = order.store;
    const storeAddress = storeDoc?.address
      ? `${storeDoc.address.line1 || ''}, ${storeDoc.address.city || 'Vijayawada'}, ${storeDoc.address.state || 'Andhra Pradesh'}`
      : 'Vijayawada, Andhra Pradesh';

    const html = buildInvoiceHtml({
      order:        order.toObject({ virtuals: true }),
      user:         customer,
      storeName:    storeDoc?.storeName || 'Likeson Pharmacy',
      storeAddress,
    });

    res.status(200).send(html);
  });

// GET '/orders/:orderId/label'
export const getOrdersByOrderIdLabel = asyncHandler(async (req, res) => {
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    await order.populate({
      path:     'items.medicine',
      populate: {
        path:   'hsnCode',
        model:  'HsnCode',
        select: 'hsnCode description gstPercentage cgstPercentage sgstPercentage',
      },
    });

    const orderObj = order.toObject({ virtuals: true });
    orderObj.items = orderObj.items.map((item) => ({
      ...item,
      hsnCode:      item.medicine?.hsnCode ?? item.hsnCode,
      gstPercentage:item.medicine?.hsnCode?.gstPercentage ?? item.gstPercentage,
    }));

    const [storeDoc, customer] = await Promise.all([
      PharmacyStore.findById(req.pharmacy.store._id).lean(),
      User.findById(order.customer).select('name email phone').lean(),
    ]);

    const { html, labelId } = await generateDeliveryLabel({ order: orderObj, store: storeDoc, customer });

    logAudit('LABEL_GENERATED', { orderId: order.orderId, labelId, staffId: req.user._id });
    await sysLog(req, { level: 'info', category: 'system', message: `Delivery label ${labelId} generated for order ${order.orderId}`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId }, metadata: { labelId } });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="label-${order.orderId}.html"`);
    res.status(200).send(html);
  });

// GET '/medicines'
export const getMedicines = asyncHandler(async (req, res) => {
    const { search, category, lowStock, expiringSoon, outOfStock } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const storeId = req.pharmacy.store._id;

    // Build medicine filter
    const medFilter = { isApproved: true, isDiscontinued: false, isDeleted: false };
    if (search) {
      medFilter.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { brandName:   { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) medFilter.category = category;

    // Build inventory filter
    const invFilter = { storeId, isActive: true, isDeleted: false };
    if (lowStock   === 'true') invFilter.isLowStock    = true;
    if (outOfStock === 'true') invFilter.isOutOfStock  = true;

    // Expiry filter: check batches near expiry
    let nearExpiryMedicineIds = null;
    if (expiringSoon === 'true') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + EXPIRY_ALERT_DAYS);
      const expiringBatches = await MedicineBatch.find({
        storeId,
        expiryDate: { $lte: cutoff, $gte: new Date() },
        status: 'Active',
        isDeleted: false,
        remainingQuantity: { $gt: 0 },
      }).distinct('medicineId');
      nearExpiryMedicineIds = expiringBatches;
    }

    // Get inventories matching inv filter
    const inventories = await MedicineInventory.find(invFilter)
      .populate({
        path:   'medicineId',
        match:  nearExpiryMedicineIds
          ? { ...medFilter, _id: { $in: nearExpiryMedicineIds } }
          : medFilter,
        select: 'name brandName genericName category dosage manufacturer hsnCode gstPercentage images slug isPrescriptionRequired schedule',
        populate: { path: 'hsnCode', select: 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage' },
      })
      .populate('batchId', 'batchNumber expiryDate remainingQuantity isNearExpiry fifoPriority')
      .populate('supplierId', 'name code contact.phone')
      .sort({ updatedAt: -1 })
      .lean();

    // Filter out docs where medicine didn't match (populate returns null if match fails)
    const valid = inventories.filter((inv) => inv.medicineId != null);
    const total = valid.length;
    const paginated = valid.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: {
        medicines: paginated,
        pagination: {
          currentPage: page,
          totalPages:  Math.ceil(total / limit),
          totalItems:  total,
        },
      },
    });
  });

// GET '/medicines/:medicineId/inventory'
export const getMedicinesByMedicineIdInventory = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const inv = await MedicineInventory.findOne({
      medicineId: req.params.medicineId,
      storeId,
      isDeleted: false,
    })
      .populate('medicineId', 'name brandName genericName category dosage manufacturer hsnCode gstPercentage referenceMrp images')
      .populate('batchId', 'batchNumber expiryDate remainingQuantity isNearExpiry daysUntilExpiry')
      .populate('supplierId', 'name code contact.phone')
      .lean({ virtuals: true });

    if (!inv) return res.status(404).json({ success: false, message: 'Inventory record not found for this medicine at your store.' });

    // Also pull all batches for this medicine at this store
    const batches = await MedicineBatch.find({
      medicineId: req.params.medicineId,
      storeId,
      isDeleted: false,
    }).sort({ fifoPriority: 1 }).lean({ virtuals: true });

    res.status(200).json({ success: true, data: { inventory: inv, batches } });
  });

// POST '/medicines/:medicineId/add-stock'
export const postMedicinesByMedicineIdAddStock = asyncHandler(async (req, res) => {
    const {
      stockQuantity, batchNumber, expiryDate, manufacturingDate,
      mrp, sellingPrice, discountPercent = 0,
      purchasePrice, purchaseInvoiceNo, purchaseInvoiceDate,
      supplierId, rackLocation,
    } = req.body;

    if (!stockQuantity || stockQuantity <= 0) return res.status(400).json({ success: false, message: 'stockQuantity must be > 0.' });
    if (!batchNumber)  return res.status(400).json({ success: false, message: 'batchNumber is required.' });
    if (!expiryDate)   return res.status(400).json({ success: false, message: 'expiryDate is required.' });
    if (!mrp || mrp <= 0)          return res.status(400).json({ success: false, message: 'mrp is required and must be > 0.' });
    if (!sellingPrice || sellingPrice <= 0) return res.status(400).json({ success: false, message: 'sellingPrice is required and must be > 0.' });

    const medicine = await Medicine.findById(req.params.medicineId).lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found in catalogue.' });

    const storeId  = req.pharmacy.store._id;
    const session  = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Upsert MedicineInventory (one per store+medicine)
      let inv = await MedicineInventory.findOne({ medicineId: medicine._id, storeId }).session(session);
      const isNewInv = !inv;

      if (!inv) {
        inv = new MedicineInventory({
          medicineId:      medicine._id,
          storeId,
          mrp,
          sellingPrice,
          discountPercent,
          createdBy:       req.user._id,
        });
      }

      // Update pricing fields from this stock-in
      inv.mrp           = mrp;
      inv.sellingPrice  = sellingPrice;
      inv.discountPercent = discountPercent;
      if (supplierId)    inv.supplierId   = supplierId;
      if (rackLocation)  inv.rackLocation = rackLocation;
      inv.updatedBy      = req.user._id;

      // Increment total stock
      inv.stockQuantity   = (inv.stockQuantity || 0) + Number(stockQuantity);
      inv.availableStock  = Math.max(0, inv.stockQuantity - (inv.reservedStock || 0));
      inv.isOutOfStock    = inv.availableStock <= 0;
      inv.isLowStock      = !inv.isOutOfStock && inv.availableStock <= (inv.reorderLevel || LOW_STOCK_THRESHOLD);
      inv.isActive        = true;
      inv.isDeleted       = false;

      await inv.save({ session });

      // 2. Create or update MedicineBatch
      let batch = await MedicineBatch.findOne({ medicineId: medicine._id, storeId, batchNumber }).session(session);
      if (batch) {
        // Top-up existing batch
        batch.remainingQuantity  = (batch.remainingQuantity || 0) + Number(stockQuantity);
        batch.quantityPurchased += Number(stockQuantity);
        batch.expiryDate         = new Date(expiryDate);
        if (purchasePrice)        batch.purchasePrice        = purchasePrice;
        if (purchaseInvoiceNo)    batch.purchaseInvoiceNo    = purchaseInvoiceNo;
        if (purchaseInvoiceDate)  batch.purchaseInvoiceDate  = new Date(purchaseInvoiceDate);
        batch.updatedBy = req.user._id;
        await batch.save({ session });
      } else {
        batch = await MedicineBatch.create([{
          medicineId:         medicine._id,
          storeId,
          supplierId:         supplierId || null,
          batchNumber,
          manufacturingDate:  manufacturingDate ? new Date(manufacturingDate) : undefined,
          expiryDate:         new Date(expiryDate),
          purchasePrice,
          purchaseInvoiceNo,
          purchaseInvoiceDate: purchaseInvoiceDate ? new Date(purchaseInvoiceDate) : undefined,
          quantityPurchased:  Number(stockQuantity),
          remainingQuantity:  Number(stockQuantity),
          status:             'Active',
          createdBy:          req.user._id,
        }], { session });
        batch = batch[0];
      }

      // 3. Set active batch pointer to earliest-expiry batch (FEFO)
      const activeBatches = await MedicineBatch.find({
        medicineId: medicine._id, storeId, status: 'Active', isDeleted: false,
        remainingQuantity: { $gt: 0 },
      }).sort({ fifoPriority: 1 }).session(session).lean();

      if (activeBatches.length > 0) {
        inv.batchId = activeBatches[0]._id;
        await inv.save({ session });
      }

      // 4. Log to InventoryMovement
      await InventoryMovement.create([{
        storeId,
        medicineId:      medicine._id,
        batchId:         batch._id,
        movementType:    'Purchase',
        quantityChanged: Number(stockQuantity),
        previousStock:   isNewInv ? 0 : inv.stockQuantity - Number(stockQuantity),
        newStock:        inv.stockQuantity,
        referenceModel:  'Manual',
        reason:          `Stock added via pharmacy portal — batch ${batchNumber}`,
        performedBy:     req.user._id,
      }], { session });

      await session.commitTransaction();

      // Reload with populate for response
      const updatedInv = await MedicineInventory.findById(inv._id)
        .populate('medicineId', 'name brandName genericName category hsnCode gstPercentage referenceMrp images')
        .populate('batchId', 'batchNumber expiryDate remainingQuantity isNearExpiry')
        .populate('supplierId', 'name code')
        .lean({ virtuals: true });

      await invalidateStoreCache(storeId);
      logAudit('STOCK_ADDED', { medicineId: medicine._id, storeId, batchNumber, quantity: stockQuantity, staffId: req.user._id });
      await sysLog(req, {
        level: 'success', category: 'system',
        message: `Stock added: ${medicine.brandName || medicine.name} — ${stockQuantity} units (batch: ${batchNumber})`,
        relatedEntity: { model: 'PharmacyStore', entityId: storeId },
        metadata: { medicineId: medicine._id, batchNumber, stockQuantity },
      });

      if (inv.isLowStock) {
        dispatchLowStockAlert(medicine, storeId, inv.availableStock, req.user._id);
      }

      res.status(200).json({ success: true, message: 'Stock added successfully.', data: { inventory: updatedInv, batch } });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  });

// PATCH '/medicines/:medicineId/deduct-stock'
export const patchMedicinesByMedicineIdDeductStock = asyncHandler(async (req, res) => {
    const { quantity, batchNumber, reason = '', movementType = 'Adjustment_Sub' } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ success: false, message: 'quantity must be > 0.' });

    const validMovements = ['Adjustment_Sub', 'Damage', 'Expiry', 'Transfer_Out'];
    if (!validMovements.includes(movementType)) {
      return res.status(400).json({ success: false, message: `movementType must be one of: ${validMovements.join(', ')}` });
    }

    const storeId = req.pharmacy.store._id;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const inv = await MedicineInventory.findOne({
        medicineId: req.params.medicineId, storeId, isActive: true, isDeleted: false,
      }).session(session);
      if (!inv) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Inventory record not found.' }); }
      if (inv.availableStock < quantity) { await session.abortTransaction(); return res.status(400).json({ success: false, message: `Insufficient available stock. Available: ${inv.availableStock}` }); }

      // Deduct from specific batch or FEFO-first
      let targetBatch;
      if (batchNumber) {
        targetBatch = await MedicineBatch.findOne({
          medicineId: req.params.medicineId, storeId, batchNumber, status: 'Active', isDeleted: false,
        }).session(session);
        if (!targetBatch) { await session.abortTransaction(); return res.status(404).json({ success: false, message: `Batch ${batchNumber} not found or not active.` }); }
        if (targetBatch.remainingQuantity < quantity) { await session.abortTransaction(); return res.status(400).json({ success: false, message: `Batch ${batchNumber} has only ${targetBatch.remainingQuantity} units.` }); }
      } else {
        // FEFO: pick earliest expiry active batch with enough stock
        targetBatch = await MedicineBatch.findOne({
          medicineId: req.params.medicineId, storeId, status: 'Active', isDeleted: false,
          remainingQuantity: { $gte: quantity },
        }).sort({ fifoPriority: 1 }).session(session);
        if (!targetBatch) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'No single batch with sufficient stock found. Specify batchNumber.' }); }
      }

      const prevStock = inv.stockQuantity;
      targetBatch.remainingQuantity -= quantity;
      if (movementType === 'Damage') {
        targetBatch.damagedQuantity = (targetBatch.damagedQuantity || 0) + quantity;
        inv.damagedStock = (inv.damagedStock || 0) + quantity;
      }
      if (targetBatch.remainingQuantity === 0) targetBatch.status = 'Exhausted';
      await targetBatch.save({ session });

      inv.stockQuantity  -= quantity;
      inv.availableStock  = Math.max(0, inv.stockQuantity - (inv.reservedStock || 0));
      inv.isOutOfStock    = inv.availableStock <= 0;
      inv.isLowStock      = !inv.isOutOfStock && inv.availableStock <= (inv.reorderLevel || LOW_STOCK_THRESHOLD);
      inv.updatedBy       = req.user._id;
      await inv.save({ session });

      // Re-point batchId to new FEFO front
      const nextActiveBatch = await MedicineBatch.findOne({
        medicineId: req.params.medicineId, storeId, status: 'Active', isDeleted: false,
        remainingQuantity: { $gt: 0 },
      }).sort({ fifoPriority: 1 }).session(session);
      if (nextActiveBatch) {
        inv.batchId = nextActiveBatch._id;
        await inv.save({ session });
      }

      await InventoryMovement.create([{
        storeId,
        medicineId:      req.params.medicineId,
        batchId:         targetBatch._id,
        movementType,
        quantityChanged: quantity,
        previousStock:   prevStock,
        newStock:        inv.stockQuantity,
        referenceModel:  'Manual',
        reason,
        performedBy:     req.user._id,
      }], { session });

      await session.commitTransaction();
      await invalidateStoreCache(storeId);

      const medicine = await Medicine.findById(req.params.medicineId).lean();
      logAudit('STOCK_DEDUCTED', { medicineId: req.params.medicineId, batchNumber: targetBatch.batchNumber, quantity, reason });
      await sysLog(req, {
        level: 'info', category: 'system',
        message: `Stock deducted: ${medicine?.brandName || medicine?.name} — ${quantity} units (${movementType})`,
        relatedEntity: { model: 'PharmacyStore', entityId: storeId },
        metadata: { medicineId: req.params.medicineId, batchNumber: targetBatch.batchNumber, quantity, reason, remaining: inv.stockQuantity },
      });

      if (inv.isLowStock || inv.isOutOfStock) {
        dispatchLowStockAlert(medicine, storeId, inv.availableStock, req.user._id);
      }

      const updatedInv = await MedicineInventory.findById(inv._id)
        .populate('medicineId', 'name brandName genericName category')
        .populate('batchId', 'batchNumber expiryDate remainingQuantity')
        .lean({ virtuals: true });

      res.status(200).json({ success: true, message: 'Stock deducted.', data: { inventory: updatedInv } });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  });

// GET '/medicines/:medicineId/stock'
export const getMedicinesByMedicineIdStock = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;

    const [medicine, inv, batches] = await Promise.all([
      Medicine.findById(req.params.medicineId)
        .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
        .lean(),
      MedicineInventory.findOne({ medicineId: req.params.medicineId, storeId, isDeleted: false })
        .populate('batchId', 'batchNumber expiryDate remainingQuantity isNearExpiry daysUntilExpiry')
        .populate('supplierId', 'name code')
        .lean({ virtuals: true }),
      MedicineBatch.find({ medicineId: req.params.medicineId, storeId, isDeleted: false })
        .sort({ fifoPriority: 1 })
        .lean({ virtuals: true }),
    ]);

    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    res.status(200).json({
      success: true,
      data: {
        medicine,
        inventory:   inv || null,
        batches,
        summary: {
          totalStock:     inv?.stockQuantity    || 0,
          reservedStock:  inv?.reservedStock    || 0,
          availableStock: inv?.availableStock   || 0,
          damagedStock:   inv?.damagedStock     || 0,
          returnedStock:  inv?.returnedStock    || 0,
          isLowStock:     inv?.isLowStock       || false,
          isOutOfStock:   inv?.isOutOfStock     || true,
          mrp:            inv?.mrp              || medicine.referenceMrp || 0,
          sellingPrice:   inv?.sellingPrice     || 0,
          finalPrice:     inv?.finalPrice       || 0,
          discountPercent:inv?.discountPercent  || 0,
          activeBatches:  batches.filter(b => b.status === 'Active').length,
          nearExpiryBatches: batches.filter(b => b.isNearExpiry && b.status === 'Active').length,
        },
      },
    });
  });

// PATCH '/medicines/:medicineId/inventory'
export const patchMedicinesByMedicineIdInventory = asyncHandler(async (req, res) => {
    const { mrp, sellingPrice, discountPercent, reorderLevel, minimumStock, maximumStock, rackLocation, isActive } = req.body;
    const storeId = req.pharmacy.store._id;

    const inv = await MedicineInventory.findOne({ medicineId: req.params.medicineId, storeId, isDeleted: false });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory record not found.' });

    if (mrp            != null) inv.mrp            = mrp;
    if (sellingPrice   != null) inv.sellingPrice    = sellingPrice;
    if (discountPercent!= null) inv.discountPercent = discountPercent;
    if (reorderLevel   != null) inv.reorderLevel    = reorderLevel;
    if (minimumStock   != null) inv.minimumStock    = minimumStock;
    if (maximumStock   != null) inv.maximumStock    = maximumStock;
    if (rackLocation   != null) inv.rackLocation    = rackLocation;
    if (isActive       != null) inv.isActive        = isActive;
    inv.updatedBy = req.user._id;

    await inv.save(); // triggers pre-save: finalPrice, availableStock, isLowStock, isOutOfStock

    await invalidateStoreCache(storeId);
    res.status(200).json({ success: true, message: 'Inventory updated.', data: { inventory: inv.toObject({ virtuals: true }) } });
  });

// GET '/inventory/batches'
export const getInventoryBatches = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const { status, search, nearExpiry } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const batchFilter = { storeId, isDeleted: false };
    if (status) batchFilter.status = status;
    if (nearExpiry === 'true') batchFilter.isNearExpiry = true;

    const batches = await MedicineBatch.find(batchFilter)
      .populate({
        path:   'medicineId',
        match:  search
          ? {
              $or: [
                { name:      { $regex: search, $options: 'i' } },
                { brandName: { $regex: search, $options: 'i' } },
              ],
            }
          : {},
        select: 'name brandName genericName category hsnCode gstPercentage',
        populate: { path: 'hsnCode', select: 'hsnCode description gstPercentage' },
      })
      .populate('supplierId', 'name code contact.phone')
      .sort({ fifoPriority: 1, expiryDate: 1 })
      .lean({ virtuals: true });

    const valid     = batches.filter((b) => b.medicineId != null);
    const total     = valid.length;
    const paginated = valid.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: {
        batches: paginated,
        pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
      },
    });
  });

// PATCH '/inventory/batches/:batchId'
export const patchInventoryBatchesByBatchId = asyncHandler(async (req, res) => {
    const { expiryDate, status, damagedQuantity, returnedQuantity, notes } = req.body;
    const storeId = req.pharmacy.store._id;

    const batch = await MedicineBatch.findOne({ _id: req.params.batchId, storeId, isDeleted: false });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

    if (expiryDate)     batch.expiryDate      = new Date(expiryDate);
    if (status)         batch.status          = status;
    if (damagedQuantity != null) {
      const addDamaged = damagedQuantity - (batch.damagedQuantity || 0);
      if (addDamaged > 0) {
        batch.damagedQuantity   = damagedQuantity;
        batch.remainingQuantity = Math.max(0, batch.remainingQuantity - addDamaged);
        // Reflect in inventory
        await MedicineInventory.findOneAndUpdate(
          { medicineId: batch.medicineId, storeId },
          { $inc: { stockQuantity: -addDamaged, availableStock: -addDamaged, damagedStock: addDamaged } }
        );
      }
    }
    if (returnedQuantity != null) batch.returnedQuantity = returnedQuantity;
    batch.updatedBy = req.user._id;

    await batch.save();
    await invalidateStoreCache(storeId);
    res.status(200).json({ success: true, message: 'Batch updated.', data: { batch: batch.toObject({ virtuals: true }) } });
  });

// GET '/inventory/expiry-alerts'
export const getInventoryExpiryAlerts = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const days    = parseInt(req.query.days, 10) || EXPIRY_ALERT_DAYS;
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const expiring = await MedicineBatch.find({
      storeId,
      expiryDate: { $lte: cutoff, $gte: new Date() },
      status: 'Active',
      isDeleted: false,
      remainingQuantity: { $gt: 0 },
    })
      .populate('medicineId', 'name brandName genericName category hsnCode gstPercentage')
      .populate('supplierId', 'name code')
      .sort({ expiryDate: 1 })
      .lean({ virtuals: true });

    const formatted = expiring.map((b) => ({
      batchId:       b._id,
      batchNumber:   b.batchNumber,
      medicineId:    b.medicineId?._id,
      name:          b.medicineId?.name,
      brandName:     b.medicineId?.brandName,
      category:      b.medicineId?.category,
      stockQuantity: b.remainingQuantity,
      expiryDate:    b.expiryDate,
      daysLeft:      b.daysUntilExpiry,
      isNearExpiry:  b.isNearExpiry,
      supplier:      b.supplierId?.name,
    }));

    if (req.query.sendEmail === 'true' && formatted.length > 0) {
      const pharmacyUser = await User.findById(req.user._id).select('email name').lean();
      if (pharmacyUser?.email) {
        const html = buildBatchExpiryAlertEmail({ userName: pharmacyUser.name, storeName: req.pharmacy.store.storeName, items: formatted, days });
        sendEmail({ email: pharmacyUser.email, subject: `[Likeson Healthcare] ⚠️ ${formatted.length} medicine(s) expiring within ${days} days`, html })
          .catch((err) => logError('EXPIRY_ALERT_EMAIL', err));
      }
    }

    res.status(200).json({ success: true, data: { expiringMedicines: formatted, count: formatted.length, alertDays: days } });
  });

// GET '/inventory/low-stock'
export const getInventoryLowStock = asyncHandler(async (req, res) => {
    const storeId   = req.pharmacy.store._id;
    const threshold = parseInt(req.query.threshold, 10) || LOW_STOCK_THRESHOLD;

    const lowStockItems = await MedicineInventory.find({
      storeId,
      isActive:  true,
      isDeleted: false,
      availableStock: { $lte: threshold },
    })
      .populate('medicineId', 'name brandName genericName category manufacturer hsnCode gstPercentage')
      .populate('batchId', 'batchNumber expiryDate remainingQuantity')
      .sort({ availableStock: 1 })
      .lean({ virtuals: true });

    const formatted = lowStockItems.map((inv) => ({
      inventoryId:    inv._id,
      medicineId:     inv.medicineId?._id,
      name:           inv.medicineId?.name,
      brandName:      inv.medicineId?.brandName,
      category:       inv.medicineId?.category,
      availableStock: inv.availableStock,
      stockQuantity:  inv.stockQuantity,
      reservedStock:  inv.reservedStock,
      reorderLevel:   inv.reorderLevel,
      mrp:            inv.mrp,
      sellingPrice:   inv.sellingPrice,
      isOutOfStock:   inv.isOutOfStock,
      activeBatch:    inv.batchId,
    }));

    if (req.query.sendEmail === 'true' && formatted.length > 0) {
      const pharmacyUser = await User.findById(req.user._id).select('email name').lean();
      if (pharmacyUser?.email) {
        const html = buildLowStockAlertEmail({ userName: pharmacyUser.name, storeName: req.pharmacy.store.storeName, items: formatted, threshold });
        sendEmail({ email: pharmacyUser.email, subject: `[Likeson Healthcare] 🔴 ${formatted.length} medicine(s) running low`, html })
          .catch((err) => logError('LOW_STOCK_EMAIL', err));
      }
    }

    res.status(200).json({ success: true, data: { lowStockItems: formatted, count: formatted.length, threshold } });
  });

// POST '/medicines/:medicineId/request-stock'
export const postMedicinesByMedicineIdRequestStock = asyncHandler(async (req, res) => {
    const { requiredQuantity, urgency = 'Medium', supplierId, notes } = req.body;
    if (!requiredQuantity || requiredQuantity <= 0) return res.status(400).json({ success: false, message: 'requiredQuantity must be > 0.' });
    if (!['Low', 'Medium', 'High', 'Critical'].includes(urgency)) return res.status(400).json({ success: false, message: 'Invalid urgency.' });

    const medicine = await Medicine.findById(req.params.medicineId).lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    logAudit('STOCK_REQUESTED', { medicineId: medicine._id, storeId: req.pharmacy.store._id, requiredQuantity, urgency, staffId: req.user._id });
    await sysLog(req, { level: 'info', category: 'system', message: `Restock request: ${medicine.brandName || medicine.name} — ${requiredQuantity} units (${urgency})`, relatedEntity: { model: 'PharmacyStore', entityId: req.pharmacy.store._id }, metadata: { medicineId: medicine._id, requiredQuantity, urgency, notes } });

    res.status(200).json({ success: true, message: 'Stock replenishment request submitted.', data: { medicineId: req.params.medicineId, medicineName: medicine.brandName || medicine.name, requiredQuantity, urgency, notes } });
  });

// GET '/inventory/movements'
export const getInventoryMovements = asyncHandler(async (req, res) => {
    const { medicineId, movementType, dateFilter = 'last30days', startDate, endDate } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const storeId = req.pharmacy.store._id;

    const filter = { storeId };
    if (medicineId)    filter.medicineId    = medicineId;
    if (movementType)  filter.movementType  = movementType;
    filter.createdAt = parseDateFilter(dateFilter, startDate, endDate);

    const [movements, total] = await Promise.all([
      InventoryMovement.find(filter)
        .populate('medicineId', 'name brandName genericName category')
        .populate('batchId',    'batchNumber expiryDate')
        .populate('performedBy','name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryMovement.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        movements,
        pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total },
      },
    });
  });

// GET '/suppliers'
export const getSuppliers = asyncHandler(async (req, res) => {
    const { search, isActive = 'true', page = 1, limit = 20 } = req.query;
    const { skip } = getPagination({ page, limit });
    const filter = {};
    if (isActive !== 'all') filter.isActive = isActive !== 'false';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
      ];
    }
    const [suppliers, total] = await Promise.all([
      Supplier.find(filter).select('-bankDetails.accountNumber').sort({ name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      Supplier.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: { suppliers, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } } });
  });

// POST '/suppliers'
export const postSuppliers = asyncHandler(async (req, res) => {
    const { name, contact, address, legal, paymentTerms, bankDetails } = req.body;
    if (!name || !contact?.email || !contact?.phone) return res.status(400).json({ success: false, message: 'name, contact.email, contact.phone required.' });
    if (!legal?.gstNumber || !legal?.dlNumber) return res.status(400).json({ success: false, message: 'legal.gstNumber and legal.dlNumber required.' });

    const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + String(Date.now()).slice(-4);
    const supplier = await Supplier.create({ name, code, contact, address, legal, paymentTerms, bankDetails });

    await sysLog(req, { level: 'success', category: 'system', message: `Supplier created: ${name}`, metadata: { supplierId: supplier._id } });
    res.status(201).json({ success: true, data: { supplier } });
  });

// GET '/suppliers/:id'
export const getSuppliersById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    res.status(200).json({ success: true, data: { supplier } });
  });

// PATCH '/suppliers/:id'
export const patchSuppliersById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await sysLog(req, { level: 'info', category: 'system', message: `Supplier updated: ${supplier.name}` });
    res.status(200).json({ success: true, data: { supplier } });
  });

// DELETE '/suppliers/:id'
export const deleteSuppliersById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await sysLog(req, { level: 'warning', category: 'system', message: `Supplier deactivated: ${supplier.name}` });
    res.status(200).json({ success: true, message: `Supplier ${supplier.name} deactivated.` });
  });

// GET '/purchase-orders'
export const getPurchaseOrders = asyncHandler(async (req, res) => {
    const { status, supplierId, dateFilter = 'last30days', startDate, endDate } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const storeId = req.pharmacy.store._id;

    const filter = { storeId };
    if (status)     filter.status     = status;
    if (supplierId) filter.supplierId = supplierId;
    filter.createdAt = parseDateFilter(dateFilter, startDate, endDate);

    const [pos, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplierId', 'name code contact.phone')
        .populate('items.medicineId', 'name brandName genericName category')
        .populate('receivedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { purchaseOrders: pos, pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total } } });
  });

// POST '/purchase-orders'
export const postPurchaseOrders = asyncHandler(async (req, res) => {
    const { supplierId, items, expectedDeliveryDate, notes } = req.body;
    if (!supplierId) return res.status(400).json({ success: false, message: 'supplierId required.' });
    if (!items?.length) return res.status(400).json({ success: false, message: 'items array required.' });

    const supplier = await Supplier.findById(supplierId).lean();
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    // Validate items and compute financials
    let subTotal = 0, taxTotal = 0;
    const validatedItems = [];
    for (const item of items) {
      if (!item.medicineId || !item.requestedQuantity || !item.unitPrice) {
        return res.status(400).json({ success: false, message: 'Each item needs medicineId, requestedQuantity, unitPrice.' });
      }
      const med = await Medicine.findById(item.medicineId).populate('hsnCode', 'gstPercentage').lean();
      if (!med) return res.status(404).json({ success: false, message: `Medicine ${item.medicineId} not found.` });

      const gstPc   = med.hsnCode?.gstPercentage ?? med.gstPercentage ?? 0;
      const tax     = parseFloat(((item.unitPrice * item.requestedQuantity * gstPc) / 100).toFixed(2));
      const total   = parseFloat((item.unitPrice * item.requestedQuantity + tax).toFixed(2));
      subTotal     += item.unitPrice * item.requestedQuantity;
      taxTotal     += tax;

      validatedItems.push({
        medicineId:        item.medicineId,
        requestedQuantity: item.requestedQuantity,
        receivedQuantity:  0,
        unitPrice:         item.unitPrice,
        taxAmount:         tax,
        totalPrice:        total,
      });
    }

    const grandTotal = parseFloat((subTotal + taxTotal).toFixed(2));
    const poNumber   = `PO-${req.pharmacy.store._id.toString().slice(-4).toUpperCase()}-${Date.now()}`;

    const po = await PurchaseOrder.create({
      poNumber,
      storeId:  req.pharmacy.store._id,
      supplierId,
      items:    validatedItems,
      financials: { subTotal: parseFloat(subTotal.toFixed(2)), taxTotal, discountTotal: 0, grandTotal },
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      notes,
      status: 'Draft',
    });

    await sysLog(req, { level: 'success', category: 'system', message: `PO created: ${poNumber}`, relatedEntity: { model: 'PurchaseOrder', entityId: po._id } });
    res.status(201).json({ success: true, data: { purchaseOrder: po } });
  });

// GET '/purchase-orders/:id'
export const getPurchaseOrdersById = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.pharmacy.store._id })
      .populate('supplierId', 'name code contact address legal')
      .populate('items.medicineId', 'name brandName genericName category hsnCode gstPercentage dosage manufacturer')
      .populate('receivedBy', 'name role')
      .lean();
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    res.status(200).json({ success: true, data: { purchaseOrder: po } });
  });

// PATCH '/purchase-orders/:id/status'
export const patchPurchaseOrdersByIdStatus = asyncHandler(async (req, res) => {
    const { status, notes } = req.body;
    const allowed = ['Draft', 'Sent', 'Cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });

    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.pharmacy.store._id });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    if (po.status === 'Received') return res.status(400).json({ success: false, message: 'Cannot change status of a fully received PO.' });

    po.status = status;
    if (notes) po.notes = notes;
    await po.save();

    await sysLog(req, { level: 'info', category: 'system', message: `PO ${po.poNumber} status → ${status}` });
    res.status(200).json({ success: true, message: `PO status updated to ${status}.`, data: { purchaseOrder: po } });
  });

// POST '/purchase-orders/:id/receive'
export const postPurchaseOrdersByIdReceive = asyncHandler(async (req, res) => {
    const { items } = req.body;
    // items: [{ medicineId, receivedQuantity, batchNumber, expiryDate, manufacturingDate, mrp, sellingPrice }]
    if (!items?.length) return res.status(400).json({ success: false, message: 'items array required.' });

    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.pharmacy.store._id });
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    if (!['Sent', 'Partially_Received'].includes(po.status)) {
      return res.status(400).json({ success: false, message: 'PO must be in Sent or Partially_Received status to receive.' });
    }

    const storeId = req.pharmacy.store._id;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const incomingItem of items) {
        const { medicineId, receivedQuantity, batchNumber, expiryDate, manufacturingDate, mrp, sellingPrice, discountPercent = 0 } = incomingItem;
        if (!receivedQuantity || receivedQuantity <= 0 || !batchNumber || !expiryDate) {
          throw new Error(`Item ${medicineId}: receivedQuantity, batchNumber, expiryDate all required.`);
        }

        // Update PO item received quantity
        const poItem = po.items.find((i) => i.medicineId.equals(medicineId));
        if (!poItem) throw new Error(`Medicine ${medicineId} not in this PO.`);
        poItem.receivedQuantity = (poItem.receivedQuantity || 0) + receivedQuantity;

        // Upsert MedicineInventory
        let inv = await MedicineInventory.findOne({ medicineId, storeId }).session(session);
        const prevStock = inv?.stockQuantity || 0;
        if (!inv) {
          inv = new MedicineInventory({
            medicineId, storeId,
            mrp:            mrp || poItem.unitPrice,
            sellingPrice:   sellingPrice || mrp || poItem.unitPrice,
            discountPercent,
            createdBy:      req.user._id,
          });
        } else {
          if (mrp)          inv.mrp          = mrp;
          if (sellingPrice) inv.sellingPrice  = sellingPrice;
          inv.discountPercent = discountPercent;
        }
        inv.stockQuantity  = (inv.stockQuantity || 0) + receivedQuantity;
        inv.availableStock = Math.max(0, inv.stockQuantity - (inv.reservedStock || 0));
        inv.isOutOfStock   = inv.availableStock <= 0;
        inv.isLowStock     = !inv.isOutOfStock && inv.availableStock <= (inv.reorderLevel || LOW_STOCK_THRESHOLD);
        inv.updatedBy      = req.user._id;
        inv.supplierId     = po.supplierId;
        await inv.save({ session });

        // Upsert batch
        let batch = await MedicineBatch.findOne({ medicineId, storeId, batchNumber }).session(session);
        if (batch) {
          batch.remainingQuantity  += receivedQuantity;
          batch.quantityPurchased  += receivedQuantity;
          batch.expiryDate          = new Date(expiryDate);
          batch.purchaseOrderId     = po._id;
          batch.purchasePrice       = poItem.unitPrice;
          batch.purchaseInvoiceNo   = po.supplierInvoiceNumber || undefined;
          batch.updatedBy           = req.user._id;
          await batch.save({ session });
        } else {
          [batch] = await MedicineBatch.create([{
            medicineId, storeId,
            supplierId:       po.supplierId,
            purchaseOrderId:  po._id,
            batchNumber,
            manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : undefined,
            expiryDate:       new Date(expiryDate),
            purchasePrice:    poItem.unitPrice,
            purchaseInvoiceNo: po.supplierInvoiceNumber || undefined,
            quantityPurchased: receivedQuantity,
            remainingQuantity: receivedQuantity,
            createdBy: req.user._id,
          }], { session });
        }

        // Update FEFO pointer
        const earliestBatch = await MedicineBatch.findOne({
          medicineId, storeId, status: 'Active', isDeleted: false,
          remainingQuantity: { $gt: 0 },
        }).sort({ fifoPriority: 1 }).session(session);
        if (earliestBatch) { inv.batchId = earliestBatch._id; await inv.save({ session }); }

        // Log movement
        await InventoryMovement.create([{
          storeId, medicineId,
          batchId:         batch._id,
          movementType:    'Purchase',
          quantityChanged: receivedQuantity,
          previousStock:   prevStock,
          newStock:        inv.stockQuantity,
          referenceModel:  'PurchaseOrder',
          referenceId:     po._id,
          reason:          `Received via PO ${po.poNumber}`,
          performedBy:     req.user._id,
        }], { session });

        results.push({ medicineId, batchNumber, receivedQuantity, inventoryId: inv._id, batchId: batch._id });
      }

      // Update PO status
      const allReceived = po.items.every((i) => i.receivedQuantity >= i.requestedQuantity);
      po.status     = allReceived ? 'Received' : 'Partially_Received';
      po.receivedAt = allReceived ? new Date() : undefined;
      po.receivedBy = req.user._id;
      await po.save({ session });

      await session.commitTransaction();
      await invalidateStoreCache(storeId);

      await sysLog(req, {
        level: 'success', category: 'system',
        message: `PO ${po.poNumber} stock received — status: ${po.status}`,
        relatedEntity: { model: 'PurchaseOrder', entityId: po._id },
        metadata: { results },
      });

      res.status(200).json({ success: true, message: `Stock received. PO status: ${po.status}.`, data: { purchaseOrder: po, received: results } });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  });

// GET '/financials/daily'
export const getFinancialsDaily = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const day     = req.query.date ? new Date(req.query.date) : new Date();
    const start   = new Date(day); start.setHours(0, 0, 0, 0);
    const end     = new Date(day); end.setHours(23, 59, 59, 999);
    const [orders, revenue, statusBreak] = await Promise.all([
      PharmacyOrder.countDocuments({ store: storeId, isArchived: false, createdAt: { $gte: start, $lte: end } }),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: start, $lte: end } } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, orderCount: { $sum: 1 } } }]),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, createdAt: { $gte: start, $lte: end } } }, { $group: { _id: '$delivery.status', count: { $sum: 1 } } }]),
    ]);
    const fin   = revenue[0] || {};
    const stats = statusBreak.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
    res.status(200).json({ success: true, data: { date: day.toISOString().split('T')[0], totalOrders: orders, grossRevenue: fin.grossRevenue || 0, gstCollected: fin.gstCollected || 0, discounts: fin.discounts || 0, netRevenue: (fin.grossRevenue || 0) - (fin.gstCollected || 0), paidOrders: fin.orderCount || 0, statusBreakdown: stats } });
  });

// GET '/financials/monthly'
export const getFinancialsMonthly = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    let year, month;
    if (req.query.month) { [year, month] = req.query.month.split('-').map(Number); }
    else { const now = new Date(); year = now.getFullYear(); month = now.getMonth() + 1; }
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);
    const [summary, byDay] = await Promise.all([
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: start, $lte: end } } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, orderCount: { $sum: 1 } } }]),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$billing.totalPayable' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    const fin = summary[0] || {};
    res.status(200).json({ success: true, data: { month: `${year}-${String(month).padStart(2, '0')}`, grossRevenue: fin.grossRevenue || 0, gstCollected: fin.gstCollected || 0, discounts: fin.discounts || 0, netRevenue: (fin.grossRevenue || 0) - (fin.gstCollected || 0), totalOrders: fin.orderCount || 0, dailyBreakdown: byDay } });
  });

// GET '/financials/total'
export const getFinancialsTotal = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const [lifetime, byMonth, topMedicines] = await Promise.all([
      PharmacyOrder.aggregate([
        { $match: { store: storeId, isArchived: false, 'payment.status': 'Paid' } },
        { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, totalOrders: { $sum: 1 } } },
      ]),
      PharmacyOrder.aggregate([
        { $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$billing.totalPayable' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      PharmacyOrder.aggregate([
        { $match: { store: storeId, isArchived: false, 'payment.status': 'Paid' } },
        { $unwind: '$items' },
        { $group: { _id: '$items.medicine', name: { $first: '$items.name' }, brandName: { $first: '$items.brandName' }, totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.pricePerUnit', '$items.quantity'] } } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),
    ]);
    const fin = lifetime[0] || {};
    res.status(200).json({ success: true, data: { grossRevenue: fin.grossRevenue || 0, gstCollected: fin.gstCollected || 0, discounts: fin.discounts || 0, netRevenue: (fin.grossRevenue || 0) - (fin.gstCollected || 0), totalOrders: fin.totalOrders || 0, monthlyTrend: byMonth, topMedicines } });
  });

// GET '/financials/history'
export const getFinancialsHistory = asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days', startDate, endDate, paymentMethod } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const storeId   = req.pharmacy.store._id;
    const dateRange = parseDateFilter(dateFilter, startDate, endDate);
    const filter    = { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange };
    if (paymentMethod) filter['payment.method'] = paymentMethod;
    const [orders, totalCount, summary] = await Promise.all([
      PharmacyOrder.find(filter).select('orderId billing payment delivery.status createdAt customer store').populate('customer', 'name phone').populate('store', 'storeName address contact').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PharmacyOrder.countDocuments(filter),
      PharmacyOrder.aggregate([{ $match: filter }, { $group: { _id: null, totalRevenue: { $sum: '$billing.totalPayable' }, totalGst: { $sum: '$billing.gstAmount' }, totalDiscount: { $sum: '$billing.discountAmount' } } }]),
    ]);
    res.status(200).json({ success: true, data: { orders, summary: summary[0] || { totalRevenue: 0, totalGst: 0, totalDiscount: 0 }, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount } } });
  });

// GET '/financials/cod-pending'
export const getFinancialsCodPending = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const store   = await PharmacyStore.findById(storeId).lean();
    const config  = await PlatformPricingConfig.getGlobal();
    const pharmacyCfg = config?.pharmacy || {};

    const codOrders = await PharmacyOrder.find({
      store:           storeId,
      isArchived:      false,
      'payment.method': 'COD',
      'payment.status': 'Paid',
      'delivery.status': 'Delivered',
    }).select('orderId billing payment delivery.deliveredAt createdAt').lean();

    const isOwnedStore    = store?.storeType === 'Owned';
    const platformFee     = pharmacyCfg.platformFee || { type: 'percentage', value: 10 };
    const commissionPc    = isOwnedStore ? (pharmacyCfg.ownStoreMarginPercent || 30) : (store?.bankDetails?.commissionPercent || 0);

    let totalCollected = 0, totalMustRemit = 0, totalStoreNet = 0;
    const breakdown = codOrders.map((order) => {
      const total    = order.billing?.totalPayable || 0;
      const subTotal = order.billing?.subTotal || 0;
      const gst      = order.billing?.gstAmount || 0;

      let platformCut = 0;
      if (platformFee.type === 'percentage') {
        platformCut = parseFloat(((subTotal * commissionPc) / 100).toFixed(2));
      } else {
        platformCut = platformFee.value;
      }

      const mustRemit  = parseFloat((platformCut + gst).toFixed(2));
      const storeNet   = parseFloat((total - mustRemit).toFixed(2));

      totalCollected  += total;
      totalMustRemit  += mustRemit;
      totalStoreNet   += storeNet;

      return {
        orderId:       order.orderId,
        deliveredAt:   order.delivery?.deliveredAt,
        totalCollected:total,
        platformCut,
        gstOnOrder:    gst,
        mustRemitToPlatform: mustRemit,
        storeNetAfterRemit:  storeNet,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCODOrders:  codOrders.length,
          totalCollected:  parseFloat(totalCollected.toFixed(2)),
          totalMustRemit:  parseFloat(totalMustRemit.toFixed(2)),
          totalStoreNet:   parseFloat(totalStoreNet.toFixed(2)),
          commissionPercent: commissionPc,
          storeType:       store?.storeType,
        },
        orders: breakdown,
      },
    });
  });

// GET '/financials/store-invoice'
export const getFinancialsStoreInvoice = asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days', startDate, endDate } = req.query;
    const storeId   = req.pharmacy.store._id;
    const dateRange = parseDateFilter(dateFilter, startDate, endDate);
    const [store, orders, summary] = await Promise.all([
      PharmacyStore.findById(storeId).lean(),
      PharmacyOrder.find({ store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange }).select('orderId billing payment delivery.status createdAt').sort({ createdAt: -1 }).lean(),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, totalOrders: { $sum: 1 } } }]),
    ]);
    const html = buildStoreInvoiceHtml({ store, orders, summary: summary[0] || {}, dateRange: { start: dateRange.$gte, end: dateRange.$lte }, generatedBy: req.user });
    res.status(200).send(html);
  });

// POST '/financials/store-invoice/send'
export const postFinancialsStoreInvoiceSend = asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days', startDate, endDate, recipientEmail } = req.body;
    const storeId   = req.pharmacy.store._id;
    const dateRange = parseDateFilter(dateFilter, startDate, endDate);
    const [store, orders, summary] = await Promise.all([
      PharmacyStore.findById(storeId).lean(),
      PharmacyOrder.find({ store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange }).select('orderId billing payment delivery.status createdAt').sort({ createdAt: -1 }).lean(),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, totalOrders: { $sum: 1 } } }]),
    ]);
    const html    = buildStoreInvoiceHtml({ store, orders, summary: summary[0] || {}, dateRange: { start: dateRange.$gte, end: dateRange.$lte }, generatedBy: req.user });
    const toEmail = recipientEmail || (await User.findById(req.user._id).select('email').lean())?.email;
    if (!toEmail) return res.status(400).json({ success: false, message: 'Recipient email not found.' });
    await sendEmail({ email: toEmail, subject: `[Likeson Healthcare] Store Invoice — ${store?.storeName}`, html });
    res.status(200).json({ success: true, message: `Store invoice sent to ${toEmail}.` });
  });

// GET '/financials/payment-account'
export const getFinancialsPaymentAccount = asyncHandler(async (req, res) => {
    let account = await PaymentAccount.findOne({ user: req.user._id }).lean();
    if (!account) account = await PaymentAccount.create({ user: req.user._id });
    res.status(200).json({ success: true, data: { account } });
  });

// POST '/financials/payment-account/bank'
export const postFinancialsPaymentAccountBank = asyncHandler(async (req, res) => {
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType, isPrimary, cancelledChequeUrl } = req.body;
    if (!accountHolderName || !accountNumber || !ifscCode) return res.status(400).json({ success: false, message: 'accountHolderName, accountNumber, and ifscCode are required.' });
    let account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) account = new PaymentAccount({ user: req.user._id });
    if (isPrimary) account.bankAccounts.forEach((b) => { b.isPrimary = false; });
    account.bankAccounts.push({ accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType: accountType || 'Current', isPrimary: isPrimary || account.bankAccounts.length === 0, cancelledChequeUrl });
    await account.save();
    await sysLog(req, { level: 'info', category: 'user', message: 'Bank account added', metadata: { bankName, ifscCode } });
    res.status(201).json({ success: true, message: 'Bank account added.', data: { account } });
  });

// PATCH '/financials/payment-account/bank/:bankId'
export const patchFinancialsPaymentAccountBankByBankId = asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    const bank = account.bankAccounts.id(req.params.bankId);
    if (!bank)    return res.status(404).json({ success: false, message: 'Bank account not found.' });
    const { accountHolderName, ifscCode, bankName, branchName, accountType, isPrimary, cancelledChequeUrl } = req.body;
    if (isPrimary) account.bankAccounts.forEach((b) => { b.isPrimary = false; });
    if (accountHolderName)  bank.accountHolderName  = accountHolderName;
    if (ifscCode)           bank.ifscCode           = ifscCode;
    if (bankName)           bank.bankName           = bankName;
    if (branchName)         bank.branchName         = branchName;
    if (accountType)        bank.accountType        = accountType;
    if (cancelledChequeUrl) bank.cancelledChequeUrl = cancelledChequeUrl;
    if (typeof isPrimary === 'boolean') bank.isPrimary = isPrimary;
    await account.save();
    res.status(200).json({ success: true, message: 'Bank account updated.', data: { account } });
  });

// DELETE '/financials/payment-account/bank/:bankId'
export const deleteFinancialsPaymentAccountBankByBankId = asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    account.bankAccounts.pull({ _id: req.params.bankId });
    await account.save();
    res.status(200).json({ success: true, message: 'Bank account removed.' });
  });

// POST '/financials/payment-account/upi'
export const postFinancialsPaymentAccountUpi = asyncHandler(async (req, res) => {
    const { upiId, upiName, isPrimary } = req.body;
    if (!upiId) return res.status(400).json({ success: false, message: 'upiId is required.' });
    let account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) account = new PaymentAccount({ user: req.user._id });
    if (isPrimary) account.upiHandles.forEach((u) => { u.isPrimary = false; });
    account.upiHandles.push({ upiId, upiName, isPrimary: isPrimary || account.upiHandles.length === 0 });
    await account.save();
    res.status(201).json({ success: true, message: 'UPI handle added.', data: { account } });
  });

// DELETE '/financials/payment-account/upi/:upiId'
export const deleteFinancialsPaymentAccountUpiByUpiId = asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    account.upiHandles.pull({ _id: req.params.upiId });
    await account.save();
    res.status(200).json({ success: true, message: 'UPI handle removed.' });
  });

// GET '/financials/settlements'
export const getFinancialsSettlements = asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id }).lean();
    res.status(200).json({ success: true, data: { pendingBalance: account?.pendingBalance || 0, totalEarned: account?.totalEarned || 0, totalSettled: account?.totalSettled || 0, totalDeductions: account?.totalDeductions || 0, preferredPayoutMethod: account?.preferredPayoutMethod || 'Bank Transfer', payoutCycle: account?.payoutCycle || 'Weekly', primaryBank: account?.bankAccounts?.find(b => b.isPrimary) || null, primaryUpi: account?.upiHandles?.find(u => u.isPrimary) || null, settlementHistory: (account?.settlementHistory || []).slice(-20) } });
  });

// POST '/financials/settlements/request'
export const postFinancialsSettlementsRequest = asyncHandler(async (req, res) => {
    const { amount, method, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required.' });
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    if (amount > account.pendingBalance) return res.status(400).json({ success: false, message: `Requested amount exceeds pending balance of ₹${account.pendingBalance}.` });
    account.pendingBalance = parseFloat((account.pendingBalance - amount).toFixed(2));
    account.totalSettled   = parseFloat((account.totalSettled   + amount).toFixed(2));
    account.lastSettledAt  = new Date();
    account.settlementHistory.push({ amount, method: method || account.preferredPayoutMethod || 'Bank Transfer', note: note || '', settledAt: new Date(), settledBy: req.user._id });
    await account.save();
    await sysLog(req, { level: 'success', category: 'payment', message: `Settlement ₹${amount} requested by ${req.user.name}`, metadata: { amount, method, storeId: req.pharmacy.store._id } });
    const pharmacyUser = await User.findById(req.user._id).select('email name').lean();
    if (pharmacyUser?.email) {
      const html = buildSettlementEmail({ userName: pharmacyUser.name, amount, method: method || account.preferredPayoutMethod, storeName: req.pharmacy.store.storeName, settledAt: new Date(), remaining: account.pendingBalance });
      sendEmail({ email: pharmacyUser.email, subject: `[Likeson Healthcare] Settlement of ₹${amount} processed`, html }).catch((err) => logError('SETTLEMENT_EMAIL', err));
    }
    logAudit('SETTLEMENT_REQUESTED', { storeId: req.pharmacy.store._id, amount });
    res.status(200).json({ success: true, message: `Settlement of ₹${amount} recorded.`, data: { pendingBalance: account.pendingBalance, totalSettled: account.totalSettled } });
  });

// GET '/financials/settlements/history'
export const getFinancialsSettlementsHistory = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const account = await PaymentAccount.findOne({ user: req.user._id }).lean();
    if (!account) return res.status(200).json({ success: true, data: { history: [], pagination: {} } });
    const history    = account.settlementHistory || [];
    const totalCount = history.length;
    const paginated  = [...history].reverse().slice(skip, skip + limit);
    res.status(200).json({ success: true, data: { history: paginated, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount } } });
  });

// GET '/analytics/overview'
export const getAnalyticsOverview = asyncHandler(async (req, res) => {
    const { dateFilter = 'today' } = req.query;
    const dateRange = parseDateFilter(dateFilter);
    const storeId   = req.pharmacy.store._id;
    const filter    = { store: storeId, isArchived: false, createdAt: dateRange };

    const [totalOrders, revenueData, statusBreakdown, inventorySummary] = await Promise.all([
      PharmacyOrder.countDocuments(filter),
      PharmacyOrder.aggregate([{ $match: { ...filter, 'payment.status': 'Paid' } }, { $group: { _id: null, total: { $sum: '$billing.totalPayable' }, gst: { $sum: '$billing.gstAmount' } } }]),
      PharmacyOrder.aggregate([{ $match: filter }, { $group: { _id: '$delivery.status', count: { $sum: 1 } } }]),
      Promise.all([
        MedicineInventory.countDocuments({ storeId, isLowStock: true, isActive: true, isDeleted: false }),
        MedicineInventory.countDocuments({ storeId, isOutOfStock: true, isActive: true, isDeleted: false }),
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        totalRevenue:   revenueData[0]?.total || 0,
        gstCollected:   revenueData[0]?.gst   || 0,
        statusBreakdown: statusBreakdown.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        inventory: {
          lowStockCount:  inventorySummary[0],
          outOfStockCount:inventorySummary[1],
        },
      },
    });
  });

// GET '/analytics/revenue'
export const getAnalyticsRevenue = asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days' } = req.query;
    const dateRange    = parseDateFilter(dateFilter);
    const revenueByDay = await PharmacyOrder.aggregate([{ $match: { store: req.pharmacy.store._id, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$billing.totalPayable' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    res.status(200).json({ success: true, data: { revenueByDay } });
  });

// GET '/analytics/returns'
export const getAnalyticsReturns = asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days' } = req.query;
    const dateRange     = parseDateFilter(dateFilter);
    const returnMetrics = await PharmacyOrder.aggregate([{ $match: { store: req.pharmacy.store._id, isArchived: false, 'delivery.status': { $in: ['Return_Requested', 'Return_Accepted', 'Returned'] }, createdAt: dateRange } }, { $group: { _id: '$delivery.status', count: { $sum: 1 }, totalValue: { $sum: '$billing.totalPayable' } } }]);
    res.status(200).json({ success: true, data: { returnMetrics } });
  });

// GET '/analytics/top-medicines'
export const getAnalyticsTopMedicines = asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days' } = req.query;
    const dateRange    = parseDateFilter(dateFilter);
    const topMedicines = await PharmacyOrder.aggregate([
      { $match: { store: req.pharmacy.store._id, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } },
      { $unwind: '$items' },
      { $group: { _id: '$items.medicine', name: { $first: '$items.name' }, brandName: { $first: '$items.brandName' }, totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.pricePerUnit', '$items.quantity'] } } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(req.query.limit, 10) || 10 },
    ]);
    res.status(200).json({ success: true, data: { topMedicines } });
  });

// GET '/analytics/inventory-value'
export const getAnalyticsInventoryValue = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;

    const result = await MedicineInventory.aggregate([
      { $match: { storeId, isActive: true, isDeleted: false } },
      {
        $group: {
          _id:             null,
          totalSKUs:       { $sum: 1 },
          totalUnits:      { $sum: '$stockQuantity' },
          totalMRPValue:   { $sum: { $multiply: ['$mrp', '$stockQuantity'] } },
          totalSellValue:  { $sum: { $multiply: ['$finalPrice', '$availableStock'] } },
          totalCostValue:  { $sum: { $multiply: ['$purchasePrice', '$stockQuantity'] } },
        },
      },
    ]);

    const data = result[0] || { totalSKUs: 0, totalUnits: 0, totalMRPValue: 0, totalSellValue: 0, totalCostValue: 0 };

    res.status(200).json({ success: true, data });
  });

// GET '/profile'
export const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({ success: true, data: { user } });
  });

// PUT '/profile'
export const putProfile = asyncHandler(async (req, res) => {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { ...(name && { name }), ...(phone && { phone }), ...(avatar && { avatar }) }, { new: true }).select('-password');
    await sysLog(req, { level: 'info', category: 'user', message: `Profile updated by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'Profile updated.', data: { user } });
  });

// PUT '/profile/password'
export const putProfilePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: 'All fields required.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be 8+ characters.' });
    const user  = await User.findById(req.user._id);
    const valid = await user.matchPassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect.' });
    user.password = newPassword;
    await user.save();
    await sysLog(req, { level: 'success', category: 'auth', message: `Password changed by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'Password changed.' });
  });

// GET '/profile/pharmacy'
export const getProfilePharmacy = asyncHandler(async (req, res) => {
    const pharmacyProfile = await PharmacyProfile.findOne({ user: req.user._id }).populate('assignedStore');
    res.status(200).json({ success: true, data: { pharmacyProfile } });
  });

// PUT '/profile/pharmacy'
export const putProfilePharmacy = asyncHandler(async (req, res) => {
    const { experienceYears, qualification } = req.body;
    const pharmacyProfile = await PharmacyProfile.findOneAndUpdate(
      { user: req.user._id },
      { ...(typeof experienceYears === 'number' && { experienceYears }), ...(qualification && { qualification }) },
      { new: true }
    );
    res.status(200).json({ success: true, message: 'Pharmacy profile updated.', data: { pharmacyProfile } });
  });

// GET '/store'
export const getStore = asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: { store: req.pharmacy.store } });
  });

// PUT '/store'
export const putStore = asyncHandler(async (req, res) => {
    const { deliveryRadiusKm, estimatedDeliveryTime, timings, status } = req.body;
    const store = await PharmacyStore.findByIdAndUpdate(
      req.pharmacy.store._id,
      {
        ...(typeof deliveryRadiusKm === 'number' && { 'deliverySettings.deliveryRadiusKm': deliveryRadiusKm }),
        ...(estimatedDeliveryTime && { 'deliverySettings.estimatedDeliveryTime': estimatedDeliveryTime }),
        ...(timings && { timings }),
        ...(status && { status }),
      },
      { new: true }
    );
    await invalidateStoreCache(req.pharmacy.store._id);
    await sysLog(req, { level: 'info', category: 'system', message: `Store settings updated: ${req.pharmacy.store.storeName}`, relatedEntity: { model: 'PharmacyStore', entityId: req.pharmacy.store._id } });
    res.status(200).json({ success: true, message: 'Store updated.', data: { store } });
  });

// GET '/store/inventory-summary'
export const getStoreInventorySummary = asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const now     = new Date();
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() + EXPIRY_ALERT_DAYS);

    const [totals, lowStock, outOfStock, expiringSoon] = await Promise.all([
      MedicineInventory.aggregate([
        { $match: { storeId, isActive: true, isDeleted: false } },
        { $group: {
          _id:        null,
          totalSKUs:  { $sum: 1 },
          totalUnits: { $sum: '$stockQuantity' },
          totalValue: { $sum: { $multiply: ['$finalPrice', '$availableStock'] } },
        }},
      ]),
      MedicineInventory.countDocuments({ storeId, isLowStock: true,    isActive: true, isDeleted: false }),
      MedicineInventory.countDocuments({ storeId, isOutOfStock: true,  isActive: true, isDeleted: false }),
      MedicineBatch.countDocuments({ storeId, isNearExpiry: true, status: 'Active', isDeleted: false, remainingQuantity: { $gt: 0 } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSKUs:          totals[0]?.totalSKUs   || 0,
        totalUnits:         totals[0]?.totalUnits  || 0,
        totalInventoryValue:totals[0]?.totalValue  || 0,
        lowStockCount:      lowStock,
        outOfStockCount:    outOfStock,
        expiringSoonCount:  expiringSoon,
        lowStockThreshold:  LOW_STOCK_THRESHOLD,
        expiryAlertDays:    EXPIRY_ALERT_DAYS,
      },
    });
  });

// GET '/audit/sessions'
export const getAuditSessions = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions');
    res.status(200).json({ success: true, data: { sessions: user?.auditSessions || [] } });
  });

// DELETE '/audit/sessions/:sessionId'
export const deleteAuditSessionsBySessionId = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $pull: { auditSessions: { _id: req.params.sessionId } } });
    await sysLog(req, { level: 'info', category: 'security', message: `Session ${req.params.sessionId} revoked` });
    res.status(200).json({ success: true, message: 'Session revoked.' });
  });

// DELETE '/audit/all-sessions'
export const deleteAuditAllSessions = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { auditSessions: [] });
    await sysLog(req, { level: 'warning', category: 'security', message: `All sessions revoked by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'All sessions revoked.' });
  });

// GET '/audit/devices'
export const getAuditDevices = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('deviceTokens');
    res.status(200).json({ success: true, data: { devices: user?.deviceTokens || [] } });
  });

// DELETE '/audit/devices/:deviceId'
export const deleteAuditDevicesByDeviceId = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $pull: { deviceTokens: { _id: req.params.deviceId } } });
    await sysLog(req, { level: 'info', category: 'security', message: `Device ${req.params.deviceId} removed` });
    res.status(200).json({ success: true, message: 'Device removed.' });
  });

// DELETE '/audit/devices'
export const deleteAuditDevices = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { deviceTokens: [] });
    await sysLog(req, { level: 'warning', category: 'security', message: `All devices removed by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'All devices removed.' });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  logError('UNHANDLED_ERROR', err, { path: req.originalUrl, method: req.method });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Validation Error', details: Object.values(err.errors).map((e) => e.message) });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate entry for ${field}.` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: `File size must not exceed ${MAX_FILE_SIZE_MB} MB.` });
  }
  if (err.isAxiosError) {
    return res.status(502).json({ success: false, message: 'Upstream service error.', detail: process.env.NODE_ENV === 'development' ? err.response?.data || err.message : undefined });
  }

  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal Server Error' });
};
