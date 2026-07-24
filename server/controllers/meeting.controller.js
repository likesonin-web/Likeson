import { Router } from 'express';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * Helper: Room Name Generator
 * Creates a URL-friendly unique string for the meeting room
 */
const generateRoomName = (title) => {
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${cleanTitle}-${Math.random().toString(36).substring(2, 7)}-${Date.now().toString().slice(-4)}`;
};

/**
 * @route   GET /api/meetings/employees
 * @desc    Get list of employees/admins for inviting to meetings
 */

import asyncHandler from '../utils/asyncHandler.js';

// GET '/employees'
export const getEmployees = asyncHandler(async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = { role: { $ne: 'customer' }, isBlocked: false };

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await User.find(query)
      .select('name email role avatar phone')
      .sort({ name: 1 });

    res.status(200).json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST '/create'
export const postCreate = asyncHandler(async (req, res) => {
  try {
    const { title, description, participants, startTime, meetingType, password } = req.body;

    const roomName = generateRoomName(title);
    const domain = process.env.JITSI_DOMAIN || 'meet.jit.si'; // Fallback to public Jitsi if not set
    
    // Construct the direct Join URL
    const joinUrl = `https://${domain}/${roomName}`;

    // 1. Create Meeting Record in Database
    const newMeeting = new Meeting({
      title,
      description,
      roomName,
      host: req.user._id,
      participants: participants.map(p => ({ 
        user: p.userId, 
        role: p.role || 'participant' 
      })),
      startTime,
      meetingType,
      joinUrl,
      config: { password }
    });

    const savedMeeting = await newMeeting.save();

    // 2. Communications (Notifications & Emails)
    const userIds = participants.map(p => p.userId);
    const participantDetails = await User.find({ _id: { $in: userIds } });

    const commPromises = participantDetails.map(async (participant) => {
      // Create In-App Notification
      await Notification.create({
        recipient: participant._id,
        title: `Meeting Invite: ${title}`,
        body: `You have been invited to a ${meetingType} by ${req.user.name}.`,
        type: 'Account_Security',
        priority: 'High',
        actionData: { screen: "MEETING_ROOM", referenceId: savedMeeting._id }
      });

      // Prepare Email
      const emailHtml = transactionalTemplate({
        header: "VIDEO CONSULTATION INVITE",
        title: `Invite: ${title}`,
        body: `
          <div style="text-align: left;">
            <p>Hello <strong>${participant.name}</strong>,</p>
            <p>You have been scheduled for a virtual meeting.</p>
            <hr>
            <p><strong>📅 Date:</strong> ${new Date(startTime).toDateString()}</p>
            <p><strong>⏰ Time:</strong> ${new Date(startTime).toLocaleTimeString()}</p>
            <p><strong>👤 Host:</strong> ${req.user.name}</p>
          </div>
        `,
        buttonText: "Join Meeting Now",
        buttonLink: joinUrl
      });

      // Send Email
      return sendEmail({
        email: participant.email,
        subject: `[INVITE] ${title}`,
        html: emailHtml
      });
    });

    await Promise.all(commPromises);

    res.status(201).json({ success: true, data: savedMeeting });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET '/my-meetings'
export const getMyMeetings = asyncHandler(async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user._id }, { 'participants.user': req.user._id }]
    })
    .populate('host', 'name avatar')
    .sort({ startTime: -1 });

    res.status(200).json({ success: true, data: meetings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH '/:meetingId/cancel'
export const patchByMeetingIdCancel = asyncHandler(async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.meetingId, host: req.user._id },
      { status: 'cancelled' },
      { new: true }
    ).populate('participants.user', 'email name');

    if (!meeting) {
      return res.status(404).json({ success: false, message: "Meeting not found or unauthorized" });
    }

    const cancelPromises = meeting.participants.map(p => {
      const emailHtml = transactionalTemplate({
        header: "MEETING CANCELLED",
        title: `Cancelled: ${meeting.title}`,
        body: `<p>The meeting scheduled for ${new Date(meeting.startTime).toLocaleString()} has been cancelled.</p>`,
        buttonText: "Go to Dashboard",
        buttonLink: process.env.FRONTEND_URL
      });

      return sendEmail({
        email: p.user.email,
        subject: `[CANCELLED] ${meeting.title}`,
        html: emailHtml
      });
    });

    await Promise.all(cancelPromises);
    res.status(200).json({ success: true, message: "Meeting cancelled successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
