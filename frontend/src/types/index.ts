/** Transcription job */
export interface JobResponse {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  duration_seconds: number | null;
  model: string;
  language: string;
  enable_diarization: boolean;
  enable_anonymization: boolean;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  current_step: string | null;
  error_message: string | null;
  speaker_count: number;
  word_count: number;
  segment_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobListResponse {
  jobs: JobResponse[];
  total: number;
}

/** Upload */
export interface UploadResponse {
  file_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
}

/** Segment */
export interface SegmentResponse {
  id: number;
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
  anonymized_text: string | null;
  speaker: string | null;
  confidence: number | null;
}

/** Word */
export interface WordResponse {
  id: number;
  word_index: number;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number | null;
  included: boolean;
}

/** Transcript */
export interface TranscriptResponse {
  job_id: string;
  segments: SegmentResponse[];
  total_segments: number;
}

/** Anonymize */
export interface AnonymizeRequest {
  text: string;
  enable_ner?: boolean;
  enable_patterns?: boolean;
}

export interface AnonymizeResponse {
  original_text: string;
  anonymized_text: string;
  entities_found: number;
}

/** Job status type */
export type JobStatus = JobResponse["status"];

/** Model option for KB-Whisper */
export interface ModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

/** Export format */
export type ExportFormat = "txt" | "md" | "json" | "srt" | "vtt";
