"use client";

import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

type Props = {
  value: Period;
  onChange: (p: Period) => void;
  compact?: boolean;
};

const OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "7 days" },
  { value: "last30", label: "30 days" },
  { value: "last90", label: "90 days" },
  { value: "custom", label: "Custom" },
];

export function PeriodSelector({ value, onChange, compact }: Props) {
  return (
    <div className="flex items-center bg-surface-100 rounded-lg p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          {compact ? opt.label.replace(/(\d+) days/, "$1d") : opt.label}
        </button>
      ))}
    </div>
  );
}
