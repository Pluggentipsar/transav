"use client";

import { useState, useCallback } from "react";
import {
  Download,
  FileText,
  FileCode,
  FileJson,
  Subtitles,
  Check,
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

export function ExportPanel({ jobId, hasAnonymized }: ExportPanelProps) {
  const [anonymized, setAnonymized] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exported, setExported] = useState<ExportFormat | null>(null);

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
      </div>
    </div>
  );
}
