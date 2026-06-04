import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import {
  checkDuplicate,
  buildDuplicateContinuation,
  buildLostLeadRevival,
  resolveAssigneeOnCreate,
} from "@lms/core";
import { LeadStatus, Role } from "@lms/types";
import { findDuplicateLeads } from "./service";
import { CreateLeadSchema } from "@lms/types";
import { validateBody } from "../../middleware/validate";
import { QUEUES } from "../../plugins/bullmq";
import {
  invalidateAnalyticsCache,
  invalidateActivityCache,
} from "../../services/cache";

export async function createLeadRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const validation = validateBody(CreateLeadSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const body = validation.data;

      const { id: userId, role, branchId } = request.user;

      // ── Step 1: Duplicate detection ──
      const existingLeads = await findDuplicateLeads({
        phone: body.phone,
        email: body.email,
        prisma: fastify.prisma,
      });

      if (existingLeads.length > 0) {
        const duplicateResult = checkDuplicate(
          body.phone,
          body.email,
          existingLeads.map((l) => ({
            ...l,
            status: l.status as unknown as LeadStatus,
          })),
        );

        if (duplicateResult.isDuplicate) {
          const existing = existingLeads.find(
            (l) => l.id === duplicateResult.existingLeadId,
          );

          // ── LOST lead revival ──
          if (existing?.status === LeadStatus.LOST) {
            if (!body.confirmRevival) {
              // Ask user to confirm revival
              const revivalPrompt = buildLostLeadRevival({
                lostLeadId: duplicateResult.originalLeadId,
                lostLeadStudentName: existing.studentName,
                incomingStudentName: body.studentName,
                incomingSourceName: null,
              });
              return reply.status(200).send({
                success: true,
                data: {
                  requiresAction: "REVIVAL_CONFIRMATION",
                  ...revivalPrompt,
                },
              });
            }

            // User confirmed revival — revive the lead
            await fastify.prisma.$transaction(async (tx) => {
              await tx.lead.update({
                where: { id: duplicateResult.originalLeadId },
                data: { status: LeadStatus.ATTEMPTED_CONTACT },
              });
              await tx.interactionLog.create({
                data: {
                  leadId: duplicateResult.originalLeadId,
                  userId,
                  type: "NOTE",
                  note: `Lead revived. New enquiry received from "${body.studentName}". Continuing follow-up.`,
                  statusBefore: LeadStatus.LOST,
                  statusAfter: LeadStatus.ATTEMPTED_CONTACT,
                },
              });
              await tx.auditLog.create({
                data: {
                  leadId: duplicateResult.originalLeadId,
                  userId,
                  action: "LEAD_REVIVED",
                  oldValue: { status: "LOST" },
                  newValue: { status: "ATTEMPTED_CONTACT" },
                },
              });
            });

            await invalidateAnalyticsCache(fastify.redis);
            await invalidateActivityCache(fastify.redis, branchId, userId);

            const revivedLead = await fastify.prisma.lead.findUnique({
              where: { id: duplicateResult.originalLeadId },
            });

            return reply.status(200).send({
              success: true,
              data: { revivedLead, action: "LEAD_REVIVED" },
            });
          }

          // ── Active duplicate — redirect to original ──
          const continuation = buildDuplicateContinuation({
            matchType: duplicateResult.matchType,
            incomingStudentName: body.studentName,
            incomingSourceName: null,
            incomingCourseIds: body.courseIds ?? [],
            incomingFollowUpAt: body.nextFollowUpAt
              ? new Date(body.nextFollowUpAt)
              : null,
            originalLeadId: duplicateResult.originalLeadId,
          });

          // Add continuation note to original lead
          await fastify.prisma.$transaction(async (tx) => {
            await tx.interactionLog.create({
              data: {
                leadId: continuation.existingLeadId,
                userId,
                type: "NOTE",
                note: continuation.continuationNote,
              },
            });

            // Merge new courses into original lead
            if (continuation.newCourseIds.length > 0) {
              for (const courseId of continuation.newCourseIds) {
                await tx.leadCourse.upsert({
                  where: {
                    leadId_courseId: {
                      leadId: continuation.existingLeadId,
                      courseId,
                    },
                  },
                  update: {},
                  create: {
                    leadId: continuation.existingLeadId,
                    courseId,
                    isPrimary: false,
                  },
                });
              }
            }

            // Update follow-up if provided
            if (continuation.newFollowUpAt) {
              await tx.lead.update({
                where: { id: continuation.existingLeadId },
                data: { nextFollowUpAt: continuation.newFollowUpAt },
              });
            }
          });

          await invalidateAnalyticsCache(fastify.redis);
          await invalidateActivityCache(fastify.redis, branchId, userId);

          return reply.status(200).send({
            success: true,
            data: {
              requiresAction: "DUPLICATE_REDIRECTED",
              existingLeadId: duplicateResult.originalLeadId,
              matchType: duplicateResult.matchType,
              message: `Duplicate detected. Enquiry added to existing lead.`,
            },
          });
        }
      }

      // ── Step 2: Resolve assignee ──
      const assignedToId = resolveAssigneeOnCreate({
        creatorId: userId,
        creatorRole: role as Role,
        ...(role !== "EMPLOYEE" && body.assignedToId
          ? { explicitAssigneeId: body.assignedToId }
          : {}),
      });

      // ── Step 3: Create lead ──
      const lead = await fastify.prisma.$transaction(async (tx) => {
        const newLead = await tx.lead.create({
          data: {
            studentName: body.studentName,
            phone: body.phone,
            fatherName: body.fatherName ?? null,
            dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
            email: body.email ?? null,
            alternatePhone: body.alternatePhone ?? null,
            whatsappNumber: body.whatsappNumber ?? null,
            gender: (body.gender ?? null) as any,
            maritalStatus: (body.maritalStatus ?? null) as any,
            sourceId: body.sourceId ?? null,
            sourceOther: body.sourceOther ?? null,
            qualification: (body.qualification ?? null) as any,
            schoolCollege: body.schoolCollege ?? null,
            boardUniversity: body.boardUniversity ?? null,
            passingYear: body.passingYear ?? null,
            percentage: body.percentage ?? null,
            village: body.village ?? null,
            sector: body.sector ?? null,
            city: body.city ?? null,
            district: body.district ?? null,
            state: body.state ?? null,
            nextFollowUpAt: body.nextFollowUpAt
              ? new Date(body.nextFollowUpAt)
              : null,
            sendSms: body.sendSms ?? false,
            sendEmail: body.sendEmail ?? false,
            branchId,
            createdById: userId,
            assignedToId: assignedToId ?? null,
            status: LeadStatus.NEW,
          },
        });

        // Add courses
        if (body.courseIds && body.courseIds.length > 0) {
          await tx.leadCourse.createMany({
            data: body.courseIds.map((courseId, index) => ({
              leadId: newLead.id,
              courseId,
              isPrimary: index === 0,
            })),
          });
        }

        // Audit log
        await tx.auditLog.create({
          data: {
            leadId: newLead.id,
            userId,
            action: "LEAD_CREATED",
            newValue: { studentName: body.studentName, phone: body.phone },
          },
        });

        // Initial interaction log
        await tx.interactionLog.create({
          data: {
            leadId: newLead.id,
            userId,
            type: "NOTE",
            note: "Lead created",
            statusAfter: LeadStatus.NEW,
          },
        });

        return newLead;
      });

      // Queue email notification if requested
      if (body.sendEmail && body.email) {
        await fastify.queues[QUEUES.NOTIFICATIONS].add("lead-created-email", {
          to: body.email,
          studentName: body.studentName,
          leadId: lead.id,
        });
      }
      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(fastify.redis, branchId, userId);
      return reply.status(201).send({ success: true, data: { lead } });
    },
  );
}
