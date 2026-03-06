"use client";

import { twMerge } from "tailwind-merge";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-700/50 text-gray-300 border-gray-600/30",
  primary: "bg-primary-600/15 text-primary-400 border-primary-600/30",
  success: "bg-green-600/15 text-green-400 border-green-600/30",
  warning: "bg-yellow-600/15 text-yellow-400 border-yellow-600/30",
  danger: "bg-red-600/15 text-red-400 border-red-600/30",
  info: "bg-blue-600/15 text-blue-400 border-blue-600/30",
};

const dotClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-400",
  primary: "bg-primary-400",
  success: "bg-green-400",
  warning: "bg-yellow-400",
  danger: "bg-red-400",
  info: "bg-blue-400",
};

export function Badge({
  variant = "default",
  children,
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={twMerge("h-1.5 w-1.5 rounded-full", dotClasses[variant])}
        />
      )}
      {children}
    </span>
  );
}
