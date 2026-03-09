"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ScanText,
  AlertCircle,
  Copy,
  Check,
  FileImage,
  ShieldCheck,
  FileText,
  FileType,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { AnonymizedOutput } from "@/components/anonymize/AnonymizedOutput";
import { EntityStats } from "@/components/anonymize/EntityStats";
import { ocrExtractText, ocrExtractAndAnonymize } from "@/services/api";
import {
  ACCEPTED_OCR_FORMATS,
  NER_ENTITY_TYPES,
  PATTERN_CATEGORIES,
} from "@/utils/format";
import type { OcrResponse, OcrAnonymizeResponse } from "@/types";

export default function OcrPage() {
  const [file, setFile] = useState<File | null>(null);
  const [outputText, setOutputText] = useState("");
  const [enableAnonymize, setEnableAnonymize] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [entitiesFound, setEntitiesFound] = useState<number | null>(null);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});

  // Anonymization settings
  const [useNer, setUseNer] = useState(true);
  const [usePatterns, setUsePatterns] = useState(true);
  const [nerEntityTypes, setNerEntityTypes] = useState<string[]>(
    NER_ENTITY_TYPES.map((e) => e.id)
  );
  const [patternTypes, setPatternTypes] = useState<string[]>(
    PATTERN_CATEGORIES.map((p) => p.id)
  );

  const ocrMutation = useMutation({
    mutationFn: ocrExtractText,
    onSuccess: (data: OcrResponse) => {
      setOutputText(data.full_text);
      setPageCount(data.total_pages);
      setEntitiesFound(null);
      setEntityCounts({});
    },
  });

  const ocrAnonymizeMutation = useMutation({
    mutationFn: (f: File) =>
      ocrExtractAndAnonymize(f, {
        use_ner: useNer,
        use_patterns: usePatterns,
        entity_types: useNer ? nerEntityTypes : undefined,
        pattern_types: usePatterns ? patternTypes : undefined,
      }),
    onSuccess: (data: OcrAnonymizeResponse) => {
      setOutputText(data.anonymized_text);
      setPageCount(data.total_pages);
      setEntitiesFound(data.entities_found);
      setEntityCounts(data.entity_counts ?? {});
    },
  });

  const isPending = ocrMutation.isPending || ocrAnonymizeMutation.isPending;
  const isError = ocrMutation.isError || ocrAnonymizeMutation.isError;

  const handleExtract = useCallback(() => {
    if (!file) return;
    setOutputText("");
    setPageCount(null);
    setEntitiesFound(null);
    setEntityCounts({});
    if (enableAnonymize) {
      ocrAnonymizeMutation.mutate(file);
    } else {
      ocrMutation.mutate(file);
    }
  }, [file, enableAnonymize, ocrMutation, ocrAnonymizeMutation]);

  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [outputText]);

  const handleDownloadTxt = useCallback(() => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr-text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputText]);

  const handleDownloadDoc = useCallback(() => {
    if (!outputText) return;
    const htmlContent = outputText
      .split("\n")
      .map((line) => `<p>${line || "&nbsp;"}</p>`)
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>OCR-text</title></head><body style="font-family: Calibri, sans-serif; font-size: 11pt;">${htmlContent}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr-text.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputText]);

  const handleFileClear = useCallback(() => {
    setFile(null);
    setOutputText("");
    setPageCount(null);
    setEntitiesFound(null);
    setEntityCounts({});
  }, []);

  const toggleEntityType = useCallback((id: string) => {
    setNerEntityTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const togglePatternType = useCallback((id: string) => {
    setPatternTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ScanText className="h-6 w-6 text-primary-400" />
          <h2 className="text-2xl font-bold text-white">OCR - Textutvinning</h2>
        </div>
        <p className="text-gray-400">
          Ladda upp en bild eller PDF och extrahera text med lokal OCR.
          Stödjer svenska och engelska. All processning sker lokalt.
        </p>
      </div>

      {/* File upload */}
      <div className="mb-6">
        <FileDropzone
          file={file}
          onFileSelect={setFile}
          onFileClear={handleFileClear}
          disabled={isPending}
          accept={ACCEPTED_OCR_FORMATS}
          dropLabel="Dra och släpp en bild eller PDF här"
          dropSublabel="eller klicka för att välja fil"
          formatLabel=".png, .jpg, .tiff, .bmp, .webp, .pdf"
          fileIcon={<FileImage className="h-6 w-6 text-primary-400" />}
        />
      </div>

      {/* Settings */}
      <div className="bg-dark-900 border border-dark-800 rounded-lg p-5 mb-6 space-y-4">
        <Toggle
          checked={enableAnonymize}
          onChange={setEnableAnonymize}
          label="Anonymisera resultat"
          description="Kör anonymisering på den extraherade texten"
          disabled={isPending}
        />

        {enableAnonymize && (
          <>
            {/* NER section */}
            <div>
              <Toggle
                checked={useNer}
                onChange={setUseNer}
                label="AI-baserad NER"
                description="Identifiera namngivna entiteter med maskininlärning"
                disabled={isPending}
              />
              {useNer && (
                <div className="mt-3 ml-14">
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    {NER_ENTITY_TYPES.map((etype) => {
                      const selected = nerEntityTypes.includes(etype.id);
                      return (
                        <button
                          key={etype.id}
                          onClick={() => toggleEntityType(etype.id)}
                          disabled={isPending}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            selected
                              ? "bg-primary-600/20 text-primary-300 border-primary-600/40"
                              : "bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300"
                          } disabled:opacity-50`}
                          title={etype.description}
                        >
                          {etype.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() =>
                        setNerEntityTypes(NER_ENTITY_TYPES.map((e) => e.id))
                      }
                      className="text-gray-500 hover:text-primary-400 transition-colors"
                    >
                      Alla
                    </button>
                    <span className="text-gray-700">|</span>
                    <button
                      onClick={() => setNerEntityTypes([])}
                      className="text-gray-500 hover:text-primary-400 transition-colors"
                    >
                      Inga
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Patterns section */}
            <div>
              <Toggle
                checked={usePatterns}
                onChange={setUsePatterns}
                label="Mönstermatchning"
                description="Hitta personnummer, telefonnummer, e-post m.m."
                disabled={isPending}
              />
              {usePatterns && (
                <div className="mt-3 ml-14">
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    {PATTERN_CATEGORIES.map((cat) => {
                      const selected = patternTypes.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => togglePatternType(cat.id)}
                          disabled={isPending}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            selected
                              ? "bg-primary-600/20 text-primary-300 border-primary-600/40"
                              : "bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300"
                          } disabled:opacity-50`}
                          title={cat.description}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() =>
                        setPatternTypes(PATTERN_CATEGORIES.map((p) => p.id))
                      }
                      className="text-gray-500 hover:text-primary-400 transition-colors"
                    >
                      Alla
                    </button>
                    <span className="text-gray-700">|</span>
                    <button
                      onClick={() => setPatternTypes([])}
                      className="text-gray-500 hover:text-primary-400 transition-colors"
                    >
                      Inga
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Output */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">
            Extraherad text
          </label>
          {outputText && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
                title="Kopiera till urklipp"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Kopierad
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Kopiera
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
                title="Ladda ner som textfil"
              >
                <FileText className="h-3 w-3" />
                .txt
              </button>
              <button
                onClick={handleDownloadDoc}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
                title="Ladda ner som Word-dokument"
              >
                <FileType className="h-3 w-3" />
                .doc
              </button>
            </div>
          )}
        </div>
        <div className="w-full h-80 bg-dark-900 border border-dark-800 rounded-lg px-4 py-3 text-sm overflow-y-auto">
          {isPending ? (
            <div className="flex items-center gap-2 text-gray-500 h-full justify-center">
              <svg
                className="animate-spin h-4 w-4"
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
              {enableAnonymize
                ? "Extraherar och anonymiserar..."
                : "Extraherar text..."}
            </div>
          ) : outputText ? (
            enableAnonymize && entitiesFound !== null ? (
              <AnonymizedOutput
                text={outputText}
                className="text-gray-200 leading-relaxed"
              />
            ) : (
              <p className="text-gray-200 whitespace-pre-wrap">{outputText}</p>
            )
          ) : (
            <p className="text-gray-600 italic">
              Extraherad text visas här...
            </p>
          )}
        </div>
        {pageCount !== null && (
          <div>
            <p className="text-xs text-gray-600 mt-1">
              {pageCount} sida{pageCount !== 1 ? "or" : ""} bearbetade
              {entitiesFound !== null && (
                <>
                  {" "}
                  &middot; {entitiesFound} entitet
                  {entitiesFound !== 1 ? "er" : ""} anonymiserade
                </>
              )}
            </p>
            {Object.keys(entityCounts).length > 0 && (
              <EntityStats entityCounts={entityCounts} />
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {isError && (
        <div className="mb-6 bg-red-600/10 border border-red-600/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400">
              Textutvinningen misslyckades
            </p>
            <p className="text-xs text-red-400/70 mt-1">
              Kontrollera att backend-servern är igång och att EasyOCR är
              installerat.
            </p>
          </div>
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={handleExtract}
        disabled={!file}
        loading={isPending}
        icon={
          enableAnonymize ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <ScanText className="h-5 w-5" />
          )
        }
        size="lg"
        className="w-full md:w-auto"
      >
        {enableAnonymize ? "Extrahera & anonymisera" : "Extrahera text"}
      </Button>
    </div>
  );
}
