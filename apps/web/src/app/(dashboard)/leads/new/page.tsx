"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import axios from "axios";
import api from "@/lib/api";
import { useNotifications } from "@/store/notifications";
import { useQuery } from "@tanstack/react-query";
import { extractApiError } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Gender, MaritalStatus } from "@lms/types";

const QUALIFICATIONS = [
  "TENTH",
  "TWELFTH",
  "GRADUATION",
  "POST_GRADUATION",
  "OTHER",
];
const QUAL_LABELS: Record<string, string> = {
  TENTH: "10th",
  TWELFTH: "12th",
  GRADUATION: "Graduation",
  POST_GRADUATION: "Post Graduation",
  OTHER: "Other",
};

export default function NewLeadPage() {
  const router = useRouter();
  const { success, error } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [showCourse, setShowCourse] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{
    existingLeadId: string;
    message: string;
  } | null>(null);
  const [revivalModal, setRevivalModal] = useState<{
    lostLeadId: string;
    message: string;
  } | null>(null);

  const [form, setForm] = useState({
    phone: "",
    studentName: "",
    dateOfBirth: "",
    fatherName: "",
    gender: "",
    maritalStatus: "",
    courseIds: [] as string[],
    sourceId: "",
    sourceOther: "",
    qualification: "",
    schoolCollege: "",
    boardUniversity: "",
    passingYear: "",
    percentage: "",
    village: "",
    sector: "",
    city: "",
    district: "",
    state: "",
    alternatePhone: "",
    whatsappNumber: "",
    email: "",
    nextFollowUpAt: "",
    sendEmail: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateLead, setDuplicateLead] = useState<{
    id: string;
    name: string;
    phone: string;
    status: string;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Debounced phone duplicate check — fires as soon as 10 valid digits are entered
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    if (!form.phone.match(/^[6-9]\d{9}$/)) {
      setDuplicateLead(null);
      setCheckingDuplicate(false);
      return;
    }
    setCheckingDuplicate(true);
    phoneTimerRef.current = setTimeout(async () => {
      try {
        // Exact-match endpoint — no pagination, guaranteed to find any duplicate
        const { data } = await api.get(
          `/leads/check-duplicate?phone=${form.phone}`,
        );
        const leads = data?.data?.leads as
          | Array<{
              id: string;
              studentName: string;
              phone: string;
              status: string;
              isDuplicate: boolean;
            }>
          | undefined;
        // Show the first non-duplicate lead (the original, not a dup-of-dup)
        const match = leads?.find((l) => !l.isDuplicate) ?? leads?.[0];
        if (match) {
          setDuplicateLead({
            id: match.id,
            name: match.studentName,
            phone: match.phone,
            status: match.status,
          });
        } else {
          setDuplicateLead(null);
        }
      } catch {
        setDuplicateLead(null);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);
  }, [form.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch courses and sources
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

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  }

  function blurValidate(field: string, value: string) {
    const currentYear = new Date().getFullYear();
    let msg = "";
    if (field === "phone" && value && !value.match(/^[6-9]\d{9}$/))
      msg = "Must be 10 digits starting with 6, 7, 8 or 9";
    if (field === "alternatePhone" && value && !value.match(/^[6-9]\d{9}$/))
      msg = "Must be 10 digits starting with 6, 7, 8 or 9";
    if (field === "whatsappNumber" && value && !value.match(/^[6-9]\d{9}$/))
      msg = "Must be 10 digits starting with 6, 7, 8 or 9";
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      msg = "Enter a valid email address";
    if (field === "passingYear" && value) {
      const yr = Number(value);
      if (yr < 1960 || yr > currentYear + 1)
        msg = `Year must be between 1960 and ${currentYear + 1}`;
    }
    if (field === "percentage" && value) {
      const pct = Number(value);
      if (pct < 0 || pct > 100) msg = "Must be between 0 and 100";
    }
    if (field === "nextFollowUpAt" && value && new Date(value) <= new Date())
      msg = "Must be a future date and time";
    if (msg) setErrors((prev) => ({ ...prev, [field]: msg }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    const currentYear = new Date().getFullYear();

    if (!form.phone.match(/^[6-9]\d{9}$/))
      errs["phone"] = "Enter valid 10-digit Indian mobile number (starts with 6–9)";
    if (!form.studentName.trim())
      errs["studentName"] = "Student name is required";
    if (form.dateOfBirth) {
      const dob = new Date(form.dateOfBirth);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dob >= today) errs["dateOfBirth"] = "Date of birth must be in the past";
    }
    if (form.alternatePhone && !form.alternatePhone.match(/^[6-9]\d{9}$/))
      errs["alternatePhone"] = "Enter valid 10-digit Indian number";
    if (form.whatsappNumber && !form.whatsappNumber.match(/^[6-9]\d{9}$/))
      errs["whatsappNumber"] = "Enter valid 10-digit Indian number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs["email"] = "Enter a valid email address";
    if (form.passingYear) {
      const yr = Number(form.passingYear);
      if (yr < 1960 || yr > currentYear + 1)
        errs["passingYear"] = `Year must be between 1960 and ${currentYear + 1}`;
    }
    if (form.percentage) {
      const pct = Number(form.percentage);
      if (pct < 0 || pct > 100)
        errs["percentage"] = "Percentage must be between 0 and 100";
    }
    if (form.nextFollowUpAt) {
      if (new Date(form.nextFollowUpAt) <= new Date())
        errs["nextFollowUpAt"] = "Follow-up must be scheduled in the future";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent, revivalConfirm?: boolean) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        phone: form.phone,
        studentName: form.studentName,
        dateOfBirth: form.dateOfBirth,
        fatherName: form.fatherName,
        gender: form.gender,
        maritalStatus: form.maritalStatus,
      };
      if (form.courseIds.length) payload["courseIds"] = form.courseIds;
      if (form.sourceId) payload["sourceId"] = form.sourceId;
      if (form.sourceOther) payload["sourceOther"] = form.sourceOther;
      if (form.qualification) payload["qualification"] = form.qualification;
      if (form.schoolCollege) payload["schoolCollege"] = form.schoolCollege;
      if (form.boardUniversity)
        payload["boardUniversity"] = form.boardUniversity;
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
      if (form.nextFollowUpAt) {
        payload["nextFollowUpAt"] = new Date(form.nextFollowUpAt).toISOString();
      }
      payload["sendEmail"] = form.sendEmail;
      if (revivalConfirm) payload["confirmRevival"] = true;

      const { data } = await api.post("/leads", payload);
      const result = data.data;

      if (result.requiresAction === "DUPLICATE_REDIRECTED") {
        setDuplicateModal({
          existingLeadId: result.existingLeadId,
          message: result.message,
        });
        return;
      }

      if (result.requiresAction === "REVIVAL_CONFIRMATION") {
        setRevivalModal({
          lostLeadId: result.lostLeadId,
          message: result.message,
        });
        return;
      }

      success("Lead created successfully");
      router.push(`/leads/${result.lead.id}`);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const details = e.response?.data?.details as
          | Record<string, string[]>
          | undefined;
        if (details) {
          const nextErrors: Record<string, string> = {};
          const entries = Object.entries(details);
          entries.forEach(([field, messages]) => {
            if (messages[0]) nextErrors[field] = messages[0];
          });
          if (Object.keys(nextErrors).length > 0) {
            setErrors((prev) => ({ ...prev, ...nextErrors }));
            const [firstField, firstMessages] = entries[0] ?? [];
            const firstMessage = firstMessages?.[0];
            const label = (firstField ?? "").replace(/([A-Z])/g, " $1");
            error(
              "Validation error",
              firstMessage ? `${label}: ${firstMessage}` : "Check the form",
            );
            return;
          }
        }
      }
      error("Failed to create lead", extractApiError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevivalConfirm() {
    setRevivalModal(null);
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent, true);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Add New Lead</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the student enquiry details
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        {/* Step 1 — Phone + duplicate gate */}
        <div className="bg-white border border-surface-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Basic Information
          </p>

          {/* Phone field */}
          <div className="space-y-2">
            <Input
              label="Mobile Number"
              required
              type="tel"
              placeholder="e.g. 9876543210"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
              onBlur={(e) => blurValidate("phone", e.target.value)}
              error={errors["phone"]}
              helperText={!errors["phone"] ? "10-digit Indian number starting with 6–9" : undefined}
              maxLength={10}
              inputMode="numeric"
            />
            {checkingDuplicate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                Checking for duplicates…
              </div>
            )}
          </div>

          {/* ── Duplicate found — block the form ── */}
          {duplicateLead ? (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-700">
                    Duplicate Number Detected
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    This mobile number is already registered in the system. No
                    need to re-enter.
                  </p>
                </div>
              </div>

              {/* Existing lead card */}
              <div className="bg-white rounded-lg border border-red-200 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <UserCheck size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {duplicateLead.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {duplicateLead.phone} ·{" "}
                    {duplicateLead.status.replace(/_/g, " ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/leads/${duplicateLead.id}`)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
                >
                  Open Lead →
                </button>
              </div>

              <p className="text-xs text-red-500 text-center">
                Change the mobile number above to create a new lead.
              </p>
            </div>
          ) : (
            /* Rest of the form — only shown when no duplicate */
            <>
              <Input
                label="Student Name"
                required
                placeholder="As per Matric record"
                value={form.studentName}
                onChange={(e) =>
                  set("studentName", e.target.value.replace(/[^a-zA-Z\s.'"-]/g, ""))
                }
                error={errors["studentName"]}
                helperText={!errors["studentName"] ? "Letters and spaces only" : undefined}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Date of Birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                  error={errors["dateOfBirth"]}
                  min="1940-01-01"
                  max={new Date().toISOString().split("T")[0]}
                />
                <Input
                  label="Father's Name"
                  placeholder="Father's full name"
                  value={form.fatherName}
                  onChange={(e) => set("fatherName", e.target.value)}
                  error={errors["fatherName"]}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    aria-label="Gender"
                    title="Gender"
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-primary bg-white",
                      errors["gender"] ? "border-red-400" : "border-surface-200",
                    )}
                  >
                    <option value="">Select gender</option>
                    <option value={Gender.MALE}>Male</option>
                    <option value={Gender.FEMALE}>Female</option>
                    <option value={Gender.OTHER}>Other</option>
                  </select>
                  {errors["gender"] && (
                    <p className="mt-1 text-xs text-red-500">{errors["gender"]}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Marital Status
                  </label>
                  <select
                    value={form.maritalStatus}
                    onChange={(e) => set("maritalStatus", e.target.value)}
                    aria-label="Marital status"
                    title="Marital status"
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-primary bg-white",
                      errors["maritalStatus"] ? "border-red-400" : "border-surface-200",
                    )}
                  >
                    <option value="">Select marital status</option>
                    <option value={MaritalStatus.SINGLE}>Single</option>
                    <option value={MaritalStatus.MARRIED}>Married</option>
                  </select>
                  {errors["maritalStatus"] && (
                    <p className="mt-1 text-xs text-red-500">{errors["maritalStatus"]}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Only show remaining sections when no duplicate */}
        {!duplicateLead && (
          <>
            {/* Step 2 — Course info (collapsible) */}
            <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCourse(!showCourse)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700">
                  Course & Source Information
                </span>
                {showCourse ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>

              {showCourse && (
                <div className="px-5 pb-5 space-y-4 border-t border-surface-100">
                  {/* Courses multi-select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Interested Courses
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {courses?.map((course) => (
                        <label
                          key={course.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                            form.courseIds.includes(course.id)
                              ? "border-primary bg-primary-50"
                              : "border-surface-200 hover:border-primary-300",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={form.courseIds.includes(course.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                set("courseIds", [
                                  ...form.courseIds,
                                  course.id,
                                ]);
                              } else {
                                set(
                                  "courseIds",
                                  form.courseIds.filter(
                                    (id) => id !== course.id,
                                  ),
                                );
                              }
                            }}
                            className="accent-primary"
                          />
                          <span className="text-xs text-gray-700">
                            {course.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Lead Source
                    </label>
                    <select
                      value={form.sourceId}
                      onChange={(e) => set("sourceId", e.target.value)}
                      aria-label="Lead source"
                      title="Lead source"
                      className="w-full px-3 py-2.5 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
                    >
                      <option value="">Select source type</option>
                      {sources?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.sourceId &&
                    sources?.find((s) => s.id === form.sourceId)?.name ===
                      "Others" && (
                      <Input
                        label="Specify Source"
                        placeholder="Describe the source"
                        value={form.sourceOther}
                        onChange={(e) => set("sourceOther", e.target.value)}
                      />
                    )}
                </div>
              )}
            </div>

            {/* Step 3 — More info (collapsible) */}
            <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700">
                  Additional Student Information
                </span>
                {showMore ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>

              {showMore && (
                <div className="px-5 pb-5 space-y-4 border-t border-surface-100">
                  {/* Qualification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Qualification
                    </label>
                    <select
                      value={form.qualification}
                      onChange={(e) => set("qualification", e.target.value)}
                      aria-label="Qualification"
                      title="Qualification"
                      className="w-full px-3 py-2.5 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
                    >
                      <option value="">Select qualification</option>
                      {QUALIFICATIONS.map((q) => (
                        <option key={q} value={q}>
                          {QUAL_LABELS[q]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="School/College"
                      placeholder="Institution name"
                      value={form.schoolCollege}
                      onChange={(e) => set("schoolCollege", e.target.value)}
                    />
                    <Input
                      label="Board/University"
                      placeholder="e.g. CBSE, JNU"
                      value={form.boardUniversity}
                      onChange={(e) => set("boardUniversity", e.target.value)}
                    />
                    <Input
                      label="Passing Year"
                      type="number"
                      placeholder="e.g. 2023"
                      value={form.passingYear}
                      onChange={(e) => set("passingYear", e.target.value)}
                      onBlur={(e) => blurValidate("passingYear", e.target.value)}
                      min="1960"
                      max={new Date().getFullYear() + 1}
                      error={errors["passingYear"]}
                      helperText={!errors["passingYear"] ? `1960 – ${new Date().getFullYear() + 1}` : undefined}
                    />
                    <Input
                      label="Percentage/Marks %"
                      type="number"
                      placeholder="e.g. 75"
                      value={form.percentage}
                      onChange={(e) => set("percentage", e.target.value)}
                      onBlur={(e) => blurValidate("percentage", e.target.value)}
                      min="0"
                      max="100"
                      step="0.01"
                      error={errors["percentage"]}
                      helperText={!errors["percentage"] ? "0 – 100" : undefined}
                    />
                  </div>

                  {/* Address */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">
                    Address
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Village/Quarter/Plot"
                      value={form.village}
                      onChange={(e) => set("village", e.target.value)}
                    />
                    <Input
                      label="Sector/Colony/P.O."
                      value={form.sector}
                      onChange={(e) => set("sector", e.target.value)}
                    />
                    <Input
                      label="City"
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                    />
                    <Input
                      label="District"
                      value={form.district}
                      onChange={(e) => set("district", e.target.value)}
                    />
                    <Input
                      label="State"
                      value={form.state}
                      onChange={(e) => set("state", e.target.value)}
                    />
                  </div>

                  {/* Contact */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">
                    Additional Contact
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Alternate Mobile"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={form.alternatePhone}
                      onChange={(e) =>
                        set("alternatePhone", e.target.value.replace(/\D/g, ""))
                      }
                      onBlur={(e) => blurValidate("alternatePhone", e.target.value)}
                      maxLength={10}
                      inputMode="numeric"
                      error={errors["alternatePhone"]}
                      helperText={!errors["alternatePhone"] ? "10-digit number (optional)" : undefined}
                    />
                    <Input
                      label="WhatsApp Number"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={form.whatsappNumber}
                      onChange={(e) =>
                        set("whatsappNumber", e.target.value.replace(/\D/g, ""))
                      }
                      onBlur={(e) => blurValidate("whatsappNumber", e.target.value)}
                      maxLength={10}
                      inputMode="numeric"
                      error={errors["whatsappNumber"]}
                      helperText={!errors["whatsappNumber"] ? "10-digit number (optional)" : undefined}
                    />
                    <Input
                      label="Email ID"
                      type="email"
                      placeholder="student@email.com"
                      value={form.email}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        set("email", val);
                        // auto-uncheck send email if email is cleared
                        if (!val) setForm((prev) => ({ ...prev, email: val, sendEmail: false }));
                      }}
                      onBlur={(e) => blurValidate("email", e.target.value)}
                      className="col-span-2"
                      error={errors["email"]}
                      helperText={!errors["email"] ? "Optional — confirmation email will be sent here" : undefined}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 4 — Follow-up */}
            <div className="bg-white border border-surface-200 rounded-xl p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Follow-up
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Next Follow-up Date"
                  type="datetime-local"
                  value={form.nextFollowUpAt}
                  onChange={(e) => set("nextFollowUpAt", e.target.value)}
                  onBlur={(e) => blurValidate("nextFollowUpAt", e.target.value)}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  error={errors["nextFollowUpAt"]}
                  helperText={!errors["nextFollowUpAt"] ? "Must be a future date & time" : undefined}
                />
              </div>
              {(() => {
                const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
                return (
                  <label
                    className={cn(
                      "flex items-center gap-3",
                      hasEmail ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.sendEmail && hasEmail}
                      onChange={(e) => set("sendEmail", e.target.checked)}
                      disabled={!hasEmail}
                      className="accent-primary w-4 h-4 disabled:cursor-not-allowed"
                    />
                    <div>
                      <span className={cn("text-sm font-medium", hasEmail ? "text-gray-700" : "text-gray-400")}>
                        {hasEmail
                          ? "Send enquiry confirmation to student"
                          : "Send email notification to student"}
                      </span>
                      {!hasEmail && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Enter a valid email above to enable this
                        </p>
                      )}
                    </div>
                  </label>
                );
              })()}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create Lead
              </Button>
            </div>
          </>
        )}
      </form>

      {/* Duplicate modal */}
      <Modal
        open={!!duplicateModal}
        onClose={() => setDuplicateModal(null)}
        title="Duplicate Lead Detected"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicateModal(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                router.push(`/leads/${duplicateModal?.existingLeadId}`);
              }}
            >
              View Existing Lead
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{duplicateModal?.message}</p>
        <p className="text-sm text-gray-500 mt-2">
          The new enquiry information has been added to the existing lead&apos;s
          timeline.
        </p>
      </Modal>

      {/* Revival modal */}
      <Modal
        open={!!revivalModal}
        onClose={() => setRevivalModal(null)}
        title="Previously Lost Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevivalModal(null)}>
              No, Cancel
            </Button>
            <Button onClick={() => void handleRevivalConfirm()}>
              Yes, Continue Follow-up
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{revivalModal?.message}</p>
      </Modal>
    </div>
  );
}
