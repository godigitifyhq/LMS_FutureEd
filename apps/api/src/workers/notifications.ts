import { Worker } from "bullmq";
import type Redis from "ioredis";
import {
  sendWelcomeSetupEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeactivatedEmail,
  sendLeadAssignedEmail,
  sendFollowUpReminderEmail,
  sendApplicationConfirmationEmail,
  sendAdmissionFormEmail,
  sendMetaLeadFormEmail,
  sendWhatsAppLeadEmail,
  sendLeadCreatedEmail,
  sendDailyEmployeeReport,
  sendAdminDailyReport,
} from "../services/email";
import { config } from "../config";

export function startNotificationWorker(connection: Redis): Worker {
  const worker = new Worker(
    "notifications",
    async (job) => {
      const { name, data } = job;
      console.log(`[EMAIL WORKER] Processing job: ${name} → to: ${data.to ?? "(no to)"}`);

      switch (name) {
        case "welcome-email":
          await sendWelcomeSetupEmail({
            to: data.to,
            name: data.name,
            role: data.role,
            setupUrl: data.setupUrl,
          });
          break;

        case "password-reset-email":
          await sendPasswordResetEmail({
            to: data.to,
            name: data.name,
            resetUrl: data.resetUrl,
          });
          break;

        case "password-changed-email":
          await sendPasswordChangedEmail({
            to: data.to,
            name: data.name,
            newPassword: data.newPassword,
          });
          break;

        case "account-deactivated-email":
          await sendAccountDeactivatedEmail({ to: data.to, name: data.name });
          break;

        case "lead-assigned-email":
          await sendLeadAssignedEmail({
            to: data.to,
            employeeName: data.employeeName,
            studentName: data.studentName,
            phone: data.phone,
            leadUrl: `${config.frontendUrl}/leads/${data.leadId}`,
            assignedByName: data.assignedByName,
          });
          break;

        case "overdue-followup":
          await sendFollowUpReminderEmail({
            to: data.recipientEmail,
            employeeName: data.recipientName,
            studentName: data.studentName,
            phone: data.phone ?? "",
            leadUrl: `${config.frontendUrl}/leads/${data.leadId}`,
            overdueBy: data.inAppMessage,
          });
          break;

        case "application-sent-email":
          await sendApplicationConfirmationEmail({
            to: data.to,
            studentName: data.studentName,
            institutionName: data.institutionName,
            programName: data.programName,
            applicationNumber: data.applicationNumber,
          });
          break;

        case "admission-form-email":
          await sendAdmissionFormEmail({
            to: data.to,
            studentName: data.studentName,
            courseName: data.courseName,
            branchName: data.branchName,
            pdfBuffer: Buffer.from(data.pdfBuffer as string, "base64"),
          });
          break;

        case "lead-created-email":
          await sendLeadCreatedEmail({
            to: data.to,
            studentName: data.studentName,
            leadId: data.leadId,
          });
          break;

        case "meta-lead-form-assigned":
          await sendMetaLeadFormEmail({
            to: data.to,
            employeeName: data.employeeName,
            studentName: data.studentName,
            phone: data.phone,
            email: data.email ?? null,
            leadUrl: data.leadUrl,
            adName: data.adName ?? null,
          });
          break;

        case "whatsapp-lead-assigned":
          await sendWhatsAppLeadEmail({
            to: data.to,
            employeeName: data.employeeName,
            studentName: data.studentName,
            phone: data.phone,
            firstMessage: data.firstMessage ?? null,
            timestamp: data.timestamp ?? null,
            leadUrl: data.leadUrl,
          });
          break;

        case "daily-employee-report":
          await sendDailyEmployeeReport({
            to:              data.email,
            name:            data.name,
            date:            data.date,
            callCount:       data.callCount,
            callMinutes:     data.callMinutes,
            leadsInteracted: data.leadsInteracted,
            confirmedToday:  data.confirmedToday,
            newLeadsToday:   data.newLeadsToday,
            overdueFollowUps: data.overdueFollowUps,
          });
          break;

        case "admin-daily-report":
          await sendAdminDailyReport({
            to:        data.to,
            adminName: data.adminName,
            date:      data.date,
            employees: data.employees,
          });
          break;

        default:
          console.warn(`[EMAIL WORKER] Unknown job: ${name}`);
      }

      console.log(`[EMAIL WORKER] Done: ${name} → ${data.to ?? "(no to)"}`);
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[EMAIL WORKER] Job FAILED [${job?.name}] to=${job?.data?.to}:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[EMAIL WORKER] Worker error:", err.message);
  });

  return worker;
}
