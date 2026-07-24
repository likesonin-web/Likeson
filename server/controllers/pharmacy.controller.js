import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { protect, authorize } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import PharmacyStore from '../models/PharmacyStore.js';
import PharmacyProfile from '../models/PharmacyProfile.js';
import sendEmail from '../utils/sendEmail.js';
import { welcomeTemplate } from '../utils/emailTemplates.js';


// --- INTERNAL HELPERS & MIDDLEWARE ---

/**
 * @desc Centralized Async Handler to eliminate try-catch blocks in routes
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @desc Logic to generate secure temporary passwords
 */
const generateTempPassword = (length = 10) => {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
};

// --- ROUTES ---

/**
 * @route   GET /api/v1/pharmacy/stores
 * @desc    1. Get all pharmacy stores with advanced filtering and pagination
 * @access  Private (Admin/Superadmin)
 */

// GET '/stores'
export const getStores = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, storeType, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = {};
  if (status) query.status = status;
  if (storeType) query.storeType = storeType;
  if (search) {
    query.storeName = { $regex: search, $options: 'i' };
  }

  const [stores, total] = await Promise.all([
    PharmacyStore.find(query)
      .populate('managedBy', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    PharmacyStore.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    data: stores
  });
});

// POST '/stores'
export const postStores = asyncHandler(async (req, res) => {
  const { name, email, phone, storeData } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, message: "Name, email, and phone are required for the store manager." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Check if manager email or phone already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] }).session(session);
    if (existingUser) throw new Error("A user with this email or phone already exists.");

    // 2. Generate Credentials
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // 3. Create User (Manager)
    const [manager] = await User.create([{
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'pharmacy',
      isEmailVerified: true,
      createdBy: req.user._id
    }], { session });

    // 4. Create Pharmacy Store
    const [store] = await PharmacyStore.create([{
      ...storeData,
      managedBy: manager._id,
      createdBy: req.user._id
    }], { session });

    // 5. Create Pharmacy Profile & Link to Store
    await PharmacyProfile.create([{
      user: manager._id,
      assignedStore: store._id,
      pharmacistName: name,
      roleInStore: 'Store Manager',
      createdBy: req.user._id
    }], { session });

    // 6. Send Welcome Email with Credentials
    const emailContent = welcomeTemplate({
      header: "PHARMACY PARTNER ONBOARDING",
      title: `Welcome to Likeson, ${name}!`,
      body: `Your pharmacy store "${store.storeName}" has been successfully registered. Use the credentials below to manage your store, inventory, and orders.<br><br><b>Login Email:</b> ${email}<br><b>Temporary Password:</b> ${tempPassword}<br><br>Please change your password after your first login for security.`,
      buttonText: "Go to Pharmacy Dashboard",
      buttonLink: `${process.env.FRONTEND_URL}/login`
    });

    await sendEmail({
      email: manager.email,
      subject: `Onboarding: ${store.storeName} Access Credentials`,
      html: emailContent
    });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: store, managerId: manager._id });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

// PATCH '/my-store'
export const patchMyStore = asyncHandler(async (req, res) => {
  // Prevent escalation: limit what fields a pharmacist can update
  const allowedUpdates = ['contact', 'address', 'timings', 'deliverySettings', 'specializations'];
  const filteredUpdates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) filteredUpdates[key] = req.body[key];
  });

  const store = await PharmacyStore.findOneAndUpdate(
    { managedBy: req.user._id },
    { $set: filteredUpdates, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );

  if (!store) return res.status(404).json({ success: false, message: "Managed store not found for this user." });

  res.status(200).json({ success: true, data: store });
});

// GET '/nearby'
export const getNearby = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 5 } = req.query; // radius in km

  if (!lat || !lng) return res.status(400).json({ message: "Coordinates (lat/lng) are required." });

  const stores = await PharmacyStore.find({
    isVerified: true,
    status: 'Open',
    "address.coordinates": {
      $near: {
        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: radius * 1000 
      }
    }
  }).select('storeName address contact timings specializations status').lean();

  res.status(200).json({ success: true, count: stores.length, data: stores });
});

// GET '/nearby-owned'
export const getNearbyOwned = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;

  const stores = await PharmacyStore.find({
    storeType: 'Owned',
    isVerified: true,
    "address.coordinates": {
      $near: {
        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: radius * 1000
      }
    }
  }).lean();

  res.status(200).json({ success: true, data: stores });
});

// PATCH '/:id/verify'
export const patchByIdVerify = asyncHandler(async (req, res) => {
  const store = await PharmacyStore.findByIdAndUpdate(
    req.params.id,
    { isVerified: true, updatedBy: req.user._id },
    { new: true }
  );

  if (!store) return res.status(404).json({ message: "Store not found." });

  res.status(200).json({ success: true, message: "Store verification updated.", data: store });
});

// POST '/staff/invite'
export const postStaffInvite = asyncHandler(async (req, res) => {
  const { name, email, phone, roleInStore, qualification } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Determine Store ID (If pharmacist, use their managed store. If admin, expect ID in body)
    let targetStoreId;
    if (req.user.role === 'pharmacy') {
       
const profile = await PharmacyProfile.findOne({ user: req.user._id }).session(session);
      if (!profile) throw new Error("Account not associated with an active store.");
      targetStoreId = profile.assignedStore;
    } else {
      targetStoreId = req.body.assignedStore;
    }

    if (!targetStoreId) throw new Error("A target store ID is required.");

    // 2. Create Staff Account
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const [staffUser] = await User.create([{
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'pharmacy',
      createdBy: req.user._id
    }], { session });

    // 3. Create Staff Profile
    await PharmacyProfile.create([{
      user: staffUser._id,
      assignedStore: targetStoreId,
      pharmacistName: name,
      qualification,
      roleInStore: roleInStore || 'Store Manager',
      createdBy: req.user._id
    }], { session });

    // 4. Notify Staff
    const emailHtml = welcomeTemplate({
      header: "PHARMACY STAFF ACCESS",
      title: "Team Invitation",
      body: `You have been added to the Likeson Pharmacy team as ${roleInStore}.<br><br><b>Username:</b> ${email}<br><b>Temp Password:</b> ${tempPassword}`,
      buttonText: "Access Portal",
      buttonLink: `${process.env.FRONTEND_URL}/login`
    });

    await sendEmail({ email, subject: "Staff Access Granted", html: emailHtml });

    await session.commitTransaction();
    res.status(201).json({ success: true, message: "Staff member added and notified." });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

// GET '/me'
export const getMe = asyncHandler(async (req, res) => {
  const profile = await PharmacyProfile.findOne({ user: req.user._id })
    .populate({
      path: 'assignedStore',
      select: 'storeName address contact status isVerified deliverySettings'
    })
    .populate('user', 'name email phone avatar lastActiveAt');

  if (!profile) return res.status(404).json({ success: false, message: "No profile found." });

  res.status(200).json({ success: true, data: profile });
});

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.name === 'ValidationError' ? 400 : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "An unexpected error occurred in Pharmacy Logistics.",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
