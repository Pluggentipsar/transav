"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
  Sparkles,
  Pencil,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useJobPolling } from "@/hooks/usePolling";
import {
  getTranscript,
  updateSegment,
  updateJob,
  renameSpeaker,
  runAnonymization,
  enhanceAnonymization,
  applyCustomWords,
  getAnonymizeStatus,
  listTemplates,
  getAudioUrl,
} from "@/services/api";
import { AudioPlayer } from "@/components/transcription/AudioPlayer";
import { TranscriptViewer } from "@/components/transcription/TranscriptViewer";
import { SpeakerManager } from "@/components/transcription/SpeakerManager";
import { ExportPanel } from "@/components/transcription/ExportPanel";
import { CustomWordsInput } from "@/components/anonymize/CustomWordsInput";
import { EntityStats } from "@/components/anonymize/EntityStats";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatDuration,
  formatDate,
  formatFileSize,
  getStatusInfo,
  NER_ENTITY_TYPES,
  PATTERN_CATEGORIES,
} from "@/utils/format";
import type { JobResponse, WordReplacement, TemplateResponse } from "@/types";

export default function JobDetailPage() {
  const queryClient = useQueryClient();
  // Read job ID from URL directly — useParams() doesn't work in static export
  // because the pre-rendered HTML is for /jobs/_ and Next.js can't resolve other IDs.
  const [jobId, setJobId] = useState<string>("");
  useEffect(() => {
    const segments = window.location.pathname.split("/");
    const id = segments[segments.length - 1] || segments[segments.length - 2];
    if (id && id !== "_") setJobId(id);
  }, []);

  const [currentTime, setCurrentTime] = useState(0);
  const [showAnonymized, setShowAnonymized] = useState(false);
  const [customWords, setCustomWords] = useState<WordReplacement[]>([]);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);

  // Anonymization type selection
  const [nerEntityTypes, setNerEntityTypes] = useState<string[]>(
    NER_ENTITY_TYPES.map((e) => e.id)
  );
  const [patternTypes, setPatternTypes] = useState<string[]>(
    PATTERN_CATEGORIES.map((p) => p.id)
  );
  const [showNerChips, setShowNerChips] = useState(false);
  const [showPatternChips, setShowPatternChips] = useState(false);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});

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

  const jobRenameMutation = useMutation({
    mutationFn: (newName: string) => updateJob(jobId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
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

  const nerStatusQuery = useQuery({
    queryKey: ["anonymize-status"],
    queryFn: getAnonymizeStatus,
    staleTime: 60_000,
  });

  const runNerMutation = useMutation({
    mutationFn: () =>
      runAnonymization(jobId, {
        entity_types: nerEntityTypes,
        pattern_types: patternTypes,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transcript", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      if (data.entity_counts) setEntityCounts(data.entity_counts);
    },
  });

  const enhancePatternsMutation = useMutation({
    mutationFn: () =>
      enhanceAnonymization(jobId, { pattern_types: patternTypes }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transcript", jobId] });
      if (data.entity_counts) setEntityCounts(data.entity_counts);
    },
  });

  const customWordsMutation = useMutation({
    mutationFn: () =>
      applyCustomWords(jobId, { custom_words: customWords }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcript", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });

  useEffect(() => {
    listTemplates()
      .then((res) => setTemplates(res.templates))
      .catch(() => {});
  }, []);

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
  if (jobLoading || !jobId) {
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
            Jobbet kanske har tagits bort eller så är servern otillgänglig.
          </p>
          <Button variant="secondary" onClick={() => window.location.href = "/jobs"}>
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
        onClick={() => window.location.href = "/jobs"}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till transkriptioner
      </button>

      {/* Header */}
      <JobHeader
        job={job}
        statusInfo={statusInfo}
        onRename={(name) => jobRenameMutation.mutate(name)}
      />

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
                  ? "Väntar på bearbetning..."
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
            {/* Anonymization section */}
            <div className="bg-dark-900 border border-dark-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary-400" />
                <span className="text-sm font-medium text-gray-200">
                  Anonymisering
                </span>
              </div>

              {/* NER button — only if transformers is installed */}
              {nerStatusQuery.data?.ner_available && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => runNerMutation.mutate()}
                    loading={runNerMutation.isPending}
                    disabled={enhancePatternsMutation.isPending}
                    icon={<Sparkles className="h-4 w-4" />}
                    className="w-full"
                    size="sm"
                  >
                    AI-anonymisering (NER)
                  </Button>

                  {/* Collapsible NER entity type chips */}
                  <button
                    onClick={() => setShowNerChips(!showNerChips)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
                  >
                    {showNerChips ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Entitetstyper
                  </button>
                  {showNerChips && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {NER_ENTITY_TYPES.map((etype) => {
                          const selected = nerEntityTypes.includes(etype.id);
                          return (
                            <button
                              key={etype.id}
                              onClick={() =>
                                setNerEntityTypes((prev) =>
                                  prev.includes(etype.id)
                                    ? prev.filter((t) => t !== etype.id)
                                    : [...prev, etype.id]
                                )
                              }
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                selected
                                  ? "bg-primary-600/20 text-primary-300 border-primary-600/40"
                                  : "bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300"
                              }`}
                              title={etype.description}
                            >
                              {etype.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        <button
                          onClick={() =>
                            setNerEntityTypes(NER_ENTITY_TYPES.map((e) => e.id))
                          }
                          className="text-gray-500 hover:text-primary-400 transition-colors"
                        >
                          Alla
                        </button>
                        <span className="text-gray-700">|</span>
                        <button
                          onClick={() => setNerEntityTypes([])}
                          className="text-gray-500 hover:text-primary-400 transition-colors"
                        >
                          Inga
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Patterns button — always available */}
              <Button
                variant="secondary"
                onClick={() => enhancePatternsMutation.mutate()}
                loading={enhancePatternsMutation.isPending}
                disabled={runNerMutation.isPending}
                icon={<Wand2 className="h-4 w-4" />}
                className="w-full"
                size="sm"
              >
                Mönsteranonymisering
              </Button>

              {/* Collapsible pattern category chips */}
              <button
                onClick={() => setShowPatternChips(!showPatternChips)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
              >
                {showPatternChips ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Mönsterkategorier
              </button>
              {showPatternChips && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {PATTERN_CATEGORIES.map((cat) => {
                      const selected = patternTypes.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() =>
                            setPatternTypes((prev) =>
                              prev.includes(cat.id)
                                ? prev.filter((t) => t !== cat.id)
                                : [...prev, cat.id]
                            )
                          }
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                            selected
                              ? "bg-primary-600/20 text-primary-300 border-primary-600/40"
                              : "bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300"
                          }`}
                          title={cat.description}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      onClick={() =>
                        setPatternTypes(PATTERN_CATEGORIES.map((p) => p.id))
                      }
                      className="text-gray-500 hover:text-primary-400 transition-colors"
                    >
                      Alla
                    </button>
                    <span className="text-gray-700">|</span>
                    <button
                      onClick={() => setPatternTypes([])}
                      className="text-gray-500 hover:text-primary-400 transition-colors"
                    >
                      Inga
                    </button>
                  </div>
                </div>
              )}

              {/* Result feedback */}
              {runNerMutation.data && (
                <p className="text-xs text-green-400">
                  {runNerMutation.data.message}
                </p>
              )}
              {enhancePatternsMutation.data && (
                <p className="text-xs text-green-400">
                  {enhancePatternsMutation.data.message}
                </p>
              )}
              {(runNerMutation.isError || enhancePatternsMutation.isError) && (
                <p className="text-xs text-red-400">
                  Anonymiseringen misslyckades. Försök igen.
                </p>
              )}

              {/* Entity stats */}
              {Object.keys(entityCounts).length > 0 && (
                <EntityStats entityCounts={entityCounts} />
              )}

              {/* NER not available hint */}
              {nerStatusQuery.data &&
                !nerStatusQuery.data.ner_available && (
                  <p className="text-xs text-gray-600">
                    AI-anonymisering kräver transformers-paketet.
                    Mönsteranonymisering är alltid tillgänglig.
                  </p>
                )}

              {/* Custom words */}
              <div className="pt-2 border-t border-dark-700">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Egna ord
                </label>
                <CustomWordsInput
                  words={customWords}
                  onChange={setCustomWords}
                  templates={templates}
                  onSelectTemplate={(t) => {
                    const existing = new Set(
                      customWords.map((w) => w.original.toLowerCase())
                    );
                    const newWords = t.words.filter(
                      (w) => !existing.has(w.original.toLowerCase())
                    );
                    setCustomWords([...customWords, ...newWords]);
                  }}
                  compact
                />
                {customWords.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => customWordsMutation.mutate()}
                    loading={customWordsMutation.isPending}
                    icon={<Wand2 className="h-4 w-4" />}
                    className="w-full mt-2"
                    size="sm"
                  >
                    Kör egna ord
                  </Button>
                )}
                {customWordsMutation.data && (
                  <p className="text-xs text-green-400 mt-1">
                    {customWordsMutation.data.message}
                  </p>
                )}
              </div>
            </div>

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

/** Job info header with inline-editable name */
function JobHeader({
  job,
  statusInfo,
  onRename,
}: {
  job: JobResponse;
  statusInfo: { label: string; variant: "warning" | "info" | "success" | "danger" | "default" };
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(job.name);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== job.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditName(job.name);
      setEditing(false);
    }
  };

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-dark-800 flex items-center justify-center">
            <FileAudio className="h-6 w-6 text-primary-400" />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  autoFocus
                  className="text-xl font-bold text-white bg-dark-800 border border-dark-700 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                />
                <button
                  onClick={handleSave}
                  className="flex-shrink-0 p-1 text-primary-400 hover:text-primary-300"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-xl font-bold text-white truncate">
                  {job.name}
                </h2>
                <button
                  onClick={() => { setEditName(job.name); setEditing(true); }}
                  className="flex-shrink-0 p-1 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-primary-400 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
          label="Längd"
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
              : "Avstängd"
          }
        />
        <DetailItem
          icon={<ShieldCheck className="h-4 w-4 text-gray-500" />}
          label="Anonymisering"
          value={job.enable_anonymization ? "Aktiverad" : "Avstängd"}
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
