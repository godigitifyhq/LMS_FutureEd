import { Resend } from "resend";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

// ─────────────────────────────────────────────────────────────
// Transport selection (first match wins):
//   RESEND_API_KEY  → Resend HTTPS API   (needs verified domain)
//   BREVO_API_KEY   → Brevo HTTPS API    (just verify sender email, works on Render)
//   SMTP_USER+PASS  → nodemailer SMTP    (local dev / non-Render hosting)
// ─────────────────────────────────────────────────────────────
const resendClient = config.resendApiKey ? new Resend(config.resendApiKey) : null;

const smtpTransporter =
  config.smtp.user && config.smtp.pass
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        pool: true,
        maxConnections: 1,
        maxMessages: 100,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass.replace(/\s/g, ""),
        },
      })
    : null;

// Try several candidate paths so this works both locally (tsx) and on Render
function loadLogoDataUri(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "public/logo.jpg"),
    path.resolve(__dirname, "../../public/logo.jpg"),
    path.resolve(__dirname, "../public/logo.jpg"),
  ];
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
      // try next candidate
    }
  }
  return null;
}
const LOGO_DATA_URI = loadLogoDataUri();

/** Escape user-controlled strings before embedding in HTML email bodies. */
function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (resendClient) {
    console.log("✓ Email service ready (Resend)");
    return true;
  }
  if (config.brevoApiKey) {
    console.log("✓ Email service ready (Brevo API)");
    return true;
  }
  if (smtpTransporter) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP verify timed out after 8s")), 8000),
      );
      await Promise.race([smtpTransporter.verify(), timeout]);
      console.log("✓ Email service ready (SMTP)");
      return true;
    } catch (err) {
      console.error("✗ SMTP verify failed:", err instanceof Error ? err.message : err);
      return false;
    }
  }
  console.warn("⚠ Email not configured — set RESEND_API_KEY, BREVO_API_KEY, or SMTP_USER+SMTP_PASS");
  return false;
}

function htmlWrapper(content: string): string {
  // Prefer a hosted URL (set LOGO_URL in env for production); fall back to base64 for local dev
  const logoUrl = (config.logoUrl || null) ?? LOGO_DATA_URI;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
      .card { background: white; border-radius: 12px; padding: 32px; max-width: 480px; margin: 0 auto; }
      .logo-wrap { margin-bottom: 24px; }
      .logo-img { display: block; width: 160px; height: auto; border: 0; }
      .title { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 8px; }
      .body { font-size: 14px; color: #374151; line-height: 1.6; }
      .btn { display: inline-block; background: #005826; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none !important; font-weight: 600; margin: 16px 0; }
      .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      .highlight { background: #f0f9f4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
    </style>
  </head>
  <body>
    <div class="card">
      ${logoUrl ? `<div class="logo-wrap"><img class="logo-img" src="${logoUrl}" alt="Future Education Trust" /></div>` : ""}
      ${content}
      <div class="footer">Future Education Trust · Bokaro Steel City<br>This is an automated email, please do not reply.</div>
    </div>
  </body>
  </html>`;
}

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

async function send(payload: EmailPayload): Promise<void> {
  console.log(`[EMAIL] Sending "${payload.subject}" → ${payload.to}`);

  // ── Resend (preferred when RESEND_API_KEY is set) ──
  if (resendClient) {
    const { data, error } = await resendClient.emails.send({
      from: config.smtp.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) {
      console.error(`[EMAIL] Resend FAILED → ${payload.to}:`, error.message);
      throw new Error(error.message);
    }
    console.log(`[EMAIL] Sent via Resend → ${payload.to} | id: ${data?.id}`);
    return;
  }

  // ── Brevo HTTP API (BREVO_API_KEY set — works on Render, just verify sender email) ──
  if (config.brevoApiKey) {
    // Parse "Name <email@domain>" → { name, email }
    const fromMatch = config.smtp.from.match(/^(.*?)\s*<(.+)>$/);
    const senderName  = fromMatch?.[1]?.replace(/^"|"$/g, "").trim() || "FutureEd LMS";
    const senderEmail = fromMatch?.[2]?.trim() || config.smtp.from;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[EMAIL] Brevo API FAILED → ${payload.to}:`, body);
      throw new Error(`Brevo API error ${res.status}: ${body}`);
    }

    const result = await res.json() as { messageId?: string };
    console.log(`[EMAIL] Sent via Brevo API → ${payload.to} | messageId: ${result.messageId}`);
    return;
  }

  // ── nodemailer SMTP fallback (local dev only) ──
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: config.smtp.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      console.log(`[EMAIL] Sent via SMTP → ${payload.to} | messageId: ${info.messageId}`);
      return;
    } catch (err) {
      console.error(`[EMAIL] SMTP FAILED → ${payload.to}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }

  console.error("[EMAIL] No transport configured — email skipped to:", payload.to);
}

export async function sendWelcomeSetupEmail(params: {
  to: string;
  name: string;
  role: string;
  setupUrl: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Set up your FutureEd LMS account",
    html: htmlWrapper(`
      <div class="title">Welcome to FutureEd LMS, ${esc(params.name)}!</div>
      <div class="body">
        Your account has been created with the role of <strong>${esc(params.role)}</strong>.
        Please set your password to get started.
      </div>
      <a href="${esc(params.setupUrl)}" class="btn" style="color:#ffffff;text-decoration:none;">Set My Password</a>
      <div class="body" style="color: #6b7280; font-size: 13px;">
        This link expires in 7 days. If you did not expect this email, please ignore it.
      </div>
    `),
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Reset your FutureEd LMS password",
    html: htmlWrapper(`
      <div class="title">Password Reset Request</div>
      <div class="body">Hi ${esc(params.name)}, we received a request to reset your password.</div>
      <a href="${esc(params.resetUrl)}" class="btn" style="color:#ffffff;text-decoration:none;">Reset Password</a>
      <div class="body" style="color: #6b7280; font-size: 13px;">
        This link expires in 1 hour. If you did not request this, ignore this email.
      </div>
    `),
  });
}

export async function sendPasswordChangedEmail(params: {
  to: string;
  name: string;
  newPassword: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Your FutureEd LMS password has been reset",
    html: htmlWrapper(`
      <div class="title">Password Reset by Administrator</div>
      <div class="body">Hi ${esc(params.name)}, your password has been reset by an administrator.</div>
      <div class="highlight">
        <strong>New Password:</strong> <code>${esc(params.newPassword)}</code>
      </div>
      <div class="body">Please login and change your password immediately.</div>
      <a href="${esc(config.frontendUrl)}/login" class="btn" style="color:#ffffff;text-decoration:none;">Login Now</a>
    `),
  });
}

export async function sendAccountDeactivatedEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Your FutureEd LMS account has been deactivated",
    html: htmlWrapper(`
      <div class="title">Account Deactivated</div>
      <div class="body">
        Hi ${esc(params.name)}, your account has been deactivated by an administrator.
        Please contact your manager if you believe this is an error.
      </div>
    `),
  });
}

export async function sendLeadAssignedEmail(params: {
  to: string;
  employeeName: string;
  studentName: string;
  phone: string;
  leadUrl: string;
  assignedByName: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `Lead assigned: ${params.studentName}`,
    html: htmlWrapper(`
      <div class="title">New Lead Assigned to You</div>
      <div class="body">${esc(params.assignedByName)} has assigned a new lead to you.</div>
      <div class="highlight">
        <strong>Student:</strong> ${esc(params.studentName)}<br>
        <strong>Phone:</strong> ${esc(params.phone)}
      </div>
      <a href="${esc(params.leadUrl)}" class="btn" style="color:#ffffff;text-decoration:none;">View Lead</a>
    `),
  });
}

export async function sendFollowUpReminderEmail(params: {
  to: string;
  employeeName: string;
  studentName: string;
  phone: string;
  leadUrl: string;
  overdueBy: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `⚠ Follow-up overdue: ${params.studentName}`,
    html: htmlWrapper(`
      <div class="title">Follow-up Overdue</div>
      <div class="body">A follow-up was scheduled and is now overdue.</div>
      <div class="highlight" style="background: #fef3c7; border-color: #fde68a;">
        <strong>Student:</strong> ${esc(params.studentName)}<br>
        <strong>Phone:</strong> ${esc(params.phone)}<br>
        <strong>Overdue by:</strong> ${esc(params.overdueBy)}
      </div>
      <a href="${esc(params.leadUrl)}" class="btn" style="color:#ffffff;text-decoration:none;">Update Lead</a>
    `),
  });
}

export async function sendApplicationConfirmationEmail(params: {
  to: string;
  studentName: string;
  institutionName: string;
  programName: string;
  applicationNumber?: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `Application submitted — ${params.institutionName}`,
    html: htmlWrapper(`
      <div class="title">Your Application Has Been Submitted</div>
      <div class="body">Dear ${esc(params.studentName)}, your application has been submitted successfully.</div>
      <div class="highlight">
        <strong>Institution:</strong> ${esc(params.institutionName)}<br>
        <strong>Program:</strong> ${esc(params.programName)}<br>
        ${params.applicationNumber ? `<strong>Application No:</strong> ${esc(params.applicationNumber)}` : ""}
      </div>
      <div class="body">Our team will keep you updated on the status. Please stay in touch with your counsellor.</div>
    `),
  });
}

export async function sendMetaLeadFormEmail(params: {
  to: string;
  employeeName: string;
  studentName: string;
  phone: string;
  email: string | null;
  leadUrl: string;
  adName: string | null;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `New Lead from Facebook Ad — ${params.studentName}`,
    html: htmlWrapper(`
      <div class="title">New Lead from Facebook Ad</div>
      <div class="body">Hi ${esc(params.employeeName)}, a student filled a Meta Instant Form and has been assigned to you.</div>
      <div class="highlight">
        <strong>Student:</strong> ${esc(params.studentName)}<br>
        <strong>Phone:</strong> ${esc(params.phone)}<br>
        ${params.email ? `<strong>Email:</strong> ${esc(params.email)}<br>` : ""}
        ${params.adName ? `<strong>Ad:</strong> ${esc(params.adName)}` : ""}
      </div>
      <a href="${esc(params.leadUrl)}" class="btn" style="color:#ffffff;text-decoration:none;">View Lead</a>
      <div class="body" style="color: #6b7280; font-size: 13px;">
        Please follow up promptly — Meta leads convert best within the first hour.
      </div>
    `),
  });
}

export async function sendWhatsAppLeadEmail(params: {
  to: string;
  employeeName: string;
  studentName: string;
  phone: string;
  firstMessage: string | null;
  timestamp: string | null;
  leadUrl: string;
}): Promise<void> {
  const timeStr = params.timestamp
    ? new Date(params.timestamp).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  await send({
    to: params.to,
    subject: `New WhatsApp Lead — ${params.studentName}`,
    html: htmlWrapper(`
      <div class="title" style="color: #128C7E;">New WhatsApp Lead</div>
      <div class="body">Hi ${esc(params.employeeName)}, a student messaged via WhatsApp and has been assigned to you.</div>
      <div class="highlight" style="background: #e7f8f0; border-color: #25D366;">
        <strong>Student:</strong> ${esc(params.studentName)}<br>
        <strong>Phone:</strong> ${esc(params.phone)}<br>
        ${params.firstMessage ? `<strong>First Message:</strong> &ldquo;${esc(params.firstMessage)}&rdquo;<br>` : ""}
        ${timeStr ? `<strong>Time:</strong> ${esc(timeStr)}` : ""}
      </div>
      <a href="${esc(params.leadUrl)}" class="btn" style="color:#ffffff;text-decoration:none;background:#128C7E;">View Lead</a>
      <div class="body" style="color: #6b7280; font-size: 13px;">
        Reply quickly — the student is likely waiting for a response on WhatsApp.
      </div>
    `),
  });
}

export async function sendLeadCreatedEmail(params: {
  to: string;
  studentName: string;
  leadId: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Your enquiry has been received — Future Education",
    html: htmlWrapper(`
      <div class="title">Thank You for Your Enquiry!</div>
      <div class="body">
        Dear <strong>${esc(params.studentName)}</strong>,<br><br>
        We have received your enquiry and our counselling team will get in touch with you shortly.
      </div>
      <div class="highlight">
        <strong>What happens next?</strong><br>
        Our counsellor will call you within 24 hours to discuss your course options and guide you through the admission process.
      </div>
      <div class="body">
        If you have any urgent questions, feel free to visit us at our centre or call us directly.
      </div>
      <div class="body" style="color: #6b7280; font-size: 13px; margin-top: 12px;">
        Future Education Bokaro — Helping students achieve their dreams.
      </div>
    `),
  });
}

export async function sendAdmissionFormEmail(params: {
  to: string;
  studentName: string;
  courseName: string;
  branchName: string;
  pdfBuffer: Buffer;
}): Promise<void> {
  if (!resendClient && !config.brevoApiKey && !smtpTransporter) return;

  const safeName = params.studentName
    .replace(/[^\w\s\-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "student";

  const filename = `Admission-Form-${safeName}.pdf`;
  const subject = `Admission Application — ${params.courseName} | Future Education`;
  const html = htmlWrapper(`
    <div class="title">Your Admission Application</div>
    <div class="body">Dear <strong>${esc(params.studentName)}</strong>,</div>
    <div class="body">
      Your admission assistance application for <strong>${esc(params.courseName)}</strong>
      has been processed by our team at ${esc(params.branchName)}.
    </div>
    <div class="body">
      Please find your admission form attached to this email. Keep it for your records.
      Our counsellor will be in touch with you shortly regarding the next steps.
    </div>
  `);

  if (resendClient) {
    const { error } = await resendClient.emails.send({
      from: config.smtp.from,
      to: params.to,
      subject,
      html,
      attachments: [{ filename, content: params.pdfBuffer }],
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (config.brevoApiKey) {
    const fromMatch = config.smtp.from.match(/^(.*?)\s*<(.+)>$/);
    const senderName  = fromMatch?.[1]?.replace(/^"|"$/g, "").trim() || "FutureEd LMS";
    const senderEmail = fromMatch?.[2]?.trim() || config.smtp.from;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": config.brevoApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: params.to }],
        subject,
        htmlContent: html,
        attachment: [{ name: filename, content: params.pdfBuffer.toString("base64") }],
      }),
    });
    if (!res.ok) throw new Error(`Brevo API error ${res.status}: ${await res.text()}`);
    return;
  }

  await smtpTransporter!.sendMail({
    from: config.smtp.from,
    to: params.to,
    subject,
    html,
    attachments: [{ filename, content: params.pdfBuffer, contentType: "application/pdf" }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY REPORTS
// ─────────────────────────────────────────────────────────────────────────────

type EmployeeDailyStats = {
  name: string;
  callCount: number;
  callMinutes: number;
  leadsInteracted: number;
  confirmedToday: number;
  newLeadsToday: number;
  overdueFollowUps: number;
};

function statRow(label: string, value: string | number, color = "#374151"): string {
  return `
    <tr>
      <td style="padding:6px 12px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${esc(label)}</td>
      <td style="padding:6px 12px;font-size:14px;font-weight:600;color:${color};border-bottom:1px solid #f3f4f6;text-align:right;">${esc(String(value))}</td>
    </tr>`;
}

export async function sendDailyEmployeeReport(params: EmployeeDailyStats & { to: string; date: string }): Promise<void> {
  const scoreColor = params.confirmedToday > 0 ? "#16a34a" : params.callCount > 0 ? "#d97706" : "#ef4444";

  await send({
    to: params.to,
    subject: `Your Daily Report — ${params.date} | Future Education`,
    html: htmlWrapper(`
      <div class="title">Your Daily Performance</div>
      <div class="body">Hi <strong>${esc(params.name)}</strong>, here's your summary for <strong>${esc(params.date)}</strong>.</div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;overflow:hidden;">
        ${statRow("Calls Made",          params.callCount,         "#2563eb")}
        ${statRow("Call Minutes",        `${params.callMinutes}m`, "#ea580c")}
        ${statRow("Leads Interacted",    params.leadsInteracted,   "#7c3aed")}
        ${statRow("Confirmations Today", params.confirmedToday,    "#16a34a")}
        ${statRow("New Leads Assigned",  params.newLeadsToday,     "#0891b2")}
        ${statRow("Overdue Follow-ups",  params.overdueFollowUps,  params.overdueFollowUps > 0 ? "#ef4444" : "#6b7280")}
      </table>
      <div class="body" style="color:${scoreColor};font-weight:600;">
        ${params.confirmedToday > 0
          ? `Great work today — ${params.confirmedToday} confirmation${params.confirmedToday > 1 ? "s" : ""}!`
          : params.callCount > 0
          ? "Good effort today. Keep following up — confirmations are coming!"
          : "No activity logged today. Remember to log your calls and interactions."}
      </div>
      <a href="${esc(config.frontendUrl)}/dashboard" class="btn" style="color:#ffffff;text-decoration:none;">
        View Dashboard
      </a>
    `),
  });
}

export async function sendAdminDailyReport(params: {
  to: string;
  adminName: string;
  date: string;
  employees: EmployeeDailyStats[];
}): Promise<void> {
  const sorted = [...params.employees].sort((a, b) => b.confirmedToday - a.confirmedToday || b.callCount - a.callCount);
  const totalCalls     = sorted.reduce((s, e) => s + e.callCount, 0);
  const totalMins      = sorted.reduce((s, e) => s + e.callMinutes, 0);
  const totalConfirmed = sorted.reduce((s, e) => s + e.confirmedToday, 0);
  const totalInteracted = sorted.reduce((s, e) => s + e.leadsInteracted, 0);

  const rows = sorted.map((emp) => `
    <tr>
      <td style="padding:7px 10px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${esc(emp.name)}</td>
      <td style="padding:7px 10px;font-size:13px;text-align:center;color:#2563eb;font-weight:600;border-bottom:1px solid #f3f4f6;">${emp.callCount}</td>
      <td style="padding:7px 10px;font-size:13px;text-align:center;color:#ea580c;font-weight:600;border-bottom:1px solid #f3f4f6;">${emp.callMinutes}m</td>
      <td style="padding:7px 10px;font-size:13px;text-align:center;color:#7c3aed;font-weight:600;border-bottom:1px solid #f3f4f6;">${emp.leadsInteracted}</td>
      <td style="padding:7px 10px;font-size:13px;text-align:center;color:${emp.confirmedToday > 0 ? "#16a34a" : "#9ca3af"};font-weight:600;border-bottom:1px solid #f3f4f6;">${emp.confirmedToday}</td>
      <td style="padding:7px 10px;font-size:13px;text-align:center;color:${emp.overdueFollowUps > 0 ? "#ef4444" : "#9ca3af"};font-weight:600;border-bottom:1px solid #f3f4f6;">${emp.overdueFollowUps}</td>
    </tr>`).join("");

  const headerCell = (t: string) =>
    `<th style="padding:8px 10px;font-size:11px;text-align:center;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:#f9fafb;border-bottom:2px solid #e5e7eb;">${t}</th>`;

  await send({
    to: params.to,
    subject: `Team Daily Report — ${params.date} | Future Education`,
    html: htmlWrapper(`
      <div class="title">Team Daily Summary</div>
      <div class="body">Hi <strong>${esc(params.adminName)}</strong>, here is today's team performance for <strong>${esc(params.date)}</strong>.</div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:4px;overflow:hidden;">
        ${statRow("Total Calls",        totalCalls,     "#2563eb")}
        ${statRow("Total Call Minutes", `${totalMins}m`,"#ea580c")}
        ${statRow("Leads Interacted",   totalInteracted,"#7c3aed")}
        ${statRow("Confirmations Today",totalConfirmed, "#16a34a")}
      </table>

      <div class="body" style="font-weight:600;color:#374151;margin-top:20px;">Individual Breakdown</div>
      <table style="width:100%;border-collapse:collapse;margin:10px 0;">
        <thead>
          <tr>
            ${headerCell("Employee")}
            ${headerCell("Calls")}
            ${headerCell("Mins")}
            ${headerCell("Interacted")}
            ${headerCell("Confirmed")}
            ${headerCell("Overdue")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <a href="${esc(config.frontendUrl)}/dashboard" class="btn" style="color:#ffffff;text-decoration:none;">
        View Full Dashboard
      </a>
    `),
  });
}
