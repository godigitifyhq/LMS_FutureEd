"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Phone,
  MessageSquare,
  UserCheck,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  FileText,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { QuickNoteModal } from "./QuickNoteModal";
import { QuickAssignModal } from "./QuickAssignModal";
import { useMarkFollowUpDone } from "@/hooks/useLeads";
import { useAuthStore } from "@/store/auth";
import { Role } from "@lms/types";
import type { LeadSummary, LeadFilters } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

type Props = {
  leads: LeadSummary[];
  filters: LeadFilters;
  onSortChange: (field: string) => void;
};

type ActiveModal =
  | { type: "note"; lead: LeadSummary }
  | { type: "assign"; lead: LeadSummary }
  | null;

function SortIcon({
  field,
  current,
  order,
}: {
  field: string;
  current: string | undefined;
  order: string | undefined;
}) {
  if (current !== field)
    return <ChevronUp size={12} className="text-gray-300" />;
  return order === "asc" ? (
    <ChevronUp size={12} className="text-primary" />
  ) : (
    <ChevronDown size={12} className="text-primary" />
  );
}

export function LeadTable({ leads, filters, onSortChange }: Props) {
  const { user } = useAuthStore();
  const isManager = user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN;
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const markDone = useMarkFollowUpDone();

  const columns = [
    { key: "studentName", label: "Student" },
    { key: "status", label: "Status" },
    { key: "courses", label: "Course" },
    { key: "assignedTo", label: "Counsellor", managerOnly: true },
    { key: "nextFollowUpAt", label: "Follow-up" },
    { key: "createdAt", label: "Added" },
    { key: "actions", label: "", sortable: false },
  ];

  return (
    <>
      <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                {columns
                  .filter((c) => !c.managerOnly || isManager)
                  .map((col) => (
                    <th
                      key={col.key}
                      onClick={() =>
                        col.key !== "actions" && onSortChange(col.key)
                      }
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide",
                        col.key !== "actions" &&
                          "cursor-pointer hover:text-gray-700 select-none",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.key !== "actions" && (
                          <SortIcon
                            field={col.key}
                            current={filters.sortBy}
                            order={filters.sortOrder}
                          />
                        )}
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {leads.map((lead) => {
                const isOverdue =
                  lead.nextFollowUpAt &&
                  new Date(lead.nextFollowUpAt) < new Date();
                const primaryCourse = lead.courses.find((c) => c.isPrimary);

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-surface-50 transition-colors"
                  >
                    {/* Student */}
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`}>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors">
                              {lead.studentName}
                            </p>
                            {/* Source badge — WhatsApp or FB Form */}
                            {(lead as any).isFromWhatsApp && (
                              <span
                                title="WhatsApp lead"
                                className="inline-flex items-center gap-0.5 text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium"
                              >
                                {/* WhatsApp icon */}
                                <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WA
                              </span>
                            )}
                            {!(lead as any).isFromWhatsApp && (lead as any).metaLeadgenId && (
                              <span
                                title={`Facebook Lead Form${(lead as any).metaAdName ? ` — ${(lead as any).metaAdName}` : ""}`}
                                className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium"
                              >
                                <FileText size={9} />
                                FB
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {lead.phone}
                          </p>
                          {lead.isDuplicate && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <AlertCircle size={10} />
                              Duplicate
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>

                    {/* Course */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">
                        {primaryCourse?.course.name ?? "—"}
                      </span>
                    </td>

                    {/* Counsellor — managers only */}
                    {isManager && (
                      <td className="px-4 py-3">
                        {lead.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {lead.assignedTo.name.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-xs text-gray-600">
                              {lead.assignedTo.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">
                            Unassigned
                          </span>
                        )}
                      </td>
                    )}

                    {/* Follow-up */}
                    <td className="px-4 py-3">
                      {lead.nextFollowUpAt ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isOverdue ? "text-red-600" : "text-gray-600",
                          )}
                        >
                          {isOverdue && "⚠ "}
                          {dayjs(lead.nextFollowUpAt).fromNow()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Added */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {dayjs(lead.createdAt).fromNow()}
                      </span>
                    </td>

                    {/* Quick Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Call */}
                        <a
                          href={`tel:${lead.phone}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-50 transition-colors"
                          title="Call"
                        >
                          <Phone size={14} />
                        </a>

                        {/* WhatsApp */}
                        <a
                          href={`https://wa.me/91${lead.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#25D366] hover:bg-green-50 transition-colors"
                          title="WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>

                        {/* Quick note */}
                        <button
                          onClick={() => setActiveModal({ type: "note", lead })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-50 transition-colors"
                          title="Add note"
                        >
                          <MessageSquare size={14} />
                        </button>

                        {/* Assign — managers only */}
                        {isManager && (
                          <button
                            onClick={() =>
                              setActiveModal({ type: "assign", lead })
                            }
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-50 transition-colors"
                            title="Assign"
                          >
                            <UserCheck size={14} />
                          </button>
                        )}

                        {/* Follow-up done */}
                        {lead.nextFollowUpAt && (
                          <button
                            onClick={() =>
                              void markDone.mutateAsync({
                                leadId: lead.id,
                              })
                            }
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Mark follow-up done"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {activeModal?.type === "note" && (
        <QuickNoteModal
          leadId={activeModal.lead.id}
          studentName={activeModal.lead.studentName}
          open
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal?.type === "assign" && (
        <QuickAssignModal
          leadId={activeModal.lead.id}
          studentName={activeModal.lead.studentName}
          currentAssignee={activeModal.lead.assignedTo?.id ?? null}
          open
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
