 
import mongoose             from 'mongoose';
import { protect, authorize } from '../../middleware/authMiddleware.js';

// ── Model imports ─────────────────────────────────────────────────────────────
import User                 from '../../models/User.js';
import Wallet               from '../../models/Wallet.js';
import Booking              from '../../models/Booking.js';
import PharmacyOrder        from '../../models/PharmacyOrder.js';
import Medicine             from '../../models/Medicine.js';
import UserSubscription     from '../../models/UserSubscription.js';
 


// ══════════════════════════════════════════════════════════════════════════════
// §1  SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Wrap async route — propagates thrown errors to express error handler */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Safe pagination — clamps limit 1–100, page min 1 */
const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

/** Validate MongoDB ObjectId route param */
const validateObjectId = (param) => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${param} — must be a 24-char hex ObjectId`,
    });
  }
  next();
};

/** Coerce date string to Date; return null if invalid */
const toDate = (str) => {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

// ══════════════════════════════════════════════════════════════════════════════
// §2  PHARMACY ORDERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/superadmin/pharmacy-orders
 *
 * Query params (all optional):
 * startDate, endDate    ISO date strings  → filters createdAt range
 * deliveryStatus        string            → delivery.status  (Placed|Confirmed|…|Delivered|Cancelled…)
 * paymentStatus         string            → payment.status   (Pending|Paid|Failed|Refunded|Partially_Refunded)
 * paymentMethod         string            → payment.method   (Razorpay|Wallet|COD)
 * storeId               ObjectId
 * customerId            ObjectId
 * minAmount             number            → billing.totalPayable >=
 * maxAmount             number            → billing.totalPayable <=
 * search                string            → orderId regex (case-insensitive)
 * isArchived            boolean string    → 'true' | 'false'
 * prescriptionStatus    string            → prescription.verificationStatus
 * page, limit
 *
 * Populates:
 * customer  → name email phone
 * store     → storeName contact address status legal
 * items.medicine → name brandName genericName category dosage mrp gstPercentage
 */

// GET '/pharmacy-orders'
export const getPharmacyOrders = asyncHandler(async (req, res) => {
    const {
      startDate, endDate,
      deliveryStatus, paymentStatus, paymentMethod,
      storeId, customerId,
      minAmount, maxAmount,
      search, isArchived,
      prescriptionStatus,
    } = req.query;

    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    // ── Date range ──────────────────────────────────────────────────────────
    const from = toDate(startDate);
    const to   = toDate(endDate);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to)   filter.createdAt.$lte = to;
    }

    // ── Status filters (schema-exact field paths) ────────────────────────────
    if (deliveryStatus) filter['delivery.status'] = deliveryStatus;
    if (paymentStatus) filter['payment.status'] = paymentStatus;
    if (paymentMethod) filter['payment.method'] = paymentMethod;

    // ── Party filters ────────────────────────────────────────────────────────
    if (storeId    && mongoose.isValidObjectId(storeId))    filter.store    = new mongoose.Types.ObjectId(storeId);
    if (customerId && mongoose.isValidObjectId(customerId)) filter.customer = new mongoose.Types.ObjectId(customerId);

    // ── Amount range (billing.totalPayable) ─────────────────────────────────
    const minAmt = Number(minAmount);
    const maxAmt = Number(maxAmount);
    if (minAmount || maxAmount) {
      filter['billing.totalPayable'] = {};
      if (!isNaN(minAmt) && minAmount) filter['billing.totalPayable'].$gte = minAmt;
      if (!isNaN(maxAmt) && maxAmount) filter['billing.totalPayable'].$lte = maxAmt;
    }

    // ── Text search on orderId ───────────────────────────────────────────────
    if (search) filter.orderId = { $regex: search.trim(), $options: 'i' };

    // ── Soft-delete flag ─────────────────────────────────────────────────────
    if (isArchived !== undefined) {
      filter.isArchived = isArchived === 'true';
    } else {
      filter.isArchived = false; // default: hide archived
    }

    // ── Prescription verification status ────────────────────────────────────
    if (prescriptionStatus) filter['prescription.verificationStatus'] = prescriptionStatus;

    // ── Query ────────────────────────────────────────────────────────────────
    const [orders, total] = await Promise.all([
      PharmacyOrder.find(filter)
        .populate('customer', 'name email phone')
        .populate('store',    'storeName contact address status legal')
        .populate('items.medicine', 'name brandName genericName category dosage mrp gstPercentage images')
        .populate('cancellation.cancelledBy',    'name email role')
        .populate('cancellation.returnRequestedBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean({ virtuals: true }),
      PharmacyOrder.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
      data: orders,
    });
  });

// GET '/pharmacy-orders/:orderId'
export const getPharmacyOrdersByOrderId = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const filterQ = mongoose.isValidObjectId(orderId)
      ? { _id: orderId }
      : { orderId };

    const order = await PharmacyOrder.findOne(filterQ)
      .populate('customer', 'name email phone createdAt')
      .populate('store',    'storeName contact address status legal')
      .populate('items.medicine',
        'name brandName genericName category dosage mrp gstPercentage hsnCode manufacturer images')
      .populate('prescription.verifiedBy',       'name email role')
      .populate('delivery.internalPartner',      'name email phone role')
      .populate('delivery.pickupPartner',        'name email phone role')
      .populate('cancellation.cancelledBy',      'name email role')
      .populate('cancellation.returnRequestedBy','name email role')
      .populate('cancellation.returnDecisionBy', 'name email role')
      .populate('cancellation.pickupVerifiedBy', 'name email role')
      .populate('adminNotes.addedBy',            'name email role')
      .lean({ virtuals: true });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, data: order });
  });

// GET '/bookings'
export const getBookings = asyncHandler(async (req, res) => {
    const {
      startDate, endDate,
      status, paymentStatus, bookingType,
      customerId, doctorId, hospitalId, careAssistantId, labPartnerId,
      search,
    } = req.query;

    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    const from = toDate(startDate);
    const to   = toDate(endDate);
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = from;
      if (to)   filter.scheduledAt.$lte = to;
    }

    if (status)        filter.status        = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (bookingType)   filter.bookingType   = bookingType;

    if (customerId     && mongoose.isValidObjectId(customerId))     filter.customer      = new mongoose.Types.ObjectId(customerId);
    if (doctorId       && mongoose.isValidObjectId(doctorId))       filter.doctor        = new mongoose.Types.ObjectId(doctorId);
    if (hospitalId     && mongoose.isValidObjectId(hospitalId))     filter.hospital      = new mongoose.Types.ObjectId(hospitalId);
    if (careAssistantId&& mongoose.isValidObjectId(careAssistantId))filter.careAssistant = new mongoose.Types.ObjectId(careAssistantId);
    if (labPartnerId   && mongoose.isValidObjectId(labPartnerId))   filter.labPartner    = new mongoose.Types.ObjectId(labPartnerId);

    if (search) filter.bookingCode = { $regex: search.trim(), $options: 'i' };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('customer',       'name email phone')
        .populate('doctor',         'specialization registrationNumber profilePhotoUrl')
        .populate('hospital',       'name address contact')
        .populate('careAssistant',  'fullName phone photoUrl')
        // FIX 1: Override driver model to circumvent "DriverProfile" mismatch & use actual fields
        .populate({ 
            path: 'driver', 
            model: 'Driver', 
            select: 'legalName phone driverCode kyc.drivingLicenceNumber' 
        })
        .populate('labPartner',     'name phone')
        // FIX 2: Ride schema fields are pickup/dropoff, not pickupLocation/dropLocation
        .populate('primaryRide',    'status fare pickup dropoff')
        .select('-internalNotes -statusLog')
        .sort({ scheduledAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean({ virtuals: true }),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
      data: bookings,
    });
  });

// GET '/bookings/:bookingCode'
export const getBookingsByBookingCode = asyncHandler(async (req, res) => {
    const { bookingCode } = req.params;

    const filterQ = mongoose.isValidObjectId(bookingCode)
      ? { _id: bookingCode }
      : { bookingCode: bookingCode.toUpperCase() };

    const booking = await Booking.findOne(filterQ)
      .populate('customer',       'name email phone createdAt')
      .populate('doctor',         'specialization registrationNumber profilePhotoUrl')
      .populate('hospital',       'name address contact')
      .populate('careAssistant',  'fullName phone photoUrl')
      .populate('transportPartner','name phone')
      // FIX 1: Override driver model and use exact DB fields
      .populate({ 
          path: 'driver', 
          model: 'Driver', 
          select: 'legalName phone driverCode kyc.drivingLicenceNumber' 
      })
      .populate('solodriverpartner','name phone')
      .populate('labPartner',      'name phone')
      // FIX 2: Override ride schema fields accurately
      .populate('rides',           'status fare pickup dropoff driver')
      .populate('primaryRide',     'status fare pickup dropoff driver')
      .populate('returnRide',      'status fare pickup dropoff driver')
      .populate('consultationSessionId', 'status startedAt endedAt')
      .populate('followUpParentBooking', 'bookingCode bookingType scheduledAt status')
      .populate('assignedAdminId',       'name email role')
      .populate('statusLog.changedBy',   'name email role')
      .populate('cancellation.cancelledByUserId', 'name email role')
      .populate('diagnosticDetails.labPartner', 'name phone')
      .lean({ virtuals: true });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.status(200).json({ success: true, data: booking });
  });

// GET '/financial-ledger'
export const getFinancialLedger = asyncHandler(async (req, res) => {
    const { type, purpose, status, userId, startDate, endDate } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const txnMatch = {};

    if (type)    txnMatch['transactions.type']    = type;
    if (purpose) txnMatch['transactions.purpose'] = purpose;
    if (status)  txnMatch['transactions.status']  = status;

    const from = toDate(startDate);
    const to   = toDate(endDate);
    if (from || to) {
      txnMatch['transactions.timestamp'] = {};
      if (from) txnMatch['transactions.timestamp'].$gte = from;
      if (to)   txnMatch['transactions.timestamp'].$lte = to;
    }

    const walletPreMatch = {};
    if (userId && mongoose.isValidObjectId(userId)) {
      walletPreMatch.user = new mongoose.Types.ObjectId(userId);
    }

    const pipeline = [
      ...(Object.keys(walletPreMatch).length ? [{ $match: walletPreMatch }] : []),
      { $unwind: { path: '$transactions', preserveNullAndEmptyArrays: false } },
      { $match: Object.keys(txnMatch).length ? txnMatch : {} },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: { 'transactions.timestamp': -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id:         0,
                walletId:    '$_id',
                userId:      '$user',
                currency:    '$currency',
                balance:     '$balance',         
                transaction: '$transactions',
              },
            },
          ],
          summary: [
            {
              $group: {
                _id:          '$transactions.type',
                totalAmount:  { $sum: '$transactions.amount' },
                count:        { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    const [results] = await Wallet.aggregate(pipeline);
    const total = results.metadata[0]?.total ?? 0;

    const populated = await User.populate(results.data, {
      path:   'userId',
      select: 'name email role phone',
    });

    return res.status(200).json({
      success: true,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
      summary: results.summary,
      data:    populated,
    });
  });

// GET '/subscriptions/billing-summary'
export const getSubscriptionsBillingSummary = asyncHandler(async (req, res) => {
    const now     = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const yr12Ago = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [summary, planBreakdown, upcomingRenewals, revenueTimeline] = await Promise.all([

      UserSubscription.aggregate([
        {
          $group: {
            _id:   '$status',
            count: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $reduce: {
                  input:        { $ifNull: ['$paymentHistory', []] },
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
                },
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      UserSubscription.aggregate([
        { $match: { status: 'Active' } },
        {
          $group: {
            _id:   '$plan',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from:         'subscriptionplans', 
            localField:   '_id',
            foreignField: '_id',
            as:           'planInfo',
          },
        },
        {
          $project: {
            _id:      0,
            planId:   '$_id',
            planName: { $arrayElemAt: ['$planInfo.name',    0] },
            price:    { $arrayElemAt: ['$planInfo.pricing', 0] },
            count:    1,
          },
        },
        { $sort: { count: -1 } },
      ]),

      UserSubscription.find({
        status:     'Active',
        expiryDate: { $gte: now, $lte: in7Days },
      })
        .populate('user', 'name email phone')
        .populate('plan', 'name pricing')
        .sort({ expiryDate: 1 })
        .limit(10)
        .lean(),

      UserSubscription.aggregate([
        { $match: { createdAt: { $gte: yr12Ago } } },
        { $unwind: { path: '$paymentHistory', preserveNullAndEmptyArrays: false } },
        { $match: { 'paymentHistory.paidAt': { $gte: yr12Ago } } },
        {
          $group: {
            _id: {
              year:  { $year:  '$paymentHistory.paidAt' },
              month: { $month: '$paymentHistory.paidAt' },
            },
            revenue: { $sum: { $ifNull: ['$paymentHistory.amount', 0] } },
            count:   { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id:     0,
            year:    '$_id.year',
            month:   '$_id.month',
            revenue: 1,
            count:   1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      summary,
      planBreakdown,
      upcomingRenewals,
      revenueTimeline,
    });
  });

// POST '/refunds/pharmacy/:orderId'
export const postRefundsPharmacyByOrderId = asyncHandler(async (req, res) => {
    const { amount, reason, method } = req.body;

    const refundAmount = Number(amount);
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }
    const VALID_METHODS = ['Wallet', 'Original_Source', 'Bank_Transfer'];
    if (!VALID_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `method must be one of: ${VALID_METHODS.join(', ')}`,
      });
    }

    const { orderId } = req.params;
    const filterQ = mongoose.isValidObjectId(orderId)
      ? { _id: orderId }
      : { orderId };

    const order = await PharmacyOrder.findOne(filterQ);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.cancellation?.refundStatus === 'Processed') {
      return res.status(409).json({ success: false, message: 'Refund already processed for this order' });
    }

    if (refundAmount > order.billing.totalPayable) {
      return res.status(400).json({
        success: false,
        message: `Refund amount ₹${refundAmount} exceeds order total ₹${order.billing.totalPayable}`,
      });
    }

    if (order.payment?.status !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: `Cannot refund — payment status is '${order.payment?.status}', expected 'Paid'`,
      });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (method === 'Wallet') {
          const wallet = await Wallet.findOne({ user: order.customer }).session(session);
          if (!wallet) {
            throw Object.assign(new Error('Customer wallet not found'), { status: 404 });
          }
          await wallet.credit(refundAmount, 'Refund', {
            referenceId: order._id,
            onModel:     'PharmacyOrder',
            description: `Admin refund for ${order.orderId}: ${reason.trim()}`,
            initiatedBy: req.user._id,
          });
        }

        order.cancellation                = order.cancellation ?? {};
        order.cancellation.refundStatus   = 'Processed';
        order.cancellation.refundAmount   = refundAmount;
        order.cancellation.refundMethod   = method;
        order.cancellation.refundedAt     = new Date();
        order.cancellation.adminRefundNote = reason.trim();
        order.payment.status              = 'Refunded';

        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const updated = await PharmacyOrder.findById(order._id)
      .populate('customer', 'name email phone')
      .lean();

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${refundAmount} processed via ${method}`,
      data:    updated,
    });
  });

// POST '/refunds/booking/:bookingId'
export const postRefundsBookingByBookingId = asyncHandler(async (req, res) => {
    const { amount, reason, method } = req.body;

    const refundAmount = Number(amount);
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }
    const VALID_METHODS = ['Wallet', 'Original_Source', 'Bank_Transfer'];
    if (!VALID_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `method must be one of: ${VALID_METHODS.join(', ')}`,
      });
    }

    const { bookingId } = req.params;
    const filterQ = mongoose.isValidObjectId(bookingId)
      ? { _id: bookingId }
      : { bookingCode: bookingId.toUpperCase() };

    const booking = await Booking.findOne(filterQ);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.paymentStatus === 'refunded') {
      return res.status(409).json({ success: false, message: 'Booking already refunded' });
    }

    const totalPaid = booking.fareBreakdown?.amountPaid ?? 0;
    if (refundAmount > totalPaid) {
      return res.status(400).json({
        success: false,
        message: `Refund ₹${refundAmount} exceeds amount paid ₹${totalPaid}`,
      });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (method === 'Wallet') {
          const wallet = await Wallet.findOne({ user: booking.customer }).session(session);
          if (!wallet) {
            throw Object.assign(new Error('Customer wallet not found'), { status: 404 });
          }
          await wallet.credit(refundAmount, 'Refund', {
            referenceId: booking._id,
            onModel:     'Booking',
            description: `Admin refund for ${booking.bookingCode}: ${reason.trim()}`,
            initiatedBy: req.user._id,
          });
        }

        booking.fareBreakdown.refundAmount = refundAmount;
        booking.paymentStatus              = 'refunded';
        booking.status                     = 'refund_pending'; 
        booking.updatedBy                  = req.user._id;

        await booking.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${refundAmount} processed for booking ${booking.bookingCode}`,
    });
  });

// GET '/wallet/:userId'
export const getWalletByUserId = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);

    const wallet = await Wallet.findOne({ user: req.params.userId })
      .populate('user', 'name email role phone');

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const allTxns = [...wallet.transactions].reverse();
    const total   = allTxns.length;
    const paged   = allTxns.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      data: {
        walletId:              wallet._id,
        user:                  wallet.user,
        balance:               wallet.balance,
        availableBalance:      wallet.availableBalance,        
        withdrawableBalance:   wallet.withdrawableBalance,
        withdrawableAvailable: wallet.withdrawableAvailable,   
        lockedBalance:         wallet.lockedBalance,
        currency:              wallet.currency,
        totalCredited:         wallet.totalCredited,
        totalDebited:          wallet.totalDebited,
        totalWithdrawn:        wallet.totalWithdrawn,
        primaryBankAccount:    wallet.primaryBankAccount,      
        pendingWithdrawals:    wallet.withdrawalRequests?.filter(r => r.status === 'Pending') ?? [],
        isActive:              wallet.isActive,
      },
      transactions: {
        pagination: { total, page, pages: Math.ceil(total / limit), limit },
        data: paged,
      },
    });
  });

// POST '/wallet/:userId/adjust'
export const postWalletByUserIdAdjust = asyncHandler(async (req, res) => {
    const { type, amount, description } = req.body;

    if (!['Credit', 'Debit'].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'Credit' or 'Debit'" });
    }
    const adjustAmount = Number(amount);
    if (!adjustAmount || adjustAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: 'description is required' });
    }

    const wallet = await Wallet.findOne({ user: req.params.userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    if (!wallet.isActive) {
      return res.status(403).json({ success: false, message: 'Wallet is deactivated' });
    }

    if (type === 'Debit') {
      const available = wallet.availableBalance ?? wallet.balance;
      if (adjustAmount > available) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance — available ₹${available}, requested ₹${adjustAmount}`,
        });
      }
    }

    const purpose = type === 'Credit' ? 'Admin_Credit' : 'Admin_Debit';
    const meta    = { description: description.trim(), initiatedBy: req.user._id };

    if (type === 'Credit') {
      await wallet.credit(adjustAmount, purpose, meta);
    } else {
      await wallet.debit(adjustAmount, purpose, meta);
    }

    return res.status(200).json({
      success: true,
      message:  `Wallet ${type.toLowerCase()} of ₹${adjustAmount} applied`,
      balance:  wallet.balance,
    });
  });

// GET '/system/audit-logs'
export const getSystemAuditLogs = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);

    const suspiciousFilter = {
      $or: [
        { loginCount:    { $gt: 100 } },
        { isBlocked:     true },
        { 'deviceTokens.3': { $exists: true } },
      ],
    };

    const [data, total] = await Promise.all([
      User.find(suspiciousFilter)
        .select('name email role loginCount lastLoginIp lastLoginAt isBlocked deviceTokens createdAt')
        .sort({ lastLoginAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      User.countDocuments(suspiciousFilter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
      data,
    });
  });

// GET '/medicines'
export const getMedicines = asyncHandler(async (req, res) => {
    const {
      storeId, isLowStock, isExpired,
      isDiscontinued, isApproved,
      category, search,
    } = req.query;

    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (isDiscontinued !== undefined) filter.isDiscontinued = isDiscontinued === 'true';
    if (isApproved     !== undefined) filter.isApproved     = isApproved === 'true';
    if (category) filter.category = category;

    if (storeId && mongoose.isValidObjectId(storeId)) {
      filter['inventory.storeId'] = new mongoose.Types.ObjectId(storeId);
    }
    if (isLowStock === 'true') filter['inventory.isLowStock'] = true;
    if (isExpired  === 'true') filter['inventory.isExpired']  = true;

    if (search) filter.$text = { $search: search.trim() };

    const [medicines, total] = await Promise.all([
      Medicine.find(filter)
        .populate('hsnCode',    'code description gstPercentage')
        .populate('createdBy',  'name email')
        .populate('approvedBy', 'name email')
        .populate('inventory.storeId',  'storeName address')
        .populate('inventory.addedBy',  'name email')
        .select('-inventory.reservedQuantity')  
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean({ virtuals: true }),  
      Medicine.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: medicines.length,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
      data: medicines,
    });
  });

// GET '/analytics/revenue'
export const getAnalyticsRevenue = asyncHandler(async (req, res) => {
    const from = toDate(req.query.startDate) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to   = toDate(req.query.endDate)   ?? new Date();

    const [pharmacyRevenue, bookingRevenue, subscriptionRevenue] = await Promise.all([
      PharmacyOrder.aggregate([
        {
          $match: {
            'payment.status': 'Paid',
            createdAt: { $gte: from, $lte: to },
            isArchived: false,
          },
        },
        {
          $group: {
            _id:      null,
            total:    { $sum: '$billing.totalPayable' },
            count:    { $sum: 1 },
            avgOrder: { $avg: '$billing.totalPayable' },
          },
        },
      ]),

      Booking.aggregate([
        {
          $match: {
            paymentStatus: { $in: ['paid', 'pay_at_service_paid'] },
            scheduledAt:   { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id:      null,
            total:    { $sum: '$fareBreakdown.amountPaid' },
            count:    { $sum: 1 },
            avgOrder: { $avg: '$fareBreakdown.amountPaid' },
          },
        },
      ]),

      UserSubscription.aggregate([
        { $unwind: { path: '$paymentHistory', preserveNullAndEmptyArrays: false } },
        {
          $match: {
            'paymentHistory.paidAt': { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id:   null,
            total: { $sum: { $ifNull: ['$paymentHistory.amount', 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const pharmacy     = pharmacyRevenue[0]     ?? { total: 0, count: 0, avgOrder: 0 };
    const bookings     = bookingRevenue[0]       ?? { total: 0, count: 0, avgOrder: 0 };
    const subscription = subscriptionRevenue[0]  ?? { total: 0, count: 0 };

    const grandTotal = pharmacy.total + bookings.total + subscription.total;

    return res.status(200).json({
      success: true,
      period: { from, to },
      revenue: {
        pharmacy:     { total: pharmacy.total,    count: pharmacy.count,     avgOrder: pharmacy.avgOrder },
        bookings:     { total: bookings.total,    count: bookings.count,     avgOrder: bookings.avgOrder },
        subscription: { total: subscription.total, count: subscription.count },
        grandTotal,
      },
    });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  console.error(`[SuperAdmin Router] ${req.method} ${req.originalUrl} →`, err.stack ?? err.message);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  Object.values(err.errors).map(e => e.message),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field '${err.path}': ${err.value}`,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
    });
  }

  return res.status(err.status ?? 500).json({
    success: false,
    message: err.message ?? 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
