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

export default function CoursesSettingsPage() {
  const qc = useQueryClient();
  const { success, error } = useNotifications();
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  type Course = {
    id: string;
    name: string;
    code?: string | null;
    isActive: boolean;
  };

  const { data: courses, isLoading } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await api.get("/settings/courses");
      return data.data as Course[];
    },
  });

  const createCourse = useMutation({
    mutationFn: async (body: typeof form) => {
      await api.post("/settings/courses", body);
    },
    onSuccess: () => {
      success("Course created");
      void qc.invalidateQueries({ queryKey: ["courses"] });
      setAddModal(false);
      setForm({ name: "", code: "", description: "" });
    },
    onError: (e) => error("Failed", extractApiError(e)),
  });

  const toggleCourse = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/settings/courses/${id}`, { isActive });
    },
    onSuccess: () => {
      success("Course updated");
      void qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e) => error("Failed", extractApiError(e)),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage available programs
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <Plus size={15} />
          Add Course
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                {["Course Name", "Code", "Status", ""].map((h) => (
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
              {(courses ?? []).map((course) => (
                <tr key={course.id} className="hover:bg-surface-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {course.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {course.code ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={course.isActive ? "success" : "gray"}>
                      {course.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        void toggleCourse.mutateAsync({
                          id: course.id,
                          isActive: !course.isActive,
                        })
                      }
                      className="text-gray-400 hover:text-primary transition-colors"
                    >
                      {course.isActive ? (
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
        title="Add Course"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createCourse.mutateAsync(form)}
              loading={createCourse.isPending}
              disabled={!form.name.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Course Name"
            required
            placeholder="e.g. B.Tech Computer Science"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Short Code"
            placeholder="e.g. BTCS"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={3}
              placeholder="Optional description"
              aria-label="Course description"
              title="Course description"
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
