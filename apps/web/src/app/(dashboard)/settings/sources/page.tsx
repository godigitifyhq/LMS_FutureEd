"use client";

import { useState } from "react";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import api from "@/lib/api";
import { useNotifications } from "@/store/notifications";
import { extractApiError } from "@/lib/utils";

export default function SourcesSettingsPage() {
  const qc = useQueryClient();
  const { success, error } = useNotifications();
  const [addModal, setAddModal] = useState(false);
  const [name, setName] = useState("");

  type LeadSource = {
    id: string;
    name: string;
    isActive: boolean;
  };

  const { data: sources, isLoading } = useQuery<LeadSource[]>({
    queryKey: ["lead-sources"],
    queryFn: async () => {
      const { data } = await api.get("/settings/sources");
      return data.data as LeadSource[];
    },
  });

  const createSource = useMutation({
    mutationFn: async () => {
      await api.post("/settings/sources", { name });
    },
    onSuccess: () => {
      success("Source type created");
      void qc.invalidateQueries({ queryKey: ["lead-sources"] });
      setAddModal(false);
      setName("");
    },
    onError: (e) => error("Failed", extractApiError(e)),
  });

  const toggleSource = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/settings/sources/${id}`, { isActive });
    },
    onSuccess: () => {
      success("Updated");
      void qc.invalidateQueries({ queryKey: ["lead-sources"] });
    },
    onError: (e) => error("Failed", extractApiError(e)),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lead Sources</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage lead source types
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <Plus size={15} />
          Add Source
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                {["Source Name", "Status", ""].map((h) => (
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
              {(sources ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-surface-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {s.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.isActive ? "success" : "gray"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        void toggleSource.mutateAsync({
                          id: s.id,
                          isActive: !s.isActive,
                        })
                      }
                      className="text-gray-400 hover:text-primary transition-colors"
                    >
                      {s.isActive ? (
                        <ToggleRight size={20} className="text-primary" />
                      ) : (
                        <ToggleLeft size={20} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add Lead Source"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createSource.mutateAsync()}
              loading={createSource.isPending}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <Input
          label="Source Name"
          required
          placeholder="e.g. WhatsApp Campaign"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Modal>
    </div>
  );
}
