"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Loader2,
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
  course: string;
  aadharNo: string;
  apaarId: string;
  motherName: string;
  motherOccupation: string;
  motherIncome: string;
  fatherOccupation: string;
  fatherIncome: string;
  noOfSisters: string;
  noOfBrothers: string;
  nationality: string;
  religion: string;
  category: string;
  city: string;
  district: string;
  state: string;
  postalAddress: string;
  permanentAddress: string;
  permanentPhone: string;
  localGuardianName: string;
  localGuardianAddress: string;
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
  course: "",
  aadharNo: "",
  apaarId: "",
  motherName: "",
  motherOccupation: "",
  motherIncome: "",
  fatherOccupation: "",
  fatherIncome: "",
  noOfSisters: "",
  noOfBrothers: "",
  nationality: "Indian",
  religion: "",
  category: "",
  city: "",
  district: "",
  state: "",
  postalAddress: "",
  permanentAddress: "",
  permanentPhone: "",
  localGuardianName: "",
  localGuardianAddress: "",
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
  remarks: "",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
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

export function PublicAdmissionForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState<{
    id: string;
    name: string;
    phone: string;
    status: string;
  } | null>(null);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

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
        const match = leads?.find((lead) => !lead.isDuplicate) ?? leads?.[0];

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
        course: form.course || undefined,
        aadharNo: form.aadharNo || undefined,
        apaarId: form.apaarId || undefined,
        motherName: form.motherName || undefined,
        motherOccupation: form.motherOccupation || undefined,
        motherIncome: form.motherIncome ? Number(form.motherIncome) : undefined,
        fatherOccupation: form.fatherOccupation || undefined,
        fatherIncome: form.fatherIncome ? Number(form.fatherIncome) : undefined,
        noOfSisters: form.noOfSisters ? Number(form.noOfSisters) : undefined,
        noOfBrothers: form.noOfBrothers ? Number(form.noOfBrothers) : undefined,
        nationality: form.nationality || undefined,
        religion: form.religion || undefined,
        category: form.category || undefined,
        city: form.city || undefined,
        district: form.district || undefined,
        state: form.state || undefined,
        postalAddress: form.postalAddress || undefined,
        permanentAddress: form.permanentAddress || undefined,
        permanentPhone: form.permanentPhone || undefined,
        localGuardianName: form.localGuardianName || undefined,
        localGuardianAddress: form.localGuardianAddress || undefined,
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
        remarks: form.remarks || undefined,
      };

      const { data } = await api.post(
        "/leads/public/direct-admission",
        payload,
      );
      setSubmittedId(data.data.leadId as string);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          "We could not submit your admission right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (submittedId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7_0%,#f8fafc_45%,#eef6f0_100%)] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white/95 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} /> Submitted
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Admission application received
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your admission entry has been created through the normal lead flow.
            Our team will review it and continue the process if needed.
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7_0%,#f8fafc_45%,#eaf6ef_100%)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-4xl border border-white/60 bg-white/95 shadow-[0_24px_120px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white sm:px-8">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Admission Application
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Submit the full admission application here. It will enter the lead
              workflow and be moved forward automatically after submission.
            </p>
          </div>

          <form className="space-y-5 p-6 sm:p-8" onSubmit={handleSubmit}>
            <Section title="Student Details">
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

                  {duplicateLead ? (
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
                            This mobile number already exists in the system.
                            Please change the number to continue.
                          </p>
                          <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                              <UserCheck size={14} className="text-amber-700" />
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
                  ) : null}
                </div>
                <Field
                  label="Father's Name"
                  value={form.fatherName}
                  onChange={(v) => setField("fatherName", v)}
                />
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
                  label="Course"
                  value={form.course}
                  onChange={(v) => setField("course", v)}
                  placeholder="Optional course name"
                />
              </div>
            </Section>

            <Section title="Identity & Background">
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
                  label="Mother's Annual Income (₹)"
                  value={form.motherIncome}
                  onChange={(v) => setField("motherIncome", v)}
                  type="number"
                />
                <Field
                  label="Father's Occupation"
                  value={form.fatherOccupation}
                  onChange={(v) => setField("fatherOccupation", v)}
                />
                <Field
                  label="Father's Annual Income (₹)"
                  value={form.fatherIncome}
                  onChange={(v) => setField("fatherIncome", v)}
                  type="number"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="No. of Sisters"
                    value={form.noOfSisters}
                    onChange={(v) => setField("noOfSisters", v)}
                    type="number"
                  />
                  <Field
                    label="No. of Brothers"
                    value={form.noOfBrothers}
                    onChange={(v) => setField("noOfBrothers", v)}
                    type="number"
                  />
                </div>
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
                  placeholder="General / OBC / SC / ST"
                />
              </div>
            </Section>

            <Section title="Addresses & Contact">
              <div className="space-y-4">
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Permanent Phone"
                    value={form.permanentPhone}
                    onChange={(v) => setField("permanentPhone", v)}
                    inputMode="numeric"
                  />
                  <Field
                    label="Local Guardian Name"
                    value={form.localGuardianName}
                    onChange={(v) => setField("localGuardianName", v)}
                  />
                </div>
                <Field
                  label="Local Guardian Address"
                  value={form.localGuardianAddress}
                  onChange={(v) => setField("localGuardianAddress", v)}
                  textarea
                />
                <Field
                  label="Local Guardian Phone"
                  value={form.localGuardianPhone}
                  onChange={(v) => setField("localGuardianPhone", v)}
                  inputMode="numeric"
                />
              </div>
            </Section>

            <Section title="Payment Details">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Booking Amount (₹)"
                  value={form.bookingAmount}
                  onChange={(v) => setField("bookingAmount", v)}
                  type="number"
                />
                <Field
                  label="Booking Cash/DD No."
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
                  value={form.bookingDate}
                  onChange={(v) => setField("bookingDate", v)}
                  type="date"
                />
                <Field
                  label="Admission Amount (₹)"
                  value={form.admissionAmount}
                  onChange={(v) => setField("admissionAmount", v)}
                  type="number"
                />
                <Field
                  label="Admission Cash/DD No."
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
                  value={form.admissionDate}
                  onChange={(v) => setField("admissionDate", v)}
                  type="date"
                />
                <Field
                  label="Dues Amount (₹)"
                  value={form.duesAmount}
                  onChange={(v) => setField("duesAmount", v)}
                  type="number"
                />
                <Field
                  label="Due Date"
                  value={form.dueDate}
                  onChange={(v) => setField("dueDate", v)}
                  type="date"
                />
              </div>
            </Section>

            <Section title="Other Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Extra Curricular Activities"
                  value={form.extraCurricular}
                  onChange={(v) => setField("extraCurricular", v)}
                />
                <Field
                  label="Authorised By"
                  value={form.authorisedBy}
                  onChange={(v) => setField("authorisedBy", v)}
                />
              </div>
              <div className="mt-4">
                <Field
                  label="Remarks"
                  value={form.remarks}
                  onChange={(v) => setField("remarks", v)}
                  textarea
                />
              </div>
            </Section>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || checkingDuplicate || !!duplicateLead}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <GraduationCap size={16} />
              )}
              {saving
                ? "Submitting..."
                : checkingDuplicate
                  ? "Checking Number..."
                  : duplicateLead
                    ? "Duplicate Number Found"
                    : "Submit Admission"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
