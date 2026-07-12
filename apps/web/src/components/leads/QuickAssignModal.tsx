"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAssignLead, useAssignableUsers } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

const ROLE_TAGS: Record<string, string> = {
  ADMIN: "Admin",
  SUB_ADMIN: "Sub Admin",
};

type Props = {
  leadId: string;
  studentName: string;
  currentAssignee: string | null;
  open: boolean;
  onClose: () => void;
};

export function QuickAssignModal({
  leadId,
  studentName,
  currentAssignee,
  open,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState(currentAssignee ?? "");
  const [reason, setReason] = useState("");
  const { data: employees = [] } = useAssignableUsers();
  const assignLead = useAssignLead();

  async function handleAssign() {
    if (!selectedId) return;
    const payload = {
      leadId,
      assignedToId: selectedId,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    await assignLead.mutateAsync(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Assign lead — {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                    selectedId === emp.id
                      ? "border-primary bg-primary-50"
                      : "border-surface-200 hover:border-primary-300",
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {emp.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {emp.name}
                    {ROLE_TAGS[emp.role] && (
                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                        ({ROLE_TAGS[emp.role]})
                      </span>
                    )}
                  </span>
                  {selectedId === emp.id && (
                    <span className="ml-auto text-primary text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary"
          />

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleAssign()}
              disabled={!selectedId || assignLead.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-800 disabled:opacity-50"
            >
              {assignLead.isPending ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
