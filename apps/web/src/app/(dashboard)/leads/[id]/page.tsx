"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { ArrowLeft, User, Clock, Pencil } from "lucide-react";
import { useLeadDetail, useLeadInteractions } from "@/hooks/useLeadDetail";
import { InteractionTimeline } from "@/components/leads/InteractionTimeline";
import { AddInteractionForm } from "@/components/leads/AddInteractionForm";
import { LeadSidebar } from "@/components/leads/LeadSidebar";
import { ConfirmedApplicationTab } from "@/components/leads/ConfirmedApplicationTab";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { LeadStatus } from "@lms/types";
import { cn } from "@/lib/utils";

type Tab = "overview" | "confirmed";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: lead, isLoading } = useLeadDetail(id);
  const { data: interactionData } = useLeadInteractions(id);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-surface-200 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-32 bg-surface-200 rounded-xl" />
            <div className="h-64 bg-surface-200 rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-40 bg-surface-200 rounded-xl" />
            <div className="h-32 bg-surface-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Lead not found</p>
        <Link
          href="/leads"
          className="text-primary text-sm mt-2 block hover:underline"
        >
          Back to leads
        </Link>
      </div>
    );
  }

  const hasAdmissionTab =
    lead.status === LeadStatus.CONFIRMED ||
    lead.status === LeadStatus.INTERESTED;

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "Overview & Timeline" },
    ...(hasAdmissionTab
      ? [{ key: "confirmed" as Tab, label: "Admission Application" }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={14} />
          Back to leads
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {lead.studentName}
              </h1>
              <StatusBadge status={lead.status} />
              {lead.isDuplicate && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                  Duplicate
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <User size={11} />
                Added by {lead.createdBy.name}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={11} />
                {dayjs(lead.createdAt).format("D MMM YYYY")}
              </span>
            </div>
          </div>

          {activeTab === "overview" ? (
            <Link
              href={`/leads/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 text-sm text-gray-600 hover:border-primary hover:text-primary transition-colors"
            >
              <Pencil size={13} /> Edit
            </Link>
          ) : (
            <div className="text-xs text-gray-400">
              Use the form Edit button
            </div>
          )}
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 bg-surface-100 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "confirmed" ? (
        <div className="bg-white border border-surface-200 rounded-xl p-6">
          <ConfirmedApplicationTab
            leadId={id}
            leadData={lead}
            leadStatus={lead.status}
            mode={lead.status === LeadStatus.CONFIRMED ? "view" : "edit"}
            confirmOnSave={lead.status !== LeadStatus.CONFIRMED}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border border-surface-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Student Information
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: "Father Name", value: lead.fatherName },
                  {
                    label: "Date of Birth",
                    value: lead.dateOfBirth
                      ? dayjs(lead.dateOfBirth).format("D MMM YYYY")
                      : null,
                  },
                  { label: "Qualification", value: lead.qualification },
                  { label: "School/College", value: lead.schoolCollege },
                  { label: "Board/University", value: lead.boardUniversity },
                  { label: "Passing Year", value: lead.passingYear },
                  {
                    label: "Percentage",
                    value: lead.percentage ? `${lead.percentage}%` : null,
                  },
                  { label: "WhatsApp", value: lead.whatsappNumber },
                  { label: "Alt. Phone", value: lead.alternatePhone },
                ]
                  .filter((f) => f.value)
                  .map((field) => (
                    <div key={field.label}>
                      <p className="text-xs text-gray-400">{field.label}</p>
                      <p className="text-sm text-gray-700 font-medium mt-0.5">
                        {String(field.value)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <AddInteractionForm leadId={id} />

            <div className="bg-white border border-surface-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">
                Activity Timeline
              </p>
              <InteractionTimeline
                interactions={interactionData?.interactions ?? []}
                leadId={id}
                remarks={lead.remarks}
              />
            </div>
          </div>

          <div>
            <LeadSidebar lead={lead} />
          </div>
        </div>
      )}
    </div>
  );
}
