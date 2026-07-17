"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTrend } from "@/hooks/useDashboard";
import { PeriodSelector } from "./PeriodSelector";
import { CustomDateRange } from "./CustomDateRange";
import type { Period } from "@/hooks/useDashboard";
import dayjs from "dayjs";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function TrendChart() {
  const [period, setPeriod] = useState<Period>("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isLoading } = useTrend(period, dateFrom, dateTo);

  type TrendPoint = { date: string; created: number; confirmed: number };
  const trend: TrendPoint[] =
    (data as { trend?: TrendPoint[] } | undefined)?.trend ?? [];

  const categories = trend.map((t: TrendPoint) =>
    dayjs(t.date).format("D MMM"),
  );
  const created = trend.map((t: TrendPoint) => t.created);
  const confirmed = trend.map((t: TrendPoint) => t.confirmed);

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      background: "transparent",
    },
    colors: ["#005826", "#22c55e"],
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.05,
      },
    },
    xaxis: {
      categories,
      labels: {
        style: { fontSize: "10px" },
        rotate: -45,
        rotateAlways: false,
      },
      tickAmount: 6,
    },
    yaxis: {
      labels: { style: { fontSize: "11px" } },
      min: 0,
    },
    grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
    legend: {
      position: "top",
      fontSize: "12px",
    },
    tooltip: {
      x: { show: true },
    },
    dataLabels: { enabled: false },
  };

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-800">
          Leads & Confirmations
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} compact />
          {period === "custom" && (
            <CustomDateRange dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-surface-50 rounded animate-pulse" />
      ) : (
        <ApexChart
          type="area"
          height={220}
          series={[
            { name: "Leads Created", data: created },
            { name: "Confirmed", data: confirmed },
          ]}
          options={options}
        />
      )}
    </div>
  );
}
