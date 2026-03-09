"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, Globe, Info } from "lucide-react";
import type { TranscriptionEngine, TemplateResponse } from "@/types";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { AudioPreview } from "@/components/upload/AudioPreview";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import { ModelSelector } from "@/components/upload/ModelSelector";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  uploadFileWithProgress,
  createJob,
  getAnonymizeStatus,
  listTemplates,
} from "@/services/api";
import { getModelsForEngine, NER_ENTITY_TYPES } from "@/utils/format";

type UploadStep = "idle" | "uploading" | "creating" | "done" | "error";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<TranscriptionEngine>("faster-whisper");
  const [model, setModel] = useState("KBLab/kb-whisper-small");
  const [language] = useState("sv");
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [enableAnonymization, setEnableAnonymization] = useState(false);
  const [nerEntityTypes, setNerEntityTypes] = useState<string[]>(
    NER_ENTITY_TYPES.map((t) => t.id)
  );
  const [nerAvailable, setNerAvailable] = useState<boolean | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = step === "uploading" || step === "creating";

  useEffect(() => {
    getAnonymizeStatus()
      .then((status) => setNerAvailable(status.ner_available))
      .catch(() => setNerAvailable(false));
    listTemplates()
      .then((res) => setTemplates(res.templates))
      .catch(() => {});
  }, []);

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
        engine,
        model,
        language,
        enable_diarization: enableDiarization,
        enable_anonymization: enableAnonymization,
        ner_entity_types:
          enableAnonymization && nerEntityTypes.length < NER_ENTITY_TYPES.length
            ? nerEntityTypes.join(",")
            : undefined,
        anonymize_template_id:
          enableAnonymization && selectedTemplateId
            ? selectedTemplateId
            : undefined,
      });

      setStep("done");
      // Full page load — Next.js static export can't client-route dynamic /jobs/[id]
      window.location.href = `/jobs/${job.id}`;
    } catch (err: unknown) {
      setStep("error");
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Ett oväntat fel uppstod. Försök igen.");
      }
    }
  }, [file, name, engine, model, language, enableDiarization, enableAnonymization, nerEntityTypes, selectedTemplateId]);

  const handleEngineChange = useCallback(
    (newEngine: TranscriptionEngine) => {
      setEngine(newEngine);
      // Auto-select first model for the new engine
      const models = getModelsForEngine(newEngine);
      const currentModelExists = models.some((m) => m.id === model);
      if (!currentModelExists && models.length > 0) {
        setModel(models[2]?.id ?? models[0].id); // Default to "small" (index 2) or first
      }
    },
    [model]
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Ny transkription
        </h2>
        <p className="text-gray-400">
          Ladda upp en ljudfil för att transkribera den med KB-Whisper. All
          bearbetning sker lokalt.
        </p>
      </div>

      <div className="space-y-8">
        {/* Record audio */}
        <section>
          <AudioRecorder
            onRecordingComplete={setFile}
            disabled={isSubmitting}
          />
        </section>

        {/* Divider between recorder and dropzone */}
        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-dark-800" />
          <span className="text-xs text-gray-600 uppercase tracking-wider">eller</span>
          <div className="flex-1 border-t border-dark-800" />
        </div>

        {/* File upload */}
        <section>
          <FileDropzone
            file={file}
            onFileSelect={setFile}
            onFileClear={() => setFile(null)}
            disabled={isSubmitting}
          />
        </section>

        {/* Audio preview — shown when a file is selected */}
        {file && (
          <section>
            <AudioPreview file={file} />
          </section>
        )}

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
            engine={engine}
            model={model}
            onEngineChange={handleEngineChange}
            onModelChange={setModel}
            disabled={isSubmitting}
          />
        </section>

        {/* Language */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-200">Språk</label>
          </div>
          <div className="bg-dark-900 border border-dark-800 rounded-lg px-4 py-2.5 text-sm text-gray-300">
            Svenska (sv)
          </div>
          <p className="text-xs text-gray-600 mt-1">
            KB-Whisper är optimerad för svenska.
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

          {/* NER entity type selection — shown when anonymization is enabled */}
          {enableAnonymization && (
            <div className="ml-10 space-y-2">
              {nerAvailable === false && (
                <div className="flex items-start gap-2 p-2.5 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
                  <Info className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">
                    AI-baserad NER (KB-BERT) är inte tillgänglig.
                    Mönsterbaserad anonymisering används istället.
                  </p>
                </div>
              )}
              {nerAvailable && (
                <>
                  <p className="text-xs text-gray-500">
                    Välj vilka entitetstyper som ska anonymiseras:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {NER_ENTITY_TYPES.map((type) => {
                      const checked = nerEntityTypes.includes(type.id);
                      return (
                        <label
                          key={type.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-dark-800 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSubmitting}
                            onChange={() => {
                              setNerEntityTypes((prev) =>
                                checked
                                  ? prev.filter((t) => t !== type.id)
                                  : [...prev, type.id]
                              );
                            }}
                            className="rounded border-gray-600 bg-dark-900 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 h-3.5 w-3.5"
                          />
                          <span className="text-xs text-gray-300" title={type.description}>
                            {type.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Template selector */}
              {templates.length > 0 && (
                <div className="pt-2 mt-2 border-t border-dark-800">
                  <p className="text-xs text-gray-500 mb-1.5">
                    Ordmall för avidentifiering:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setSelectedTemplateId(null)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        !selectedTemplateId
                          ? "bg-primary-600/10 border-primary-600/40 text-white"
                          : "bg-dark-900 border-dark-800 text-gray-400 hover:border-primary-600/30"
                      }`}
                    >
                      Ingen
                    </button>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          selectedTemplateId === t.id
                            ? "bg-primary-600/10 border-primary-600/40 text-white"
                            : "bg-dark-900 border-dark-800 text-gray-400 hover:border-primary-600/30"
                        }`}
                      >
                        {t.name}
                        <span className="text-gray-600 ml-1">
                          ({t.words.length})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
