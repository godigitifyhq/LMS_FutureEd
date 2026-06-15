"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { ArrowLeft, User, Clock, Pencil, MessageSquare, ExternalLink } from "lucide-react";
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

            {/* WhatsApp info panel — only shown for WhatsApp leads */}
            {(lead as any).isFromWhatsApp && (
              <div className="bg-white border border-green-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">WhatsApp Lead</p>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {(lead as any).waFirstMessage && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400">First Message</p>
                      <p className="text-sm text-gray-700 font-medium mt-0.5 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                        &ldquo;{(lead as any).waFirstMessage}&rdquo;
                      </p>
                    </div>
                  )}
                  {(lead as any).waMessageType && (lead as any).waMessageType !== "text" && (
                    <div>
                      <p className="text-xs text-gray-400">Message Type</p>
                      <p className="text-sm text-gray-700 font-medium mt-0.5 capitalize">
                        {(lead as any).waMessageType}
                      </p>
                    </div>
                  )}
                </div>

                <a
                  href={`https://wa.me/91${lead.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink size={12} />
                  Reply on WhatsApp
                </a>
              </div>
            )}

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
