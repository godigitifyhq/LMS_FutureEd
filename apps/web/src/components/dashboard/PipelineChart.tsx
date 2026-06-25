"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { STATUS_CONFIG } from "@/config/leadStatus";
import { usePipeline } from "@/hooks/useDashboard";
import type { LeadStatus } from "@lms/types";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function PipelineChart() {
  const router = useRouter();
  const { data, isLoading } = usePipeline();

  if (isLoading) {
    return (
      <div className="bg-white border border-surface-200 rounded-xl p-5">
        <div className="h-4 w-40 bg-surface-200 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 bg-surface-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statuses =
    data &&
    typeof data === "object" &&
    "statusBreakdown" in data &&
    Array.isArray((data as { statusBreakdown?: unknown }).statusBreakdown)
      ? ((data as { statusBreakdown: Array<{ status: string; count: number }> })
          .statusBreakdown ?? [])
      : [];
  const sorted = [...statuses].sort((a, b) => b.count - a.count);

  const categories = sorted.map(
    (s) => STATUS_CONFIG[s.status as LeadStatus]?.label ?? s.status,
  );
  const values = sorted.map((s) => s.count);
  const colors = sorted.map((s) => {
    const cfg = STATUS_CONFIG[s.status as LeadStatus];
    const dotClass = cfg?.dot ?? "bg-gray-400";
    // Map Tailwind class to hex
    const colorMap: Record<string, string> = {
      "bg-blue-500": "#3b82f6",
      "bg-orange-500": "#f97316",
      "bg-cyan-500": "#06b6d4",
      "bg-violet-500": "#8b5cf6",
      "bg-amber-500": "#f59e0b",
      "bg-indigo-500": "#6366f1",
      "bg-pink-500": "#ec4899",
      "bg-green-500": "#16a34a",
      "bg-red-500": "#ef4444",
      "bg-gray-400": "#9ca3af",
      "bg-rose-500": "#f43f5e",
      "bg-slate-400": "#94a3b8",
    };
    return colorMap[dotClass] ?? "#6b7280";
  });

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (!config) return;
          const status = sorted[config.dataPointIndex]?.status;
          if (status) {
            router.push(`/leads?status=${status}`);
          }
        },
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: "70%",
        distributed: true,
      },
    },
    colors,
    dataLabels: {
      enabled: true,
      style: { fontSize: "11px", fontWeight: 600 },
    },
    legend: { show: false },
    xaxis: {
      categories,
      labels: { style: { fontSize: "11px" } },
    },
    yaxis: {
      labels: { style: { fontSize: "11px" } },
    },
    grid: {
      borderColor: "#f1f5f9",
      strokeDashArray: 4,
    },
    tooltip: {
      y: { formatter: (v) => `${v} leads` },
    },
  };

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">
          Lead Pipeline Overview
        </h3>
        <a
          href="/leads"
          className="text-xs text-primary font-medium hover:underline"
        >
          View all →
        </a>
      </div>

      <ApexChart
        type="bar"
        height={280}
        series={[{ name: "Leads", data: values }]}
        options={options}
      />
    </div>
  );
}
