/**
 * labpartnerbookingRoutes.js — Likeson.in
 * Business logic lives in controllers/labpartnerbooking.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import upload             from '../middleware/upload.js';
import * as ctrl from '../controllers/labpartnerbooking.controller.js';

const router = express.Router();

router.get('/', ctrl.get);
router.get('/:bookingId', ctrl.getByBookingId);
router.patch('/:bookingId/accept', ctrl.patchByBookingIdAccept);
router.patch('/:bookingId/assign-technician', ctrl.patchByBookingIdAssignTechnician);
router.patch('/:bookingId/collect-sample', ctrl.patchByBookingIdCollectSample);
router.post('/:bookingId/upload-report', (req, res, next) => {
    // Run multer-s3 upload middleware inline; surface upload errors cleanly
    upload.single('report')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed.',
          code:    'UPLOAD_ERROR',
        });
      }
      next();
    });
  }, ctrl.postByBookingIdUploadReport);
router.post('/:bookingId/dispatch-report', ctrl.postByBookingIdDispatchReport);
router.patch('/:bookingId/complete', ctrl.patchByBookingIdComplete);
router.get('/reports/all', ctrl.getReportsAll);
router.get('/reports/:bookingId/download', ctrl.getReportsByBookingIdDownload);
router.post('/reports/:bookingId/send', ctrl.postReportsByBookingIdSend);
router.get('/stats/summary', ctrl.getStatsSummary);
router.patch('/:bookingId/reject', ctrl.patchByBookingIdReject);

export default router;
