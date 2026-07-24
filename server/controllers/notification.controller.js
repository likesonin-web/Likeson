// support-module/routes/notificationRoutes.js
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js'; // existing model, reused as-is

import asyncHandler from '../utils/asyncHandler.js';

// GET '/'
export const get = asyncHandler(async (req, res) => {
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

// PATCH '/:id/read'
export const patchByIdRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notif) return res.status(404).json({ message: 'Notification not found.' });
  notif.isRead = true;
  notif.readAt = new Date();
  await notif.save();
  res.json({ message: 'Marked as read.', notification: notif });
});

// PATCH '/read-all'
export const patchReadAll = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  res.json({ message: 'All notifications marked as read.' });
});

// DELETE '/:id'
export const deleteById = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!notif) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ message: 'Notification deleted.' });
});
