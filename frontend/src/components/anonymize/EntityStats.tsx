"use client";

import { ENTITY_COLORS } from "@/utils/format";

interface EntityStatsProps {
  entityCounts: Record<string, number>;
}

export function EntityStats({ entityCounts }: EntityStatsProps) {
  const entries = Object.entries(entityCounts).filter(([, count]) => count > 0);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entries.map(([label, count]) => {
        const colorClass =
          ENTITY_COLORS[label] ??
          "bg-gray-500/20 text-gray-300 border-gray-500/30";
        return (
          <span
            key={label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${colorClass}`}
          >
            {label}
            <span className="opacity-70">{count}</span>
          </span>
        );
      })}
    </div>
  );
}
