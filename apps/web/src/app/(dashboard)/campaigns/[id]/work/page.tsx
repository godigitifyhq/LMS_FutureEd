"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  ArrowLeft,
  ChevronLeft,
  CheckCircle2,
  Megaphone,
  Pencil,
  Phone,
  PhoneCall,
  PhoneMissed,
  Star,
  User,
} from "lucide-react";
import { LeadStatus, Role } from "@lms/types";
import { useAuthStore } from "@/store/auth";
import { SearchByField, type SearchField } from "@/components/filters/SearchByField";
import { StatusMultiSelect } from "@/components/filters/StatusMultiSelect";
import { AssigneeMultiSelect } from "@/components/filters/AssigneeMultiSelect";
import { DatePresetSelect } from "@/components/filters/DatePresetSelect";
import type { DateRange } from "@/lib/dateRanges";
import {
  useCampaignWork,
  useCampaignQueue,
  useSaveCampaignProgress,
  type QueueLead,
  type QueueTab,
} from "@/hooks/useCampaigns";
import { useLeadDetail, useLeadInteractions } from "@/hooks/useLeadDetail";
import { InteractionTimeline } from "@/components/leads/InteractionTimeline";
import { AddInteractionForm } from "@/components/leads/AddInteractionForm";
import { LeadSidebar } from "@/components/leads/LeadSidebar";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDurationHMS } from "@/lib/utils";

dayjs.extend(relativeTime);

// Ignore shortcuts while the user is typing.
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

// ─────────────────────────────────────────────────────────────────────────
// Workspace, modelled on TeleCRM's campaign screen:
//   left  — the campaign's leads as cards, NEW / ACTIVE tabs with counts,
//           search + status filter, the current lead highlighted
//   right — the selected lead's full detail, NEXT on top
// Next/Prev walk the list shown on the left, so whatever the filter shows
// is exactly what Next will step through.
// ─────────────────────────────────────────────────────────────────────────
export default function CampaignWorkPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const leadParam = sp.get("lead");

  // Tab is URL state (?tab=) so resume, refresh and back/forward all agree.
  const tab: QueueTab = sp.get("tab") === "active" ? "active" : "new";
  const setTab = useCallback(
    (t: QueueTab) => {
      const next = new URLSearchParams(sp.toString());
      next.set("tab", t);
      router.replace(`/campaigns/${campaignId}/work?${next.toString()}`);
    },
    [campaignId, router, sp],
  );
  const { user } = useAuthStore();
  const isManager = user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN;
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dates, setDates] = useState<DateRange>({});

  // Resume cursor lives server-side per (me, campaign); only consulted when
  // the URL doesn't already say which lead is open.
  const work = useCampaignWork(campaignId, leadParam);
  const queue = useCampaignQueue(campaignId, {
    tab,
    ...(search ? { search, searchField } : {}),
    ...(tab === "active" && statuses.length ? { statuses: statuses.join(",") } : {}),
    ...(isManager && assignees.length ? { assigneeIds: assignees.join(",") } : {}),
    ...(dates.dateFrom ? { dateFrom: dates.dateFrom } : {}),
    ...(dates.dateTo ? { dateTo: dates.dateTo } : {}),
  });
  const saveProgress = useSaveCampaignProgress();

  const list = useMemo(() => queue.data?.leads ?? [], [queue.data]);
  const currentId = leadParam ?? work.data?.lead?.id ?? null;
  const index = currentId ? list.findIndex((l) => l.id === currentId) : -1;
  const prevId = index > 0 ? list[index - 1]!.id : null;
  const nextId = index >= 0 && index < list.length - 1 ? list[index + 1]!.id : null;

  const { data: lead, isLoading: leadLoading } = useLeadDetail(currentId ?? "");
  const { data: interactionData } = useLeadInteractions(currentId ?? "");

  const open = useCallback(
    (target: string | null) => {
      if (!target) return;
      const next = new URLSearchParams(sp.toString());
      next.set("lead", target);
      next.set("tab", tab);
      router.replace(`/campaigns/${campaignId}/work?${next.toString()}`);
      saveProgress.mutate({ id: campaignId, lastLeadId: target });
    },
    [campaignId, router, sp, tab, saveProgress],
  );

  // Once the server has resumed us, pin that lead in the URL. If the resumed
  // lead is on the other tab (it was already worked), switch tabs to match.
  useEffect(() => {
    const resumed = work.data?.lead;
    if (!leadParam && resumed) {
      const t: QueueTab = resumed.status === LeadStatus.NEW ? "new" : "active";
      const next = new URLSearchParams(sp.toString());
      next.set("lead", resumed.id);
      next.set("tab", t);
      router.replace(`/campaigns/${campaignId}/work?${next.toString()}`);
    }
  }, [work.data?.lead, leadParam, campaignId, router, sp]);

  // If the current lead is not in this tab's list (e.g. it just got worked
  // and moved from NEW to ACTIVE), keep showing it; Next then continues from
  // the top of the list.
  const effectiveNextId = index === -1 && list.length > 0 && currentId ? list[0]!.id : nextId;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") open(effectiveNextId);
      if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") open(prevId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, effectiveNextId, prevId]);

  if (work.isError) {
    return (
      <EmptyState
        title="Couldn't open this campaign"
        description="It may not exist, or you may not be assigned to it."
        action={{ label: "Back to campaigns", onClick: () => router.push("/campaigns") }}
      />
    );
  }

  const campaign = queue.data?.campaign ?? work.data?.campaign;
  const counts = queue.data?.counts ?? { new: 0, active: 0 };

  return (
    // Full-height two-pane layout inside the dashboard shell
    <div className="-m-4 lg:-m-6 h-[calc(100vh-4rem)] flex overflow-hidden bg-surface-50">
      {/* ── Left: leads panel ── */}
      <aside className="w-[340px] xl:w-[380px] shrink-0 border-r border-surface-200 bg-white flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-surface-200">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/campaigns" className="p-1 -ml-1 rounded-lg text-gray-500 hover:bg-surface-100 hover:text-gray-800" title="All campaigns">
              <ArrowLeft size={18} />
            </Link>
            <Megaphone size={16} className="text-primary shrink-0" />
            <span className="font-semibold text-gray-900 truncate">{campaign?.name ?? "Campaign"}</span>
          </div>

          {/* Tabs */}
          <div className="flex mt-3 -mb-2">
            {(["new", "active"] as QueueTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 pb-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors",
                  tab === t ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-700",
                )}
              >
                {t === "new" ? "New" : "Active"}
                <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums", tab === t ? "bg-primary/10 text-primary" : "bg-surface-100 text-gray-500")}>
                  {t === "new" ? counts.new : counts.active}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter row — same chips as the Leads page */}
        <div className="px-3 py-2 border-b border-surface-200 space-y-2">
          <SearchByField
            value={search}
            field={searchField}
            onChange={({ search: q, field }) => { setSearch(q); setSearchField(field); }}
            placeholder="Name or phone"
            compact
          />
          <div className="flex flex-wrap gap-1.5">
            {tab === "active" && (
              <StatusMultiSelect value={statuses} onChange={setStatuses} exclude={[LeadStatus.NEW]} />
            )}
            {isManager && <AssigneeMultiSelect value={assignees} onChange={setAssignees} />}
            <DatePresetSelect value={dates} onChange={setDates} label="Added" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {queue.isLoading ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : list.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-600">
                {search || statuses.length || assignees.length || dates.dateFrom || dates.dateTo ? "No leads match these filters." : tab === "new" ? "No new leads left in this campaign." : "No worked leads yet."}
              </p>
              {tab === "new" && counts.active > 0 && !search && (
                <button onClick={() => setTab("active")} className="mt-2 text-sm text-primary underline underline-offset-2">
                  Go to Active leads ({counts.active})
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-surface-100">
              {list.map((l, i) => (
                <LeadCard key={l.id} lead={l} position={i + 1} active={l.id === currentId} onClick={() => open(l.id)} />
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Right: lead detail ── */}
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Top bar: campaign chip + position + NEXT */}
        <div className="px-5 py-2.5 border-b border-surface-200 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 text-primary text-xs font-semibold truncate max-w-[220px]">
              <Megaphone size={12} /> {campaign?.name ?? "…"}
            </span>
            <span className="text-sm text-gray-500 tabular-nums">
              {index >= 0 ? <><strong className="text-gray-800">{index + 1}</strong> of {list.length}</> : list.length > 0 ? `${list.length} in list` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => open(prevId)}
              disabled={!prevId}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium",
                prevId ? "border-surface-200 bg-white text-gray-700 hover:bg-surface-50" : "border-surface-100 text-gray-300 cursor-not-allowed",
              )}
              title="Previous (←)"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              onClick={() => open(effectiveNextId)}
              disabled={!effectiveNextId}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide",
                effectiveNextId ? "bg-primary text-white hover:bg-primary-800" : "bg-surface-100 text-gray-400 cursor-not-allowed",
              )}
              title="Next (→)"
            >
              {!effectiveNextId && list.length > 0 ? <><CheckCircle2 size={16} /> Done</> : <><PhoneCall size={15} /> Next</>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          {!currentId ? (
            work.isLoading || queue.isLoading ? (
              <div className="p-10 flex justify-center"><Spinner /></div>
            ) : (
              <EmptyState
                icon={<Megaphone size={28} />}
                title="Pick a lead"
                description="Choose a lead from the panel on the left to start working this campaign."
              />
            )
          ) : leadLoading || !lead ? (
            <div className="p-10 flex justify-center"><Spinner /></div>
          ) : (
            <div className="space-y-4 max-w-6xl">
              {/* Lead header */}
              <div className="bg-white border border-surface-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900 truncate">{lead.studentName}</h2>
                        <StatusBadge status={lead.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 flex-wrap">
                        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-primary font-medium">
                          <Phone size={13} /> {lead.phone}
                        </a>
                        {lead.email && <span className="text-gray-500">{lead.email}</span>}
                        {lead.courses?.length > 0 && (
                          <span className="text-gray-500">{lead.courses.map((c) => c.course.name).join(", ")}</span>
                        )}
                        <span className="text-xs text-gray-400">Added {dayjs(lead.createdAt).format("D MMM YYYY")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/leads/${lead.id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-surface-200 rounded-lg hover:bg-surface-50">
                      <Pencil size={14} /> Edit
                    </Link>
                    <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-surface-200 rounded-lg hover:bg-surface-50">
                      Full view
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-5 pt-4 border-t border-surface-100">
                  {[
                    { label: "Father Name", value: lead.fatherName },
                    { label: "City / District", value: [lead.city, lead.district].filter(Boolean).join(", ") },
                    { label: "Qualification", value: lead.qualification },
                    { label: "School / College", value: lead.schoolCollege },
                    { label: "Passing Year", value: lead.passingYear },
                    { label: "Percentage", value: lead.percentage != null ? `${lead.percentage}%` : null },
                    { label: "Source", value: lead.sourceOther },
                    { label: "Alt. Phone", value: lead.alternatePhone },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">{f.label}</p>
                      <p className="text-sm text-gray-800">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
                {lead.remarks && <p className="mt-3 text-sm text-gray-600 bg-surface-50 rounded-lg px-3 py-2">{lead.remarks}</p>}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 space-y-4">
                  <AddInteractionForm leadId={lead.id} />
                  <div className="bg-white border border-surface-200 rounded-xl p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">Activity Timeline</p>
                    <InteractionTimeline interactions={interactionData?.interactions ?? []} assignments={interactionData?.assignments ?? []} leadId={lead.id} remarks={lead.remarks} />
                  </div>
                </div>
                <div>
                  <LeadSidebar lead={lead} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Lead card (left panel) ─────────────────────────────────────────────────
function LeadCard({ lead, position, active, onClick }: { lead: QueueLead; position: number; active: boolean; onClick: () => void }) {
  const lc = lead.lastCall;
  const connected = lc?.outcome === "CONNECTED";
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left px-4 py-3 transition-colors border-l-[3px]",
          active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-surface-50",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-semibold truncate", active ? "text-primary" : "text-gray-900")}>{lead.studentName}</p>
            <p className="text-xs text-gray-500 tabular-nums">{lead.phone}</p>
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums shrink-0">#{position}</span>
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[11px] text-gray-500">Status:</span>
          <StatusBadge status={lead.status as LeadStatus} />
          <Star size={12} className="text-gray-300" />
          {lead.course && <span className="text-[11px] text-gray-500 truncate">{lead.course}</span>}
        </div>

        {lc ? (
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
            {connected ? <PhoneCall size={12} className="text-green-600" /> : <PhoneMissed size={12} className="text-amber-500" />}
            <span className="font-medium text-gray-700">{lc.durationSecs ? formatDurationHMS(lc.durationSecs) : "0s"}</span>
            <span>·</span>
            <span className={cn("uppercase tracking-wide", connected ? "text-green-700" : "text-amber-700")}>
              {(lc.outcome ?? "no feedback").replace(/_/g, " ").toLowerCase()}
            </span>
            <span className="ml-auto">{dayjs(lc.at).fromNow()}</span>
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-gray-400">
            Added {dayjs(lead.createdAt).fromNow()}
            {lead.nextFollowUpAt && <> · follow-up {dayjs(lead.nextFollowUpAt).fromNow()}</>}
          </p>
        )}
      </button>
    </li>
  );
}
