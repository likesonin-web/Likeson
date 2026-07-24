import crypto           from 'crypto';
import LegalDocument    from '../models/Legaldocuments.js';
import { protect, authorize } from '../middleware/authMiddleware.js';


// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build SHA-256 checksum from plain text */
const buildChecksum = (text = '') =>
  crypto.createHash('sha256').update(text).digest('hex');

/** Safe parseInt with fallback */
const toInt = (val, fallback) => {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
};

/** Fields admin can update on a DRAFT document */
const DRAFT_UPDATABLE = [
  'title', 'subtitle', 'slug', 'sections', 'fullText', 'fullHtml',
  'summary', 'keyPoints', 'effectiveDate', 'nextReviewDue',
  'platform', 'audienceType', 'complianceStandards',
  'dataProtectionOfficer', 'dataCollected', 'dataPurpose',
  'dataRetention', 'dataSharing', 'userRights', 'refundRules',
  'minAge', 'requiresParentalConsent', 'disputeResolution',
  'requiresExplicitConsent', 'consentMethod',
  'notifyUsersOnUpdate', 'notificationChannels',
  'metaTitle', 'metaDescription', 'pdfUrl',
  'showInFooter', 'showInOnboarding', 'displayOrder',
  'governingLaw', 'jurisdiction', 'legalReviewedBy', 'legalReviewedAt',
];


// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no auth needed
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/legal/active
 * @desc    List all currently active + published documents (for footer links)
 * @access  Public
 */

import asyncHandler from '../utils/asyncHandler.js';

// GET '/active'
export const getActive = asyncHandler(async (req, res) => {
  try {
    const docs = await LegalDocument.find({
      isPublished: true,
      status:      'active',
      isDeleted:   false,
    })
      .select('documentType title slug currentVersion effectiveDate summary keyPoints showInFooter showInOnboarding platform audienceType')
      .sort({ displayOrder: 1 })
      .lean();

    res.status(200).json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:type'
export const getByType = asyncHandler(async (req, res) => {
  try {
    const { type }     = req.params;
    const { platform, audience } = req.query;

    const filter = {
      documentType: type,
      isPublished:  true,
      status:       'active',
      isDeleted:    false,
    };

    // optional platform filter — "all" matches any
    if (platform) filter.$or = [{ platform }, { platform: 'all' }];

    // optional audience filter — "all" matches any
    if (audience) {
      filter.$or = filter.$or
        ? filter.$or.map((clause) => ({ ...clause, audienceType: { $in: [audience, 'all'] } }))
        : [{ audienceType: audience }, { audienceType: 'all' }];
    }

    const doc = await LegalDocument.findOne(filter)
      .select('-consents -versionHistory -isDeleted -deletedAt -deletedBy -__v')
      .sort({ effectiveDate: -1 })
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, message: `No active ${type} found.` });
    }

    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/consent/status'
export const getConsentStatus = asyncHandler(async (req, res) => {
  try {
    const requiredTypes = ['terms_and_conditions', 'privacy_policy'];

    const activeDocs = await LegalDocument.find({
      documentType: { $in: requiredTypes },
      isPublished:  true,
      status:       'active',
      isDeleted:    false,
    })
      .select('documentType currentVersion effectiveDate requiresExplicitConsent')
      .lean();

    const result = {};

    for (const doc of activeDocs) {
      // Check consent exists for this user at current version
      const consentDoc = await LegalDocument.findOne({
        _id:              doc._id,
        'consents.userId':  req.user._id,
        'consents.version': doc.currentVersion,
        'consents.isWithdrawn': false,
      }).select('_id').lean();

      result[doc.documentType] = {
        accepted:       !!consentDoc,
        currentVersion: doc.currentVersion,
        effectiveDate:  doc.effectiveDate,
      };
    }

    const allAccepted = Object.values(result).every((r) => r.accepted);

    res.status(200).json({
      success:      true,
      consentRequired: !allAccepted,
      data:         result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/consent/me'
export const getConsentMe = asyncHandler(async (req, res) => {
  try {
    const docs = await LegalDocument.find({
      'consents.userId': req.user._id,
      isDeleted:         false,
    })
      .select('documentType title currentVersion consents')
      .lean();

    const history = [];

    for (const doc of docs) {
      const userConsents = doc.consents.filter(
        (c) => c.userId.toString() === req.user._id.toString()
      );
      userConsents.forEach((c) => {
        history.push({
          documentType: doc.documentType,
          documentTitle: doc.title,
          version:       c.version,
          consentedAt:   c.consentedAt,
          method:        c.method,
          platform:      c.platform,
          isWithdrawn:   c.isWithdrawn,
          withdrawnAt:   c.withdrawnAt ?? null,
          consentId:     c._id,
        });
      });
    }

    history.sort((a, b) => new Date(b.consentedAt) - new Date(a.consentedAt));

    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/consent'
export const postConsent = asyncHandler(async (req, res) => {
  try {
    const {
      documentTypes = ['terms_and_conditions', 'privacy_policy'],
      method        = 'checkbox',
      platform      = 'web',
      state,
      city,
    } = req.body;

    if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
      return res.status(400).json({ success: false, message: 'documentTypes array required.' });
    }

    const ip        = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'Unknown';
    const userAgent = req.headers['user-agent'] ?? 'Unknown';
    const recorded  = [];

    for (const type of documentTypes) {
      const doc = await LegalDocument.findOne({
        documentType: type,
        isPublished:  true,
        status:       'active',
        isDeleted:    false,
      }).sort({ effectiveDate: -1 });

      if (!doc) {
        return res.status(400).json({ success: false, message: `No active document found for type: ${type}` });
      }

      // Upsert: remove old consent for same user+version, push fresh one
      doc.consents = doc.consents.filter(
        (c) => !(c.userId.toString() === req.user._id.toString() && c.version === doc.currentVersion)
      );

      doc.consents.push({
        userId:      req.user._id,
        version:     doc.currentVersion,
        consentedAt: new Date(),
        ipAddress:   ip,
        userAgent,
        platform,
        method,
        state:       state ?? null,
        city:        city  ?? null,
        isWithdrawn: false,
      });

      doc.totalConsents += 1;
      await doc.save();

      recorded.push({ documentType: type, version: doc.currentVersion });
    }

    // Sync timestamps back to User doc
    const now = new Date();
    const update = {};
    if (documentTypes.includes('terms_and_conditions'))  update.termsAcceptedAt         = now;
    if (documentTypes.includes('privacy_policy'))        update.privacyPolicyAcceptedAt = now;

    if (Object.keys(update).length) {
      await req.user.constructor.findByIdAndUpdate(req.user._id, update);
    }

    res.status(201).json({ success: true, message: 'Consent recorded.', data: recorded });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/consent/withdraw'
export const patchConsentWithdraw = asyncHandler(async (req, res) => {
  try {
    const { documentType, version, reason = 'No reason provided' } = req.body;

    if (!documentType || !version) {
      return res.status(400).json({ success: false, message: 'documentType and version required.' });
    }

    const doc = await LegalDocument.findOne({
      documentType,
      isDeleted: false,
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const consent = doc.consents.find(
      (c) =>
        c.userId.toString() === req.user._id.toString() &&
        c.version === version &&
        !c.isWithdrawn
    );

    if (!consent) {
      return res.status(404).json({ success: false, message: 'Active consent not found for this version.' });
    }

    consent.isWithdrawn = true;
    consent.withdrawnAt = new Date();
    // store reason in userAgent field repurposed? No — add withdrawalReason if needed
    // Note: withdrawalReason not in schema — patch sub-doc using set
    await doc.save();

    res.status(200).json({ success: true, message: 'Consent withdrawn successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET '/admin/all'
export const getAdminAll = asyncHandler(async (req, res) => {
  try {
    const { type, status, platform, audience, page = 1, limit = 10 } = req.query;

    const filter = { isDeleted: false };
    if (type)     filter.documentType = type;
    if (status)   filter.status       = status;
    if (platform) filter.platform     = platform;
    if (audience) filter.audienceType = audience;

    const skip = (toInt(page, 1) - 1) * toInt(limit, 10);

    const [docs, total] = await Promise.all([
      LegalDocument.find(filter)
        .select('-consents -versionHistory -fullText -fullHtml -sections -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(toInt(limit, 10))
        .populate('createdBy', 'name email role')
        .populate('updatedBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .lean(),
      LegalDocument.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page:    toInt(page, 1),
      pages:   Math.ceil(total / toInt(limit, 10)),
      data:    docs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id'
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({
      _id:       req.params.id,
      isDeleted: false,
    })
      .select('-consents -__v')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/admin'
export const postAdmin = asyncHandler(async (req, res) => {
  try {
    const {
      documentType, title, subtitle, slug, currentVersion = '1.0',
      effectiveDate, sections, fullText, fullHtml, summary, keyPoints,
      platform, audienceType, complianceStandards, dataProtectionOfficer,
      dataCollected, dataPurpose, dataRetention, dataSharing, userRights,
      refundRules, minAge, requiresParentalConsent, disputeResolution,
      requiresExplicitConsent, consentMethod,
      notifyUsersOnUpdate, notificationChannels,
      metaTitle, metaDescription, pdfUrl,
      showInFooter, showInOnboarding, displayOrder,
      governingLaw, jurisdiction, legalReviewedBy, legalReviewedAt,
    } = req.body;

    if (!documentType || !title || !slug || !effectiveDate) {
      return res.status(400).json({
        success: false,
        message: 'documentType, title, slug, effectiveDate required.',
      });
    }

    // Slug must be unique
    const slugExists = await LegalDocument.exists({ slug, isDeleted: false });
    if (slugExists) {
      return res.status(400).json({ success: false, message: `Slug "${slug}" already in use.` });
    }

    const doc = await LegalDocument.create({
      documentType, title, subtitle, slug,
      currentVersion, effectiveDate,
      sections:       sections       ?? [],
      fullText:       fullText       ?? '',
      fullHtml:       fullHtml       ?? '',
      summary, keyPoints,
      platform:       platform       ?? 'all',
      audienceType:   audienceType   ?? 'all',
      complianceStandards, dataProtectionOfficer,
      dataCollected, dataPurpose, dataRetention, dataSharing, userRights,
      refundRules, minAge, requiresParentalConsent, disputeResolution,
      requiresExplicitConsent, consentMethod,
      notifyUsersOnUpdate, notificationChannels,
      metaTitle, metaDescription, pdfUrl,
      showInFooter, showInOnboarding, displayOrder,
      governingLaw, jurisdiction, legalReviewedBy, legalReviewedAt,
      checksumSha256: fullText ? buildChecksum(fullText) : undefined,
      status:         'draft',
      isPublished:    false,
      createdBy:      req.user._id,
      updatedBy:      req.user._id,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id'
export const patchAdminById = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.isPublished && doc.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit an active document. Create a new version instead.',
      });
    }

    DRAFT_UPDATABLE.forEach((field) => {
      if (req.body[field] !== undefined) doc[field] = req.body[field];
    });

    // Recompute checksum if fullText changed
    if (req.body.fullText !== undefined) {
      doc.checksumSha256 = buildChecksum(req.body.fullText);
    }

    doc.updatedBy = req.user._id;
    await doc.save();

    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/submit-review'
export const patchAdminByIdSubmitReview = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot submit from status "${doc.status}".` });
    }

    doc.status    = 'review';
    doc.updatedBy = req.user._id;
    await doc.save();

    res.status(200).json({ success: true, message: 'Document submitted for review.', data: { _id: doc._id, status: doc.status } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/approve'
export const patchAdminByIdApprove = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.status !== 'review') {
      return res.status(400).json({ success: false, message: 'Only documents in "review" can be approved.' });
    }

    doc.status     = 'approved';
    doc.approvedBy = req.user._id;
    doc.approvedAt = new Date();
    doc.updatedBy  = req.user._id;
    await doc.save();

    res.status(200).json({ success: true, message: 'Document approved.', data: { _id: doc._id, status: doc.status, approvedAt: doc.approvedAt } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/publish'
export const patchAdminByIdPublish = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (!['approved', 'draft'].includes(doc.status)) {
      return res.status(400).json({ success: false, message: 'Only approved or draft documents can be published.' });
    }

    if (doc.isPublished && doc.status === 'active') {
      return res.status(400).json({ success: false, message: 'Already active.' });
    }

    // Archive current active doc of same type
    const currentActive = await LegalDocument.findOne({
      documentType: doc.documentType,
      status:       'active',
      isPublished:  true,
      isDeleted:    false,
      _id:          { $ne: doc._id },
    });

    if (currentActive) {
      currentActive.status     = 'superseded';
      currentActive.isPublished = false;
      currentActive.updatedBy  = req.user._id;
      await currentActive.save();
    }

    // Archive snapshot into versionHistory
    doc.versionHistory.push({
      version:       doc.currentVersion,
      effectiveDate: doc.effectiveDate,
      archivedBy:    req.user._id,
      snapshotText:  doc.fullText,
      changeSummary: req.body.changeSummary ?? 'Published',
    });

    doc.status      = 'active';
    doc.isPublished = true;
    doc.publishedAt = new Date();
    doc.updatedBy   = req.user._id;
    doc.lastReviewedAt = new Date();

    await doc.save();

    res.status(200).json({
      success: true,
      message: `${doc.documentType} v${doc.currentVersion} is now active.`,
      data: {
        _id:            doc._id,
        documentType:   doc.documentType,
        currentVersion: doc.currentVersion,
        publishedAt:    doc.publishedAt,
        status:         doc.status,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/new-version'
export const patchAdminByIdNewVersion = asyncHandler(async (req, res) => {
  try {
    const source = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!source) return res.status(404).json({ success: false, message: 'Source document not found.' });

    const { newVersion } = req.body;
    if (!newVersion) {
      return res.status(400).json({ success: false, message: 'newVersion required. e.g. "2.0"' });
    }

    const slugVersioned = `${source.documentType.replace(/_/g, '-')}-v${newVersion}`;

    const slugExists = await LegalDocument.exists({ slug: slugVersioned, isDeleted: false });
    if (slugExists) {
      return res.status(400).json({ success: false, message: `Version "${newVersion}" draft already exists.` });
    }

    // Clone source → new draft
    const { _id, createdAt, updatedAt, publishedAt, approvedAt, approvedBy,
            consents, totalConsents, versionHistory, ...cloneData } = source;

    const newDoc = await LegalDocument.create({
      ...cloneData,
      slug:           slugVersioned,
      currentVersion: newVersion,
      status:         'draft',
      isPublished:    false,
      publishedAt:    undefined,
      approvedBy:     undefined,
      approvedAt:     undefined,
      consents:       [],
      totalConsents:  0,
      versionHistory: [],
      createdBy:      req.user._id,
      updatedBy:      req.user._id,
    });

    res.status(201).json({
      success: true,
      message: `New draft v${newVersion} created from v${source.currentVersion}.`,
      data:    { _id: newDoc._id, slug: newDoc.slug, status: newDoc.status },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id/version-history'
export const getAdminByIdVersionHistory = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false })
      .select('documentType title currentVersion versionHistory')
      .populate('versionHistory.archivedBy', 'name email')
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id/consents'
export const getAdminByIdConsents = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, withdrawn, version } = req.query;

    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false })
      .select('documentType title currentVersion consents totalConsents')
      .populate('consents.userId', 'name email phone role')
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    let consents = doc.consents;

    // Filters
    if (version)            consents = consents.filter((c) => c.version === version);
    if (withdrawn === 'true')  consents = consents.filter((c) => c.isWithdrawn);
    if (withdrawn === 'false') consents = consents.filter((c) => !c.isWithdrawn);

    // Sort newest first
    consents.sort((a, b) => new Date(b.consentedAt) - new Date(a.consentedAt));

    const total  = consents.length;
    const skip   = (toInt(page, 1) - 1) * toInt(limit, 20);
    const paged  = consents.slice(skip, skip + toInt(limit, 20));

    res.status(200).json({
      success:       true,
      documentType:  doc.documentType,
      totalConsents: doc.totalConsents,
      total,
      page:          toInt(page, 1),
      pages:         Math.ceil(total / toInt(limit, 20)),
      data:          paged,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/consents/users'
export const getAdminConsentsUsers = asyncHandler(async (req, res) => {
  try {
    const { userId, platform, method, page = 1, limit = 20 } = req.query;

    const matchConsent = {};
    if (userId)   matchConsent['consents.userId']   = userId;
    if (platform) matchConsent['consents.platform'] = platform;
    if (method)   matchConsent['consents.method']   = method;

    // Aggregate: unwind consents, filter, paginate
    const pipeline = [
      { $match: { isDeleted: false, 'consents.0': { $exists: true } } },
      { $unwind: '$consents' },
      ...(Object.keys(matchConsent).length ? [{ $match: matchConsent }] : []),
      { $sort: { 'consents.consentedAt': -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: (toInt(page, 1) - 1) * toInt(limit, 20) },
            { $limit: toInt(limit, 20) },
            {
              $project: {
                documentType: 1,
                title:        1,
                consent:      '$consents',
              },
            },
          ],
        },
      },
    ];

    const [result] = await LegalDocument.aggregate(pipeline);
    const total    = result.metadata[0]?.total ?? 0;

    // Populate userId manually (aggregate doesn't support virtual populate)
    const User = (await import('../models/User.js')).default;
    const populated = await Promise.all(
      result.data.map(async (row) => {
        const user = await User.findById(row.consent.userId)
          .select('name email phone role')
          .lean();
        return { ...row, consent: { ...row.consent, user } };
      })
    );

    res.status(200).json({
      success: true,
      total,
      page:    toInt(page, 1),
      pages:   Math.ceil(total / toInt(limit, 20)),
      data:    populated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/admin/:id'
export const deleteAdminById = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.isPublished && doc.status === 'active') {
      return res.status(400).json({ success: false, message: 'Cannot delete an active document. Archive it first.' });
    }

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = req.user._id;
    await doc.save();

    res.status(200).json({ success: true, message: 'Document soft-deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/archive'
export const patchAdminByIdArchive = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.status === 'archived') {
      return res.status(400).json({ success: false, message: 'Already archived.' });
    }

    doc.status      = 'archived';
    doc.isPublished = false;
    doc.updatedBy   = req.user._id;
    await doc.save();

    res.status(200).json({ success: true, message: 'Document archived.', data: { _id: doc._id, status: doc.status } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id/verify-checksum'
export const getAdminByIdVerifyChecksum = asyncHandler(async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({ _id: req.params.id, isDeleted: false })
      .select('fullText checksumSha256 documentType currentVersion')
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    const computed = buildChecksum(doc.fullText ?? '');
    const intact   = computed === doc.checksumSha256;

    res.status(200).json({
      success: true,
      intact,
      stored:   doc.checksumSha256,
      computed,
      message:  intact ? 'Document integrity verified.' : '⚠ Checksum mismatch — document may have been tampered.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
