"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe } from "lucide-react";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { ModelSelector } from "@/components/upload/ModelSelector";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { uploadFileWithProgress, createJob } from "@/services/api";

type UploadStep = "idle" | "uploading" | "creating" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [model, setModel] = useState("KBLab/kb-whisper-small");
  const [language] = useState("sv");
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [enableAnonymization, setEnableAnonymization] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = step === "uploading" || step === "creating";

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    setErrorMessage(null);
    setStep("uploading");
    setUploadProgress(0);

    try {
      // Step 1: Upload file
      const uploadResult = await uploadFileWithProgress(file, setUploadProgress);

      // Step 2: Create job
      setStep("creating");
      const job = await createJob({
        file_path: uploadResult.file_path,
        name: name.trim() || undefined,
        model,
        language,
        enable_diarization: enableDiarization,
        enable_anonymization: enableAnonymization,
      });

      setStep("done");
      router.push(`/jobs/${job.id}`);
    } catch (err: unknown) {
      setStep("error");
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Ett ovantad fel uppstod. Forsok igen.");
      }
    }
  }, [file, name, model, language, enableDiarization, enableAnonymization, router]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Ny transkription
        </h2>
        <p className="text-gray-400">
          Ladda upp en ljudfil for att transkribera den med KB-Whisper. All
          bearbetning sker lokalt.
        </p>
      </div>

      <div className="space-y-8">
        {/* File upload */}
        <section>
          <FileDropzone
            file={file}
            onFileSelect={setFile}
            onFileClear={() => setFile(null)}
            disabled={isSubmitting}
          />
        </section>

        {/* Job name */}
        <section>
          <label
            htmlFor="job-name"
            className="block text-sm font-medium text-gray-200 mb-2"
          >
            Namn (valfritt)
          </label>
          <input
            id="job-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "Intervju 2024-01-15"}
            disabled={isSubmitting}
            className="w-full bg-dark-900 border border-dark-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50"
          />
        </section>

        {/* Model selector */}
        <section>
          <ModelSelector
            value={model}
            onChange={setModel}
            disabled={isSubmitting}
          />
        </section>

        {/* Language */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-200">Sprak</label>
          </div>
          <div className="bg-dark-900 border border-dark-800 rounded-lg px-4 py-2.5 text-sm text-gray-300">
            Svenska (sv)
          </div>
          <p className="text-xs text-gray-600 mt-1">
            KB-Whisper ar optimerad for svenska.
          </p>
        </section>

        {/* Toggles */}
        <section className="space-y-4">
          <Toggle
            checked={enableDiarization}
            onChange={setEnableDiarization}
            label="Talaridentifiering"
            description="Identifiera och separera olika talare i inspelningen"
            disabled={isSubmitting}
          />
          <Toggle
            checked={enableAnonymization}
            onChange={setEnableAnonymization}
            label="Automatisk anonymisering"
            description="Anonymisera personuppgifter efter transkription"
            disabled={isSubmitting}
          />
        </section>

        {/* Upload progress */}
        {step === "uploading" && (
          <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
            <ProgressBar
              value={uploadProgress}
              label="Laddar upp fil..."
              color="primary"
            />
          </div>
        )}

        {step === "creating" && (
          <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg
                className="animate-spin h-4 w-4 text-primary-400"
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
              <span className="text-sm text-gray-300">
                Skapar transkriptionsjobb...
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4">
            <p className="text-sm text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!file || isSubmitting}
          loading={isSubmitting}
          size="lg"
          className="w-full"
          icon={<Upload className="h-5 w-5" />}
        >
          {isSubmitting ? "Bearbetar..." : "Starta transkription"}
        </Button>
      </div>
    </div>
  );
}
