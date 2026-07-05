// services/SearchService.js
// Cross-cutting search that composes Conversation, Message and Attachment
// full-text/indexed queries. Individual per-domain search already exists on
// MessageService/AttachmentService; this is the unified endpoint behind
// a single search bar.

import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import ConversationMember from '../models/ConversationMember.js';

class SearchService {
  async searchAll(userId, query, { limit = 10 } = {}) {
    const memberOf = await ConversationMember.find({ user: userId, isActive: true }).select('conversation').lean();
    const conversationIds = memberOf.map((m) => m.conversation);

    const [conversations, messages] = await Promise.all([
      Conversation.find({ _id: { $in: conversationIds }, $text: { $search: query }, isDeleted: false })
        .limit(limit).lean(),
      Message.find({ conversation: { $in: conversationIds }, $text: { $search: query } })
        .limit(limit).lean(),
    ]);

    return { conversations, messages };
  }
}

export default new SearchService();
