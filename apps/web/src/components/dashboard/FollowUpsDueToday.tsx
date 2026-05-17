"use client";

import Link from "next/link";
import { Phone, AlertCircle, Clock } from "lucide-react";
import { useMyFollowUps } from "@/hooks/useDashboard";
import { StatusBadge } from "@/components/leads/StatusBadge";
import type { LeadStatus } from "@lms/types";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

type FollowUpLead = {
  id: string;
  nextFollowUpAt: string | number | Date | null;
  studentName: string;
  phone?: string | null;
  status: LeadStatus;
};

function LeadRow({
  lead,
  variant,
}: {
  lead: FollowUpLead;
  variant: "overdue" | "upcoming";
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-surface-50",
        variant === "overdue"
          ? "border-red-200 bg-red-50"
          : "border-amber-100 bg-amber-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {lead.studentName}
          </p>
          <StatusBadge status={lead.status as LeadStatus} size="sm" />
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {lead.phone}
          {lead.nextFollowUpAt && (
            <span
              className={cn(
                "ml-2 font-medium",
                variant === "overdue" ? "text-red-500" : "text-amber-600",
              )}
            >
              {variant === "overdue"
                ? `Overdue ${dayjs(lead.nextFollowUpAt).fromNow(true)} ago`
                : `Due ${dayjs(lead.nextFollowUpAt).fromNow()}`}
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window !== "undefined" && lead.phone) {
            window.location.href = `tel:${lead.phone}`;
          }
        }}
        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors ml-2 shrink-0"
        aria-label={`Call ${lead.studentName}`}
        title={`Call ${lead.studentName}`}
      >
        <Phone size={13} />
      </button>
    </Link>
  );
}

export function FollowUpsDueToday() {
  const { data, isLoading } = useMyFollowUps();

  const payload = (data ?? {}) as {
    overdue?: FollowUpLead[];
    upcoming?: FollowUpLead[];
  };
  const overdueLeads = payload.overdue ?? [];
  const upcomingLeads = payload.upcoming ?? [];
  const totalCount = overdueLeads.length + upcomingLeads.length;

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Follow-ups</h3>
        <div className="flex items-center gap-1.5">
          {overdueLeads.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              <AlertCircle size={10} />
              {overdueLeads.length} overdue
            </span>
          )}
          {upcomingLeads.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Clock size={10} />
              {upcomingLeads.length} upcoming
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-green-600 font-medium">All caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No follow-ups due</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {/* Overdue */}
          {overdueLeads.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
                Overdue
              </p>
              <div className="space-y-2">
                {overdueLeads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} variant="overdue" />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming (next 7 days) */}
          {upcomingLeads.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
                Upcoming (next 7 days)
              </p>
              <div className="space-y-2">
                {upcomingLeads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} variant="upcoming" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
