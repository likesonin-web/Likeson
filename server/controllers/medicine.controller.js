import slugify          from 'slugify';
import mongoose         from 'mongoose';
import multer           from 'multer';
import axios            from 'axios';
import FormData         from 'form-data';
import xlsx             from 'xlsx';
import * as pdfParse    from 'pdf-parse';

import Medicine         from '../models/Medicine.js';
import MedicineInventory from '../models/MedicineInventory.js';
import MedicineBatch    from '../models/MedicineBatch.js';
import InventoryMovement from '../models/InventoryMovement.js';
import HsnCode          from '../models/HsnCode.js';
import User             from '../models/User.js';
import Notification     from '../models/Notification.js';
import PharmacyProfile  from '../models/PharmacyProfile.js';
import PharmacyStore    from '../models/PharmacyStore.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler     from '../utils/asyncHandler.js';
import sendEmail        from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';
import redisClient      from '../config/redis.js';


// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_GST_SLABS     = [0, 5, 12, 18, 28];
const MAX_FILE_SIZE_MB    = 20;
const MAX_FILE_BYTES      = MAX_FILE_SIZE_MB * 1024 * 1024;
const LOW_STOCK_THRESHOLD = 10;
const EXPIRY_ALERT_DAYS   = 30;

const IMAGEKIT = {
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  id:          process.env.IMAGEKITID,
  uploadUrl:   'https://upload.imagekit.io/api/files/upload',
  folder:      '/likeson/hsn-uploads',
};

const HSN_COLUMN_ALIASES = {
  hsnCode:        ['hsn code', 'hsncode', 'hsn', 'code', 'hsn_code'],
  description:    ['description', 'desc', 'product description', 'item description', 'product desc'],
  chapterHeading: ['chapter heading', 'chapter', 'heading', 'chapter_heading'],
  gstPercentage:  ['gst %', 'gst%', 'gst percentage', 'tax %', 'rate', 'igst %', 'gst rate', 'tax rate'],
};

// ─────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const auditLog = (action, userId, metadata = {}) => {
  console.log(`[AUDIT_LOG] ${JSON.stringify({
    timestamp:   new Date().toISOString(),
    action,
    performedBy: userId || 'system',
    metadata,
    environment: process.env.NODE_ENV || 'development',
    service:     'medicine-router',
  })}`);
};

const getDashboardLink = (role, path) => {
  const baseUrls = {
    superadmin: 'https://likeson.in/super-admin',
    admin:      'https://likeson.in/admin',
    pharmacy:   'https://likeson.in/pharmacy',
  };
  return `${baseUrls[role] || 'https://likeson.in/dashboard'}${path}`;
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page, 10)  || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const resolveHsnCodeId = async (value, session = null) => {
  if (!value) return undefined;
  if (OBJECT_ID_REGEX.test(String(value))) return value;
  const normalized = String(value).toUpperCase().replace(/\s/g, '').trim();
  const opts       = session ? { session } : {};
  const hsn        = await HsnCode.findOne({ hsnCode: normalized, isActive: true }, '_id', opts);
  if (!hsn) {
    throw new Error(
      `HSN code '${normalized}' not found or inactive. ` +
      `Upload first via POST /api/medicines/hsn/upload or POST /api/medicines/hsn.`
    );
  }
  return hsn._id;
};

// ─────────────────────────────────────────────────────────────────────────────
// § INVENTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const createOrTopUpInventory = async ({
  medicineId,
  storeId,
  supplierId,
  batchNumber,
  expiryDate,
  manufacturingDate,
  mrp,
  sellingPrice,
  discountPercent = 0,
  purchasePrice,
  purchaseInvoiceNo,
  purchaseInvoiceDate,
  purchaseOrderId,
  stockQuantity,
  rackLocation,
  actorId,
  session,
  referenceModel = 'Manual',
  referenceId    = null,
  reason         = 'Stock added',
}) => {
  const opts = session ? { session } : {};

  // 1. Upsert MedicineInventory (one per store+medicine)
  let inv = await MedicineInventory.findOne({ medicineId, storeId }).session(session || null);
  const prevStock = inv?.stockQuantity || 0;
  const isNewInv  = !inv;

  if (!inv) {
    inv = new MedicineInventory({
      medicineId,
      storeId,
      mrp,
      sellingPrice,
      discountPercent,
      createdBy: actorId,
    });
  } else {
    if (mrp)            inv.mrp            = mrp;
    if (sellingPrice)   inv.sellingPrice    = sellingPrice;
    inv.discountPercent = discountPercent;
  }

  if (supplierId)   inv.supplierId   = supplierId;
  if (rackLocation) inv.rackLocation = rackLocation;
  inv.stockQuantity   = (inv.stockQuantity || 0) + Number(stockQuantity);
  inv.availableStock  = Math.max(0, inv.stockQuantity - (inv.reservedStock || 0));
  inv.isOutOfStock    = inv.availableStock <= 0;
  inv.isLowStock      = !inv.isOutOfStock && inv.availableStock <= (inv.reorderLevel || LOW_STOCK_THRESHOLD);
  inv.isActive        = true;
  inv.isDeleted       = false;
  inv.updatedBy       = actorId;
  await inv.save(opts);

  // 2. Upsert MedicineBatch
  let batch = await MedicineBatch.findOne({ medicineId, storeId, batchNumber }).session(session || null);
  if (batch) {
    batch.remainingQuantity  = (batch.remainingQuantity || 0) + Number(stockQuantity);
    batch.quantityPurchased += Number(stockQuantity);
    batch.expiryDate         = new Date(expiryDate);
    if (purchasePrice)       batch.purchasePrice       = purchasePrice;
    if (purchaseInvoiceNo)   batch.purchaseInvoiceNo   = purchaseInvoiceNo;
    if (purchaseInvoiceDate) batch.purchaseInvoiceDate = new Date(purchaseInvoiceDate);
    if (purchaseOrderId)     batch.purchaseOrderId     = purchaseOrderId;
    if (supplierId)          batch.supplierId          = supplierId;
    batch.updatedBy = actorId;
    await batch.save(opts);
  } else {
    [batch] = await MedicineBatch.create([{
      medicineId,
      storeId,
      supplierId:          supplierId || null,
      purchaseOrderId:     purchaseOrderId || null,
      batchNumber,
      manufacturingDate:   manufacturingDate ? new Date(manufacturingDate) : undefined,
      expiryDate:          new Date(expiryDate),
      purchasePrice:       purchasePrice || null,
      purchaseInvoiceNo:   purchaseInvoiceNo || null,
      purchaseInvoiceDate: purchaseInvoiceDate ? new Date(purchaseInvoiceDate) : undefined,
      quantityPurchased:   Number(stockQuantity),
      remainingQuantity:   Number(stockQuantity),
      status:              'Active',
      createdBy:           actorId,
    }], opts);
  }

  // 3. Update FEFO pointer on inventory
  const earliestBatch = await MedicineBatch.findOne({
    medicineId, storeId, status: 'Active', isDeleted: false,
    remainingQuantity: { $gt: 0 },
  }).sort({ fifoPriority: 1 }).session(session || null);

  if (earliestBatch) {
    inv.batchId = earliestBatch._id;
    await inv.save(opts);
  }

  // 4. Log movement
  await InventoryMovement.create([{
    storeId,
    medicineId,
    batchId:         batch._id,
    movementType:    'Purchase',
    quantityChanged: Number(stockQuantity),
    previousStock:   prevStock,
    newStock:        inv.stockQuantity,
    referenceModel,
    referenceId,
    reason,
    performedBy:     actorId,
  }], opts);

  return { inv, batch, prevStock, isNewInv };
};

const ensureStoreInventoryRecord = async (medicineId, storeId, actorId, medicine, session = null) => {
  const opts = session ? { session } : {};
  const existing = await MedicineInventory.findOne({ medicineId, storeId }, '_id', opts);
  if (existing) return { created: false };

  await MedicineInventory.create([{
    medicineId,
    storeId,
    mrp:             medicine.referenceMrp || 0,
    sellingPrice:    medicine.referenceMrp || 0,
    discountPercent: 0,
    stockQuantity:   0,
    reservedStock:   0,
    availableStock:  0,
    reorderLevel:    10,
    isLowStock:      false,
    isOutOfStock:    true,
    isActive:        true,
    isDeleted:       false,
    createdBy:       actorId,
    updatedBy:       actorId,
  }], opts);

  return { created: true };
};

const syncInventoryAllStores = async (medicineId, medicine, actorId, session = null) => {
  const opts   = session ? { session } : {};
  const stores = await PharmacyStore.find({ status: { $ne: 'Inactive' } }, '_id', opts).lean();

  const existingRecords = await MedicineInventory.find(
    { medicineId, isDeleted: false },
    'storeId',
    opts
  ).lean();
  const existingSet = new Set(existingRecords.map((r) => r.storeId.toString()));

  let added = 0;
  for (const store of stores) {
    if (existingSet.has(store._id.toString())) continue;
    await MedicineInventory.create([{
      medicineId,
      storeId:         store._id,
      mrp:             medicine.referenceMrp || 0,
      sellingPrice:    medicine.referenceMrp || 0,
      discountPercent: 0,
      stockQuantity:   0,
      reservedStock:   0,
      availableStock:  0,
      reorderLevel:    10,
      isLowStock:      false,
      isOutOfStock:    true,
      isActive:        true,
      isDeleted:       false,
      createdBy:       actorId,
      updatedBy:       actorId,
    }], opts);
    added++;
  }
  return added;
};

// ─────────────────────────────────────────────────────────────────────────────
// § STORE LIFECYCLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const removeStoreInventory = async (storeId, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));

  const [invResult] = await Promise.all([
    MedicineInventory.updateMany(
      { storeId: storeObjId, isDeleted: false },
      { $set: { isDeleted: true, isActive: false, deletedAt: new Date(), deletedBy: actorId } }
    ),
    MedicineBatch.updateMany(
      { storeId: storeObjId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: actorId } }
    ),
  ]);

  auditLog('STORE_DELETE_INVENTORY_PURGE', actorId, {
    storeId:           storeId.toString(),
    inventoryUpdated:  invResult.modifiedCount,
  });

  return invResult.modifiedCount;
};

const suspendStoreInventory = async (storeId, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));
  const result = await MedicineInventory.updateMany(
    { storeId: storeObjId, isDeleted: false },
    { $set: { isActive: false, updatedBy: actorId } }
  );
  auditLog('STORE_SUSPENDED_INVENTORY_PAUSED', actorId, {
    storeId: storeId.toString(), count: result.modifiedCount,
  });
  return result.modifiedCount;
};

const resumeStoreInventory = async (storeId, store, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));
  const result = await MedicineInventory.updateMany(
    { storeId: storeObjId, isDeleted: false },
    { $set: { isActive: true, updatedBy: actorId } }
  );
  auditLog('STORE_UNSUSPENDED_INVENTORY_RESUMED', actorId, {
    storeId: storeId.toString(), count: result.modifiedCount,
  });
  await triggerLowStockAlertsForStore(storeId, store, actorId);
  return result.modifiedCount;
};

// ─────────────────────────────────────────────────────────────────────────────
// § LOW STOCK ALERT
// ─────────────────────────────────────────────────────────────────────────────

const triggerLowStockAlertsForStore = async (storeId, store, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));

  const lowStockRecords = await MedicineInventory.find({
    storeId:        storeObjId,
    isActive:       true,
    isDeleted:      false,
    availableStock: { $lte: LOW_STOCK_THRESHOLD },
  })
    .populate('medicineId', 'name brandName genericName images packaging manufacturer')
    .lean();

  if (!lowStockRecords.length) return;

  const [admins, pharmacyProfile] = await Promise.all([
    User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id'),
    PharmacyProfile.findOne({ assignedStore: storeObjId }).populate('user', '_id email name'),
  ]);

  const recipientIds = admins.map((a) => a._id);
  if (pharmacyProfile?.user?._id) recipientIds.push(pharmacyProfile.user._id);

  await Notification.insertMany(recipientIds.map((recipientId) => ({
    recipient: recipientId,
    title:     `⚠️ Low Stock Alert — ${store.storeName}`,
    body:      `${lowStockRecords.length} medicine(s) at ${store.storeName} have stock ≤ ${LOW_STOCK_THRESHOLD} units.`,
    type:      'Medicine_Ready',
    priority:  'High',
    metadata:  { storeId: storeId.toString(), storeName: store.storeName, medicineCount: lowStockRecords.length },
  })));

  const medicineRowsHtml = lowStockRecords.map((rec) => {
    const med        = rec.medicineId;
    const stockQty   = rec.availableStock ?? 0;
    const stockColor = stockQty === 0 ? '#dc2626' : '#d97706';
    const primaryImg = med?.images?.find((img) => img.isPrimary)?.url || med?.images?.[0]?.url || null;

    const imageTag = primaryImg
      ? `<img src="${primaryImg}" alt="${med?.brandName}" width="60" height="60" style="border-radius:6px;object-fit:cover;border:1px solid #e2e8f0;" />`
      : `<div style="width:60px;height:60px;border-radius:6px;background:#f1f5f9;font-size:11px;color:#94a3b8;border:1px solid #e2e8f0;">No Image</div>`;

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 8px;vertical-align:middle;">${imageTag}</td>
        <td style="padding:12px 8px;vertical-align:middle;">
          <div style="font-weight:600;color:#1e293b;font-size:14px;">${med?.brandName ?? '—'}</div>
          <div style="color:#64748b;font-size:12px;">${med?.genericName ?? ''}</div>
          <div style="color:#94a3b8;font-size:11px;">${med?.packaging ?? ''}</div>
        </td>
        <td style="padding:12px 8px;vertical-align:middle;font-size:12px;color:#64748b;">${med?.manufacturer ?? '—'}</td>
        <td style="padding:12px 8px;vertical-align:middle;text-align:center;">
          <span style="background:${stockQty === 0 ? '#fef2f2' : '#fffbeb'};color:${stockColor};
            padding:3px 10px;border-radius:999px;font-weight:700;font-size:13px;
            border:1px solid ${stockQty === 0 ? '#fecaca' : '#fde68a'};">${stockQty} units</span>
        </td>
        <td style="padding:12px 8px;vertical-align:middle;text-align:right;font-weight:600;color:#1e293b;font-size:13px;">
          ₹${rec.mrp?.toFixed(2) ?? '—'}
        </td>
      </tr>`;
  }).join('');

  const emailBody = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:24px 28px;border-radius:10px 10px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">⚠️ Low Stock Alert</h1>
        <p style="margin:6px 0 0;color:#fecaca;font-size:14px;">${store.storeName} — ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:20px 28px;">
        <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
          <strong>${lowStockRecords.length} medicine(s)</strong> at <strong>${store.storeName}</strong>
          currently have stock at or below <strong>${LOW_STOCK_THRESHOLD} units</strong>.
        </p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:0 28px 20px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
              <th style="padding:10px 8px;text-align:left;color:#64748b;font-weight:600;font-size:11px;">Image</th>
              <th style="padding:10px 8px;text-align:left;color:#64748b;font-weight:600;font-size:11px;">Medicine</th>
              <th style="padding:10px 8px;text-align:left;color:#64748b;font-weight:600;font-size:11px;">Manufacturer</th>
              <th style="padding:10px 8px;text-align:center;color:#64748b;font-weight:600;font-size:11px;">Stock</th>
              <th style="padding:10px 8px;text-align:right;color:#64748b;font-weight:600;font-size:11px;">MRP</th>
            </tr>
          </thead>
          <tbody>${medicineRowsHtml}</tbody>
        </table>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:20px 28px;text-align:center;">
        <a href="${getDashboardLink('pharmacy', '/inventory')}"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Update Inventory Now
        </a>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Daily alerts continue until stock is replenished above ${LOW_STOCK_THRESHOLD} units.</p>
      </div>
    </div>`;

  const adminEmails = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('email').lean();
  const emailAddresses = adminEmails.map((u) => u.email);
  if (store.contact?.email) emailAddresses.push(store.contact.email);
  if (pharmacyProfile?.user?.email) emailAddresses.push(pharmacyProfile.user.email);

  const uniqueEmails = [...new Set(emailAddresses.filter(Boolean))];
  await Promise.allSettled(
    uniqueEmails.map((email) =>
      sendEmail({
        email,
        subject: `[LOW STOCK] ${lowStockRecords.length} medicine(s) need restocking — ${store.storeName}`,
        html:    emailBody,
      }).catch((err) => console.error(`[LowStockEmail] Failed for ${email}:`, err.message))
    )
  );

  auditLog('LOW_STOCK_ALERT_SENT', actorId || 'system', {
    storeId:           storeId.toString(),
    storeName:         store.storeName,
    lowStockCount:     lowStockRecords.length,
    emailsSent:        uniqueEmails.length,
    notificationsSent: recipientIds.length,
  });
};

export const sendDailyLowStockEmails = async () => {
  console.log('[DailyLowStock] Starting daily low-stock email run…');
  const stores = await PharmacyStore.find({ status: 'Open' }).lean();
  for (const store of stores) {
    try {
      await triggerLowStockAlertsForStore(store._id, store, 'system');
    } catch (err) {
      console.error(`[DailyLowStock] Error for store ${store._id}:`, err.message);
    }
  }
  console.log(`[DailyLowStock] Done — processed ${stores.length} store(s).`);
};

// ─────────────────────────────────────────────────────────────────────────────
// § PRICING BREAKDOWN (order-level, mirrors pharmacyRouter helper)
// ─────────────────────────────────────────────────────────────────────────────

const computeOrderPricingBreakdown = async (order, store) => {
  const config      = await PlatformPricingConfig.getGlobal();
  const pharmacyCfg = config?.pharmacy || {};

  const platformFee      = pharmacyCfg.platformFee || { type: 'percentage', value: 10 };
  const ownStoreMarginPc = pharmacyCfg.ownStoreMarginPercent || 30;
  const partnerCommPc    = store?.bankDetails?.commissionPercent || 0;

  const total      = order.billing?.totalPayable    || 0;
  const subTotal   = order.billing?.subTotal        || 0;
  const gst        = order.billing?.gstAmount       || 0;
  const delivery   = order.billing?.deliveryCharges || 0;
  const discount   = order.billing?.discountAmount  || 0;
  const walletUsed = order.billing?.walletAmountUsed|| 0;
  const platformFeeAmt = order.billing?.platformFee || 0;

  let platformCut = 0;
  if (platformFee.type === 'percentage') {
    platformCut = parseFloat(((subTotal * platformFee.value) / 100).toFixed(2));
  } else {
    platformCut = platformFee.value;
  }

  const isOwnedStore = store?.storeType === 'Owned';
  const commissionPc = isOwnedStore ? ownStoreMarginPc : partnerCommPc;

  let platformRevenue = parseFloat(((subTotal * commissionPc) / 100).toFixed(2));
  let storePayout     = parseFloat((subTotal - platformRevenue).toFixed(2));
  let storeMarginPc   = 100 - commissionPc;

  const deliveryAgentPayout = delivery > 0
    ? Math.min(delivery, pharmacyCfg.deliveryAgentPayout || 30)
    : 0;

  const isCOD      = order.payment?.method === 'COD';
  const codRemit   = isCOD ? parseFloat((platformRevenue + gst).toFixed(2)) : 0;
  const codStoreNet = isCOD ? parseFloat((storePayout - deliveryAgentPayout).toFixed(2)) : 0;
  const onlineStoreNet = !isCOD ? parseFloat((storePayout - deliveryAgentPayout).toFixed(2)) : 0;

  return {
    order: {
      orderId:        order.orderId,
      paymentMethod:  order.payment?.method,
      paymentStatus:  order.payment?.status,
      deliveryStatus: order.delivery?.status,
    },
    customerPaid: {
      subTotal,
      gst,
      deliveryCharges:  delivery,
      discountDeducted: discount,
      walletDeducted:   walletUsed,
      totalPayable:     total,
    },
    platformConfig: {
      feeType:           platformFee.type,
      feeValue:          platformFee.value,
      storeType:         store?.storeType,
      commissionPercent: commissionPc,
      ownStoreMarginPc:  isOwnedStore ? ownStoreMarginPc : null,
    },
    breakdown: {
      platformRevenue,
      platformFeeAmt,
      storePayout,
      storeMarginPercent:  storeMarginPc,
      deliveryAgentPayout,
      gstOnOrder:          gst,
    },
    cod: isCOD ? {
      storeCollectedCash:  total,
      mustRemitToPlatform: codRemit,
      storeNetAfterRemit:  codStoreNet,
      remitBreakdown: { platformRevenue, gstPayable: gst },
    } : null,
    online: !isCOD ? {
      platformCollected:             total,
      storeNetPayout:                onlineStoreNet,
      estimatedPayoutAfterCycle:     onlineStoreNet,
    } : null,
    pricingConfigSnapshot: {
      configName:            config?.configName,
      pharmacyPlatformFee:   pharmacyCfg.platformFee,
      freeDeliveryAbove:     pharmacyCfg.freeDeliveryMinOrderValue,
      expressDeliveryCharge: pharmacyCfg.expressDeliveryCharge,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// § REDIS CACHE
// ─────────────────────────────────────────────────────────────────────────────

const cache = (ttlSeconds = 60, keyFn = null) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    const cacheKey = keyFn ? keyFn(req) : `${req.method}:${req.originalUrl}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(JSON.parse(cached)); }
    } catch (err) { console.error('[Cache READ error]', err.message); }
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(body)); }
        catch (err) { console.error('[Cache WRITE error]', err.message); }
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
};

const invalidateHsnCache = async () => {
  try {
    const keys = await redisClient.keys('GET:*hsn*');
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) { console.error('[Cache INVALIDATE error]', err.message); }
};

const invalidateMedicineCache = async (medicineId) => {
  try {
    const keys = await redisClient.keys(`*medicine*${medicineId}*`);
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) { console.error('[Cache INVALIDATE medicine]', err.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// § MULTER
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

// ─────────────────────────────────────────────────────────────────────────────
// § IMAGEKIT
// ─────────────────────────────────────────────────────────────────────────────

const uploadToImageKit = async (buffer, fileName, folder = IMAGEKIT.folder) => {
  const formData = new FormData();
  formData.append('file',              buffer, { filename: fileName });
  formData.append('fileName',          fileName);
  formData.append('folder',            folder);
  formData.append('useUniqueFileName', 'true');
  const auth = Buffer.from(`${IMAGEKIT.privateKey}:`).toString('base64');
  const response = await axios.post(IMAGEKIT.uploadUrl, formData, {
    headers:       { ...formData.getHeaders(), Authorization: `Basic ${auth}` },
    maxBodyLength: MAX_FILE_BYTES + 1024,
    timeout:       30_000,
  });
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// § HSN PARSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
    if (match) rows.push({ 'HSN Code': match[1].trim(), 'Description': match[2].trim(), 'Chapter Heading': match[3] ? match[3].trim() : '', 'GST %': match[4].trim() });
  }
  if (!rows.length) throw new Error('Could not extract HSN rows from PDF. Use Excel template.');
  return rows;
};

const upsertHsnRows = async (rows, userId, source = 'manual') => {
  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];
  for (const raw of rows) {
    const row = normalizeHsnRow(raw);
    if (!row.hsnCode)       { errors.push(`Row skipped — missing HSN code: ${JSON.stringify(raw)}`); skipped++; continue; }
    if (!/^\d{4,8}$/.test(row.hsnCode)) { errors.push(`Row skipped — invalid format: ${row.hsnCode}`); skipped++; continue; }
    if (row.gstPercentage === null || !VALID_GST_SLABS.includes(row.gstPercentage)) { errors.push(`Row skipped — invalid GST for ${row.hsnCode}: ${row.gstPercentage}`); skipped++; continue; }
    if (!row.description)   { errors.push(`Row skipped — missing description for: ${row.hsnCode}`); skipped++; continue; }
    try {
      const existing = await HsnCode.findOne({ hsnCode: row.hsnCode });
      if (existing) {
        existing.description    = row.description    || existing.description;
        existing.chapterHeading = row.chapterHeading || existing.chapterHeading;
        existing.gstPercentage  = row.gstPercentage;
        existing.uploadedBy     = userId;
        existing.uploadSource   = source;
        existing.isActive       = true;
        await existing.save();
        updated++;
      } else {
        await HsnCode.create({ hsnCode: row.hsnCode, description: row.description, chapterHeading: row.chapterHeading, gstPercentage: row.gstPercentage, uploadedBy: userId, uploadSource: source, isActive: true });
        inserted++;
      }
    } catch (err) {
      errors.push(err.code === 11000 ? `Duplicate key on ${row.hsnCode} — skipped.` : `Error on ${row.hsnCode}: ${err.message}`);
    }
  }
  return { inserted, updated, skipped, errors };
};

// ═══════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION HSN — HSN CODE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/** [H1] GET /api/medicines/hsn */

// GET '/hsn'
export const getHsn = asyncHandler(async (req, res) => {
  const { search, gst, chapter, isActive = 'true', page = 1, limit = 20, sort = 'hsnCode' } = req.query;
  const query = {};
  if (isActive !== 'all') query.isActive = isActive !== 'false';
  if (gst) { const g = parseFloat(gst); if (VALID_GST_SLABS.includes(g)) query.gstPercentage = g; }
  if (chapter) query.chapterHeading = { $regex: chapter, $options: 'i' };
  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ hsnCode: { $regex: esc, $options: 'i' } }, { description: { $regex: esc, $options: 'i' } }];
  }
  const sortMap  = { hsnCode: { hsnCode: 1 }, hsnCode_desc: { hsnCode: -1 }, gst_asc: { gstPercentage: 1 }, gst_desc: { gstPercentage: -1 }, newest: { createdAt: -1 } };
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
      sourceBreakdown:  [{ $group: { _id: '$uploadSource',  count: { $sum: 1 } } }],
      activeVsInactive: [{ $group: { _id: '$isActive',      count: { $sum: 1 } } }],
      totals:           [{ $group: { _id: null, total: { $sum: 1 } } }],
    }}]);
    res.status(200).json({ success: true, data: stats[0], generatedAt: new Date() });
  });

// POST '/hsn/bulk-delete'
export const postHsnBulkDelete = asyncHandler(async (req, res) => {
    const { codes } = req.body;
    if (!Array.isArray(codes) || !codes.length)
      return res.status(400).json({ success: false, message: 'Provide a non-empty array of HSN codes in "codes".' });
    const normalized = codes.map((c) => String(c).toUpperCase().replace(/\s/g, '').trim());
    const result     = await HsnCode.updateMany({ hsnCode: { $in: normalized }, isActive: true }, { $set: { isActive: false } });
    await invalidateHsnCache();
    auditLog('HSN_BULK_DEACTIVATE', req.user._id, { requestedCodes: normalized, deactivatedCount: result.modifiedCount });
    res.status(200).json({ success: true, message: `${result.modifiedCount} HSN code(s) deactivated.`, matched: result.matchedCount, deactivated: result.modifiedCount });
  });

// POST '/hsn/upload'
export const postHsnUpload = asyncHandler(async (req, res) => {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No file uploaded. Send multipart/form-data with field "file".' });

    const { buffer, originalname, mimetype, size } = req.file;
    const ext = (originalname.split('.').pop() || '').toLowerCase();

    let imagekitResult;
    try {
      const safeBaseName = originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      imagekitResult     = await uploadToImageKit(buffer, `${safeBaseName}_${Date.now()}.${ext}`);
    } catch (uploadErr) {
      return res.status(502).json({ success: false, message: 'Failed to upload file to ImageKit.', detail: process.env.NODE_ENV === 'development' ? uploadErr.message : undefined });
    }

    let rows = [], source;
    const isExcel = ['xlsx','xls','csv'].includes(ext) || mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype === 'text/csv';
    const isPdf   = ext === 'pdf' || mimetype === 'application/pdf';

    try {
      if (isExcel)    { rows = parseExcelBuffer(buffer); source = 'excel'; }
      else if (isPdf) { rows = await parsePdfBuffer(buffer); source = 'pdf'; }
      else            { try { rows = parseExcelBuffer(buffer); source = 'excel'; } catch { return res.status(415).json({ success: false, message: `Unsupported file type: ${mimetype || ext}.`, imagekitUrl: imagekitResult.url }); } }
    } catch (parseErr) {
      return res.status(422).json({ success: false, message: `Failed to parse file: ${parseErr.message}`, imagekitUrl: imagekitResult.url });
    }

    if (!rows?.length)
      return res.status(422).json({ success: false, message: 'No data rows found in file.', imagekitUrl: imagekitResult.url });

    const result    = await upsertHsnRows(rows, req.user._id, source);
    await invalidateHsnCache();
    auditLog('HSN_BULK_UPLOAD', req.user._id, { source, file: originalname, size, imagekitUrl: imagekitResult.url, totalRows: rows.length, ...result });
    const hasErrors = result.errors.length > 0;
    res.status(hasErrors ? 207 : 200).json({
      success: true,
      message: hasErrors ? 'Upload completed with some row-level errors.' : 'Upload and upsert completed successfully.',
      upload:  { imagekitUrl: imagekitResult.url, imagekitFileId: imagekitResult.fileId, fileName: imagekitResult.name, originalName: originalname, source },
      result:  { totalRows: rows.length, inserted: result.inserted, updated: result.updated, skipped: result.skipped, errorCount: result.errors.length, errors: result.errors.slice(0, 50) },
    });
  });

// GET '/hsn/:code'
export const getHsnByCode = asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    if (!/^\d{4,8}$/.test(code))
      return res.status(400).json({ success: false, message: 'Invalid HSN code format. Must be 4–8 digits.' });
    const hsn = await HsnCode.findOne({ hsnCode: code, isActive: true }).lean();
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found or inactive.` });
    res.status(200).json({ success: true, data: { _id: hsn._id, hsnCode: hsn.hsnCode, description: hsn.description, chapterHeading: hsn.chapterHeading, gstPercentage: hsn.gstPercentage, cgstPercentage: hsn.cgstPercentage, sgstPercentage: hsn.sgstPercentage, igstPercentage: hsn.igstPercentage, isActive: hsn.isActive } });
  });

// POST '/hsn'
export const postHsn = asyncHandler(async (req, res) => {
    const { hsnCode, description, chapterHeading, gstPercentage } = req.body;
    if (!hsnCode || !description || gstPercentage === undefined)
      return res.status(400).json({ success: false, message: 'hsnCode, description, and gstPercentage are required.' });
    const normalizedCode = String(hsnCode).toUpperCase().replace(/\s/g, '').trim();
    if (!/^\d{4,8}$/.test(normalizedCode))
      return res.status(400).json({ success: false, message: 'hsnCode must be 4–8 digits.' });
    const gstNum = parseFloat(gstPercentage);
    if (!VALID_GST_SLABS.includes(gstNum))
      return res.status(400).json({ success: false, message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}` });
    const existing = await HsnCode.findOne({ hsnCode: normalizedCode });
    if (existing) return res.status(409).json({ success: false, message: `HSN code '${normalizedCode}' already exists.`, existingId: existing._id });
    const hsn = await HsnCode.create({ hsnCode: normalizedCode, description: String(description).trim(), chapterHeading: chapterHeading ? String(chapterHeading).trim() : undefined, gstPercentage: gstNum, uploadedBy: req.user._id, uploadSource: 'manual' });
    await invalidateHsnCache();
    auditLog('HSN_CREATE', req.user._id, { hsnCode: normalizedCode, gstPercentage: gstNum });
    res.status(201).json({ success: true, data: hsn });
  });

// PATCH '/hsn/:code'
export const patchHsnByCode = asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const { description, chapterHeading, gstPercentage, isActive } = req.body;
    const hsn = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found.` });
    if (description    !== undefined) hsn.description    = String(description).trim();
    if (chapterHeading !== undefined) hsn.chapterHeading = String(chapterHeading).trim();
    if (isActive       !== undefined) hsn.isActive       = Boolean(isActive);
    if (gstPercentage  !== undefined) {
      const gstNum = parseFloat(gstPercentage);
      if (!VALID_GST_SLABS.includes(gstNum))
        return res.status(400).json({ success: false, message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}` });
      hsn.gstPercentage = gstNum;
    }
    hsn.uploadedBy = req.user._id; hsn.uploadSource = 'manual';
    await hsn.save();
    await invalidateHsnCache();
    auditLog('HSN_UPDATE', req.user._id, { hsnCode: code });
    res.status(200).json({ success: true, data: hsn });
  });

// DELETE '/hsn/:code'
export const deleteHsnByCode = asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const hsn  = await HsnCode.findOne({ hsnCode: code });
    if (!hsn)          return res.status(404).json({ success: false, message: `HSN code '${code}' not found.` });
    if (!hsn.isActive) return res.status(409).json({ success: false, message: `HSN code '${code}' is already inactive.` });
    hsn.isActive = false;
    await hsn.save();
    await invalidateHsnCache();
    auditLog('HSN_DEACTIVATE', req.user._id, { hsnCode: code });
    res.status(200).json({ success: true, message: `HSN code '${code}' has been deactivated.` });
  });

// GET '/'
export const get = asyncHandler(async (req, res) => {
  const { search, category, schedule, minPrice, maxPrice, sort, page = 1, limit = 50, isPrescriptionRequired } = req.query;
  const query = { isDiscontinued: false, isDeleted: false };
  
  if (search) {
    // Escape special characters to prevent regex crashes on user input
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: esc, $options: 'i' } },
      { brandName: { $regex: esc, $options: 'i' } },
      { genericName: { $regex: esc, $options: 'i' } },
      { indications: { $regex: esc, $options: 'i' } }, // Catches symptoms like "fever"
      { 'saltComposition.ingredient': { $regex: esc, $options: 'i' } }, // Catches salts
      { category: { $regex: esc, $options: 'i' } },
      { searchKeywords: { $regex: esc, $options: 'i' } },
      { drugForm: { $regex: esc, $options: 'i' } },
      { therapeuticClass: { $regex: esc, $options: 'i' } }
    ];
  }
  if (category)  query.category = { $in: category.split(',') };
  if (schedule)  query.schedule = { $in: schedule.split(',') };
  if (isPrescriptionRequired !== undefined) query.isPrescriptionRequired = isPrescriptionRequired === 'true';
if (minPrice || maxPrice) {
    query.referenceMrp = {};
    if (minPrice) query.referenceMrp.$gte = Number(minPrice);
    if (maxPrice && maxPrice !== '1000000') query.referenceMrp.$lte = Number(maxPrice);
  }
  
  // UPDATED: Map the frontend sort keys to exact MongoDB sort objects
  const sortOptions = { 
    brandName_asc:   { brandName: 1 }, 
    brandName_desc:  { brandName: -1 }, 
    genericName_asc: { genericName: 1 }, 
    createdAt_desc:  { createdAt: -1 }, 
    popularity_desc: { createdAt: -1 } // Fallback to newest if no popularity score exists
  };
  
  const pageNum     = Math.max(1, Number(page));
  const limitNum    = Number(limit);
  const [medicines, count] = await Promise.all([
    Medicine.find(query)
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .sort(sortOptions[sort] || { createdAt: -1 })
      .limit(limitNum).skip((pageNum - 1) * limitNum).lean(),
    Medicine.countDocuments(query),
  ]);
  res.status(200).json({ success: true, count, metadata: { totalPages: Math.ceil(count / limitNum), currentPage: pageNum, pageSize: limitNum }, data: medicines });
});

// GET '/stores/nearby'
export const getStoresNearby = asyncHandler(async (req, res) => {
    const { lat, lng, radiusKm = 5, limit = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng query params are required.' });
    const stores = await PharmacyStore.find({
      status: 'Open', isVerified: true,
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radiusKm) * 1000,
        },
      },
    })
      .select('storeName address contact deliverySettings status specializations timings slug storeType')
      .limit(Math.min(50, parseInt(limit, 10))).lean();
    res.status(200).json({ success: true, count: stores.length, data: stores });
  });

// GET '/admin/stats'
export const getAdminStats = asyncHandler(async (req, res) => {
    const [medicineStats, inventoryStats, expiryAlerts] = await Promise.all([
      Medicine.aggregate([{ $facet: {
        categoryStats:     [{ $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$referenceMrp' } } }],
        discontinuedCount: [{ $match: { isDiscontinued: true } }, { $count: 'count' }],
        totalCount:        [{ $count: 'count' }],
      }}]),
      MedicineInventory.aggregate([{ $facet: {
        totalStock:    [{ $group: { _id: null, totalStock: { $sum: '$stockQuantity' }, totalValue: { $sum: { $multiply: ['$finalPrice', '$availableStock'] } } } }],
        lowStockCount: [{ $match: { isLowStock: true,   isActive: true, isDeleted: false } }, { $count: 'count' }],
        outOfStock:    [{ $match: { isOutOfStock: true, isActive: true, isDeleted: false } }, { $count: 'count' }],
      }}]),
      MedicineBatch.countDocuments({
        expiryDate: { $lte: new Date(Date.now() + EXPIRY_ALERT_DAYS * 24 * 60 * 60 * 1000), $gte: new Date() },
        status:     'Active',
        isDeleted:  false,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        catalogue:   medicineStats[0],
        inventory:   inventoryStats[0],
        expiryAlerts,
        timestamp:   new Date(),
      },
    });
  });

// POST '/restock-request'
export const postRestockRequest = asyncHandler(async (req, res) => {
    const { medicineId, quantityRequired } = req.body;
    if (!medicineId || !quantityRequired)
      return res.status(400).json({ success: false, message: 'medicineId and quantityRequired are required.' });
    const [medicine, admins] = await Promise.all([
      Medicine.findById(medicineId).lean(),
      User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id'),
    ]);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    await Notification.insertMany(admins.map((adm) => ({
      recipient: adm._id,
      title:     '🔴 URGENT: Restock Required',
      body:      `Pharmacy requested ${quantityRequired} units of ${medicine.brandName}.`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { medicineId, quantityRequired, requestedBy: req.user._id },
    })));
    auditLog('RESTOCK_REQUEST', req.user._id, { medicineId, quantityRequired });
    res.status(200).json({ success: true, message: 'Restock request logged and admins notified.' });
  });

// POST '/sync-inventory/all'
export const postSyncInventoryAll = asyncHandler(async (req, res) => {
    const medicines = await Medicine.find({ isDiscontinued: false, isDeleted: false }).lean();
    let totalAdded = 0, medicinesSynced = 0;
    const errors   = [];

    for (const medicine of medicines) {
      try {
        const added = await syncInventoryAllStores(medicine._id, medicine, req.user._id);
        if (added > 0) { totalAdded += added; medicinesSynced++; }
      } catch (err) {
        errors.push({ medicineId: medicine._id.toString(), error: err.message });
      }
    }

    auditLog('MEDICINE_INVENTORY_BULK_SYNC', req.user._id, { totalMedicines: medicines.length, medicinesSynced, totalAdded, errors: errors.length });
    res.status(errors.length > 0 ? 207 : 200).json({ success: true, totalMedicines: medicines.length, medicinesSynced, totalEntriesAdded: totalAdded, errors });
  });

// GET '/orders/:orderId/pricing-breakdown'
export const getOrdersByOrderIdPricingBreakdown = asyncHandler(async (req, res) => {
    // Dynamic import to avoid circular dep if PharmacyOrder is in same bundle
    const PharmacyOrder = (await import('../models/PharmacyOrder.js')).default;

    const order = await PharmacyOrder.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(req.params.orderId) ? [{ _id: new mongoose.Types.ObjectId(req.params.orderId) }] : []),
        { orderId: req.params.orderId },
      ],
    })
      .populate('store',    'storeName storeType bankDetails contact address')
      .populate('customer', 'name email phone')
      .lean({ virtuals: true });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const store     = await PharmacyStore.findById(order.store?._id || order.store).lean();
    const breakdown = await computeOrderPricingBreakdown(order, store);

    res.status(200).json({ success: true, data: breakdown });
  });

// GET '/inventory/low-stock'
export const getInventoryLowStock = asyncHandler(async (req, res) => {
    const { storeId, page = 1, limit = 20 } = req.query;
    let filterStoreId = storeId;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore)
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      filterStoreId = profile.assignedStore.toString();
    }

    const { skip } = getPagination({ page, limit });
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = { isLowStock: true, isActive: true, isDeleted: false };
    if (filterStoreId) filter.storeId = new mongoose.Types.ObjectId(filterStoreId);

    const [results, total] = await Promise.all([
      MedicineInventory.find(filter)
        .populate('medicineId', 'name brandName genericName images packaging manufacturer hsnCode gstPercentage')
        .populate('storeId',    'storeName address.city status')
        .populate('batchId',    'batchNumber expiryDate remainingQuantity')
        .sort({ availableStock: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      MedicineInventory.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, total, metadata: { currentPage: pageNum, totalPages: Math.ceil(total / limitNum), pageSize: limitNum }, data: results });
  });

// GET '/inventory/expiry-alerts'
export const getInventoryExpiryAlerts = asyncHandler(async (req, res) => {
    const { days = EXPIRY_ALERT_DAYS, storeId, page = 1, limit = 20 } = req.query;
    const daysNum = Math.max(1, parseInt(days, 10));
    let filterStoreId = storeId;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore)
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      filterStoreId = profile.assignedStore.toString();
    }

    const now       = new Date();
    const threshold = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);
    const { skip }  = getPagination({ page, limit });
    const pageNum   = Math.max(1, parseInt(page, 10));
    const limitNum  = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const batchFilter = {
      expiryDate:        { $gte: now, $lte: threshold },
      status:            'Active',
      isDeleted:         false,
      remainingQuantity: { $gt: 0 },
    };
    if (filterStoreId) batchFilter.storeId = new mongoose.Types.ObjectId(filterStoreId);

    const [results, totalDocs] = await Promise.all([
      MedicineBatch.find(batchFilter)
        .populate('medicineId', 'name brandName genericName images packaging hsnCode gstPercentage')
        .populate('storeId',    'storeName address.city status')
        .populate('supplierId', 'name code')
        .sort({ expiryDate: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean({ virtuals: true }),
      MedicineBatch.countDocuments(batchFilter),
    ]);

    res.status(200).json({ success: true, total: totalDocs, withinDays: daysNum, metadata: { currentPage: pageNum, totalPages: Math.ceil(totalDocs / limitNum), pageSize: limitNum }, data: results });
  });

// DELETE '/stores/:storeId'
export const deleteStoresByStoreId = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const store = await PharmacyStore.findById(storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found.' });

    const inventoryCount = await removeStoreInventory(storeId, req.user._id);
    await PharmacyStore.findByIdAndDelete(storeId);

    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
    await Notification.insertMany(admins.map((a) => ({
      recipient: a._id,
      title:     `🗑️ Store Deleted — ${store.storeName}`,
      body:      `Store "${store.storeName}" permanently deleted. ${inventoryCount} inventory records soft-deleted.`,
      type:      'Medicine_Ready', priority: 'High',
      metadata:  { storeId, storeName: store.storeName, inventoryCount },
    })));

    auditLog('STORE_DELETED', req.user._id, { storeId, storeName: store.storeName, inventoryCount });
    res.status(200).json({ success: true, message: `Store "${store.storeName}" deleted. ${inventoryCount} inventory records soft-deleted.`, inventoryCount });
  });

// PATCH '/stores/:storeId/suspend'
export const patchStoresByStoreIdSuspend = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const { reason }  = req.body;
    const store       = await PharmacyStore.findById(storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found.' });
    if (store.status === 'Inactive')          return res.status(409).json({ success: false, message: `Store "${store.storeName}" is permanently inactive.` });
    if (store.status === 'Under-Maintenance') return res.status(409).json({ success: false, message: `Store "${store.storeName}" is already suspended.` });

    store.status = 'Under-Maintenance'; store.updatedBy = req.user._id;
    await store.save();

    const count = await suspendStoreInventory(storeId, req.user._id);

    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
    await Notification.insertMany(admins.map((a) => ({
      recipient: a._id,
      title:     `⏸️ Store Suspended — ${store.storeName}`,
      body:      `Store "${store.storeName}" suspended. ${count} inventory entries paused.${reason ? ` Reason: ${reason}` : ''}`,
      type:      'Medicine_Ready', priority: 'High',
      metadata:  { storeId, storeName: store.storeName, reason, count },
    })));

    const pharmacyProfile = await PharmacyProfile.findOne({ assignedStore: storeId }).populate('user', 'email name').lean();
    if (pharmacyProfile?.user?.email) {
      sendEmail({
        email:   pharmacyProfile.user.email,
        subject: `[STORE SUSPENDED] ${store.storeName} — Action Required`,
        html:    transactionalTemplate({
          header:     'STORE SUSPENSION NOTICE',
          title:      `Your store "${store.storeName}" has been suspended`,
          body:       `Your store has been placed under maintenance.${reason ? `<br><br><strong>Reason:</strong> ${reason}` : ''}<br><br>Contact your administrator.`,
          buttonText: 'Contact Support',
          buttonLink: getDashboardLink('pharmacy', '/support'),
        }),
      }).catch((err) => console.error('[SuspendEmail] Failed:', err.message));
    }

    auditLog('STORE_SUSPENDED', req.user._id, { storeId, storeName: store.storeName, reason, count });
    res.status(200).json({ success: true, message: `Store "${store.storeName}" suspended. ${count} inventory entries paused.`, count });
  });

// PATCH '/stores/:storeId/unsuspend'
export const patchStoresByStoreIdUnsuspend = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const store       = await PharmacyStore.findById(storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found.' });
    if (store.status === 'Open')     return res.status(409).json({ success: false, message: `Store "${store.storeName}" is already open.` });
    if (store.status === 'Inactive') return res.status(409).json({ success: false, message: `Store "${store.storeName}" is permanently inactive.` });

    store.status = 'Open'; store.updatedBy = req.user._id;
    await store.save();

    const count = await resumeStoreInventory(storeId, store, req.user._id);

    const [admins, pharmacyProfile] = await Promise.all([
      User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id'),
      PharmacyProfile.findOne({ assignedStore: storeId }).populate('user', '_id email name').lean(),
    ]);
    const recipientIds = admins.map((a) => a._id);
    if (pharmacyProfile?.user?._id) recipientIds.push(pharmacyProfile.user._id);
    await Notification.insertMany(recipientIds.map((recipientId) => ({
      recipient: recipientId,
      title:     `✅ Store Reopened — ${store.storeName}`,
      body:      `Store "${store.storeName}" unsuspended. ${count} inventory entries restored.`,
      type:      'Medicine_Ready', priority: 'High',
      metadata:  { storeId, storeName: store.storeName, count },
    })));

    if (pharmacyProfile?.user?.email) {
      sendEmail({
        email:   pharmacyProfile.user.email,
        subject: `[STORE REOPENED] ${store.storeName} is back online`,
        html:    transactionalTemplate({
          header:     'STORE REOPENED',
          title:      `Your store "${store.storeName}" is now active`,
          body:       `Your store has been unsuspended and is now accepting orders. All medicine inventory has been restored.<br><br><strong>Note:</strong> Please review inventory — some medicines may need restocking.`,
          buttonText: 'View Inventory',
          buttonLink: getDashboardLink('pharmacy', '/inventory'),
        }),
      }).catch((err) => console.error('[UnsuspendEmail] Failed:', err.message));
    }

    auditLog('STORE_UNSUSPENDED', req.user._id, { storeId, storeName: store.storeName, count });
    res.status(200).json({ success: true, message: `Store "${store.storeName}" is now open. ${count} inventory entries restored.`, count });
  });

// POST '/stores/low-stock/trigger'
export const postStoresLowStockTrigger = asyncHandler(async (req, res) => {
    const { storeId } = req.body;
    if (storeId) {
      const store = await PharmacyStore.findById(storeId).lean();
      if (!store) return res.status(404).json({ success: false, message: 'Store not found.' });
      await triggerLowStockAlertsForStore(storeId, store, req.user._id);
      auditLog('LOW_STOCK_MANUAL_TRIGGER', req.user._id, { storeId });
      return res.status(200).json({ success: true, message: `Low-stock alerts triggered for store "${store.storeName}".` });
    }
    await sendDailyLowStockEmails();
    auditLog('LOW_STOCK_MANUAL_TRIGGER_ALL', req.user._id, {});
    res.status(200).json({ success: true, message: 'Low-stock alerts triggered for all open stores.' });
  });

// GET '/stores'
export const getStores = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, storeType, search } = req.query;
    const { skip } = getPagination({ page, limit });
    const query    = {};
    if (status)    query.status    = status;
    if (storeType) query.storeType = storeType;
    if (search)    query.storeName = { $regex: search, $options: 'i' };
    const [stores, total] = await Promise.all([
      PharmacyStore.find(query)
        .populate('managedBy', 'name email phone avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PharmacyStore.countDocuments(query),
    ]);
    res.status(200).json({ success: true, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }, data: stores });
  });

// GET '/stores/my/store'
export const getStoresMyStore = asyncHandler(async (req, res) => {
    const profile = await PharmacyProfile.findOne({ user: req.user._id })
      .populate({ path: 'assignedStore', select: '-bankDetails' })
      .lean();
    if (!profile?.assignedStore)
      return res.status(404).json({ success: false, message: 'No store assigned to your account.' });
    res.status(200).json({ success: true, data: profile.assignedStore });
  });

// GET '/stores/slug/:slug'
export const getStoresSlugBySlug = asyncHandler(async (req, res) => {
    const store = await PharmacyStore.findOne({ slug: req.params.slug })
      .select('-bankDetails')
      .populate('managedBy', 'name email')
      .lean();
    if (!store) return res.status(404).json({ success: false, message: 'Store not found.' });
    res.status(200).json({ success: true, data: store });
  });

// GET '/stores/:id'
export const getStoresById = asyncHandler(async (req, res) => {
    const query = PharmacyStore.findById(req.params.id).populate('managedBy', 'name email phone');
    if (!['admin', 'superadmin'].includes(req.user.role)) query.select('-bankDetails');
    const store = await query.lean();
    if (!store) return res.status(404).json({ success: false, message: 'Store not found.' });
    res.status(200).json({ success: true, data: store });
  });

// GET '/stores/:storeId/inventory-summary'
export const getStoresByStoreIdInventorySummary = asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore || profile.assignedStore.toString() !== storeId)
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);
    const now        = new Date();
    const cutoff     = new Date();
    cutoff.setDate(cutoff.getDate() + EXPIRY_ALERT_DAYS);

    const [totals, lowStock, outOfStock, expiringSoon, totalBatches] = await Promise.all([
      MedicineInventory.aggregate([
        { $match: { storeId: storeObjId, isActive: true, isDeleted: false } },
        { $group: {
          _id:             null,
          totalSKUs:       { $sum: 1 },
          totalUnits:      { $sum: '$stockQuantity' },
          totalMRPValue:   { $sum: { $multiply: ['$mrp', '$stockQuantity'] } },
          totalSellValue:  { $sum: { $multiply: ['$finalPrice', '$availableStock'] } },
        }},
      ]),
      MedicineInventory.countDocuments({ storeId: storeObjId, isLowStock:   true, isActive: true, isDeleted: false }),
      MedicineInventory.countDocuments({ storeId: storeObjId, isOutOfStock: true, isActive: true, isDeleted: false }),
      MedicineBatch.countDocuments({ storeId: storeObjId, isNearExpiry: true, status: 'Active', isDeleted: false, remainingQuantity: { $gt: 0 } }),
      MedicineBatch.countDocuments({ storeId: storeObjId, status: 'Active', isDeleted: false, remainingQuantity: { $gt: 0 } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSKUs:           totals[0]?.totalSKUs   || 0,
        totalUnits:          totals[0]?.totalUnits  || 0,
        totalMRPValue:       parseFloat((totals[0]?.totalMRPValue  || 0).toFixed(2)),
        totalSellValue:      parseFloat((totals[0]?.totalSellValue || 0).toFixed(2)),
        lowStockCount:       lowStock,
        outOfStockCount:     outOfStock,
        expiringSoonCount:   expiringSoon,
        activeBatchCount:    totalBatches,
        lowStockThreshold:   LOW_STOCK_THRESHOLD,
        expiryAlertDays:     EXPIRY_ALERT_DAYS,
      },
    });
  });

// GET '/:slug'
export const getBySlug = asyncHandler(async (req, res) => {
    const medicine = await Medicine.findOne({ slug: req.params.slug, isDiscontinued: false, isDeleted: false })
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    // Per-store inventory — MedicineInventory is source of truth
    const invRecords = await MedicineInventory.find({
      medicineId: medicine._id, isActive: true, isDeleted: false,
    })
      .populate('storeId',    'storeName contact address status priority deliverySettings storeType bankDetails')
      .populate('batchId',    'batchNumber expiryDate remainingQuantity isNearExpiry daysUntilExpiry')
      .populate('supplierId', 'name code')
      .lean({ virtuals: true });

    // Per-store pricing breakdown: margin + platform fee + COD info
    const config      = await PlatformPricingConfig.getGlobal().catch(() => null);
    const pharmacyCfg = config?.pharmacy || {};
    const platformFee = pharmacyCfg.platformFee || { type: 'percentage', value: 10 };
    const ownMarginPc = pharmacyCfg.ownStoreMarginPercent || 30;

    const enrichedInventory = invRecords.map((inv) => {
      const store       = inv.storeId;
      const isOwned     = store?.storeType === 'Owned';
      const commPc      = isOwned ? ownMarginPc : (store?.bankDetails?.commissionPercent || 0);
      const finalPrice  = inv.finalPrice || inv.sellingPrice || 0;

      let platformCut = 0;
      if (platformFee.type === 'percentage') {
        platformCut = parseFloat(((finalPrice * commPc) / 100).toFixed(2));
      } else {
        platformCut = platformFee.value;
      }

      const storeNet = parseFloat((finalPrice - platformCut).toFixed(2));

      return {
        ...inv,
        pricingBreakdown: {
          mrp:               inv.mrp,
          sellingPrice:      inv.sellingPrice,
          discountPercent:   inv.discountPercent,
          finalPrice,
          platformCutPercent: commPc,
          platformCut,
          storeNetPerUnit:   storeNet,
          storeType:         store?.storeType,
          note:              isOwned
            ? `Platform keeps ${ownMarginPc}% margin on own store`
            : `Platform earns ${commPc}% commission from partner store`,
        },
      };
    });

    res.status(200).json({ success: true, data: { ...medicine, storeInventory: enrichedInventory } });
  });

// POST '/'
export const post = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const medicineData     = { ...req.body };
      medicineData.createdBy = req.user._id;

      // Strip inventory-related fields — they don't belong on Medicine
      const {
        storeId, initialStock, expiryDate, batchNumber, pricePerUnit,
        mrp: bodyMrp, sellingPrice: bodySellingPrice, discountPercent: bodyDiscount,
        purchasePrice: bodyPurchasePrice, supplierId: bodySupplier,
        ...catalogueData
      } = medicineData;

      // Resolve HSN
      if (catalogueData.hsnCode) catalogueData.hsnCode = await resolveHsnCodeId(catalogueData.hsnCode, session);

      // Auto slug
      if (!catalogueData.slug && catalogueData.brandName) {
        catalogueData.slug = `${slugify(catalogueData.brandName, { lower: true })}-${Date.now()}`;
      }

      catalogueData.createdBy = req.user._id;
      const [medicine] = await Medicine.create([catalogueData], { session });

      let targetStoreId = storeId;

      // Pharmacy role: use assigned store
      if (req.user.role === 'pharmacy' && !targetStoreId) {
        const profile = await PharmacyProfile.findOne({ user: req.user._id }).session(session);
        if (!profile?.assignedStore)
          throw new Error('Pharmacist must be assigned to a store before adding products.');
        targetStoreId = profile.assignedStore;
      }

      // If initial stock provided — create real inventory record
      if (targetStoreId && initialStock && initialStock > 0 && expiryDate && batchNumber) {
        const mrpVal          = bodyMrp || medicine.referenceMrp || 0;
        const sellingPriceVal = bodySellingPrice || mrpVal;
        await createOrTopUpInventory({
          medicineId:      medicine._id,
          storeId:         targetStoreId,
          supplierId:      bodySupplier || null,
          batchNumber,
          expiryDate,
          mrp:             mrpVal,
          sellingPrice:    sellingPriceVal,
          discountPercent: bodyDiscount || 0,
          purchasePrice:   bodyPurchasePrice || null,
          stockQuantity:   initialStock,
          actorId:         req.user._id,
          session,
          reason:          'Initial stock on medicine creation',
        });
      } else if (targetStoreId) {
        // Create zero-stock placeholder for the target store
        await ensureStoreInventoryRecord(medicine._id, targetStoreId, req.user._id, medicine, session);
      }

      // Sync zero-stock placeholders for all remaining stores
      await syncInventoryAllStores(medicine._id, medicine, req.user._id, session);

      await session.commitTransaction();
      await invalidateMedicineCache(medicine._id);

      const populated = await Medicine.findById(medicine._id)
        .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
        .lean();

      auditLog('MEDICINE_CREATE', req.user._id, { medicineId: medicine._id });
      res.status(201).json({ success: true, data: populated });

    } catch (error) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: error.message });
    } finally {
      session.endSession();
    }
  });

// PATCH '/:id'
export const patchById = asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    // Pharmacy role: catalogue fields only, no stock here
    if (req.user.role === 'pharmacy') {
      return res.status(403).json({
        success: false,
        message: 'Pharmacy role cannot edit catalogue metadata. Use POST /medicines/:id/inventory/:storeId/add-stock to update stock.',
      });
    }

    // Strip inventory fields — they live in MedicineInventory, not Medicine
    const {
      storeId, initialStock, expiryDate, batchNumber, pricePerUnit,
      inventory, mrp, sellingPrice, stockQuantity, ...coreFields
    } = req.body;

    if (coreFields.hsnCode) coreFields.hsnCode = await resolveHsnCodeId(coreFields.hsnCode);
    Object.assign(medicine, coreFields, { updatedBy: req.user._id });
    await medicine.save();

    // Sync new placeholders for any stores added since last sync
    await syncInventoryAllStores(medicine._id, medicine, req.user._id);
    await invalidateMedicineCache(medicine._id);

    auditLog('MEDICINE_METADATA_UPDATE', req.user._id, { medicineId: medicine._id });
    const populated = await Medicine.findById(medicine._id)
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .lean();
    res.status(200).json({ success: true, data: populated });
  });

// DELETE '/:id'
export const deleteById = asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    medicine.isDiscontinued    = true;
    medicine.isDeleted         = true;
    medicine.discontinuedReason= req.body.reason || 'Discontinued by admin';
    medicine.deletedAt         = new Date();
    medicine.deletedBy         = req.user._id;
    medicine.updatedBy         = req.user._id;
    await medicine.save();

    // Soft-delete all MedicineInventory records for this medicine
    await MedicineInventory.updateMany(
      { medicineId: medicine._id, isDeleted: false },
      { $set: { isActive: false, isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id } }
    );

    await invalidateMedicineCache(medicine._id);

    const pharmacies = await User.find({ role: 'pharmacy' }).select('email');
    await Promise.allSettled(pharmacies.map((p) =>
      sendEmail({
        email:   p.email,
        subject: `[COMPLIANCE] ${medicine.brandName} Withdrawn`,
        html:    transactionalTemplate({
          header:     'PRODUCT RECALL / DISCONTINUATION',
          title:      'Urgent Action Required',
          body:       `The product <b>${medicine.brandName}</b> (${medicine.genericName}) has been discontinued. Remove from active shelves immediately.`,
          buttonText: 'View Inventory',
          buttonLink: getDashboardLink('pharmacy', '/inventory'),
        }),
      })
    ));

    auditLog('MEDICINE_DISCONTINUE', req.user._id, { medicineId: medicine._id });
    res.status(200).json({ success: true, message: 'Medicine discontinued and pharmacies notified.' });
  });

// GET '/:id/inventory'
export const getByIdInventory = asyncHandler(async (req, res) => {
    
    // 1. Failsafe check: Ensure the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid Medicine ID format.' });
    }

    // 2. Find the medicine (ignoring soft-deleted ones)
    const medicine = await Medicine.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    }).lean();

    // If it STILL returns 'Medicine not found' after this update, 
    // the ID '1775f4e57dc6634fac47e03d' genuinely does not exist in your MongoDB database!
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    let filterStoreId = null;
    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore)
        return res.status(403).json({ success: false, message: 'No store assigned.' });
      filterStoreId = profile.assignedStore.toString();
    }

    const filter = { medicineId: medicine._id, isDeleted: false };
    if (filterStoreId) filter.storeId = new mongoose.Types.ObjectId(filterStoreId);

    const records = await MedicineInventory.find(filter)
      .populate('storeId',    'storeName address.city status priority storeType bankDetails')
      .populate('batchId',    'batchNumber expiryDate remainingQuantity isNearExpiry daysUntilExpiry')
      .populate('supplierId', 'name code')
      .lean({ virtuals: true });

    // Enrich each record with platform pricing breakdown
    const config      = await PlatformPricingConfig.getGlobal().catch(() => null);
    const pharmacyCfg = config?.pharmacy || {};
    const platformFee = pharmacyCfg.platformFee || { type: 'percentage', value: 10 };
    const ownMarginPc = pharmacyCfg.ownStoreMarginPercent || 30;

    const enriched = records.map((inv) => {
      const store      = inv.storeId;
      const isOwned    = store?.storeType === 'Owned';
      const commPc     = isOwned ? ownMarginPc : (store?.bankDetails?.commissionPercent || 0);
      const finalPrice = inv.finalPrice || inv.sellingPrice || 0;

      let platformCut = platformFee.type === 'percentage'
        ? parseFloat(((finalPrice * commPc) / 100).toFixed(2))
        : platformFee.value;

      const storeNet  = parseFloat((finalPrice - platformCut).toFixed(2));
      const gstOnUnit = parseFloat(((finalPrice * (medicine.gstPercentage || 0)) / 100).toFixed(2));

      return {
        ...inv,
        pricingBreakdown: {
          mrp:               inv.mrp,
          sellingPrice:      inv.sellingPrice,
          discountPercent:   inv.discountPercent,
          discountAmount:    inv.discountAmount,
          finalPrice,
          gstPerUnit:        gstOnUnit,
          platformCutPercent: commPc,
          platformCut,
          storeNetPerUnit:   storeNet,
          storeType:         store?.storeType,
          cod: {
            storeCollectsPerUnit:   finalPrice,
            mustRemitPerUnit:       parseFloat((platformCut + gstOnUnit).toFixed(2)),
            storeKeepsAfterRemit:   parseFloat((storeNet - gstOnUnit).toFixed(2)),
          },
          note: isOwned
            ? `Platform keeps ${ownMarginPc}% margin`
            : `Platform earns ${commPc}% commission`,
        },
      };
    });

    res.status(200).json({ success: true, count: enriched.length, data: enriched });
  });

// GET '/inventory/store/:storeId'
export const getInventoryStoreByStoreId = asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    // Security check for pharmacy role
    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore || profile.assignedStore.toString() !== storeId)
        return res.status(403).json({ success: false, message: 'Access denied to this store.' });
    }

    // Fetch all inventory for this specific store
    const records = await MedicineInventory.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      isDeleted: false,
    })
      .populate('medicineId', 'name brandName genericName category images packaging hsnCode gstPercentage')
      .populate('batchId', 'batchNumber expiryDate remainingQuantity isNearExpiry')
      .lean({ virtuals: true });

    res.status(200).json({ success: true, count: records.length, data: records });
  });

// GET '/:id/inventory/:storeId'
export const getByIdInventoryByStoreId = asyncHandler(async (req, res) => {
    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore)
        return res.status(403).json({ success: false, message: 'No store assigned.' });
      if (profile.assignedStore.toString() !== req.params.storeId)
        return res.status(403).json({ success: false, message: "Access denied to this store's inventory." });
    }

    const medicine = await Medicine.findById(req.params.id).lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const record = await MedicineInventory.findOne({
      medicineId: new mongoose.Types.ObjectId(req.params.id),
      storeId:    new mongoose.Types.ObjectId(req.params.storeId),
      isDeleted:  false,
    })
      .populate('storeId',    'storeName address.city status storeType bankDetails')
      .populate('batchId',    'batchNumber expiryDate remainingQuantity isNearExpiry daysUntilExpiry')
      .populate('supplierId', 'name code contact.phone')
      .lean({ virtuals: true });

    if (!record)
      return res.status(404).json({ success: false, message: `No inventory entry found for store '${req.params.storeId}'.` });

    // All batches for this medicine at this store (FEFO order)
    const batches = await MedicineBatch.find({
      medicineId: new mongoose.Types.ObjectId(req.params.id),
      storeId:    new mongoose.Types.ObjectId(req.params.storeId),
      isDeleted:  false,
    }).sort({ fifoPriority: 1 }).lean({ virtuals: true });

    // Pricing breakdown
    const config      = await PlatformPricingConfig.getGlobal().catch(() => null);
    const pharmacyCfg = config?.pharmacy || {};
    const platformFee = pharmacyCfg.platformFee || { type: 'percentage', value: 10 };
    const ownMarginPc = pharmacyCfg.ownStoreMarginPercent || 30;
    const store       = record.storeId;
    const isOwned     = store?.storeType === 'Owned';
    const commPc      = isOwned ? ownMarginPc : (store?.bankDetails?.commissionPercent || 0);
    const finalPrice  = record.finalPrice || record.sellingPrice || 0;
    const platformCut = platformFee.type === 'percentage'
      ? parseFloat(((finalPrice * commPc) / 100).toFixed(2))
      : platformFee.value;
    const storeNet    = parseFloat((finalPrice - platformCut).toFixed(2));
    const gstOnUnit   = parseFloat(((finalPrice * (medicine.gstPercentage || 0)) / 100).toFixed(2));

    res.status(200).json({
      success: true,
      data: {
        inventory: record,
        batches,
        pricingBreakdown: {
          mrp:               record.mrp,
          sellingPrice:      record.sellingPrice,
          discountPercent:   record.discountPercent,
          finalPrice,
          gstPerUnit:        gstOnUnit,
          platformCutPercent: commPc,
          platformCut,
          storeNetPerUnit:   storeNet,
          storeType:         store?.storeType,
          cod: {
            storeCollectsPerUnit:  finalPrice,
            mustRemitPerUnit:      parseFloat((platformCut + gstOnUnit).toFixed(2)),
            storeKeepsAfterRemit:  parseFloat((storeNet - gstOnUnit).toFixed(2)),
          },
          online: {
            platformCollectsPerUnit: finalPrice,
            storeNetPayoutPerUnit:   storeNet,
          },
          note: isOwned
            ? `Platform keeps ${ownMarginPc}% margin on own store`
            : `Platform earns ${commPc}% commission from partner store`,
        },
        medicine: {
          _id:        medicine._id,
          name:       medicine.name,
          brandName:  medicine.brandName,
          gstPercent: medicine.gstPercentage,
          hsnCode:    medicine.hsnCode,
        },
      },
    });
  });

// POST '/:id/inventory'
export const postByIdInventory = asyncHandler(async (req, res) => {
    const { storeId, mrp, sellingPrice, discountPercent = 0, reorderLevel, rackLocation } = req.body;
    if (!storeId) return res.status(400).json({ success: false, message: 'storeId is required.' });

    const [medicine, store] = await Promise.all([
      Medicine.findById(req.params.id).lean(),
      PharmacyStore.findById(storeId).lean(),
    ]);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    if (!store)    return res.status(404).json({ success: false, message: `Store '${storeId}' not found.` });

    const existing = await MedicineInventory.findOne({ medicineId: medicine._id, storeId });
    if (existing)
      return res.status(409).json({ success: false, message: `Inventory entry for store '${storeId}' already exists. Use PATCH /:id/inventory/:storeId to update pricing, or add-stock to add batches.` });

    const inv = await MedicineInventory.create({
      medicineId:      medicine._id,
      storeId,
      mrp:             mrp || medicine.referenceMrp || 0,
      sellingPrice:    sellingPrice || mrp || medicine.referenceMrp || 0,
      discountPercent,
      stockQuantity:   0,
      reservedStock:   0,
      availableStock:  0,
      reorderLevel:    reorderLevel || 10,
      rackLocation:    rackLocation || null,
      isLowStock:      false,
      isOutOfStock:    true,
      isActive:        true,
      isDeleted:       false,
      createdBy:       req.user._id,
      updatedBy:       req.user._id,
    });

    auditLog('INVENTORY_ENTRY_CREATE', req.user._id, { medicineId: medicine._id, storeId });
    res.status(201).json({ success: true, message: 'Inventory placeholder created. Use add-stock to add batches.', data: inv });
  });

// POST '/:id/inventory/:storeId/add-stock'
export const postByIdInventoryByStoreIdAddStock = asyncHandler(async (req, res) => {
    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore)
        return res.status(403).json({ success: false, message: 'No store assigned.' });
      if (profile.assignedStore.toString() !== req.params.storeId)
        return res.status(403).json({ success: false, message: "Can only add stock to your own store." });
    }

    const {
      stockQuantity, batchNumber, expiryDate, manufacturingDate,
      mrp, sellingPrice, discountPercent = 0,
      purchasePrice, purchaseInvoiceNo, purchaseInvoiceDate, supplierId, rackLocation,
    } = req.body;

    if (!stockQuantity || stockQuantity <= 0) return res.status(400).json({ success: false, message: 'stockQuantity must be > 0.' });
    if (!batchNumber)  return res.status(400).json({ success: false, message: 'batchNumber is required.' });
    if (!expiryDate)   return res.status(400).json({ success: false, message: 'expiryDate is required.' });
    if (!mrp || mrp <= 0)               return res.status(400).json({ success: false, message: 'mrp is required and > 0.' });
    if (!sellingPrice || sellingPrice <= 0) return res.status(400).json({ success: false, message: 'sellingPrice is required and > 0.' });

    const [medicine, store] = await Promise.all([
      Medicine.findById(req.params.id).lean(),
      PharmacyStore.findById(req.params.storeId).lean(),
    ]);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found in catalogue.' });
    if (!store)    return res.status(404).json({ success: false, message: 'Store not found.' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { inv, batch } = await createOrTopUpInventory({
        medicineId:         medicine._id,
        storeId:            store._id,
        supplierId:         supplierId || null,
        batchNumber,
        expiryDate,
        manufacturingDate,
        mrp,
        sellingPrice,
        discountPercent,
        purchasePrice,
        purchaseInvoiceNo,
        purchaseInvoiceDate,
        stockQuantity,
        rackLocation,
        actorId:            req.user._id,
        session,
        reason:             `Stock added via admin portal — batch ${batchNumber}`,
      });

      await session.commitTransaction();
      await invalidateMedicineCache(medicine._id);

      if (inv.isLowStock || inv.isOutOfStock) {
        triggerLowStockAlertsForStore(store._id, store, req.user._id).catch(console.error);
      }

      const updatedInv = await MedicineInventory.findById(inv._id)
        .populate('medicineId', 'name brandName genericName category hsnCode gstPercentage')
        .populate('batchId',    'batchNumber expiryDate remainingQuantity isNearExpiry')
        .populate('supplierId', 'name code')
        .lean({ virtuals: true });

      auditLog('STOCK_ADDED', req.user._id, { medicineId: medicine._id, storeId: store._id, batchNumber, quantity: stockQuantity });
      res.status(200).json({ success: true, message: 'Stock added successfully.', data: { inventory: updatedInv, batch } });

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  });

// PATCH '/:id/inventory/:storeId'
export const patchByIdInventoryByStoreId = asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore)
        return res.status(403).json({ success: false, message: 'No store assigned.' });
      if (profile.assignedStore.toString() !== storeId)
        return res.status(403).json({ success: false, message: "Can only update your own store's inventory." });
    }

    const inv = await MedicineInventory.findOne({
      medicineId: new mongoose.Types.ObjectId(req.params.id),
      storeId:    new mongoose.Types.ObjectId(storeId),
      isDeleted:  false,
    });
    if (!inv)
      return res.status(404).json({ success: false, message: `No inventory entry for store '${storeId}'. Use POST /:id/inventory to create one.` });

    const { mrp, sellingPrice, discountPercent, reorderLevel, minimumStock, maximumStock, rackLocation, isActive, barcode, qrCode } = req.body;

    if (mrp            != null) inv.mrp            = mrp;
    if (sellingPrice   != null) inv.sellingPrice    = sellingPrice;
    if (discountPercent!= null) inv.discountPercent = discountPercent;
    if (reorderLevel   != null) inv.reorderLevel    = reorderLevel;
    if (minimumStock   != null) inv.minimumStock    = minimumStock;
    if (maximumStock   != null) inv.maximumStock    = maximumStock;
    if (rackLocation   != null) inv.rackLocation    = rackLocation;
    if (isActive       != null) inv.isActive        = isActive;
    if (barcode        != null) inv.barcode         = barcode;
    if (qrCode         != null) inv.qrCode          = qrCode;
    inv.updatedBy = req.user._id;

    await inv.save(); // pre-save recomputes finalPrice, availableStock, isLowStock, isOutOfStock

    await invalidateMedicineCache(req.params.id);
    auditLog('INVENTORY_PRICING_UPDATE', req.user._id, { medicineId: req.params.id, storeId, changes: req.body });
    res.status(200).json({ success: true, data: inv.toObject({ virtuals: true }) });
  });

// PATCH '/:id/inventory/:storeId/deduct-stock'
export const patchByIdInventoryByStoreIdDeductStock = asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore || profile.assignedStore.toString() !== storeId)
        return res.status(403).json({ success: false, message: "Can only deduct stock from your own store." });
    }

    const { quantity, batchNumber, reason = '', movementType = 'Adjustment_Sub' } = req.body;
    if (!quantity || quantity <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0.' });

    const validMovements = ['Adjustment_Sub', 'Damage', 'Expiry', 'Transfer_Out'];
    if (!validMovements.includes(movementType))
      return res.status(400).json({ success: false, message: `movementType must be one of: ${validMovements.join(', ')}` });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const inv = await MedicineInventory.findOne({
        medicineId: new mongoose.Types.ObjectId(req.params.id),
        storeId:    new mongoose.Types.ObjectId(storeId),
        isActive:   true, isDeleted: false,
      }).session(session);

      if (!inv) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Inventory record not found.' }); }
      if (inv.availableStock < quantity) { await session.abortTransaction(); return res.status(400).json({ success: false, message: `Insufficient available stock. Available: ${inv.availableStock}` }); }

      // Find target batch
      let targetBatch;
      if (batchNumber) {
        targetBatch = await MedicineBatch.findOne({
          medicineId: new mongoose.Types.ObjectId(req.params.id),
          storeId:    new mongoose.Types.ObjectId(storeId),
          batchNumber, status: 'Active', isDeleted: false,
        }).session(session);
        if (!targetBatch) { await session.abortTransaction(); return res.status(404).json({ success: false, message: `Batch ${batchNumber} not found or not active.` }); }
        if (targetBatch.remainingQuantity < quantity) { await session.abortTransaction(); return res.status(400).json({ success: false, message: `Batch ${batchNumber} has only ${targetBatch.remainingQuantity} units.` }); }
      } else {
        targetBatch = await MedicineBatch.findOne({
          medicineId:        new mongoose.Types.ObjectId(req.params.id),
          storeId:           new mongoose.Types.ObjectId(storeId),
          status:            'Active', isDeleted: false,
          remainingQuantity: { $gte: quantity },
        }).sort({ fifoPriority: 1 }).session(session);
        if (!targetBatch) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'No single batch with sufficient stock. Specify batchNumber.' }); }
      }

      const prevStock = inv.stockQuantity;
      targetBatch.remainingQuantity -= quantity;
      if (movementType === 'Damage') {
        targetBatch.damagedQuantity = (targetBatch.damagedQuantity || 0) + quantity;
        inv.damagedStock            = (inv.damagedStock || 0) + quantity;
      }
      if (movementType === 'Expiry') {
        targetBatch.expiredQuantity = (targetBatch.expiredQuantity || 0) + quantity;
      }
      if (targetBatch.remainingQuantity === 0) targetBatch.status = 'Exhausted';
      await targetBatch.save({ session });

      inv.stockQuantity  -= quantity;
      inv.availableStock  = Math.max(0, inv.stockQuantity - (inv.reservedStock || 0));
      inv.isOutOfStock    = inv.availableStock <= 0;
      inv.isLowStock      = !inv.isOutOfStock && inv.availableStock <= (inv.reorderLevel || LOW_STOCK_THRESHOLD);
      inv.updatedBy       = req.user._id;
      await inv.save({ session });

      // Re-point FEFO batch pointer
      const nextBatch = await MedicineBatch.findOne({
        medicineId:        new mongoose.Types.ObjectId(req.params.id),
        storeId:           new mongoose.Types.ObjectId(storeId),
        status:            'Active', isDeleted: false,
        remainingQuantity: { $gt: 0 },
      }).sort({ fifoPriority: 1 }).session(session);
      if (nextBatch) { inv.batchId = nextBatch._id; await inv.save({ session }); }

      await InventoryMovement.create([{
        storeId:         new mongoose.Types.ObjectId(storeId),
        medicineId:      new mongoose.Types.ObjectId(req.params.id),
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
      await invalidateMedicineCache(req.params.id);

      const store = await PharmacyStore.findById(storeId).lean();
      if ((inv.isLowStock || inv.isOutOfStock) && store) {
        triggerLowStockAlertsForStore(storeId, store, req.user._id).catch(console.error);
      }

      auditLog('STOCK_DEDUCTED', req.user._id, { medicineId: req.params.id, storeId, batchNumber: targetBatch.batchNumber, quantity, movementType });
      res.status(200).json({ success: true, message: 'Stock deducted.', data: inv.toObject({ virtuals: true }) });

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  });

// DELETE '/:id/inventory/:storeId'
export const deleteByIdInventoryByStoreId = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const hardDelete  = req.query.hard === 'true' && req.user.role === 'superadmin';

    const inv = await MedicineInventory.findOne({
      medicineId: new mongoose.Types.ObjectId(req.params.id),
      storeId:    new mongoose.Types.ObjectId(storeId),
    });
    if (!inv)
      return res.status(404).json({ success: false, message: `No inventory entry for store '${storeId}'.` });

    if (hardDelete) {
      await MedicineInventory.deleteOne({ _id: inv._id });
      auditLog('INVENTORY_ENTRY_HARD_DELETE', req.user._id, { medicineId: req.params.id, storeId });
    } else {
      inv.isActive  = false;
      inv.isDeleted = true;
      inv.deletedAt = new Date();
      inv.deletedBy = req.user._id;
      await inv.save();
      auditLog('INVENTORY_ENTRY_SOFT_DELETE', req.user._id, { medicineId: req.params.id, storeId });
    }

    await invalidateMedicineCache(req.params.id);
    res.status(200).json({
      success: true,
      message: hardDelete
        ? `Inventory entry for store '${storeId}' permanently removed.`
        : `Inventory entry for store '${storeId}' deactivated.`,
    });
  });

// POST '/:id/sync-inventory'
export const postByIdSyncInventory = asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id).lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const addedCount = await syncInventoryAllStores(medicine._id, medicine, req.user._id);

    const totalRecords = await MedicineInventory.countDocuments({ medicineId: medicine._id, isDeleted: false });

    auditLog('MEDICINE_INVENTORY_SYNC', req.user._id, { medicineId: medicine._id, addedCount });
    res.status(200).json({
      success:               true,
      message:               addedCount > 0 ? `Synced ${addedCount} new store(s) with zero-stock placeholders.` : 'All stores already have inventory entries.',
      addedCount,
      totalInventoryEntries: totalRecords,
    });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  console.error(`[MEDICINE_ROUTER_ERROR] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message);

  if (err.name  === 'ValidationError')
    return res.status(400).json({ success: false, error: 'Validation Error', details: Object.values(err.errors).map((e) => e.message) });
  if (err.code  === 11000)
    return res.status(409).json({ success: false, error: 'Duplicate Entry', message: `A record with this ${Object.keys(err.keyValue || {})[0] || 'field'} already exists.` });
  if (err.name  === 'CastError')
    return res.status(400).json({ success: false, error: 'Invalid ID Format', message: err.message });
  if (err.code  === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ success: false, error: 'File Too Large', message: `File must not exceed ${MAX_FILE_SIZE_MB} MB.` });
  if (err.isAxiosError)
    return res.status(502).json({ success: false, error: 'Upstream Service Error', message: 'ImageKit upload service returned an error.', detail: process.env.NODE_ENV === 'development' ? err.response?.data || err.message : undefined });
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
    return res.status(401).json({ success: false, error: 'Authentication Error', message: err.message });

  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error', errorCode: err.code || 'MEDICINE_ROUTER_FAIL' });
};
