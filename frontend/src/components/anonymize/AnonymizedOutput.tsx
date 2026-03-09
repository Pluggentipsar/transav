"use client";

import { useMemo } from "react";
import { ENTITY_COLORS } from "@/utils/format";

interface AnonymizedOutputProps {
  text: string;
  className?: string;
}

const TAG_REGEX = /(\[[A-Z\u00C0-\u00FF-]+\])/g;

export function AnonymizedOutput({ text, className }: AnonymizedOutputProps) {
  const parts = useMemo(() => text.split(TAG_REGEX), [text]);

  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (TAG_REGEX.test(part)) {
          const label = part.slice(1, -1);
          const colorClass =
            ENTITY_COLORS[label] ??
            "bg-gray-500/20 text-gray-300 border-gray-500/30";
          return (
            <span
              key={i}
              className={`inline-block px-1.5 py-0.5 rounded border text-xs font-medium mx-0.5 ${colorClass}`}
            >
              {part}
            </span>
          );
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </div>
  );
}
