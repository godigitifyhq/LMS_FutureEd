// Creation-date presets (TeleCRM's set) on IST calendar days, expressed as
// the YYYY-MM-DD dateFrom/dateTo pair the API already understands.
import { istDateString } from "./istDate";

export type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "lastWeek"
  | "lastMonth"
  | "custom";

export const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This week" },
  { value: "thisMonth", label: "This month" },
  { value: "lastWeek", label: "Last week" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom" },
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function ymd(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export type DateRange = { dateFrom?: string | undefined; dateTo?: string | undefined };

// Weeks start on Monday.
export function presetRange(preset: DatePreset): DateRange {
  const now = istNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const dow = (now.getUTCDay() + 6) % 7; // 0 = Monday

  switch (preset) {
    case "today":
      return { dateFrom: istDateString(0), dateTo: istDateString(0) };
    case "yesterday":
      return { dateFrom: istDateString(1), dateTo: istDateString(1) };
    case "thisWeek":
      return { dateFrom: ymd(utc(y, m, d - dow)), dateTo: istDateString(0) };
    case "lastWeek":
      return { dateFrom: ymd(utc(y, m, d - dow - 7)), dateTo: ymd(utc(y, m, d - dow - 1)) };
    case "thisMonth":
      return { dateFrom: ymd(utc(y, m, 1)), dateTo: istDateString(0) };
    case "lastMonth":
      return { dateFrom: ymd(utc(y, m - 1, 1)), dateTo: ymd(utc(y, m, 0)) };
    case "all":
    case "custom":
    default:
      return {};
  }
}

// Which preset (if any) produces exactly this range — so the chip can show
// "This week" instead of two dates after a refresh.
export function matchPreset(range: DateRange): DatePreset {
  if (!range.dateFrom && !range.dateTo) return "all";
  for (const p of ["today", "yesterday", "thisWeek", "thisMonth", "lastWeek", "lastMonth"] as const) {
    const r = presetRange(p);
    if (r.dateFrom === range.dateFrom && r.dateTo === range.dateTo) return p;
  }
  return "custom";
}

// `preset` can be passed in when the caller knows better than matchPreset —
// e.g. the chip is in Custom mode but the dates happen to equal a preset.
export function formatRange(range: DateRange, preset: DatePreset = matchPreset(range)): string {
  if (preset !== "custom") return DATE_PRESETS.find((p) => p.value === preset)!.label;
  const f = (s?: string) => (s ? s.split("-").reverse().join("/") : "…");
  return `${f(range.dateFrom)} – ${f(range.dateTo)}`;
}
