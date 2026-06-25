"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import api from "@/lib/api";
import toast from "react-hot-toast";
import type { Period } from "@/hooks/useDashboard";

export type ReportShellProps = {
  title: string;
  description?: string;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  onPeriodChange: (p: Period) => void;
  onDateFromChange?: (d: string) => void;
  onDateToChange?: (d: string) => void;
  resolvedRange?: { from: string; to: string } | null;
  csvExportPath?: string;
  csvExportParams?: Record<string, string | undefined>;
  children: React.ReactNode;
};

export function ReportShell({
  title,
  description,
  period,
  dateFrom,
  dateTo,
  onPeriodChange,
  onDateFromChange,
  onDateToChange,
  resolvedRange,
  csvExportPath,
  csvExportParams,
  children,
}: ReportShellProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!csvExportPath) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (csvExportParams) {
        for (const [k, v] of Object.entries(csvExportParams)) {
          if (v) qs.set(k, v);
        }
      }
      const url = `${csvExportPath}${qs.toString() ? `?${qs.toString()}` : ""}`;
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart], { type: "text/csv" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = csvExportPath.split("/").pop() + ".csv";
      a.click();
      URL.revokeObjectURL(href);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
          {resolvedRange && (
            <p className="text-xs text-gray-400 mt-1">
              Showing:{" "}
              <span className="font-medium text-gray-600">
                {fmtDate(resolvedRange.from)} – {fmtDate(resolvedRange.to)}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={onPeriodChange} compact />
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 mb-0.5">From</label>
                <input
                  type="date"
                  value={dateFrom ?? ""}
                  onChange={(e) => onDateFromChange?.(e.target.value)}
                  className="border border-surface-200 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 mb-0.5">To</label>
                <input
                  type="date"
                  value={dateTo ?? ""}
                  onChange={(e) => onDateToChange?.(e.target.value)}
                  className="border border-surface-200 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
          {csvExportPath && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5"
            >
              {exporting ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
