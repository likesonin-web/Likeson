'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { ArrowDown } from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ChatInput from './ChatInput';
import { MessageThreadSkeleton } from '../shared/Skeletons';
import { EmptyState } from '../shared/StateViews';
import { useSupportSocket } from '../../../hooks/support/useSupportSocket';
import { useInfiniteMessages } from '../../../hooks/support/useInfiniteMessages';
import { useTypingIndicator } from '../../../hooks/support/useTypingIndicator';
import { useReadReceipts } from '../../../hooks/support/useReadReceipts';
import { editMessage, deleteMessage, reactToMessage, retryMessage, sendMessage, setReplyTo } from '../../../store/slices/chatSlice';
import { canEditMessage } from '../../../features/support/utils/permissions';

/**
 * Builds a flat render list interleaving date-separator pseudo-items
 * between message groups.
 */
function withDateSeparators(messages) {
  const out = [];
  let lastDate = null;
  messages.forEach((m) => {
    const date = dayjs(m.createdAt).format('YYYY-MM-DD');
    if (date !== lastDate) {
      out.push({ _id: `sep-${date}`, __type: 'separator', label: dayjs(m.createdAt).format('MMMM D, YYYY') });
      lastDate = date;
    }
    out.push(m);
  });
  return out;
}

/**
 * @param {{ ticketId: string, currentUser: object }} props
 */
export default function ChatWindow({ ticketId, currentUser }) {
  const dispatch = useDispatch();
  const { messages, loading, hasMore, loadOlder } = useInfiniteMessages(ticketId);
  const { joinTicket, leaveTicket } = useSupportSocket();
  const { othersTyping } = useTypingIndicator(ticketId, currentUser._id);
  const { reportVisible, markReadUpTo } = useReadReceipts(ticketId);

  const parentRef = useRef(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const wasAtBottomRef = useRef(true);
  const [highlightedId, setHighlightedId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    if (!ticketId) return undefined;
    let cancelled = false;

    async function joinWithRetry(attempt = 1) {
      try {
        await joinTicket(ticketId);
      } catch (err) {
        if (cancelled) return;
        console.error(`[ChatWindow] joinTicket failed (attempt ${attempt}):`, err.message);
        // The very first attempt can legitimately race the socket's auth
        // handshake right after a page load/reconnect — retry a couple of
        // times before treating it as real. A REAL failure here (ticket not
        // found, permission denied) is silent otherwise: the WebSocket
        // connection itself still looks "connected", but this client never
        // actually joins the room, so it will never receive a single live
        // event for this ticket — exactly the "receiver needs a refresh"
        // symptom, with zero visible error unless we surface it here.
        if (attempt < 3) {
          setTimeout(() => joinWithRetry(attempt + 1), attempt * 1000);
        } else {
          toast.error(`Live updates aren't connected for this chat (${err.message}). Try refreshing.`);
        }
      }
    }

    joinWithRetry();
    return () => {
      cancelled = true;
      leaveTicket(ticketId);
    };
  }, [ticketId, joinTicket, leaveTicket]);

  const items = useMemo(() => withDateSeparators(messages), [messages]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  // Auto-scroll to bottom on new message, unless the user scrolled up.
  useEffect(() => {
    if (wasAtBottomRef.current && items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
      const last = messages[messages.length - 1];
      // Skip optimistic/unsaved messages: temp _id is a client nanoid, not a
      // Mongo ObjectId, and status !== 'sent' means server hasn't ack'd it yet.
      const isPersisted = last && /^[0-9a-fA-F]{24}$/.test(last._id) && last.status !== 'sending' && last.status !== 'failed';
      if (isPersisted) markReadUpTo(last._id);
    } else if (items.length > 0) {
      setShowJumpToLatest(true);
    }
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < 120;
    if (wasAtBottomRef.current) setShowJumpToLatest(false);

    if (el.scrollTop < 200 && hasMore && !loading) loadOlder();
  }, [hasMore, loading, loadOlder]);

  const jumpToLatest = () => {
    virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
    setShowJumpToLatest(false);
  };

  /** Tap a reply-preview quote -> jump to and briefly flash the original message (WhatsApp-style). */
  const scrollToMessage = useCallback(
    (messageId) => {
      const index = items.findIndex((it) => it._id === messageId);
      if (index === -1) {
        // Not in the currently-loaded window (older than what's paged in yet).
        toast('Scroll up to load the original message.', { icon: '↑' });
        return;
      }
      virtualizer.scrollToIndex(index, { align: 'center' });
      clearTimeout(highlightTimeoutRef.current);
      setHighlightedId(messageId);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedId(null), 1500);
    },
    [items, virtualizer]
  );

  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

  const handleReply = (message) => dispatch(setReplyTo({ ticketId, messageId: message._id }));
  const handleEdit = (message) => {
    const newText = window.prompt('Edit message', message.text);
    if (newText && newText.trim() && newText !== message.text) {
      dispatch(editMessage({ ticketId, messageId: message._id, text: newText.trim() }));
    }
  };
  const handleDelete = (messageId) => dispatch(deleteMessage({ ticketId, messageId }));
  const handleReact = (messageId, emoji) => dispatch(reactToMessage({ ticketId, messageId, emoji }));
  const handleRetry = (clientMessageId) => {
    dispatch(retryMessage({ ticketId, clientMessageId }));
    const failedMsg = messages.find((m) => m._id === clientMessageId);
    if (failedMsg) {
      dispatch(
        sendMessage({
          ticketId,
          clientMessageId,
          payload: { messageType: failedMsg.messageType, text: failedMsg.text, replyTo: failedMsg.replyTo },
        })
      );
    }
  };

  if (loading && messages.length === 0) return <MessageThreadSkeleton />;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={parentRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-2 relative scrollbar-thin">
        {messages.length === 0 ? (
          <EmptyState icon="inbox" title="No messages yet" description="Send the first message to get things moving." />
        ) : (
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              return (
                <div
                  key={item._id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-[0px] left-[0px] w-full" style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {item.__type === 'separator' ? (
                    <div className="flex justify-center my-3">
                      <span className="text-xs font-semibold text-base-content/40 bg-base-200 px-3 py-1 rounded-full">
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <MessageBubble
                      message={item}
                      isOwn={
                        (typeof item.sender === 'string' ? item.sender : item.sender?._id) === currentUser._id
                      }
                      canEdit={canEditMessage(currentUser.role)}
                      isHighlighted={item._id === highlightedId}
                      onReply={handleReply}
                      onReplyClick={scrollToMessage}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onReact={handleReact}
                      onRetry={handleRetry}
                      onVisible={reportVisible}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="sticky bottom-4 left-full btn btn-primary btn-circle shadow-primary"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>

      <TypingIndicator names={othersTyping.map(() => 'Someone')} />
      <ChatInput ticketId={ticketId} currentUser={currentUser} />
    </div>
  );
}