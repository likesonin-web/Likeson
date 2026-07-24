/**
 * hospitalRoutes.js — Likeson.in
 * Business logic lives in controllers/hospital.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/hospital.controller.js';

const router = express.Router();

// 1. Define Multer storage/upload instances (Adjust paths as needed for your project)
const upload = multer({ dest: 'uploads/' });
const doctorUpload = upload.single('photo');
const signatureUpload = upload.single('signature');
const hospitalUpload = upload.array('images', 10); // Using .array() for multiple images

// 2. Define the missing handleMulterError wrapper
const handleMulterError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      }
      next();
    });
  };
};

router.get('/nearby', cache(120, () => 'hospitals:nearby'), ctrl.getNearby);
router.get('/search', cache(60,  (req) => `hospitals:search:${req.query.q || ''}:${req.query.city || ''}:${req.query.page || 1}`), ctrl.getSearch);
router.get('/', cache(180, (req) => `hospitals:all:${req.query.city || ''}:${req.query.type || ''}:${req.query.page || 1}:${req.query.sort || ''}`), ctrl.get);
router.get('/slug/:slug', cache(300, (req) => `hospitals:slug:${req.params.slug}`), ctrl.getSlugBySlug);
router.get('/doctors/nearby', cache(120, () => 'doctors:nearby'), ctrl.getDoctorsNearby);
router.get('/doctors/search', cache(60,  (req) => `doctors:search:${req.query.q || ''}:${req.query.specialization || ''}:${req.query.page || 1}`), ctrl.getDoctorsSearch);
router.get('/doctors', cache(180, (req) => `doctors:all:${req.query.specialization || ''}:${req.query.page || 1}:${req.query.sort || ''}`), ctrl.getDoctors);
router.get('/doctors/specialization/:spec', cache(180, (req) => `doctors:spec:${req.params.spec}:${req.query.city || ''}:${req.query.page || 1}`), ctrl.getDoctorsSpecializationBySpec);
router.get('/doctors/by-hospital/:hospitalId', cache(120, (req) => `doctors:hospital:${req.params.hospitalId}:${req.query.page || 1}`), ctrl.getDoctorsByHospitalByHospitalId);
router.get('/doctors/me', protect, authorize('doctor'), ctrl.getDoctorsMe);
router.get('/doctors/me/hospitals', protect, authorize('doctor', 'hospital'), ctrl.getDoctorsMeHospitals);
router.get('/doctors/me/pricing', protect, authorize('doctor', 'hospital'), ctrl.getDoctorsMePricing);
router.post('/doctors', protect, authorize('admin', 'superadmin', 'hospital'), ctrl.postDoctors);
router.put('/doctors/:id/profile', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.putDoctorsByIdProfile);
router.put('/doctors/:id/settings', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.putDoctorsByIdSettings);
router.put('/doctors/:id/availability', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.putDoctorsByIdAvailability);
router.put('/doctors/:id/bank', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.putDoctorsByIdBank);
router.put('/doctors/:id/kyc', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.putDoctorsByIdKyc);
router.get('/doctors/:id/stats', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.getDoctorsByIdStats);

router.post('/doctors/:id/photo', protect, authorize('doctor', 'admin', 'superadmin'), handleMulterError(doctorUpload), ctrl.postDoctorsByIdPhoto);
router.post('/doctors/:id/signature', protect, authorize('doctor', 'admin', 'superadmin'), handleMulterError(signatureUpload), ctrl.postDoctorsByIdSignature);

router.put('/doctors/:id/security', protect, authorize('admin', 'superadmin'), ctrl.putDoctorsByIdSecurity);
router.put('/doctors/:id/platform-fee', protect, authorize('admin', 'superadmin'), ctrl.putDoctorsByIdPlatformFee);
router.put('/doctors/:id/partnership', protect, authorize('admin', 'superadmin'), ctrl.putDoctorsByIdPartnership);
router.put('/doctors/:id/kyc/verify', protect, authorize('admin', 'superadmin'), ctrl.putDoctorsByIdKycVerify);
router.put('/doctors/:id/toggle', protect, authorize('admin', 'superadmin'), ctrl.putDoctorsByIdToggle);
router.post('/doctors/:id/resend-credentials', protect, authorize('admin', 'superadmin'), ctrl.postDoctorsByIdResendCredentials);
router.delete('/doctors/:id', protect, authorize('superadmin'), ctrl.deleteDoctorsById);
router.get('/doctors/:id', cache(300, (req) => `doctors:single:${req.params.id}`), ctrl.getDoctorsById);
router.post('/', protect, authorize('admin', 'superadmin'), ctrl.post);
router.put('/:id/profile', protect, authorize('admin', 'superadmin'), ctrl.putByIdProfile);
router.put('/:id/settings', protect, authorize('admin', 'superadmin'), ctrl.putByIdSettings);
router.put('/:id/security', protect, authorize('admin', 'superadmin'), ctrl.putByIdSecurity);
router.put('/:id/consultation-pricing', protect, authorize('hospital', 'admin', 'superadmin'), ctrl.putByIdConsultationPricing);
router.put('/:id/platform-fee', protect, authorize('admin', 'superadmin'), ctrl.putByIdPlatformFee);
router.post('/:id/resend-credentials', protect, authorize('admin', 'superadmin'), ctrl.postByIdResendCredentials);

router.post('/:id/images', protect, authorize('admin', 'superadmin'), handleMulterError(hospitalUpload), ctrl.postByIdImages);

router.delete('/:id/images/:imageIndex', protect, authorize('admin', 'superadmin'), ctrl.deleteByIdImagesByImageIndex);
router.put('/:id/location', protect, authorize('admin', 'superadmin'), ctrl.putByIdLocation);
router.post('/:id/doctors/:doctorId', protect, authorize('admin', 'superadmin'), ctrl.postByIdDoctorsByDoctorId);
router.delete('/:id/doctors/:doctorId', protect, authorize('admin', 'superadmin'), ctrl.deleteByIdDoctorsByDoctorId);
router.put('/:id/verify', protect, authorize('admin', 'superadmin'), ctrl.putByIdVerify);
router.put('/:id/toggle', protect, authorize('admin', 'superadmin'), ctrl.putByIdToggle);
router.delete('/:id', protect, authorize('superadmin'), ctrl.deleteById);
router.get('/:id/pricing', cache(300, (req) => `hospitals:pricing:${req.params.id}`), ctrl.getByIdPricing);
router.get('/:id', cache(300, (req) => `hospitals:single:${req.params.id}`), ctrl.getById);

// Added your standard error handler to prevent further crashes
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;