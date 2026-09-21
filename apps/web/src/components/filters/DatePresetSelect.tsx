"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { DATE_PRESETS, matchPreset, presetRange, formatRange, type DatePreset, type DateRange } from "@/lib/dateRanges";
import { FilterChip } from "./FilterChip";
import { cn } from "@/lib/utils";

// Creation-date chip with TeleCRM's presets and a Custom range.
export function DatePresetSelect({
  value,
  onChange,
  label = "Created",
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  label?: string;
}) {
  // "Custom" is a mode, not a range: the seeded dates (or whatever preset was
  // active) always match a named preset, so matchPreset alone can never
  // surface it. Remember the choice locally until another preset is picked.
  const [customMode, setCustomMode] = useState(false);
  const matched = matchPreset(value);
  const isEmpty = !value.dateFrom && !value.dateTo;

  // Cleared from outside ("Clear all", URL change) — drop custom mode too.
  // State adjusted during render, per the React docs, rather than in an effect.
  const [wasEmpty, setWasEmpty] = useState(isEmpty);
  if (isEmpty !== wasEmpty) {
    setWasEmpty(isEmpty);
    if (isEmpty) setCustomMode(false);
  }

  const preset: DatePreset = matched === "custom" || (customMode && !isEmpty) ? "custom" : matched;
  const active = !isEmpty;

  const pick = (p: DatePreset) => {
    if (p === "custom") {
      setCustomMode(true);
      // Seed a sensible custom range so the inputs aren't empty
      if (isEmpty) onChange(presetRange("thisMonth"));
      return;
    }
    setCustomMode(false);
    onChange(presetRange(p));
  };

  const clear = () => {
    setCustomMode(false);
    onChange({});
  };

  return (
    <FilterChip icon={CalendarDays} label={label} value={active ? formatRange(value, preset) : "All"} active={active} onClear={clear} width={260}>
      <div className="grid grid-cols-2 gap-1 p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => pick(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm text-left",
              preset === p.value ? "bg-primary text-white" : "text-gray-700 hover:bg-surface-50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2 px-2 pt-2 mt-1 border-t border-surface-100">
          <input
            type="date"
            value={value.dateFrom ?? ""}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
            aria-label="From"
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-surface-200 rounded-lg bg-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={value.dateTo ?? ""}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
            aria-label="To"
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-surface-200 rounded-lg bg-white"
          />
        </div>
      )}
    </FilterChip>
  );
}
