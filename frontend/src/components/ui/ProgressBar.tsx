"use client";

import { twMerge } from "tailwind-merge";

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "blue" | "green" | "yellow" | "red";
  className?: string;
  label?: string;
}

const colorClasses: Record<string, string> = {
  primary: "bg-primary-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

const sizeClasses: Record<string, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export function ProgressBar({
  value,
  max = 100,
  showLabel = true,
  size = "md",
  color = "primary",
  className,
  label,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div className={twMerge("w-full", className)}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-gray-400">{label}</span>}
          {showLabel && (
            <span className="text-xs text-gray-400 ml-auto">
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div
        className={twMerge(
          "w-full rounded-full bg-dark-800 overflow-hidden",
          sizeClasses[size]
        )}
      >
        <div
          className={twMerge(
            "h-full rounded-full transition-all duration-500 ease-out",
            colorClasses[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
