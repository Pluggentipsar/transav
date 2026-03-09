"use client";

import { useEffect, useState } from "react";
import { Cpu, Zap } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type { TranscriptionEngine, ModelOption } from "@/types";
import {
  MODEL_OPTIONS,
  ENGINE_OPTIONS,
  getModelsForEngine,
} from "@/utils/format";
import { listEngines } from "@/services/api";

interface ModelSelectorProps {
  engine: TranscriptionEngine;
  model: string;
  onEngineChange: (engine: TranscriptionEngine) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  engine,
  model,
  onEngineChange,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const [easyAvailable, setEasyAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    listEngines()
      .then((res) => {
        const easy = res.engines.find((e) => e.id === "easytranscriber");
        setEasyAvailable(easy?.available ?? false);
      })
      .catch(() => {
        setEasyAvailable(false);
      });
  }, []);

  const models = getModelsForEngine(engine);

  return (
    <div className="space-y-6">
      {/* Engine selector — only show if easytranscriber is available */}
      {easyAvailable && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-200">
              Transkriptionsmotor
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ENGINE_OPTIONS.map((opt) => {
              const isSelected = engine === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onEngineChange(opt.id)}
                  className={twMerge(
                    "flex flex-col gap-1 p-3 rounded-lg border text-left transition-all duration-200",
                    isSelected
                      ? "bg-primary-600/10 border-primary-600/40 text-white"
                      : "bg-dark-900 border-dark-800 text-gray-300 hover:border-primary-600/30 hover:bg-dark-900/80",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-gray-500">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Model selector */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="h-4 w-4 text-gray-400" />
          <label className="text-sm font-medium text-gray-200">
            KB-Whisper-modell
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {models.map((m) => {
            const isSelected = model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => onModelChange(m.id)}
                className={twMerge(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-200",
                  isSelected
                    ? "bg-primary-600/10 border-primary-600/40 text-white"
                    : "bg-dark-900 border-dark-800 text-gray-300 hover:border-primary-600/30 hover:bg-dark-900/80",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div
                  className={twMerge(
                    "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected ? "border-primary-400" : "border-gray-600"
                  )}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-xs text-gray-500">{m.size}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {m.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
