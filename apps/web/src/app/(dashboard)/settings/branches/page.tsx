"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
} from "@/hooks/useBranches";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Role } from "@lms/types";

export default function BranchesSettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const [addModal, setAddModal] = useState(false);
  type Branch = {
    id: string;
    name: string;
    city: string;
    address?: string | null;
    isActive: boolean;
    _count?: {
      users?: number | null;
      leads?: number | null;
    } | null;
  };

  const [editModal, setEditModal] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", city: "", address: "" });

  useEffect(() => {
    if (user && user.role !== Role.ADMIN) router.replace("/settings");
  }, [user, router]);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Branches</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage office locations
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <Plus size={15} />
          Add Branch
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {((branches as Branch[] | undefined) ?? []).map((branch) => (
            <div
              key={branch.id}
              className="bg-white border border-surface-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {branch.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{branch.city}</p>
                {branch.address && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {branch.address}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400">
                    {branch._count?.users ?? 0} users
                  </span>
                  <span className="text-xs text-gray-400">
                    {branch._count?.leads ?? 0} leads
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={branch.isActive ? "success" : "gray"}>
                  {branch.isActive ? "Active" : "Inactive"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditModal(branch);
                    setForm({
                      name: branch.name,
                      city: branch.city,
                      address: branch.address ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal
        open={addModal}
        onClose={() => {
          setAddModal(false);
          setForm({ name: "", city: "", address: "" });
        }}
        title="Add Branch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                void createBranch.mutateAsync(form).then(() => {
                  setAddModal(false);
                  setForm({ name: "", city: "", address: "" });
                })
              }
              loading={createBranch.isPending}
              disabled={!form.name || !form.city}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Branch Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="City"
            required
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) =>
              setForm((p) => ({ ...p, address: e.target.value }))
            }
          />
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title="Edit Branch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editModal
                  ? void updateBranch
                      .mutateAsync({ id: editModal.id, ...form })
                      .then(() => setEditModal(null))
                  : undefined
              }
              loading={updateBranch.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Branch Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="City"
            required
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) =>
              setForm((p) => ({ ...p, address: e.target.value }))
            }
          />
        </div>
      </Modal>
    </div>
  );
}
