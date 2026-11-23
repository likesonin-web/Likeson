/**
 * callEvents.js — Frontend WebRTC Call Event Handler
 *
 * Covers the complete call lifecycle:
 *   initiate → incoming → ringing → offer → answer → ICE → end
 *   + decline, missed, media-toggle, peer-disconnected
 *
 * Usage:
 *   import { CallManager } from './callEvents.js';
 *   const call = new CallManager(socket, currentUserId, callbacks);
 *
 * ─── Socket events this module EMITS (→ server) ───────────────────────────────
 *   call:initiate         Start a call
 *   call:ringing          Notify caller device is ringing
 *   call:offer            Send SDP offer (caller → callee)
 *   call:answer           Send SDP answer (callee → caller)
 *   call:ice              Send ICE candidate (both directions)
 *   call:media_toggle     Mute / camera-off toggle
 *   call:end              End the call
 *   call:decline          Decline incoming call
 *   call:missed           Mark call as missed (timeout)
 *
 * ─── Socket events this module LISTENS TO (← server) ─────────────────────────
 *   call:incoming         Incoming call notification
 *   call:ringing          Remote peer's device is ringing
 *   call:offer            Received SDP offer  → create answer
 *   call:answered         Received SDP answer → setRemoteDescription
 *   call:ice              Received ICE candidate
 *   call:ended            Remote peer ended call
 *   call:declined         Remote peer declined
 *   call:missed           Call marked as missed
 *   call:media_toggle     Remote peer toggled audio/video
 *   call:peer_disconnected  Remote peer lost connection
 *   call:missed_while_offline  Missed call delivered on reconnect
 */

// ── Default STUN/TURN configuration ──────────────────────────────────────────
// Replace TURN credentials with your own for production environments.
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Add TURN servers below for NAT traversal in production:
  // {
  //   urls:       'turn:your-turn-server.com:3478',
  //   username:   'your-username',
  //   credential: 'your-credential',
  // },
];

// ── Call state machine ────────────────────────────────────────────────────────
export const CallState = Object.freeze({
  IDLE:        'IDLE',
  INITIATING:  'INITIATING',   // We are calling someone
  RINGING:     'RINGING',      // Waiting for callee to answer
  INCOMING:    'INCOMING',     // Someone is calling us
  CONNECTING:  'CONNECTING',   // Offer/answer in progress
  CONNECTED:   'CONNECTED',    // Media streams flowing
  ENDED:       'ENDED',
  DECLINED:    'DECLINED',
  MISSED:      'MISSED',
  RECONNECTING:'RECONNECTING',
});

// ── Error codes ───────────────────────────────────────────────────────────────
export const CallError = Object.freeze({
  MEDIA_DENIED:      'MEDIA_DENIED',
  ICE_FAILED:        'ICE_FAILED',
  OFFER_FAILED:      'OFFER_FAILED',
  ANSWER_FAILED:     'ANSWER_FAILED',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT:           'TIMEOUT',
  UNKNOWN:           'UNKNOWN',
});

// ─────────────────────────────────────────────────────────────────────────────

export class CallManager {
  /**
   * @param {import('socket.io-client').Socket} socket  - Connected Socket.IO client
   * @param {string}                            userId  - Authenticated user's _id
   * @param {CallCallbacks}                     cb      - UI callback hooks (see JSDoc below)
   * @param {RTCConfiguration}                  [iceConfig] - Override ICE servers
   *
   * ── CallCallbacks shape ────────────────────────────────────────────────────
   * {
   *   onStateChange(state: CallState, meta?: object): void
   *   onLocalStream(stream: MediaStream): void
   *   onRemoteStream(stream: MediaStream): void
   *   onIncomingCall(payload: object): void
   *   onRinging(payload: object): void
   *   onCallEnded(payload: object): void
   *   onCallDeclined(payload: object): void
   *   onCallMissed(payload: object): void
   *   onMediaToggle(payload: object): void
   *   onPeerDisconnected(payload: object): void
   *   onMissedWhileOffline(payload: object): void
   *   onError(error: { code: string, message: string }): void
   * }
   */
  _socket: any;
  _userId: any;
  _cb: any;
  _iceConf: any;
  _state: any;
  _pc: any;
  _localStream: any;
  _remoteStream: any;
  _conversationId: any;
  _callType: any;
  _targetUserId: any;
  _messageId: any;
  _callStartAt: any;
  _ringtoneTimer: any;
  _iceCandidateQueue: any[];
  _onIncoming: any;
  _onRinging: any;
  _onOffer: any;
  _onAnswered: any;
  _onIce: any;
  _onEnded: any;
  _onDeclined: any;
  _onMissed: any;
  _onMediaToggle: any;
  _onPeerDisconnected: any;
  _onMissedWhileOffline: any;
  [key: string]: any;

  constructor(socket, userId, cb = {}, iceConfig = null) {
    if (!socket) throw new Error('[CallManager] socket is required');
    if (!userId) throw new Error('[CallManager] userId is required');

    this._socket   = socket;
    this._userId   = userId;
    this._cb       = cb;
    this._iceConf  = { iceServers: iceConfig ?? DEFAULT_ICE_SERVERS };

    // ── Internal state ────────────────────────────────────────────────────────
    this._state          = CallState.IDLE;
    this._pc             = null;   // RTCPeerConnection
    this._localStream    = null;   // MediaStream (our camera/mic)
    this._remoteStream   = null;   // MediaStream (peer's camera/mic)
    this._conversationId = null;
    this._callType       = null;   // 'audio' | 'video'
    this._targetUserId   = null;   // caller ↔ callee peer userId
    this._messageId      = null;   // DB Message _id for call log
    this._callStartAt    = null;   // Date when media connected
    this._ringtoneTimer  = null;   // Auto-missed timeout handle
    this._iceCandidateQueue = [];  // ICE candidates queued before remoteDescription is set

    this._registerSocketListeners();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Initiate an outgoing call.
   *
   * @param {object} options
   * @param {string}   options.conversationId   - Target conversation _id
   * @param {'audio'|'video'} options.callType  - Call modality
   * @param {string[]} [options.targetUserIds]  - Specific participant _id(s); omit to call all
   * @param {MediaStreamConstraints} [options.mediaConstraints] - Override default constraints
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async initiateCall(options: any = {}) {
    const { conversationId, callType = 'audio', targetUserIds = [], mediaConstraints } = options;
    if (!conversationId) throw new Error('[initiateCall] conversationId required');
    if (this._state !== CallState.IDLE) {
      return { success: false, error: 'Already in a call' };
    }

    const constraints = mediaConstraints ?? {
      audio: true,
      video: callType === 'video',
    };

    this._setState(CallState.INITIATING, { conversationId, callType });
    this._conversationId = conversationId;
    this._callType       = callType;

    // 1. Acquire local media BEFORE emitting so user gets prompt early
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this._cb.onLocalStream?.(this._localStream);
    } catch (err) {
      this._setState(CallState.IDLE);
      this._handleError(CallError.MEDIA_DENIED, `Camera/mic access denied: ${err.message}`);
      return { success: false, error: err.message };
    }

    // 2. Emit call:initiate to server
    return new Promise((resolve) => {
      this._socket.emit(
        'call:initiate',
        { conversationId, callType, targetUserIds, mediaConstraints: constraints },
        (ack) => {
          if (!ack?.success) {
            this._cleanup();
            resolve({ success: false, error: ack?.message || 'Server rejected call' });
            return;
          }

          this._messageId = ack.messageId;
          this._setState(CallState.RINGING, { messageId: ack.messageId });

          // Auto-missed timeout (90 s — mirrors server-side expiry)
          this._ringtoneTimer = setTimeout(() => {
            if (this._state === CallState.RINGING) {
              this._emitMissed();
            }
          }, 90_000);

          resolve({ success: true, messageId: ack.messageId });
        }
      );
    });
  }

  /**
   * Accept an incoming call (callee side).
   *
   * Call this after `onIncomingCall` fires. It:
   *   1. Emits call:ringing to notify the caller
   *   2. Acquires local media
   *   3. Waits for call:offer from caller, then creates an answer
   *
   * @param {object} incomingPayload - The payload from the call:incoming event
   * @param {MediaStreamConstraints} [mediaConstraints]
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async acceptCall(incomingPayload, mediaConstraints) {
    const { conversationId, callType = 'audio', caller, messageId, mediaConstraints: callerConstraints } = incomingPayload;

    if (!conversationId || !caller?._id) {
      return { success: false, error: 'Invalid incoming call payload' };
    }

    // Guard: must be IDLE or INCOMING to accept
    if (this._state !== CallState.IDLE && this._state !== CallState.INCOMING) {
      return { success: false, error: 'Already in a call' };
    }

    this._clearRingtoneTimer();
    this._conversationId = conversationId;
    this._callType       = callType;
    this._targetUserId   = caller._id.toString();
    this._messageId      = messageId;

    const constraints = mediaConstraints ?? callerConstraints ?? {
      audio: true,
      video: callType === 'video',
    };

    this._setState(CallState.CONNECTING, { conversationId, callType, caller });

    // 1. Acquire local media FIRST.
    //    BUG FIX: Original emitted call:ringing before getUserMedia.
    //    This caused the caller to fire _createAndSendOffer() immediately,
    //    sending the SDP offer before the callee had built a PeerConnection.
    //    The callee would receive call:offer while this._pc was still null,
    //    falling into the _handleOffer() idle-path which rebuilt state from
    //    scratch — losing the already-set _targetUserId and _messageId.
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this._cb.onLocalStream?.(this._localStream);
    } catch (err) {
      this._setState(CallState.IDLE);
      this._handleError(CallError.MEDIA_DENIED, `Camera/mic access denied: ${err.message}`);
      return { success: false, error: err.message };
    }

    // 2. Build RTCPeerConnection and add our tracks BEFORE notifying caller.
    //    PC is now ready to receive the offer the moment call:ringing is sent.
    this._buildPeerConnection();
    this._addLocalTracks();

    // 3. NOW notify the caller — this triggers _createAndSendOffer() on their side.
    this._socket.emit('call:ringing', {
      conversationId,
      targetUserId: this._targetUserId,
    });

    return { success: true };
  }

  /**
   * Decline an incoming call.
   *
   * @param {object} incomingPayload - The payload from call:incoming
   */
  declineCall(incomingPayload) {
    const { conversationId, messageId } = incomingPayload ?? {};
    if (!conversationId) return;

    this._clearRingtoneTimer();
    this._socket.emit('call:decline', { conversationId, messageId });
    this._setState(CallState.DECLINED, { conversationId });
    this._cleanup();
  }

  /**
   * End an active call (caller or callee can call this).
   */
  endCall() {
    if (!this._conversationId) return;

    const duration = this._callStartAt
      ? Math.floor((Date.now() - this._callStartAt.getTime()) / 1000)
      : 0;

    this._socket.emit('call:end', {
      conversationId: this._conversationId,
      messageId:      this._messageId,
      duration,
    });

    this._setState(CallState.ENDED, { duration });
    this._cleanup();
  }

  /**
   * Toggle local audio mute.
   * @param {boolean} enabled
   */
  toggleAudio(enabled) {
    if (!this._localStream) return;
    this._localStream.getAudioTracks().forEach(t => (t.enabled = enabled));
    this._emitMediaToggle('audio', enabled);
  }

  /**
   * Toggle local video on/off.
   * @param {boolean} enabled
   */
  toggleVideo(enabled) {
    if (!this._localStream) return;
    this._localStream.getVideoTracks().forEach(t => (t.enabled = enabled));
    this._emitMediaToggle('video', enabled);
  }

  /**
   * Switch between front/back camera (mobile).
   * Replaces the video track in the RTCPeerConnection.
   */
  async switchCamera() {
    if (!this._localStream || !this._pc) return;

    const currentTrack = this._localStream.getVideoTracks()[0];
    const facingMode   = currentTrack?.getSettings?.().facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      const newTrack = newStream.getVideoTracks()[0];

      // Replace on the peer connection
      const sender = this._pc.getSenders().find(s => s.track?.kind === 'video');
      await sender?.replaceTrack(newTrack);

      // Replace in local stream
      this._localStream.removeTrack(currentTrack);
      this._localStream.addTrack(newTrack);
      currentTrack.stop();

      this._cb.onLocalStream?.(this._localStream);
    } catch (err) {
      this._handleError(CallError.UNKNOWN, `Camera switch failed: ${err.message}`);
    }
  }

  /** Current call duration in seconds (0 if not yet connected). */
  getDuration() {
    if (!this._callStartAt) return 0;
    return Math.floor((Date.now() - this._callStartAt.getTime()) / 1000);
  }

  /** Current CallState value. */
  getState() {
    return this._state;
  }

  /**
   * Remove all socket listeners and free resources.
   * Call when the component/page unmounts.
   */
  destroy() {
    // Explicitly end any active call before destroying so peers are notified
    if (
      this._conversationId &&
      this._state !== CallState.IDLE &&
      this._state !== CallState.ENDED
    ) {
      this.endCall();
    }
    this._cleanup();
    this._unregisterSocketListeners();
    this._state = CallState.IDLE;
  }

  // ── Private: state machine ────────────────────────────────────────────────

  _setState(state, meta = {}) {
    this._state = state;
    this._cb.onStateChange?.(state, meta);
  }

  // ── Private: media helpers ────────────────────────────────────────────────

  _addLocalTracks() {
    if (!this._localStream || !this._pc) return;
    for (const track of this._localStream.getTracks()) {
      this._pc.addTrack(track, this._localStream);
    }
  }

  _emitMediaToggle(kind, enabled) {
    if (!this._conversationId) return;
    this._socket.emit('call:media_toggle', {
      conversationId: this._conversationId,
      kind,
      enabled,
    });
  }

  _emitMissed() {
    this._socket.emit('call:missed', {
      conversationId: this._conversationId,
      messageId:      this._messageId,
    });
    this._setState(CallState.MISSED, { conversationId: this._conversationId });
    this._cleanup();
  }

  _clearRingtoneTimer() {
    if (this._ringtoneTimer) {
      clearTimeout(this._ringtoneTimer);
      this._ringtoneTimer = null;
    }
  }

  // ── Private: RTCPeerConnection lifecycle ─────────────────────────────────

  _buildPeerConnection() {
    if (this._pc) {
      this._pc.close();
      this._pc = null;
    }

    const pc = new RTCPeerConnection(this._iceConf);
    this._pc = pc;

    // ── ICE candidate gathered locally → relay to peer ───────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate || !this._targetUserId) return;
      this._socket.emit('call:ice', {
        conversationId: this._conversationId,
        targetUserId:   this._targetUserId,
        candidate:      candidate.toJSON(),
      });
    };

    // ── ICE connection state changes ──────────────────────────────────────────
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.debug('[WebRTC] ICE state:', s);

      if (s === 'connected' || s === 'completed') {
        if (this._state !== CallState.CONNECTED) {
          this._callStartAt = new Date();
          this._setState(CallState.CONNECTED);
        }
      } else if (s === 'failed') {
        this._handleError(CallError.ICE_FAILED, 'ICE connection failed');
      } else if (s === 'disconnected') {
        this._setState(CallState.RECONNECTING);
      }
    };

    // ── Connection state (broader) ────────────────────────────────────────────
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.debug('[WebRTC] Connection state:', s);
      if (s === 'failed') {
        this._handleError(CallError.CONNECTION_FAILED, 'Peer connection failed');
      }
    };

    // ── Remote stream received ────────────────────────────────────────────────
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      this._remoteStream = remoteStream;
      this._cb.onRemoteStream?.(remoteStream);
    };

    return pc;
  }

  /** Drain queued ICE candidates once remoteDescription is set. */
  async _drainIceCandidateQueue() {
    while (this._iceCandidateQueue.length > 0) {
      const candidate = this._iceCandidateQueue.shift();
      try {
        await this._pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to add queued ICE candidate:', err.message);
      }
    }
  }

  // ── Private: signalling flow (caller side) ────────────────────────────────

  /**
   * Called AFTER callee emits call:ringing (i.e. callee accepted).
   * Caller creates offer → sends via call:offer.
   */
  async _createAndSendOffer() {
    if (!this._pc) this._buildPeerConnection();
    if (!this._localStream) return;

    // Guard against duplicate track adds: _addLocalTracks() was already called
    // in initiateCall context via the first call to _buildPeerConnection. Calling
    // it again on the same PC throws InvalidStateError("track already added").
    const existingSenders = this._pc.getSenders();
    const alreadyAdded = existingSenders.some(s => s.track !== null);
    if (!alreadyAdded) {
      this._addLocalTracks();
    }

    try {
      const offer = await this._pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this._callType === 'video',
      });
      await this._pc.setLocalDescription(offer);

      this._socket.emit('call:offer', {
        conversationId:   this._conversationId,
        targetUserId:     this._targetUserId,
        sdp:              this._pc.localDescription,
        mediaConstraints: {
          audio: true,
          video: this._callType === 'video',
        },
      });
    } catch (err) {
      this._handleError(CallError.OFFER_FAILED, `Failed to create offer: ${err.message}`);
    }
  }

  // ── Private: signalling flow (callee side) ────────────────────────────────

  /**
   * Received SDP offer from caller → create + send answer.
   * @param {RTCSessionDescriptionInit} sdp
   * @param {string} from - Caller's userId
   */
  async _handleOffer(sdp, from) {
    // Build PC if not yet created (delayed call path)
    if (!this._pc) this._buildPeerConnection();

    // Guard: PC may have been closed between receiving the offer and processing it
    if (this._pc.signalingState === 'closed') {
      console.warn('[CallManager] _handleOffer called on closed PC — ignoring');
      return;
    }

    this._targetUserId = from;

    try {
      await this._pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this._drainIceCandidateQueue();

      const answer = await this._pc.createAnswer();
      await this._pc.setLocalDescription(answer);

      this._socket.emit('call:answer', {
        conversationId: this._conversationId,
        targetUserId:   from,
        sdp:            this._pc.localDescription,
      });

      this._setState(CallState.CONNECTING);
    } catch (err) {
      this._handleError(CallError.ANSWER_FAILED, `Failed to create answer: ${err.message}`);
    }
  }

  /**
   * Received SDP answer from callee → setRemoteDescription.
   * @param {RTCSessionDescriptionInit} sdp
   */
  async _handleAnswer(sdp) {
    if (!this._pc) return;
    // Guard: answer is only valid when we're in have-local-offer state
    if (this._pc.signalingState !== 'have-local-offer') {
      console.warn('[CallManager] _handleAnswer called in wrong signalingState:', this._pc.signalingState, '— ignoring');
      return;
    }
    try {
      await this._pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this._drainIceCandidateQueue();
    } catch (err) {
      this._handleError(CallError.ANSWER_FAILED, `Failed to set remote answer: ${err.message}`);
    }
  }

  /**
   * Received remote ICE candidate → add to peer connection (or queue).
   * @param {RTCIceCandidateInit} candidate
   */
  async _handleRemoteIceCandidate(candidate) {
    // null candidate = end-of-candidates signal from browser — safe to ignore
    if (!candidate) return;

    // Guard: if PC is gone (call already ended) silently drop
    if (!this._pc || this._pc.signalingState === 'closed') return;

    if (!this._pc.remoteDescription) {
      // RemoteDescription not yet set — queue the candidate
      this._iceCandidateQueue.push(candidate);
      return;
    }

    try {
      await this._pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Non-fatal: log and continue — a single bad candidate doesn't kill the call
      console.warn('[WebRTC] Failed to add ICE candidate:', err.message);
    }
  }

  // ── Private: cleanup ─────────────────────────────────────────────────────

  _cleanup() {
    this._clearRingtoneTimer();
    this._iceCandidateQueue = [];

    // Stop all local tracks
    if (this._localStream) {
      this._localStream.getTracks().forEach(t => t.stop());
      this._localStream = null;
    }

    // Close peer connection — null ALL handlers to prevent stale callbacks
    if (this._pc) {
      this._pc.onicecandidate            = null;
      this._pc.ontrack                   = null;     // FIX: was missing in original
      this._pc.oniceconnectionstatechange = null;
      this._pc.onconnectionstatechange    = null;
      this._pc.onnegotiationneeded        = null;    // guard future renegotiation
      this._pc.close();
      this._pc = null;
    }

    this._remoteStream   = null;
    this._conversationId = null;
    this._targetUserId   = null;
    this._messageId      = null;
    this._callStartAt    = null;
    this._callType       = null;
    // FIX: reset state to IDLE so getState() is correct after cleanup.
    // _handleError sets IDLE before calling _cleanup so we don't overwrite
    // a deliberately set ENDED/DECLINED/MISSED — only reset if still in a
    // transitional state that cleanup was called from directly.
    if (
      this._state !== CallState.ENDED &&
      this._state !== CallState.DECLINED &&
      this._state !== CallState.MISSED
    ) {
      this._state = CallState.IDLE;
    }
  }

  _handleError(code, message) {
    console.error(`[CallManager] ${code}: ${message}`);
    this._cb.onError?.({ code, message });
    // Set IDLE BEFORE cleanup so any racing async callbacks (ICE, answer)
    // that check this._state find IDLE and abort cleanly.
    this._state = CallState.IDLE;
    this._cb.onStateChange?.(CallState.IDLE, { error: { code, message } });
    this._cleanup();
  }

  // ── Private: socket event registry ───────────────────────────────────────

  _registerSocketListeners() {
    const s = this._socket;

    // ── call:incoming ─────────────────────────────────────────────────────────
    // Fired on callee when a call is initiated.
    this._onIncoming = (payload) => {
      if (this._state !== CallState.IDLE) {
        // Already in a call — auto-decline with reason so caller gets feedback
        this._socket.emit('call:decline', {
          conversationId: payload.conversationId,
          messageId:      payload.messageId,
        });
        return;
      }

      this._conversationId = payload.conversationId;
      this._callType       = payload.callType;
      this._messageId      = payload.messageId;
      // FIX: store caller._id as targetUserId so it's available before acceptCall()
      // is called (e.g. chatSlice.setActiveCall needs it immediately on incoming)
      if (payload.caller?._id) {
        this._targetUserId = payload.caller._id.toString();
      }

      this._setState(CallState.INCOMING, payload);
      this._cb.onIncomingCall?.(payload);

      // Auto-missed if not answered in 60 s
      this._ringtoneTimer = setTimeout(() => {
        if (this._state === CallState.INCOMING) {
          this._emitMissed();
        }
      }, 60_000);
    };

    // ── call:ringing ──────────────────────────────────────────────────────────
    // Caller receives this after the callee's device is ready.
    // BUG FIX: socket.js emits call:ringing to the caller's userId room.
    // But if both users are in the same conversation room, the callee could
    // also receive this event. Guard so only the caller (RINGING state) acts.
    this._onRinging = async (payload) => {
      // Only the caller should respond to call:ringing
      if (this._state !== CallState.RINGING) return;

      this._targetUserId = payload.from;
      this._setState(CallState.RINGING, payload);
      this._cb.onRinging?.(payload);

      // Caller: build PeerConnection and send offer now that callee is ready
      if (this._localStream && this._conversationId) {
        await this._createAndSendOffer();
      }
    };

    // ── call:offer ────────────────────────────────────────────────────────────
    // Callee receives the SDP offer from caller.
    this._onOffer = async (payload) => {
      const { conversationId, sdp, from, mediaConstraints: mc } = payload;

      if (!sdp || !from) {
        console.warn('[CallManager] call:offer missing sdp or from — ignoring');
        return;
      }

      // Path A: acceptCall() was called — PC is already built, tracks already added.
      //         Just call _handleOffer() to do setRemoteDescription + createAnswer.
      if (this._state === CallState.CONNECTING && this._pc) {
        await this._handleOffer(sdp, from);
        return;
      }

      // Path B: Delayed / queued call — acceptCall() was never called because user
      //         was offline when the call:incoming arrived.  Re-initialise from scratch.
      if (this._state === CallState.IDLE) {
        this._conversationId = conversationId;
        // Derive callType from mediaConstraints: mc.video can be bool or object
        this._callType = (mc?.video && mc.video !== false) ? 'video' : 'audio';
        try {
          const constraints = {
            audio: mc?.audio !== false,
            video: mc?.video || false,
          };
          this._localStream = await navigator.mediaDevices.getUserMedia(constraints);
          this._cb.onLocalStream?.(this._localStream);
          this._buildPeerConnection();
          this._addLocalTracks();
        } catch (err) {
          this._handleError(CallError.MEDIA_DENIED, err.message);
          return;
        }
        await this._handleOffer(sdp, from);
        return;
      }

      // Any other state (INCOMING before acceptCall): queue is not yet built —
      // store sdp so acceptCall() can pass it in immediately after.
      // The simplest safe approach: call _handleOffer directly; _pc will be
      // built inside it if needed.
      await this._handleOffer(sdp, from);
    };

    // ── call:answered ─────────────────────────────────────────────────────────
    // Caller receives SDP answer from callee.
    this._onAnswered = async (payload) => {
      // Only the caller waiting for an answer should process this
      if (this._state !== CallState.RINGING && this._state !== CallState.CONNECTING) return;
      const { sdp } = payload;
      await this._handleAnswer(sdp);
    };

    // ── call:ice ──────────────────────────────────────────────────────────────
    // Both peers receive ICE candidates from the other side.
    this._onIce = async (payload) => {
      await this._handleRemoteIceCandidate(payload.candidate);
    };

    // ── call:ended ────────────────────────────────────────────────────────────
    // Remote peer ended the call.
    // socket.js emits call:ended (not call:end) using socket.to() so the sender
    // does NOT receive it — but guard for state consistency anyway.
    this._onEnded = (payload) => {
      if (this._state === CallState.IDLE || this._state === CallState.ENDED) return;
      this._clearRingtoneTimer();
      this._setState(CallState.ENDED, payload);
      this._cb.onCallEnded?.(payload);
      this._cleanup();
    };

    // ── call:declined ─────────────────────────────────────────────────────────
    // Callee declined our call.
    this._onDeclined = (payload) => {
      if (this._state === CallState.IDLE || this._state === CallState.DECLINED) return;
      this._clearRingtoneTimer();
      this._setState(CallState.DECLINED, payload);
      this._cb.onCallDeclined?.(payload);
      this._cleanup();
    };

    // ── call:missed ───────────────────────────────────────────────────────────
    // Received from server when call times out.
    // BUG FIX: _emitMissed() emits call:missed to the server which then
    // broadcasts it back to the room — this socket will also receive its own
    // event. Guard: if state is already MISSED/ENDED/IDLE we already cleaned up.
    this._onMissed = (payload) => {
      if (
        this._state === CallState.IDLE ||
        this._state === CallState.MISSED ||
        this._state === CallState.ENDED
      ) return;

      this._clearRingtoneTimer();
      this._setState(CallState.MISSED, payload);
      this._cb.onCallMissed?.(payload);
      this._cleanup();
    };

    // ── call:media_toggle ─────────────────────────────────────────────────────
    // Remote peer toggled their audio/video.
    this._onMediaToggle = (payload) => {
      this._cb.onMediaToggle?.(payload);
    };

    // ── call:peer_disconnected ────────────────────────────────────────────────
    // Remote peer's socket disconnected unexpectedly.
    this._onPeerDisconnected = (payload) => {
      this._setState(CallState.RECONNECTING, payload);
      this._cb.onPeerDisconnected?.(payload);
    };

    // ── call:missed_while_offline ─────────────────────────────────────────────
    // Delivered on reconnect when caller rang while we were offline.
    this._onMissedWhileOffline = (payload) => {
      this._cb.onMissedWhileOffline?.(payload);
    };

    // ── Register all ─────────────────────────────────────────────────────────
    s.on('call:incoming',             this._onIncoming);
    s.on('call:ringing',              this._onRinging);
    s.on('call:offer',                this._onOffer);
    s.on('call:answered',             this._onAnswered);
    s.on('call:ice',                  this._onIce);
    s.on('call:ended',                this._onEnded);
    s.on('call:declined',             this._onDeclined);
    s.on('call:missed',               this._onMissed);
    s.on('call:media_toggle',         this._onMediaToggle);
    s.on('call:peer_disconnected',    this._onPeerDisconnected);
    s.on('call:missed_while_offline', this._onMissedWhileOffline);
  }

  _unregisterSocketListeners() {
    const s = this._socket;
    s.off('call:incoming',             this._onIncoming);
    s.off('call:ringing',              this._onRinging);
    s.off('call:offer',                this._onOffer);
    s.off('call:answered',             this._onAnswered);
    s.off('call:ice',                  this._onIce);
    s.off('call:ended',                this._onEnded);
    s.off('call:declined',             this._onDeclined);
    s.off('call:missed',               this._onMissed);
    s.off('call:media_toggle',         this._onMediaToggle);
    s.off('call:peer_disconnected',    this._onPeerDisconnected);
    s.off('call:missed_while_offline', this._onMissedWhileOffline);
  }
}

 