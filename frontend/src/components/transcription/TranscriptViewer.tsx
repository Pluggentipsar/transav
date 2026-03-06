"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Check, X, Edit3 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { formatTimestamp, getSpeakerColor } from "@/utils/format";
import type { SegmentResponse } from "@/types";

interface TranscriptViewerProps {
  segments: SegmentResponse[];
  currentTime: number;
  showAnonymized: boolean;
  speakerMap: Map<string, number>;
  onSeek: (time: number) => void;
  onSegmentEdit: (segmentId: number, text: string) => void;
}

export function TranscriptViewer({
  segments,
  currentTime,
  showAnonymized,
  speakerMap,
  onSeek,
  onSegmentEdit,
}: TranscriptViewerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime]);

  const handleStartEdit = useCallback(
    (segment: SegmentResponse) => {
      setEditingId(segment.id);
      setEditText(segment.text);
    },
    []
  );

  const handleSaveEdit = useCallback(
    (segmentId: number) => {
      onSegmentEdit(segmentId, editText);
      setEditingId(null);
      setEditText("");
    },
    [editText, onSegmentEdit]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, segmentId: number) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSaveEdit(segmentId);
      }
      if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  if (segments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Inga segment att visa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {segments.map((segment) => {
        const isActive =
          currentTime >= segment.start_time &&
          currentTime < segment.end_time;
        const isEditing = editingId === segment.id;
        const speakerIndex = segment.speaker
          ? speakerMap.get(segment.speaker) ?? 0
          : 0;
        const speakerColor = segment.speaker
          ? getSpeakerColor(speakerIndex)
          : undefined;
        const displayText =
          showAnonymized && segment.anonymized_text
            ? segment.anonymized_text
            : segment.text;

        return (
          <div
            key={segment.id}
            ref={isActive ? activeRef : undefined}
            className={twMerge(
              "group flex gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer",
              isActive
                ? "bg-primary-600/10 border border-primary-600/20"
                : "hover:bg-dark-800/50 border border-transparent"
            )}
            onClick={() => !isEditing && onSeek(segment.start_time)}
          >
            {/* Timestamp */}
            <div className="flex-shrink-0 pt-0.5">
              <span className="text-xs font-mono text-gray-500 group-hover:text-gray-400 transition-colors">
                {formatTimestamp(segment.start_time)}
              </span>
            </div>

            {/* Speaker label */}
            {segment.speaker && (
              <div className="flex-shrink-0 pt-0.5">
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded"
                  style={{
                    color: speakerColor,
                    backgroundColor: speakerColor
                      ? `${speakerColor}15`
                      : undefined,
                  }}
                >
                  {segment.speaker}
                </span>
              </div>
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, segment.id)}
                    className="w-full bg-dark-800 border border-primary-600/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(segment.id)}
                      className="p-1.5 text-green-400 hover:bg-green-600/10 rounded transition-colors"
                      aria-label="Spara"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 text-gray-400 hover:bg-dark-800 rounded transition-colors"
                      aria-label="Avbryt"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p
                    className={twMerge(
                      "text-sm leading-relaxed flex-1",
                      isActive ? "text-white" : "text-gray-300"
                    )}
                  >
                    {displayText}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(segment);
                    }}
                    className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                    aria-label="Redigera"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
