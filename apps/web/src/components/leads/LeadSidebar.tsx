"use client";

import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  BookOpen,
  UserCheck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  X,
  Check,
} from "lucide-react";
import { StatusTransition } from "./StatusTransition";
import { QuickAssignModal } from "./QuickAssignModal";
import { useAuthStore } from "@/store/auth";
import { canAssignLead } from "@lms/auth";
import { Role, type Lead } from "@lms/types";
import { useUpdateLead } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

function FollowUpCard({ lead }: { lead: Lead }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const updateLead = useUpdateLead(lead.id);

  const isOverdue =
    lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date();

  const PRESETS = [
    { label: "Tomorrow", days: 1 },
    { label: "3 Days", days: 3 },
    { label: "1 Week", days: 7 },
    { label: "2 Weeks", days: 14 },
  ];

  async function save(dateStr: string) {
    await updateLead.mutateAsync({
      nextFollowUpAt: new Date(dateStr).toISOString(),
    });
    setEditing(false);
  }

  async function clear() {
    await updateLead.mutateAsync({ nextFollowUpAt: null });
    setEditing(false);
  }

  async function applyPreset(days: number) {
    const date = dayjs().add(days, "day").hour(10).minute(0).second(0);
    await updateLead.mutateAsync({ nextFollowUpAt: date.toISOString() });
    setEditing(false);
  }

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Next Follow-up
        </p>
        <button
          onClick={() => {
            setEditing(!editing);
            setValue(
              lead.nextFollowUpAt
                ? dayjs(lead.nextFollowUpAt).format("YYYY-MM-DDTHH:mm")
                : "",
            );
          }}
          className="text-xs text-primary font-medium hover:underline"
        >
          {editing ? "Cancel" : lead.nextFollowUpAt ? "Change" : "Set"}
        </button>
      </div>

      {!editing &&
        (lead.nextFollowUpAt ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {dayjs(lead.nextFollowUpAt).format("D MMM YYYY")}
              </p>
              <p className="text-xs text-gray-500">
                {dayjs(lead.nextFollowUpAt).format("h:mm A")}
              </p>
              <p
                className={cn(
                  "text-xs font-medium mt-0.5",
                  isOverdue ? "text-red-600" : "text-gray-400",
                )}
              >
                {isOverdue ? "⚠ Overdue · " : ""}
                {dayjs(lead.nextFollowUpAt).fromNow()}
              </p>
            </div>
            <button
              onClick={() => void clear()}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
              title="Clear follow-up"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Not scheduled</p>
        ))}

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => void applyPreset(preset.days)}
                className="py-1.5 px-2 rounded-lg border border-surface-200 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">
              Custom date &amp; time
            </label>
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min={dayjs().format("YYYY-MM-DDTHH:mm")}
              placeholder="Select date and time"
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => value && void save(value)}
              disabled={!value || updateLead.isPending}
              className="py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              {updateLead.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => void clear()}
              disabled={updateLead.isPending || !lead.nextFollowUpAt}
              className="py-2 rounded-lg border border-surface-200 text-sm font-medium text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Calendar size={14} />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LeadSidebar({ lead }: { lead: Lead }) {
  const { user } = useAuthStore();
  const [showAssignModal, setShowAssignModal] = useState(false);

  const canTransition =
    !!user &&
    (user.role === Role.ADMIN ||
      user.role === Role.SUB_ADMIN ||
      lead.assignedTo?.id === user.id);

  const canAssign =
    !!user &&
    canAssignLead({
      id: user.id,
      role: user.role as Role,
      branchId: user.branchId,
    });

  const location = [lead.city, lead.district, lead.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="bg-white border border-surface-200 rounded-xl p-4">
        <StatusTransition
          leadId={lead.id}
          currentStatus={lead.status}
          canTransition={canTransition}
        />
      </div>

      {/* Contact card */}
      <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Contact
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-primary transition-colors flex-1"
            >
              <Phone size={14} className="text-gray-400" />
              {lead.phone}
            </a>
            <a
              href={`https://wa.me/91${(lead.whatsappNumber ?? lead.phone).replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`WhatsApp ${lead.whatsappNumber ?? lead.phone}`}
              className="p-1 rounded-lg hover:bg-green-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          </div>
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-primary transition-colors"
            >
              <Mail size={14} className="text-gray-400" />
              {lead.email}
            </a>
          )}
          {location && (
            <div className="flex items-start gap-2.5 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
              {location}
            </div>
          )}
        </div>
      </div>

      <FollowUpCard lead={lead} />

      {/* Assignment card */}
      <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Assigned To
          </p>
          {canAssign && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="text-xs text-primary font-medium hover:underline"
            >
              Change
            </button>
          )}
        </div>

        {lead.assignedTo ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {lead.assignedTo.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {lead.assignedTo.name}
              </p>
              <p className="text-xs text-gray-400">{lead.assignedTo.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <UserCheck size={14} className="text-amber-500" />
            <p className="text-sm text-amber-600 font-medium">Unassigned</p>
          </div>
        )}
      </div>

      {/* Courses card */}
      {lead.courses.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Interested Courses
          </p>
          <div className="space-y-1.5">
            {lead.courses.map((lc) => (
              <div key={lc.course.id} className="flex items-center gap-2">
                <BookOpen size={13} className="text-primary shrink-0" />
                <span className="text-sm text-gray-600">{lc.course.name}</span>
                {lc.isPrimary && (
                  <span className="text-xs text-primary bg-primary-50 px-1.5 py-0.5 rounded font-medium">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showAssignModal && (
        <QuickAssignModal
          leadId={lead.id}
          studentName={lead.studentName}
          currentAssignee={lead.assignedTo?.id ?? null}
          open
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
}
