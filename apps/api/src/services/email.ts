import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

// Embed logo as base64 at startup so it works in any environment with no external URL
function loadLogoDataUri(): string | null {
  try {
    const logoPath = path.resolve(__dirname, "../../public/logo.jpg");
    const buf = fs.readFileSync(logoPath);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
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

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  pool: true,        // reuse SMTP connection — only authenticates once
  maxConnections: 1,
  maxMessages: 100,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export async function verifyEmailConnection(): Promise<boolean> {
  if (!config.smtp.user || !config.smtp.pass) {
    console.warn("⚠ Email not configured — set SMTP_USER and SMTP_PASS");
    return false;
  }

  try {
    await transporter.verify();
    console.log("✓ Email service connected");
    return true;
  } catch (error) {
    console.error("✗ Email service failed:", error);
    return false;
  }
}

function htmlWrapper(content: string): string {
  const logoUrl = LOGO_DATA_URI ?? config.logoUrl ?? null;

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
      .btn { display: inline-block; background: #005826; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
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
  if (!config.smtp.user || !config.smtp.pass) return;

  await transporter.sendMail({
    from: config.smtp.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
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
      <a href="${esc(params.setupUrl)}" class="btn">Set My Password</a>
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
      <a href="${esc(params.resetUrl)}" class="btn">Reset Password</a>
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
      <a href="${esc(config.frontendUrl)}/login" class="btn">Login Now</a>
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
      <a href="${esc(params.leadUrl)}" class="btn">View Lead</a>
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
      <a href="${esc(params.leadUrl)}" class="btn">Update Lead</a>
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
      <a href="${esc(params.leadUrl)}" class="btn">View Lead</a>
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
      <a href="${esc(params.leadUrl)}" class="btn" style="background: #128C7E;">View Lead</a>
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
  if (!config.smtp.user || !config.smtp.pass) return;

  await transporter.sendMail({
    from: config.smtp.from,
    to: params.to,
    subject: `Admission Application — ${params.courseName} | Future Education`,
    html: htmlWrapper(`
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
    `),
    attachments: [
      {
        filename: `Admission-Form-${params.studentName.replace(/[^\w\s\-]/g, "").replace(/\s+/g, "-").slice(0, 80) || "student"}.pdf`,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
