// services/attachment.service.js

import SupportAttachment from '../models/SupportAttachment.js';
import SupportTicket from '../models/SupportTicket.js';
import { validateFile, uploadToImageKit, deleteFromImageKit } from '../utils/imagekitUpload.util.js';
import { recordAudit } from '../utils/auditIntegration.util.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { isStaff } from '../utils/supportPermissions.util.js';

/**
 * @param {Buffer} fileBuffer
 * @param {Object} meta  { fileName, mimeType, fileType, sizeBytes }
 */
export async function uploadAttachment({ ticketId, messageId = null, actor, deviceInfo, fileBuffer, meta }) {
  validateFile(meta.fileType, meta.mimeType, meta.sizeBytes);

  const ticket = await SupportTicket.findById(ticketId).select('_id').lean();
  if (!ticket) throw new NotFoundError('Ticket');

  const uploadResult = await uploadToImageKit(fileBuffer, meta.fileName, `support-tickets/${ticketId}`);

  const [attachment] = await SupportAttachment.create([
    {
      ticket: ticketId,
      message: messageId,
      uploadedBy: actor._id,
      fileType: meta.fileType,
      mimeType: meta.mimeType,
      originalName: meta.fileName,
      sizeBytes: meta.sizeBytes,
      imagekitFileId: uploadResult.fileId,
      url: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      filePath: uploadResult.filePath,
      durationSeconds: meta.durationSeconds ?? null,
      // scanStatus stays 'pending' — attachment-scan-hook (external AV/
      // content moderation service) transitions this asynchronously via
      // markScanResult() below. Message remains visible immediately;
      // realtime chat takes priority over blocking on scan completion.
    },
  ]);

  await recordAudit({
    action: 'attachment_uploaded',
    actorId: actor._id,
    targetType: 'SupportAttachment',
    targetId: attachment._id,
    ticketId,
    after: { fileType: meta.fileType, sizeBytes: meta.sizeBytes },
    deviceInfo,
  });

  return attachment;
}

/**
 * Called by the external attachment-scan webhook/worker.
 */
export async function markScanResult({ attachmentId, status, provider, raw }) {
  const attachment = await SupportAttachment.findByIdAndUpdate(
    attachmentId,
    { $set: { scanStatus: status, scannedAt: new Date(), scanProvider: provider, scanResultRaw: raw } },
    { new: true }
  );
  return attachment;
}

export async function removeAttachment({ attachmentId, actor, deviceInfo }) {
  const attachment = await SupportAttachment.findById(attachmentId);
  if (!attachment) throw new NotFoundError('Attachment');

  const isOwner = String(attachment.uploadedBy) === String(actor._id);
  if (!isOwner && !isStaff(actor.role)) {
    throw new ForbiddenError('You can only remove your own attachments.');
  }

  attachment.isDeleted = true;
  attachment.deletedAt = new Date();
  await attachment.save();

  await deleteFromImageKit(attachment.imagekitFileId);

  await recordAudit({
    action: 'attachment_removed',
    actorId: actor._id,
    targetType: 'SupportAttachment',
    targetId: attachment._id,
    ticketId: attachment.ticket,
    deviceInfo,
  });

  return attachment;
}

export async function listTicketAttachments(ticketId) {
  return SupportAttachment.find({ ticket: ticketId, isDeleted: false }).sort({ createdAt: -1 }).lean();
}
