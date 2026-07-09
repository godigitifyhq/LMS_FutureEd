"use client";

import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  MessageSquare,
  Phone,
  Mail,
  Users,
  FileText,
  ArrowRightLeft,
  Pencil,
  AlertCircle,
  StickyNote,
  Clock,
} from "lucide-react";
import { InteractionType, Role } from "@lms/types";
import { useEditInteraction } from "@/hooks/useLeadDetail";
import { useAuthStore } from "@/store/auth";
import { cn, formatDurationHMS } from "@/lib/utils";
import isToday from "dayjs/plugin/isToday";
import isYesterday from "dayjs/plugin/isYesterday";

dayjs.extend(isToday);
dayjs.extend(isYesterday);

dayjs.extend(relativeTime);

type Interaction = {
  id: string;
  type: string;
  note: string | null;
  callRecordingUrl: string | null;
  callDurationSecs: number | null;
  statusBefore: string | null;
  statusAfter: string | null;
  isEdited: boolean;
  createdAt: Date | string;
  user: { id: string; name: string; role: string };
  editHistory: Array<{
    id: string;
    noteBefore: string;
    noteAfter: string;
    editedAt: string | Date;
    editedBy: { id: string; name: string };
  }>;
};

type Props = {
  interactions: Interaction[];
  leadId: string;
  remarks?: string | null;
};

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  NOTE: {
    icon: MessageSquare,
    color: "bg-blue-100 text-blue-600",
    label: "Note",
  },
  CALL: { icon: Phone, color: "bg-green-100 text-green-600", label: "Call" },
  EMAIL: { icon: Mail, color: "bg-purple-100 text-purple-600", label: "Email" },
  MEETING: {
    icon: Users,
    color: "bg-orange-100 text-orange-600",
    label: "Meeting",
  },
  DOCUMENT_UPLOADED: {
    icon: FileText,
    color: "bg-gray-100 text-gray-600",
    label: "Document",
  },
  STATUS_CHANGED: {
    icon: ArrowRightLeft,
    color: "bg-primary-100 text-primary",
    label: "Status Changed",
  },
  SMS: {
    icon: MessageSquare,
    color: "bg-teal-100 text-teal-600",
    label: "SMS",
  },
};

function groupByDate(interactions: Interaction[]) {
  const groups: Record<string, Interaction[]> = {};
  for (const item of interactions) {
    const date = dayjs(item.createdAt);
    let key: string;
    if (date.isToday()) key = "Today";
    else if (date.isYesterday()) key = "Yesterday";
    else key = date.format("D MMM YYYY");

    if (!groups[key]) groups[key] = [];
    groups[key]!.push(item);
  }
  return groups;
}

function AudioPlayer({ url }: { url: string }) {
  return (
    <div className="mt-2 px-3 py-2 bg-surface-50 rounded-lg border border-surface-200">
      <p className="text-xs text-gray-500 mb-1.5">Call Recording</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        src={url}
        controls
        className="w-full h-8"
        title="Call recording"
      />
    </div>
  );
}

function InteractionItem({
  interaction,
  leadId,
}: {
  interaction: Interaction;
  leadId: string;
}) {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState(interaction.note ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const editInteraction = useEditInteraction();

  const config = TYPE_CONFIG[interaction.type] ?? TYPE_CONFIG["NOTE"]!;
  const Icon = config.icon;
  const isManager = user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN;
  const canEdit =
    isManager &&
    interaction.type !== InteractionType.STATUS_CHANGED;

  const isDuplicateNote = interaction.note?.startsWith("[DUPLICATE DETECTED]");

  async function handleSave() {
    await editInteraction.mutateAsync({
      id: interaction.id,
      leadId,
      note: editNote,
    });
    setEditing(false);
  }

  return (
    <div className="flex gap-3">
      {/* Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          config.color,
        )}
      >
        <Icon size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">
              {interaction.user.name}
            </span>
            <span className="text-xs text-gray-400">{config.label}</span>
            {interaction.type === InteractionType.CALL &&
              interaction.callDurationSecs != null &&
              interaction.callDurationSecs > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">
                  <Clock size={9} />
                  {formatDurationHMS(interaction.callDurationSecs)}
                </span>
              )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="text-xs text-gray-400"
              title={dayjs(interaction.createdAt).format("D MMM YYYY, h:mm A")}
            >
              {dayjs(interaction.createdAt).fromNow()}
            </span>
            {canEdit && (
              <button
                onClick={() => setEditing(!editing)}
                title="Edit interaction"
                className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
              >
                <Pencil size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Status change */}
        {interaction.type === InteractionType.STATUS_CHANGED && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
              {interaction.statusBefore}
            </span>
            <ArrowRightLeft size={10} className="text-gray-400" />
            <span className="text-xs px-2 py-0.5 bg-primary-50 rounded text-primary font-medium">
              {interaction.statusAfter}
            </span>
          </div>
        )}

        {/* Duplicate tag */}
        {isDuplicateNote && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-700">
            <AlertCircle size={11} />
            <span>Duplicate Detected</span>
          </div>
        )}

        {/* Note */}
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              title="Edit interaction note"
              placeholder="Enter your interaction note here..."
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                title="Cancel editing"
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 border border-surface-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={editInteraction.isPending}
                title="Save changes"
                className="text-xs font-medium text-white bg-primary hover:bg-primary-800 px-3 py-1 rounded-lg disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          interaction.note && (
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              {isDuplicateNote
                ? interaction.note.replace("[DUPLICATE DETECTED]", "").trim()
                : interaction.note}
            </p>
          )
        )}

        {/* Call recording */}
        {interaction.callRecordingUrl && (
          <AudioPlayer url={interaction.callRecordingUrl} />
        )}

        {/* Edit history */}
        {interaction.isEdited && interaction.editHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1 flex items-center gap-1"
          >
            <Pencil size={10} />
            Edited · {interaction.editHistory.length} version
            {interaction.editHistory.length > 1 ? "s" : ""}
          </button>
        )}

        {showHistory && (
          <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-surface-200">
            {interaction.editHistory.map((edit) => (
              <div key={edit.id} className="text-xs text-gray-500">
                <span className="font-medium">{edit.editedBy.name}</span> edited{" "}
                <span className="text-gray-400">
                  {dayjs(edit.editedAt).fromNow()}
                </span>
                <div className="mt-1 p-2 bg-surface-50 rounded text-xs text-gray-500 line-through">
                  {edit.noteBefore}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function InteractionTimeline({ interactions, leadId, remarks }: Props) {
  const grouped = groupByDate(interactions);

  if (interactions.length === 0 && !remarks) {
    return (
      <div className="text-center py-10">
        <MessageSquare size={28} className="text-surface-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No interactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {remarks && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-amber-100 text-amber-600">
            <StickyNote size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">Import Remark</span>
              <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100">from Excel</span>
            </div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{remarks}</p>
          </div>
        </div>
      )}
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-surface-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2">
              {date}
            </span>
            <div className="flex-1 h-px bg-surface-200" />
          </div>

          {/* Items */}
          <div className="space-y-4">
            {items.map((item) => (
              <InteractionItem
                key={item.id}
                interaction={item}
                leadId={leadId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
