'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Trash2, Send, Play, Pause } from 'lucide-react';

const BAR_COUNT = 28;

/**
 * WhatsApp-style voice message recorder: tap mic -> live waveform while
 * recording -> stop -> review with playback -> send or discard.
 *
 * @param {{ onRecorded: (file: File) => void, disabled?: boolean, onPhaseChange?: (phase: 'idle'|'recording'|'review') => void }} props
 */
export default function VoiceRecorderButton({ onRecorded, disabled, onPhaseChange }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'recording' | 'review'
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState(() => new Array(BAR_COUNT).fill(4));
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const blobRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const playbackRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const cleanupAudioGraph = () => {
    cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  const tickWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const amplitude = Math.max(4, Math.min(32, (max - min) / 2));
    setLevels((prev) => [...prev.slice(1), amplitude]);
    rafRef.current = requestAnimationFrame(tickWaveform);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextCtor();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = window.MediaRecorder?.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        cleanupAudioGraph();
        stopStream();
        clearInterval(timerRef.current);
        setPhase('review');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      startTimeRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 200);
      setLevels(new Array(BAR_COUNT).fill(4));
      setPhase('recording');
      rafRef.current = requestAnimationFrame(tickWaveform);
    } catch {
      // Mic permission denied/unavailable — stay idle rather than throw.
    }
  }, [tickWaveform]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
  }, []);

  const discard = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    playbackRef.current?.pause();
    blobRef.current = null;
    chunksRef.current = [];
    setPreviewUrl(null);
    setIsPlaying(false);
    setPhase('idle');
  }, [previewUrl]);

  const send = useCallback(() => {
    if (!blobRef.current) return;
    const file = new File([blobRef.current], `voice-message-${Date.now()}.webm`, { type: blobRef.current.type });
    onRecorded(file);
    discard();
  }, [onRecorded, discard]);

  const togglePlayback = useCallback(() => {
    const audio = playbackRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      stopStream();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(() => {});
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className="btn btn-ghost btn-circle shrink-0"
        aria-label="Record voice message"
      >
        <Mic className="w-4.5 h-4.5" />
      </button>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-2 bg-base-200 rounded-field px-2.5 py-1.5 flex-1">
        <button type="button" onClick={discard} className="btn btn-ghost btn-circle btn-xs text-error" aria-label="Cancel recording">
          <Trash2 className="w-4 h-4" />
        </button>
        <span className="w-2 h-2 rounded-full bg-error animate-pulse shrink-0" />
        <div className="flex items-center gap-[2px] h-6 flex-1 overflow-hidden">
          {levels.map((lvl, i) => (
            <span key={i} className="w-[3px] rounded-full bg-primary shrink-0" style={{ height: `${lvl}px` }} />
          ))}
        </div>
        <span className="text-xs tabular-nums text-base-content/60 shrink-0">{formatTime(elapsedMs)}</span>
        <button type="button" onClick={stopRecording} className="btn btn-primary btn-circle btn-xs shrink-0" aria-label="Stop recording">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // phase === 'review' — playback + confirm send, like WhatsApp's preview step
  return (
    <div className="flex items-center gap-2 bg-base-200 rounded-field px-2.5 py-1.5 flex-1">
      <button type="button" onClick={discard} className="btn btn-ghost btn-circle btn-xs text-error" aria-label="Discard recording">
        <Trash2 className="w-4 h-4" />
      </button>
      <button type="button" onClick={togglePlayback} className="btn btn-ghost btn-circle btn-xs text-primary" aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <audio
        ref={playbackRef}
        src={previewUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="flex-1 h-8 min-w-0"
        controls
      />
      <button type="button" onClick={send} className="btn btn-primary btn-circle btn-xs shrink-0" aria-label="Send voice message">
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}