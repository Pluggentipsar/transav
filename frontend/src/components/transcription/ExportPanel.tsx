"use client";

import { useState, useCallback } from "react";
import {
  Download,
  FileText,
  FileCode,
  FileJson,
  FileType,
  Subtitles,
  Check,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { exportTranscript } from "@/services/api";
import type { ExportFormat } from "@/types";

interface ExportPanelProps {
  jobId: string;
  hasAnonymized: boolean;
}

interface FormatOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  extension: string;
}

const FORMATS: FormatOption[] = [
  {
    format: "txt",
    label: "Text",
    description: "Ren text",
    icon: <FileText className="h-4 w-4" />,
    extension: ".txt",
  },
  {
    format: "md",
    label: "Markdown",
    description: "Formaterad med talare",
    icon: <FileCode className="h-4 w-4" />,
    extension: ".md",
  },
  {
    format: "json",
    label: "JSON",
    description: "Strukturerad data",
    icon: <FileJson className="h-4 w-4" />,
    extension: ".json",
  },
  {
    format: "srt",
    label: "SRT",
    description: "Undertexter (SubRip)",
    icon: <Subtitles className="h-4 w-4" />,
    extension: ".srt",
  },
  {
    format: "vtt",
    label: "VTT",
    description: "Undertexter (WebVTT)",
    icon: <Subtitles className="h-4 w-4" />,
    extension: ".vtt",
  },
];

type CopyTarget = "copy" | "copy-original" | "copy-anonymized";

export function ExportPanel({ jobId, hasAnonymized }: ExportPanelProps) {
  const [anonymized, setAnonymized] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | "doc" | null>(null);
  const [exported, setExported] = useState<ExportFormat | "doc" | null>(null);
  const [copying, setCopying] = useState<CopyTarget | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format);
      try {
        const content = await exportTranscript(jobId, format, anonymized);

        // Create download
        const mimeType =
          format === "json" ? "application/json" : "text/plain";
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transkription-${jobId.slice(0, 8)}${
          anonymized ? "-anonymiserad" : ""
        }${FORMATS.find((f) => f.format === format)?.extension ?? ".txt"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExported(format);
        setTimeout(() => setExported(null), 2000);
      } catch {
        // Error handling - silently fail for now
      } finally {
        setExporting(null);
      }
    },
    [jobId, anonymized]
  );

  const handleExportDoc = useCallback(async () => {
    setExporting("doc");
    try {
      const content = await exportTranscript(jobId, "txt", anonymized);
      const htmlContent = content
        .split("\n")
        .map((line: string) => `<p>${line || "&nbsp;"}</p>`)
        .join("");
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Transkription</title></head><body style="font-family: Calibri, sans-serif; font-size: 11pt;">${htmlContent}</body></html>`;
      const blob = new Blob([html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transkription-${jobId.slice(0, 8)}${
        anonymized ? "-anonymiserad" : ""
      }.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported("doc");
      setTimeout(() => setExported(null), 2000);
    } catch {
      // Error handling
    } finally {
      setExporting(null);
    }
  }, [jobId, anonymized]);

  const handleCopy = useCallback(
    async (useAnonymized: boolean) => {
      const target: CopyTarget = hasAnonymized
        ? useAnonymized
          ? "copy-anonymized"
          : "copy-original"
        : "copy";
      setCopying(target);
      try {
        const content = await exportTranscript(jobId, "txt", useAnonymized);
        await navigator.clipboard.writeText(content);
        setCopied(target);
        setTimeout(() => setCopied(null), 2000);
      } catch (error) {
        console.error("Failed to copy text to clipboard:", error);
      } finally {
        setCopying(null);
      }
    },
    [jobId, hasAnonymized]
  );

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Download className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-200">Exportera</h3>
      </div>

      {hasAnonymized && (
        <div className="mb-4">
          <Toggle
            checked={anonymized}
            onChange={setAnonymized}
            label="Anonymiserad version"
            description="Exportera med anonymiserad text"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {FORMATS.map((fmt) => {
          const isExporting = exporting === fmt.format;
          const isExported = exported === fmt.format;

          return (
            <Button
              key={fmt.format}
              variant="secondary"
              size="sm"
              onClick={() => handleExport(fmt.format)}
              loading={isExporting}
              disabled={isExporting}
              icon={
                isExported ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  fmt.icon
                )
              }
              className="justify-start"
            >
              <span className="flex flex-col items-start">
                <span className="text-xs font-medium">{fmt.label}</span>
                <span className="text-[10px] text-gray-500">
                  {fmt.description}
                </span>
              </span>
            </Button>
          );
        })}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportDoc}
          loading={exporting === "doc"}
          disabled={exporting === "doc"}
          icon={
            exported === "doc" ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <FileType className="h-4 w-4" />
            )
          }
          className="justify-start"
        >
          <span className="flex flex-col items-start">
            <span className="text-xs font-medium">Word</span>
            <span className="text-[10px] text-gray-500">
              Microsoft Word
            </span>
          </span>
        </Button>
      </div>

      <div className="mt-4 border-t border-dark-800 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Copy className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-200">
            Kopiera till urklipp
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {hasAnonymized ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(false)}
                loading={copying === "copy-original"}
                disabled={copying !== null}
                icon={
                  copied === "copy-original" ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
                className="justify-start"
              >
                <span className="text-xs font-medium">
                  {copied === "copy-original"
                    ? "Kopierad!"
                    : "Kopiera original"}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(true)}
                loading={copying === "copy-anonymized"}
                disabled={copying !== null}
                icon={
                  copied === "copy-anonymized" ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
                className="justify-start"
              >
                <span className="text-xs font-medium">
                  {copied === "copy-anonymized"
                    ? "Kopierad!"
                    : "Kopiera anonymiserad"}
                </span>
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(false)}
              loading={copying === "copy"}
              disabled={copying !== null}
              icon={
                copied === "copy" ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
              className="justify-start"
            >
              <span className="text-xs font-medium">
                {copied === "copy" ? "Kopierad!" : "Kopiera text"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
