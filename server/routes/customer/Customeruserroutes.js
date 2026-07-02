import express from 'express';
import EPrescription     from '../../models/EPrescription.js';
import User              from '../../models/User.js';
import CustomerProfile   from '../../models/CustomerProfile.js';
import Notification      from '../../models/Notification.js';
import PatientCareRecord from '../../models/PatientCareRecord.js';
import sendEmail         from '../../utils/sendEmail.js';
import { transactionalTemplate } from '../../utils/emailTemplates.js';
import { protect, authorize }    from '../../middleware/authMiddleware.js';
import upload            from '../../middleware/upload.js'; // multer-s3 — sets file.location

const router = express.Router();

router.use(protect);
router.use(authorize('customer'));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GET /me
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me', async (req, res) => {
  try {
    const user    = await User.findById(req.user._id).select('-password -otp -otpExpires -deviceTokens').lean();
    const profile = await CustomerProfile.findOne({ user: req.user._id }).lean();
    res.status(200).json({ success: true, data: { user, profile: profile || {} } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PUT /me  — User fields
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/me', async (req, res) => {
  try {
    const ALLOWED = ['name', 'phone', 'workStatus', 'lastKnownAddress', 'termsAcceptedAt', 'privacyPolicyAcceptedAt', 'location'];
    const updates = {};
    
    ALLOWED.forEach((f) => { 
      if (req.body[f] !== undefined) updates[f] = req.body[f]; 
    });
    
    delete updates.role;
    delete updates.isBlocked;
    delete updates.password;
    updates.updatedBy = req.user._id;

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true })
      .select('-password -otp -otpExpires -deviceTokens');
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PUT /me/profile  — CustomerProfile core fields
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/me/profile', async (req, res) => {
  try {
    const ALLOWED = [
      'gender', 'dob', 'bloodGroup', 'preferredLanguage',
      'address', 'emergencyContact',
      'chronicConditions', 'allergies',
      'notifPrefs',
    ];

    const updates = {};
    ALLOWED.forEach((f) => { 
      if (req.body[f] !== undefined) updates[f] = req.body[f]; 
    });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { ...updates, updatedBy: req.user._id } },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. KYC
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/me/kyc',
  upload.fields([{ name: 'documentFile', maxCount: 1 }, { name: 'backSideFile', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { type, documentNumber, holderName } = req.body;
      if (!type) return res.status(400).json({ success: false, message: 'Document type is required' });

      const documentUrl = req.files?.documentFile?.[0]?.location || undefined;
      const backSideUrl = req.files?.backSideFile?.[0]?.location || undefined;

      const kycEntry = {
        type, documentNumber, holderName,
        verificationStatus: 'Pending',
        ...(documentUrl && { documentUrl }),
        ...(backSideUrl && { backSideUrl }),
      };

      await CustomerProfile.findOneAndUpdate({ user: req.user._id }, { $pull: { kyc: { type } } });
      const updated = await CustomerProfile.findOneAndUpdate(
        { user: req.user._id },
        { $push: { kyc: kycEntry } },
        { new: true, upsert: true },
      );
      res.status(200).json({ success: true, data: updated.kyc });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get('/me/kyc', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ user: req.user._id }).select('kyc').lean();
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/kyc/:type', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { kyc: { type: req.params.type } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Government Schemes
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/me/government-schemes', upload.single('documentFile'), async (req, res) => {
  try {
    const { schemeName, beneficiaryId, holderName } = req.body;
    if (!schemeName) return res.status(400).json({ success: false, message: 'schemeName is required' });

    const documentUrl = req.file?.location || undefined;

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $push: { governmentSchemes: { schemeName, beneficiaryId, holderName, isVerified: false, ...(documentUrl && { documentUrl }) } } },
      { new: true, upsert: true },
    );
    res.status(201).json({ success: true, data: profile.governmentSchemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/government-schemes/:schemeId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { governmentSchemes: { _id: req.params.schemeId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.governmentSchemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Private Insurance
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/me/private-insurance', upload.single('cardFile'), async (req, res) => {
  try {
    const { insurerName, policyNumber, tpaName, holderName, sumInsured, validFrom, validTo } = req.body;
    if (!insurerName) return res.status(400).json({ success: false, message: 'insurerName is required' });

    const cardUrl = req.file?.location || undefined;

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $push: { privateInsurances: { insurerName, policyNumber, tpaName, holderName, sumInsured, validFrom, validTo, isVerified: false, ...(cardUrl && { cardUrl }) } } },
      { new: true, upsert: true },
    );
    res.status(201).json({ success: true, data: profile.privateInsurances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/private-insurance/:insuranceId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { privateInsurances: { _id: req.params.insuranceId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.privateInsurances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Medical Timeline
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/me/medical-timeline', upload.array('reportFiles', 5), async (req, res) => {
  try {
    const { eventTitle, hospitalName, description, doctorName, date, prescriptionId } = req.body;
    if (!eventTitle) return res.status(400).json({ success: false, message: 'eventTitle is required' });

    const reportUrls = (req.files || []).map((f) => f.location);

    const timelineEntry = {
      eventTitle, hospitalName, description, doctorName, reportUrls,
      date: date || Date.now(),
      ...(prescriptionId && { prescriptionId })
    };

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $push: { medicalTimeline: { $each: [timelineEntry], $sort: { date: -1 } } } },
      { new: true, upsert: true },
    );
    res.status(201).json({ success: true, data: profile.medicalTimeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/me/medical-timeline/:eventId', async (req, res) => {
  try {
    const { eventTitle, hospitalName, description, doctorName, date, prescriptionId } = req.body;
    const setObj = {};
    if (eventTitle)     setObj['medicalTimeline.$.eventTitle']     = eventTitle;
    if (hospitalName)   setObj['medicalTimeline.$.hospitalName']   = hospitalName;
    if (description)    setObj['medicalTimeline.$.description']    = description;
    if (doctorName)     setObj['medicalTimeline.$.doctorName']     = doctorName;
    if (date)           setObj['medicalTimeline.$.date']           = date;
    if (prescriptionId) setObj['medicalTimeline.$.prescriptionId'] = prescriptionId;

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicalTimeline._id': req.params.eventId },
      { $set: setObj },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Event not found' });
    res.status(200).json({ success: true, data: profile.medicalTimeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/medical-timeline/:eventId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { medicalTimeline: { _id: req.params.eventId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.medicalTimeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Medicine History
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/me/medicine-history', async (req, res) => {
  try {
    const { medicineName, dosage, frequency, startDate, endDate, isOngoing, prescribingDoctor, instructions, prescriptionId } = req.body;
    if (!medicineName) return res.status(400).json({ success: false, message: 'medicineName is required' });

    const medEntry = {
      medicineName, dosage, frequency, startDate, endDate, isOngoing, prescribingDoctor, instructions,
      ...(prescriptionId && { prescriptionId })
    };

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $push: { medicineHistory: medEntry } },
      { new: true, upsert: true },
    );
    res.status(201).json({ success: true, data: profile.medicineHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/me/medicine-history/:medId', async (req, res) => {
  try {
    const fields = ['medicineName', 'dosage', 'frequency', 'startDate', 'endDate', 'isOngoing', 'prescribingDoctor', 'instructions', 'prescriptionId'];
    const setObj = {};
    fields.forEach((f) => { 
      if (req.body[f] !== undefined) setObj[`medicineHistory.$.${f}`] = req.body[f]; 
    });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicineHistory._id': req.params.medId },
      { $set: setObj },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Medicine record not found' });
    res.status(200).json({ success: true, data: profile.medicineHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/medicine-history/:medId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { medicineHistory: { _id: req.params.medId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.medicineHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Consent
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/me/consent', async (req, res) => {
  try {
    const { telemedicineConsent, dataSharingConsent, marketingConsent, recordingConsent, consentVersion } = req.body;
    const setObj = { 'consent.consentUpdatedAt': new Date() };
    
    if (telemedicineConsent !== undefined) setObj['consent.telemedicineConsent'] = telemedicineConsent;
    if (dataSharingConsent  !== undefined) setObj['consent.dataSharingConsent']  = dataSharingConsent;
    if (marketingConsent    !== undefined) setObj['consent.marketingConsent']    = marketingConsent;
    if (recordingConsent    !== undefined) setObj['consent.recordingConsent']    = recordingConsent;
    if (consentVersion      !== undefined) setObj['consent.consentVersion']      = consentVersion;

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: setObj },
      { new: true, upsert: true },
    ).select('consent');
    res.status(200).json({ success: true, data: profile.consent });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Vitals Baseline 
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/snapshot', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ user: req.user._id })
      .select('vitalsBaseline emergencyContact bloodGroup chronicConditions allergies preferredLanguage').lean();
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/me/snapshot', async (req, res) => {
  try {
    const { chronicConditions, allergies, preferredLanguage, vitals } = req.body;
    const setObj = {};
    if (chronicConditions !== undefined) setObj.chronicConditions = chronicConditions;
    if (allergies         !== undefined) setObj.allergies         = allergies;
    if (preferredLanguage !== undefined) setObj.preferredLanguage = preferredLanguage;
    
    if (vitals) {
      const VITAL_FIELDS = ['bloodPressure', 'pulseRate', 'temperature', 'spO2', 'bloodSugar', 'weightKg', 'heightCm'];
      VITAL_FIELDS.forEach((v) => {
        if (vitals[v] !== undefined) setObj[`vitalsBaseline.${v}`] = vitals[v];
      });
      setObj['vitalsBaseline.lastUpdated'] = new Date();
    }

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: setObj },
      { new: true, upsert: true },
    ).select('vitalsBaseline chronicConditions allergies preferredLanguage');
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Audit Sessions
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/audit-sessions', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('auditSessions').lean();
    res.status(200).json({ 
      success: true, 
      count: user.auditSessions.length, 
      data: user.auditSessions.sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt)) 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/audit-sessions/:sessionId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { auditSessions: { _id: req.params.sessionId } } },
      { new: true },
    ).select('auditSessions');
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await Notification.create({
      recipient: req.user._id, title: 'Session Terminated',
      body: 'A login session was remotely signed out from your account.',
      type: 'Account_Security', priority: 'High', channels: [{ channel: 'InApp', status: 'Sent' }],
    });
    res.status(200).json({ success: true, message: 'Session removed. That device has been logged out.', data: user.auditSessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/audit-sessions', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { auditSessions: [] } });
    await Notification.create({
      recipient: req.user._id, title: 'All Sessions Terminated',
      body: 'You have been signed out of all devices.',
      type: 'Account_Security', priority: 'High', channels: [{ channel: 'InApp', status: 'Sent' }],
    });
    res.status(200).json({ success: true, message: 'All sessions cleared. Logged out from every device.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Device Tokens
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/me/device-tokens/:tokenId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { deviceTokens: { _id: req.params.tokenId } } },
      { new: true },
    ).select('deviceTokens');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, message: 'Device token removed.', data: user.deviceTokens });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Request Unblock
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/me/request-unblock', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.isCurrentlyBlocked) {
      return res.status(400).json({ success: false, message: 'Your account is not currently blocked.' });
    }

    await Notification.create({
      recipient: req.user._id, title: 'Unblock Request Received',
      body: 'Your unblock request has been submitted. Our team will review it shortly.',
      type: 'Account_Status', priority: 'Medium', channels: [{ channel: 'InApp', status: 'Sent' }],
    });

    await sendEmail({
      email:   process.env.SUPPORT_EMAIL || process.env.SMTP_EMAIL,
      subject: `Account Unblock Request — ${user.name} (${user.email})`,
      html: transactionalTemplate({
        header: 'Account Unblock Request',
        title:  `User ${user.name} has requested to be unblocked`,
        body: `
          <p><strong>User ID:</strong> ${user._id}</p>
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
          <p><strong>Block Reason:</strong> ${user.blockReason || 'Not specified'}</p>
          <p><strong>Auto-Unblock At:</strong> ${user.unblockAt ? new Date(user.unblockAt).toLocaleString('en-IN') : 'Manual block (no expiry)'}</p>
          <p><strong>Customer's Statement:</strong> ${req.body.reason || 'No statement provided'}</p>
        `,
        buttonText: 'Go to Admin Panel',
        buttonLink: process.env.ADMIN_PANEL_URL || '#',
      }),
    });

    res.status(200).json({ success: true, message: 'Your unblock request has been submitted. Our team will get back to you soon.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. Notifications
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/notifications', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;
    const filter = { recipient: req.user._id, ...(req.query.unread === 'true' && { isRead: false }) };

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, page, totalPages: Math.ceil(total / limit), total, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/me/notifications/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/me/notifications/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.status(200).json({ success: true, message: `${result.modifiedCount} notifications marked as read.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. Prescriptions
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/prescriptions', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;
    const filter = { 'patient.userId': req.user._id, ...(req.query.status && { status: req.query.status }) };

    const [prescriptions, total] = await Promise.all([
      EPrescription.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit)
        .select('-medicines.instructions -doctor.signatureUrl').lean(),
      EPrescription.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, page, totalPages: Math.ceil(total / limit), total, data: prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me/prescriptions/:rxNumber', async (req, res) => {
  try {
    const rx = await EPrescription.findOne({ rxNumber: req.params.rxNumber, 'patient.userId': req.user._id }).lean();
    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.status(200).json({ success: true, data: rx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. Reports (from medicalTimeline)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/reports', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ user: req.user._id }).select('medicalTimeline').lean();
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const reports = profile.medicalTimeline
      .filter((e) => e.reportUrls?.length)
      .map((e) => ({ 
        eventId: e._id, 
        eventTitle: e.eventTitle, 
        hospitalName: e.hospitalName, 
        doctorName: e.doctorName, 
        date: e.date, 
        reportUrls: e.reportUrls,
        prescriptionId: e.prescriptionId
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({ success: true, total: reports.length, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/me/reports/:eventId/upload', upload.array('reportFiles', 5), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded' });

    const newUrls = req.files.map((f) => f.location);

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicalTimeline._id': req.params.eventId },
      { $push: { 'medicalTimeline.$.reportUrls': { $each: newUrls } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Event not found' });

    const event = profile.medicalTimeline.id(req.params.eventId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/me/reports/:eventId/file', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'url required in body' });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicalTimeline._id': req.params.eventId },
      { $pull: { 'medicalTimeline.$.reportUrls': url } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Event not found' });

    const event = profile.medicalTimeline.id(req.params.eventId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. Patient Care Records
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/care-records', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;
    const filter = { patient: req.user._id, ...(req.query.status && { status: req.query.status }) };

    const [records, total] = await Promise.all([
      PatientCareRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('careAssistant', 'fullName photoUrl phone')
        .populate('booking', 'bookingCode bookingType scheduledAt status documents')
        .lean(),
      PatientCareRecord.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, page, totalPages: Math.ceil(total / limit), total, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me/care-records/:id', async (req, res) => {
  try {
    const record = await PatientCareRecord.findOne({ _id: req.params.id, patient: req.user._id })
      .select('+hospitalInstructions')
      .populate('careAssistant', 'fullName photoUrl phone')
      .populate('booking', 'bookingCode bookingType scheduledAt status documents patientInfo')
      .lean();

    if (!record) return res.status(404).json({ success: false, message: 'Care record not found' });
    res.status(200).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me/care-records/booking/:bookingId', async (req, res) => {
  try {
    const record = await PatientCareRecord.findOne({ booking: req.params.bookingId, patient: req.user._id })
      .select('+hospitalInstructions')
      .populate('careAssistant', 'fullName photoUrl phone')
      .populate('booking', 'bookingCode bookingType scheduledAt status documents patientInfo')
      .lean();

    if (!record) return res.status(404).json({ success: false, message: 'Care record not found for this booking' });
    res.status(200).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me/care-records/:id/booking-documents', async (req, res) => {
  try {
    const record = await PatientCareRecord.findOne({ _id: req.params.id, patient: req.user._id })
      .populate({ path: 'booking', select: 'documents', match: { customer: req.user._id } })
      .lean();

    if (!record || !record.booking) return res.status(404).json({ success: false, message: 'Booking not found for this record' });
    res.status(200).json({ success: true, data: record.booking.documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;