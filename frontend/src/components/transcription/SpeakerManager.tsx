"use client";

import { useState, useCallback, useMemo } from "react";
import { Users, Edit3, Check, X, MessageSquare, Clock } from "lucide-react";
import { getSpeakerColor, formatDuration } from "@/utils/format";
import type { SegmentResponse } from "@/types";

interface SpeakerManagerProps {
  segments: SegmentResponse[];
  speakerMap: Map<string, number>;
  onRenameSpeaker: (oldName: string, newName: string) => void;
}

interface SpeakerStats {
  name: string;
  wordCount: number;
  talkTime: number;
  segmentCount: number;
  index: number;
}

export function SpeakerManager({
  segments,
  speakerMap,
  onRenameSpeaker,
}: SpeakerManagerProps) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const speakerStats: SpeakerStats[] = useMemo(() => {
    const statsMap = new Map<string, SpeakerStats>();

    for (const segment of segments) {
      const speaker = segment.speaker ?? "Okänd";
      const existing = statsMap.get(speaker);
      const wordCount = segment.text.split(/\s+/).filter(Boolean).length;
      const talkTime = segment.end_time - segment.start_time;

      if (existing) {
        existing.wordCount += wordCount;
        existing.talkTime += talkTime;
        existing.segmentCount += 1;
      } else {
        statsMap.set(speaker, {
          name: speaker,
          wordCount,
          talkTime,
          segmentCount: 1,
          index: speakerMap.get(speaker) ?? statsMap.size,
        });
      }
    }

    return Array.from(statsMap.values()).sort((a, b) => b.talkTime - a.talkTime);
  }, [segments, speakerMap]);

  const handleStartEdit = useCallback((name: string) => {
    setEditingName(name);
    setNewName(name);
  }, []);

  const handleSaveEdit = useCallback(
    (oldName: string) => {
      if (newName.trim() && newName.trim() !== oldName) {
        onRenameSpeaker(oldName, newName.trim());
      }
      setEditingName(null);
      setNewName("");
    },
    [newName, onRenameSpeaker]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingName(null);
    setNewName("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, oldName: string) => {
      if (e.key === "Enter") {
        handleSaveEdit(oldName);
      }
      if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  const totalTalkTime = useMemo(
    () => speakerStats.reduce((sum, s) => sum + s.talkTime, 0),
    [speakerStats]
  );

  if (speakerStats.length === 0) {
    return null;
  }

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-200">
          Talare ({speakerStats.length})
        </h3>
      </div>

      <div className="space-y-3">
        {speakerStats.map((speaker) => {
          const color = getSpeakerColor(speaker.index);
          const isEditing = editingName === speaker.name;
          const talkPercentage =
            totalTalkTime > 0
              ? Math.round((speaker.talkTime / totalTalkTime) * 100)
              : 0;

          return (
            <div key={speaker.name} className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />

                {/* Name */}
                {isEditing ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, speaker.name)}
                      className="flex-1 bg-dark-800 border border-primary-600/40 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(speaker.name)}
                      className="p-1 text-green-400 hover:bg-green-600/10 rounded transition-colors"
                      aria-label="Spara"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 text-gray-400 hover:bg-dark-800 rounded transition-colors"
                      aria-label="Avbryt"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-1 min-w-0 group">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color }}
                    >
                      {speaker.name}
                    </span>
                    <button
                      onClick={() => handleStartEdit(speaker.name)}
                      className="p-1 text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                      aria-label="Byt namn"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 ml-5 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {speaker.wordCount} ord
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(speaker.talkTime)}
                </span>
                <span>{talkPercentage}%</span>
              </div>

              {/* Talk time bar */}
              <div className="ml-5 h-1 bg-dark-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${talkPercentage}%`,
                    backgroundColor: color,
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
