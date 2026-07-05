// services/AttachmentService.js
import Attachment from '../models/Attachment.js';
import ImageKitService from './ImageKitService.js';
import AuditService from './AuditService.js';
import { ApiError } from '../utils/apiResponse.js';
import { SUPPORTED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from '../constants/messageConstants.js';

class AttachmentService {
  async uploadAndCreate({ file, uploadedBy, conversationId = null }) {
    if (!file) throw new ApiError(400, 'No file provided.');
    if (!SUPPORTED_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new ApiError(415, `Unsupported file type: ${file.mimetype}`);
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ApiError(413, 'File exceeds maximum allowed size.');
    }

    const folder = conversationId ? `/conversations/${conversationId}` : '/support-module/misc';
    const uploaded = await ImageKitService.upload(file.buffer, file.originalname, folder);

    const attachment = await Attachment.create({
      fileName: uploaded.fileName,
      originalName: file.originalname,
      url: uploaded.url,
      thumbnail: uploaded.thumbnail,
      mimeType: file.mimetype,
      width: uploaded.width,
      height: uploaded.height,
      fileSize: uploaded.size,
      imageKitFileId: uploaded.fileId,
      uploadedBy,
      conversation: conversationId,
    });

    await AuditService.log({
      action: 'admin_action',
      actor: uploadedBy,
      targetType: 'Attachment',
      targetId: attachment._id,
      conversation: conversationId,
      metadata: { mimeType: file.mimetype, fileSize: file.size },
    });

    return attachment;
  }

  async getById(attachmentId) {
    const attachment = await Attachment.findOne({ _id: attachmentId, isDeleted: false });
    if (!attachment) throw new ApiError(404, 'Attachment not found.');
    return attachment;
  }

  async softDelete(attachmentId, userId) {
    const attachment = await this.getById(attachmentId);
    if (attachment.uploadedBy.toString() !== userId.toString()) {
      throw new ApiError(403, 'You can only delete your own attachments.');
    }
    attachment.isDeleted = true;
    await attachment.save();
    await ImageKitService.delete(attachment.imageKitFileId);
    return attachment;
  }

  async searchInConversation(conversationId, { mimeType, page = 1, limit = 20 } = {}) {
    const filter = { conversation: conversationId, isDeleted: false };
    if (mimeType) filter.mimeType = mimeType;

    const [items, total] = await Promise.all([
      Attachment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Attachment.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export default new AttachmentService();
