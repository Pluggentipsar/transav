"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

export function AudioRecorder({
  onRecordingComplete,
  disabled = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        // Build file from chunks
        const actualMime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });

        // Determine extension from mime type
        const ext = actualMime.includes("webm") ? ".webm" : ".ogg";
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[T:]/g, "-");
        const fileName = `inspelning-${timestamp}${ext}`;

        const file = new File([blob], fileName, { type: actualMime });
        onRecordingComplete(file);

        chunksRef.current = [];
      };

      recorder.onerror = () => {
        setError("Inspelningen misslyckades. Försök igen.");
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect data every 250ms

      setIsRecording(true);
      setElapsedSeconds(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(
          "Mikrofontillgång nekad. Tillåt mikrofonen i webbläsarens inställningar."
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        setError("Ingen mikrofon hittades. Anslut en mikrofon och försök igen.");
      } else {
        setError("Kunde inte starta inspelningen. Kontrollera mikrofonen.");
      }
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (totalSeconds: number): string => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mic className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-200">
          Spela in ljud
        </h3>
      </div>

      <div className="flex items-center gap-4">
        {!isRecording ? (
          <Button
            variant="secondary"
            size="md"
            onClick={startRecording}
            disabled={disabled}
            icon={<Mic className="h-4 w-4" />}
          >
            Starta inspelning
          </Button>
        ) : (
          <Button
            variant="danger"
            size="md"
            onClick={stopRecording}
            icon={<Square className="h-3.5 w-3.5" />}
          >
            Stoppa
          </Button>
        )}

        {isRecording && (
          <div className="flex items-center gap-3">
            {/* Pulsating red dot */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>

            {/* Timer */}
            <span className="text-sm text-gray-300 tabular-nums font-mono">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 mt-3">{error}</p>
      )}

      <p className="text-xs text-gray-600 mt-3">
        Spela in direkt från mikrofonen. Inspelningen sparas som en ljudfil för
        transkription.
      </p>
    </div>
  );
}
