"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileAudio, X } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { ACCEPTED_AUDIO_FORMATS, formatFileSize } from "@/utils/format";

interface FileDropzoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
  disabled?: boolean;
}

export function FileDropzone({
  file,
  onFileSelect,
  onFileClear,
  disabled = false,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        return;
      }
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_AUDIO_FORMATS,
      maxFiles: 1,
      disabled,
    });

  const rejectionMessage =
    fileRejections.length > 0
      ? "Ogiltigt filformat. Accepterade format: .mp3, .wav, .m4a, .ogg, .flac, .webm"
      : null;

  if (file) {
    return (
      <div className="bg-dark-900 border border-primary-600/30 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-600/15 flex items-center justify-center">
            <FileAudio className="h-6 w-6 text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {file.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatFileSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileClear();
            }}
            disabled={disabled}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Ta bort fil"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={twMerge(
          "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-primary-400 bg-primary-600/10"
            : "border-dark-800 hover:border-primary-600/50 hover:bg-dark-900/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload
          className={twMerge(
            "h-10 w-10 mx-auto mb-4 transition-colors",
            isDragActive ? "text-primary-400" : "text-gray-500"
          )}
        />
        {isDragActive ? (
          <p className="text-primary-400 font-medium">
            Slapp filen har...
          </p>
        ) : (
          <>
            <p className="text-gray-300 font-medium mb-1">
              Dra och slapp en ljudfil har
            </p>
            <p className="text-gray-500 text-sm">
              eller klicka for att valja fil
            </p>
          </>
        )}
        <p className="text-gray-600 text-xs mt-3">
          .mp3, .wav, .m4a, .ogg, .flac, .webm
        </p>
      </div>
      {rejectionMessage && (
        <p className="text-red-400 text-sm mt-2">{rejectionMessage}</p>
      )}
    </div>
  );
}
