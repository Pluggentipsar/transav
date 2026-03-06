import type { JobStatus, ModelOption } from "@/types";

/** Format seconds to mm:ss or hh:mm:ss */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format seconds to mm:ss.ms for timestamps */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format file size in bytes to human readable */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format date to Swedish locale */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format relative time in Swedish */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "just nu";
  if (diffMin < 60) return `${diffMin} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  return formatDate(dateString);
}

/** Status display mapping */
export function getStatusInfo(status: JobStatus): {
  label: string;
  variant: "warning" | "info" | "success" | "danger" | "default";
} {
  switch (status) {
    case "PENDING":
      return { label: "Vantar", variant: "warning" };
    case "PROCESSING":
      return { label: "Bearbetar", variant: "info" };
    case "COMPLETED":
      return { label: "Klar", variant: "success" };
    case "FAILED":
      return { label: "Misslyckades", variant: "danger" };
    case "CANCELLED":
      return { label: "Avbruten", variant: "default" };
  }
}

/** Available KB-Whisper models */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "KBLab/kb-whisper-tiny",
    label: "Tiny",
    size: "~75 MB",
    description: "Snabbast, lagst kvalitet",
  },
  {
    id: "KBLab/kb-whisper-base",
    label: "Base",
    size: "~150 MB",
    description: "Snabb, grundlaggande kvalitet",
  },
  {
    id: "KBLab/kb-whisper-small",
    label: "Small",
    size: "~500 MB",
    description: "Bra balans mellan hastighet och kvalitet",
  },
  {
    id: "KBLab/kb-whisper-medium",
    label: "Medium",
    size: "~1.5 GB",
    description: "Hog kvalitet, langsammare",
  },
  {
    id: "KBLab/kb-whisper-large",
    label: "Large",
    size: "~3 GB",
    description: "Bast kvalitet, langsammast",
  },
];

/** Accepted audio formats */
export const ACCEPTED_AUDIO_FORMATS: Record<string, string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/x-m4a": [".m4a"],
  "audio/mp4": [".m4a"],
  "audio/ogg": [".ogg"],
  "audio/flac": [".flac"],
  "audio/webm": [".webm"],
};

/** Speaker colors - consistent colors for speaker identification */
export const SPEAKER_COLORS: string[] = [
  "#2dd4bf", // teal
  "#818cf8", // indigo
  "#fb923c", // orange
  "#a78bfa", // purple
  "#34d399", // emerald
  "#f87171", // red
  "#38bdf8", // sky
  "#fbbf24", // amber
  "#c084fc", // violet
  "#4ade80", // green
];

export function getSpeakerColor(speakerIndex: number): string {
  return SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
}
