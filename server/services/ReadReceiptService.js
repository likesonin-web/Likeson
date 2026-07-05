// services/ReadReceiptService.js
import MessageRead from '../models/MessageRead.js';
import ConversationMember from '../models/ConversationMember.js';

class ReadReceiptService {
  async getReadersForMessage(messageId) {
    return MessageRead.find({ message: messageId }).populate('user', 'name avatar').lean();
  }

  async getUnreadCountForUser(conversationId, userId) {
    const member = await ConversationMember.findOne({ conversation: conversationId, user: userId }).lean();
    return member?.unreadCount ?? 0;
  }
}

export default new ReadReceiptService();
