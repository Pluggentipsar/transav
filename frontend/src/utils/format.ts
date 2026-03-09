import type { JobStatus, ModelOption, NerEntityType, TranscriptionEngine } from "@/types";

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
      return { label: "Väntar", variant: "warning" };
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
    description: "Snabbast, lägst kvalitet",
  },
  {
    id: "KBLab/kb-whisper-base",
    label: "Base",
    size: "~150 MB",
    description: "Snabb, grundläggande kvalitet",
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
    description: "Hög kvalitet, långsammare",
  },
  {
    id: "KBLab/kb-whisper-large",
    label: "Large",
    size: "~3 GB",
    description: "Bäst kvalitet, långsammast",
  },
];

/** Available models for easytranscriber (same KB-Whisper models) */
export const EASY_TRANSCRIBER_MODEL_OPTIONS: ModelOption[] = [
  {
    id: "KBLab/kb-whisper-tiny",
    label: "Tiny",
    size: "~75 MB",
    description: "Snabbast, lägst kvalitet",
  },
  {
    id: "KBLab/kb-whisper-base",
    label: "Base",
    size: "~150 MB",
    description: "Snabb, grundläggande kvalitet",
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
    description: "Hög kvalitet, långsammare",
  },
  {
    id: "KBLab/kb-whisper-large",
    label: "Large",
    size: "~3 GB",
    description: "Bäst kvalitet, långsammast",
  },
];

/** Engine options */
export const ENGINE_OPTIONS: {
  id: TranscriptionEngine;
  label: string;
  description: string;
}[] = [
  {
    id: "faster-whisper",
    label: "Faster-Whisper",
    description: "Standard CTranslate2-motor. Stabil och vältestad.",
  },
  {
    id: "easytranscriber",
    label: "EasyTranscriber",
    description: "Snabbare pipeline med bättre ordtidsstämplar.",
  },
];

/** Get model options for a given engine */
export function getModelsForEngine(engine: TranscriptionEngine): ModelOption[] {
  switch (engine) {
    case "easytranscriber":
      return EASY_TRANSCRIBER_MODEL_OPTIONS;
    case "faster-whisper":
    default:
      return MODEL_OPTIONS;
  }
}

/** NER entity types for KB-BERT */
export const NER_ENTITY_TYPES: NerEntityType[] = [
  { id: "PER", label: "Person", description: "Personnamn" },
  { id: "LOC", label: "Plats", description: "Platser och adresser" },
  { id: "ORG", label: "Organisation", description: "Organisationer och företag" },
  { id: "TME", label: "Tid", description: "Datum och tidsuttryck" },
  { id: "EVN", label: "Händelse", description: "Namngivna händelser" },
];

/** Pattern categories for regex-based anonymization */
export interface PatternCategory {
  id: string;
  label: string;
  description: string;
}

export const PATTERN_CATEGORIES: PatternCategory[] = [
  { id: "personnummer", label: "Personnummer", description: "YYYYMMDD-XXXX" },
  { id: "telefon", label: "Telefonnummer", description: "Fasta och mobila nummer" },
  { id: "epost", label: "E-post", description: "E-postadresser" },
  { id: "postnummer", label: "Postnummer", description: "Femsiffriga postnummer" },
  { id: "datum", label: "Datum", description: "YYYY-MM-DD" },
  { id: "url", label: "URL", description: "Webblänkar" },
  { id: "regnummer", label: "Regnummer", description: "Fordonsregistrering" },
  { id: "institutioner", label: "Institutioner", description: "Skolor, sjukhus, kommuner" },
];

/** Color mapping for anonymized entity tags in output */
export const ENTITY_COLORS: Record<string, string> = {
  PERSON: "bg-red-500/20 text-red-300 border-red-500/30",
  PLATS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ORGANISATION: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  DATUM: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  HANDELSE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  PERSONNUMMER: "bg-red-600/20 text-red-300 border-red-600/30",
  TELEFONNUMMER: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "E-POST": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  POSTNUMMER: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  URL: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  REGNUMMER: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  INSTITUTION: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

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

/** Accepted image/PDF formats for OCR */
export const ACCEPTED_OCR_FORMATS: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tiff", ".tif"],
  "image/bmp": [".bmp"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
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
