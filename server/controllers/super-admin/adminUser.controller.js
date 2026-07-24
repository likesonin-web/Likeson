import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { protect, authorize } from '../../middleware/authMiddleware.js';

import User from '../../models/User.js';
import CustomerProfile from '../../models/CustomerProfile.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import PharmacyProfile from '../../models/PharmacyProfile.js';
import CareAssistantProfile from '../../models/CareAssistantProfile.js';
import TransportPartner from '../../models/TransportPartner.js';

import Hospital from '../../models/Hospital.js';
import PharmacyStore from '../../models/PharmacyStore.js';
import PharmacyOrder from '../../models/PharmacyOrder.js';
import Booking from '../../models/Booking.js';
import Notification from '../../models/Notification.js';
import SystemLog from '../../models/SystemLog.js';
import sendEmail from '../../utils/sendEmail.js';
import { transactionalTemplate } from '../../utils/emailTemplates.js';


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Generate a secure random password
// ─────────────────────────────────────────────────────────────────────────────
const generatePassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$!';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Send welcome credentials email
// ─────────────────────────────────────────────────────────────────────────────
const sendCredentialsEmail = async ({ email, name, role, rawPassword }) => {
  const html = transactionalTemplate({
    header: 'Account Created — Likeson.in',
    title: `Welcome to Likeson, ${name}!`,
    body: `
      <p>Your <strong>${role}</strong> account has been created by the Likeson admin team.</p>
      <p><strong>Login Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> <code style="font-size:15px;letter-spacing:2px;">${rawPassword}</code></p>
      <p style="color:#e53e3e;font-size:12px;">Please change your password immediately after your first login.</p>
    `,
    buttonText: 'Login to Likeson',
    buttonLink: `${process.env.FRONTEND_URL}/login`,
  });

  await sendEmail({
    email,
    subject: `Your Likeson.in ${role} Account Credentials`,
    html,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Extract actor metadata from req.user + request object
// ─────────────────────────────────────────────────────────────────────────────
const buildActor = (req) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  return {
    userId:    req.user?._id    || null,
    name:      req.user?.name   || 'system',
    email:     req.user?.email  || null,
    role:      req.user?.role   || 'system',
    ip,
    userAgent: req.headers['user-agent'] || null,
    platform:  req.deviceInfo?.platform  || 'unknown',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Resolve human-readable label for a related entity
// ─────────────────────────────────────────────────────────────────────────────
const resolveEntityLabel = async (model, entityId) => {
  try {
    if (!model || !entityId) return null;
    const modelMap = {
      User:                   () => mongoose.model('User').findById(entityId).select('name email').lean(),
      Hospital:               () => mongoose.model('Hospital').findById(entityId).select('name').lean(),
      PharmacyStore:          () => mongoose.model('PharmacyStore').findById(entityId).select('storeName').lean(),
      TransportPartner:       () => mongoose.model('TransportPartner').findById(entityId).select('businessName').lean(),
      DoctorProfile:          () => mongoose.model('DoctorProfile').findById(entityId).select('specialization').lean(),
      PharmacyProfile:        () => mongoose.model('PharmacyProfile').findById(entityId).select('pharmacistName').lean(),
      CareAssistantProfile:   () => mongoose.model('CareAssistantProfile').findById(entityId).select('fullName').lean(),
      PharmacyOrder:          () => mongoose.model('PharmacyOrder').findById(entityId).select('orderId').lean(),
      Notification:           () => mongoose.model('Notification').findById(entityId).select('title').lean(),
    };
    const fn  = modelMap[model];
    if (!fn) return null;
    const doc = await fn();
    if (!doc) return String(entityId);
    return doc.name || doc.email || doc.storeName || doc.businessName ||
           doc.specialization || doc.pharmacistName || doc.fullName ||
           doc.orderId || doc.title || String(entityId);
  } catch {
    return String(entityId);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// All routes below require authentication + admin/superadmin access
// ─────────────────────────────────────────────────────────────────────────────

import asyncHandler from '../../utils/asyncHandler.js';

// GET '/ref/hospitals'
export const getRefHospitals = asyncHandler(async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    if (type) filter.hospitalType = type;

    const hospitals = await Hospital.find(filter)
      .select('_id name hospitalType address.city isVerified')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/ref/hospitals/lab-partners'
export const getRefHospitalsLabPartners = asyncHandler(async (req, res) => {
  try {
    const hospitals = await Hospital.find({
      hospitalType: { $in: ['Clinic', 'Diagnostic Center'] },
      isActive: true,
    })
      .select('_id name hospitalType address.city address.line1 isVerified')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/ref/pharmacy-stores'
export const getRefPharmacyStores = asyncHandler(async (req, res) => {
  try {
    const stores = await PharmacyStore.find({ status: { $ne: 'Inactive' } })
      .select('_id storeName storeType address.city address.line1 isVerified')
      .sort({ storeName: 1 })
      .lean();

    res.json({ success: true, count: stores.length, data: stores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/ref/transport-partners'
export const getRefTransportPartners = asyncHandler(async (req, res) => {
  try {
    const partners = await TransportPartner.find({ partnershipStatus: 'active' })
      .select('_id businessName businessType registeredAddress.city fleetInfo')
      .sort({ businessName: 1 })
      .lean({ virtuals: true });

    res.json({ success: true, count: partners.length, data: partners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/customer'
export const postCreateCustomer = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, phone, gender, dob, bloodGroup, emergencyContact } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await User.create(
      [{ name, email, phone, role: 'customer', password: hashedPassword, createdBy: req.user._id }],
      { session }
    );

    await CustomerProfile.create(
      [{ user: user[0]._id, gender, dob, bloodGroup, emergencyContact }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await sendCredentialsEmail({ email, name, role: 'Customer', rawPassword });

    res.status(201).json({
      success: true,
      message: `Customer account created. Credentials sent to ${email}.`,
      data: { _id: user[0]._id, name, email, role: 'customer' },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/doctor'
export const postCreateDoctor = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      name, email, phone,
      specialization, qualifications, experienceYears, registrationNumber,
      primaryHospital, otherHospitals,
      consultationTypes, fees,
      availability, biography, languagesSpoken, achievements,
    } = req.body;

    if (!name || !email || !specialization || !experienceYears || !primaryHospital || !fees?.inPersonFee) {
      return res.status(400).json({
        success: false,
        message: 'name, email, specialization, experienceYears, primaryHospital and fees.inPersonFee are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const hospitalExists = await Hospital.findById(primaryHospital);
    if (!hospitalExists) {
      return res.status(404).json({ success: false, message: 'Primary hospital not found.' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await User.create(
      [{ name, email, phone, role: 'doctor', password: hashedPassword, createdBy: req.user._id }],
      { session }
    );

    await DoctorProfile.create(
      [{
        user: user[0]._id,
        specialization,
        qualifications: qualifications || [],
        experienceYears,
        registrationNumber,
        primaryHospital,
        otherHospitals: otherHospitals || [],
        consultationTypes: consultationTypes || { inPerson: true, video: false, homeVisit: false },
        fees,
        availability: availability || [],
        biography,
        languagesSpoken: languagesSpoken || ['English', 'Telugu'],
        achievements: achievements || [],
        createdBy: req.user._id,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await sendCredentialsEmail({ email, name, role: 'Doctor', rawPassword });

    res.status(201).json({
      success: true,
      message: `Doctor account created. Credentials sent to ${email}.`,
      data: { _id: user[0]._id, name, email, role: 'doctor', primaryHospital: hospitalExists.name },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/lab-partner'
export const postCreateLabPartner = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, phone, assignedHospital } = req.body;

    if (!name || !email || !assignedHospital) {
      return res.status(400).json({
        success: false,
        message: 'name, email and assignedHospital are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const hospital = await Hospital.findOne({
      _id: assignedHospital,
      hospitalType: { $in: ['Clinic', 'Diagnostic Center'] },
      isActive: true,
    });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Assigned hospital not found or is not a Clinic/Diagnostic Center.',
      });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await User.create(
      [{ name, email, phone, role: 'lab partner', password: hashedPassword, createdBy: req.user._id }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await sendCredentialsEmail({ email, name, role: 'Lab Partner', rawPassword });

    res.status(201).json({
      success: true,
      message: `Lab Partner account created. Credentials sent to ${email}.`,
      data: {
        _id: user[0]._id,
        name,
        email,
        role: 'lab partner',
        assignedHospital: { _id: hospital._id, name: hospital.name, type: hospital.hospitalType },
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/transport-partner'
export const postCreateTransportPartner = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name, email, phone, agencyId,
      dateOfBirth, gender, address, kyc,
      emergencyContact, bio, languagesSpoken,
    } = req.body;

    if (!name || !email || !agencyId) {
      return res.status(400).json({
        success: false,
        message: 'name, email, and agencyId are required.',
      });
    }

    if (!kyc?.panNumber || !kyc?.aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: 'kyc.panNumber and kyc.aadhaarNumber are required.',
      });
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Indian mobile number format.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() }).session(session);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

   const agency = await TransportPartner.findById(agencyId).session(session); // ✓ correct
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Transport Partner agency not found.',
      });
    }

    if (agency.user) {
      return res.status(409).json({
        success: false,
        message: 'A user account is already linked to this agency.',
      });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const [user] = await User.create(
      [{
        name,
        email: email.toLowerCase(),
        phone,
        role: 'transportpartner',
        password: hashedPassword,
        createdBy: req.user._id,
      }],
      { session }
    );

    const ownerKycUpdate = {
      fullName:    name,
      dateOfBirth: dateOfBirth,
      gender:      gender,
      address:     address,
      aadhaarNumber:   kyc.aadhaarNumber,
      aadhaarFrontUrl: kyc.aadhaarFrontUrl,
      aadhaarBackUrl:  kyc.aadhaarBackUrl,
      aadhaarVerified: false,
      panNumber:   kyc.panNumber,
      panCardUrl:  kyc.panCardUrl,
      panVerified: false,
      ...(kyc.drivingLicenseNumber && { drivingLicenseNumber: kyc.drivingLicenseNumber }),
      ...(kyc.drivingLicenseUrl    && { drivingLicenseUrl:    kyc.drivingLicenseUrl }),
      ...(kyc.drivingLicenseExpiry && { drivingLicenseExpiry: kyc.drivingLicenseExpiry }),
      kycStatus: 'pending',
      emergencyContact,
      bio,
      languagesSpoken: languagesSpoken ?? [],
    };

    await TransportPartner.findByIdAndUpdate(
      agencyId,
      {
        user:    user._id,
        ownerKyc: ownerKycUpdate,
        $addToSet: { drivers: user._id },
      },
      { session, new: true, runValidators: true }
    );

    await session.commitTransaction();
    session.endSession();

    await sendCredentialsEmail({ email, name, role: 'Transport Partner', rawPassword });

    return res.status(201).json({
      success: true,
      message: `Transport Partner account created. Credentials sent to ${email}.`,
      data: {
        _id:       user._id,
        name,
        email:     user.email,
        role:      'transportpartner',
        agency:    agency.businessName,
        kycStatus: 'pending',
      },
    });

  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] ?? 'field';
      return res.status(409).json({ success: false, message: `Duplicate value for ${field}.` });
    }

    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/pharmacy'
export const postCreatePharmacy = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      name, email, phone,
      pharmacistName, registrationNumber, qualification, experienceYears,
      assignedStore, roleInStore, verification,
    } = req.body;

    if (!name || !email || !pharmacistName || !registrationNumber || !qualification || !assignedStore) {
      return res.status(400).json({
        success: false,
        message: 'name, email, pharmacistName, registrationNumber, qualification and assignedStore are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const store = await PharmacyStore.findById(assignedStore);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Pharmacy store not found.' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await User.create(
      [{ name, email, phone, role: 'pharmacy', password: hashedPassword, createdBy: req.user._id }],
      { session }
    );

    await PharmacyProfile.create(
      [{
        user: user[0]._id,
        pharmacistName,
        registrationNumber,
        qualification,
        experienceYears: experienceYears || 0,
        assignedStore,
        roleInStore: roleInStore || 'Store Manager',
        verification: verification || {},
        createdBy: req.user._id,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await sendCredentialsEmail({ email, name, role: 'Pharmacist', rawPassword });

    res.status(201).json({
      success: true,
      message: `Pharmacy user account created. Credentials sent to ${email}.`,
      data: { _id: user[0]._id, name, email, role: 'pharmacy', assignedStore: store.storeName },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/finance'
export const postCreateFinance = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await User.create({
      name, email, phone,
      role: 'finance',
      password: hashedPassword,
      createdBy: req.user._id,
    });

    await sendCredentialsEmail({ email, name, role: 'Finance', rawPassword });

    res.status(201).json({
      success: true,
      message: `Finance account created. Credentials sent to ${email}.`,
      data: { _id: user._id, name, email, role: 'finance' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/create/care-assistant'
export const postCreateCareAssistant = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      name, email, phone,
      experienceYears, languagesKnown,
      training, preferredServiceAreas, baseServiceCharge,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await User.create(
      [{ name, email, phone, role: 'care assistant', password: hashedPassword, createdBy: req.user._id }],
      { session }
    );

    await CareAssistantProfile.create(
      [{
        user: user[0]._id,
        fullName: name,
        experienceYears: experienceYears || 0,
        languagesKnown: languagesKnown || ['Telugu', 'English'],
        training: training || {},
        preferredServiceAreas: preferredServiceAreas || [],
        baseServiceCharge: baseServiceCharge || 500,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await sendCredentialsEmail({ email, name, role: 'Care Assistant', rawPassword });

    res.status(201).json({
      success: true,
      message: `Care Assistant account created. Credentials sent to ${email}.`,
      data: { _id: user[0]._id, name, email, role: 'care assistant' },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/'
export const get = asyncHandler(async (req, res) => {
  try {
    const {
      role, isBlocked, isEmailVerified,
      search, page = 1, limit = 20,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (isEmailVerified !== undefined) filter.isEmailVerified = isEmailVerified === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -otp -otpExpires -deviceTokens -auditSessions')
        .populate('profile')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean({ virtuals: true }),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      data: users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/analytics/overview'
export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    const roleCounts = await User.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const [
      totalUsers, blockedUsers, verifiedEmails,
      onlineUsers, newThisWeek,
    ] = await Promise.all([
      User.countDocuments(dateFilter),
      User.countDocuments({ ...dateFilter, isBlocked: true }),
      User.countDocuments({ ...dateFilter, isEmailVerified: true }),
      User.countDocuments({ isOnline: true }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const registrationTrend = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topServiceCities = await CareAssistantProfile.aggregate([
    
 
{ $match: { $and: [
  { 'availability.currentCity': { $exists: true } },
  { 'availability.currentCity': { $ne: null } },
  { 'availability.currentCity': { $ne: '' } },
]}},
      { $limit: 5 },
    ]);

    const orderStats = await PharmacyOrder.aggregate([
      {
        $group: {
          _id: '$delivery.status',
          count: { $sum: 1 },
          revenue: { $sum: '$billing.totalPayable' },
        },
      },
    ]);

    const verificationRate = totalUsers > 0
      ? ((verifiedEmails / totalUsers) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          blockedUsers,
          verifiedEmails,
          verificationRate: `${verificationRate}%`,
          onlineUsers,
          newThisWeek,
        },
        byRole: roleCounts.reduce((acc, r) => {
          acc[r._id] = r.count;
          return acc;
        }, {}),
        registrationTrend,
        topServiceCities,
        orders: orderStats.reduce((acc, s) => {
          acc[s._id] = { count: s.count, revenue: s.revenue };
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/logs'
export const postLogs = asyncHandler(async (req, res) => {
  try {
    const {
      level    = 'info',
      category = 'system',
      message,
      details,
      relatedEntity,
      metadata,
    } = req.body;

    const VALID_LEVELS      = ['info', 'success', 'warning', 'error', 'debug'];
    const VALID_CATEGORIES  = ['auth', 'user', 'security', 'payment', 'notification', 'kyc', 'system', 'api'];

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({ success: false, message: `level must be one of: ${VALID_LEVELS.join(', ')}` });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    let resolvedLabel = null;
    if (relatedEntity?.model && relatedEntity?.entityId) {
      if (!mongoose.Types.ObjectId.isValid(relatedEntity.entityId)) {
        return res.status(400).json({ success: false, message: 'relatedEntity.entityId is not a valid ObjectId.' });
      }
      resolvedLabel = await resolveEntityLabel(relatedEntity.model, relatedEntity.entityId);
    }

    const log = await SystemLog.create({
      level,
      category,
      message: message.trim(),
      details:       details || null,
      actor:         buildActor(req),
      relatedEntity: relatedEntity
        ? { model: relatedEntity.model, entityId: relatedEntity.entityId, label: resolvedLabel }
        : undefined,
      metadata: metadata || null,
      request: {
        method:    req.method,
        path:      req.originalUrl,
        statusCode: 201,
      },
    });

    res.status(201).json({
      success: true,
      message: 'System log entry created.',
      data: {
        _id:      log._id,
        logCode:  log.logCode,
        level:    log.level,
        category: log.category,
        message:  log.message,
        createdAt:log.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/logs'
export const getLogs = asyncHandler(async (req, res) => {
  try {
    const {
      level, category, actorRole, actorId, entityModel, entityId,
      statusCode, method, ip, environment, search,
      from, to,
      page      = 1,
      limit     = 30,
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (level)       filter.level    = level;
    if (category)    filter.category = category;
    if (environment) filter.environment = environment;

    if (actorRole)   filter['actor.role']   = actorRole;
    if (ip)          filter['actor.ip']     = { $regex: ip, $options: 'i' };
    if (actorId) {
      if (!mongoose.Types.ObjectId.isValid(actorId)) {
        return res.status(400).json({ success: false, message: 'actorId is not a valid ObjectId.' });
      }
      filter['actor.userId'] = new mongoose.Types.ObjectId(actorId);
    }

    if (entityModel) filter['relatedEntity.model']    = entityModel;
    if (entityId) {
      if (!mongoose.Types.ObjectId.isValid(entityId)) {
        return res.status(400).json({ success: false, message: 'entityId is not a valid ObjectId.' });
      }
      filter['relatedEntity.entityId'] = new mongoose.Types.ObjectId(entityId);
    }

    if (statusCode)  filter['request.statusCode'] = parseInt(statusCode);
    if (method)      filter['request.method']      = method.toUpperCase();

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    if (search?.trim()) {
      filter.$text = { $search: search.trim() };
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const sort  = search?.trim()
      ? { score: { $meta: 'textScore' }, [sortBy]: sortOrder === 'asc' ? 1 : -1 }
      : { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const projection = search?.trim()
      ? { score: { $meta: 'textScore' } }
      : {};

    const [logs, total] = await Promise.all([
      SystemLog.find(filter, projection)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean({ virtuals: true }),
      SystemLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      data: logs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/logs/analytics'
export const getLogsAnalytics = asyncHandler(async (req, res) => {
  try {
    const { from, to, environment } = req.query;

    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to)   dateFilter.createdAt.$lte = new Date(to);
    }
    if (environment) dateFilter.environment = environment;

    const [
      summary,
      byLevel,
      byCategory,
      byActorRole,
      hourlyTrend,
      dailyTrend,
      topIps,
      topPaths,
      topErrors,
      statusCodeBreakdown,
    ] = await Promise.all([

      Promise.all([
        SystemLog.countDocuments(dateFilter),
        SystemLog.countDocuments({ ...dateFilter, level: 'error' }),
        SystemLog.countDocuments({ ...dateFilter, level: 'warning' }),
        SystemLog.countDocuments({ ...dateFilter, level: 'success' }),
        SystemLog.countDocuments({ ...dateFilter, level: 'info' }),
      ]).then(([total, errorCount, warningCount, successCount, infoCount]) => ({
        total, errorCount, warningCount, successCount, infoCount,
      })),

      SystemLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$level', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      SystemLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      SystemLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$actor.role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      SystemLog.aggregate([
        {
          $match: {
            ...dateFilter,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$createdAt' },
            },
            count:  { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 24 },
      ]),

      SystemLog.aggregate([
        {
          $match: {
            ...dateFilter,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id:    { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count:  { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      SystemLog.aggregate([
        { $match: { ...dateFilter, 'actor.ip': { $nin: ['unknown', 'internal', '::1', '127.0.0.1'] } } },
        { $group: { _id: '$actor.ip', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      SystemLog.aggregate([
        { $match: { ...dateFilter, 'request.path': { $ne: null } } },
        { $group: { _id: '$request.path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      SystemLog.aggregate([
        { $match: { ...dateFilter, level: 'error' } },
        { $group: { _id: '$message', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      SystemLog.aggregate([
        { $match: { ...dateFilter, 'request.statusCode': { $ne: null } } },
        { $group: { _id: '$request.statusCode', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        summary,
        byLevel:    byLevel.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
        byCategory: byCategory.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
        byActorRole:byActorRole.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
        hourlyTrend,
        dailyTrend,
        topIps:     topIps.map(r => ({ ip: r._id,     count: r.count })),
        topPaths:   topPaths.map(r => ({ path: r._id, count: r.count })),
        topErrors:  topErrors.map(r => ({ message: r._id, count: r.count })),
        statusCodeBreakdown: statusCodeBreakdown.reduce((acc, r) => {
          acc[r._id] = r.count; return acc;
        }, {}),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/logs/export'
export const getLogsExport = asyncHandler(async (req, res) => {
  try {
    const {
      level, category, actorRole, actorId, entityModel, entityId,
      statusCode, method, ip, environment, search, from, to,
    } = req.query;

    const filter = {};
    if (level)       filter.level    = level;
    if (category)    filter.category = category;
    if (environment) filter.environment = environment;
    if (actorRole)   filter['actor.role']   = actorRole;
    if (ip)          filter['actor.ip']     = { $regex: ip, $options: 'i' };
    if (method)      filter['request.method'] = method.toUpperCase();
    if (statusCode)  filter['request.statusCode'] = parseInt(statusCode);

    if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
      filter['actor.userId'] = new mongoose.Types.ObjectId(actorId);
    }
    if (entityModel) filter['relatedEntity.model'] = entityModel;
    if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
      filter['relatedEntity.entityId'] = new mongoose.Types.ObjectId(entityId);
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    if (search?.trim()) {
      filter.$text = { $search: search.trim() };
    }

    const logs = await SystemLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const flat = logs.map(l => ({
      logCode:        l.logCode,
      level:          l.level,
      category:       l.category,
      message:        l.message,
      details:        l.details || '',
      actorName:      l.actor?.name   || '',
      actorRole:      l.actor?.role   || '',
      actorIp:        l.actor?.ip     || '',
      actorPlatform:  l.actor?.platform || '',
      relatedModel:   l.relatedEntity?.model    || '',
      relatedLabel:   l.relatedEntity?.label    || '',
      requestMethod:  l.request?.method         || '',
      requestPath:    l.request?.path           || '',
      statusCode:     l.request?.statusCode     || '',
      durationMs:     l.request?.durationMs     || '',
      environment:    l.environment,
      createdAt:      l.createdAt,
    }));

    await SystemLog.createLog({
      level:    'info',
      category: 'security',
      message:  `System logs exported: ${flat.length} records`,
      actor:    buildActor(req),
      metadata: { exportCount: flat.length, filters: req.query },
      request:  { method: 'GET', path: req.originalUrl, statusCode: 200 },
    });

    res.json({
      success: true,
      count:   flat.length,
      data:    flat,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/logs/user/:userId'
export const getLogsUserByUserId = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { level, category, from, to, page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId.' });
    }

    const user = await User.findById(userId).select('name email role').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const uid = new mongoose.Types.ObjectId(userId);

    const filter = {
      $or: [
        { 'actor.userId':           uid },
        { 'relatedEntity.entityId': uid, 'relatedEntity.model': 'User' },
      ],
    };

    if (level)    filter.level    = level;
    if (category) filter.category = category;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      SystemLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean({ virtuals: true }),
      SystemLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      data: logs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/logs/:logId'
export const getLogsByLogId = asyncHandler(async (req, res) => {
  try {
    const { logId } = req.params;
    const isSuperadmin = req.user.role === 'superadmin';

    const isObjectId = mongoose.Types.ObjectId.isValid(logId);
    const filter     = isObjectId ? { _id: logId } : { logCode: logId.toUpperCase() };

    const projection = isSuperadmin ? '+sensitivePayload' : '';

    const log = await SystemLog.findOne(filter)
      .select(projection)
      .lean({ virtuals: true });

    if (!log) {
      return res.status(404).json({ success: false, message: 'System log not found.' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/logs/:logId'
export const patchLogsByLogId = asyncHandler(async (req, res) => {
  try {
    const { logId } = req.params;
    const { details, metadata } = req.body;

    if (details === undefined && metadata === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one of: details, metadata.',
      });
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(logId);
    const filter     = isObjectId ? { _id: logId } : { logCode: logId.toUpperCase() };

    const updates = {};
    if (details  !== undefined) updates.details  = details;
    if (metadata !== undefined) updates.metadata = metadata;

    const log = await SystemLog.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!log) {
      return res.status(404).json({ success: false, message: 'System log not found.' });
    }

    res.json({
      success: true,
      message: `System log ${log.logCode} updated.`,
      data: { _id: log._id, logCode: log.logCode, details: log.details, metadata: log.metadata },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/logs/:logId'
export const deleteLogsByLogId = asyncHandler(async (req, res) => {
  try {
    const { logId } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(logId);
    const filter     = isObjectId ? { _id: logId } : { logCode: logId.toUpperCase() };

    const log = await SystemLog.findOneAndDelete(filter).lean();

    if (!log) {
      return res.status(404).json({ success: false, message: 'System log not found.' });
    }

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `System log deleted: ${log.logCode} (${log.message?.slice(0, 60)})`,
      actor:    buildActor(req),
      metadata: { deletedLogCode: log.logCode, deletedLevel: log.level, deletedCategory: log.category },
      request:  { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
    });

    res.json({
      success: true,
      message: `System log ${log.logCode} deleted.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/logs'
export const deleteLogs = asyncHandler(async (req, res) => {
  try {
    const { level, category, before, actorId, entityId, confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({
        success: false,
        message: 'confirm: true must be explicitly set in the request body to proceed with log deletion.',
      });
    }

    const hasFilter = level || category || before || actorId || entityId;
    if (!hasFilter) {
      return res.status(400).json({
        success: false,
        message: 'At least one filter (level, category, before, actorId, or entityId) is required for bulk deletion.',
      });
    }

    const filter = {};

    if (level)    filter.level    = level;
    if (category) filter.category = category;
    if (before) {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate)) {
        return res.status(400).json({ success: false, message: 'before must be a valid ISO date string.' });
      }
      filter.createdAt = { $lt: beforeDate };
    }
    if (actorId) {
      if (!mongoose.Types.ObjectId.isValid(actorId)) {
        return res.status(400).json({ success: false, message: 'actorId is not a valid ObjectId.' });
      }
      filter['actor.userId'] = new mongoose.Types.ObjectId(actorId);
    }
    if (entityId) {
      if (!mongoose.Types.ObjectId.isValid(entityId)) {
        return res.status(400).json({ success: false, message: 'entityId is not a valid ObjectId.' });
      }
      filter['relatedEntity.entityId'] = new mongoose.Types.ObjectId(entityId);
    }

    const result = await SystemLog.deleteMany(filter);

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Bulk system log deletion: ${result.deletedCount} logs removed`,
      actor:    buildActor(req),
      metadata: { filters: { level, category, before, actorId, entityId }, deletedCount: result.deletedCount },
      request:  { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
    });

    res.json({
      success: true,
      message: `${result.deletedCount} system log(s) deleted.`,
      data:    { deletedCount: result.deletedCount, filters: filter },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id'
export const getById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id)
      .select('-password -otp -otpExpires')
      .populate('profile')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role')
      .lean({ virtuals: true });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let enrichedProfile = user.profile || null;

    if (user.role === 'doctor' && enrichedProfile) {
      enrichedProfile = await mongoose.model('DoctorProfile')
        .findOne({ user: user._id })
        .populate('primaryHospital', 'name hospitalType address.city address.line1 contact.phone')
        .populate('otherHospitals', 'name hospitalType address.city')
        .lean();
    }

    if (user.role === 'pharmacy' && enrichedProfile) {
      enrichedProfile = await mongoose.model('PharmacyProfile')
        .findOne({ user: user._id })
        .populate('assignedStore', 'storeName storeType address contact')
        .populate('verification.verifiedBy', 'name email')
        .lean();
    }

    if (user.role === 'transportpartner') {
      const tpAgency = await TransportPartner.findOne({ user: user._id })
        .select(
          'businessName businessType ownerName ownerPhone ownerEmail ' +
          'registeredAddress vehicles fleetInfo serviceZones pricing ' +
          'partnershipStatus isOnboardingComplete isAvailable ' +
          'commissionOverridePercent settlementCycle ' +
          'rating stats verifiedAt verifiedBy rejectionReason ' +
          'ownerKyc.fullName ownerKyc.dateOfBirth ownerKyc.gender ' +
          'ownerKyc.aadhaarLast4 ownerKyc.aadhaarVerified ' +
          'ownerKyc.panVerified ownerKyc.kycStatus ownerKyc.kycVerifiedAt ' +
          'ownerKyc.emergencyContact ownerKyc.languagesSpoken ownerKyc.bio ' +
          'createdAt updatedAt'
        )
        .populate('verifiedBy', 'name email')
        .lean({ virtuals: true });

      enrichedProfile = tpAgency || null;
    }

    let orderHistory = [];
    let orderStats = {};
    let bookingHistory = [];
    let bookingStats = {};
    if (user.role === 'customer') {
      const orders = await PharmacyOrder.find({ customer: user._id })
        .select('orderId billing.totalPayable delivery.status payment.status createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      orderHistory = orders;

      const allOrders = await PharmacyOrder.find({ customer: user._id }).lean();
      const totalSpent = allOrders
        .filter(o => o.payment?.status === 'Paid')
        .reduce((sum, o) => sum + (o.billing?.totalPayable || 0), 0);

      orderStats = {
        totalOrders: allOrders.length,
        totalSpent: totalSpent.toFixed(2),
        cancelledOrders: allOrders.filter(o => o.cancellation?.isCancelled).length,
        deliveredOrders: allOrders.filter(o => o.delivery?.status === 'Delivered').length,
        pendingOrders: allOrders.filter(o =>
          ['Placed', 'Confirmed', 'Processing', 'Out-for-Delivery'].includes(o.delivery?.status)
        ).length,
      };

      // ── Booking history (same pattern as PharmacyOrder) ──
      const bookings = await Booking.find({ customer: user._id })
        .select('bookingCode bookingType status paymentStatus fareBreakdown.totalAmount scheduledAt createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      bookingHistory = bookings;

      const allBookings = await Booking.find({ customer: user._id }).lean();
      const totalBookingSpent = allBookings
        .filter(b => ['paid', 'partially_paid', 'pay_at_service_paid'].includes(b.paymentStatus))
        .reduce((sum, b) => sum + (b.fareBreakdown?.amountPaid || 0), 0);

      bookingStats = {
        totalBookings: allBookings.length,
        totalSpent: totalBookingSpent.toFixed(2),
        cancelledBookings: allBookings.filter(b => ['cancelled', 'no_show'].includes(b.status)).length,
        completedBookings: allBookings.filter(b => b.status === 'completed').length,
        pendingBookings: allBookings.filter(b =>
          ['draft', 'payment_pending', 'pending', 'confirmed', 'in_progress'].includes(b.status)
        ).length,
      };
    }

    const [notifications, unreadNotifications] = await Promise.all([
      Notification.find({ recipient: user._id })
        .select('title body type priority isRead createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Notification.countDocuments({ recipient: user._id, isRead: false }),
    ]);

    const sessionSummary = {
      totalSessions: user.auditSessions?.length || 0,
      activeSessions: user.auditSessions || [],
      loginCount: user.loginCount || 0,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      passwordChangedAt: user.passwordChangedAt,
    };

    const accountTimeline = {
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActiveAt: user.lastActiveAt,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      termsAcceptedAt: user.termsAcceptedAt,
      privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt,
    };

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isBlocked: user.isBlocked,
        isCurrentlyBlocked: user.isCurrentlyBlocked,
        blockReason: user.blockReason,
        unblockAt: user.unblockAt,
        isOnline: user.isOnline,
        workStatus: user.workStatus,
        location: user.location,
        lastKnownAddress: user.lastKnownAddress,
        profile: enrichedProfile,
       ...(user.role === 'customer' && { orderHistory, orderStats, bookingHistory, bookingStats }),
        notifications: {
          recent: notifications,
          unreadCount: unreadNotifications,
        },
        security: sessionSummary,
        accountTimeline,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/block'
export const patchByIdBlock = asyncHandler(async (req, res) => {
  try {
    const { action, reason, unblockAt } = req.body;

    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "block" or "unblock".' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot block a superadmin.' });
    }

    if (action === 'block') {
      user.isBlocked = true;
      user.blockReason = reason || 'Blocked by admin';
      user.unblockAt = unblockAt ? new Date(unblockAt) : undefined;
    } else {
      user.isBlocked = false;
      user.blockReason = undefined;
      user.unblockAt = undefined;
    }

    user.updatedBy = req.user._id;
    await user.save();

    await Notification.create({
      recipient: user._id,
      title: action === 'block' ? 'Account Suspended' : 'Account Reinstated',
      body: action === 'block'
        ? `Your account has been suspended. Reason: ${user.blockReason}`
        : 'Your account has been reinstated. You can log in again.',
      type: 'Account_Status',
      priority: 'High',
      channels: [{ channel: 'InApp', status: 'Sent' }],
    });

    res.json({
      success: true,
      message: `User has been ${action === 'block' ? 'blocked' : 'unblocked'} successfully.`,
      data: { _id: user._id, isBlocked: user.isBlocked, blockReason: user.blockReason, unblockAt: user.unblockAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/reset-password'
export const patchByIdResetPassword = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.updatedBy = req.user._id;
    await user.save();

    await sendCredentialsEmail({ email: user.email, name: user.name, role: user.role, rawPassword });

    await Notification.create({
      recipient: user._id,
      title: 'Password Reset by Admin',
      body: 'Your account password has been reset by an administrator. Check your email for the new credentials.',
      type: 'Account_Security',
      priority: 'High',
      channels: [{ channel: 'InApp', status: 'Sent' }],
    });

    res.json({
      success: true,
      message: `Password reset successful. New credentials sent to ${user.email}.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/verify-email'
export const patchByIdVerifyEmail = asyncHandler(async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isEmailVerified: true, updatedBy: req.user._id },
      { new: true }
    ).select('_id name email isEmailVerified');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, message: 'Email verified successfully.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id'
export const patchById = asyncHandler(async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone', 'workStatus', 'lastKnownAddress'];
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updatedBy = req.user._id;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .select('-password -otp -otpExpires -deviceTokens -auditSessions');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, message: 'User updated successfully.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id'
export const deleteById = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own account.' });
    }

    user.isBlocked = true;
    user.blockReason = `Account deactivated by superadmin (${req.user.email}) on ${new Date().toISOString()}`;
    user.updatedBy = req.user._id;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      success: true,
      message: 'User account has been deactivated (soft deleted) successfully.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/sessions'
export const getByIdSessions = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('auditSessions name email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({
      success: true,
      data: {
        user: { name: user.name, email: user.email },
        sessions: user.auditSessions,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id/sessions/:sessionId'
export const deleteByIdSessionsBySessionId = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const before = user.auditSessions.length;
    user.auditSessions = user.auditSessions.filter(
      s => s._id.toString() !== req.params.sessionId
    );

    if (user.auditSessions.length === before) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    await user.save();
    res.json({ success: true, message: 'Session revoked successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id/sessions'
export const deleteByIdSessions = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const count = user.auditSessions.length;
    user.auditSessions = [];
    user.updatedBy = req.user._id;
    await user.save();

    await Notification.create({
      recipient: user._id,
      title: 'All Sessions Terminated',
      body: 'All your active sessions have been terminated by an administrator. Please log in again.',
      type: 'Account_Security',
      priority: 'High',
      channels: [{ channel: 'InApp', status: 'Sent' }],
    });

    res.json({
      success: true,
      message: `All ${count} session(s) revoked. User has been logged out everywhere.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/settings'
export const getByIdSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id)
      .select(
        'name email phone role isEmailVerified isPhoneVerified isBlocked isOnline ' +
        'workStatus lastKnownAddress referralCode referredBy coins ' +
        'termsAcceptedAt privacyPolicyAcceptedAt deviceTokens createdAt'
      )
      .lean();

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const deviceSummary = (user.deviceTokens || []).reduce((acc, t) => {
      acc[t.platform] = (acc[t.platform] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        account: {
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          isBlocked: user.isBlocked,
          isOnline: user.isOnline,
          workStatus: user.workStatus || null,
          lastKnownAddress: user.lastKnownAddress || null,
        },
        referral: {
          referralCode: user.referralCode,
          referredBy: user.referredBy || null,
          coins: user.coins,
        },
        consent: {
          termsAcceptedAt: user.termsAcceptedAt || null,
          privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt || null,
        },
        devices: {
          registeredCount: (user.deviceTokens || []).length,
          byPlatform: deviceSummary,
        },
        memberSince: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/settings'
export const patchByIdSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const {
      isEmailVerified, isPhoneVerified,
      workStatus, lastKnownAddress,
      coins, referralCode, role,
    } = req.body;

    if (role !== undefined) {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only superadmins can change user roles.' });
      }
      const validRoles = [
        'superadmin', 'admin', 'doctor', 'transportpartner',
        'driver', 'lab partner', 'customer', 'pharmacy', 'care assistant', 'finance',
      ];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      user.role = role;
    }

    if (isEmailVerified !== undefined) user.isEmailVerified = Boolean(isEmailVerified);
    if (isPhoneVerified !== undefined) user.isPhoneVerified = Boolean(isPhoneVerified);
    if (workStatus !== undefined) user.workStatus = workStatus;
    if (lastKnownAddress !== undefined) user.lastKnownAddress = lastKnownAddress;

    if (coins !== undefined) {
      if (typeof coins !== 'number' || coins < 0) {
        return res.status(400).json({ success: false, message: 'coins must be a non-negative number.' });
      }
      user.coins = coins;
    }

    if (referralCode !== undefined) {
      if (user.referralHistory?.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change referral code: user already has referral history.',
        });
      }
      const codeExists = await User.findOne({ referralCode, _id: { $ne: user._id } });
      if (codeExists) {
        return res.status(409).json({ success: false, message: 'Referral code already in use by another user.' });
      }
      user.referralCode = referralCode.toUpperCase();
    }

    user.updatedBy = req.user._id;
    await user.save();

    res.json({
      success: true,
      message: 'User settings updated successfully.',
      data: {
        _id: user._id,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        workStatus: user.workStatus,
        lastKnownAddress: user.lastKnownAddress,
        coins: user.coins,
        referralCode: user.referralCode,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id/devices'
export const deleteByIdDevices = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const count = user.deviceTokens.length;
    user.deviceTokens = [];
    user.updatedBy = req.user._id;
    await user.save();

    res.json({
      success: true,
      message: `${count} device token(s) cleared successfully.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id/devices/:deviceId'
export const deleteByIdDevicesByDeviceId = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const before = user.deviceTokens.length;
    user.deviceTokens = user.deviceTokens.filter(
      d => d._id.toString() !== req.params.deviceId
    );

    if (user.deviceTokens.length === before) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    await user.save();
    res.json({ success: true, message: 'Device token removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/security'
export const getByIdSecurity = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id)
      .select(
        'name email role isBlocked blockReason unblockAt ' +
        'lastLoginAt lastLoginIp loginCount passwordChangedAt ' +
        'auditSessions deviceTokens isEmailVerified isPhoneVerified ' +
        'coins coinsEarned coinsRedeemed ' +
        'referralCode referredBy referralHistory ' +
        'createdAt updatedAt createdBy'
      )
      .populate('createdBy', 'name email role')
      .populate('referredBy', 'name email')
      .lean({ virtuals: true });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const securityNotifs = await Notification.find({
      recipient: user._id,
      type: { $in: ['Account_Security', 'Account_Status', 'KYC_Approved', 'KYC_Rejected'] },
    })
      .select('title body type priority isRead createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,

        account: {
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          isBlocked: user.isBlocked,
          blockReason: user.blockReason || null,
          unblockAt: user.unblockAt || null,
          isCurrentlyBlocked: user.isCurrentlyBlocked,
          createdBy: user.createdBy,
          createdAt: user.createdAt,
        },

        loginActivity: {
          totalLogins: user.loginCount,
          lastLoginAt: user.lastLoginAt || null,
          lastLoginIp: user.lastLoginIp || null,
          passwordChangedAt: user.passwordChangedAt || null,
        },

        sessions: {
          total: user.auditSessions?.length || 0,
          list: user.auditSessions || [],
        },

        devices: {
          total: user.deviceTokens?.length || 0,
          byPlatform: (user.deviceTokens || []).reduce((acc, d) => {
            acc[d.platform] = (acc[d.platform] || 0) + 1;
            return acc;
          }, {}),
        },

        coins: {
          balance: user.coins,
          totalEarned: user.coinsEarned,
          totalRedeemed: user.coinsRedeemed,
          balanceInRupees: +(user.coins / 100).toFixed(2),
        },

        referral: {
          code: user.referralCode,
          referredBy: user.referredBy || null,
          totalReferrals: user.referralHistory?.length || 0,
          totalCoinsAwarded: (user.referralHistory || []).reduce((sum, r) => sum + r.coinsAwarded, 0),
        },

        recentSecurityEvents: securityNotifs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/:id/security/send-notification'
export const postByIdSecuritySendNotification = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, type = 'Admin_Announcement', priority = 'Medium', channels } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title and body are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id).select('_id name email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const notification = await Notification.create({
      recipient: user._id,
      title,
      body,
      type,
      priority,
      triggeredBy: 'admin',
      createdBy: req.user._id,
      channels: channels || [{ channel: 'InApp', status: 'Sent' }],
    });

    res.status(201).json({
      success: true,
      message: `Notification sent to ${user.name} (${user.email}).`,
      data: { _id: notification._id, title, type, priority },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/:id/security/adjust-coins'
export const postByIdSecurityAdjustCoins = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { action, amount, reason } = req.body;

    if (!['credit', 'debit'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "credit" or "debit".' });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number.' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id).select('name email coins coinsEarned coinsRedeemed');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (action === 'debit' && user.coins < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coin balance. Current balance: ${user.coins}, requested debit: ${amount}.`,
      });
    }

    const previousBalance = user.coins;

    if (action === 'credit') {
      user.coins += amount;
      user.coinsEarned += amount;
    } else {
      user.coins -= amount;
      user.coinsRedeemed += amount;
    }

    await user.save();

    await Notification.create({
      recipient: user._id,
      title: action === 'credit' ? `${amount} Coins Credited` : `${amount} Coins Deducted`,
      body: `Admin ${action === 'credit' ? 'credited' : 'deducted'} ${amount} coins. Reason: ${reason}. New balance: ${user.coins} coins.`,
      type: action === 'credit' ? 'Coins_Credited' : 'Coins_Redeemed',
      priority: 'Medium',
      triggeredBy: 'admin',
      createdBy: req.user._id,
      channels: [{ channel: 'InApp', status: 'Sent' }],
    });

    res.json({
      success: true,
      message: `${amount} coins ${action === 'credit' ? 'credited to' : 'debited from'} ${user.name}'s wallet.`,
      data: {
        _id: user._id,
        previousBalance,
        adjustment: action === 'credit' ? +amount : -amount,
        newBalance: user.coins,
        reason,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/security/kyc'
export const patchByIdSecurityKyc = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { kycStatus, rejectionReason } = req.body;

    const validStatuses = ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'];
    if (!kycStatus || !validStatuses.includes(kycStatus)) {
      return res.status(400).json({
        success: false,
        message: `kycStatus must be one of: ${validStatuses.join(', ')}`,
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id).select('name email role');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role !== 'transportpartner') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint only updates KYC for transport-partner users.',
      });
    }

    const kycUpdate = {
      'ownerKyc.kycStatus': kycStatus,
      ...(kycStatus === 'verified' && {
        'ownerKyc.kycVerifiedAt': new Date(),
        'ownerKyc.kycVerifiedBy': req.user._id,
        'ownerKyc.aadhaarVerified': true,
        'ownerKyc.panVerified': true,
      }),
      ...(kycStatus === 'rejected' && {
        'ownerKyc.kycRejectionReason': rejectionReason || 'Documents did not meet requirements.',
      }),
    };

    const agency = await TransportPartner.findOneAndUpdate(
      { user: user._id },
      { $set: kycUpdate },
      { new: true, runValidators: true }
    ).select('businessName ownerKyc.kycStatus ownerKyc.kycVerifiedAt');

    if (!agency) {
      return res.status(404).json({ success: false, message: 'Transport Partner agency not found for this user.' });
    }

    await Notification.create({
      recipient: user._id,
      title: kycStatus === 'verified' ? 'KYC Approved' : kycStatus === 'rejected' ? 'KYC Rejected' : 'KYC Status Updated',
      body: kycStatus === 'verified'
        ? 'Your KYC documents have been verified successfully. You can now access all platform features.'
        : kycStatus === 'rejected'
          ? `Your KYC was rejected. Reason: ${rejectionReason || 'Documents did not meet requirements.'}. Please re-submit.`
          : `Your KYC status has been updated to: ${kycStatus}.`,
      type: kycStatus === 'verified' ? 'KYC_Approved' : 'KYC_Rejected',
      priority: 'High',
      triggeredBy: 'admin',
      createdBy: req.user._id,
      channels: [{ channel: 'InApp', status: 'Sent' }, { channel: 'Email', status: 'Queued' }],
    });

    res.json({
      success: true,
      message: `KYC status updated to "${kycStatus}" for ${user.name}.`,
      data: {
        userId: user._id,
        agencyName: agency.businessName,
        kycStatus: agency.ownerKyc.kycStatus,
        kycVerifiedAt: agency.ownerKyc.kycVerifiedAt || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/notifications'
export const getByIdNotifications = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { type, priority, isRead, page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id).select('_id name email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const filter = { recipient: user._id };
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .select('title body type priority isRead createdAt channels relatedEntityType relatedEntityId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: user._id, isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, email: user.email },
        unreadCount,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
        notifications,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/:id/notifications'
export const deleteByIdNotifications = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const user = await User.findById(id).select('_id name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const result = await Notification.deleteMany({ recipient: user._id });

    res.json({
      success: true,
      message: `${result.deletedCount} notification(s) cleared for ${user.name}.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
