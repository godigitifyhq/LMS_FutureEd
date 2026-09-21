"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ChevronRight,
  Globe,
  MessageCircle,
  FileSpreadsheet,
  Megaphone,
  BellRing,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────
// Login layout, modelled on TeleCRM's sign-in screen:
//   left  — dark brand panel: logo + wordmark, a card carousel with arrows
//           and dots, an "Integrations" row
//   right — light ground, one white card: title, email, right-aligned
//           "Forgot password?", password, full-width Login, terms line,
//           "or" divider, "New to …?" + CTA
// All auth logic stays in page.tsx; this file is presentation only.
// ─────────────────────────────────────────

type Props = {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  errors: Record<string, string>;
  isLockedOut: boolean;
  attempts: number;
  maxAttempts: number;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export function LoginView({
  email,
  password,
  setEmail,
  setPassword,
  errors,
  isLockedOut,
  attempts,
  maxAttempts,
  isPending,
  onSubmit,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const remaining = maxAttempts - attempts;
  const disabled = isLockedOut || isPending;

  const inputClass = (field: string) =>
    cn(
      "w-full px-4 py-3 rounded-lg border text-[15px] outline-none transition-colors",
      "placeholder:text-gray-400 disabled:bg-surface-100 disabled:cursor-not-allowed",
      errors[field]
        ? "border-red-300 focus:border-red-400 bg-red-50"
        : "border-surface-300 focus:border-primary focus:ring-2 focus:ring-primary/15",
    );

  return (
    <div className="min-h-screen flex bg-[#eeeef3]">
      {/* ── Left: brand panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-950 flex-col items-center justify-center px-12 py-16 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-white rounded-xl p-2 shadow-lg">
              <Image
                src="/logo.jpg"
                alt="Future Education"
                width={48}
                height={48}
                className="object-contain w-12 h-12"
                priority
              />
            </div>
            <span className="text-white text-3xl font-semibold tracking-tight">
              Future Education
            </span>
          </div>

          <HighlightCarousel />

          <h3 className="text-white text-2xl font-semibold mt-16 mb-8">Integrations</h3>
          <div className="flex items-center justify-center gap-10 text-white">
            {[
              { icon: Globe, label: "Website" },
              { icon: FileSpreadsheet, label: "Excel" },
              { icon: MessageCircle, label: "WhatsApp" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-lg font-semibold">
                <Icon size={22} className="opacity-90" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: login card ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-6">
            <div className="bg-primary-950 rounded-2xl p-3">
              <Image
                src="/logo.jpg"
                alt="Future Education"
                width={140}
                height={56}
                className="object-contain"
                priority // LCP element on mobile — never lazy-load it
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] px-7 py-8">
            <h1 className="text-center text-lg font-semibold text-gray-900 mb-6">
              Login to Future Education
            </h1>

            {isLockedOut && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <Lock size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Account temporarily locked</p>
                  <p className="text-xs text-red-600 mt-1">
                    Too many failed attempts. Please try again after 15 minutes or contact your
                    administrator.
                  </p>
                </div>
              </div>
            )}

            {!isLockedOut && attempts >= 2 && (
              <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  {remaining} attempt{remaining === 1 ? "" : "s"} remaining before your account is
                  temporarily locked
                </p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={disabled}
                  placeholder="Email address"
                  className={inputClass("email")}
                />
                {errors["email"] && <p className="text-xs text-red-500 mt-1">{errors["email"]}</p>}
              </div>

              <div className="flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-primary-800 underline underline-offset-2"
                >
                  Forgot password?
                </a>
              </div>

              <div>
                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={disabled}
                    placeholder="Enter Your Password"
                    className={cn(inputClass("password"), "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors["password"] && (
                  <p className="text-xs text-red-500 mt-1">{errors["password"]}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={disabled}
                className={cn(
                  "w-full py-3 rounded-lg text-[15px] font-semibold text-white transition-colors mt-1",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "bg-primary hover:bg-primary-800 active:bg-primary-900",
                )}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-4 leading-relaxed">
              By clicking continue, you agree to our{" "}
              <span className="text-gray-800">Terms of Service</span> and{" "}
              <span className="text-gray-800">Privacy Policy</span>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Future Education Trust · Bokaro Steel City
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Brand-panel carousel ─────────────────────────────────────────────────
// Same card + arrows + dots rhythm as TeleCRM's testimonial slot. Content is
// product highlights rather than quotes; swap in real testimonials later.
const HIGHLIGHTS = [
  {
    icon: Megaphone,
    title: "Campaign queues",
    text: "Import a sheet, assign it, and work leads one at a time. Next takes you to the right lead.",
  },
  {
    icon: BellRing,
    title: "Follow-ups that interrupt",
    text: "Due reminders surface across the app so a promised call-back never slips.",
  },
  {
    icon: Upload,
    title: "Excel to campaign in one step",
    text: "Every upload becomes its own campaign, named after the file, with progress you can see.",
  },
];

function HighlightCarousel() {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((n) => (n + d + HIGHLIGHTS.length) % HIGHLIGHTS.length);
  const item = HIGHLIGHTS[i]!;
  const Icon = item.icon;

  return (
    <div className="w-full">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous"
          className="text-white/60 hover:text-white p-1"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="flex-1 bg-white rounded-2xl p-6 shadow-2xl min-h-[164px]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="text-xs text-gray-400">Future Education LMS</p>
            </div>
          </div>
          <p className="text-[15px] text-gray-600 leading-relaxed">{item.text}</p>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next"
          className="text-white/60 hover:text-white p-1"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-5">
        {HIGHLIGHTS.map((_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Slide ${n + 1}`}
            className={cn(
              "w-2.5 h-2.5 rounded-full border border-white transition-colors",
              n === i ? "bg-white" : "bg-transparent",
            )}
          />
        ))}
      </div>
    </div>
  );
}
