"use client";

// Pipeline tab — reuses the existing analytics overview's pipeline and source charts.
// Rather than duplicating the query logic, we embed those sections directly.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ReportShell } from "@/components/reports/ReportShell";
import { usePipeline, useSourceReport } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const STATUS_LABELS: Record<string, string> = {
  NEW:                  "New",
  ATTEMPTED_CONTACT:    "Attempted Contact",
  CONNECTED:            "Connected",
  INTERESTED:           "Interested",
  FOLLOW_UP_SCHEDULED:  "Follow-up Scheduled",
  APPLICATION_SENT:     "Application Sent",
  UNDER_VALIDATION:     "Under Validation",
  CONFIRMED:            "Confirmed",
  LOST:                 "Lost",
  NOT_INTERESTED:       "Not Interested",
  NOT_REACHABLE:        "Not Reachable",
  DUPLICATE:            "Duplicate",
};

// Hex values used by ApexCharts (needs strings, not Tailwind classes)
const STATUS_CHART_COLORS: Record<string, string> = {
  NEW:                  "#6b7280",
  ATTEMPTED_CONTACT:    "#3b82f6",
  CONNECTED:            "#0ea5e9",
  INTERESTED:           "#8b5cf6",
  FOLLOW_UP_SCHEDULED:  "#f59e0b",
  APPLICATION_SENT:     "#14b8a6",
  UNDER_VALIDATION:     "#f97316",
  CONFIRMED:            "#16a34a",
  LOST:                 "#ef4444",
  NOT_INTERESTED:       "#dc2626",
  NOT_REACHABLE:        "#9ca3af",
  DUPLICATE:            "#d1d5db",
};

// Tailwind bg classes for the table dot — avoids inline styles
const STATUS_DOT_CLASS: Record<string, string> = {
  NEW:                  "bg-gray-500",
  ATTEMPTED_CONTACT:    "bg-blue-500",
  CONNECTED:            "bg-sky-500",
  INTERESTED:           "bg-violet-500",
  FOLLOW_UP_SCHEDULED:  "bg-amber-500",
  APPLICATION_SENT:     "bg-teal-500",
  UNDER_VALIDATION:     "bg-orange-500",
  CONFIRMED:            "bg-green-600",
  LOST:                 "bg-red-500",
  NOT_INTERESTED:       "bg-red-600",
  NOT_REACHABLE:        "bg-gray-400",
  DUPLICATE:            "bg-gray-300",
};

type PipelineItem = {
  status: string;
  count: number;
};

type SourceItem = {
  total: number;
  source: { name: string };
};

export default function PipelinePage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [period,   setPeriod]   = useState<Period>((searchParams.get("period") as Period) ?? "today");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo,   setDateTo]   = useState(searchParams.get("dateTo") ?? "");
  const [mounted,  setMounted]  = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
    if (period === "custom" && dateTo)   p.set("dateTo",   dateTo);
    router.replace(`/analytics/pipeline?${p.toString()}`, { scroll: false });
  }, [period, dateFrom, dateTo]);

  // usePipeline scopes by branchId; useSourceReport scopes by period
  const { data: pipelineData, isLoading: pLoading }  = usePipeline();
  const { data: sourceData,   isLoading: sLoading }   = useSourceReport(period);

  const pipeline =
    (pipelineData as { statusBreakdown?: PipelineItem[] } | undefined)
      ?.statusBreakdown ?? [];
  const sources =
    ((sourceData as { sources?: SourceItem[] } | undefined)?.sources ?? []).filter(
      (source) => source.total > 0,
    );
  const isLoading = pLoading || sLoading;

  const pipelineLabels = pipeline.map((s) => STATUS_LABELS[s.status] ?? s.status);
  const pipelineCounts = pipeline.map((s) => s.count);
  const pipelineColors = pipeline.map((s) => STATUS_CHART_COLORS[s.status] ?? "#6b7280");
  const totalPipelineCount = pipelineCounts.reduce((a: number, b: number) => a + b, 0);

  return (
    <ReportShell
      title="Lead Pipeline Report"
      description="Distribution of leads across all stages and sources."
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={setPeriod}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
    >
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-surface-100 rounded-xl animate-pulse" />
          <div className="h-72 bg-surface-100 rounded-xl animate-pulse" />
        </div>
      )}

      {!isLoading && mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pipeline funnel */}
          <div className="bg-white border border-surface-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Lead Status Distribution</h3>
            {pipeline.length > 0 ? (
              <Chart
                type="bar"
                height={260}
                series={[{ name: "Leads", data: pipelineCounts }]}
                options={{
                  chart:       {
                    toolbar: { show: false },
                    events: {
                      dataPointSelection: (_event, _chartContext, config) => {
                        if (!config) return;
                        const status = pipeline[config.dataPointIndex]?.status;
                        if (status) {
                          router.push(`/leads?status=${status}`);
                        }
                      },
                    },
                  },
                  colors:      pipelineColors,
                  plotOptions: { bar: { distributed: true, horizontal: true, barHeight: "70%" } },
                  xaxis:       { categories: pipelineLabels },
                  legend:      { show: false },
                  dataLabels:  { enabled: true, style: { fontSize: "11px" } },
                }}
              />
            ) : (
              <p className="text-center text-gray-400 py-10 text-sm">No pipeline data.</p>
            )}
          </div>

          {/* Source donut */}
          <div className="bg-white border border-surface-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Lead Sources</h3>
            {sources.length > 0 ? (
              <Chart
                type="donut"
                height={260}
                series={sources.map((s) => s.total)}
                options={{
                  labels:   sources.map((s) => s.source.name || "Direct / Other"),
                  legend:   { position: "bottom", fontSize: "12px" },
                  plotOptions: { pie: { donut: { size: "65%" } } },
                  dataLabels: { formatter: (v: number) => `${Math.round(v)}%` },
                }}
              />
            ) : (
              <p className="text-center text-gray-400 py-10 text-sm">No source data.</p>
            )}
          </div>
        </div>
      )}

      {/* Status breakdown table */}
      {!isLoading && pipeline.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100">
            <h3 className="text-sm font-semibold text-gray-700">Status Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Count</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Share</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((s) => {
                  const pct = totalPipelineCount > 0
                    ? Math.round((s.count / totalPipelineCount) * 100)
                    : 0;
                  return (
                    <tr key={s.status} className="border-b border-surface-50 hover:bg-surface-50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/leads?status=${s.status}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", STATUS_DOT_CLASS[s.status] ?? "bg-gray-400")} />
                          {STATUS_LABELS[s.status] ?? s.status}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-700">
                        <Link href={`/leads?status=${s.status}`} className="hover:text-primary transition-colors">
                          {s.count}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
