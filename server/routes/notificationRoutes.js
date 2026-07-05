// support-module/routes/notificationRoutes.js
import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js'; // existing model, reused as-is

const router = express.Router();
router.use(protect, getDeviceInfo);

// GET /notifications — my notifications, paginated
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const filter = { recipient: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  res.json({ notifications, unreadCount, pagination: { page: +page, limit: +limit, total } });
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const notif = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notif) return res.status(404).json({ message: 'Notification not found.' });
  notif.isRead = true;
  notif.readAt = new Date();
  await notif.save();
  res.json({ message: 'Marked as read.', notification: notif });
});

// PATCH /notifications/read-all
router.patch('/read-all', async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  res.json({ message: 'All notifications marked as read.' });
});

// DELETE /notifications/:id
router.delete('/:id', async (req, res) => {
  const notif = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!notif) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ message: 'Notification deleted.' });
});

export default router;