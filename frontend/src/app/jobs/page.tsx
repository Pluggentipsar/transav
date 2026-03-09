"use client";

import { useState, useMemo, useCallback } from "react";
// NOTE: We use <a> instead of <Link> for /jobs/[id] because in static export
// only /jobs/_ is pre-rendered. Next.js client-side routing can't resolve
// dynamic IDs, so we force a full page load to let the backend serve _.html.
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Trash2,
  FileAudio,
  Clock,
  ChevronRight,
  AlertCircle,
  Inbox,
  Plus,
} from "lucide-react";
import { listJobs, deleteJob } from "@/services/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatDuration,
  formatDate,
  formatRelativeTime,
  formatFileSize,
  getStatusInfo,
} from "@/utils/format";
import type { JobResponse } from "@/types";

export default function JobsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(0, 100),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setDeleteConfirmId(null);
    },
  });

  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    if (!searchQuery.trim()) return data.jobs;
    const q = searchQuery.toLowerCase();
    return data.jobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        job.file_name.toLowerCase().includes(q) ||
        job.status.toLowerCase().includes(q)
    );
  }, [data?.jobs, searchQuery]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, jobId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteConfirmId(jobId);
    },
    []
  );

  const handleDeleteConfirm = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleteConfirmId) {
        deleteMutation.mutate(deleteConfirmId);
      }
    },
    [deleteConfirmId, deleteMutation]
  );

  const handleDeleteCancel = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteConfirmId(null);
    },
    []
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
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
          <span className="ml-3 text-gray-400">Laddar transkriptioner...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
          <p className="text-red-400 text-lg">
            Kunde inte ladda transkriptioner
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Kontrollera att backend-servern är igång.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Transkriptioner
          </h2>
          <p className="text-gray-500 text-sm">
            {data?.total ?? 0} transkription{(data?.total ?? 0) !== 1 ? "er" : ""} totalt
          </p>
        </div>
        <Button
          onClick={() => router.push("/upload")}
          icon={<Plus className="h-4 w-4" />}
        >
          Ny transkription
        </Button>
      </div>

      {/* Search */}
      {(data?.jobs?.length ?? 0) > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök transkriptioner..."
            className="w-full bg-dark-900 border border-dark-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      )}

      {/* Empty state */}
      {(data?.jobs?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-900 flex items-center justify-center mb-4">
            <Inbox className="h-8 w-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            Inga transkriptioner ännu
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm">
            Ladda upp en ljudfil för att komma igång med din första
            transkription.
          </p>
          <Button
            onClick={() => router.push("/upload")}
            icon={<Plus className="h-4 w-4" />}
          >
            Ny transkription
          </Button>
        </div>
      )}

      {/* No search results */}
      {(data?.jobs?.length ?? 0) > 0 && filteredJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-8 w-8 text-gray-600 mb-3" />
          <p className="text-gray-400">
            Inga transkriptioner matchar &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      )}

      {/* Jobs list */}
      <div className="space-y-3">
        {filteredJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isDeleteConfirm={deleteConfirmId === job.id}
            isDeleting={
              deleteMutation.isPending &&
              deleteConfirmId === job.id
            }
            onDeleteClick={handleDeleteClick}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteCancel={handleDeleteCancel}
          />
        ))}
      </div>
    </div>
  );
}

interface JobCardProps {
  job: JobResponse;
  isDeleteConfirm: boolean;
  isDeleting: boolean;
  onDeleteClick: (e: React.MouseEvent, id: string) => void;
  onDeleteConfirm: (e: React.MouseEvent) => void;
  onDeleteCancel: (e: React.MouseEvent) => void;
}

function JobCard({
  job,
  isDeleteConfirm,
  isDeleting,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: JobCardProps) {
  const statusInfo = getStatusInfo(job.status);
  const isActive = job.status === "PENDING" || job.status === "PROCESSING";

  return (
    <a
      href={`/jobs/${job.id}`}
      className="block bg-dark-900 border border-dark-800 rounded-lg p-5 hover:border-primary-600/50 transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center group-hover:bg-primary-600/10 transition-colors">
          <FileAudio className="h-5 w-5 text-gray-500 group-hover:text-primary-400 transition-colors" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white truncate">
                {job.name}
              </h3>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {job.file_name} &middot; {formatFileSize(job.file_size)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={statusInfo.variant} dot>
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          {/* Progress bar for active jobs */}
          {isActive && (
            <div className="mt-3">
              <ProgressBar
                value={job.progress}
                size="sm"
                showLabel
                color={job.status === "PENDING" ? "yellow" : "blue"}
                label={job.current_step ?? undefined}
              />
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            {job.duration_seconds !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(job.duration_seconds)}
              </span>
            )}
            <span>{formatRelativeTime(job.created_at)}</span>
            {job.status === "COMPLETED" && (
              <span>
                {job.segment_count} segment &middot; {job.word_count} ord
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <Button
                variant="danger"
                size="sm"
                onClick={onDeleteConfirm}
                loading={isDeleting}
              >
                Ta bort
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeleteCancel}
              >
                Avbryt
              </Button>
            </div>
          ) : (
            <button
              onClick={(e) => onDeleteClick(e, job.id)}
              className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Ta bort"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-primary-400 transition-colors" />
        </div>
      </div>
    </a>
  );
}
