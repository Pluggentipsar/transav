"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { formatDuration } from "@/utils/format";

interface AudioPreviewProps {
  file: File;
}

export function AudioPreview({ file }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Create and revoke object URL when file changes
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        // Browser may block autoplay — silently ignore
      });
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const newTime = parseFloat(e.target.value);
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    []
  );

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  if (!objectUrl) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
      <audio
        ref={audioRef}
        src={objectUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <button
          type="button"
          onClick={togglePlayPause}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-950"
          aria-label={isPlaying ? "Pausa" : "Spela upp"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 text-white" />
          ) : (
            <Play className="h-4 w-4 text-white ml-0.5" />
          )}
        </button>

        {/* Timeline */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            {/* Track background */}
            <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Invisible range input for seeking */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Sök i ljudfilen"
            />
          </div>
        </div>

        {/* Time display */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs text-gray-400 tabular-nums min-w-[85px] text-right">
            {formatDuration(currentTime)} / {formatDuration(duration || null)}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-600 mt-2">
        Förhandslyssna på filen innan transkription
      </p>
    </div>
  );
}
