"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLeadDetail, useUpdateLead } from "@/hooks/useLeadDetail";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const QUALIFICATIONS = ["TENTH", "TWELFTH", "GRADUATION", "POST_GRADUATION", "OTHER"];
const QUAL_LABELS: Record<string, string> = {
  TENTH: "10th", TWELFTH: "12th", GRADUATION: "Graduation",
  POST_GRADUATION: "Post Graduation", OTHER: "Other",
};

export default function EditLeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lead, isLoading } = useLeadDetail(id);
  const updateLead = useUpdateLead(id);

  const [showCourse, setShowCourse] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    phone: "", studentName: "", dateOfBirth: "", fatherName: "",
    courseIds: [] as string[], sourceId: "", sourceOther: "",
    qualification: "", schoolCollege: "", boardUniversity: "",
    passingYear: "", percentage: "", village: "", sector: "",
    city: "", district: "", state: "", alternatePhone: "",
    whatsappNumber: "", email: "", nextFollowUpAt: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: courses } = useQuery({
    queryKey: ["courses", "active"],
    queryFn: async () => {
      const { data } = await api.get("/settings/courses?isActive=true");
      return data.data as Array<{ id: string; name: string }>;
    },
  });

  const { data: sources } = useQuery({
    queryKey: ["lead-sources"],
    queryFn: async () => {
      const { data } = await api.get("/settings/sources");
      return data.data as Array<{ id: string; name: string }>;
    },
  });

  useEffect(() => {
    if (!lead) return;
    setForm({
      phone: lead.phone ?? "",
      studentName: lead.studentName ?? "",
      dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).split("T")[0]! : "",
      fatherName: lead.fatherName ?? "",
      courseIds: lead.courses?.map((c: { course: { id: string } }) => c.course.id) ?? [],
      sourceId: lead.sourceId ?? "",
      sourceOther: lead.sourceOther ?? "",
      qualification: lead.qualification ?? "",
      schoolCollege: lead.schoolCollege ?? "",
      boardUniversity: lead.boardUniversity ?? "",
      passingYear: lead.passingYear ? String(lead.passingYear) : "",
      percentage: lead.percentage ? String(lead.percentage) : "",
      village: lead.village ?? "",
      sector: lead.sector ?? "",
      city: lead.city ?? "",
      district: lead.district ?? "",
      state: lead.state ?? "",
      alternatePhone: lead.alternatePhone ?? "",
      whatsappNumber: lead.whatsappNumber ?? "",
      email: lead.email ?? "",
      nextFollowUpAt: lead.nextFollowUpAt
        ? new Date(lead.nextFollowUpAt as unknown as string).toISOString().slice(0, 16)
        : "",
    });
  }, [lead]);

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.phone.match(/^[6-9]\d{9}$/)) errs["phone"] = "Enter valid 10-digit Indian number";
    if (!form.studentName.trim()) errs["studentName"] = "Student name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      phone: form.phone,
      studentName: form.studentName,
    };
    if (form.dateOfBirth) payload["dateOfBirth"] = form.dateOfBirth;
    if (form.fatherName) payload["fatherName"] = form.fatherName;
    if (form.courseIds.length) payload["courseIds"] = form.courseIds;
    if (form.sourceId) payload["sourceId"] = form.sourceId;
    if (form.sourceOther) payload["sourceOther"] = form.sourceOther;
    if (form.qualification) payload["qualification"] = form.qualification;
    if (form.schoolCollege) payload["schoolCollege"] = form.schoolCollege;
    if (form.boardUniversity) payload["boardUniversity"] = form.boardUniversity;
    if (form.passingYear) payload["passingYear"] = Number(form.passingYear);
    if (form.percentage) payload["percentage"] = Number(form.percentage);
    if (form.village) payload["village"] = form.village;
    if (form.sector) payload["sector"] = form.sector;
    if (form.city) payload["city"] = form.city;
    if (form.district) payload["district"] = form.district;
    if (form.state) payload["state"] = form.state;
    if (form.alternatePhone) payload["alternatePhone"] = form.alternatePhone;
    if (form.whatsappNumber) payload["whatsappNumber"] = form.whatsappNumber;
    if (form.email) payload["email"] = form.email;
    if (form.nextFollowUpAt) payload["nextFollowUpAt"] = new Date(form.nextFollowUpAt).toISOString();

    try {
      await updateLead.mutateAsync(payload);
      toast.success("Lead updated");
      router.push(`/leads/${id}`);
    } catch {
      toast.error("Failed to update lead");
    }
  }

  if (isLoading) {
    return <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-surface-200 rounded-xl" />)}
    </div>;
  }

  if (!lead) return <p className="text-center text-gray-400 py-20">Lead not found</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Edit Lead</h1>
        <p className="text-sm text-gray-500 mt-1">{lead.studentName}</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        {/* Basic */}
        <div className="bg-white border border-surface-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Basic Information</p>
          <Input label="Mobile Number" required placeholder="10-digit mobile number"
            value={form.phone} onChange={(e) => set("phone", e.target.value)}
            error={errors["phone"]} maxLength={10} inputMode="numeric" />
          <Input label="Student Name" required placeholder="As per Matric record"
            value={form.studentName} onChange={(e) => set("studentName", e.target.value)}
            error={errors["studentName"]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date of Birth" type="date"
              value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            <Input label="Father's Name" placeholder="Father's full name"
              value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} />
          </div>
        </div>

        {/* Course & Source */}
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowCourse(!showCourse)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-50 transition-colors">
            <span className="text-sm font-semibold text-gray-700">Course & Source Information</span>
            {showCourse ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showCourse && (
            <div className="px-5 pb-5 space-y-4 border-t border-surface-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interested Courses</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {courses?.map((course) => (
                    <label key={course.id} className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                      form.courseIds.includes(course.id) ? "border-primary bg-primary-50" : "border-surface-200 hover:border-primary-300",
                    )}>
                      <input type="checkbox" checked={form.courseIds.includes(course.id)}
                        onChange={(e) => {
                          if (e.target.checked) set("courseIds", [...form.courseIds, course.id]);
                          else set("courseIds", form.courseIds.filter((cid) => cid !== course.id));
                        }} className="accent-primary" />
                      <span className="text-xs text-gray-700">{course.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lead Source</label>
                <select value={form.sourceId} onChange={(e) => set("sourceId", e.target.value)}
                  aria-label="Lead source" title="Lead source"
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white">
                  <option value="">Select source type</option>
                  {sources?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {form.sourceId && sources?.find((s) => s.id === form.sourceId)?.name === "Others" && (
                <Input label="Specify Source" placeholder="Describe the source"
                  value={form.sourceOther} onChange={(e) => set("sourceOther", e.target.value)} />
              )}
            </div>
          )}
        </div>

        {/* More info */}
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowMore(!showMore)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-50 transition-colors">
            <span className="text-sm font-semibold text-gray-700">Additional Student Information</span>
            {showMore ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showMore && (
            <div className="px-5 pb-5 space-y-4 border-t border-surface-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Qualification</label>
                <select value={form.qualification} onChange={(e) => set("qualification", e.target.value)}
                  aria-label="Qualification" title="Qualification"
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white">
                  <option value="">Select qualification</option>
                  {QUALIFICATIONS.map((q) => <option key={q} value={q}>{QUAL_LABELS[q]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="School/College" placeholder="Institution name" value={form.schoolCollege} onChange={(e) => set("schoolCollege", e.target.value)} />
                <Input label="Board/University" placeholder="e.g. CBSE" value={form.boardUniversity} onChange={(e) => set("boardUniversity", e.target.value)} />
                <Input label="Passing Year" type="number" placeholder="e.g. 2023" value={form.passingYear} onChange={(e) => set("passingYear", e.target.value)} />
                <Input label="Percentage/Marks %" type="number" placeholder="e.g. 75" value={form.percentage} onChange={(e) => set("percentage", e.target.value)} />
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Village/Quarter/Plot" value={form.village} onChange={(e) => set("village", e.target.value)} />
                <Input label="Sector/Colony/P.O." value={form.sector} onChange={(e) => set("sector", e.target.value)} />
                <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
                <Input label="District" value={form.district} onChange={(e) => set("district", e.target.value)} />
                <Input label="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Additional Contact</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Alternate Mobile" placeholder="10-digit number" value={form.alternatePhone} onChange={(e) => set("alternatePhone", e.target.value)} maxLength={10} inputMode="numeric" />
                <Input label="WhatsApp Number" placeholder="10-digit number" value={form.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} maxLength={10} inputMode="numeric" />
                <Input label="Email ID" type="email" placeholder="student@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} className="col-span-2" />
              </div>
            </div>
          )}
        </div>

        {/* Follow-up */}
        <div className="bg-white border border-surface-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Next Follow-up Date" type="datetime-local"
              value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={updateLead.isPending}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
