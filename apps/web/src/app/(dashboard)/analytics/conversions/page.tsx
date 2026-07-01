"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { TrendingUp } from "lucide-react";
import { ReportShell } from "@/components/reports/ReportShell";
import { useConversionReport } from "@/hooks/useReports";
import { useStaffList } from "@/hooks/useLeads";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function ConversionsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [period,     setPeriod]     = useState<Period>((searchParams.get("period") as Period) ?? "last30");
  const [dateFrom,   setDateFrom]   = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo,     setDateTo]     = useState(searchParams.get("dateTo") ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [mounted,    setMounted]    = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
    if (period === "custom" && dateTo)   p.set("dateTo",   dateTo);
    router.replace(`/analytics/conversions?${p.toString()}`, { scroll: false });
  }, [period, dateFrom, dateTo]);

  const filters = {
    period,
    ...(period === "custom" && dateFrom ? { dateFrom } : {}),
    ...(period === "custom" && dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading, isError, refetch } = useConversionReport(filters);
  const { data: staffData } = useStaffList();
  const report    = (data as any)?.data;
  const allRows   = report?.rows        ?? [];
  const rows      = employeeId ? allRows.filter((r: any) => r.employeeId === employeeId) : allRows;

  // When filtered, recompute totals from visible rows; otherwise use API totals
  const totals = employeeId && rows.length > 0
    ? (() => {
        const tLeads = rows.reduce((s: number, r: any) => s + (r.totalLeads ?? 0), 0);
        const tConf  = rows.reduce((s: number, r: any) => s + (r.confirmedLeads ?? 0), 0);
        const tRev   = rows.reduce((s: number, r: any) => s + (r.revenue ?? 0), 0);
        return {
          totalLeads:            tLeads,
          confirmedLeads:        tConf,
          overallConversionRate: tLeads > 0 ? Math.round((tConf / tLeads) * 100 * 10) / 10 : 0,
          totalRevenue:          tRev,
        };
      })()
    : (report?.totals ?? {});
  const trend    = report?.dailyTrend  ?? [];
  const sources  = report?.sourceBreakdown ?? [];
  const resolved = report?.period     ?? null;

  const labelStep = trend.length <= 7 ? 1 : trend.length <= 30 ? 5 : 15;

  return (
    <ReportShell
      title="Conversion Report"
      description="Revenue and conversion rates by employee and lead source."
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={setPeriod}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      resolvedRange={resolved}
      csvExportPath="/analytics/export/csv/conversions"
      csvExportParams={{ period, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) }}
    >
      {/* Employee filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="Filter by employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Employees</option>
          {staffData?.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Total Leads"     value={totals.totalLeads ?? 0}              color="text-gray-700" />
        <SumCard label="Confirmed"       value={totals.confirmedLeads ?? 0}          color="text-green-600" />
        <SumCard label="Conversion Rate" value={`${totals.overallConversionRate ?? 0}%`} color="text-blue-600" />
        <SumCard label="Total Revenue"   value={formatCurrency(totals.totalRevenue ?? 0)} color="text-violet-600" />
      </div>

      {isLoading && <div className="h-64 bg-surface-100 rounded-xl animate-pulse" />}
      {isError && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Failed to load report.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">Retry</button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-14 text-gray-400">
          <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No confirmed leads for this period.</p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="space-y-4">
          {/* Trend chart */}
          {mounted && trend.length > 0 && (
            <div className="bg-white border border-surface-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Conversion Trend</h3>
              <Chart
                type="area"
                height={180}
                series={[{ name: "Confirmed", data: trend.map((d: any) => d.confirmed) }]}
                options={{
                  chart:    { toolbar: { show: false } },
                  colors:   ["#16a34a"],
                  fill:     { type: "gradient", gradient: { opacityFrom: 0.3, opacityTo: 0.0 } },
                  stroke:   { width: 2 },
                  xaxis: {
                    categories: trend.map((d: any) => {
                      const [, m, day] = d.date.split("-");
                      return `${day}/${m}`;
                    }),
                    labels: {
                      style: { fontSize: "10px" },
                      formatter: (v: string, i: unknown) =>
                        (i as number) % labelStep === 0 ? v : "",
                    },
                  },
                  dataLabels: { enabled: false },
                  tooltip: {
                    x: { formatter: (_val: string | number, opts?: { dataPointIndex?: number }) => trend[opts?.dataPointIndex ?? 0]?.date ?? String(_val) },
                  },
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Employee table */}
            <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100">
                <h3 className="text-sm font-semibold text-gray-700">By Employee</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-100">
                      {["Employee", "Leads", "Confirmed", "Conv %", "Revenue"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.employeeId} className="border-b border-surface-50 hover:bg-surface-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.employeeName}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.totalLeads}</td>
                        <td className="px-4 py-2.5 text-green-600 font-semibold">{r.confirmedLeads}</td>
                        <td className="px-4 py-2.5 text-blue-600 font-semibold">{r.conversionRate}%</td>
                        <td className="px-4 py-2.5 text-violet-600 font-medium">{formatCurrency(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Source breakdown */}
            <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100">
                <h3 className="text-sm font-semibold text-gray-700">By Lead Source</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-100">
                      {["Source", "Confirmed", "Revenue"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s: any) => (
                      <tr key={s.sourceName} className="border-b border-surface-50 hover:bg-surface-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{s.sourceName}</td>
                        <td className="px-4 py-2.5 text-green-600 font-semibold">{s.confirmed}</td>
                        <td className="px-4 py-2.5 text-violet-600 font-medium">{formatCurrency(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

function SumCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-surface-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
    </div>
  );
}
