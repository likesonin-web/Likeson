/**
 * prescriptionCareRouter.js — Likeson.in
 * Business logic lives in controllers/prescriptionCare.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/prescriptionCare.controller.js';

const router = express.Router();

// 1. Define Multer upload middleware (Adjust 'uploads/' to your actual storage config if needed)
const upload = multer({ dest: 'uploads/' });

// 2. Define the missing role-based middleware arrays
const isDoctor = [protect, authorize('doctor')];
const isDoctorOrAdmin = [protect, authorize('doctor', 'admin', 'superadmin')];
const isCareAssistant = [protect, authorize('care_assistant')]; // (Adjust string if your role is 'careassistant' without underscore)
const isAdmin = [protect, authorize('admin', 'superadmin')];
const isAnyStaff = [protect, authorize('doctor', 'hospital', 'admin', 'superadmin', 'care_assistant')];

router.post('/prescriptions', ...isDoctor, ctrl.postPrescriptions);
router.get('/prescriptions/:id/pdf', ...isAnyStaff, ctrl.getPrescriptionsByIdPdf);
router.get('/prescriptions', ...isAnyStaff, ctrl.getPrescriptions);
router.get('/prescriptions/verify/:rxNumber', ctrl.getPrescriptionsVerifyByRxNumber);
router.get('/prescriptions/:id', ...isAnyStaff, ctrl.getPrescriptionsById);
router.patch('/prescriptions/:id/cancel', ...isDoctorOrAdmin, ctrl.patchPrescriptionsByIdCancel);

router.get('/op-records', ...isAnyStaff, ctrl.getOpRecords);
router.get('/op-records/:id', ...isAnyStaff, ctrl.getOpRecordsById);
router.patch('/op-records/:id/complete', ...isDoctor, ctrl.patchOpRecordsByIdComplete);
router.patch('/op-records/:id/status', protect, authorize('hospital', 'admin', 'superadmin'), ctrl.patchOpRecordsByIdStatus);

router.get('/care/bookings', ...isCareAssistant, ctrl.getCareBookings);
router.get('/care/bookings/pending', ...isCareAssistant, ctrl.getCareBookingsPending);
router.get('/care/bookings/:bookingId', ...isAnyStaff, ctrl.getCareBookingsByBookingId);
router.post('/care/bookings/:bookingId/accept', ...isCareAssistant, ctrl.postCareBookingsByBookingIdAccept);
router.post('/care/bookings/:bookingId/reject', ...isCareAssistant, ctrl.postCareBookingsByBookingIdReject);

router.get('/care/records/active', ...isCareAssistant, ctrl.getCareRecordsActive);
router.get('/care/records', ...isCareAssistant, ctrl.getCareRecords);
router.get('/care/records/:id', ...isCareAssistant, ctrl.getCareRecordsById);

router.post('/care/records/:id/vitals', ...isCareAssistant, upload.array('files', 5), ctrl.postCareRecordsByIdVitals);
router.post('/care/records/:id/food', ...isCareAssistant, upload.array('files', 5), ctrl.postCareRecordsByIdFood);
router.post('/care/records/:id/medicine-log', ...isCareAssistant, upload.array('files', 5), ctrl.postCareRecordsByIdMedicineLog);
router.post('/care/records/:id/notes', ...isCareAssistant, upload.array('files', 5), ctrl.postCareRecordsByIdNotes);
router.patch('/care/records/:id/notes/:noteId/resolve', ...isCareAssistant, ctrl.patchCareRecordsByIdNotesByNoteIdResolve);

router.post('/care/records/:id/instructions', protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'), upload.array('files', 5), ctrl.postCareRecordsByIdInstructions);
router.get('/care/records/:id/instructions', protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'), ctrl.getCareRecordsByIdInstructions);
router.post('/care/records/upload', protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'), upload.array('files', 5), ctrl.postCareRecordsUpload);
router.patch('/care/records/:id/discharge', ...isCareAssistant, ctrl.patchCareRecordsByIdDischarge);
router.patch('/care/records/:id/status', ...isAdmin, ctrl.patchCareRecordsByIdStatus);

router.get('/admin/prescriptions', ...isAdmin, ctrl.getAdminPrescriptions);
router.get('/admin/op-records', ...isAdmin, ctrl.getAdminOpRecords);
router.get('/admin/care-records', ...isAdmin, ctrl.getAdminCareRecords);
router.patch('/admin/bookings/:bookingId/assign-ca', ...isAdmin, ctrl.patchAdminBookingsByBookingIdAssignCa);
router.get('/admin/care-records/:id', ...isAdmin, ctrl.getAdminCareRecordsById);

router.get('/doctor/appointments', ...isDoctor, ctrl.getDoctorAppointments);
router.get('/doctor/availability', ...isDoctor, ctrl.getDoctorAvailability);
router.patch('/doctor/availability', ...isDoctor, ctrl.patchDoctorAvailability);
router.get('/doctor/earnings', ...isDoctor, ctrl.getDoctorEarnings);
router.get('/doctor/transactions', ...isDoctor, ctrl.getDoctorTransactions);
router.get('/doctor/invoices/:bookingId', ...isDoctor, ctrl.getDoctorInvoicesByBookingId);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
} else {
  // Fallback in case errorHandler isn't exported from the controller
  router.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: err.message });
  });
}

export default router;