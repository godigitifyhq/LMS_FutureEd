"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Search, RefreshCw, Mail, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useAuthStore } from "@/store/auth";
import { Role } from "@lms/types";
import { formatDate, formatTimeAgo } from "@/lib/utils";

const ADMISSION_YEAR_START = 2017;
const ADMISSION_YEAR_END = new Date().getFullYear();
const ADMISSION_YEAR_OPTIONS = Array.from(
  { length: ADMISSION_YEAR_END - ADMISSION_YEAR_START + 1 },
  (_, index) => ADMISSION_YEAR_END - index,
);

export default function ConfirmedLeadsPage() {
  const { user } = useAuthStore();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [year, setYear] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["confirmed-leads", page, search, year],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: "CONFIRMED",
        page: String(page),
        pageSize: "20",
      });
      if (search) params.set("search", search);
      if (year) {
        params.set("dateFrom", `${year}-01-01`);
        params.set("dateTo", `${year}-12-31`);
      }
      const { data } = await api.get(`/leads?${params.toString()}`);
      return data.data as {
        leads: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    },
    refetchInterval: 60_000,
  });

  const leads = data?.leads ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admission</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Confirmed leads ready for admission processing
            {data && ` · ${data.total} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/direct-admissions"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors"
          >
            <Sparkles size={14} />
            Direct Admission
          </Link>
          <button
            type="button"
            title="Refresh"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg border border-surface-200 text-gray-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-surface-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Search by name, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by admission year"
          className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
        >
          <option value="">All Years</option>
          {ADMISSION_YEAR_OPTIONS.map((optionYear) => (
            <option key={optionYear} value={String(optionYear)}>
              {optionYear}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="No admissions yet"
          description="Confirmed leads will appear here"
        />
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {leads.map((lead: any) => {
              const sentAt = lead.confirmedApplication?.sentToStudentAt;
              const sentTo = lead.confirmedApplication?.sentToStudentEmail;
              const courseName =
                lead.courses?.find((c: any) => c.isPrimary)?.course?.name ??
                "—";

              return (
                <div
                  key={lead.id}
                  className="bg-white border border-green-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 wrap-break-word">
                        {lead.studentName}
                      </p>
                      {lead.fatherName && (
                        <p className="text-xs text-gray-400 wrap-break-word mt-0.5">
                          Father: {lead.fatherName}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-surface-200 text-gray-600 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                    >
                      View
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide mb-0.5">
                        Adm. ID
                      </p>
                      <p className="text-gray-700 font-medium">
                        {lead.confirmedApplication?.admissionId ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide mb-0.5">
                        File No.
                      </p>
                      <p className="text-gray-700 font-medium">
                        {lead.confirmedApplication?.fileNumber ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide mb-0.5">
                        Phone
                      </p>
                      <p className="text-gray-700 font-medium">{lead.phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide mb-0.5">
                        Course
                      </p>
                      <p className="text-gray-700 font-medium wrap-break-word">
                        {courseName}
                      </p>
                    </div>
                    {user?.role !== Role.EMPLOYEE && (
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide mb-0.5">
                          Counsellor
                        </p>
                        <p className="text-gray-700 font-medium wrap-break-word">
                          {lead.assignedTo?.name ?? (
                            <span className="text-amber-600">Unassigned</span>
                          )}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide mb-0.5">
                        Sent On
                      </p>
                      <p className="text-gray-700 font-medium">
                        {sentAt ? (
                          <span title={formatDate(sentAt)}>
                            {formatTimeAgo(sentAt)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {sentTo ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Mail size={11} />
                        {sentTo}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No email</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block bg-white border border-surface-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    {[
                      "Adm ID",
                      "File No.",
                      "Student",
                      "Phone",
                      "Course",
                      ...(user?.role !== Role.EMPLOYEE ? ["Counsellor"] : []),
                      "Sent On",
                      "Email",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {leads.map((lead: any) => {
                    const sentAt = lead.confirmedApplication?.sentToStudentAt;
                    const sentTo =
                      lead.confirmedApplication?.sentToStudentEmail;

                    return (
                      <tr key={lead.id} className="hover:bg-surface-50">
                        <td className="px-4 py-3">
                          {lead.confirmedApplication?.admissionId ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-primary-50 text-primary text-xs font-semibold border border-primary-200">
                              {lead.confirmedApplication.admissionId}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-medium">
                          {lead.confirmedApplication?.fileNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-800">
                            {lead.studentName}
                          </p>
                          {lead.fatherName && (
                            <p className="text-xs text-gray-400">
                              Father: {lead.fatherName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {lead.phone}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {lead.courses?.find((c: any) => c.isPrimary)?.course
                            ?.name ?? "—"}
                        </td>
                        {user?.role !== Role.EMPLOYEE && (
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {lead.assignedTo?.name ?? (
                              <span className="text-amber-600">Unassigned</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {sentAt ? (
                            <span title={formatDate(sentAt)}>
                              {formatTimeAgo(sentAt)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sentTo ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <Mail size={11} />
                              {sentTo}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              No email
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="px-3 py-1.5 rounded-lg border border-surface-200 text-gray-600 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                          >
                            View Lead
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {data && data.totalPages > 1 && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          )}
        </>
      )}
    </div>
  );
}
