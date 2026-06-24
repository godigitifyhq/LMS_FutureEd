import type { FastifyInstance } from "fastify";
import path from "path";
import { z } from "zod";
import { Gender, LeadStatus, MaritalStatus } from "@lms/types";
import { validateBody } from "../../middleware/validate";
import { findDuplicateLeads } from "./service";
import { uploadFile } from "../../storage";

const PublicDirectAdmissionSchema = z.object({
  studentName: z.string().trim().min(2, "Student name is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
  fatherName: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  email: z.string().trim().email().optional(),
  gender: z.nativeEnum(Gender).optional(),
  maritalStatus: z.nativeEnum(MaritalStatus).optional(),
  aadharNo: z.string().trim().max(20).optional(),
  apaarId: z.string().trim().max(50).optional(),
  motherName: z.string().trim().max(100).optional(),
  motherOccupation: z.string().trim().max(100).optional(),
  motherIncome: z.coerce.number().optional(),
  fatherOccupation: z.string().trim().max(100).optional(),
  fatherIncome: z.coerce.number().optional(),
  noOfSisters: z.coerce.number().int().optional(),
  noOfBrothers: z.coerce.number().int().optional(),
  nationality: z.string().trim().max(50).optional(),
  religion: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  postalAddress: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  permanentAddress: z.string().trim().max(250).optional(),
  permanentPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number")
    .optional(),
  localGuardianAddress: z.string().trim().max(250).optional(),
  localGuardianName: z.string().trim().max(100).optional(),
  localGuardianPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number")
    .optional(),
  bookingAmount: z.coerce.number().optional(),
  bookingCashDDNo: z.string().trim().max(100).optional(),
  bookingBank: z.string().trim().max(100).optional(),
  bookingDate: z.string().datetime().nullable().optional(),
  admissionAmount: z.coerce.number().optional(),
  admissionCashDDNo: z.string().trim().max(100).optional(),
  admissionBank: z.string().trim().max(100).optional(),
  admissionDate: z.string().datetime().nullable().optional(),
  duesAmount: z.coerce.number().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  extraCurricular: z.string().trim().max(500).optional(),
  authorisedBy: z.string().trim().max(120).optional(),
  course: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(500).optional(),
  submittedByUserId: z.string().cuid().optional(), // set by logged-in employee; assignee for this admission
});

function normalizeEnum<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
): T | null {
  return value && allowed.includes(value) ? value : null;
}

export async function publicDirectAdmissionRoute(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/public/direct-admission/check-duplicate", async (request, reply) => {
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
  });

  fastify.post("/public/direct-admission", async (request, reply) => {
    const validation = validateBody(PublicDirectAdmissionSchema, request.body);
    if (!validation.success) {
      return reply.status(400).send({ success: false, ...validation.error });
    }

    const body = validation.data;
    const branch = await fastify.prisma.branch.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    // If submitted by a logged-in employee, use them as creator/assignee.
    // Otherwise fall back to the first admin (public kiosk/walk-in scenario).
    const submitter = body.submittedByUserId
      ? await fastify.prisma.user.findFirst({
          where: { id: body.submittedByUserId, isActive: true },
          select: { id: true },
        })
      : null;

    const creator = submitter ?? await fastify.prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "SUB_ADMIN"] }, isActive: true },
      select: { id: true },
    });

    if (!branch || !creator) {
      return reply.status(500).send({
        success: false,
        error: {
          code: "CONFIG_ERROR",
          message: "Admission intake is not configured yet",
        },
      });
    }

    const gender = normalizeEnum(body.gender, [
      Gender.MALE,
      Gender.FEMALE,
      Gender.OTHER,
    ] as const);
    const maritalStatus = normalizeEnum(body.maritalStatus, [
      MaritalStatus.SINGLE,
      MaritalStatus.MARRIED,
    ] as const);

    const lead = await fastify.prisma.$transaction(async (tx) => {
      const existingLead = await tx.lead.findFirst({
        where: { phone: body.phone },
        orderBy: { createdAt: "desc" },
      });

      const bookingDate = body.bookingDate ? new Date(body.bookingDate) : null;
      const admissionDate = body.admissionDate
        ? new Date(body.admissionDate)
        : null;
      const dueDate = body.dueDate ? new Date(body.dueDate) : null;

      if (existingLead) {
        const updatedLead = await tx.lead.update({
          where: { id: existingLead.id },
          data: {
            studentName: body.studentName,
            fatherName: body.fatherName ?? existingLead.fatherName,
            dateOfBirth: body.dateOfBirth
              ? new Date(body.dateOfBirth)
              : existingLead.dateOfBirth,
            email: body.email ?? existingLead.email,
            gender,
            maritalStatus,
            city: body.city ?? existingLead.city,
            district: body.district ?? existingLead.district,
            state: body.state ?? existingLead.state,
          },
        });

        await tx.confirmedApplication.upsert({
          where: { leadId: updatedLead.id },
          create: {
            leadId: updatedLead.id,
            aadharNo: body.aadharNo ?? null,
            apaarId: body.apaarId ?? null,
            fatherName: body.fatherName ?? null,
            gender,
            maritalStatus,
            motherName: body.motherName ?? null,
            motherOccupation: body.motherOccupation ?? null,
            motherIncome: body.motherIncome ?? null,
            fatherOccupation: body.fatherOccupation ?? null,
            fatherIncome: body.fatherIncome ?? null,
            noOfSisters: body.noOfSisters ?? null,
            noOfBrothers: body.noOfBrothers ?? null,
            nationality: body.nationality ?? null,
            religion: body.religion ?? null,
            category: body.category ?? null,
            postalAddress: body.postalAddress ?? null,
            permanentAddress: body.permanentAddress ?? null,
            permanentPhone: body.permanentPhone ?? null,
            localGuardianAddress: body.localGuardianAddress ?? null,
            localGuardianName: body.localGuardianName ?? null,
            localGuardianPhone: body.localGuardianPhone ?? null,
            bookingAmount: body.bookingAmount ?? null,
            bookingCashDDNo: body.bookingCashDDNo ?? null,
            bookingBank: body.bookingBank ?? null,
            bookingDate,
            admissionAmount: body.admissionAmount ?? null,
            admissionCashDDNo: body.admissionCashDDNo ?? null,
            admissionBank: body.admissionBank ?? null,
            admissionDate,
            duesAmount: body.duesAmount ?? null,
            dueDate,
            extraCurricular: body.extraCurricular ?? null,
            authorisedBy: body.authorisedBy ?? null,
            isFormComplete: true,
            sentToStudentAt: new Date(),
            sentToStudentEmail: body.email ?? null,
          },
          update: {
            aadharNo: body.aadharNo ?? null,
            apaarId: body.apaarId ?? null,
            fatherName: body.fatherName ?? null,
            gender,
            maritalStatus,
            motherName: body.motherName ?? null,
            motherOccupation: body.motherOccupation ?? null,
            motherIncome: body.motherIncome ?? null,
            fatherOccupation: body.fatherOccupation ?? null,
            fatherIncome: body.fatherIncome ?? null,
            noOfSisters: body.noOfSisters ?? null,
            noOfBrothers: body.noOfBrothers ?? null,
            nationality: body.nationality ?? null,
            religion: body.religion ?? null,
            category: body.category ?? null,
            postalAddress: body.postalAddress ?? null,
            permanentAddress: body.permanentAddress ?? null,
            permanentPhone: body.permanentPhone ?? null,
            localGuardianAddress: body.localGuardianAddress ?? null,
            localGuardianName: body.localGuardianName ?? null,
            localGuardianPhone: body.localGuardianPhone ?? null,
            bookingAmount: body.bookingAmount ?? null,
            bookingCashDDNo: body.bookingCashDDNo ?? null,
            bookingBank: body.bookingBank ?? null,
            bookingDate,
            admissionAmount: body.admissionAmount ?? null,
            admissionCashDDNo: body.admissionCashDDNo ?? null,
            admissionBank: body.admissionBank ?? null,
            admissionDate,
            duesAmount: body.duesAmount ?? null,
            dueDate,
            extraCurricular: body.extraCurricular ?? null,
            authorisedBy: body.authorisedBy ?? null,
            isFormComplete: true,
            sentToStudentAt: new Date(),
            sentToStudentEmail: body.email ?? null,
          },
        });

        const confirmedLead = await tx.lead.update({
          where: { id: updatedLead.id },
          data: {
            status: LeadStatus.CONFIRMED,
            confirmedAt: new Date(),
            confirmedById: creator.id,
          },
        });

        await tx.interactionLog.create({
          data: {
            leadId: confirmedLead.id,
            userId: creator.id,
            type: "STATUS_CHANGED",
            note: "Public admission application submitted",
            statusBefore: existingLead.status,
            statusAfter: LeadStatus.CONFIRMED,
          },
        });

        await tx.auditLog.create({
          data: {
            leadId: confirmedLead.id,
            userId: creator.id,
            action: "STATUS_CHANGED",
            oldValue: { status: existingLead.status },
            newValue: { status: LeadStatus.CONFIRMED },
          },
        });

        const existing = await tx.confirmedApplication.findUnique({
          where: { leadId: confirmedLead.id },
          select: { admissionId: true, fileNumber: true },
        });

        const year = new Date().getFullYear();
        const idData: Record<string, unknown> = {};
        if (!existing?.admissionId) {
          const last = await tx.confirmedApplication.findFirst({
            where: { admissionId: { not: null } },
            orderBy: { admissionId: "desc" },
            select: { admissionId: true },
          });
          const nextNum = last?.admissionId
            ? parseInt(last.admissionId.slice(1)) + 1
            : 1;
          idData["admissionId"] = `S${String(nextNum).padStart(4, "0")}`;
        }
        if (!existing?.fileNumber) {
          const yearApps = await tx.confirmedApplication.findMany({
            where: { fileNumber: { endsWith: `/${year}` } },
            select: { fileNumber: true },
          });
          const maxN = yearApps.reduce((m, a) => {
            const n = parseInt(a.fileNumber?.split("/")[0] ?? "0");
            return isNaN(n) ? m : Math.max(m, n);
          }, 0);
          idData["fileNumber"] = `${maxN + 1}/${year}`;
        }
        if (Object.keys(idData).length > 0) {
          await tx.confirmedApplication.update({
            where: { leadId: confirmedLead.id },
            data: idData as any,
          });
        }

        return confirmedLead;
      }

      const createdLead = await tx.lead.create({
        data: {
          studentName: body.studentName,
          phone: body.phone,
          fatherName: body.fatherName ?? null,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          email: body.email ?? null,
          gender,
          maritalStatus,
          city: body.city ?? null,
          district: body.district ?? null,
          state: body.state ?? null,
          sourceOther: body.course
            ? `Direct Admission: ${body.course}`
            : "Direct Admission",
          remarks: body.remarks ?? null,
          branchId: branch.id,
          createdById: creator.id,
          assignedToId: creator.id,  // assign to submitting employee (or admin for walk-ins)
          status: LeadStatus.INTERESTED,
        },
      });

      await tx.confirmedApplication.create({
        data: {
          leadId: createdLead.id,
          aadharNo: body.aadharNo ?? null,
          apaarId: body.apaarId ?? null,
          fatherName: body.fatherName ?? null,
          gender,
          maritalStatus,
          motherName: body.motherName ?? null,
          motherOccupation: body.motherOccupation ?? null,
          motherIncome: body.motherIncome ?? null,
          fatherOccupation: body.fatherOccupation ?? null,
          fatherIncome: body.fatherIncome ?? null,
          noOfSisters: body.noOfSisters ?? null,
          noOfBrothers: body.noOfBrothers ?? null,
          nationality: body.nationality ?? null,
          religion: body.religion ?? null,
          category: body.category ?? null,
          postalAddress: body.postalAddress ?? null,
          permanentAddress: body.permanentAddress ?? null,
          permanentPhone: body.permanentPhone ?? null,
          localGuardianAddress: body.localGuardianAddress ?? null,
          localGuardianName: body.localGuardianName ?? null,
          localGuardianPhone: body.localGuardianPhone ?? null,
          bookingAmount: body.bookingAmount ?? null,
          bookingCashDDNo: body.bookingCashDDNo ?? null,
          bookingBank: body.bookingBank ?? null,
          bookingDate,
          admissionAmount: body.admissionAmount ?? null,
          admissionCashDDNo: body.admissionCashDDNo ?? null,
          admissionBank: body.admissionBank ?? null,
          admissionDate,
          duesAmount: body.duesAmount ?? null,
          dueDate,
          extraCurricular: body.extraCurricular ?? null,
          authorisedBy: body.authorisedBy ?? null,
          isFormComplete: true,
          sentToStudentAt: new Date(),
          sentToStudentEmail: body.email ?? null,
        },
      });

      const confirmedLead = await tx.lead.update({
        where: { id: createdLead.id },
        data: {
          status: LeadStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedById: creator.id,
        },
      });

      await tx.interactionLog.create({
        data: {
          leadId: confirmedLead.id,
          userId: creator.id,
          type: "STATUS_CHANGED",
          note: "Public admission application submitted",
          statusBefore: LeadStatus.INTERESTED,
          statusAfter: LeadStatus.CONFIRMED,
        },
      });

      await tx.auditLog.create({
        data: {
          leadId: confirmedLead.id,
          userId: creator.id,
          action: "STATUS_CHANGED",
          oldValue: { status: LeadStatus.INTERESTED },
          newValue: { status: LeadStatus.CONFIRMED },
        },
      });

      const existing = await tx.confirmedApplication.findUnique({
        where: { leadId: confirmedLead.id },
        select: { admissionId: true, fileNumber: true },
      });

      const year = new Date().getFullYear();
      const idData: Record<string, unknown> = {};
      if (!existing?.admissionId) {
        const last = await tx.confirmedApplication.findFirst({
          where: { admissionId: { not: null } },
          orderBy: { admissionId: "desc" },
          select: { admissionId: true },
        });
        const nextNum = last?.admissionId
          ? parseInt(last.admissionId.slice(1)) + 1
          : 1;
        idData["admissionId"] = `S${String(nextNum).padStart(4, "0")}`;
      }
      if (!existing?.fileNumber) {
        const yearApps = await tx.confirmedApplication.findMany({
          where: { fileNumber: { endsWith: `/${year}` } },
          select: { fileNumber: true },
        });
        const maxN = yearApps.reduce((m, a) => {
          const n = parseInt(a.fileNumber?.split("/")[0] ?? "0");
          return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        idData["fileNumber"] = `${maxN + 1}/${year}`;
      }
      if (Object.keys(idData).length > 0) {
        await tx.confirmedApplication.update({
          where: { leadId: confirmedLead.id },
          data: idData as any,
        });
      }

      return confirmedLead;
    });

    return reply.status(201).send({
      success: true,
      data: {
        leadId: lead.id,
        message: "Admission submitted successfully",
      },
    });
  });

  // POST /public/direct-admission/:leadId/documents
  // Upload a supporting document for a submitted public admission (no auth required)
  fastify.post(
    "/public/direct-admission/:leadId/documents",
    async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const { documentType } = request.query as { documentType?: string };

      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, confirmedApplication: { select: { id: true } } },
      });

      if (!lead?.confirmedApplication) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Application not found" },
        });
      }

      const fileData = await request.file();
      if (!fileData) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "No file provided" },
        });
      }

      const ALLOWED_TYPES = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!ALLOWED_TYPES.includes(fileData.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Only PDF, JPG, and PNG files are allowed",
          },
        });
      }

      const buffer = await fileData.toBuffer();
      if (buffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          error: { code: "FILE_TOO_LARGE", message: "File must be under 10 MB" },
        });
      }

      const ext = path.extname(fileData.filename || "file");
      const fileName = `${Date.now()}-pub-doc${ext}`;
      const result = await uploadFile({
        buffer,
        fileName,
        mimeType: fileData.mimetype,
        folder: "documents",
      });

      const docTypeName = (documentType || "Other").trim().slice(0, 100);
      let docType = await fastify.prisma.documentType.findFirst({
        where: { name: docTypeName },
      });
      if (!docType) {
        docType = await fastify.prisma.documentType.create({
          data: { name: docTypeName, isRequired: false, isActive: true },
        });
      }

      const document = await fastify.prisma.leadDocument.create({
        data: {
          confirmedApplicationId: lead.confirmedApplication.id,
          documentTypeId: docType.id,
          fileUrl: result.url,
          fileName: fileData.filename || fileName,
        },
      });

      return reply.status(201).send({ success: true, data: { id: document.id } });
    },
  );
}
