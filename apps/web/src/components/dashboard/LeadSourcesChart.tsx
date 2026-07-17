"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSourceReport } from "@/hooks/useDashboard";
import { PeriodSelector } from "./PeriodSelector";
import { CustomDateRange } from "./CustomDateRange";
import type { Period } from "@/hooks/useDashboard";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const CHART_COLORS = [
  "#005826",
  "#1a7340",
  "#2d8f56",
  "#4aab70",
  "#6bc48e",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
  "#06b6d4",
];

export function LeadSourcesChart() {
  const [period, setPeriod] = useState<Period>("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isLoading } = useSourceReport(period, dateFrom, dateTo);

  type SourceItem = {
    total: number;
    source: { name: string };
    conversionRate?: number;
  };

  const sources =
    (data as { sources?: SourceItem[] } | undefined)?.sources?.filter(
      (s) => s.total > 0,
    ) ?? [];

  const options: ApexCharts.ApexOptions = {
    chart: { type: "donut", background: "transparent" },
    labels: sources.map((s) => s.source.name),
    colors: CHART_COLORS,
    legend: {
      position: "bottom",
      fontSize: "11px",
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${Math.round(val)}%`,
      style: { fontSize: "10px" },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () =>
                String(
                  sources.reduce((a: number, s: SourceItem) => a + s.total, 0),
                ),
              fontSize: "16px",
              fontWeight: 700,
              color: "#111827",
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (v: number, opts) => {
          const src = sources[opts?.seriesIndex ?? 0];
          return `${v} leads · ${src?.conversionRate ?? 0}% conversion`;
        },
      },
    },
  };

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Lead Sources</h3>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} compact />
          {period === "custom" && (
            <CustomDateRange dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          )}
        </div>
      </div>

      {isLoading || sources.length === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-gray-400">
            {isLoading ? "Loading..." : "No data for this period"}
          </p>
        </div>
      ) : (
        <ApexChart
          type="donut"
          height={220}
          series={sources.map((s) => s.total)}
          options={options}
        />
      )}
    </div>
  );
}
