/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLOOD BANK ROUTER — Likeson.in  (FIXED)
 *
 * FIXES APPLIED:
 *   FIX 1: Route order — /request/verify-payment BEFORE /:id to avoid param collision
 *   FIX 2: BloodRequest model imported and used properly for DB persistence
 *   FIX 3: Prescription upload multer added to POST /:id/request
 *   FIX 4: addUnit now sets isReleaseApproved=false, status='available' correctly
 *          Unit counter only bumps when isReleaseApproved=true
 *   FIX 5: GET /me/inventory/:invId added (with units array)
 *   FIX 6: Unit update counter logic corrected for isReleaseApproved transition
 *   FIX 7: searchAndAllocate called from BloodRequest static after payment verify
 *   FIX 8: Prescription ImageKit upload endpoint added for customers
 *   FIX 9: booking field removed entirely
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import multer         from 'multer';
import crypto         from 'crypto';
import Razorpay       from 'razorpay';
import ImageKit       from 'imagekit';

import dotenv         from 'dotenv';
import sendEmail      from '../utils/sendEmail.js';
import { buildBloodRequestEmail, buildBloodIssuedEmail } from '../utils/emailTemplates.js';
import BloodBank      from '../models/BloodBank.js';
import BloodInventory from '../models/BloodInventory.js';
import BloodRequest   from '../models/BloodRequest.js';
import Hospital       from '../models/Hospital.js';
import User           from '../models/User.js';
import Notification   from '../models/Notification.js';
import SystemLog      from '../models/SystemLog.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

dotenv.config();

// ── Razorpay ──────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || 'rzp_test_SV43jVcrs5wKAM',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'sRxoYVIpHbyLsKXGor6dkHxt',
});

// ── ImageKit ──────────────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY   || 'public_rIdrz0GPllpCv0Q3HzChmkN+sLg=',
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY  || 'private_VZy2yDP9AuEzZRr8BYHhSFWJA/c=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/zxxzgk3iq',
});

// ── Multer (memory) ───────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

const prescriptionUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, PDF allowed for prescription'));
  },
});

// ── Router ────────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

const uploadToImageKit = (buffer, fileName, folder) =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      { file: buffer, fileName, folder: `/likeson/${folder}` },
      (err, result) => (err ? reject(err) : resolve(result.url))
    );
  });

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body     = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'sRxoYVIpHbyLsKXGor6dkHxt')
    .update(body)
    .digest('hex');
  return expected === signature;
};


// ═══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /blood-banks
 */

import asyncHandler from '../utils/asyncHandler.js';

// GET '/'
export const get = asyncHandler(async (req, res) => {
  try {
    const {
      city, bankType, bloodGroup, component,
      emergency, featured,
      page  = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true, status: 'active' };
    if (city)       filter['address.city']     = new RegExp(city, 'i');
    if (bankType)   filter.bankType             = bankType;
    if (bloodGroup) filter.bloodGroupsAvailable = bloodGroup;
    if (component)  filter.componentsHandled    = component;
    if (emergency === 'true') filter.isEmergency24x7 = true;
    if (featured  === 'true') filter.isFeatured       = true;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodBank.countDocuments(filter);
    const banks = await BloodBank.find(filter)
      .select('-statusLog -internalNotes -licenses -accreditations')
      .sort({ isFeatured: -1, 'rating.averageRating': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/nearby'
export const getNearby = asyncHandler(async (req, res) => {
  try {
    const { lng, lat, radius = 20, bloodGroup, component, unitsNeeded = 1 } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'lng and lat required' });
    }

    if (bloodGroup && component) {
      const results = await BloodInventory.findAvailableNearby({
        bloodGroup,
        component,
        unitsNeeded:       parseInt(unitsNeeded),
        lng:               parseFloat(lng),
        lat:               parseFloat(lat),
        maxDistanceMeters: parseFloat(radius) * 1000,
      });
      return res.json({ success: true, data: results });
    }

    const banks = await BloodBank.find({
      isActive: true,
      status:   'active',
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000,
        },
      },
    })
      .select('name bankCode bankType contact address location rating isEmergency24x7 offersDelivery deliveryRadiusKm componentsHandled bloodGroupsAvailable')
      .limit(15)
      .lean();

    res.json({ success: true, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/slug/:slug'
export const getSlugBySlug = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ slug: req.params.slug, isActive: true })
      .populate('inventory')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/linked'
export const getLinked = asyncHandler(async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const banks = await BloodBank.find({
      $or: [{ hospital: hospital._id }, { linkedHospitals: hospital._id }],
    })
      .select('name bankCode bankType status isActive contact address location rating componentsHandled bloodGroupsAvailable')
      .lean();

    res.json({ success: true, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/me'
export const getMe = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id })
      .populate('inventory')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank profile not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/me/inventory'
export const getMeInventory = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inventory = await BloodInventory.find({ bloodBank: bank._id })
      .select('-units')
      .lean();

    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/me/inventory/:invId'
export const getMeInventoryByInvId = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    res.json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/me/requests'
export const getMeRequests = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { 'allocations.bloodBank': bank._id };
    if (status) filter.status = status;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodRequest.countDocuments(filter);
    const requests = await BloodRequest.find(filter)
      .populate('requestedBy', 'name email phone')
      .populate('hospital', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/me/stats'
export const getMeStats = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id })
      .select('stats rating bankCode name')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const invSummary = await BloodInventory.aggregate([
      { $match: { bloodBank: bank._id } },
      { $group: {
        _id:            null,
        totalAvailable: { $sum: '$availableUnits' },
        totalReserved:  { $sum: '$reservedUnits' },
        totalIssued:    { $sum: '$issuedUnits' },
        totalExpired:   { $sum: '$expiredUnits' },
        lowStockCount:  { $sum: { $cond: ['$isLowStock',      1, 0] } },
        criticalCount:  { $sum: { $cond: ['$isCriticalStock', 1, 0] } },
      }},
    ]);

    res.json({
      success: true,
      data: { bank: { name: bank.name, bankCode: bank.bankCode, rating: bank.rating }, stats: bank.stats, inventory: invSummary[0] || {} },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/me/status-log'
export const getMeStatusLog = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id })
      .select('statusLog name')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank.statusLog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/all'
export const getAdminAll = asyncHandler(async (req, res) => {
  try {
    const { status, bankType, page = 1, limit = 30, search } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (bankType) filter.bankType = bankType;
    if (search)   filter.$or = [
      { name:     new RegExp(search, 'i') },
      { bankCode: new RegExp(search, 'i') },
    ];

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodBank.countDocuments(filter);
    const banks = await BloodBank.find(filter)
      .select('+internalNotes')
      .populate('managedBy', 'name email phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, total, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id'
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id)
      .select('+internalNotes +bankDetails.accountNumber')
      .populate('managedBy', 'name email phone role')
      .populate('hospital',  'name address')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id/stats'
export const getAdminByIdStats = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id).select('stats rating name bankCode').lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const invSummary = await BloodInventory.aggregate([
      { $match: { bloodBank: bank._id } },
      { $group: {
        _id:            null,
        totalAvailable: { $sum: '$availableUnits' },
        totalReserved:  { $sum: '$reservedUnits' },
        totalIssued:    { $sum: '$issuedUnits' },
        totalExpired:   { $sum: '$expiredUnits' },
        slots:          { $sum: 1 },
      }},
    ]);

    res.json({ success: true, data: { bank, inventory: invSummary[0] || {} } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/admin/:id/status'
export const putAdminByIdStatus = asyncHandler(async (req, res) => {
  try {
    const { status, reason } = req.body;
    const valid = ['pending', 'under_review', 'active', 'suspended', 'revoked', 'deactivated'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be: ${valid.join(', ')}` });
    }

    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const prevStatus     = bank.status;
    bank.status          = status;
    bank.updatedBy       = req.user._id;
    if (status === 'suspended') bank.suspensionReason = reason || 'Administrative action';
    if (status === 'revoked')   bank.rejectionReason  = reason || 'License revoked';
    await bank.save();

    const manager = await User.findById(bank.managedBy).select('email name');
    if (manager?.email) {
      await sendEmail({
        email:   manager.email,
        subject: `Blood Bank Status Update — ${bank.name}`,
        html:    `<p>Hi ${manager.name},</p><p>Your blood bank <strong>${bank.name}</strong> status changed from <strong>${prevStatus}</strong> to <strong>${status}</strong>. ${reason ? `Reason: ${reason}` : ''}</p>`,
      }).catch(console.error);
    }

    await SystemLog.createLog({
      level: 'info', category: 'system',
      message: `Blood bank status changed: ${prevStatus} → ${status}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { prevStatus, newStatus: status, reason },
    });

    res.json({ success: true, message: `Status updated to ${status}`, data: { status: bank.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/admin/:id/verify'
export const putAdminByIdVerify = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    bank.isVerified = true;
    bank.verifiedAt = new Date();
    bank.verifiedBy = req.user._id;
    bank.status     = 'active';
    bank.updatedBy  = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Blood bank verified and activated', data: { isVerified: true, status: bank.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/admin/:id/featured'
export const putAdminByIdFeatured = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    bank.isFeatured = !bank.isFeatured;
    bank.updatedBy  = req.user._id;
    await bank.save();
    res.json({ success: true, message: `Featured set to ${bank.isFeatured}`, data: { isFeatured: bank.isFeatured } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/admin/:id/licenses/:licId/verify'
export const putAdminByIdLicensesByLicIdVerify = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const lic = bank.licenses.id(req.params.licId);
    if (!lic) return res.status(404).json({ success: false, message: 'License not found' });

    lic.isVerified = true;
    lic.verifiedBy = req.user._id;
    lic.verifiedAt = new Date();
    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'License verified', data: lic });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/admin/:id'
export const deleteAdminById = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    await BloodInventory.deleteMany({ bloodBank: req.params.id });

    await SystemLog.createLog({
      level: 'warning', category: 'system',
      message: `Blood bank hard-deleted: ${bank.name} (${bank.bankCode})`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      metadata: { bankCode: bank.bankCode, bankName: bank.name },
    });

    res.json({ success: true, message: 'Blood bank deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/prescription/upload'
export const postPrescriptionUpload = asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded. Field name must be "prescription".' });
      }

      const url = await uploadToImageKit(
        req.file.buffer,
        `rx_${req.user._id}_${Date.now()}`,
        'blood-requests/prescriptions'
      );

      res.json({
        success: true,
        message: 'Prescription uploaded. Use prescriptionUrl in your blood request.',
        data:    { prescriptionUrl: url },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/request/verify-payment'
export const postRequestVerifyPayment = asyncHandler(async (req, res) => {
  try {
    const {
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
      bloodBankId, bloodGroup, component, unitsNeeded = 1,
      patientName, patientAge, patientGender,
      hospitalId, urgency = 'routine', clinicalIndication, notes,
      prescriptionUrl,
    } = req.body;

    const valid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    const bank = await BloodBank.findById(bloodBankId);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const resolvedHospitalId = hospitalId || bank.hospital || null;

    const isEmergencyRequest = ['emergency', 'mass_casualty'].includes(urgency);
    if (!isEmergencyRequest && !prescriptionUrl) {
      return res.status(400).json({
        success:  false,
        message:  'prescriptionUrl required for non-emergency blood requests. Upload via POST /blood-banks/prescription/upload first.',
      });
    }

    const inv = await BloodInventory.findOne({
      bloodBank:      bloodBankId,
      bloodGroup,
      component,
      availableUnits: { $gte: parseInt(unitsNeeded) },
    });
    if (!inv) {
      return res.status(400).json({
        success: false,
        message: 'Stock no longer available. Payment will be refunded.',
      });
    }

    // FIX 9: No booking field
    const bloodRequest = await BloodRequest.create({
      requestType: 'patient_direct',
      requestedBy: req.user._id,
      hospital:    resolvedHospitalId,
      patient: {
        name:   patientName || req.user.name,
        age:    patientAge,
        gender: patientGender,
        bloodGroup,
      },
      bloodGroup,
      component,
      unitsRequired:    parseInt(unitsNeeded),
      urgency,
      clinicalIndication,
      clinicalNotes:    notes,
      crossMatchRequired: true,
      prescriptionUrl:  prescriptionUrl || null,
      prescriptionWaived: isEmergencyRequest,
      prescriptionWaivedReason: isEmergencyRequest ? `Auto-waived: urgency=${urgency}` : null,
      status:        'searching',
      paymentStatus: 'paid',
      fareBreakdown: {
        processingFees: 0,
        crossMatchFees: 0,
        deliveryFees:   0,
        platformFee:    0,
        taxes:          0,
        discount:       0,
        totalAmount:    0,
        currency:       'INR',
      },
      createdBy: req.user._id,
    });

    let allocationResult = null;
    try {
      allocationResult = await BloodRequest.searchAndAllocate(bloodRequest._id);
    } catch (allocErr) {
      console.error('searchAndAllocate failed after payment:', allocErr.message);
    }

    const manager = await User.findById(bank.managedBy).select('_id email name');
    if (manager) {
      await Notification.create({
        recipient: manager._id,
        title:     `New Blood Request — ${bloodGroup} ${component}`,
        body:      `${unitsNeeded} unit(s) of ${bloodGroup} ${component} requested. Ref: ${bloodRequest.requestCode}`,
        type:      'Order_Placed',
        priority:  'High',
        deepLink:  { screen: 'BloodRequests', referenceId: bank._id },
      });

      if (manager.email) {
        await sendEmail({
          email:   manager.email,
          subject: `New Blood Request — ${bloodGroup} ${component} | ${bloodRequest.requestCode}`,
          html:    buildBloodRequestEmail({
            userName:      manager.name,
            requestId:     bloodRequest.requestCode,
            bloodGroup,
            component,
            units:         unitsNeeded,
            bankName:      bank.name,
            processingFee: 'Processing fee collected via platform',
          }),
        }).catch(console.error);
      }
    }

    await sendEmail({
      email:   req.user.email,
      subject: `Blood Request Confirmed — ${bloodGroup} ${component} | ${bloodRequest.requestCode}`,
      html:    buildBloodRequestEmail({
        userName:      req.user.name,
        requestId:     bloodRequest.requestCode,
        bloodGroup,
        component,
        units:         unitsNeeded,
        bankName:      bank.name,
        processingFee: 'Already paid',
      }),
    }).catch(console.error);

    await SystemLog.createLog({
      level: 'success', category: 'payment',
      message: `Blood request payment verified: ${bloodRequest.requestCode}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { requestCode: bloodRequest.requestCode, bloodGroup, component, unitsNeeded, razorpayOrderId, razorpayPaymentId },
    });

    res.json({
      success: true,
      message: 'Payment verified. Blood request created. Bank notified.',
      data: {
        requestCode:    bloodRequest.requestCode,
        requestId:      bloodRequest._id,
        bloodGroup,
        component,
        unitsNeeded:    parseInt(unitsNeeded),
        bankName:       bank.name,
        status:         bloodRequest.status,
        allocation:     allocationResult,
        prescriptionRequired: !isEmergencyRequest,
        prescriptionUrl:      prescriptionUrl || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id'
export const getById = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true })
      .select('-internalNotes -statusLog')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/inventory'
export const getByIdInventory = asyncHandler(async (req, res) => {
  try {
    const inventory = await BloodInventory.find({ bloodBank: req.params.id })
      .select('-units -createdBy -updatedBy')
      .lean();
    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/inventory/search'
export const getByIdInventorySearch = asyncHandler(async (req, res) => {
  try {
    const { bloodGroup, component, unitsNeeded = 1 } = req.query;
    const filter = { bloodBank: req.params.id };
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (component)  filter.component  = component;
    if (parseInt(unitsNeeded) > 0) filter.availableUnits = { $gte: parseInt(unitsNeeded) };

    const results = await BloodInventory.find(filter).select('-units').lean();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/reviews'
export const getByIdReviews = asyncHandler(async (_req, res) => {
  res.status(501).json({ success: false, message: 'Review model not yet implemented.' });
});

// POST '/:id/reviews'
export const postByIdReviews = asyncHandler(async (_req, res) => {
  res.status(501).json({ success: false, message: 'Review model not yet implemented.' });
});

// POST '/:id/request'
export const postByIdRequest = asyncHandler(async (req, res) => {
    try {
      const {
        bloodGroup, component, unitsNeeded = 1,
        patientName, patientAge, patientGender,
        hospitalId, urgency = 'routine', clinicalIndication, notes,
      } = req.body;

      let { prescriptionUrl } = req.body;

      if (!bloodGroup || !component) {
        return res.status(400).json({ success: false, message: 'bloodGroup and component required' });
      }

      if (req.file && !prescriptionUrl) {
        prescriptionUrl = await uploadToImageKit(
          req.file.buffer,
          `rx_${req.user._id}_${Date.now()}`,
          'blood-requests/prescriptions'
        );
      }

      const isEmergencyRequest = ['emergency', 'mass_casualty'].includes(urgency);
      if (!isEmergencyRequest && !prescriptionUrl) {
        return res.status(400).json({
          success:  false,
          message:  'prescriptionUrl required. Either upload file as multipart field "prescription" or use POST /blood-banks/prescription/upload first.',
        });
      }

      const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true, status: 'active' });
      if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found or inactive' });

      const inv = await BloodInventory.findOne({
        bloodBank:      bank._id,
        bloodGroup,
        component,
        availableUnits: { $gte: parseInt(unitsNeeded) },
      });
      if (!inv) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Requested ${unitsNeeded} unit(s) of ${bloodGroup} ${component} — not available.`,
        });
      }

      const pricingEntry  = bank.pricing?.find(p => p.component === component);
      const feePerUnit    = pricingEntry?.processingFee || inv.processingFeePerUnit || 0;
      const crossMatchFee = pricingEntry?.crossMatchFee || inv.crossMatchFeePerUnit || 0;
      const totalFee      = (feePerUnit + crossMatchFee) * parseInt(unitsNeeded);

      const rzpOrder = await razorpay.orders.create({
        amount:   Math.max(100, Math.round(totalFee * 100)),
        currency: 'INR',
        receipt:  `bb_req_${Date.now()}`,
        notes: {
          bloodBankId:     bank._id.toString(),
          bloodGroup,
          component,
          unitsNeeded:     unitsNeeded.toString(),
          customerId:      req.user._id.toString(),
          patientName:     patientName || req.user.name,
          prescriptionUrl: prescriptionUrl || '',
          urgency,
        },
      });

      res.json({
        success: true,
        message: 'Razorpay order created. Complete payment to confirm blood request.',
        data: {
          razorpayOrderId:  rzpOrder.id,
          amount:           totalFee,
          currency:         'INR',
          bankName:         bank.name,
          bloodGroup,
          component,
          unitsNeeded:      parseInt(unitsNeeded),
          urgency,
          prescriptionUrl:  prescriptionUrl || null,
          prescriptionRequired: !isEmergencyRequest,
          feeBreakdown: {
            processingFee: feePerUnit * parseInt(unitsNeeded),
            crossMatchFee: crossMatchFee * parseInt(unitsNeeded),
            total:         totalFee,
          },
          razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_SV43jVcrs5wKAM',
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/:id/link'
export const postByIdLink = asyncHandler(async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    await BloodBank.findByIdAndUpdate(bank._id, { $addToSet: { linkedHospitals: hospital._id } });
    await Hospital.findByIdAndUpdate(hospital._id, { $addToSet: { bloodBanks: bank._id } });

    res.json({ success: true, message: `Supply agreement established with ${bank.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id/link'
export const deleteByIdLink = asyncHandler(async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    await BloodBank.findByIdAndUpdate(req.params.id, { $pull: { linkedHospitals: hospital._id } });
    await Hospital.findByIdAndUpdate(hospital._id,   { $pull: { bloodBanks: req.params.id } });

    res.json({ success: true, message: 'Supply agreement removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/'
export const post = asyncHandler(async (req, res) => {
  try {
    const existing = await BloodBank.findOne({ managedBy: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Blood bank profile already exists for this account.' });
    }

    const { bankType, hospital: hospitalId, parentBank } = req.body;

    if (bankType === 'hospital_embedded' && !hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital field required for hospital_embedded type' });
    }
    if (bankType === 'mobile_unit' && !parentBank) {
      return res.status(400).json({ success: false, message: 'parentBank field required for mobile_unit type' });
    }

    const bank = await BloodBank.create({
      ...req.body,
      managedBy: req.user._id,
      createdBy: req.user._id,
      status:    'pending',
    });

    if (bankType === 'hospital_embedded' && hospitalId) {
      await Hospital.findByIdAndUpdate(hospitalId, {
        $addToSet: { bloodBanks: bank._id },
        $set:      { primaryBloodBank: bank._id },
      });
    }

    await SystemLog.createLog({
      level: 'success', category: 'system',
      message: `Blood bank created: ${bank.name} (${bank.bankCode})`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
    });

    res.status(201).json({ success: true, message: 'Blood bank created. Awaiting admin verification.', data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me'
export const putMe = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const allowed = [
      'name', 'description', 'contact', 'address', 'operatingHours',
      'componentsHandled', 'bloodGroupsAvailable', 'googleMapsUrl',
      'acceptsDonations', 'offersDelivery', 'offersCrossMatch',
      'offersComponentSeparation', 'offersEmergencySupply', 'isEmergency24x7',
      'hasApheresisFacility', 'hasMobileUnit',
      'deliveryRadiusKm', 'deliveryFeePerKm', 'freeDeliveryKm',
      'contactPersons', 'tags',
    ];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) bank[field] = req.body[field];
    });

    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Profile updated', data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/logo'
export const putMeLogo = asyncHandler(async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const url = await uploadToImageKit(req.file.buffer, `logo_${bank.bankCode}_${Date.now()}`, 'blood-banks/logos');
    bank.logoUrl   = url;
    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Logo uploaded', data: { logoUrl: url } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/licenses'
export const putMeLicenses = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { licenseId, licenseType, licenseNumber, issuedBy, issuedOn, validUntil } = req.body;

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(req.file.buffer, `lic_${bank.bankCode}_${Date.now()}`, 'blood-banks/licenses');
    }

    if (licenseId) {
      const lic = bank.licenses.id(licenseId);
      if (!lic) return res.status(404).json({ success: false, message: 'License not found' });
      if (licenseType)   lic.licenseType   = licenseType;
      if (licenseNumber) lic.licenseNumber  = licenseNumber;
      if (issuedBy)      lic.issuedBy       = issuedBy;
      if (issuedOn)      lic.issuedOn       = new Date(issuedOn);
      if (validUntil)    lic.validUntil     = new Date(validUntil);
      if (documentUrl)   lic.documentUrl    = documentUrl;
      lic.isVerified = false;
    } else {
      if (!licenseType || !licenseNumber) {
        return res.status(400).json({ success: false, message: 'licenseType and licenseNumber required' });
      }
      bank.licenses.push({ licenseType, licenseNumber, issuedBy, issuedOn, validUntil, documentUrl });
    }

    bank.updatedBy = req.user._id;
    await bank.save();
    res.json({ success: true, message: licenseId ? 'License updated' : 'License added', data: bank.licenses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/accreditations'
export const putMeAccreditations = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { accreditationId, body: accBody, certificateNo, issuedOn, validUntil } = req.body;

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(req.file.buffer, `acc_${bank.bankCode}_${Date.now()}`, 'blood-banks/accreditations');
    }

    if (accreditationId) {
      const acc = bank.accreditations.id(accreditationId);
      if (!acc) return res.status(404).json({ success: false, message: 'Accreditation not found' });
      if (accBody)       acc.body          = accBody;
      if (certificateNo) acc.certificateNo = certificateNo;
      if (issuedOn)      acc.issuedOn      = new Date(issuedOn);
      if (validUntil)    acc.validUntil    = new Date(validUntil);
      if (documentUrl)   acc.documentUrl   = documentUrl;
      acc.isVerified = false;
    } else {
      if (!accBody) return res.status(400).json({ success: false, message: 'body (accreditation body) required' });
      bank.accreditations.push({ body: accBody, certificateNo, issuedOn, validUntil, documentUrl });
    }

    bank.updatedBy = req.user._id;
    await bank.save();
    res.json({ success: true, message: accreditationId ? 'Accreditation updated' : 'Accreditation added', data: bank.accreditations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/bank-details'
export const putMeBankDetails = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;

    const setFields = { 'bankDetails.isVerified': false, updatedBy: req.user._id };
    if (accountHolderName !== undefined) setFields['bankDetails.accountHolderName'] = accountHolderName;
    if (ifscCode          !== undefined) setFields['bankDetails.ifscCode']          = ifscCode;
    if (bankName          !== undefined) setFields['bankDetails.bankName']           = bankName;
    if (upiId             !== undefined) setFields['bankDetails.upiId']              = upiId;

    if (accountNumber !== undefined) {
      setFields['bankDetails.accountNumber'] = accountNumber;
      setFields['bankDetails.accountLast4']  = accountNumber.slice(-4);
    }

    const updated = await BloodBank.findOneAndUpdate(
      { managedBy: req.user._id },
      { $set: setFields },
      { new: true, select: 'bankDetails.accountLast4 bankDetails.bankName bankDetails.upiId bankDetails.isVerified' }
    );

    res.json({
      success: true,
      message: 'Bank details updated. Admin verification required.',
      data: {
        accountLast4: updated.bankDetails.accountLast4,
        bankName:     updated.bankDetails.bankName,
        upiId:        updated.bankDetails.upiId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/stock-alerts'
export const putMeStockAlerts = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    if (!Array.isArray(req.body.stockAlerts)) {
      return res.status(400).json({ success: false, message: 'stockAlerts must be an array' });
    }

    bank.stockAlerts = req.body.stockAlerts;
    bank.updatedBy   = req.user._id;
    await bank.save();
    res.json({ success: true, message: 'Stock alert thresholds updated', data: bank.stockAlerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/pricing'
export const putMePricing = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    if (!Array.isArray(req.body.pricing)) {
      return res.status(400).json({ success: false, message: 'pricing must be an array' });
    }

    bank.pricing   = req.body.pricing;
    bank.updatedBy = req.user._id;
    await bank.save();

    for (const entry of req.body.pricing) {
      await BloodInventory.updateMany(
        { bloodBank: bank._id, component: entry.component },
        { $set: { processingFeePerUnit: entry.processingFee || 0, crossMatchFeePerUnit: entry.crossMatchFee || 0 } }
      );
    }

    res.json({ success: true, message: 'Pricing updated', data: bank.pricing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/me/inventory'
export const postMeInventory = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { bloodGroup, component, processingFeePerUnit = 0, crossMatchFeePerUnit = 0 } = req.body;
    if (!bloodGroup || !component) {
      return res.status(400).json({ success: false, message: 'bloodGroup and component required' });
    }

    const existing = await BloodInventory.findOne({ bloodBank: bank._id, bloodGroup, component });
    if (existing) {
      return res.status(400).json({ success: false, message: `Inventory slot for ${bloodGroup} ${component} already exists` });
    }

    const inv = await BloodInventory.create({
      bloodBank:   bank._id,
      bloodGroup,
      component,
      location:    bank.location,
      cityName:    bank.address?.city,
      processingFeePerUnit,
      crossMatchFeePerUnit,
      createdBy:   req.user._id,
    });

    res.status(201).json({ success: true, message: 'Inventory slot created', data: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/me/inventory/:invId/units'
export const postMeInventoryByInvIdUnits = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const {
      bagNumber, collectedAt, volumeMl,
      donorCode, donorName, collectedByStaff,
      expiresAt, storageLocation, storageSlot,
    } = req.body;

    if (!bagNumber || !collectedAt || !volumeMl) {
      return res.status(400).json({ success: false, message: 'bagNumber, collectedAt, volumeMl required' });
    }

    const bagExists = inv.units.some(u => u.bagNumber === bagNumber.toUpperCase());
    if (bagExists) {
      return res.status(400).json({ success: false, message: `Bag number ${bagNumber} already exists` });
    }

    let finalExpiry = expiresAt;
    if (!finalExpiry) {
      const shelfLifeConfig = await BloodInventory.findOne().select('COMPONENT_SHELF_LIFE_DAYS').lean();
      const days = shelfLifeConfig?.COMPONENT_SHELF_LIFE_DAYS?.[inv.component] ?? 35;
      const d = new Date(collectedAt);
      d.setDate(d.getDate() + days);
      finalExpiry = d;
    }

    const updatedInv = await BloodInventory.addUnit(inv._id, {
      bagNumber: bagNumber.toUpperCase(),
      collectedAt,
      volumeMl: parseFloat(volumeMl),
      donorCode: donorCode || 'WALK-IN',
      donorName,
      collectedByStaff,
      expiresAt: finalExpiry,
      storageLocation,
      storageSlot,
      status: 'available',
      isReleaseApproved: false,
      isTestingComplete: false,
      testResults: {
        hiv: 'Pending', hbsAg: 'Pending', hcv: 'Pending',
        syphilis: 'Pending', malaria: 'Pending', allClear: false,
      },
    });

    await BloodBank.findByIdAndUpdate(bank._id, {
      $inc: { 'stats.totalUnitsCollected': 1, 'stats.totalDonations': 1 },
      $set: { 'stats.lastDonationAt': new Date() },
    });

    const addedUnit = updatedInv.units[updatedInv.units.length - 1];

    res.status(201).json({
      success: true,
      message: 'Blood unit added. Testing results pending.',
      data: addedUnit,
      hint: {
        nextStep: `PUT /blood-banks/me/inventory/${inv._id}/units/${addedUnit._id}`,
        payload: {
          testResults: {
            hiv: 'Non-Reactive', hbsAg: 'Non-Reactive',
            hcv: 'Non-Reactive', syphilis: 'Non-Reactive', malaria: 'Non-Reactive'
          },
          isTestingComplete: true,
          isReleaseApproved: true
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/inventory/:invId/units/:unitId'
export const putMeInventoryByInvIdUnitsByUnitId = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const unit = inv.units.id(req.params.unitId);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    const prevStatus            = unit.status;
    const prevIsReleaseApproved = unit.isReleaseApproved;

    const allowed = [
      'testResults', 'isTestingComplete', 'isReleaseApproved',
      'storageLocation', 'storageSlot', 'storageTemperatureC',
      'crossMatch', 'status', 'notes',
      'processedAt', 'processedBy', 'separationMethod',
      'transfusedAt', 'transfusedBy',
      'isRecalled', 'recallReason', 'recalledAt',
    ];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) unit[f] = req.body[f];
    });

    if (req.body.testResults) {
      const t = unit.testResults;
      unit.testResults.allClear = ['hiv', 'hbsAg', 'hcv', 'syphilis', 'malaria'].every(
        k => t[k] === 'Non-Reactive'
      );
      if (unit.testResults.allClear) unit.isTestingComplete = true;
    }

    const newStatus            = unit.status;
    const newIsReleaseApproved = unit.isReleaseApproved;

    if (!prevIsReleaseApproved && newIsReleaseApproved && newStatus === 'available') {
      inv.availableUnits++;
    }

    if (newStatus !== prevStatus) {
      if (prevStatus === 'available' && newStatus === 'quarantined') {
        if (prevIsReleaseApproved) inv.availableUnits = Math.max(0, inv.availableUnits - 1);
        inv.quarantinedUnits++;
      }
      if (prevStatus === 'quarantined' && newStatus === 'available' && newIsReleaseApproved) {
        inv.availableUnits++;
        inv.quarantinedUnits = Math.max(0, inv.quarantinedUnits - 1);
      }
      if (newStatus === 'discarded') {
        if (prevStatus === 'available' && prevIsReleaseApproved) {
          inv.availableUnits = Math.max(0, inv.availableUnits - 1);
        }
        if (prevStatus === 'quarantined') {
          inv.quarantinedUnits = Math.max(0, inv.quarantinedUnits - 1);
        }
        inv.discardedUnits++;
      }
    }

    inv.lastUpdatedAt = new Date();
    await inv.save();

    res.json({ success: true, message: 'Unit updated', data: unit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/me/inventory/:invId/expiry-check'
export const postMeInventoryByInvIdExpiryCheck = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const updated = await BloodInventory.runExpiryCheck(inv._id);

    res.json({
      success: true,
      message: 'Expiry check complete',
      data: {
        expiringIn3Days: updated.expiringIn3Days,
        expiringIn7Days: updated.expiringIn7Days,
        expiredUnits:    updated.expiredUnits,
        nextExpiryAt:    updated.nextExpiryAt,
        availableUnits:  updated.availableUnits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/requests/:reqId/respond'
export const putMeRequestsByReqIdRespond = asyncHandler(async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'accept' or 'reject'" });
    }

    const bloodRequest = await BloodRequest.findById(req.params.reqId);
    if (!bloodRequest) return res.status(404).json({ success: false, message: 'Blood request not found' });

    if (action === 'accept') {
      bloodRequest.status    = 'cross_matching';
      bloodRequest.updatedBy = req.user._id;
      await bloodRequest.save();

      await Notification.create({
        recipient: bloodRequest.requestedBy,
        title:     'Blood Request Accepted',
        body:      `Your request ${bloodRequest.requestCode} has been accepted. Cross-matching in progress.`,
        type:      'Order_Placed',
        priority:  'High',
      }).catch(console.error);

    } else {
      const invDocs = await BloodInventory.find({ 'units.reservedFor': bloodRequest._id });
      for (const inv of invDocs) {
        await BloodInventory.releaseReservation(inv._id, bloodRequest._id);
      }

      bloodRequest.status          = 'rejected';
      bloodRequest.rejectionReason = reason || 'Blood bank declined the request';
      bloodRequest.rejectedBy      = req.user._id;
      bloodRequest.rejectedAt      = new Date();
      bloodRequest.updatedBy       = req.user._id;
      await bloodRequest.save();

      await Notification.create({
        recipient: bloodRequest.requestedBy,
        title:     'Blood Request Rejected',
        body:      `Request ${bloodRequest.requestCode} was rejected. Reason: ${reason || 'No reason provided'}`,
        type:      'Order_Placed',
        priority:  'High',
      }).catch(console.error);
    }

    res.json({
      success: true,
      message: action === 'accept'
        ? 'Request accepted. Prepare units for cross-matching.'
        : `Request rejected. Units released. Reason: ${reason || 'No reason provided'}`,
      data: { requestCode: bloodRequest.requestCode, status: bloodRequest.status },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/me/requests/:reqId/issue'
export const putMeRequestsByReqIdIssue = asyncHandler(async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const {
      bagNumbers = [], issuedBy, receiptUrl, hospitalId,
      customerEmail, customerName, bloodGroup, component,
    } = req.body;

    if (!bagNumbers.length) {
      return res.status(400).json({ success: false, message: 'bagNumbers array required' });
    }

    const upperBags = bagNumbers.map(b => b.toUpperCase());
    let totalIssued = 0;

    const invDocs = await BloodInventory.find({
      bloodBank:         bank._id,
      'units.bagNumber': { $in: upperBags },
    });

    for (const inv of invDocs) {
      let changed = false;
      for (const unit of inv.units) {
        if (upperBags.includes(unit.bagNumber) && ['reserved', 'cross_matched'].includes(unit.status)) {
          unit.status   = 'issued';
          unit.issuedTo = {
            request:    req.params.reqId,
            hospital:   hospitalId || null,
            issuedAt:   new Date(),
            issuedBy:   issuedBy || req.user.name,
            receiptUrl: receiptUrl || null,
          };
          inv.issuedUnits++;
          inv.reservedUnits  = Math.max(0, inv.reservedUnits - 1);
          inv.availableUnits = Math.max(0, inv.availableUnits);
          totalIssued++;
          changed = true;
        }
      }
      if (changed) {
        inv.lastIssuanceAt = new Date();
        inv.lastUpdatedAt  = new Date();
        await inv.save();
      }
    }

    if (totalIssued === 0) {
      return res.status(400).json({ success: false, message: 'No matching reserved units found for those bag numbers' });
    }

    const bloodRequest = await BloodRequest.findById(req.params.reqId);
    if (bloodRequest) {
      bloodRequest.status    = 'dispatched';
      bloodRequest.updatedBy = req.user._id;
      await bloodRequest.save();
    }

    await BloodBank.findByIdAndUpdate(bank._id, {
      $inc: { 'stats.totalUnitsIssued': totalIssued, 'stats.totalRequestsFulfilled': 1 },
      $set: { 'stats.lastIssuanceAt': new Date() },
    });

    if (customerEmail) {
      await sendEmail({
        email:   customerEmail,
        subject: `Blood Units Dispatched — ${bloodGroup || ''} ${component || ''}`,
        html:    buildBloodIssuedEmail({
          userName:   customerName || 'Customer',
          requestId:  req.params.reqId,
          bloodGroup: bloodGroup || 'N/A',
          component:  component  || 'N/A',
          units:      totalIssued,
          bankName:   bank.name,
          bagNumbers: upperBags,
        }),
      }).catch(console.error);
    }

    await SystemLog.createLog({
      level: 'success', category: 'system',
      message: `Blood units issued: ${upperBags.join(', ')} for request ${req.params.reqId}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { requestRef: req.params.reqId, bagNumbers: upperBags, totalIssued },
    });

    res.json({
      success: true,
      message: `${totalIssued} unit(s) issued successfully`,
      data:    { requestRef: req.params.reqId, bagNumbers: upperBags, totalIssued },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
