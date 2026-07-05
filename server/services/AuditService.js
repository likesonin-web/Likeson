// services/AuditService.js
import AuditLog from '../models/AuditLog.js';

class AuditService {
  async log({ action, actor, targetType = null, targetId = null, conversation = null, metadata = {}, ipAddress = null }) {
    // Fire-and-forget from the caller's perspective, but awaited here so
    // failures are visible in logs rather than silently swallowed.
    try {
      await AuditLog.create({ action, actor, targetType, targetId, conversation, metadata, ipAddress });
    } catch (err) {
      console.error('[AuditService] failed to write audit log:', err.message);
    }
  }
}

export default new AuditService();
