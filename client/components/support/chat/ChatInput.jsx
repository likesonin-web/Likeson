'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';
import EmojiPicker from 'emoji-picker-react';
import { Send, Paperclip, Smile, X, AtSign } from 'lucide-react';
import { optimisticSendMessage, sendMessage, selectReplyTo, clearReplyTo, selectDraftText, setDraftText } from '../../../store/slices/chatSlice';
import { fetchParticipants, selectParticipantsForTicket } from '../../../store/slices/ticketSlice';
import { useAttachmentUpload } from '../../../hooks/support/useAttachmentUpload';
import { useTypingIndicator } from '../../../hooks/support/useTypingIndicator';
import { STAFF_ROLES } from '../../../features/support/constants/support.constants';
import MentionAutocomplete from './MentionAutocomplete';
import VoiceRecorderButton from './VoiceRecorderButton';

/**
 * @param {{ ticketId: string, currentUser: {_id: string, name: string, role: string} }} props
 */
export default function ChatInput({ ticketId, currentUser }) {
  const dispatch = useDispatch();
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInternalNoteToggle] = useState(STAFF_ROLES.includes(currentUser.role));
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null = dropdown closed, '' = open with no query yet
  const [voicePhase, setVoicePhase] = useState('idle');
  const textareaRef = useRef(null);

  const text = useSelector(selectDraftText(ticketId));
  const replyToId = useSelector(selectReplyTo(ticketId));
  const participants = useSelector(selectParticipantsForTicket(ticketId));
  const { notifyTyping, notifyStopTyping } = useTypingIndicator(ticketId, currentUser._id);
  const { getRootProps, getInputProps, open: openFileDialog, isUploading, uploadProgress, handlePaste, uploadFile } =
    useAttachmentUpload(ticketId, currentUser);

  useEffect(() => {
    dispatch(fetchParticipants(ticketId));
  }, [dispatch, ticketId]);

  // ── @mention autocomplete (name-based; @role shortcuts like @finance still work by typing them directly) ──
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return participants
      .filter((p) => p.userId && String(p.userId._id) !== String(currentUser._id))
      .filter((p) => p.userId.name?.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: p.userId._id,
        name: p.userId.name,
        role: p.userId.role,
        avatar: p.userId.avatar,
        token: p.userId.name.replace(/\s+/g, ''),
      }));
  }, [mentionQuery, participants, currentUser._id]);

  const setText = useCallback(
    (value) => {
      dispatch(setDraftText({ ticketId, text: value }));
      if (value) notifyTyping();
      else notifyStopTyping();
    },
    [dispatch, ticketId, notifyTyping, notifyStopTyping]
  );

  /** Detects an in-progress "@query" right before the caret to drive the dropdown. */
  const syncMentionState = useCallback((value, caretPos) => {
    const uptoCaret = value.slice(0, caretPos);
    const match = uptoCaret.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    syncMentionState(value, e.target.selectionStart);
  };

  const handleSelectMention = useCallback(
    (option) => {
      const el = textareaRef.current;
      const caretPos = el ? el.selectionStart : text.length;
      const uptoCaret = text.slice(0, caretPos);
      const newUpto = uptoCaret.replace(/@(\w*)$/, `@${option.token} `);
      const newText = newUpto + text.slice(caretPos);
      setText(newText);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(newUpto.length, newUpto.length);
      });
    },
    [text, setText]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Every @token goes to the backend — it resolves each one against
    // active participants by role OR by name (see resolveMentions), so
    // both manually-typed role shortcuts and dropdown-selected names work.
    const mentions = Array.from(trimmed.matchAll(/@(\w+)/g)).map((m) => m[1]);

    const clientMessageId = nanoid();

    dispatch(
      optimisticSendMessage({
        ticketId,
        clientMessageId,
        tempMessage: {
          ticket: ticketId,
          sender: currentUser,
          senderRole: currentUser.role,
          messageType: 'text',
          text: trimmed,
          replyTo: replyToId,
          isInternalNote,
          createdAt: new Date().toISOString(),
        },
      })
    );

    dispatch(
      sendMessage({
        ticketId,
        clientMessageId,
        payload: { messageType: 'text', text: trimmed, replyTo: replyToId, mentions, isInternalNote },
      })
    );

    setText('');
    setMentionQuery(null);
    dispatch(clearReplyTo(ticketId));
    notifyStopTyping();
  }, [text, ticketId, currentUser, replyToId, isInternalNote, dispatch, setText, notifyStopTyping]);

  const handleKeyDown = (e) => {
    // Let the mention dropdown own Up/Down/Enter/Tab/Escape while it's open.
    if (mentionQuery !== null && mentionOptions.length > 0 && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const voiceActive = voicePhase !== 'idle';

  return (
    <div {...getRootProps()} className="relative border-t border-base-300 bg-base-100 p-3">
      <input {...getInputProps()} />

      {mentionQuery !== null && mentionOptions.length > 0 && (
        <MentionAutocomplete options={mentionOptions} onSelect={handleSelectMention} onClose={() => setMentionQuery(null)} />
      )}

      {replyToId && (
        <div className="flex items-center gap-2 bg-base-200 rounded-field px-3 py-1.5 mb-2 text-xs">
          <span className="text-base-content/50 flex-1">Replying to message</span>
          <button type="button" onClick={() => dispatch(clearReplyTo(ticketId))} aria-label="Cancel reply">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isUploading && (
        <div className="mb-2">
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {showInternalNoteToggle && !voiceActive && (
        <label className="flex items-center gap-1.5 text-xs font-semibold text-warning mb-2 cursor-pointer w-fit">
          <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} className="checkbox checkbox-sm checkbox-warning" />
          Internal note (hidden from customer)
        </label>
      )}

      <div className="flex items-end gap-2">
        {!voiceActive && (
          <button type="button" onClick={openFileDialog} className="btn btn-ghost btn-circle shrink-0" aria-label="Attach file">
            <Paperclip className="w-4.5 h-4.5" />
          </button>
        )}

        {!voiceActive && (
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder={isInternalNote ? 'Write an internal note… (@finance or @name to mention)' : 'Type a message…'}
              className="input-field resize-none max-h-32 !py-2.5"
            />
          </div>
        )}

        <VoiceRecorderButton
          disabled={!!text.trim()}
          onPhaseChange={setVoicePhase}
          onRecorded={(file) => uploadFile(file)}
        />

        {!voiceActive && (
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            className="btn btn-ghost btn-circle shrink-0"
            aria-label="Emoji picker"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>
        )}

        {!voiceActive && (
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim()}
            className="btn btn-primary btn-circle shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>

      {showEmoji && (
        <div className="absolute bottom-20 right-4 z-30 shadow-depth-lg rounded-box overflow-hidden">
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              setText(text + emojiData.emoji);
              setShowEmoji(false);
              textareaRef.current?.focus();
            }}
          />
        </div>
      )}

      {!voiceActive && (
        <p className="flex items-center gap-1 text-[10px] text-base-content/30 mt-1.5">
          <AtSign className="w-2.5 h-2.5" /> Mention @name or @finance/@admin/etc · Enter to send, Shift+Enter for new line
        </p>
      )}
    </div>
  );
}