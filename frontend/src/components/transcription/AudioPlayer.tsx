"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { formatTimestamp } from "@/utils/format";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface AudioPlayerProps {
  src: string;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export function AudioPlayer({
  src,
  currentTime,
  onTimeUpdate,
  onDurationChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [internalTime, setInternalTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Sync external currentTime to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isDragging) return;
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isDragging]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isDragging) return;
    setInternalTime(audio.currentTime);
    onTimeUpdate(audio.currentTime);
  }, [onTimeUpdate, isDragging]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
    onDurationChange?.(audio.duration);
  }, [onDurationChange]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleRestart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setInternalTime(0);
    onTimeUpdate(0);
  }, [onTimeUpdate]);

  const handleSpeedChange = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentIndex = SPEED_OPTIONS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIndex];
    audio.playbackRate = newSpeed;
    setSpeed(newSpeed);
  }, [speed]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const progressBar = progressRef.current;
      if (!audio || !progressBar) return;
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = fraction * duration;
      audio.currentTime = newTime;
      setInternalTime(newTime);
      onTimeUpdate(newTime);
    },
    [duration, onTimeUpdate]
  );

  const handleProgressDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      handleProgressClick(e);
    },
    [isDragging, handleProgressClick]
  );

  const displayTime = isDragging ? internalTime : internalTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="flex items-center gap-3">
        {/* Restart */}
        <button
          onClick={handleRestart}
          className="p-1.5 text-gray-500 hover:text-white transition-colors rounded"
          aria-label="Början"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center text-white transition-colors"
          aria-label={isPlaying ? "Pausa" : "Spela"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>

        {/* Time */}
        <span className="text-xs text-gray-400 font-mono w-24 text-center">
          {formatTimestamp(displayTime)} / {formatTimestamp(duration)}
        </span>

        {/* Progress bar */}
        <div
          ref={progressRef}
          className="flex-1 h-8 flex items-center cursor-pointer group"
          onClick={handleProgressClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseMove={handleProgressDrag}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          <div className="w-full h-1.5 bg-dark-800 rounded-full relative overflow-hidden group-hover:h-2 transition-all">
            <div
              className="h-full bg-primary-500 rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Speed */}
        <button
          onClick={handleSpeedChange}
          className="px-2 py-1 text-xs font-medium text-gray-400 hover:text-white bg-dark-800 rounded transition-colors min-w-[3rem]"
          aria-label="Ändring av hastighet"
        >
          {speed}x
        </button>

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="p-1.5 text-gray-500 hover:text-white transition-colors rounded"
          aria-label={isMuted ? "Ljud på" : "Ljud av"}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
