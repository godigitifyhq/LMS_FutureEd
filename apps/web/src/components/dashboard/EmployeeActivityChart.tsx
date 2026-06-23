"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type DayActivity = {
  date: string;
  interactions: number;
  calls: number;
  minutes: number;
};

export function EmployeeActivityChart({ data }: { data: DayActivity[] | undefined }) {
  const hasActivity = data?.some((d) => d.interactions > 0 || d.calls > 0);

  if (!data?.length || !hasActivity) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-400">
        No activity in the last 7 days
      </div>
    );
  }

  const labels = data.map((d) => {
    const [, m, day] = d.date.split("-");
    return `${day}/${m}`;
  });

  const options: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, sparkline: { enabled: false }, animations: { enabled: false } },
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 3 } },
    colors: ["#6366f1", "#10b981"],
    xaxis: {
      categories: labels,
      labels: { style: { fontSize: "10px", colors: "#9ca3af" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: "10px", colors: "#9ca3af" } }, min: 0 },
    grid: { borderColor: "#f1f5f9", strokeDashArray: 4, xaxis: { lines: { show: false } } },
    legend: {
      show: true,
      fontSize: "11px",
      labels: { colors: "#6b7280" },
      markers: { size: 5 },
      itemMargin: { horizontal: 8 },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (v: number) => String(v) },
    },
    dataLabels: { enabled: false },
  };

  const series = [
    { name: "Interactions", data: data.map((d) => d.interactions) },
    { name: "Calls", data: data.map((d) => d.calls) },
  ];

  return (
    <Chart
      type="bar"
      options={options}
      series={series}
      height={130}
      width="100%"
    />
  );
}
