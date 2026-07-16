import { useCallback, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "transcribing" | "error";

/**
 * Records audio from the mic via MediaRecorder and hands the resulting
 * blob to `onResult` once stopped. Recording stays entirely in-browser;
 * only the finished clip is sent (by the caller) to the local transcription
 * endpoint.
 */
export function useVoiceRecorder(onStop: (blob: Blob) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access isn't supported in this browser.");
      setStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onStop(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Microphone permission was denied.");
      setStatus("error");
    }
  }, [onStop]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setStatus("transcribing");
  }, []);

  const reset = useCallback(() => setStatus("idle"), []);

  return { status, error, start, stop, reset, setStatus, setError };
}
