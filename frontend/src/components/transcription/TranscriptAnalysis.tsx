"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  Hash,
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  Type,
} from "lucide-react";
import { getTranscriptAnalysis } from "@/services/api";
import { formatDuration, getSpeakerColor } from "@/utils/format";
import type { SpeakerAnalysis } from "@/types";

interface TranscriptAnalysisProps {
  jobId: string;
  speakerMap: Map<string, number>;
}

export function TranscriptAnalysis({ jobId, speakerMap }: TranscriptAnalysisProps) {
  const [speakersOpen, setSpeakersOpen] = useState(true);
  const [wordsOpen, setWordsOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["transcript-analysis", jobId],
    queryFn: () => getTranscriptAnalysis(jobId),
    enabled: !!jobId,
    staleTime: 30_000,
  });

  // Don't render on error
  if (isError) return null;

  // Subtle loading state
  if (isLoading) {
    return (
      <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary-400" />
          <span className="text-sm font-medium text-gray-200">Analys</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 bg-dark-800 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Don't render if no data
  if (!data) return null;

  const sortedSpeakers = [...data.speakers].sort(
    (a, b) => b.talk_percentage - a.talk_percentage
  );

  const maxWordCount =
    data.word_frequencies.length > 0
      ? data.word_frequencies[0].count
      : 1;

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary-400" />
        <span className="text-sm font-medium text-gray-200">Analys</span>
      </div>

      {/* Overview - always visible */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Type className="h-3.5 w-3.5" />}
          label="Totalt ord"
          value={data.total_words.toLocaleString("sv-SE")}
        />
        <StatCard
          icon={<Hash className="h-3.5 w-3.5" />}
          label="Unika ord"
          value={data.unique_words.toLocaleString("sv-SE")}
        />
        <StatCard
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Segment"
          value={data.total_segments.toLocaleString("sv-SE")}
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Ord/minut"
          value={Math.round(data.avg_words_per_minute).toString()}
        />
      </div>

      {/* Speakers section - only if speakers exist */}
      {sortedSpeakers.length > 0 && (
        <CollapsibleSection
          title={`Talare (${sortedSpeakers.length})`}
          icon={<Users className="h-3.5 w-3.5 text-gray-500" />}
          isOpen={speakersOpen}
          onToggle={() => setSpeakersOpen(!speakersOpen)}
        >
          <div className="space-y-3">
            {sortedSpeakers.map((speaker) => (
              <SpeakerRow
                key={speaker.name}
                speaker={speaker}
                speakerIndex={speakerMap.get(speaker.name) ?? 0}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Word frequencies section */}
      {data.word_frequencies.length > 0 && (
        <CollapsibleSection
          title="Vanligaste ord"
          icon={<BarChart3 className="h-3.5 w-3.5 text-gray-500" />}
          isOpen={wordsOpen}
          onToggle={() => setWordsOpen(!wordsOpen)}
        >
          <div className="space-y-1">
            {data.word_frequencies.slice(0, 30).map((wf) => (
              <div key={wf.word} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 truncate flex-shrink-0" title={wf.word}>
                  {wf.word}
                </span>
                <div className="flex-1 h-3 bg-dark-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-primary-600/40 rounded-sm transition-all duration-300"
                    style={{
                      width: `${(wf.count / maxWordCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 w-8 text-right flex-shrink-0 tabular-nums">
                  {wf.count}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

/** Compact stat card for the 2x2 overview grid */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-dark-800/50 rounded-md px-3 py-2">
      <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-200">{value}</span>
    </div>
  );
}

/** Collapsible section with chevron toggle */
function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-dark-800 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full text-left group"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-gray-500" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500" />
        )}
        {icon}
        <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300 transition-colors">
          {title}
        </span>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}

/** Speaker row with percentage bar, stats */
function SpeakerRow({
  speaker,
  speakerIndex,
}: {
  speaker: SpeakerAnalysis;
  speakerIndex: number;
}) {
  const color = getSpeakerColor(speakerIndex);

  return (
    <div className="space-y-1.5">
      {/* Name and percentage */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-xs font-medium truncate"
            style={{ color }}
          >
            {speaker.name}
          </span>
        </div>
        <span className="text-xs font-medium text-gray-400 flex-shrink-0">
          {Math.round(speaker.talk_percentage)}%
        </span>
      </div>

      {/* Percentage bar */}
      <div className="h-1 bg-dark-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${speaker.talk_percentage}%`,
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-0.5">
          <Type className="h-2.5 w-2.5" />
          {speaker.word_count} ord
        </span>
        <span className="flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {formatDuration(speaker.talk_time)}
        </span>
        <span className="flex items-center gap-0.5">
          <TrendingUp className="h-2.5 w-2.5" />
          {Math.round(speaker.words_per_minute)} ord/min
        </span>
      </div>
    </div>
  );
}
