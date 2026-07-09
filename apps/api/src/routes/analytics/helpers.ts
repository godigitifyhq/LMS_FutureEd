import type Redis from "ioredis";

// ── Date range builder ──
export type Period = "today" | "yesterday" | "week" | "last30" | "last90" | "custom";

// All periods are aligned to IST (UTC+5:30) day boundaries so that dashboard
// numbers and leads-list drill-through numbers always match.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start of IST day N days ago, expressed as a UTC Date. */
function istDayStart(daysAgo: number): Date {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const utcMs = Date.UTC(
    nowIST.getUTCFullYear(),
    nowIST.getUTCMonth(),
    nowIST.getUTCDate() - daysAgo,
    0, 0, 0, 0,
  );
  return new Date(utcMs - IST_OFFSET_MS);
}

/** End of IST day N days ago (23:59:59.999 IST), expressed as a UTC Date. */
function istDayEnd(daysAgo: number): Date {
  return new Date(istDayStart(daysAgo).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Serialize a UTC Date as the date string it represents in IST (YYYY-MM-DD).
 * Use this when returning period.from / period.to to the frontend so the
 * displayed date matches the IST calendar day that was actually queried.
 */
export function toISTDateString(d: Date): string {
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split("T")[0]!;
}

export function getDateRange(
  period: Period,
  dateFrom?: string,
  dateTo?: string,
): { from: Date; to: Date } {
  switch (period) {
    case "today":
      return { from: istDayStart(0), to: istDayEnd(0) };
    case "yesterday":
      return { from: istDayStart(1), to: istDayEnd(1) };
    case "week":
      return { from: istDayStart(7), to: istDayEnd(0) };
    case "last30":
      return { from: istDayStart(30), to: istDayEnd(0) };
    case "last90":
      return { from: istDayStart(90), to: istDayEnd(0) };
    case "custom":
      return {
        from: dateFrom ? new Date(`${dateFrom}T00:00:00.000+05:30`) : new Date(0),
        to:   dateTo   ? new Date(`${dateTo}T23:59:59.999+05:30`)   : istDayEnd(0),
      };
    default:
      return { from: istDayStart(0), to: istDayEnd(0) };
  }
}

// ── Redis cache helper ──
// Every analytics query goes through this.
// Cache hit = zero DB queries.
export async function getCached<T>(
  redis: Redis,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis unavailable — fall through to DB
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch {
    // Cache write failed — still return data
  }

  return data;
}

// ── Cache key builder — deterministic per params ──
export function buildCacheKey(
  report: string,
  params: Record<string, string | undefined>,
): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
  return `analytics:${report}:${sorted}`;
}
