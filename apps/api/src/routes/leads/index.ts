import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { canViewLead } from "@lms/auth";
import { canEmployeeSeeConfirmedLead } from "@lms/core";
import { LeadStatus, Role } from "@lms/types";
import { leadListRoute } from "./list";
import { createLeadRoute } from "./create";
import { leadDetailRoute } from "./detail";
import { updateLeadRoute } from "./update";
import { transitionLeadRoute } from "./transition";
import { assignLeadRoute } from "./assign";
import { unassignedLeadsRoute } from "./unassigned";
import { overdueLeadsRoute } from "./overdue";
import { leadFollowUpsRoute } from "./followups";
import { bulkLeadRoutes } from "./bulk";

export async function leadRoutes(fastify: FastifyInstance): Promise<void> {
  // Order matters — specific routes before parameterized routes
  await fastify.register(unassignedLeadsRoute);
  await fastify.register(overdueLeadsRoute);
  await fastify.register(leadFollowUpsRoute);
  await fastify.register(bulkLeadRoutes);
  await fastify.register(leadListRoute);
  await fastify.register(createLeadRoute);

  // GET /leads/:id/confirmed/pdf
  fastify.get(
    "/:id/confirmed/pdf",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId, role } = request.user;

      const lead = await fastify.prisma.lead.findUnique({
        where: { id },
        select: {
          id: true,
          studentName: true,
          phone: true,
          email: true,
          fatherName: true,
          dateOfBirth: true,
          city: true,
          district: true,
          state: true,
          confirmedAt: true,
          status: true,
          confirmedApplication: {
            include: {
              academicRecords: true,
              entranceExams: true,
              documents: { include: { documentType: true } },
            },
          },
          courses: {
            where: { isPrimary: true },
            include: { course: true },
          },
          assignedTo: { select: { name: true } },
          branch: { select: { name: true, city: true, address: true } },
          assignedToId: true,
          createdById: true,
          branchId: true,
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      const canView = canViewLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        {
          id: lead.id,
          assignedToId: lead.assignedToId ?? null,
          createdById: lead.createdById,
          branchId: lead.branchId,
          status: lead.status,
        },
      );

      if (!canView) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this lead",
          },
        });
      }

      if (role === "EMPLOYEE" && lead.status === LeadStatus.CONFIRMED) {
        const visible = canEmployeeSeeConfirmedLead({
          lead: {
            id: lead.id,
            status: lead.status as LeadStatus,
            assignedToId: lead.assignedToId ?? null,
            createdById: lead.createdById,
            confirmedAt: lead.confirmedAt,
            confirmedById: null,
          },
          user: { id: userId, role: role as Role },
        });

        if (!visible) {
          return reply.status(403).send({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "This confirmed lead has been handed over to admin",
            },
          });
        }
      }

      if (!lead.confirmedApplication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Confirmed application not found",
          },
        });
      }

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const app = lead.confirmedApplication;
      const fileName = `FE-${lead.studentName.replace(/\s+/g, "-")}-Admission.pdf`;

      void reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${fileName}"`);

      doc.pipe(reply.raw);

      const ensureSpace = (minimumY = 700) => {
        if (doc.y > minimumY) {
          doc.addPage();
          doc.y = 40;
        }
      };

      const field = (
        label: string,
        value: string | number | Date | null | undefined,
      ) => {
        ensureSpace();
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(`${label}: `, { continued: true });
        const textValue =
          value instanceof Date
            ? value.toLocaleDateString("en-IN")
            : value !== null && value !== undefined
              ? String(value)
              : "—";
        doc.font("Helvetica").text(textValue);
      };

      // Header
      doc.fontSize(18).font("Helvetica-Bold");
      doc.text("FUTURE EDUCATION TRUST", { align: "center" });
      doc.fontSize(13).font("Helvetica");
      doc.text("Admission Assistance Form", { align: "center" });
      doc.fontSize(9).text(lead.branch.name, { align: "center" });
      if (lead.branch.address || lead.branch.city) {
        doc.text(lead.branch.address ?? lead.branch.city, { align: "center" });
      }
      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown();

      // Student details
      doc.fontSize(11).font("Helvetica-Bold").text("Student Information");
      doc.moveDown(0.5);
      field("Name", lead.studentName);
      field("Father's Name", lead.fatherName);
      field("Date of Birth", lead.dateOfBirth);
      field("Phone", lead.phone);
      field("Email", lead.email);
      field(
        "Address",
        [lead.city, lead.district, lead.state].filter(Boolean).join(", ") ||
          null,
      );
      field("Course", lead.courses[0]?.course.name ?? null);
      field("Aadhar No.", app.aadharNo);
      field("Apaar ID", app.apaarId);
      field("Confirmed On", lead.confirmedAt);
      field("Counsellor", lead.assignedTo?.name ?? null);
      doc.moveDown();

      // Payment
      doc.fontSize(11).font("Helvetica-Bold").text("Payment Details");
      doc.moveDown(0.5);
      field(
        "Booking Amount",
        app.bookingAmount != null ? `₹${app.bookingAmount}` : null,
      );
      field(
        "Admission Amount",
        app.admissionAmount != null ? `₹${app.admissionAmount}` : null,
      );
      field("Dues", app.duesAmount != null ? `₹${app.duesAmount}` : null);
      field("Permanent Address", app.permanentAddress);
      field("Permanent Phone", app.permanentPhone);
      field("Local Guardian", app.localGuardianName);
      field("Guardian Address", app.localGuardianAddress);
      field("Guardian Phone", app.localGuardianPhone);
      field("Extra Curricular", app.extraCurricular);
      field("Authorised By", app.authorisedBy);
      doc.moveDown();

      // Academic records
      if (app.academicRecords.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").text("Academic Records");
        doc.moveDown(0.5);
        for (const record of app.academicRecords) {
          field(
            record.level.replaceAll("_", " "),
            [
              record.institution,
              record.board,
              record.passingYear,
              record.percentage != null ? `${record.percentage}%` : null,
              record.grade,
            ]
              .filter(Boolean)
              .join(" • ") || null,
          );
        }
        doc.moveDown();
      }

      // Entrance exams
      if (app.entranceExams.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").text("Entrance Exams");
        doc.moveDown(0.5);
        for (const exam of app.entranceExams) {
          field(
            exam.examName,
            [
              exam.rollNo,
              exam.score,
              exam.rank != null ? `Rank ${exam.rank}` : null,
            ]
              .filter(Boolean)
              .join(" • ") || null,
          );
        }
        doc.moveDown();
      }

      // Documents
      if (app.documents.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").text("Documents");
        doc.moveDown(0.5);
        for (const document of app.documents) {
          field(
            document.documentType.name,
            `${document.fileName}${document.isVerified ? " (Verified)" : ""}`,
          );
        }
      }

      doc.moveDown(2);
      doc
        .fontSize(9)
        .text("Authorised Signature: ___________________", { align: "right" });

      doc.end();
    },
  );

  // GET /leads/:id/confirmed
  fastify.get(
    "/:id/confirmed",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const app = await fastify.prisma.confirmedApplication.findUnique({
        where: { leadId: id },
        include: {
          academicRecords: true,
          entranceExams: true,
          documents: { include: { documentType: true } },
        },
      });

      if (!app) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "No confirmed application found",
          },
        });
      }

      return reply.status(200).send({ success: true, data: app });
    },
  );

  // POST /leads/:id/confirmed/documents
  fastify.post(
    "/:id/confirmed/documents",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id: leadId } = request.params as { id: string };
      const { documentTypeId, fileUrl, fileName, confirmedApplicationId } =
        request.body as {
          documentTypeId: string;
          fileUrl: string;
          fileName: string;
          confirmedApplicationId: string;
        };

      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          confirmedApplication: { select: { id: true } },
        },
      });

      if (!lead?.confirmedApplication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Confirmed application not found",
          },
        });
      }

      const doc = await fastify.prisma.leadDocument.create({
        data: {
          confirmedApplicationId:
            confirmedApplicationId || lead.confirmedApplication.id,
          documentTypeId,
          fileUrl,
          fileName,
        },
        include: { documentType: true },
      });

      return reply.status(201).send({ success: true, data: doc });
    },
  );

  // POST /leads/import
  fastify.post(
    "/import",
    {
      preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])],
    },
    async (request, reply) => {
      const { rows } = request.body as {
        rows: Array<{
          rowIndex: number;
          studentName: string;
          phone: string;
          email?: string | null;
          fatherName?: string | null;
          city?: string | null;
          state?: string | null;
        }>;
      };

      const { id: userId, branchId } = request.user;

      // Get existing leads for duplicate check
      const existingLeads = await fastify.prisma.lead.findMany({
        where: {
          OR: [
            { phone: { in: rows.map((r) => r.phone).filter(Boolean) } },
            {
              email: {
                in: rows.map((r) => r.email).filter(Boolean) as string[],
              },
            },
          ],
        },
        select: {
          id: true,
          phone: true,
          email: true,
          status: true,
          isDuplicate: true,
          duplicateOfId: true,
        },
      });

      const { processImportRows } = await import("@lms/core");
      const result = processImportRows(rows as any, existingLeads as any);

      // Create clean leads
      const created = [];
      for (const row of result.imported) {
        try {
          const lead = await fastify.prisma.lead.create({
            data: {
              studentName: row.studentName,
              phone: row.phone,
              email: (row as any).email ?? null,
              fatherName: (row as any).fatherName ?? null,
              city: (row as any).city ?? null,
              state: (row as any).state ?? null,
              branchId,
              createdById: userId,
              assignedToId: userId,
              status: "NEW",
            },
          });
          created.push(lead);
        } catch {
          /* skip individual failures */
        }
      }

      return reply.status(200).send({
        success: true,
        data: {
          imported: created,
          duplicateQueue: result.duplicateQueue,
          errors: result.errors,
        },
      });
    },
  );

  // PATCH /leads/:id/confirmed
  fastify.patch(
    "/:id/confirmed",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const updated = await fastify.prisma.confirmedApplication.update({
        where: { leadId: id },
        data: body as any,
      });

      return reply.status(200).send({ success: true, data: updated });
    },
  );
  await fastify.register(leadDetailRoute);
  await fastify.register(updateLeadRoute);
  await fastify.register(transitionLeadRoute);
  await fastify.register(assignLeadRoute);
}
