"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileAudio,
  Clock,
  Cpu,
  Users,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";
import { useJobPolling } from "@/hooks/usePolling";
import {
  getTranscript,
  updateSegment,
  renameSpeaker,
  anonymizeJob,
  getAudioUrl,
} from "@/services/api";
import { AudioPlayer } from "@/components/transcription/AudioPlayer";
import { TranscriptViewer } from "@/components/transcription/TranscriptViewer";
import { SpeakerManager } from "@/components/transcription/SpeakerManager";
import { ExportPanel } from "@/components/transcription/ExportPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatDuration,
  formatDate,
  formatFileSize,
  getStatusInfo,
} from "@/utils/format";
import type { JobResponse } from "@/types";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = params.id as string;

  const [currentTime, setCurrentTime] = useState(0);
  const [showAnonymized, setShowAnonymized] = useState(false);

  // Job polling
  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
  } = useJobPolling(jobId);

  // Transcript data
  const {
    data: transcript,
    isLoading: transcriptLoading,
  } = useQuery({
    queryKey: ["transcript", jobId],
    queryFn: () => getTranscript(jobId),
    enabled: !!job && job.status === "COMPLETED",
  });

  // Mutations
  const segmentMutation = useMutation({
    mutationFn: ({
      segmentId,
      text,
    }: {
      segmentId: number;
      text: string;
    }) => updateSegment(jobId, segmentId, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcript", jobId] });
    },
  });

  const speakerRenameMutation = useMutation({
    mutationFn: ({
      oldName,
      newName,
    }: {
      oldName: string;
      newName: string;
    }) => renameSpeaker(jobId, oldName, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcript", jobId] });
    },
  });

  const anonymizeMutation = useMutation({
    mutationFn: () => anonymizeJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcript", jobId] });
    },
  });

  // Build speaker map
  const speakerMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!transcript?.segments) return map;
    let index = 0;
    for (const segment of transcript.segments) {
      if (segment.speaker && !map.has(segment.speaker)) {
        map.set(segment.speaker, index++);
      }
    }
    return map;
  }, [transcript?.segments]);

  const hasAnonymizedContent = useMemo(() => {
    return (
      transcript?.segments.some((s) => s.anonymized_text !== null) ?? false
    );
  }, [transcript?.segments]);

  const handleSegmentEdit = useCallback(
    (segmentId: number, text: string) => {
      segmentMutation.mutate({ segmentId, text });
    },
    [segmentMutation]
  );

  const handleRenameSpeaker = useCallback(
    (oldName: string, newName: string) => {
      speakerRenameMutation.mutate({ oldName, newName });
    },
    [speakerRenameMutation]
  );

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Loading state
  if (jobLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <svg
            className="animate-spin h-6 w-6 text-primary-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="ml-3 text-gray-400">Laddar jobb...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (jobError || !job) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
          <p className="text-red-400 text-lg mb-2">
            Kunde inte ladda jobbet
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Jobbet kanske har tagits bort eller sa ar servern otillganglig.
          </p>
          <Button variant="secondary" onClick={() => router.push("/jobs")}>
            Tillbaka till transkriptioner
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(job.status);
  const isActive = job.status === "PENDING" || job.status === "PROCESSING";
  const isCompleted = job.status === "COMPLETED";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => router.push("/jobs")}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till transkriptioner
      </button>

      {/* Header */}
      <JobHeader job={job} statusInfo={statusInfo} />

      {/* Active job progress */}
      {isActive && (
        <div className="mt-6 bg-dark-900 border border-dark-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg
              className="animate-spin h-5 w-5 text-primary-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-white">
                {job.status === "PENDING"
                  ? "Vantar pa bearbetning..."
                  : "Transkriberar..."}
              </p>
              {job.current_step && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.current_step}
                </p>
              )}
            </div>
          </div>
          <ProgressBar
            value={job.progress}
            color={job.status === "PENDING" ? "yellow" : "blue"}
            size="md"
          />
        </div>
      )}

      {/* Failed state */}
      {job.status === "FAILED" && (
        <div className="mt-6 bg-red-600/10 border border-red-600/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">
                Transkriptionen misslyckades
              </p>
              {job.error_message && (
                <p className="text-xs text-red-400/70 mt-1">
                  {job.error_message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed content */}
      {isCompleted && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Main content */}
          <div className="space-y-4">
            {/* Audio player */}
            <AudioPlayer
              src={getAudioUrl(jobId)}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
            />

            {/* Anonymization toggle */}
            {hasAnonymizedContent && (
              <div className="flex items-center justify-between bg-dark-900 border border-dark-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  {showAnonymized ? (
                    <EyeOff className="h-4 w-4 text-primary-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-300">
                    {showAnonymized
                      ? "Visar anonymiserad text"
                      : "Visar originaltext"}
                  </span>
                </div>
                <button
                  onClick={() => setShowAnonymized(!showAnonymized)}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {showAnonymized ? "Visa original" : "Visa anonymiserad"}
                </button>
              </div>
            )}

            {/* Transcript */}
            <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-200">
                  Transkription
                  {transcript && (
                    <span className="text-gray-500 ml-2">
                      ({transcript.total_segments} segment)
                    </span>
                  )}
                </h3>
              </div>

              {transcriptLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg
                    className="animate-spin h-5 w-5 text-primary-400"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span className="ml-3 text-gray-400 text-sm">
                    Laddar transkription...
                  </span>
                </div>
              ) : transcript ? (
                <div className="max-h-[600px] overflow-y-auto">
                  <TranscriptViewer
                    segments={transcript.segments}
                    currentTime={currentTime}
                    showAnonymized={showAnonymized}
                    speakerMap={speakerMap}
                    onSeek={handleSeek}
                    onSegmentEdit={handleSegmentEdit}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Anonymize button */}
            <Button
              variant="secondary"
              onClick={() => anonymizeMutation.mutate()}
              loading={anonymizeMutation.isPending}
              icon={<Wand2 className="h-4 w-4" />}
              className="w-full"
              size="sm"
            >
              Korforbattrad anonymisering
            </Button>

            {/* Speaker manager */}
            {job.enable_diarization && transcript && (
              <SpeakerManager
                segments={transcript.segments}
                speakerMap={speakerMap}
                onRenameSpeaker={handleRenameSpeaker}
              />
            )}

            {/* Export */}
            <ExportPanel
              jobId={jobId}
              hasAnonymized={hasAnonymizedContent}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Job info header */
function JobHeader({
  job,
  statusInfo,
}: {
  job: JobResponse;
  statusInfo: { label: string; variant: "warning" | "info" | "success" | "danger" | "default" };
}) {
  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-dark-800 flex items-center justify-center">
            <FileAudio className="h-6 w-6 text-primary-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white truncate">
              {job.name}
            </h2>
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {job.file_name} &middot; {formatFileSize(job.file_size)}
            </p>
          </div>
        </div>
        <Badge variant={statusInfo.variant} dot>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-dark-800">
        <DetailItem
          icon={<Clock className="h-4 w-4 text-gray-500" />}
          label="Langd"
          value={formatDuration(job.duration_seconds)}
        />
        <DetailItem
          icon={<Cpu className="h-4 w-4 text-gray-500" />}
          label="Modell"
          value={job.model.split("/").pop() ?? job.model}
        />
        <DetailItem
          icon={<Users className="h-4 w-4 text-gray-500" />}
          label="Talare"
          value={
            job.enable_diarization
              ? `${job.speaker_count} identifierade`
              : "Avstangd"
          }
        />
        <DetailItem
          icon={<ShieldCheck className="h-4 w-4 text-gray-500" />}
          label="Anonymisering"
          value={job.enable_anonymization ? "Aktiverad" : "Avstangd"}
        />
      </div>

      {/* Timestamps */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
        <span>Skapad: {formatDate(job.created_at)}</span>
        {job.completed_at && (
          <span>Klar: {formatDate(job.completed_at)}</span>
        )}
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-200 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
