"use client";

import { useState, useCallback } from "react";
import { Plus, X, BookOpen } from "lucide-react";
import type { WordReplacement, TemplateResponse } from "@/types";

interface CustomWordsInputProps {
  words: WordReplacement[];
  onChange: (words: WordReplacement[]) => void;
  templates?: TemplateResponse[];
  onSelectTemplate?: (template: TemplateResponse) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function CustomWordsInput({
  words,
  onChange,
  templates,
  onSelectTemplate,
  disabled = false,
  compact = false,
}: CustomWordsInputProps) {
  const [original, setOriginal] = useState("");
  const [replacement, setReplacement] = useState("");

  const handleAdd = useCallback(() => {
    const trimmed = original.trim();
    if (!trimmed) return;
    onChange([
      ...words,
      {
        original: trimmed,
        replacement: replacement.trim() || `[${trimmed.toUpperCase()}]`,
      },
    ]);
    setOriginal("");
    setReplacement("");
  }, [original, replacement, words, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(words.filter((_, i) => i !== index));
    },
    [words, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className="space-y-2">
      {/* Template picker */}
      {templates && templates.length > 0 && onSelectTemplate && (
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpen className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTemplate(t)}
              className="text-xs px-2 py-1 rounded-md bg-dark-800 border border-dark-700 text-gray-300 hover:border-primary-600/40 hover:text-white transition-colors disabled:opacity-50"
            >
              {t.name}
              <span className="text-gray-600 ml-1">({t.words.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ord att ersatta..."
          disabled={disabled}
          className={`flex-1 bg-dark-900 border border-dark-800 rounded-md px-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 ${compact ? "py-1.5 text-xs" : "py-2"}`}
        />
        <input
          type="text"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="[ERSATTNING]"
          disabled={disabled}
          className={`flex-1 bg-dark-900 border border-dark-800 rounded-md px-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 ${compact ? "py-1.5 text-xs" : "py-2"}`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || !original.trim()}
          className="flex-shrink-0 p-1.5 rounded-md bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 disabled:opacity-30 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Word list */}
      {words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w, i) => (
            <span
              key={`${w.original}-${i}`}
              className="inline-flex items-center gap-1 text-xs bg-dark-800 border border-dark-700 rounded-md px-2 py-1 text-gray-300"
            >
              <span className="text-white">{w.original}</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="text-primary-400">{w.replacement}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
