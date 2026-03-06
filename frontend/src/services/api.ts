import axios from "axios";
import type {
  JobResponse,
  JobListResponse,
  UploadResponse,
  TranscriptResponse,
  SegmentResponse,
  AnonymizeRequest,
  AnonymizeResponse,
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
  model?: string;
  language?: string;
  enable_diarization?: boolean;
  enable_anonymization?: boolean;
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

// Anonymize job transcript
export const anonymizeJob = async (
  jobId: string
): Promise<{ updated_count: number }> => {
  const { data } = await api.post<{ updated_count: number }>(
    `/jobs/${jobId}/anonymize`
  );
  return data;
};

// Audio file URL
export const getAudioUrl = (jobId: string): string =>
  `/api/v1/jobs/${jobId}/audio`;

export default api;
