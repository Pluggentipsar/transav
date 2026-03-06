"use client";

import { Cpu } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { MODEL_OPTIONS } from "@/utils/format";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="h-4 w-4 text-gray-400" />
        <label className="text-sm font-medium text-gray-200">
          KB-Whisper-modell
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {MODEL_OPTIONS.map((model) => {
          const isSelected = value === model.id;
          return (
            <button
              key={model.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(model.id)}
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
                  isSelected
                    ? "border-primary-400"
                    : "border-gray-600"
                )}
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-primary-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{model.label}</span>
                  <span className="text-xs text-gray-500">{model.size}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {model.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
