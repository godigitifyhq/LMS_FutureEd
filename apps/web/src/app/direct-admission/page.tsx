"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Loader2,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react";
import api from "@/lib/api";

type FormState = {
  studentName: string;
  phone: string;
  fatherName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  fatherOccupation: string;
  fatherIncome: string;
  motherName: string;
  motherOccupation: string;
  motherIncome: string;
  noOfSisters: string;
  noOfBrothers: string;
  nationality: string;
  religion: string;
  category: string;
  postalAddress: string;
  city: string;
  district: string;
  state: string;
  aadharNo: string;
  apaarId: string;
  permanentAddress: string;
  permanentPhone: string;
  localGuardianAddress: string;
  localGuardianName: string;
  localGuardianPhone: string;
  bookingAmount: string;
  bookingCashDDNo: string;
  bookingBank: string;
  bookingDate: string;
  admissionAmount: string;
  admissionCashDDNo: string;
  admissionBank: string;
  admissionDate: string;
  duesAmount: string;
  dueDate: string;
  extraCurricular: string;
  authorisedBy: string;
  course: string;
  remarks: string;
};

const emptyForm: FormState = {
  studentName: "",
  phone: "",
  fatherName: "",
  email: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  fatherOccupation: "",
  fatherIncome: "",
  motherName: "",
  motherOccupation: "",
  motherIncome: "",
  noOfSisters: "",
  noOfBrothers: "",
  nationality: "Indian",
  religion: "",
  category: "",
  postalAddress: "",
  city: "",
  district: "",
  state: "",
  aadharNo: "",
  apaarId: "",
  permanentAddress: "",
  permanentPhone: "",
  localGuardianAddress: "",
  localGuardianName: "",
  localGuardianPhone: "",
  bookingAmount: "",
  bookingCashDDNo: "",
  bookingBank: "",
  bookingDate: "",
  admissionAmount: "",
  admissionCashDDNo: "",
  admissionBank: "",
  admissionDate: "",
  duesAmount: "",
  dueDate: "",
  extraCurricular: "",
  authorisedBy: "",
  course: "",
  remarks: "",
};

type DocFile = {
  id: string;
  file: File;
  docType: string;
};

const DOC_TYPES = [
  "Marksheet",
  "ID Proof",
  "Photo",
  "Birth Certificate",
  "Entrance Exam Scorecard",
  "Other",
];

const STAGES = [
  { title: "Personal & Family", subtitle: "Basic info and family background" },
  { title: "Address & Contact", subtitle: "Residential and guardian details" },
  { title: "Payment & Documents", subtitle: "Fee details and documents" },
];

const LS_KEY = "direct-admission-draft-v1";

export default function DirectAdmissionPage() {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState<{
    id: string;
    name: string;
    phone: string;
    status: string;
  } | null>(null);
  const [newDocType, setNewDocType] = useState("Marksheet");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // Restore draft from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          form?: Partial<FormState>;
          stage?: number;
        };
        if (parsed.form) setForm((prev) => ({ ...prev, ...parsed.form }));
        if (parsed.stage && [1, 2, 3].includes(parsed.stage)) {
          setStage(parsed.stage as 1 | 2 | 3);
        }
      }
    } catch {}
    mountedRef.current = true;
  }, []);

  // Auto-save form + stage to localStorage (debounced)
  useEffect(() => {
    if (!mountedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(LS_KEY, JSON.stringify({ form, stage }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form, stage]);

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Phone duplicate check
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
        const { data } = await api.get(
          `/leads/public/direct-admission/check-duplicate?phone=${form.phone}`,
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
    return () => {
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, [form.phone]);

  function handleNext() {
    if (stage === 1) {
      if (!form.studentName.trim() || form.studentName.trim().length < 2) {
        setError("Student name must be at least 2 characters");
        return;
      }
      if (!form.phone.match(/^[6-9]\d{9}$/)) {
        setError("Enter a valid 10-digit Indian mobile number");
        return;
      }
      if (checkingDuplicate) return;
      if (duplicateLead) {
        setError("A record with this phone number already exists");
        return;
      }
    }
    setError(null);
    setStage((s) => (Math.min(s + 1, 3) as 1 | 2 | 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setError(null);
    setStage((s) => (Math.max(s - 1, 1) as 1 | 2 | 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAddDocument() {
    setDocError(null);
    if (!newDocFile) {
      setDocError("Please select a file");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(newDocFile.type)) {
      setDocError("Only PDF, JPG, and PNG files are allowed");
      return;
    }
    if (newDocFile.size > 10 * 1024 * 1024) {
      setDocError("File must be under 10 MB");
      return;
    }
    setDocuments((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        file: newDocFile,
        docType: newDocType,
      },
    ]);
    setNewDocFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (checkingDuplicate || duplicateLead) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        studentName: form.studentName,
        phone: form.phone,
        fatherName: form.fatherName || undefined,
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth
          ? new Date(form.dateOfBirth).toISOString()
          : undefined,
        gender: form.gender || undefined,
        maritalStatus: form.maritalStatus || undefined,
        fatherOccupation: form.fatherOccupation || undefined,
        fatherIncome: form.fatherIncome ? Number(form.fatherIncome) : undefined,
        motherName: form.motherName || undefined,
        motherOccupation: form.motherOccupation || undefined,
        motherIncome: form.motherIncome ? Number(form.motherIncome) : undefined,
        noOfSisters: form.noOfSisters ? Number(form.noOfSisters) : undefined,
        noOfBrothers: form.noOfBrothers ? Number(form.noOfBrothers) : undefined,
        nationality: form.nationality || undefined,
        religion: form.religion || undefined,
        category: form.category || undefined,
        postalAddress: form.postalAddress || undefined,
        city: form.city || undefined,
        district: form.district || undefined,
        state: form.state || undefined,
        aadharNo: form.aadharNo || undefined,
        apaarId: form.apaarId || undefined,
        permanentAddress: form.permanentAddress || undefined,
        permanentPhone: form.permanentPhone || undefined,
        localGuardianAddress: form.localGuardianAddress || undefined,
        localGuardianName: form.localGuardianName || undefined,
        localGuardianPhone: form.localGuardianPhone || undefined,
        bookingAmount: form.bookingAmount
          ? Number(form.bookingAmount)
          : undefined,
        bookingCashDDNo: form.bookingCashDDNo || undefined,
        bookingBank: form.bookingBank || undefined,
        bookingDate: form.bookingDate
          ? new Date(form.bookingDate).toISOString()
          : undefined,
        admissionAmount: form.admissionAmount
          ? Number(form.admissionAmount)
          : undefined,
        admissionCashDDNo: form.admissionCashDDNo || undefined,
        admissionBank: form.admissionBank || undefined,
        admissionDate: form.admissionDate
          ? new Date(form.admissionDate).toISOString()
          : undefined,
        duesAmount: form.duesAmount ? Number(form.duesAmount) : undefined,
        dueDate: form.dueDate
          ? new Date(form.dueDate).toISOString()
          : undefined,
        extraCurricular: form.extraCurricular || undefined,
        authorisedBy: form.authorisedBy || undefined,
        course: form.course || undefined,
        remarks: form.remarks || undefined,
      };

      const { data } = await api.post(
        "/leads/public/direct-admission",
        payload,
      );
      const leadId = data.data.leadId as string;

      // Upload documents sequentially
      for (const doc of documents) {
        const fd = new FormData();
        fd.append("file", doc.file, doc.file.name);
        await api.post(
          `/leads/public/direct-admission/${leadId}/documents?documentType=${encodeURIComponent(doc.docType)}`,
          fd,
        );
      }

      localStorage.removeItem(LS_KEY);
      setSubmittedId(leadId);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      setError(
        axiosErr?.response?.data?.error?.message ??
          "Submission failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (submittedId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fdf7e8_0%,#f8fafc_45%,#eef6f0_100%)] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white/95 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} /> Submitted
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Admission received
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your admission application has been submitted successfully. Our team
            will review it and follow up if needed.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Reference ID:{" "}
            <span className="font-semibold text-slate-900">{submittedId}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f1f5f9_42%,#ecfdf5_100%)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Admission Application
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Complete all three stages to submit your admission. Your progress is
            saved automatically.
          </p>
        </div>

        {/* Stage indicator */}
        <div className="mb-6 flex items-center gap-0">
          {STAGES.map((s, i) => (
            <Fragment key={i}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    i + 1 < stage
                      ? "bg-emerald-500 text-white"
                      : i + 1 === stage
                        ? "bg-slate-900 text-white"
                        : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {i + 1 < stage ? <Check size={14} /> : i + 1}
                </div>
                <div className="mt-1.5 hidden text-center sm:block">
                  <p
                    className={`text-xs font-semibold ${i + 1 <= stage ? "text-slate-800" : "text-slate-400"}`}
                  >
                    {s.title}
                  </p>
                  <p className="text-xs text-slate-400">{s.subtitle}</p>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`mx-3 -mt-[18px] h-0.5 flex-1 transition-colors sm:-mt-9 ${i + 1 < stage ? "bg-emerald-400" : "bg-slate-200"}`}
                />
              )}
            </Fragment>
          ))}
        </div>

        {/* Draft saved indicator */}
        <div
          className={`mb-3 flex items-center gap-1.5 text-xs text-emerald-600 transition-opacity duration-300 ${draftSaved ? "opacity-100" : "opacity-0"}`}
        >
          <Check size={12} /> Draft saved
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8"
        >
          {/* ── Stage 1: Personal & Family ── */}
          {stage === 1 && (
            <>
              <section className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Student Details
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Student Name *"
                    value={form.studentName}
                    onChange={(v) => setField("studentName", v)}
                  />
                  <Field
                    label="Phone *"
                    value={form.phone}
                    onChange={(v) => setField("phone", v)}
                    inputMode="numeric"
                  />
                  <div className="sm:col-span-2">
                    {checkingDuplicate && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 size={12} className="animate-spin" />
                        Checking for duplicate number...
                      </div>
                    )}
                    {duplicateLead && (
                      <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                            <AlertTriangle size={18} className="text-red-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-red-700">
                              Duplicate number detected
                            </p>
                            <p className="mt-1 text-xs text-red-600">
                              This mobile number already exists. Please use a
                              different number to continue.
                            </p>
                            <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                                <UserCheck
                                  size={14}
                                  className="text-amber-700"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {duplicateLead.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {duplicateLead.phone} ·{" "}
                                  {duplicateLead.status.replace(/_/g, " ")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <Field
                    label="Email"
                    value={form.email}
                    onChange={(v) => setField("email", v)}
                    type="email"
                  />
                  <Field
                    label="Date of Birth"
                    value={form.dateOfBirth}
                    onChange={(v) => setField("dateOfBirth", v)}
                    type="date"
                  />
                  <Field
                    label="Course"
                    value={form.course}
                    onChange={(v) => setField("course", v)}
                    placeholder="e.g. B.Tech, MBA"
                  />
                  <Field
                    label="Father's Name"
                    value={form.fatherName}
                    onChange={(v) => setField("fatherName", v)}
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-slate-100 pt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Identity & Demographics
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Aadhar No."
                    value={form.aadharNo}
                    onChange={(v) => setField("aadharNo", v)}
                  />
                  <Field
                    label="APAR ID"
                    value={form.apaarId}
                    onChange={(v) => setField("apaarId", v)}
                  />
                  <SelectField
                    label="Gender"
                    value={form.gender}
                    onChange={(v) => setField("gender", v)}
                    options={["MALE", "FEMALE", "OTHER"]}
                    placeholder="Select gender"
                  />
                  <SelectField
                    label="Marital Status"
                    value={form.maritalStatus}
                    onChange={(v) => setField("maritalStatus", v)}
                    options={["SINGLE", "MARRIED"]}
                    placeholder="Select status"
                  />
                  <Field
                    label="Nationality"
                    value={form.nationality}
                    onChange={(v) => setField("nationality", v)}
                  />
                  <Field
                    label="Religion"
                    value={form.religion}
                    onChange={(v) => setField("religion", v)}
                  />
                  <Field
                    label="Category"
                    value={form.category}
                    onChange={(v) => setField("category", v)}
                    placeholder="e.g. General, OBC, SC, ST"
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-slate-100 pt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Family Background
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Father's Occupation"
                    value={form.fatherOccupation}
                    onChange={(v) => setField("fatherOccupation", v)}
                  />
                  <Field
                    label="Father's Annual Income"
                    type="number"
                    value={form.fatherIncome}
                    onChange={(v) => setField("fatherIncome", v)}
                  />
                  <Field
                    label="Mother's Name"
                    value={form.motherName}
                    onChange={(v) => setField("motherName", v)}
                  />
                  <Field
                    label="Mother's Occupation"
                    value={form.motherOccupation}
                    onChange={(v) => setField("motherOccupation", v)}
                  />
                  <Field
                    label="Mother's Annual Income"
                    type="number"
                    value={form.motherIncome}
                    onChange={(v) => setField("motherIncome", v)}
                  />
                  <Field
                    label="No. of Sisters"
                    type="number"
                    value={form.noOfSisters}
                    onChange={(v) => setField("noOfSisters", v)}
                  />
                  <Field
                    label="No. of Brothers"
                    type="number"
                    value={form.noOfBrothers}
                    onChange={(v) => setField("noOfBrothers", v)}
                  />
                </div>
              </section>
            </>
          )}

          {/* ── Stage 2: Address & Contact ── */}
          {stage === 2 && (
            <section className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Address & Contact
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={form.city}
                  onChange={(v) => setField("city", v)}
                />
                <Field
                  label="District"
                  value={form.district}
                  onChange={(v) => setField("district", v)}
                />
                <Field
                  label="State"
                  value={form.state}
                  onChange={(v) => setField("state", v)}
                />
                <Field
                  label="Postal Address"
                  value={form.postalAddress}
                  onChange={(v) => setField("postalAddress", v)}
                  textarea
                />
                <Field
                  label="Permanent Address"
                  value={form.permanentAddress}
                  onChange={(v) => setField("permanentAddress", v)}
                  textarea
                />
                <Field
                  label="Permanent Phone"
                  value={form.permanentPhone}
                  onChange={(v) => setField("permanentPhone", v)}
                  inputMode="numeric"
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Local Guardian
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Guardian Name"
                    value={form.localGuardianName}
                    onChange={(v) => setField("localGuardianName", v)}
                  />
                  <Field
                    label="Guardian Phone"
                    value={form.localGuardianPhone}
                    onChange={(v) => setField("localGuardianPhone", v)}
                    inputMode="numeric"
                  />
                  <Field
                    label="Guardian Address"
                    value={form.localGuardianAddress}
                    onChange={(v) => setField("localGuardianAddress", v)}
                    textarea
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── Stage 3: Payment & Documents ── */}
          {stage === 3 && (
            <>
              <section className="space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Admission & Payment
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Booking Amount"
                    type="number"
                    value={form.bookingAmount}
                    onChange={(v) => setField("bookingAmount", v)}
                  />
                  <Field
                    label="Booking Cash / DD No."
                    value={form.bookingCashDDNo}
                    onChange={(v) => setField("bookingCashDDNo", v)}
                  />
                  <Field
                    label="Booking Bank"
                    value={form.bookingBank}
                    onChange={(v) => setField("bookingBank", v)}
                  />
                  <Field
                    label="Booking Date"
                    type="date"
                    value={form.bookingDate}
                    onChange={(v) => setField("bookingDate", v)}
                  />
                  <Field
                    label="Admission Amount"
                    type="number"
                    value={form.admissionAmount}
                    onChange={(v) => setField("admissionAmount", v)}
                  />
                  <Field
                    label="Admission Cash / DD No."
                    value={form.admissionCashDDNo}
                    onChange={(v) => setField("admissionCashDDNo", v)}
                  />
                  <Field
                    label="Admission Bank"
                    value={form.admissionBank}
                    onChange={(v) => setField("admissionBank", v)}
                  />
                  <Field
                    label="Admission Date"
                    type="date"
                    value={form.admissionDate}
                    onChange={(v) => setField("admissionDate", v)}
                  />
                  <Field
                    label="Dues Amount"
                    type="number"
                    value={form.duesAmount}
                    onChange={(v) => setField("duesAmount", v)}
                  />
                  <Field
                    label="Due Date"
                    type="date"
                    value={form.dueDate}
                    onChange={(v) => setField("dueDate", v)}
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-slate-100 pt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Documents
                </h2>
                <p className="text-xs text-slate-500">
                  Upload supporting documents (PDF, JPG, PNG · max 10 MB each).
                </p>

                {/* Add document row */}
                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      htmlFor="doc-type-select"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Document Type
                    </label>
                    <select
                      id="doc-type-select"
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-2">
                    <label
                      htmlFor="doc-file-input"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      File
                    </label>
                    <input
                      id="doc-file-input"
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        setNewDocFile(e.target.files?.[0] ?? null)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDocument}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                  >
                    <Upload size={14} /> Add
                  </button>
                </div>

                {docError && (
                  <p className="text-xs text-red-600">{docError}</p>
                )}

                {/* Document list */}
                {documents.length > 0 && (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <FileText
                          size={16}
                          className="shrink-0 text-slate-400"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {doc.file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doc.docType} ·{" "}
                            {(doc.file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id)}
                          aria-label={`Remove ${doc.file.name}`}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-4 border-t border-slate-100 pt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Other Details
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Extra Curricular Activities"
                    value={form.extraCurricular}
                    onChange={(v) => setField("extraCurricular", v)}
                    textarea
                  />
                  <Field
                    label="Authorised By"
                    value={form.authorisedBy}
                    onChange={(v) => setField("authorisedBy", v)}
                  />
                  <Field
                    label="Remarks"
                    value={form.remarks}
                    onChange={(v) => setField("remarks", v)}
                    textarea
                  />
                </div>
              </section>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {stage > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {stage < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={checkingDuplicate || (stage === 1 && !!duplicateLead)}
                className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingDuplicate ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Save & Next <ChevronRight size={16} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || checkingDuplicate || !!duplicateLead}
                className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GraduationCap size={16} />
                )}
                {saving
                  ? documents.length > 0
                    ? "Submitting & uploading..."
                    : "Submitting..."
                  : "Submit Admission Application"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  textarea = false,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}) {
  const shared =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100";
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={shared}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={shared}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
