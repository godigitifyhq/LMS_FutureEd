import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { canViewLead, canUpdateLead } from "@lms/auth";
import { canEmployeeSeeConfirmedLead, transitionLead } from "@lms/core";
import { LeadStatus, Role, QualificationLevel } from "@lms/types";
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
import { publicDirectAdmissionRoute } from "./publicDirectAdmission";
import { generateAdmissionPDF } from "../../services/admissionPDF";
import {
  invalidateAnalyticsCache,
  invalidateActivityCache,
} from "../../services/cache";
import { QUEUES } from "../../plugins/bullmq";
import { findDuplicateLeads } from "./service";
import { deleteFile, getStorageKeyFromUrl } from "../../storage";

// Fields the client is allowed to write on ConfirmedApplication.
// Never include auto-generated IDs, timestamps, or audit tracking fields.
const CONFIRMED_APP_ALLOWED_FIELDS = new Set([
  "aadharNo", "apaarId",
  "gender", "maritalStatus",
  "motherName", "motherOccupation", "motherIncome",
  "fatherName", "fatherOccupation", "fatherIncome",
  "noOfSisters", "noOfBrothers", "nationality", "religion", "category",
  "postalAddress", "permanentAddress", "permanentPhone",
  "localGuardianName", "localGuardianAddress", "localGuardianPhone",
  "bookingAmount", "bookingCashDDNo", "bookingBank", "bookingDate",
  "admissionAmount", "admissionCashDDNo", "admissionBank", "admissionDate",
  "duesAmount", "dueDate",
  "extraCurricular", "authorisedBy", "remarks",
]);

const VALID_ACADEMIC_LEVELS = new Set(Object.values(QualificationLevel));

/** Sanitise student name for use in HTTP headers (Content-Disposition). */
function safeFileName(name: string): string {
  return name
    .replace(/[^\w\s\-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "student";
}

export async function leadRoutes(fastify: FastifyInstance): Promise<void> {
  // Order matters — specific routes before parameterized routes
  await fastify.register(unassignedLeadsRoute);
  await fastify.register(overdueLeadsRoute);
  await fastify.register(leadFollowUpsRoute);
  await fastify.register(bulkLeadRoutes);
  await fastify.register(publicDirectAdmissionRoute);

  // GET /leads/check-duplicate?phone=XXXXXXXXXX
  // Exact-match lookup used by the new-lead form for instant duplicate detection.
  // No pagination — returns all exact matches for the given phone number.
  fastify.get(
    "/check-duplicate",
    { preHandler: authenticate },
    async (request, reply) => {
      const { phone } = request.query as { phone?: string };
      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_PHONE",
            message: "Provide a valid 10-digit Indian mobile number",
          },
        });
      }
      const leads = await findDuplicateLeads({
        phone,
        email: null,
        prisma: fastify.prisma,
      });
      return reply.status(200).send({ success: true, data: { leads } });
    },
  );

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
          gender: true,
          maritalStatus: true,
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

      if (!lead.confirmedApplication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Confirmed application not found",
          },
        });
      }

      const fileName = `FE-${safeFileName(lead.studentName)}-Admission.pdf`;

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await generateAdmissionPDF(lead);
      } catch (err) {
        fastify.log.error(err, "PDF generation failed");
        return reply.status(500).send({
          success: false,
          error: { code: "PDF_ERROR", message: "Failed to generate PDF" },
        });
      }

      return reply
        .type("application/pdf")
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .header("Content-Length", pdfBuffer.length)
        .send(pdfBuffer);
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
      const { id: userId, role } = request.user;

      const lead = await fastify.prisma.lead.findUnique({
        where: { id },
        select: { id: true, assignedToId: true, createdById: true, branchId: true, status: true },
      });
      if (!lead) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Lead not found" } });
      }
      if (!canViewLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        { id: lead.id, assignedToId: lead.assignedToId ?? null, createdById: lead.createdById, branchId: lead.branchId, status: lead.status },
      )) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } });
      }

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

  // POST /leads/:id/confirmed/academic — bulk replace academic records
  fastify.post(
    "/:id/confirmed/academic",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: leadId } = request.params as { id: string };
      const { id: userId, role } = request.user;
      const { records } = request.body as {
        records: Array<{
          level: string;
          stream?: string;
          institution?: string;
          board?: string;
          passingYear?: number;
          percentage?: number;
          grade?: string;
        }>;
      };

      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, assignedToId: true, createdById: true, branchId: true, status: true },
      });
      if (!lead) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Lead not found" } });
      }
      if (!canUpdateLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        { id: lead.id, assignedToId: lead.assignedToId ?? null, createdById: lead.createdById, branchId: lead.branchId, status: lead.status },
      )) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } });
      }

      // Validate enum levels before hitting the DB
      for (const r of records) {
        if (r.level && !VALID_ACADEMIC_LEVELS.has(r.level as QualificationLevel)) {
          return reply.status(400).send({
            success: false,
            error: { code: "INVALID_INPUT", message: `Invalid academic level: ${r.level}` },
          });
        }
      }

      const app = await fastify.prisma.confirmedApplication.findUnique({
        where: { leadId },
        select: { id: true },
      });

      if (!app) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Confirmed application not found",
          },
        });
      }

      await fastify.prisma.$transaction([
        fastify.prisma.academicRecord.deleteMany({
          where: { confirmedApplicationId: app.id },
        }),
        ...(records.length > 0
          ? [
              fastify.prisma.academicRecord.createMany({
                data: records.map((r) => ({
                  confirmedApplicationId: app.id,
                  level: r.level as QualificationLevel,
                  stream: r.stream ?? null,
                  institution: r.institution ?? null,
                  board: r.board ?? null,
                  passingYear: r.passingYear ?? null,
                  percentage: r.percentage ?? null,
                  grade: r.grade ?? null,
                })),
              }),
            ]
          : []),
      ]);

      return reply.status(200).send({ success: true });
    },
  );

  // POST /leads/:id/confirmed/exams — bulk replace entrance exams
  fastify.post(
    "/:id/confirmed/exams",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: leadId } = request.params as { id: string };
      const { id: userId, role } = request.user;
      const { exams } = request.body as {
        exams: Array<{
          examName: string;
          rollNo?: string;
          score?: string;
          rank?: number;
        }>;
      };

      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, assignedToId: true, createdById: true, branchId: true, status: true },
      });
      if (!lead) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Lead not found" } });
      }
      if (!canUpdateLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        { id: lead.id, assignedToId: lead.assignedToId ?? null, createdById: lead.createdById, branchId: lead.branchId, status: lead.status },
      )) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } });
      }

      const app = await fastify.prisma.confirmedApplication.findUnique({
        where: { leadId },
        select: { id: true },
      });

      if (!app) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Confirmed application not found",
          },
        });
      }

      await fastify.prisma.$transaction([
        fastify.prisma.entranceExamDetail.deleteMany({
          where: { confirmedApplicationId: app.id },
        }),
        ...(exams.length > 0
          ? [
              fastify.prisma.entranceExamDetail.createMany({
                data: exams.map((e) => ({
                  confirmedApplicationId: app.id,
                  examName: e.examName,
                  rollNo: e.rollNo ?? null,
                  score: e.score ?? null,
                  rank: e.rank ?? null,
                })),
              }),
            ]
          : []),
      ]);

      return reply.status(200).send({ success: true });
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
      const { id: userId, role } = request.user;
      // confirmedApplicationId is intentionally NOT accepted from the client —
      // always derived from the lead in the URL to prevent IDOR.
      const { documentTypeId, fileUrl, fileName } =
        request.body as {
          documentTypeId: string;
          fileUrl: string;
          fileName: string;
        };

      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          assignedToId: true,
          createdById: true,
          branchId: true,
          status: true,
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

      if (!canUpdateLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        { id: lead.id, assignedToId: lead.assignedToId ?? null, createdById: lead.createdById, branchId: lead.branchId, status: lead.status },
      )) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } });
      }

      // Always use the confirmedApplicationId from the DB — never from client
      const targetConfirmedApplicationId = lead.confirmedApplication.id;

      const previousDocs = await fastify.prisma.leadDocument.findMany({
        where: {
          confirmedApplicationId: targetConfirmedApplicationId,
          documentTypeId,
        },
        select: { id: true, fileUrl: true },
      });

      const doc = await fastify.prisma.$transaction(async (tx) => {
        if (previousDocs.length > 0) {
          await tx.leadDocument.deleteMany({
            where: {
              confirmedApplicationId: targetConfirmedApplicationId,
              documentTypeId,
            },
          });
        }

        return tx.leadDocument.create({
          data: {
            confirmedApplicationId: targetConfirmedApplicationId,
            documentTypeId,
            fileUrl,
            fileName,
          },
          include: { documentType: true },
        });
      });

      for (const previousDoc of previousDocs) {
        const storageKey = getStorageKeyFromUrl(previousDoc.fileUrl);
        if (!storageKey) continue;

        try {
          await deleteFile(storageKey);
        } catch (error) {
          fastify.log.warn(
            {
              error,
              storageKey,
              documentTypeId,
              confirmedApplicationId: targetConfirmedApplicationId,
            },
            "Failed to delete replaced document file",
          );
        }
      }

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
          alternatePhone?: string | null;
          whatsappNumber?: string | null;
          gender?: string | null;
          maritalStatus?: string | null;
          dateOfBirth?: string | null;
          city?: string | null;
          district?: string | null;
          state?: string | null;
          village?: string | null;
          sector?: string | null;
          qualification?: string | null;
          schoolCollege?: string | null;
          boardUniversity?: string | null;
          passingYear?: string | null;
          percentage?: string | null;
          pcmPcbPercentage?: string | null;
          purpose?: string | null;
          remarks?: string | null;
          course?: string | null;
          source?: string | null;
        }>;
      };

      const MAX_IMPORT_ROWS = 500;
      if (!Array.isArray(rows) || rows.length === 0) {
        return reply.status(400).send({ success: false, error: { code: "INVALID_INPUT", message: "rows must be a non-empty array" } });
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        return reply.status(400).send({ success: false, error: { code: "TOO_MANY_ROWS", message: `Maximum ${MAX_IMPORT_ROWS} rows per import. Split into smaller batches.` } });
      }

      // Normalize phone numbers — strip non-digits, handle +91 prefix and scientific notation
      function normalizeImportPhone(raw: string): string | null {
        const digits = String(raw ?? "").replace(/\D/g, "");
        // Handle scientific notation (e.g. 9.876543e+9 → "9876543000")
        const fromFloat = digits.length < 5 ? String(Math.round(Number(raw))).replace(/\D/g, "") : digits;
        const candidate = fromFloat.startsWith("91") && fromFloat.length === 12 ? fromFloat.slice(2) : fromFloat;
        return /^[6-9]\d{9}$/.test(candidate) ? candidate : null;
      }

      const { id: userId, branchId } = request.user;

      // Pre-fetch courses and source types for name→id resolution
      const [allCourses, allSources] = await Promise.all([
        fastify.prisma.course.findMany({ select: { id: true, name: true } }),
        fastify.prisma.leadSourceType.findMany({
          select: { id: true, name: true },
        }),
      ]);
      const courseMap = new Map(
        allCourses.map((c) => [c.name.toLowerCase().trim(), c.id]),
      );
      const sourceMap = new Map(
        allSources.map((s) => [s.name.toLowerCase().trim(), s.id]),
      );

      // Fuzzy lookup: exact first, then contains fallback
      function resolveCourseId(name: string): string | undefined {
        const key = name.toLowerCase().trim();
        if (courseMap.has(key)) return courseMap.get(key);
        for (const [dbName, id] of courseMap.entries()) {
          if (dbName.includes(key) || key.includes(dbName)) return id;
        }
        return undefined;
      }
      function resolveSourceId(name: string): string | undefined {
        const key = name.toLowerCase().trim();
        if (sourceMap.has(key)) return sourceMap.get(key);
        for (const [dbName, id] of sourceMap.entries()) {
          if (dbName.includes(key) || key.includes(dbName)) return id;
        }
        return undefined;
      }

      // Normalize phones before duplicate check so +91/scientific-notation phones match
      const normalizedRows = rows.map((r) => ({
        ...r,
        phone: normalizeImportPhone(r.phone) ?? r.phone,
        email: r.email?.toLowerCase().trim() ?? null,
      }));

      // Get existing leads for duplicate check
      const existingLeads = await fastify.prisma.lead.findMany({
        where: {
          OR: [
            { phone: { in: normalizedRows.map((r) => r.phone).filter(Boolean) } },
            {
              email: {
                in: normalizedRows.map((r) => r.email).filter(Boolean) as string[],
                mode: "insensitive",
              } as any,
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
      const result = processImportRows(normalizedRows as any, existingLeads as any);

      // Create clean leads
      const created = [];
      const importErrors: Array<{ rowIndex: number; reason: string }> = [];
      for (const row of result.imported) {
        // Validate phone after normalization
        const phone = normalizeImportPhone(row.phone) ?? row.phone;
        if (!/^[6-9]\d{9}$/.test(phone)) {
          importErrors.push({ rowIndex: row.rowIndex, reason: `Invalid phone number: ${row.phone}` });
          continue;
        }

        try {
          // Resolve source id
          const sourceId = row.source
            ? (resolveSourceId(row.source) ?? null)
            : null;

          // Resolve course ids (support comma-separated: "B.Tech CSE, MBA")
          const courseIds: string[] = row.course
            ? row.course
                .split(",")
                .map((n) => n.trim())
                .map((n) => resolveCourseId(n))
                .filter((id): id is string => !!id)
            : [];

          const lead = await fastify.prisma.lead.create({
            data: {
              studentName: row.studentName,
              phone,
              email: row.email?.toLowerCase().trim() ?? null,
              fatherName: row.fatherName ?? null,
              alternatePhone: row.alternatePhone ?? null,
              whatsappNumber: row.whatsappNumber ?? null,
              gender: (row.gender as any) ?? null,
              maritalStatus: (row.maritalStatus as any) ?? null,
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
              city: row.city ?? null,
              district: row.district ?? null,
              state: row.state ?? null,
              village: row.village ?? null,
              sector: row.sector ?? null,
              qualification: (row.qualification as any) ?? null,
              schoolCollege: row.schoolCollege ?? null,
              boardUniversity: row.boardUniversity ?? null,
              passingYear: row.passingYear ? Number(row.passingYear) : null,
              percentage: row.percentage ? Number(row.percentage) : null,
              pcmPcbPercentage: row.pcmPcbPercentage
                ? Number(row.pcmPcbPercentage)
                : null,
              sourceId,
              purpose: row.purpose ?? null,
              remarks: row.remarks ?? null,
              branchId,
              createdById: userId,
              assignedToId: null,
              status: "NEW",
            },
          });

          // Create course associations
          if (courseIds.length > 0) {
            await fastify.prisma.leadCourse.createMany({
              data: courseIds.map((courseId, index) => ({
                leadId: lead.id,
                courseId,
                isPrimary: index === 0,
              })),
              skipDuplicates: true,
            });
          }

          created.push(lead);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          importErrors.push({ rowIndex: row.rowIndex, reason });
        }
      }

      return reply.status(200).send({
        success: true,
        data: {
          imported: created,
          duplicateQueue: result.duplicateQueue,
          errors: [...result.errors, ...importErrors],
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
      const { id: leadId } = request.params as { id: string };
      const { id: userId, role } = request.user;
      const raw = request.body as Record<string, unknown>;

      // Ownership check
      const leadForAuth = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, assignedToId: true, createdById: true, branchId: true, status: true },
      });
      if (!leadForAuth) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Lead not found" } });
      }
      if (!canUpdateLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        { id: leadForAuth.id, assignedToId: leadForAuth.assignedToId ?? null, createdById: leadForAuth.createdById, branchId: leadForAuth.branchId, status: leadForAuth.status },
      )) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } });
      }

      // Apply field whitelist — never allow client to write auto-generated IDs or audit fields
      const sanitizedRaw: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (CONFIRMED_APP_ALLOWED_FIELDS.has(k)) sanitizedRaw[k] = v;
      }

      const DATE_FIELDS = ["bookingDate", "admissionDate", "dueDate"] as const;
      const body: Record<string, unknown> = { ...sanitizedRaw };
      for (const field of DATE_FIELDS) {
        if (typeof body[field] === "string" && body[field]) {
          body[field] = new Date(body[field] as string);
        } else if (body[field] === "" || body[field] === null) {
          body[field] = null;
        }
      }

      const leadUpdateData: Record<string, unknown> = {};
      if (Object.prototype.hasOwnProperty.call(sanitizedRaw, "gender")) {
        const gender = typeof raw.gender === "string" ? raw.gender : "";
        const normalizedGender =
          gender === "MALE" || gender === "FEMALE" || gender === "OTHER"
            ? gender
            : null;
        leadUpdateData["gender"] = normalizedGender;
        body["gender"] = normalizedGender;
      }
      if (Object.prototype.hasOwnProperty.call(sanitizedRaw, "maritalStatus")) {
        const maritalStatus =
          typeof raw.maritalStatus === "string" ? raw.maritalStatus : "";
        const normalizedMaritalStatus =
          maritalStatus === "SINGLE" || maritalStatus === "MARRIED"
            ? maritalStatus
            : null;
        leadUpdateData["maritalStatus"] = normalizedMaritalStatus;
        body["maritalStatus"] = normalizedMaritalStatus;
      }

      const existing = await fastify.prisma.confirmedApplication.findUnique({
        where: { leadId },
        select: { aadharNo: true, fatherOccupation: true, motherName: true },
      });

      const isFormComplete = Boolean(
        (body["aadharNo"] || existing?.aadharNo) &&
        (body["fatherOccupation"] ||
          existing?.fatherOccupation ||
          existing?.motherName ||
          body["motherName"]),
      );

      const updated = await fastify.prisma.$transaction(async (tx) => {
        if (Object.keys(leadUpdateData).length > 0) {
          await tx.lead.update({
            where: { id: leadId },
            data: leadUpdateData,
          });
        }

        return tx.confirmedApplication.upsert({
          where: { leadId },
          create: {
            leadId,
            ...(body as any),
            isFormComplete,
          },
          update: {
            ...(body as any),
            isFormComplete,
          },
          include: {
            academicRecords: true,
            entranceExams: true,
            documents: { include: { documentType: true } },
          },
        });
      });

      return reply.status(200).send({ success: true, data: updated });
    },
  );

  // POST /leads/:id/send-admission
  fastify.post(
    "/:id/send-admission",
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
          gender: true,
          maritalStatus: true,
          qualification: true,
          schoolCollege: true,
          boardUniversity: true,
          passingYear: true,
          percentage: true,
          status: true,
          assignedToId: true,
          createdById: true,
          branchId: true,
          courses: { where: { isPrimary: true }, include: { course: true } },
          assignedTo: { select: { name: true } },
          branch: { select: { name: true, city: true, address: true } },
          confirmedApplication: {
            include: {
              academicRecords: true,
              entranceExams: true,
              documents: { include: { documentType: true } },
            },
          },
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      // Ownership check
      if (!canUpdateLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        { id: lead.id, assignedToId: lead.assignedToId ?? null, createdById: lead.createdById, branchId: lead.branchId, status: lead.status },
      )) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } });
      }

      // FSM guard — only valid transitions reach CONFIRMED
      const fsmResult = transitionLead(lead.status as LeadStatus, LeadStatus.CONFIRMED);
      if (!fsmResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_TRANSITION", message: `Cannot confirm from status ${lead.status}: ${fsmResult.error.message}` },
        });
      }

      if (!lead.confirmedApplication) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "FORM_INCOMPLETE",
            message: "Admission form not started yet",
          },
        });
      }

      const pdfBuffer = await generateAdmissionPDF(lead);

      let emailSent = false;
      if (lead.email) {
        try {
          await fastify.queues[QUEUES.NOTIFICATIONS].add(
            "admission-form-email",
            {
              to: lead.email,
              studentName: lead.studentName,
              branchName: lead.branch.name,
              courseName: lead.courses[0]?.course.name ?? "",
              pdfBuffer: pdfBuffer.toString("base64"),
            },
            {
              jobId: `admission-pdf-${id}`, // deduplicate: double-click / network retry
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            },
          );
          emailSent = true;
        } catch {
          emailSent = false;
        }
      }

      await fastify.prisma.$transaction(async (tx) => {
        // Serializable isolation: prevents two concurrent sends from generating the same admissionId
        const existingApp = await tx.confirmedApplication.findUnique({
          where: { leadId: id },
          select: { admissionId: true, fileNumber: true },
        });
        const idUpdates: Record<string, unknown> = {};
        const year = new Date().getFullYear();
        if (!existingApp?.admissionId) {
          const last = await tx.confirmedApplication.findFirst({
            where: { admissionId: { not: null } },
            orderBy: { admissionId: "desc" },
            select: { admissionId: true },
          });
          const nextNum = last?.admissionId
            ? parseInt(last.admissionId.slice(1)) + 1
            : 1;
          idUpdates["admissionId"] = `S${String(nextNum).padStart(4, "0")}`;
        }
        if (!existingApp?.fileNumber) {
          const yearApps = await tx.confirmedApplication.findMany({
            where: { fileNumber: { endsWith: `/${year}` } },
            select: { fileNumber: true },
          });
          const maxN = yearApps.reduce((m, a) => {
            const n = parseInt(a.fileNumber?.split("/")[0] ?? "0");
            return isNaN(n) ? m : Math.max(m, n);
          }, 0);
          idUpdates["fileNumber"] = `${maxN + 1}/${year}`;
        }

        await tx.confirmedApplication.update({
          where: { leadId: id },
          data: {
            sentToStudentAt: new Date(),
            sentToStudentEmail: lead.email,
            isFormComplete: true,
            ...idUpdates,
          },
        });

        await tx.lead.update({
          where: { id },
          data: {
            status: LeadStatus.CONFIRMED,
            confirmedAt: new Date(),
            confirmedById: userId,
          },
        });

        await tx.interactionLog.create({
          data: {
            leadId: id,
            userId,
            type: "STATUS_CHANGED",
            note: `Admission application form completed and sent${emailSent ? ` to ${lead.email}` : ""}`,
            statusBefore: lead.status,
            statusAfter: LeadStatus.CONFIRMED,
          },
        });

        await tx.auditLog.create({
          data: {
            leadId: id,
            userId,
            action: "ADMISSION_FORM_SENT",
            newValue: { emailSent, sentTo: lead.email },
          },
        });
      }, { isolationLevel: "Serializable" });

      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(
        fastify.redis,
        request.user.branchId,
        request.user.id,
      );

      return reply.status(200).send({
        success: true,
        data: { emailSent, sentTo: lead.email ?? null },
      });
    },
  );

  await fastify.register(leadDetailRoute);
  await fastify.register(updateLeadRoute);
  await fastify.register(transitionLeadRoute);
  await fastify.register(assignLeadRoute);
}
