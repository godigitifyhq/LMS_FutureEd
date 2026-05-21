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
  AlertCircle,
  CheckSquare,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { QuickNoteModal } from "./QuickNoteModal";
import { QuickAssignModal } from "./QuickAssignModal";
import { useMarkFollowUpDone } from "@/hooks/useLeads";
import { useAuthStore } from "@/store/auth";
import { Role } from "@lms/types";
import type { LeadSummary } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

type Props = {
  leads: LeadSummary[];
  // Optional bulk select props
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  showBulkSelect?: boolean;
};

type ActiveModal =
  | { type: "note"; lead: LeadSummary }
  | { type: "assign"; lead: LeadSummary }
  | null;

export function LeadCards({
  leads,
  selected,
  onToggle,
  showBulkSelect,
}: Props) {
  const { user } = useAuthStore();
  const isManager = user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN;
  const [modal, setModal] = useState<ActiveModal>(null);
  const markDone = useMarkFollowUpDone();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map((lead) => {
          const isOverdue =
            lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date();
          const primaryCourse = lead.courses.find((c) => c.isPrimary);
          const isChecked = selected?.has(lead.id) ?? false;

          return (
            <div
              key={lead.id}
              className={cn(
                "bg-white rounded-xl border p-4 space-y-3 hover:shadow-sm transition-shadow",
                isOverdue ? "border-red-200" : "border-surface-200",
                isChecked ? "ring-2 ring-primary ring-offset-1" : "",
              )}
            >
              {/* Header row */}
              <div className="flex items-start gap-2">
                {/* Bulk checkbox (mobile) */}
                {showBulkSelect && isManager && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle?.(lead.id)}
                    aria-label={`Select lead ${lead.studentName}`}
                    title={`Select lead ${lead.studentName}`}
                    className="accent-primary w-4 h-4 mt-0.5 flex-shrink-0"
                  />
                )}

                <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 hover:text-primary truncate">
                    {lead.studentName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>
                </Link>

                <StatusBadge status={lead.status} size="sm" />
              </div>

              {/* Meta */}
              <div className="space-y-1">
                {primaryCourse && (
                  <p className="text-xs text-gray-500">
                    📚 {primaryCourse.course.name}
                  </p>
                )}
                {lead.assignedTo && isManager && (
                  <p className="text-xs text-gray-500">
                    👤 {lead.assignedTo.name}
                  </p>
                )}
                {!lead.assignedTo && isManager && (
                  <p className="text-xs text-amber-600 font-medium">
                    ⚠ Unassigned
                  </p>
                )}
                {lead.nextFollowUpAt && (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      isOverdue ? "text-red-600" : "text-gray-500",
                    )}
                  >
                    🕐 {isOverdue ? "⚠ Overdue · " : ""}
                    {dayjs(lead.nextFollowUpAt).fromNow()}
                  </p>
                )}
                {lead.isDuplicate && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Duplicate
                  </p>
                )}
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1 pt-1 border-t border-surface-100">
                <a
                  href={`tel:${lead.phone}`}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-primary hover:bg-primary-50"
                >
                  <Phone size={13} /> Call
                </a>
                <a
                  href={`https://wa.me/91${lead.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-[#25D366] hover:bg-green-50"
                  title="WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
                <button
                  onClick={() => setModal({ type: "note", lead })}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-primary hover:bg-primary-50"
                >
                  <MessageSquare size={13} /> Note
                </button>
                {isManager && (
                  <button
                    onClick={() => setModal({ type: "assign", lead })}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-primary hover:bg-primary-50"
                  >
                    <UserCheck size={13} /> Assign
                  </button>
                )}
                {lead.nextFollowUpAt && (
                  <button
                    onClick={() =>
                      void markDone.mutateAsync({ leadId: lead.id })
                    }
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-green-600 hover:bg-green-50"
                    title="Mark follow-up done"
                  >
                    <CheckCircle size={13} /> Done
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal?.type === "note" && (
        <QuickNoteModal
          leadId={modal.lead.id}
          studentName={modal.lead.studentName}
          open
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "assign" && (
        <QuickAssignModal
          leadId={modal.lead.id}
          studentName={modal.lead.studentName}
          currentAssignee={modal.lead.assignedTo?.id ?? null}
          open
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
