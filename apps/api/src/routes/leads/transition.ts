import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { canTransitionLead } from "@lms/auth";
import { transitionLead, getValidTransitions } from "@lms/core";
import {
  LeadStatus,
  QualificationLevel,
  Role,
  TransitionLeadSchema,
} from "@lms/types";
import { validateBody } from "../../middleware/validate";
import { QUEUES } from "../../plugins/bullmq";
import {
  invalidateAnalyticsCache,
  invalidateActivityCache,
} from "../../services/cache";
import { syncLeadFollowUpTask } from "../../services/followUpTasks";

type LeadDraftSource = {
  phone: string;
  fatherName: string | null;
  gender: string | null;
  maritalStatus: string | null;
  village: string | null;
  sector: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  qualification: QualificationLevel | null;
  schoolCollege: string | null;
  boardUniversity: string | null;
  passingYear: number | null;
  percentage: number | null;
};

type ExistingConfirmedDraft = {
  id: string;
  fatherName: string | null;
  gender: string | null;
  maritalStatus: string | null;
  postalAddress: string | null;
  permanentAddress: string | null;
  permanentPhone: string | null;
  admissionId: string | null;
  fileNumber: string | null;
  academicRecords: Array<{ level: QualificationLevel }>;
};

function buildLeadAddress(lead: LeadDraftSource): string | null {
  const parts = [
    lead.village,
    lead.sector,
    lead.city,
    lead.district,
    lead.state,
  ].filter((value): value is string => Boolean(value?.trim()));

  return parts.length > 0 ? parts.join(", ") : null;
}

function mapQualificationToAcademicLevel(
  qualification: QualificationLevel | null,
): QualificationLevel | null {
  switch (qualification) {
    case QualificationLevel.TENTH:
    case QualificationLevel.TWELFTH:
    case QualificationLevel.GRADUATION:
    case QualificationLevel.POST_GRADUATION:
      return qualification;
    default:
      return null;
  }
}

function buildConfirmedDraftData(
  lead: LeadDraftSource,
  existing: ExistingConfirmedDraft | null,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const address = buildLeadAddress(lead);

  if (!existing?.fatherName && lead.fatherName) {
    data["fatherName"] = lead.fatherName;
  }
  if (!existing?.gender && lead.gender) {
    data["gender"] = lead.gender;
  }
  if (!existing?.maritalStatus && lead.maritalStatus) {
    data["maritalStatus"] = lead.maritalStatus;
  }
  if (!existing?.permanentPhone && lead.phone) {
    data["permanentPhone"] = lead.phone;
  }
  if (address) {
    if (!existing?.postalAddress) {
      data["postalAddress"] = address;
    }
    if (!existing?.permanentAddress) {
      data["permanentAddress"] = address;
    }
  }

  return data;
}

export async function transitionLeadRoute(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post(
    "/:id/transition",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId, role } = request.user;
      const validation = validateBody(TransitionLeadSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const { toStatus, note } = validation.data;

      const lead = await fastify.prisma.lead.findUnique({
        where: { id },
        select: {
          id: true,
          studentName: true,
          email: true,
          phone: true,
          fatherName: true,
          gender: true,
          maritalStatus: true,
          village: true,
          sector: true,
          city: true,
          district: true,
          state: true,
          qualification: true,
          schoolCollege: true,
          boardUniversity: true,
          passingYear: true,
          percentage: true,
          nextFollowUpAt: true,
          status: true,
          assignedTo: { select: { id: true } },
          createdBy: { select: { id: true } },
          branchId: true,
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      // Permission check
      const canTransition = canTransitionLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        {
          id: lead.id,
          assignedToId: lead.assignedTo?.id ?? null,
          createdById: lead.createdBy.id,
          branchId: lead.branchId,
          status: lead.status,
        },
      );

      if (!canTransition) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "You cannot update this lead" },
        });
      }

      // Block APPLICATION_SENT unless the admission form is marked complete
      if (toStatus === LeadStatus.APPLICATION_SENT) {
        const confirmedApp =
          await fastify.prisma.confirmedApplication.findUnique({
            where: { leadId: id },
            select: { isFormComplete: true },
          });

        if (!confirmedApp?.isFormComplete) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "FORM_INCOMPLETE",
              message:
                "Admission application form must be filled and saved before marking as Application Sent",
              details: { redirectTo: "admission-form" },
            },
          });
        }
      }

      // State machine validation
      const result = transitionLead(lead.status as LeadStatus, toStatus);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
            details: {
              validTransitions: getValidTransitions(lead.status as LeadStatus),
            },
          },
        });
      }

      const previousStatus = lead.status as LeadStatus;

      // Handle CONFIRMED transition specially
      const isConfirming = toStatus === LeadStatus.CONFIRMED;
      const shouldPrepareAdmissionDraft =
        toStatus === LeadStatus.INTERESTED || isConfirming;

      // Serializable isolation prevents concurrent transactions from reading
      // the same "last admissionId" and generating duplicate sequential IDs.
      await fastify.prisma.$transaction(async (tx) => {
        let existingConfirmedApp: ExistingConfirmedDraft | null = null;

        if (shouldPrepareAdmissionDraft) {
          existingConfirmedApp = (await tx.confirmedApplication.findUnique({
            where: { leadId: id },
            select: {
              id: true,
              fatherName: true,
              gender: true,
              maritalStatus: true,
              postalAddress: true,
              permanentAddress: true,
              permanentPhone: true,
              admissionId: true,
              fileNumber: true,
              academicRecords: { select: { level: true } },
            },
          })) as ExistingConfirmedDraft | null;

          const draftData = buildConfirmedDraftData(lead as unknown as LeadDraftSource, existingConfirmedApp);

          if (existingConfirmedApp) {
            if (Object.keys(draftData).length > 0) {
              await tx.confirmedApplication.update({
                where: { leadId: id },
                data: draftData,
              });
            }
          } else {
            existingConfirmedApp = (await tx.confirmedApplication.create({
              data: {
                leadId: id,
                ...draftData,
              },
              select: {
                id: true,
                fatherName: true,
                gender: true,
                maritalStatus: true,
                postalAddress: true,
                permanentAddress: true,
                permanentPhone: true,
                admissionId: true,
                fileNumber: true,
                academicRecords: { select: { level: true } },
              },
            })) as ExistingConfirmedDraft;
          }

          const academicLevel = mapQualificationToAcademicLevel(
            lead.qualification as QualificationLevel | null,
          );
          const hasAcademicSeedData = Boolean(
            academicLevel &&
              (lead.schoolCollege ||
                lead.boardUniversity ||
                lead.passingYear ||
                lead.percentage),
          );
          const hasAcademicLevelAlready = Boolean(
            academicLevel &&
              existingConfirmedApp!.academicRecords.some(
                (record) => record.level === academicLevel,
              ),
          );

          if (academicLevel && hasAcademicSeedData && !hasAcademicLevelAlready) {
            await tx.academicRecord.create({
              data: {
                confirmedApplicationId: existingConfirmedApp!.id,
                level: academicLevel,
                institution: lead.schoolCollege ?? null,
                board: lead.boardUniversity ?? null,
                passingYear: lead.passingYear ?? null,
                percentage: lead.percentage ?? null,
              },
            });
          }
        }

        await tx.lead.update({
          where: { id },
          data: {
            status: toStatus,
            ...(isConfirming
              ? { confirmedAt: new Date(), confirmedById: userId }
              : {}),
          },
        });

        await tx.interactionLog.create({
          data: {
            leadId: id,
            userId,
            type: "STATUS_CHANGED",
            note: note ?? null,
            statusBefore: previousStatus,
            statusAfter: toStatus,
          },
        });

        await tx.auditLog.create({
          data: {
            leadId: id,
            userId,
            action: "STATUS_CHANGED",
            oldValue: { status: previousStatus },
            newValue: { status: toStatus },
          },
        });

        const shouldCancelFollowUpTask =
          toStatus === LeadStatus.CONFIRMED ||
          toStatus === LeadStatus.LOST ||
          toStatus === LeadStatus.DUPLICATE;

        await syncLeadFollowUpTask(tx, {
          leadId: lead.id,
          studentName: lead.studentName,
          branchId: lead.branchId,
          assignedToId: lead.assignedTo?.id ?? null,
          actorUserId: userId,
          nextFollowUpAt: shouldCancelFollowUpTask
            ? null
            : lead.nextFollowUpAt,
        });

        // Create ConfirmedApplication record when confirmed, generate IDs
        if (isConfirming) {
          // Only generate IDs if not already assigned
          const existing =
            existingConfirmedApp ??
            (await tx.confirmedApplication.findUnique({
              where: { leadId: id },
              select: {
                id: true,
                fatherName: true,
                gender: true,
                maritalStatus: true,
                postalAddress: true,
                permanentAddress: true,
                permanentPhone: true,
                admissionId: true,
                fileNumber: true,
                academicRecords: { select: { level: true } },
              },
            }));

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
              where: { leadId: id },
              data: idData as any,
            });
          }
        }
      }, { isolationLevel: "Serializable" });

      if (
        toStatus === LeadStatus.APPLICATION_SENT &&
        validation.data.sendEmailToStudent &&
        lead.email
      ) {
        await fastify.queues[QUEUES.NOTIFICATIONS].add(
          "application-sent-email",
          {
            to: lead.email,
            studentName: lead.studentName,
            institutionName: validation.data.institutionName ?? "Institution",
            programName: validation.data.programName ?? "Program",
            applicationNumber: validation.data.applicationNumber ?? undefined,
          },
          { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
        );
      }

      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(
        fastify.redis,
        request.user.branchId,
        request.user.id,
      );

      return reply.status(200).send({
        success: true,
        data: { previousStatus, newStatus: toStatus },
      });
    },
  );
}
