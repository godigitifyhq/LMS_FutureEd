// Mirrors apps/api/src/routes/analytics/helpers.ts's IST day-boundary logic,
// so client-computed quick-filter ranges (Today/Yesterday/7d/30d) line up
// exactly with what the backend's period-based analytics endpoints use.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** YYYY-MM-DD for the IST calendar day `daysAgo` days before today. */
export function istDateString(daysAgo = 0): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const d = new Date(
    Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() - daysAgo),
  );
  return d.toISOString().split("T")[0]!;
}

export type QuickPeriod = "today" | "yesterday" | "week" | "last30" | "last90";

export function getISTDateRange(period: QuickPeriod): { dateFrom: string; dateTo: string } {
  switch (period) {
    case "today":     return { dateFrom: istDateString(0),  dateTo: istDateString(0) };
    case "yesterday": return { dateFrom: istDateString(1),  dateTo: istDateString(1) };
    case "week":      return { dateFrom: istDateString(7),  dateTo: istDateString(0) };
    case "last30":    return { dateFrom: istDateString(30), dateTo: istDateString(0) };
    case "last90":    return { dateFrom: istDateString(90), dateTo: istDateString(0) };
  }
}
