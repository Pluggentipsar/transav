"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Upload,
  List,
  ShieldCheck,
  FileAudio,
  Clock,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { listJobs } from "@/services/api";
import { Badge } from "@/components/ui/Badge";
import {
  formatDuration,
  formatRelativeTime,
  getStatusInfo,
} from "@/utils/format";
import type { JobResponse } from "@/types";

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(0, 100),
    retry: false,
  });

  const jobs = data?.jobs ?? [];
  const recentJobs = jobs.slice(0, 5);
  const completedCount = jobs.filter((j) => j.status === "COMPLETED").length;
  const processingCount = jobs.filter(
    (j) => j.status === "PENDING" || j.status === "PROCESSING"
  ).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-white mb-4">
          Välkommen till TystText
        </h2>
        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          Transkribera intervjuer lokalt med svensk AI. All data stannar på din
          dator.
        </p>
      </div>

      {/* Stats */}
      {!isLoading && jobs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<FileAudio className="h-5 w-5 text-primary-400" />}
            label="Totalt"
            value={`${jobs.length}`}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
            label="Klara"
            value={`${completedCount}`}
          />
          <StatCard
            icon={<Loader2 className="h-5 w-5 text-blue-400" />}
            label="Pågående"
            value={`${processingCount}`}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/upload"
          className="bg-dark-900 border border-dark-800 rounded-lg p-6 hover:border-primary-600 transition-all duration-200 group"
        >
          <Upload className="h-8 w-8 text-primary-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-primary-400 mb-1">
            Ny transkription
          </h3>
          <p className="text-gray-400 text-sm">
            Ladda upp en ljudfil och transkribera den med KB-Whisper.
          </p>
        </Link>

        <Link
          href="/jobs"
          className="bg-dark-900 border border-dark-800 rounded-lg p-6 hover:border-primary-600 transition-all duration-200 group"
        >
          <List className="h-8 w-8 text-primary-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-primary-400 mb-1">
            Mina transkriptioner
          </h3>
          <p className="text-gray-400 text-sm">
            Se och hantera dina tidigare transkriptioner.
          </p>
        </Link>

        <Link
          href="/anonymize"
          className="bg-dark-900 border border-dark-800 rounded-lg p-6 hover:border-primary-600 transition-all duration-200 group"
        >
          <ShieldCheck className="h-8 w-8 text-primary-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-primary-400 mb-1">
            Anonymisera text
          </h3>
          <p className="text-gray-400 text-sm">
            Anonymisera godtycklig text med AI och mönstermatchning.
          </p>
        </Link>
      </div>

      {/* Recent jobs */}
      {!isLoading && recentJobs.length > 0 && (
        <div className="bg-dark-900 border border-dark-800 rounded-lg">
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <h3 className="text-sm font-medium text-gray-200">
              Senaste transkriptioner
            </h3>
            <Link
              href="/jobs"
              className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              Visa alla
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-dark-800">
            {recentJobs.map((job) => (
              <RecentJobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-4 flex items-center gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function RecentJobRow({ job }: { job: JobResponse }) {
  const statusInfo = getStatusInfo(job.status);
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-4 p-4 hover:bg-dark-800/50 transition-colors group"
    >
      <div className="flex-shrink-0">
        <FileAudio className="h-5 w-5 text-gray-500 group-hover:text-primary-400 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">
          {job.name}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
          <span>{formatRelativeTime(job.created_at)}</span>
          {job.duration_seconds !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(job.duration_seconds)}
            </span>
          )}
        </div>
      </div>
      <Badge variant={statusInfo.variant} dot>
        {statusInfo.label}
      </Badge>
      <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-primary-400 transition-colors flex-shrink-0" />
    </Link>
  );
}
