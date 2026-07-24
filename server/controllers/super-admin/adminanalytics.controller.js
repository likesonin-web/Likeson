import mongoose        from 'mongoose';
import { protect, authorize }  from '../../middleware/authMiddleware.js';

// ── Models ────────────────────────────────────────────────────────────────────
import User                from '../../models/User.js';
import Booking             from '../../models/Booking.js';
import DoctorProfile       from '../../models/DoctorProfile.js';
import Hospital            from '../../models/Hospital.js';
import Driver              from '../../models/Driver.js';
import TransportPartner    from '../../models/TransportPartner.js';
import SoloDriverPartner   from '../../models/SoloDriverPartner.js';
import LabPartnerProfile   from '../../models/LabPartnerProfile.js';
import PharmacyOrder       from '../../models/PharmacyOrder.js';
import Medicine            from '../../models/Medicine.js';
import SubscriptionPlan    from '../../models/SubscriptionPlan.js';
import UserSubscription    from '../../models/UserSubscription.js';
import Advertisement       from '../../models/Advertisement.js';
import Wallet              from '../../models/Wallet.js';
import OutPatientRecord    from '../../models/OutPatientRecord.js';

// Optional models (import only if they exist in your project)
let BloodBank, BloodRequest, Ride, PharmacyStore, PharmacyProfile;
try { ({ default: BloodBank }      = await import('../../models/BloodBank.js'));      } catch {}
try { ({ default: BloodRequest }   = await import('../../models/BloodRequest.js'));   } catch {}
try { ({ default: Ride }           = await import('../../models/Ride.js'));             } catch {}
try { ({ default: PharmacyStore }  = await import('../../models/PharmacyStore.js'));  } catch {}
try { ({ default: PharmacyProfile }= await import('../../models/PharmacyProfile.js'));} catch {}

import asyncHandler from '../../utils/asyncHandler.js';

// ── Utility Helper Functions ──────────────────────────────────────────────────

// 1. Pagination helper
const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, parseInt(query.limit) || 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// 2. Date Range helper
const parseDateRange = (query) => {
  const to = query.to ? new Date(query.to) : new Date();
  // Default 'from' to 30 days ago if not provided
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); 
  return { from, to };
};

// 3. Date Match query helper for MongoDB
const dateMatch = (from, to, field = 'createdAt') => {
  return { [field]: { $gte: from, $lte: to } };
};

// 4. Trend Calculation helper
const calcTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
};

// 5. Safe Count helper for optional models
const safeCount = (Model) => {
  return Model ? Model.countDocuments({}) : Promise.resolve(0);
};

// ──────────────────────────────────────────────────────────────────────────────


// GET '/overview'
export const getOverview = asyncHandler(async (req, res) => {
  const { from, to }   = parseDateRange(req.query);
  const prevFrom       = new Date(from - (to - from));   // equal-length prior period
  const prevTo         = new Date(from);

  const [
    // Current period
    newUsers, newBookings, newPharmacyOrders, newSubscriptions,
    // Previous period
    prevUsers, prevBookings, prevOrders, prevSubs,
    // Cumulative totals
    totalUsers, totalDoctors, totalHospitals, totalDrivers,
    totalBookings, totalPharmacyOrders, totalSubscriptions,
    totalLabPartners, totalBloodBanks,
    // Status snapshots
    activeBookings, completedBookings, cancelledBookings,
    pendingKycDoctors,
    activeDrivers,
    activeSubs,
    // Revenue snapshots
    bookingRevAgg, pharmacyRevAgg,
  ] = await Promise.all([
    // New in period
    User.countDocuments(        { ...dateMatch(from, to) }),
    Booking.countDocuments(     { ...dateMatch(from, to) }),
    PharmacyOrder.countDocuments({ ...dateMatch(from, to) }),
    UserSubscription.countDocuments({ ...dateMatch(from, to) }),

    // Previous period
    User.countDocuments(        { ...dateMatch(prevFrom, prevTo) }),
    Booking.countDocuments(     { ...dateMatch(prevFrom, prevTo) }),
    PharmacyOrder.countDocuments({ ...dateMatch(prevFrom, prevTo) }),
    UserSubscription.countDocuments({ ...dateMatch(prevFrom, prevTo) }),

    // All-time
    User.countDocuments({}),
    DoctorProfile.countDocuments({}),
    Hospital.countDocuments({}),
    Driver.countDocuments({}),
    Booking.countDocuments({}),
    PharmacyOrder.countDocuments({}),
    UserSubscription.countDocuments({}),
    LabPartnerProfile.countDocuments({}),
    safeCount(BloodBank),

    // Booking states
    Booking.countDocuments({ status: { $in: ['pending', 'confirmed', 'in_progress'] } }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ status: { $in: ['cancelled', 'no_show'] } }),

    // KYC queue
    DoctorProfile.countDocuments({ kycStatus: { $in: ['pending', 'under-review'] } }),

    // Online drivers
    Driver.countDocuments({ status: { $in: ['Available', 'On-Trip'] }, isActive: true }),

    // Active subs
    UserSubscription.countDocuments({ status: { $in: ['Active', 'Trial'] } }),

    // Revenue aggregations
    Booking.aggregate([
      { $match: { ...dateMatch(from, to), paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$fareBreakdown.totalAmount' } } },
    ]),
    PharmacyOrder.aggregate([
      { $match: { ...dateMatch(from, to), 'payment.status': 'Paid' } },
      { $group: { _id: null, total: { $sum: '$billing.totalPayable' } } },
    ]),
  ]);

  const bookingRevenue  = bookingRevAgg[0]?.total  ?? 0;
  const pharmacyRevenue = pharmacyRevAgg[0]?.total ?? 0;
  const totalRevenue    = +(bookingRevenue + pharmacyRevenue).toFixed(2);

  res.json({
    success:  true,
    period:   { from, to },
    trends: {
      users:         calcTrend(newUsers,        prevUsers),
      bookings:      calcTrend(newBookings,      prevBookings),
      pharmacyOrders:calcTrend(newPharmacyOrders, prevOrders),
      subscriptions: calcTrend(newSubscriptions, prevSubs),
    },
    totals: {
      users: totalUsers, doctors: totalDoctors, hospitals: totalHospitals,
      drivers: totalDrivers, bookings: totalBookings,
      pharmacyOrders: totalPharmacyOrders, subscriptions: totalSubscriptions,
      labPartners: totalLabPartners, bloodBanks: totalBloodBanks,
    },
    bookingSnapshot: {
      active: activeBookings, completed: completedBookings, cancelled: cancelledBookings,
    },
    driverSnapshot: { onDuty: activeDrivers },
    pendingKycDoctors,
    activeSubscriptions: activeSubs,
    revenue: {
      period: { from, to },
      bookingRevenue,
      pharmacyRevenue,
      total: totalRevenue,
    },
  });
});

// GET '/bookings'
export const getBookings = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const matchBase = dateMatch(from, to);

  const [
    byType, byStatus, byPaymentStatus, dailyVolume,
    avgFare, topDoctors, topHospitals,
    total, list,
  ] = await Promise.all([

    // Breakdown by booking type
    Booking.aggregate([
      { $match: matchBase },
      { $group: { _id: '$bookingType', count: { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.totalAmount' } } },
      { $sort: { count: -1 } },
    ]),

    // By status
    Booking.aggregate([
      { $match: matchBase },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // By payment status
    Booking.aggregate([
      { $match: matchBase },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
    ]),

    // Daily volume (for chart)
    Booking.aggregate([
      { $match: matchBase },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count:   { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Average fare (paid only)
    Booking.aggregate([
      { $match: { ...matchBase, paymentStatus: 'paid' } },
      { $group: { _id: null,
          avgFare: { $avg: '$fareBreakdown.totalAmount' },
          totalRevenue: { $sum: '$fareBreakdown.totalAmount' },
        },
      },
    ]),

    // Top 10 doctors by booking count
    Booking.aggregate([
      { $match: { ...matchBase, doctor: { $ne: null } } },
      { $group: { _id: '$doctor', count: { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.totalAmount' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'doctorprofiles', localField: '_id',
          foreignField: '_id', as: 'doc' } },
      { $lookup: { from: 'users', localField: 'doc.user',
          foreignField: '_id', as: 'user' } },
      { $project: { count: 1, revenue: 1,
          doctorName: { $arrayElemAt: ['$user.name', 0] },
          specialization: { $arrayElemAt: ['$doc.specialization', 0] } } },
    ]),

    // Top 10 hospitals
    Booking.aggregate([
      { $match: { ...matchBase, hospital: { $ne: null } } },
      { $group: { _id: '$hospital', count: { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.totalAmount' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'hospitals', localField: '_id',
          foreignField: '_id', as: 'hosp' } },
      { $project: { count: 1, revenue: 1,
          hospitalName: { $arrayElemAt: ['$hosp.name', 0] },
          hospitalType: { $arrayElemAt: ['$hosp.hospitalType', 0] },
          city: { $arrayElemAt: ['$hosp.address.city', 0] } } },
    ]),

    // Paginated list
    Booking.countDocuments(matchBase),
    Booking.find(matchBase)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name email phone')
      .populate({ path: 'doctor',
        populate: { path: 'user', select: 'name' },
        select: 'specialization user',
      })
      .populate('hospital', 'name hospitalType address.city')
      .select('bookingCode bookingType status paymentStatus scheduledAt fareBreakdown.totalAmount createdAt'),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    summary: {
      byType, byStatus, byPaymentStatus,
      avgFare:      +(avgFare[0]?.avgFare      ?? 0).toFixed(2),
      totalRevenue: +(avgFare[0]?.totalRevenue ?? 0).toFixed(2),
    },
    charts:     { dailyVolume },
    topDoctors,
    topHospitals,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/appointments'
export const getAppointments = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  // 1. Define the doctor-related booking types based on your schema's 'requiresDoctor' virtual
  const DOCTOR_BOOKING_TYPES = [
    "full_care_ride",
    "doctor_consultation",
    "doctor_online",
    "physiotherapist",
    "follow_up"
  ];

  // 2. Strict Type Filter: Ensure we ONLY query doctor-related appointments.
  // If a specific bookingType is requested, verify it's a doctor type. 
  // Otherwise, fallback to ALL doctor types.
  const typeFilter = req.query.bookingType && DOCTOR_BOOKING_TYPES.includes(req.query.bookingType) 
    ? { bookingType: req.query.bookingType } 
    : { bookingType: { $in: DOCTOR_BOOKING_TYPES } };

  // Filter helpers
  const statusFilter  = req.query.status     ? { status: req.query.status } : {};
  const doctorFilter  = req.query.doctorId   ? { doctor: mongoose.Types.ObjectId.isValid(req.query.doctorId) ? new mongoose.Types.ObjectId(req.query.doctorId) : null } : {};
  const hospitalFilter= req.query.hospitalId ? { hospital: mongoose.Types.ObjectId.isValid(req.query.hospitalId) ? new mongoose.Types.ObjectId(req.query.hospitalId) : null } : {};

  // Combine filters for the main match object
  const match = {
    scheduledAt: { $gte: from, $lte: to },
    ...statusFilter, 
    ...typeFilter, 
    ...doctorFilter, 
    ...hospitalFilter,
  };

  const [total, upcoming, noShow, cancellationRate, appts, opStats] = await Promise.all([
    
    // Total matched appointments
    Booking.countDocuments(match),

    // Upcoming (next 7 days)
    // NOTE: Applied the type, doctor, and hospital filters here so stats reflect the current view
    Booking.countDocuments({
      scheduledAt: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400_000) },
      status: { $in: ['pending', 'confirmed'] },
      ...typeFilter,
      ...doctorFilter,
      ...hospitalFilter
    }),

    // No Shows
    Booking.countDocuments({ ...match, status: 'no_show' }),

    // Cancellation rate
    Booking.aggregate([
      { $match: match },
      { $group: {
          _id: null,
          total:     { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'no_show']] }, 1, 0] } },
        },
      },
    ]),

    // Paginated appointment list
    Booking.find(match)
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name email phone')
      .populate({
        path: 'doctor',
        populate: { path: 'user', select: 'name phone' },
        select: 'specialization user profilePhotoUrl',
      })
      .populate('hospital', 'name address.city contact.phone')
      .populate('careAssistant', 'fullName phone')
      .select('bookingCode bookingType status scheduledAt consultationType patientInfo fareBreakdown.totalAmount notificationsSent'),

    // OP record stats for consultation appointments
    OutPatientRecord.aggregate([
      { $match: { scheduledAt: { $gte: from, $lte: to } } },
      { $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgFee: { $avg: '$consultationFee' },
        },
      },
    ]),
  ]);

  const cancelRate = cancellationRate[0]
    ? +((cancellationRate[0].cancelled / cancellationRate[0].total) * 100).toFixed(1)
    : 0;

  res.json({
    success: true,
    period:  { from, to },
    summary: {
      total, upcoming, noShow,
      cancellationRate: cancelRate,
      opRecordStats: opStats,
    },
    list: {
      data: appts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/appointments/:id'
export const getAppointmentsById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
  }

  const booking = await Booking.findById(req.params.id)
    .populate('customer', 'name email phone avatar')
    .populate({
      path: 'doctor',
      populate: { path: 'user', select: 'name phone email avatar' },
      select: 'specialization registrationNumber fees weeklyAvailability rating user profilePhotoUrl',
    })
    .populate('hospital', 'name hospitalType contact address rating')
    .populate('careAssistant', 'fullName phone photoUrl')
    .populate('driver', 'legalName phone kyc.drivingLicenceNumber performance.rating')
    .populate('labPartner', 'labName contact registeredAddress')
    .populate('primaryRide')
    .populate('rides');

  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

  // Fetch associated OP record if consultation
  let opRecord = null;
  const consultationTypes = ['doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up', 'full_care_ride'];
  if (consultationTypes.includes(booking.bookingType)) {
    opRecord = await OutPatientRecord.findOne({ booking: booking._id })
      .select('opNumber consultationType consultationFee followUpExpiry isFollowUp parentOp doctorNotes prescriptionUrl status');
  }

  res.json({ success: true, booking, opRecord });
});

// GET '/specialties'
export const getSpecialties = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);

  const [specialtyStats, kycBySpecialty, bookingsBySpecialty, ratingBySpecialty] = await Promise.all([

    // Doctor count + avg experience per specialty
    DoctorProfile.aggregate([
      { $group: {
          _id:              '$specialization',
          doctorCount:      { $sum: 1 },
          verifiedCount:    { $sum: { $cond: ['$isVerified', 1, 0] } },
          activeCount:      { $sum: { $cond: ['$isActive', 1, 0] } },
          avgExperience:    { $avg: '$experienceYears' },
          avgRating:        { $avg: '$rating.averageRating' },
          totalConsultations: { $sum: '$stats.totalConsultations' },
        },
      },
      { $sort: { doctorCount: -1 } },
    ]),

    // KYC status distribution per specialty
    DoctorProfile.aggregate([
      { $group: { _id: { spec: '$specialization', kyc: '$kycStatus' }, count: { $sum: 1 } } },
      { $group: {
          _id: '$_id.spec',
          kycBreakdown: { $push: { status: '$_id.kyc', count: '$count' } },
        },
      },
    ]),

    // Bookings per specialty in period
    Booking.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, doctor: { $ne: null } } },
      { $lookup: { from: 'doctorprofiles', localField: 'doctor',
          foreignField: '_id', as: 'dp' } },
      { $group: {
          _id:     { $arrayElemAt: ['$dp.specialization', 0] },
          bookings: { $sum: 1 },
          revenue:  { $sum: '$fareBreakdown.totalAmount' },
        },
      },
      { $sort: { bookings: -1 } },
    ]),

    // Rating distribution per specialty
    DoctorProfile.aggregate([
      { $match: { 'rating.totalRatings': { $gt: 0 } } },
      { $bucket: {
          groupBy: '$rating.averageRating',
          boundaries: [0, 1, 2, 3, 4, 5],
          default: 'unrated',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
  ]);

  // Merge kycBySpecialty into specialtyStats
  const kycMap = Object.fromEntries(kycBySpecialty.map(k => [k._id, k.kycBreakdown]));
  const bookMap = Object.fromEntries(bookingsBySpecialty.map(b => [b._id, { bookings: b.bookings, revenue: b.revenue }]));

  const merged = specialtyStats.map(s => ({
    ...s,
    kycBreakdown:    kycMap[s._id]  ?? [],
    periodBookings:  bookMap[s._id]?.bookings ?? 0,
    periodRevenue:   bookMap[s._id]?.revenue  ?? 0,
  }));

  res.json({
    success: true,
    period:  { from, to },
    specialties: merged,
    ratingDistribution: ratingBySpecialty,
  });
});

// GET '/doctors'
export const getDoctors = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const kycFilter     = req.query.kycStatus       ? { kycStatus: req.query.kycStatus }             : {};
  const partnerFilter = req.query.partnerStatus    ? { partnershipStatus: req.query.partnerStatus }  : {};
  const specFilter    = req.query.specialization   ? { specialization: req.query.specialization }    : {};
  const verifiedFilter= req.query.isVerified !== undefined ? { isVerified: req.query.isVerified === 'true' } : {};

  const match = { ...kycFilter, ...partnerFilter, ...specFilter, ...verifiedFilter };

  const [total, docs, kycQueue] = await Promise.all([
    DoctorProfile.countDocuments(match),

    DoctorProfile.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone avatar isBlocked createdAt')
      .populate('primaryHospital', 'name hospitalType address.city managementModel')
      .select('specialization experienceYears kycStatus partnershipStatus isVerified isActive isOnline rating stats fees profileCompletionPercent profilePhotoUrl'),

    DoctorProfile.countDocuments({ kycStatus: { $in: ['pending', 'under-review'] } }),
  ]);

  // Booking counts for the listed doctors in the period
  const doctorIds = docs.map(d => d._id);
  const bookingCounts = await Booking.aggregate([
    { $match: { doctor: { $in: doctorIds }, ...dateMatch(from, to) } },
    { $group: { _id: '$doctor', count: { $sum: 1 }, revenue: { $sum: '$fareBreakdown.totalAmount' } } },
  ]);
  const bMap = Object.fromEntries(bookingCounts.map(b => [b._id.toString(), b]));

  const enriched = docs.map(d => ({
    ...d.toObject({ virtuals: true }),
    periodBookings: bMap[d._id.toString()]?.count   ?? 0,
    periodRevenue:  bMap[d._id.toString()]?.revenue ?? 0,
  }));

  res.json({
    success: true,
    period:  { from, to },
    kycQueue,
    list: {
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/doctors/:id'
export const getDoctorsById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const { from, to } = parseDateRange(req.query);

  const [doctor, bookingStats, recentBookings, opStats] = await Promise.all([

    DoctorProfile.findById(req.params.id)
      .populate('user', 'name email phone avatar createdAt lastLoginAt')
      .populate('primaryHospital', 'name hospitalType address consultationPricing managementModel')
      .populate('otherHospitals', 'name hospitalType address.city')
      .populate('managedHospitals', 'name hospitalType address.city'),

    // Booking stats for this doctor
    Booking.aggregate([
      { $match: { doctor: new mongoose.Types.ObjectId(req.params.id), ...dateMatch(from, to) } },
      { $group: {
          _id: null,
          total:      { $sum: 1 },
          completed:  { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled:  { $sum: { $cond: [{ $in:  ['$status', ['cancelled', 'no_show']] }, 1, 0] } },
          revenue:    { $sum: '$fareBreakdown.totalAmount' },
          avgFare:    { $avg: '$fareBreakdown.totalAmount' },
          byType:     { $push: '$bookingType' },
        },
      },
    ]),

    // 10 most recent bookings
    Booking.find({ doctor: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customer', 'name phone')
      .select('bookingCode bookingType status scheduledAt fareBreakdown.totalAmount createdAt'),

    // OP record stats
    OutPatientRecord.aggregate([
      { $match: { doctor: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgFee: { $avg: '$consultationFee' },
        },
      },
    ]),
  ]);

  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

  res.json({
    success: true,
    period:  { from, to },
    doctor,
    bookingStats: bookingStats[0] ?? {},
    recentBookings,
    opStats,
  });
});

// GET '/schedules'
export const getSchedules = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);

  const [hourlyDist, weekdayDist, monthlyDist, slotUtilisation, upcomingBusy] = await Promise.all([

    // Bookings by hour of day
    Booking.aggregate([
      { $match: dateMatch(from, to, 'scheduledAt') },
      { $group: {
          _id:   { $hour: '$scheduledAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Bookings by day of week
    Booking.aggregate([
      { $match: dateMatch(from, to, 'scheduledAt') },
      { $group: {
          _id:   { $dayOfWeek: '$scheduledAt' }, // 1=Sun…7=Sat
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Monthly booking volume
    Booking.aggregate([
      { $match: dateMatch(from, to) },
      { $group: {
          _id:   { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Doctor slot utilisation — doctors who have at least 1 slot defined
    DoctorProfile.aggregate([
      { $match: { 'weeklyAvailability.0': { $exists: true } } },
      { $project: {
          totalSlots: { $sum: { $map: {
            input: '$weeklyAvailability',
            as: 'day',
            in: { $size: '$$day.slots' },
          }}},
          activeDays: { $size: { $filter: {
            input: '$weeklyAvailability',
            cond: '$$this.isAvailable',
          }}},
        },
      },
      { $group: {
          _id: null,
          avgSlotsPerDoctor: { $avg: '$totalSlots' },
          avgActiveDays:     { $avg: '$activeDays' },
          totalDoctors:      { $sum: 1 },
        },
      },
    ]),

    // Next 7 days — days with most upcoming bookings
    Booking.aggregate([
      { $match: {
          scheduledAt: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400_000) },
          status: { $in: ['pending', 'confirmed'] },
        },
      },
      { $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekdayLabelled = weekdayDist.map(d => ({
    day: days[d._id - 1] ?? d._id,
    dayIndex: d._id,
    count: d.count,
  }));

  res.json({
    success: true,
    period:  { from, to },
    hourlyDistribution:  hourlyDist,
    weekdayDistribution: weekdayLabelled,
    monthlyVolume:       monthlyDist,
    slotUtilisation:     slotUtilisation[0] ?? {},
    upcomingBusyDays:    upcomingBusy,
  });
});

// GET '/availability'
export const getAvailability = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);

  const hospitalId = req.query.hospitalId;
  const doctorMatch = hospitalId && mongoose.Types.ObjectId.isValid(hospitalId)
    ? { primaryHospital: new mongoose.Types.ObjectId(hospitalId) }
    : {};

  const [hospitals, doctorTotal, doctors, onlineNow, withSlots, withoutSlots] = await Promise.all([

    // Hospital list (for filter dropdown)
    Hospital.find({ isActive: true })
      .select('name hospitalType managementModel address.city linkedDoctors')
      .sort({ name: 1 })
      .limit(200),

    DoctorProfile.countDocuments(doctorMatch),

    // Doctor availability details
    DoctorProfile.find({ ...doctorMatch, isActive: true })
      .sort({ isOnline: -1, 'rating.averageRating': -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone isOnline lastseen')
      .populate('primaryHospital', 'name hospitalType managementModel consultationPricing')
      .select('specialization isVerified isOnline isActive weeklyAvailability consultationTypes fees partnershipStatus profileCompletionPercent rating'),

    DoctorProfile.countDocuments({ isOnline: true, isActive: true }),
    DoctorProfile.countDocuments({ 'weeklyAvailability.0': { $exists: true } }),
    DoctorProfile.countDocuments({ weeklyAvailability: { $size: 0 } }),
  ]);

  // Enrich: compute today's available slots for each doctor
  const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

  const enriched = doctors.map(d => {
    const todayAvail = d.weeklyAvailability?.find(a => a.day === today);
    return {
      ...d.toObject({ virtuals: true }),
      todayAvailability: {
        isAvailable: todayAvail?.isAvailable ?? false,
        slots:        todayAvail?.slots?.filter(s => s.isActive) ?? [],
      },
    };
  });

  // Hospital-level stats
  const hospitalStats = await Hospital.aggregate([
    { $match: { isActive: true } },
    { $project: {
        name: 1, hospitalType: 1, managementModel: 1,
        'address.city': 1,
        doctorCount:      { $size: '$linkedDoctors' },
        bloodBankCount:   { $size: { $ifNull: ['$bloodBanks', []] } },
        hasBloodBank:     1,
        is24x7:           1,
        isEmergencyReady: 1,
        isVerified:       1,
        isActive:         1,
      },
    },
    { $sort: { doctorCount: -1 } },
    { $limit: 50 },
  ]);

  res.json({
    success: true,
    summary: { onlineNow, withSlots, withoutSlots, totalActive: doctorTotal },
    doctors: {
      data: enriched,
      pagination: { page, limit, total: doctorTotal, pages: Math.ceil(doctorTotal / limit) },
    },
    hospitals,
    hospitalStats,
  });
});

// GET '/reports/bookings'
export const getReportsBookings = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const limit = Math.min(5000, parseInt(req.query.limit) || 1000);

  const data = await Booking.find(dateMatch(from, to))
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('customer', 'name email phone')
    .populate({ path: 'doctor', populate: { path: 'user', select: 'name' }, select: 'specialization user' })
    .populate('hospital', 'name address.city')
    .select('bookingCode bookingType status paymentStatus scheduledAt completedAt fareBreakdown patientInfo.name patientInfo.age createdAt')
    .lean();

  // Flatten for easy CSV conversion on the client
  const flat = data.map(b => ({
    bookingCode:     b.bookingCode,
    bookingType:     b.bookingType,
    status:          b.status,
    paymentStatus:   b.paymentStatus,
    customerName:    b.customer?.name,
    customerEmail:   b.customer?.email,
    customerPhone:   b.customer?.phone,
    patientName:     b.patientInfo?.name,
    patientAge:      b.patientInfo?.age,
    doctorName:      b.doctor?.user?.name,
    specialization:  b.doctor?.specialization,
    hospitalName:    b.hospital?.name,
    hospitalCity:    b.hospital?.address?.city,
    scheduledAt:     b.scheduledAt,
    completedAt:     b.completedAt,
    totalAmount:     b.fareBreakdown?.totalAmount,
    amountPaid:      b.fareBreakdown?.amountPaid,
    refundAmount:    b.fareBreakdown?.refundAmount,
    createdAt:       b.createdAt,
  }));

  res.json({ success: true, period: { from, to }, count: flat.length, data: flat });
});

// GET '/reports/revenue'
export const getReportsRevenue = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);

  const [bookingRev, pharmacyRev, subRev, byType, daily] = await Promise.all([

    Booking.aggregate([
      { $match: { ...dateMatch(from, to), paymentStatus: 'paid' } },
      { $group: {
          _id:      '$bookingType',
          count:    { $sum: 1 },
          revenue:  { $sum: '$fareBreakdown.totalAmount' },
          platform: { $sum: '$fareBreakdown.platformFee' },
          taxes:    { $sum: '$fareBreakdown.taxes' },
          discounts:{ $sum: '$fareBreakdown.discount' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    PharmacyOrder.aggregate([
      { $match: { ...dateMatch(from, to), 'payment.status': 'Paid' } },
      { $group: {
          _id:     null,
          revenue: { $sum: '$billing.totalPayable' },
          gst:     { $sum: '$billing.gstAmount' },
          discount:{ $sum: '$billing.discountAmount' },
          orders:  { $sum: 1 },
        },
      },
    ]),

    UserSubscription.aggregate([
      { $match: { ...dateMatch(from, to), status: { $in: ['Active', 'Trial'] } } },
      { $group: { _id: '$fixedTier', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Booking.aggregate([
      { $match: { ...dateMatch(from, to), paymentStatus: 'paid' } },
      { $group: {
          _id:     '$bookingType',
          revenue: { $sum: '$fareBreakdown.totalAmount' },
        },
      },
    ]),

    // Daily revenue (booking + pharmacy combined)
    Booking.aggregate([
      { $match: { ...dateMatch(from, to), paymentStatus: 'paid' } },
      { $group: {
          _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$fareBreakdown.totalAmount' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    period: { from, to },
    bookingRevenue:  { byType: bookingRev },
    pharmacyRevenue: pharmacyRev[0] ?? {},
    subscriptions:   { byTier: subRev },
    revenueByType:   byType,
    dailyRevenue:    daily,
    totals: {
      bookings:  bookingRev.reduce((s, r) => s + r.revenue, 0),
      pharmacy:  pharmacyRev[0]?.revenue ?? 0,
    },
  });
});

// GET '/reports/users'
export const getReportsUsers = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const roleFilter = req.query.role ? { role: req.query.role } : {};

  const [total, byRole, list] = await Promise.all([

    User.countDocuments({ ...dateMatch(from, to), ...roleFilter }),

    User.aggregate([
      { $group: {
          _id:      '$role',
          count:    { $sum: 1 },
          blocked:  { $sum: { $cond: ['$isBlocked', 1, 0] } },
          verified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]),

    User.find({ ...dateMatch(from, to), ...roleFilter })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name email phone role isEmailVerified isPhoneVerified isBlocked coins createdAt lastLoginAt'),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    byRole,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/reports/doctors'
export const getReportsDoctors = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);

  const data = await DoctorProfile.find()
    .sort({ createdAt: -1 })
    .limit(2000)
    .populate('user', 'name email phone createdAt')
    .populate('primaryHospital', 'name hospitalType address.city')
    .select('specialization experienceYears kycStatus partnershipStatus isVerified isActive isOnline rating stats fees bankDetails.isBankVerified profileCompletionPercent')
    .lean();

  const flat = data.map(d => ({
    doctorName:          d.user?.name,
    email:               d.user?.email,
    phone:               d.user?.phone,
    specialization:      d.specialization,
    experienceYears:     d.experienceYears,
    kycStatus:           d.kycStatus,
    partnershipStatus:   d.partnershipStatus,
    isVerified:          d.isVerified,
    isActive:            d.isActive,
    isOnline:            d.isOnline,
    avgRating:           d.rating?.averageRating,
    totalRatings:        d.rating?.totalRatings,
    totalConsultations:  d.stats?.totalConsultations,
    totalEarnings:       d.stats?.totalEarnings,
    pendingSettlement:   d.stats?.pendingSettlement,
    bankVerified:        d.bankDetails?.isBankVerified,
    profileCompletion:   d.profileCompletionPercent,
    primaryHospital:     d.primaryHospital?.name,
    hospitalCity:        d.primaryHospital?.['address']?.city,
    joinedAt:            d.user?.createdAt,
    inPersonFee:         d.fees?.inPersonFee,
    videoFee:            d.fees?.videoFee,
    homeVisitFee:        d.fees?.homeVisitFee,
  }));

  res.json({ success: true, count: flat.length, data: flat });
});

// GET '/referrals'
export const getReferrals = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [summary, topReferrers, history, total, list] = await Promise.all([

    // Platform-wide referral stats
    User.aggregate([
      { $group: {
          _id:             null,
          totalWithCode:   { $sum: { $cond: [{ $ne: ['$referralCode', null] }, 1, 0] } },
          totalReferred:   { $sum: { $cond: [{ $ne: ['$referredBy',   null] }, 1, 0] } },
          totalCoinsAwarded: { $sum: '$coinsEarned' },
          totalRedeemed:   { $sum: '$coinsRedeemed' },
        },
      },
    ]),

    // Top 20 referrers by history size
    User.aggregate([
      { $match: { 'referralHistory.0': { $exists: true } } },
      { $project: {
          name: 1, email: 1, phone: 1, role: 1,
          referralCode: 1,
          referralCount:   { $size: '$referralHistory' },
          totalCoinsAwarded: { $sum: '$referralHistory.coinsAwarded' },
          coins: 1, coinsEarned: 1,
        },
      },
      { $sort: { referralCount: -1 } },
      { $limit: 20 },
    ]),

    // Referrals in period (users who joined via referral)
    User.aggregate([
      { $match: { ...dateMatch(from, to), referredBy: { $ne: null } } },
      { $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    User.countDocuments({ referredBy: { $ne: null }, ...dateMatch(from, to) }),

    // Paginated list of referred users
    User.find({ referredBy: { $ne: null }, ...dateMatch(from, to) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('referredBy', 'name email referralCode')
      .select('name email phone role createdAt coins coinsEarned'),
  ]);

  res.json({
    success:     true,
    period:      { from, to },
    summary:     summary[0] ?? {},
    topReferrers,
    dailyReferrals: history,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/regional'
export const getRegional = asyncHandler(async (req, res) => {

  const [hospitalsByCity, doctorsByCity, bookingsByCity, partnersByCity] = await Promise.all([

    // Hospitals grouped by city
    Hospital.aggregate([
      { $match: { isActive: true } },
      { $group: {
          _id:      '$address.city',
          total:    { $sum: 1 },
          verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
          managed:  { $sum: { $cond: [{ $eq: ['$managementModel', 'hospital-manager'] }, 1, 0] } },
          ownerOp:  { $sum: { $cond: [{ $eq: ['$managementModel', 'doctor-owner'] }, 1, 0] } },
          emergency:{ $sum: { $cond: ['$isEmergencyReady', 1, 0] } },
          hasBloodBank: { $sum: { $cond: ['$hasBloodBank', 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Doctors grouped by hospital city
    DoctorProfile.aggregate([
      { $match: { primaryHospital: { $ne: null }, isActive: true } },
      { $lookup: { from: 'hospitals', localField: 'primaryHospital',
          foreignField: '_id', as: 'hosp' } },
      { $group: {
          _id:      { $arrayElemAt: ['$hosp.address.city', 0] },
          total:    { $sum: 1 },
          verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
          online:   { $sum: { $cond: ['$isOnline',   1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Bookings grouped by patient city (from patientLocation.address)
    Booking.aggregate([
      { $match: { 'patientLocation.address': { $exists: true, $ne: '' } } },
      { $group: {
          _id:     '$patientLocation.city',
          count:   { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.totalAmount' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]),

    // Transport partners by city
    TransportPartner.aggregate([
      { $unwind: '$serviceZones' },
      { $group: {
          _id:    '$serviceZones.city',
          agents: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$partnershipStatus', 'active'] }, 1, 0] } },
        },
      },
      { $sort: { agents: -1 } },
    ]),
  ]);

  // Merge by city
  const cities = {};
  const merge = (arr, key, fields) => arr.forEach(r => {
    if (!r._id) return;
    if (!cities[r._id]) cities[r._id] = { city: r._id };
    cities[r._id][key] = fields.reduce((o, f) => ({ ...o, [f]: r[f] }), {});
  });

  merge(hospitalsByCity, 'hospitals', ['total','verified','managed','ownerOp','emergency','hasBloodBank']);
  merge(doctorsByCity,   'doctors',   ['total','verified','online']);
  merge(bookingsByCity,  'bookings',  ['count','revenue']);
  merge(partnersByCity,  'transport', ['agents','active']);

  res.json({
    success: true,
    cities:  Object.values(cities).sort((a, b) => (b.hospitals?.total ?? 0) - (a.hospitals?.total ?? 0)),
    raw: { hospitalsByCity, doctorsByCity, bookingsByCity, partnersByCity },
  });
});

// GET '/finance'
export const getFinance = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);

  const [
    bookingRev, pharmacyRev, refunds,
    pendingPayments, walletStats, subRevenue,
    taxCollected, platformFeeEarned,
  ] = await Promise.all([

    Booking.aggregate([
      { $match: { ...dateMatch(from, to), paymentStatus: 'paid' } },
      { $group: {
          _id:          '$bookingType',
          gross:        { $sum: '$fareBreakdown.totalAmount' },
          platformFee:  { $sum: '$fareBreakdown.platformFee' },
          taxes:        { $sum: '$fareBreakdown.taxes' },
          discount:     { $sum: '$fareBreakdown.discount' },
          coupon:       { $sum: '$fareBreakdown.couponDiscount' },
          wallet:       { $sum: '$fareBreakdown.walletApplied' },
          count:        { $sum: 1 },
        },
      },
      { $sort: { gross: -1 } },
    ]),

    PharmacyOrder.aggregate([
      { $match: { ...dateMatch(from, to), 'payment.status': 'Paid' } },
      { $group: {
          _id:       '$payment.method',
          revenue:   { $sum: '$billing.totalPayable' },
          gst:       { $sum: '$billing.gstAmount' },
          discount:  { $sum: '$billing.discountAmount' },
          platform:  { $sum: '$billing.platformFee' },
          count:     { $sum: 1 },
        },
      },
    ]),

    // Refunds issued in period
    Booking.aggregate([
      { $match: { ...dateMatch(from, to), 'fareBreakdown.refundAmount': { $gt: 0 } } },
      { $group: {
          _id:          null,
          totalRefunded: { $sum: '$fareBreakdown.refundAmount' },
          count:         { $sum: 1 },
        },
      },
    ]),

    // Unpaid bookings
    Booking.aggregate([
      { $match: { paymentStatus: { $in: ['unpaid', 'pending'] }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$fareBreakdown.totalAmount' }, count: { $sum: 1 } } },
    ]),

    // Wallet aggregate stats
    Wallet.aggregate([
      { $group: {
          _id:             null,
          totalBalance:    { $sum: '$balance' },
          totalWithdrawable: { $sum: '$withdrawableBalance' },
          totalLocked:       { $sum: '$lockedBalance' },
          totalCredited:     { $sum: '$totalCredited' },
          totalDebited:      { $sum: '$totalDebited' },
          walletCount:       { $sum: 1 },
        },
      },
    ]),

    // Subscription revenue
    UserSubscription.aggregate([
      { $match: { ...dateMatch(from, to), status: { $in: ['Active'] } } },
      { $lookup: { from: 'subscriptionplans', localField: 'plan', foreignField: '_id', as: 'plan' } },
      { $group: {
          _id:     { $arrayElemAt: ['$plan.fixedTier', 0] },
          count:   { $sum: 1 },
          revenue: { $sum: { $arrayElemAt: ['$plan.pricing.monthly', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    // Tax collected (pharmacy GST)
    PharmacyOrder.aggregate([
      { $match: { ...dateMatch(from, to), 'payment.status': 'Paid' } },
      { $group: { _id: null, totalGst: { $sum: '$billing.gstAmount' } } },
    ]),

    // Platform fee earned from bookings
    Booking.aggregate([
      { $match: { ...dateMatch(from, to), paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$fareBreakdown.platformFee' } } },
    ]),
  ]);

const bookingTotal  = bookingRev.reduce((s, r) => s + r.gross, 0);
  const pharmacyTotal = pharmacyRev.reduce((s, r) => s + r.revenue, 0);
  const pharmacyPlatformFee = pharmacyRev.reduce((s, r) => s + (r.platform ?? 0), 0);

  // ── NET PLATFORM EARNING ─────────────────────────────────────────────────
  // What Likeson actually KEEPS = booking platform fees + pharmacy platform
  // fees + tax collected (pass-through, optional) − refunds issued.
  // This is the number admins actually care about, separate from gross
  // booking value (which mostly goes to doctors/drivers/stores).
  const grossRevenue   = +(bookingTotal + pharmacyTotal).toFixed(2);
  const platformEarned = +((platformFeeEarned[0]?.total ?? 0) + pharmacyPlatformFee).toFixed(2);
  const netPlatformRevenue = +(platformEarned - (refunds[0]?.totalRefunded ?? 0)).toFixed(2);

  res.json({
    success: true,
    period:  { from, to },
    summary: {
      // gross = total money that flowed through bookings + pharmacy orders
      grossRevenue,
      bookingRevenue:     +bookingTotal.toFixed(2),
      pharmacyRevenue:    +pharmacyTotal.toFixed(2),

      // NEW — clear platform-only numbers
      platformFeeEarned:         +(platformFeeEarned[0]?.total ?? 0).toFixed(2), // from bookings
      pharmacyPlatformFeeEarned: +pharmacyPlatformFee.toFixed(2),                // from pharmacy
      totalPlatformEarned:       platformEarned,        // sum of both fees (before refunds)
      totalRefunded:             +(refunds[0]?.totalRefunded ?? 0).toFixed(2),
      netPlatformRevenue,        // ⭐ THE NUMBER YOU WANT — platform's actual take-home

      taxCollected: +(taxCollected[0]?.totalGst ?? 0).toFixed(2),
      pendingPayments: {
        amount: +(pendingPayments[0]?.total ?? 0).toFixed(2),
        count:   pendingPayments[0]?.count  ?? 0,
      },
    },
    bookingRevenueByType: bookingRev,
    pharmacyRevenueByPaymentMethod: pharmacyRev,
    subscriptionRevenue: subRevenue,
    walletSnapshot:      walletStats[0] ?? {},
  });
});

// GET '/users'
export const getUsers = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const roleFilter    = req.query.role    ? { role:      req.query.role }           : {};
  const blockedFilter = req.query.blocked !== undefined ? { isBlocked: req.query.blocked === 'true' } : {};
  const searchFilter  = req.query.search
    ? { $or: [
        { name:  { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
      ] }
    : {};

  const match = { ...roleFilter, ...blockedFilter, ...searchFilter };

  const [total, byRole, recentGrowth, blocked, list] = await Promise.all([

    User.countDocuments(match),

    User.aggregate([
      { $group: {
          _id:             '$role',
          count:           { $sum: 1 },
          blocked:         { $sum: { $cond: ['$isBlocked', 1, 0] } },
          emailVerified:   { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          phoneVerified:   { $sum: { $cond: ['$isPhoneVerified', 1, 0] } },
          withReferral:    { $sum: { $cond: [{ $ne: ['$referredBy', null] }, 1, 0] } },
          avgCoins:        { $avg: '$coins' },
        },
      },
      { $sort: { count: -1 } },
    ]),

    // Daily user registrations in period
    User.aggregate([
      { $match: dateMatch(from, to) },
      { $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          byRole: { $push: '$role' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    User.countDocuments({ isBlocked: true }),

    User.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name email phone role isEmailVerified isPhoneVerified isBlocked blockReason coins coinsEarned coinsRedeemed createdAt lastLoginAt loginCount'),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    summary: {
      total, blocked,
      byRole,
    },
    growthChart: recentGrowth,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/subscriptions'
export const getSubscriptions = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [plans, byTier, byStatus, churn, trialConversion, list, total] = await Promise.all([

    SubscriptionPlan.find({ isActive: true })
      .select('name slug planType fixedTier pricing membership consultations pharmacy diagnostics transport careAssistant support')
      .sort({ 'pricing.monthly': 1 }),

    UserSubscription.aggregate([
      { $group: {
          _id:   '$fixedTier',
          count: { $sum: 1 },
          active:    { $sum: { $cond: [{ $in: ['$status', ['Active']] }, 1, 0] } },
          trial:     { $sum: { $cond: [{ $eq: ['$status', 'Trial'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
          expired:   { $sum: { $cond: [{ $eq: ['$status', 'Expired'] }, 1, 0] } },
          autoRenew: { $sum: { $cond: ['$autoRenew', 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]),

    UserSubscription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Churn: cancelled in period
    UserSubscription.aggregate([
      { $match: { ...dateMatch(from, to, 'cancelledAt'), status: 'Cancelled' } },
      { $group: {
          _id:   '$fixedTier',
          count: { $sum: 1 },
        },
      },
    ]),

    // Trial → Active conversions
    UserSubscription.aggregate([
      { $match: { trialUsed: true, status: { $in: ['Active', 'Cancelled', 'Expired'] } } },
      { $group: {
          _id:        null,
          trialsUsed: { $sum: 1 },
          converted:  { $sum: { $cond: [{ $ne: ['$status', 'Trial'] }, 1, 0] } },
        },
      },
    ]),

    UserSubscription.find({ ...dateMatch(from, to) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone')
      .populate('plan', 'name fixedTier pricing.monthly')
      .select('status fixedTier planType expiryDate autoRenew trialUsed limits createdAt'),

    UserSubscription.countDocuments(dateMatch(from, to)),
  ]);

  const trialData = trialConversion[0] ?? { trialsUsed: 0, converted: 0 };
  const conversionRate = trialData.trialsUsed > 0
    ? +((trialData.converted / trialData.trialsUsed) * 100).toFixed(1)
    : 0;

  res.json({
    success: true,
    period:  { from, to },
    plans,
    byTier,
    byStatus,
    churn,
    trialConversion: { ...trialData, conversionRate },
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/transport'
export const getTransport = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [
    agencyStats, soloStats, driverKycStats,
    driversByTier, nearbyGeo,
    agencyList, agencyTotal, expiringCompliance,
  ] = await Promise.all([

    // Agency stats
    TransportPartner.aggregate([
      { $group: {
          _id:         '$partnershipStatus',
          count:       { $sum: 1 },
          totalDrivers:   { $sum: '$fleetInfo.totalDrivers' },
          activeDrivers:  { $sum: '$fleetInfo.activeDrivers' },
          totalVehicles:  { $sum: '$fleetInfo.totalVehicles' },
          activeVehicles: { $sum: '$fleetInfo.activeVehicles' },
        },
      },
    ]),

    // Solo partner stats
    SoloDriverPartner.aggregate([
      { $group: {
          _id:   '$partnershipStatus',
          count: { $sum: 1 },
        },
      },
    ]),

    // Driver KYC status
    Driver.aggregate([
      { $group: {
          _id:   '$kyc.verificationStatus',
          count: { $sum: 1 },
        },
      },
    ]),

    // Drivers by reward tier
    Driver.aggregate([
      { $group: {
          _id:             '$rewards.tier',
          count:           { $sum: 1 },
          avgRating:       { $avg: '$performance.rating' },
          avgRidesCompleted: { $avg: '$performance.totalRidesCompleted' },
        },
      },
      { $sort: { count: -1 } },
    ]),

    // Driver status distribution
    Driver.aggregate([
      { $group: {
          _id:   '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    // Agency paginated list
    TransportPartner.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('businessName ownerName ownerPhone partnershipStatus isOnboardingComplete isAvailable fleetInfo stats rating createdAt'),

    TransportPartner.countDocuments({}),

    // Expiring compliance (DL expiry within 30 days)
    Driver.countDocuments({
      $or: [
        { 'kyc.drivingLicenceExpiry': { $lte: new Date(Date.now() + 30 * 86400_000), $gte: new Date() } },
        { 'kyc.psvBadgeExpiry':       { $lte: new Date(Date.now() + 30 * 86400_000), $gte: new Date() } },
        { 'medicalFitness.expiryDate':{ $lte: new Date(Date.now() + 30 * 86400_000), $gte: new Date() } },
      ],
    }),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    summary: {
      agencyByStatus:      agencyStats,
      soloByStatus:        soloStats,
      driverKyc:           driverKycStats,
      driverStatusNow:     nearbyGeo,
      driversByRewardTier: driversByTier,
      expiringCompliance,
    },
    agencies: {
      data: agencyList,
      pagination: { page, limit, total: agencyTotal, pages: Math.ceil(agencyTotal / limit) },
    },
  });
});

// GET '/pharmacy'
export const getPharmacy = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [
    orderStats, byPaymentMethod, byDeliveryStatus,
    refundStats, topMedicines, lowStockCount,
    expiryCount, categoryDist, orderList, orderTotal,
  ] = await Promise.all([

    // Order summary
    PharmacyOrder.aggregate([
      { $match: dateMatch(from, to) },
      { $group: {
          _id:         null,
          total:       { $sum: 1 },
          revenue:     { $sum: '$billing.totalPayable' },
          gstCollected:{ $sum: '$billing.gstAmount' },
          discounts:   { $sum: '$billing.discountAmount' },
          avgOrderValue:{ $avg: '$billing.totalPayable' },
          paid:        { $sum: { $cond: [{ $eq: ['$payment.status', 'Paid'] }, 1, 0] } },
          cod:         { $sum: { $cond: [{ $eq: ['$payment.method', 'COD'] }, 1, 0] } },
          cancelled:   { $sum: { $cond: ['$cancellation.isCancelled', 1, 0] } },
        },
      },
    ]),

    PharmacyOrder.aggregate([
      { $match: dateMatch(from, to) },
      { $group: { _id: '$payment.method', count: { $sum: 1 }, revenue: { $sum: '$billing.totalPayable' } } },
    ]),

    PharmacyOrder.aggregate([
      { $match: dateMatch(from, to) },
      { $group: { _id: '$delivery.status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Refund stats
    PharmacyOrder.aggregate([
      { $match: { ...dateMatch(from, to), 'cancellation.refundStatus': { $ne: 'None' } } },
      { $group: {
          _id:             '$cancellation.refundStatus',
          count:         { $sum: 1 },
          totalRefunded: { $sum: '$cancellation.refundAmount' },
        },
      },
    ]),

    // Top 10 medicines by order frequency
    PharmacyOrder.aggregate([
      { $match: dateMatch(from, to) },
      { $unwind: '$items' },
      { $group: {
          _id:      '$items.medicine',
          name:     { $first: '$items.name' },
          brand:    { $first: '$items.brandName' },
          qty:      { $sum: '$items.quantity' },
          revenue:  { $sum: '$items.totalPrice' },
          orderCount:{ $sum: 1 },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 10 },
    ]),

    // Low stock count
    Medicine.aggregate([
      { $unwind: '$inventory' },
      { $match: { 'inventory.isLowStock': true, 'inventory.isActive': true } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),

    // Expiring medicines (next 30 days)
    Medicine.aggregate([
      { $unwind: '$inventory' },
      { $match: {
          'inventory.expiryDate': {
            $gte: new Date(),
            $lte: new Date(Date.now() + 30 * 86400_000),
          },
          'inventory.isActive': true,
        },
      },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),

    // Medicine category distribution
    Medicine.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, discontinued: { $sum: { $cond: ['$isDiscontinued', 1, 0] } } } },
      { $sort: { count: -1 } },
    ]),

    // Paginated recent orders
    PharmacyOrder.find(dateMatch(from, to))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name email phone')
      .populate('store', 'storeName')
      .select('orderId billing.totalPayable payment.method payment.status delivery.status cancellation.isCancelled createdAt'),

    PharmacyOrder.countDocuments(dateMatch(from, to)),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    summary: {
      ...orderStats[0],
      lowStockMedicines:  lowStockCount[0]?.count  ?? 0,
      expiringMedicines:  expiryCount[0]?.count    ?? 0,
    },
    byPaymentMethod,
    byDeliveryStatus,
    refundStats,
    topMedicines,
    categoryDistribution: categoryDist,
    orders: {
      data: orderList,
      pagination: { page, limit, total: orderTotal, pages: Math.ceil(orderTotal / limit) },
    },
  });
});

// GET '/labs'
export const getLabs = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [labStats, byStatus, byType, bookingsFromLabs, topLabs, list, total] = await Promise.all([

    LabPartnerProfile.aggregate([
      { $group: {
          _id:       null,
          total:     { $sum: 1 },
          approved:  { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pending:   { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          featured:  { $sum: { $cond: ['$isFeatured', 1, 0] } },
          avgRating: { $avg: '$averageRating' },
          avgTests:  { $avg: { $size: '$labTests' } },
        },
      },
    ]),

    LabPartnerProfile.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    LabPartnerProfile.aggregate([
      { $group: { _id: '$labType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Bookings that used a lab partner
    Booking.aggregate([
      { $match: { ...dateMatch(from, to), bookingType: { $in: ['diagnostic_center', 'diagnostic_home'] } } },
      { $group: {
          _id:     '$diagnosticDetails.labPartner',
          count:   { $sum: 1 },
          revenue: { $sum: '$fareBreakdown.diagnosticFee' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'labpartnerprofiles', localField: '_id', foreignField: '_id', as: 'lab' } },
      { $project: { count: 1, revenue: 1, labName: { $arrayElemAt: ['$lab.labName', 0] } } },
    ]),

    // Top labs by rating
    LabPartnerProfile.find({ status: 'approved', isActive: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(10)
      .select('labName labType averageRating totalReviews registeredAddress.city sampleCollectionMode'),

    LabPartnerProfile.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone')
      .select('labName labCode labType ownershipType status averageRating totalReviews isVerified isFeatured isActive registeredAddress.city sampleCollectionMode commissionRate'),

    LabPartnerProfile.countDocuments({}),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    summary: { ...labStats[0] },
    byStatus, byType,
    bookingsFromLabs,
    topLabsByRating: topLabs,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/ads'
export const getAds = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [summary, byStatus, byPlacement, byPricingModel, topPerformers, list, total] = await Promise.all([

    Advertisement.aggregate([
      { $group: {
          _id:         null,
          total:       { $sum: 1 },
          active:      { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          totalViews:  { $sum: '$analytics.views' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalSpend:  { $sum: '$budget.currentSpend' },
          totalBudget: { $sum: '$budget.totalMax' },
        },
      },
    ]),

    Advertisement.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, views: { $sum: '$analytics.views' }, clicks: { $sum: '$analytics.clicks' } } },
    ]),

    Advertisement.aggregate([
      { $group: { _id: { page: '$placement.page', slot: '$placement.slot' }, count: { $sum: 1 }, totalViews: { $sum: '$analytics.views' } } },
      { $sort: { totalViews: -1 } },
    ]),

    Advertisement.aggregate([
      { $group: { _id: '$pricingModel', count: { $sum: 1 }, spend: { $sum: '$budget.currentSpend' } } },
    ]),

    // Top 10 ads by CTR (with min 100 views)
    Advertisement.find({ 'analytics.views': { $gte: 100 }, status: 'Active' })
      .sort({ 'analytics.clicks': -1 })
      .limit(10)
      .select('adContent.headline advertiser.name placement analytics budget status pricingModel'),

    Advertisement.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('adContent.headline advertiser.name placement.page placement.slot status analytics budget pricingModel schedule.startDate schedule.endDate'),

    Advertisement.countDocuments({}),
  ]);

  const s = summary[0] ?? {};
  const avgCtr = s.totalViews > 0 ? +((s.totalClicks / s.totalViews) * 100).toFixed(2) : 0;

  res.json({
    success: true,
    period:  { from, to },
    summary: { ...s, avgCtr },
    byStatus, byPlacement, byPricingModel,
    topPerformers: topPerformers.map(ad => ({
      ...ad.toObject({ virtuals: true }),
      ctr: ad.analytics?.views > 0 ? +((ad.analytics.clicks / ad.analytics.views) * 100).toFixed(2) : 0,
    })),
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/bloodbank'
export const getBloodbank = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  // Graceful fallback if BloodBank / BloodRequest models are not yet registered
  if (!BloodBank) {
    return res.json({ success: true, message: 'BloodBank model not available yet.', data: {} });
  }

  const [bankStats, byCity, inventoryAgg, list, total, requestStats] = await Promise.all([

    BloodBank.aggregate([
      { $group: {
          _id:       null,
          total:     { $sum: 1 },
          active:    { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          mobile:    { $sum: { $cond: [{ $eq: ['$bankType', 'mobile'] }, 1, 0] } },
          embedded:  { $sum: { $cond: [{ $eq: ['$bankType', 'hospital_embedded'] }, 1, 0] } },
          standalone:{ $sum: { $cond: [{ $eq: ['$bankType', 'standalone'] }, 1, 0] } },
        },
      },
    ]),

    BloodBank.aggregate([
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).catch(() => []),

    // Blood group inventory across all banks
    BloodBank.aggregate([
      { $unwind: { path: '$inventory', preserveNullAndEmptyArrays: true } },
      { $group: {
          _id: '$inventory.bloodGroup',
          totalUnits:     { $sum: '$inventory.unitsAvailable' },
          totalBanks:     { $sum: 1 },
          avgUnitsPerBank: { $avg: '$inventory.unitsAvailable' },
        },
      },
      { $sort: { totalUnits: -1 } },
    ]).catch(() => []),

    BloodBank.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .catch(() => []),

    BloodBank.countDocuments({}).catch(() => 0),

    // Blood request stats (if model exists)
    BloodRequest
      ? BloodRequest.aggregate([
          { $match: dateMatch(from, to) },
          { $group: {
              _id:       '$status',
              count:     { $sum: 1 },
              totalUnits:{ $sum: '$units' },
            },
          },
        ]).catch(() => [])
      : Promise.resolve([]),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    summary: bankStats[0] ?? {},
    byCity,
    bloodGroupInventory: inventoryAgg,
    requestStats,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/wallet'
export const getWallet = asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const { page, limit, skip } = paginate(req.query);

  const [
    aggregate, byPurpose, withdrawalStats,
    pendingWithdrawals, dailyTxnVolume,
    topWallets, list, total,
  ] = await Promise.all([

    // Platform-wide wallet balances
    Wallet.aggregate([
      { $group: {
          _id:               null,
          totalBalance:      { $sum: '$balance' },
          totalWithdrawable: { $sum: '$withdrawableBalance' },
          totalLocked:       { $sum: '$lockedBalance' },
          totalCredited:     { $sum: '$totalCredited' },
          totalDebited:      { $sum: '$totalDebited' },
          totalWithdrawn:    { $sum: '$totalWithdrawn' },
          wallets:           { $sum: 1 },
          avgBalance:        { $avg: '$balance' },
        },
      },
    ]),

    // Transactions by purpose in period
    Wallet.aggregate([
      { $unwind: '$transactions' },
      { $match: {
          'transactions.timestamp': { $gte: from, $lte: to },
          'transactions.status':    'Success',
        },
      },
      { $group: {
          _id:    '$transactions.purpose',
          count:  { $sum: 1 },
          amount: { $sum: '$transactions.amount' },
          credits:{ $sum: { $cond: [{ $eq: ['$transactions.type', 'Credit'] }, '$transactions.amount', 0] } },
          debits: { $sum: { $cond: [{ $eq: ['$transactions.type', 'Debit']  }, '$transactions.amount', 0] } },
        },
      },
      { $sort: { amount: -1 } },
    ]),

    // Withdrawal request stats
    Wallet.aggregate([
      { $unwind: '$withdrawalRequests' },
      { $group: {
          _id:    '$withdrawalRequests.status',
          count:  { $sum: 1 },
          amount: { $sum: '$withdrawalRequests.amount' },
        },
      },
    ]),

    // Pending withdrawals list
    Wallet.aggregate([
      { $unwind: '$withdrawalRequests' },
      { $match: { 'withdrawalRequests.status': 'Pending' } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $project: {
          requestId:         '$withdrawalRequests.requestId',
          amount:            '$withdrawalRequests.amount',
          bankName:          '$withdrawalRequests.bankName',
          requestedAt:       '$withdrawalRequests.requestedAt',
          userName:          { $arrayElemAt: ['$user.name',  0] },
          userEmail:         { $arrayElemAt: ['$user.email', 0] },
          userPhone:         { $arrayElemAt: ['$user.phone', 0] },
        },
      },
      { $sort: { requestedAt: -1 } },
      { $limit: 50 },
    ]),

    // Daily transaction volume
    Wallet.aggregate([
      { $unwind: '$transactions' },
      { $match: { 'transactions.timestamp': { $gte: from, $lte: to } } },
      { $group: {
          _id:    { $dateToString: { format: '%Y-%m-%d', date: '$transactions.timestamp' } },
          count:  { $sum: 1 },
          amount: { $sum: '$transactions.amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Top 10 wallets by balance
    Wallet.find({ isActive: true })
      .sort({ balance: -1 })
      .limit(10)
      .populate('user', 'name email phone role')
      .select('balance withdrawableBalance lockedBalance totalCredited totalWithdrawn'),

    Wallet.find({ isActive: true })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone role')
      .select('balance withdrawableBalance lockedBalance totalCredited totalDebited totalWithdrawn lastTransactionAt'),

    Wallet.countDocuments({ isActive: true }),
  ]);

  res.json({
    success: true,
    period:  { from, to },
    platform: aggregate[0] ?? {},
    byPurpose,
    withdrawalStats,
    pendingWithdrawals,
    dailyTxnVolume,
    topWallets,
    list: {
      data: list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET '/top-earners'
export const getTopEarners = asyncHandler(async (req, res) => {
  // Default range = current ISO week (Monday → now)
  const now = new Date();
  let from = req.query.from ? new Date(req.query.from) : null;
  let to   = req.query.to   ? new Date(req.query.to)   : now;

  if (!from) {
    const day = now.getDay();                  // 0 = Sun … 6 = Sat
    const diffToMonday = (day === 0 ? 6 : day - 1);
    from = new Date(now);
    from.setDate(now.getDate() - diffToMonday);
    from.setHours(0, 0, 0, 0);
  }

  const limit = Math.min(50, parseInt(req.query.limit) || 10);

  const [
    topDoctorsWeek, topDriversWeek, topAgenciesWeek,
    topSoloDriversWeek, topLabsWeek, topPharmacyStoresWeek,
    lifetimeDoctors, lifetimeDrivers, lifetimeAgencies,
    lifetimeSolo, lifetimeLabs,
  ] = await Promise.all([

    // ── Doctors — revenue from completed+paid bookings this week ────────────
    Booking.aggregate([
      { $match: {
          ...dateMatch(from, to),
          doctor: { $ne: null },
          paymentStatus: 'paid',
        },
      },
      { $group: {
          _id:     '$doctor',
          revenue: { $sum: '$fareBreakdown.totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'doctorprofiles', localField: '_id', foreignField: '_id', as: 'doc' } },
      { $unwind: '$doc' },
      { $lookup: { from: 'users', localField: 'doc.user', foreignField: '_id', as: 'user' } },
      { $project: {
          revenue: 1, bookings: 1,
          name:            { $arrayElemAt: ['$user.name', 0] },
          specialization: '$doc.specialization',
          lifetimePending: '$doc.earnings.pendingPayoutPaise',
          lifetimeEarned:  '$doc.earnings.lifetimeEarningsPaise',
        },
      },
    ]),

    // ── Agency Drivers — via Ride model if present, else Booking.driver ─────
    Booking.aggregate([
      { $match: {
          ...dateMatch(from, to),
          driver: { $ne: null },
          paymentStatus: 'paid',
        },
      },
      { $group: {
          _id:     '$driver',
          revenue: { $sum: '$fareBreakdown.transportFee' },
          rides:   { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'drivers', localField: '_id', foreignField: '_id', as: 'drv' } },
      { $unwind: '$drv' },
      { $match: { 'drv.ownerAgency': { $ne: null } } }, // agency drivers only
      { $project: {
          revenue: 1, rides: 1,
          name:             '$drv.legalName',
          driverCode:       '$drv.driverCode',
          ownerAgency:      '$drv.ownerAgency',
          lifetimePending: '$drv.earnings.pendingPayoutPaise',
          lifetimeEarned:  '$drv.earnings.lifetimeEarningsPaise',
        },
      },
    ]),

    // ── Transport Agencies — sum of their drivers' ride revenue this week ───
    Booking.aggregate([
      { $match: {
          ...dateMatch(from, to),
          driver: { $ne: null },
          paymentStatus: 'paid',
        },
      },
      { $group: {
          _id:     '$driver',
          revenue: { $sum: '$fareBreakdown.transportFee' },
        },
      },
      { $lookup: { from: 'drivers', localField: '_id', foreignField: '_id', as: 'drv' } },
      { $unwind: '$drv' },
      { $match: { 'drv.ownerAgency': { $ne: null } } },
      { $group: {
          _id:     '$drv.ownerAgency',
          revenue: { $sum: '$revenue' },
          driverCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'transportpartners', localField: '_id', foreignField: '_id', as: 'tp' } },
      { $unwind: '$tp' },
      { $project: {
          revenue: 1, driverCount: 1,
          name:             '$tp.businessName',
          partnershipStatus: '$tp.partnershipStatus',
          lifetimePending: '$tp.earnings.pendingPayoutPaise',
          lifetimeEarned:  '$tp.earnings.lifetimeEarningsPaise',
        },
      },
    ]),

    // ── Solo Driver-Partners — same booking pool, ownerAgency null ──────────
    Booking.aggregate([
      { $match: {
          ...dateMatch(from, to),
          driver: { $ne: null },
          paymentStatus: 'paid',
        },
      },
      { $group: {
          _id:     '$driver',
          revenue: { $sum: '$fareBreakdown.transportFee' },
          rides:   { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'drivers', localField: '_id', foreignField: '_id', as: 'drv' } },
      { $unwind: '$drv' },
      { $match: { 'drv.soloPartner': { $ne: null } } },
      { $lookup: { from: 'solodriverpartners', localField: 'drv.soloPartner', foreignField: '_id', as: 'sdp' } },
      { $unwind: '$sdp' },
      { $project: {
          revenue: 1, rides: 1,
          name:             '$sdp.legalName',
          partnerCode:      '$sdp.partnerCode',
          lifetimePending: '$sdp.earnings.pendingPayoutPaise',
          lifetimeEarned:  '$sdp.earnings.lifetimeEarningsPaise',
        },
      },
    ]),

    // ── Lab Partners — diagnostic booking revenue this week ──────────────────
    Booking.aggregate([
      { $match: {
          ...dateMatch(from, to),
          bookingType: { $in: ['diagnostic_center', 'diagnostic_home'] },
          paymentStatus: 'paid',
          'diagnosticDetails.labPartner': { $ne: null },
        },
      },
      { $group: {
          _id:     '$diagnosticDetails.labPartner',
          revenue: { $sum: '$fareBreakdown.diagnosticFee' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'labpartnerprofiles', localField: '_id', foreignField: '_id', as: 'lab' } },
      { $unwind: '$lab' },
      { $project: {
          revenue: 1, bookings: 1,
          name:             '$lab.labName',
          labType:          '$lab.labType',
          lifetimePending: '$lab.earnings.pendingPayoutPaise',
          lifetimeEarned:  '$lab.earnings.lifetimeEarningsPaise',
        },
      },
    ]),

    // ── Pharmacy Stores — order revenue this week ─────────────────────────────
    PharmacyOrder.aggregate([
      { $match: { ...dateMatch(from, to), 'payment.status': 'Paid' } },
      { $group: {
          _id:     '$store',
          revenue: { $sum: '$billing.totalPayable' },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'pharmacystores', localField: '_id', foreignField: '_id', as: 'store' } },
      { $unwind: '$store' },
      { $project: {
          revenue: 1, orders: 1,
          name:        '$store.storeName',
          storeType:  '$store.storeType',
          pendingSettlement: '$store.bankDetails.pendingSettlementAmount',
        },
      },
    ]),

    // ── Lifetime leaderboards (independent of week) — straight from `earnings` ──
    DoctorProfile.find({ 'earnings.lifetimeEarningsPaise': { $gt: 0 } })
      .sort({ 'earnings.lifetimeEarningsPaise': -1 })
      .limit(limit)
      .populate('user', 'name')
      .select('specialization earnings user'),

    Driver.find({ 'earnings.lifetimeEarningsPaise': { $gt: 0 }, ownerAgency: { $ne: null } })
      .sort({ 'earnings.lifetimeEarningsPaise': -1 })
      .limit(limit)
      .select('legalName driverCode earnings ownerAgency'),

    TransportPartner.find({ 'earnings.lifetimeEarningsPaise': { $gt: 0 } })
      .sort({ 'earnings.lifetimeEarningsPaise': -1 })
      .limit(limit)
      .select('businessName earnings partnershipStatus'),

    SoloDriverPartner.find({ 'earnings.lifetimeEarningsPaise': { $gt: 0 } })
      .sort({ 'earnings.lifetimeEarningsPaise': -1 })
      .limit(limit)
      .select('legalName partnerCode earnings'),

    LabPartnerProfile.find({ 'earnings.lifetimeEarningsPaise': { $gt: 0 } })
      .sort({ 'earnings.lifetimeEarningsPaise': -1 })
      .limit(limit)
      .select('labName labType earnings'),
  ]);

  // ── Build unified "Top Earners This Week" leaderboard ───────────────────────
  // Combine every category into one array, tag with `category`, sort by revenue.
  const unified = [
    ...topDoctorsWeek.map(d         => ({ category: 'doctor',          ...d })),
    ...topDriversWeek.map(d         => ({ category: 'agency_driver',   ...d })),
    ...topAgenciesWeek.map(d        => ({ category: 'transport_agency',...d })),
    ...topSoloDriversWeek.map(d     => ({ category: 'solo_driver',     ...d })),
    ...topLabsWeek.map(d            => ({ category: 'lab_partner',     ...d })),
    ...topPharmacyStoresWeek.map(d  => ({ category: 'pharmacy_store',  ...d })),
  ].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
   .slice(0, limit)
   .map((row, idx) => ({ rank: idx + 1, ...row }));

  res.json({
    success: true,
    period:  { from, to },
    topEarnersThisWeek: unified,         // ⭐ single ranked list across ALL types
    byCategory: {
      doctors:           topDoctorsWeek,
      agencyDrivers:     topDriversWeek,
      transportAgencies: topAgenciesWeek,
      soloDrivers:       topSoloDriversWeek,
      labPartners:       topLabsWeek,
      pharmacyStores:   topPharmacyStoresWeek,
    },
    lifetimeLeaderboards: {
      doctors:           lifetimeDoctors,
      agencyDrivers:     lifetimeDrivers,
      transportAgencies: lifetimeAgencies,
      soloDrivers:       lifetimeSolo,
      labPartners:       lifetimeLabs,
    },
  });
});

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, _next) => {
  console.error('[AdminAnalytics]', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};