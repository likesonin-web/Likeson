'use client';

import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { MoreVertical, Pencil, Trash2, CornerUpLeft, Smile } from 'lucide-react';
import PresenceAvatar from '../shared/PresenceAvatar';
import ReadReceipt from './ReadReceipt';
import AttachmentCard from './AttachmentCard';

/**
 * @param {{
 *   message: object,
 *   isOwn: boolean,
 *   canEdit: boolean,
 *   onReply: (message: object) => void,
 *   onEdit: (message: object) => void,
 *   onDelete: (messageId: string) => void,
 *   onReact: (messageId: string, emoji: string) => void,
 *   onRetry: (clientMessageId: string) => void,
 *   onReplyClick?: (messageId: string) => void,
 *   onVisible?: (messageId: string) => void,
 *   isHighlighted?: boolean,
 * }} props
 */
export default function MessageBubble({ message, isOwn, canEdit, onReply, onEdit, onDelete, onReact, onRetry, onReplyClick, onVisible, isHighlighted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref } = useInView({
    threshold: 0.6,
    onChange: (visible) => visible && onVisible?.(message._id),
  });

  // ── System / assignment / status / timeline messages render centered, no bubble ──
  if (['system', 'assignment', 'status', 'timeline'].includes(message.messageType)) {
    return (
      <div ref={ref} className="flex justify-center my-2">
        <span className="text-xs text-base-content/50 bg-base-200 px-3 py-1.5 rounded-full">{message.text}</span>
      </div>
    );
  }

  if (message.isDeleted) {
    return (
      <div ref={ref} className={`flex gap-2 my-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <div className="w-8 shrink-0" />
        <p className="text-xs italic text-base-content/40 py-2">This message was deleted</p>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex gap-2 my-1.5 ${isOwn ? 'flex-row-reverse' : ''} ${message.isInternalNote ? 'bg-warning/5 -mx-4 px-4 py-1.5' : ''} ${
        isHighlighted ? 'rounded-2xl ring-2 ring-primary/60 bg-primary/5 transition-colors duration-500' : ''
      }`}
    >
      {!isOwn && <PresenceAvatar user={message.sender} size="sm" showPresence={false} />}

      <div className={`max-w-[75%] sm:max-w-[60%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && <span className="text-xs font-semibold text-base-content/60 mb-0.5 px-1">{message.sender?.name}</span>}

        {message.isInternalNote && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1 px-1">Internal note</span>
        )}

        {message.replyTo && (
          <button
            type="button"
            onClick={() => onReplyClick?.(message.replyTo._id)}
            className="text-xs bg-base-200 hover:bg-base-300/60 transition-colors border-l-2 border-primary rounded-field px-2.5 py-1.5 mb-1 max-w-full truncate text-left"
          >
            <span className="text-base-content/50">Replying to </span>
            {message.replyTo.isDeleted ? (
              <span className="italic text-base-content/40">original message was deleted</span>
            ) : (
              <>
                <span className="font-medium">{message.replyTo.sender?.name || 'message'}</span>
                {': '}
                {message.replyTo.text?.slice(0, 60) || (message.replyTo.messageType && `[${message.replyTo.messageType}]`)}
              </>
            )}
          </button>
        )}

        <div className="relative">
          <div
            className={`rounded-2xl px-3.5 py-2.5 text-sm ${
              isOwn
                ? 'bg-primary text-primary-content rounded-br-md'
                : message.isInternalNote
                  ? 'bg-warning/10 border border-warning/30 rounded-bl-md'
                  : 'bg-base-200 rounded-bl-md'
            }`}
          >
            {message.attachment && <AttachmentCard attachment={message.attachment} />}
            {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          </div>

          {/* Hover action menu */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="btn btn-ghost btn-circle btn-xs"
                aria-label="Message actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div
                  className={`absolute top-full mt-1 ${isOwn ? 'right-0' : 'left-0'} card bg-base-100 shadow-depth-lg z-20 py-1 w-36`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onReply(message);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" /> Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onReact(message._id, '👍');
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200"
                  >
                    <Smile className="w-3.5 h-3.5" /> React
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        onEdit(message);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {(isOwn || canEdit) && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(message._id);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {message.reactions?.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(
              message.reactions.reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {})
            ).map(([emoji, count]) => (
              <span key={emoji} className="text-xs bg-base-200 rounded-full px-2 py-0.5">
                {emoji} {count}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1 px-1">
          <span className="text-[11px] text-base-content/40">{dayjs(message.createdAt).format('h:mm A')}</span>
          {message.isEdited && <span className="text-[11px] text-base-content/40">(edited)</span>}
          {isOwn && message.status === 'failed' ? (
            <button
              type="button"
              onClick={() => onRetry(message._id)}
              className="text-[11px] font-semibold text-error hover:underline"
            >
              Failed · Retry
            </button>
          ) : (
            isOwn && <ReadReceipt status={message.status} />
          )}
        </div>
      </div>
    </motion.div>
  );
}