import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/authMiddleware.js'; // adjust path to your actual auth middleware

const router = express.Router();

/**
 * GET /api/earnings
 * Logged-in partner's earnings — summary totals + paginated list.
 * Query params:
 *   status   - 'pending' | 'settled' | 'reversed' | 'recovery' | 'partial' (optional filter)
 *   range    - 'weekly' | 'monthly' | 'yearly' (optional, groups summary by period)
 *   page, limit - pagination (default page=1, limit=20)
 *   from, to - ISO date bounds on createdAt (optional)
 */
router.get('/', protect, async (req, res) => {
  try {
    const BookingPartnerAllocation = mongoose.model('BookingPartnerAllocation');
    const partnerId = req.user._id;

    const { status, range, from, to } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    const match = { partnerId: new mongoose.Types.ObjectId(partnerId) };
    if (status) match.status = status;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to)   match.createdAt.$lte = new Date(to);
    }

    // ── Summary totals (always computed on full match set, ignores pagination) ──
    const summaryAgg = await BookingPartnerAllocation.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$grossAmount' },
          netTotal: { $sum: '$netPayable' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      pending: { total: 0, netTotal: 0, count: 0 },
      settled: { total: 0, netTotal: 0, count: 0 },
      reversed: { total: 0, netTotal: 0, count: 0 },
      recovery: { total: 0, netTotal: 0, count: 0 },
      partial: { total: 0, netTotal: 0, count: 0 },
    };
    summaryAgg.forEach((row) => {
      if (summary[row._id]) {
        summary[row._id] = { total: row.total, netTotal: row.netTotal, count: row.count };
      }
    });
    summary.allTimeGross = summaryAgg.reduce((s, r) => s + r.total, 0);
    summary.allTimeNet   = summaryAgg.reduce((s, r) => s + r.netTotal, 0);

    // ── Optional period breakdown (weekly/monthly/yearly) ──
    let periodBreakdown = null;
    if (range) {
      const dateFormat = { weekly: '%G-W%V', monthly: '%Y-%m', yearly: '%Y' }[range];
      if (dateFormat) {
        periodBreakdown = await BookingPartnerAllocation.aggregate([
          { $match: match },
          {
            $group: {
              _id: { period: { $dateToString: { format: dateFormat, date: '$createdAt' } }, status: '$status' },
              total: { $sum: '$grossAmount' },
              netTotal: { $sum: '$netPayable' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.period': -1 } },
        ]);
      }
    }

    // ── Paginated list, most recent first, with booking context populated ──
    const [items, totalCount] = await Promise.all([
      BookingPartnerAllocation.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'bookingId',
          select: 'bookingCode bookingType scheduledAt status patientInfo.name consultationType',
        })
        .lean(),
      BookingPartnerAllocation.countDocuments(match),
    ]);

    res.json({
      success: true,
      summary,
      periodBreakdown,
      pagination: {
        page, limit, totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      items,
    });
  } catch (err) {
    console.error('[GET /earnings] failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings' });
  }
});

/**
 * GET /api/earnings/:allocationId
 * Full detail for one earning — allocation + booking snapshot + settlement
 * (if settled) + liability (if this partner was the cash collector).
 */
router.get('/:allocationId', protect, async (req, res) => {
  try {
    const BookingPartnerAllocation   = mongoose.model('BookingPartnerAllocation');
    const PartnerSettlement          = mongoose.model('PartnerSettlement');
    const PartnerCollectionLiability = mongoose.model('PartnerCollectionLiability');

    const allocation = await BookingPartnerAllocation.findById(req.params.allocationId)
      .populate({
        path: 'bookingId',
        select: 'bookingCode bookingType scheduledAt status paymentStatus fareBreakdown patientInfo consultationType completedAt',
      })
      .lean();

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Earning not found' });
    }

    // Ownership check — partner can only view their own earning (admin bypass optional)
    if (String(allocation.partnerId) !== String(req.user._id) && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this earning' });
    }

    const [settlement, liability] = await Promise.all([
      allocation.settlementId
        ? PartnerSettlement.findById(allocation.settlementId).lean()
        : PartnerSettlement.findOne({ bookingId: allocation.bookingId?._id, partnerId: allocation.partnerId }).lean(),
      allocation.isCashCollector
        ? PartnerCollectionLiability.findOne({ booking: allocation.bookingId?._id, partner: allocation.partnerId }).lean()
        : null,
    ]);

    res.json({
      success: true,
      allocation,
      settlement: settlement || null,
      liability: liability || null,
    });
  } catch (err) {
    console.error('[GET /earnings/:id] failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch earning detail' });
  }
});

export default router;