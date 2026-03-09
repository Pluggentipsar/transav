/** Transcription engine */
export type TranscriptionEngine = "faster-whisper" | "easytranscriber";

/** Engine option for selection */
export interface EngineOption {
  id: TranscriptionEngine;
  name: string;
  description: string;
  available: boolean;
  models: ModelOption[];
}

/** Engine list response from API */
export interface EngineListResponse {
  engines: EngineOption[];
  default_engine: TranscriptionEngine;
}

/** Transcription job */
export interface JobResponse {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  duration_seconds: number | null;
  engine: TranscriptionEngine;
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

/** Word replacement for custom anonymization */
export interface WordReplacement {
  original: string;
  replacement: string;
}

/** Word replacement template */
export interface TemplateResponse {
  id: string;
  name: string;
  description: string | null;
  words: WordReplacement[];
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  templates: TemplateResponse[];
  total: number;
}

/** Anonymize */
export interface AnonymizeRequest {
  text: string;
  use_ner?: boolean;
  use_patterns?: boolean;
  entity_types?: string[];
  pattern_types?: string[];
  custom_words?: WordReplacement[];
}

export interface AnonymizeResponse {
  original_text: string;
  anonymized_text: string;
  entities_found: number;
  entity_counts: Record<string, number>;
}

export interface AnonymizeStatusResponse {
  ner_available: boolean;
  ner_model: string;
  patterns_available: boolean;
  pattern_count: number;
}

export interface JobAnonymizationResponse {
  job_id: string;
  segments_processed: number;
  total_entities_found: number;
  message: string;
  entity_counts: Record<string, number>;
}

/** NER entity type for KB-BERT */
export interface NerEntityType {
  id: string;
  label: string;
  description: string;
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

/** OCR page result */
export interface OcrPageResponse {
  page_number: number;
  text: string;
  confidence: number;
}

/** OCR response */
export interface OcrResponse {
  file_name: string;
  full_text: string;
  pages: OcrPageResponse[];
  total_pages: number;
  average_confidence: number;
}

/** OCR + anonymization response */
export interface OcrAnonymizeResponse {
  file_name: string;
  original_text: string;
  anonymized_text: string;
  total_pages: number;
  entities_found: number;
  entity_counts: Record<string, number>;
}

/** OCR status response */
export interface OcrStatusResponse {
  ocr_available: boolean;
  pdf_available: boolean;
  supported_languages: string[];
  supported_formats: string[];
}
