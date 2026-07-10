// src/hooks/useVoiceRecorder.js
'use client';
import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

export function useVoiceRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setDurationSeconds(0);
      timerRef.current = setInterval(() => setDurationSeconds((s) => s + 1), 1000);
    } catch (err) {
      toast.error('Microphone access denied.');
    }
  }, []);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(timerRef.current);
  };

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve(null);

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        cleanupStream();
        setIsRecording(false);
        resolve({ file, durationSeconds });
      };
      recorder.stop();
    });
  }, [durationSeconds]);

  const cancel = useCallback(() => {
    mediaRecorderRef.current?.stop();
    cleanupStream();
    setIsRecording(false);
    setDurationSeconds(0);
    chunksRef.current = [];
  }, []);

  return { isRecording, durationSeconds, start, stop, cancel };
}
