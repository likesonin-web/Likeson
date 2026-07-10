import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../../models/User.js';
import DoctorProfile from '../../models/DoctorProfile.js';
import PharmacyProfile from '../../models/PharmacyProfile.js';
import CareAssistantProfile from '../../models/CareAssistantProfile.js';
import Hospital from '../../models/Hospital.js';
import PharmacyStore from '../../models/PharmacyStore.js';
import TransportPartner from '../../models/TransportPartner.js'; // Using the unified schema
import Notification from '../../models/Notification.js';
import sendEmail from '../../utils/sendEmail.js';
import { welcomeTemplate } from '../../utils/emailTemplates.js';
import { protect, authorize } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @desc    Get all specialized entities for dropdowns (Hospitals, Stores, Agencies)
 * @access  Private (Admin/SuperAdmin)
 */
router.get('/meta-data', protect, async (req, res) => {
  try {
    const [hospitals, stores, agencies] = await Promise.all([
      Hospital.find({ isActive: true }).select('name _id city'),
      PharmacyStore.find({ status: 'Open' }).select('storeName _id city'),
      // Updated to match the new TransportPartner schema fields
      TransportPartner.find({ partnershipStatus: 'active' }).select('businessName _id')
    ]);

    res.status(200).json({ hospitals, stores, agencies });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc    Master Add User/Employee by Role
 * Handles specialized profile creation and credential dispatch
 */
router.post('/add-user', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { 
      name, email, phone, role, 
      // Role specific fields
      hospitalId, specialization, registrationNumber, experienceYears, inPersonFee,
      storeId, qualification,
      businessName, // Swapped agencyId for businessName to match the new schema requirements
      baseServiceCharge
    } = req.body;

    // 1. Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) return res.status(400).json({ message: 'Email or Phone already registered' });

    // 2. Generate a strong temporary password
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 character random string
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // 3. Create Base User
    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      isEmailVerified: true, // Admin created accounts are pre-verified
      createdBy: req.user._id
    });

    // 4. Create Role-Specific Profiles
    let profileData = null;

    if (role === 'doctor') {
      profileData = await DoctorProfile.create({
        user: newUser._id,
        specialization,
        registrationNumber,
        experienceYears,
        primaryHospital: hospitalId,
        fees: { inPersonFee },
        createdBy: req.user._id
      });
    } else if (role === 'pharmacy') {
      profileData = await PharmacyProfile.create({
        user: newUser._id,
        assignedStore: storeId,
        pharmacistName: name,
        registrationNumber,
        qualification,
        createdBy: req.user._id
      });
    } else if (role === 'transportpartner') {
      // 5. Create TransportPartner matching the new Model Requirements
      profileData = await TransportPartner.create({
        user: newUser._id,
        businessName: businessName || `${name} Logistics`, // Fallback if not explicitly provided
        ownerName: name,
        ownerPhone: phone,
        ownerEmail: email,
        ownerKyc: { 
            kycStatus: 'pending',
            panNumber: 'PENDING', 
            aadhaarNumber: '[Aadhaar Redacted]' 
        } 
      });
    } else if (role === 'care assistant') {
      profileData = await CareAssistantProfile.create({
        user: newUser._id,
        baseServiceCharge
      });
    }

    // 5. Send Welcome Email with Credentials
    await sendEmail({
      email: newUser.email,
      subject: `Welcome to Likeson.in - Your Account is Ready`,
      html: welcomeTemplate({
        header: "LIKESON HEALTHCARE LOGISTICS",
        title: `Welcome, ${name}!`,
        body: `Your professional account as a <b>${role.toUpperCase()}</b> has been created.<br><br>
               <b>Login ID:</b> ${email}<br>
               <b>Temporary Password:</b> ${tempPassword}<br><br>
               Please change your password immediately after your first login for security.`,
        buttonText: "Login to Dashboard",
        buttonLink: process.env.FRONTEND_URL + "/login"
      })
    });

    // 6. Push Notification
    await Notification.create({
      recipient: newUser._id,
      title: 'Welcome to the Team!',
      body: 'Your account has been setup. Check your email for login credentials.',
      type: 'Account_Security',
      priority: 'High'
    });

    res.status(201).json({
      success: true,
      user: newUser,
      profile: profileData
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc    Get Employees / Department list
 * Filterable by role
 */
router.get('/employees', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : { role: { $ne: 'customer' } };

    const employees = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({ count: employees.length, employees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;