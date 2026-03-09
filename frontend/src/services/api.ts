import axios from "axios";
import type {
  JobResponse,
  JobListResponse,
  UploadResponse,
  TranscriptResponse,
  SegmentResponse,
  AnonymizeRequest,
  AnonymizeResponse,
  AnonymizeStatusResponse,
  JobAnonymizationResponse,
  EngineListResponse,
  TranscriptionEngine,
  TemplateListResponse,
  TemplateResponse,
  WordReplacement,
  OcrResponse,
  OcrAnonymizeResponse,
  OcrStatusResponse,
} from "@/types";

const api = axios.create({
  baseURL: "/api/v1",
});

// Upload
export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteUpload = async (fileId: string): Promise<void> => {
  await api.delete(`/upload/${fileId}`);
};

// Jobs
export const createJob = async (params: {
  file_path: string;
  name?: string;
  engine?: TranscriptionEngine;
  model?: string;
  language?: string;
  enable_diarization?: boolean;
  enable_anonymization?: boolean;
  ner_entity_types?: string;
  anonymize_template_id?: string;
}): Promise<JobResponse> => {
  const { data } = await api.post<JobResponse>("/jobs", params);
  return data;
};

export const listJobs = async (
  skip = 0,
  limit = 20
): Promise<JobListResponse> => {
  const { data } = await api.get<JobListResponse>("/jobs", {
    params: { skip, limit },
  });
  return data;
};

export const getJob = async (id: string): Promise<JobResponse> => {
  const { data } = await api.get<JobResponse>(`/jobs/${id}`);
  return data;
};

export const updateJob = async (
  id: string,
  name: string
): Promise<JobResponse> => {
  const { data } = await api.patch<JobResponse>(`/jobs/${id}`, { name });
  return data;
};

export const deleteJob = async (id: string): Promise<void> => {
  await api.delete(`/jobs/${id}`);
};

// Transcript
export const getTranscript = async (
  jobId: string
): Promise<TranscriptResponse> => {
  const { data } = await api.get<TranscriptResponse>(
    `/jobs/${jobId}/transcript`
  );
  return data;
};

// Export
export const exportTranscript = async (
  jobId: string,
  format: "txt" | "md" | "json" | "srt" | "vtt",
  anonymized = false
): Promise<string> => {
  const { data } = await api.get(`/jobs/${jobId}/export`, {
    params: { format, anonymized },
    responseType: "text",
  });
  return data;
};

// Upload with progress tracking
export const uploadFileWithProgress = async (
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return data;
};

// Segments
export const updateSegment = async (
  jobId: string,
  segmentId: number,
  updates: { text?: string; speaker?: string }
): Promise<SegmentResponse> => {
  const { data } = await api.patch<SegmentResponse>(
    `/jobs/${jobId}/segments/${segmentId}`,
    updates
  );
  return data;
};

// Speaker rename
export const renameSpeaker = async (
  jobId: string,
  oldName: string,
  newName: string
): Promise<{ updated_count: number }> => {
  const { data } = await api.post<{ updated_count: number }>(
    `/jobs/${jobId}/speakers/rename`,
    { old_name: oldName, new_name: newName }
  );
  return data;
};

// Anonymize
export const anonymizeText = async (
  request: AnonymizeRequest
): Promise<AnonymizeResponse> => {
  const { data } = await api.post<AnonymizeResponse>("/anonymize", request);
  return data;
};

// Anonymize status (NER availability)
export const getAnonymizeStatus =
  async (): Promise<AnonymizeStatusResponse> => {
    const { data } = await api.get<AnonymizeStatusResponse>(
      "/anonymize/status"
    );
    return data;
  };

// Run NER + patterns anonymization on a completed job
export const runAnonymization = async (
  jobId: string,
  params?: { entity_types?: string[]; pattern_types?: string[] }
): Promise<JobAnonymizationResponse> => {
  const { data } = await api.post<JobAnonymizationResponse>(
    `/jobs/${jobId}/run-anonymization`,
    params ?? {}
  );
  return data;
};

// Run patterns-only anonymization on a completed job
export const enhanceAnonymization = async (
  jobId: string,
  params?: { pattern_types?: string[] }
): Promise<JobAnonymizationResponse> => {
  const { data } = await api.post<JobAnonymizationResponse>(
    `/jobs/${jobId}/enhance-anonymization`,
    params ?? {}
  );
  return data;
};

// Audio file URL
export const getAudioUrl = (jobId: string): string =>
  `/api/v1/jobs/${jobId}/audio`;

// Templates
export const listTemplates = async (): Promise<TemplateListResponse> => {
  const { data } = await api.get<TemplateListResponse>("/templates");
  return data;
};

export const createTemplate = async (params: {
  name: string;
  description?: string;
  words: WordReplacement[];
}): Promise<TemplateResponse> => {
  const { data } = await api.post<TemplateResponse>("/templates", params);
  return data;
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await api.delete(`/templates/${id}`);
};

// Apply custom words to a completed job
export const applyCustomWords = async (
  jobId: string,
  params: {
    template_id?: string;
    custom_words?: WordReplacement[];
  }
): Promise<JobAnonymizationResponse> => {
  const { data } = await api.post<JobAnonymizationResponse>(
    `/jobs/${jobId}/apply-custom-words`,
    params
  );
  return data;
};

// Engines
export const listEngines = async (): Promise<EngineListResponse> => {
  const { data } = await api.get<EngineListResponse>("/models/engines");
  return data;
};

// OCR
export const ocrExtractText = async (file: File): Promise<OcrResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<OcrResponse>("/ocr", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const ocrExtractAndAnonymize = async (
  file: File,
  params?: {
    use_ner?: boolean;
    use_patterns?: boolean;
    entity_types?: string[];
    pattern_types?: string[];
  }
): Promise<OcrAnonymizeResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  if (params?.use_ner !== undefined)
    formData.append("use_ner", String(params.use_ner));
  if (params?.use_patterns !== undefined)
    formData.append("use_patterns", String(params.use_patterns));
  if (params?.entity_types)
    formData.append("entity_types", JSON.stringify(params.entity_types));
  if (params?.pattern_types)
    formData.append("pattern_types", JSON.stringify(params.pattern_types));
  const { data } = await api.post<OcrAnonymizeResponse>(
    "/ocr/anonymize",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

export const getOcrStatus = async (): Promise<OcrStatusResponse> => {
  const { data } = await api.get<OcrStatusResponse>("/ocr/status");
  return data;
};

export default api;
