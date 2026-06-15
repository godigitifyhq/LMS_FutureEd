import type { FastifyInstance } from "fastify";
import { LeadStatus } from "@lms/types";
import { checkDuplicate, buildDuplicateContinuation } from "@lms/core";
import { findDuplicateLeads } from "../routes/leads/service";
import { QUEUES } from "../plugins/bullmq";
import {
  invalidateAnalyticsCache,
  invalidateActivityCache,
} from "./cache";
import { config } from "../config";

// ── Types ──────────────────────────────────────────────────────────────────

export type CreateMetaLeadInput = {
  studentName: string;
  phone: string;
  email?: string;
  fatherName?: string;
  city?: string;
  state?: string;
  qualification?: string;
  courseId?: string | null;
  sourceId?: string | null;
  remarks?: string;
  // WhatsApp specific
  waContactId?: string;
  waFirstMessage?: string;
  waMessageType?: string;
  isFromWhatsApp?: boolean;
  // Lead Form specific
  metaLeadgenId?: string;
  metaAdName?: string;
};

export type CreateMetaLeadResult =
  | { created: true; leadId: string; assignedToId: string | null }
  | { duplicate: true; existingLeadId: string; matchType: string }
  | { skipped: true; reason: string };

// ── Helpers ────────────────────────────────────────────────────────────────

// Find first admin/sub-admin to act as system createdById for webhook leads
async function findSystemUserId(
  fastify: FastifyInstance,
  branchId: string,
): Promise<string | null> {
  const user = await fastify.prisma.user.findFirst({
    where: {
      branchId,
      role: { in: ["ADMIN", "SUB_ADMIN"] },
      isActive: true,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  // Fallback: any active user in the branch
  if (!user) {
    const fallback = await fastify.prisma.user.findFirst({
      where: { branchId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return fallback?.id ?? null;
  }
  return user.id;
}

// Find employee with fewest active leads in the branch (round-robin by load)
async function findAutoAssignee(
  fastify: FastifyInstance,
  branchId: string,
): Promise<string | null> {
  const employees = await fastify.prisma.user.findMany({
    where: { branchId, role: "EMPLOYEE", isActive: true },
    select: {
      id: true,
      _count: {
        select: {
          assignedLeads: {
            where: { status: { notIn: ["CONFIRMED", "LOST"] } },
          },
        },
      },
    },
    orderBy: { assignedLeads: { _count: "asc" } },
  });
  // EDGE: no active employees → lead created unassigned
  return employees[0]?.id ?? null;
}

// Find the default branch (first active branch, chronological)
export async function findDefaultBranch(
  fastify: FastifyInstance,
): Promise<string | null> {
  const branch = await fastify.prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return branch?.id ?? null;
}

// Fuzzy-find a course by name fragment (case-insensitive contains)
export async function findCourseByName(
  fastify: FastifyInstance,
  courseName: string,
): Promise<string | null> {
  if (!courseName.trim()) return null;
  const course = await fastify.prisma.course.findFirst({
    where: { name: { contains: courseName, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });
  return course?.id ?? null;
}

// Find Meta/Facebook lead source type
export async function findMetaSourceId(
  fastify: FastifyInstance,
): Promise<string | null> {
  const source = await fastify.prisma.leadSourceType.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { contains: "Meta", mode: "insensitive" } },
        { name: { contains: "Facebook", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return source?.id ?? null;
}

// Find WhatsApp lead source type
export async function findWhatsAppSourceId(
  fastify: FastifyInstance,
): Promise<string | null> {
  const source = await fastify.prisma.leadSourceType.findFirst({
    where: {
      isActive: true,
      name: { contains: "WhatsApp", mode: "insensitive" },
    },
    select: { id: true },
  });
  return source?.id ?? null;
}

// ── Main shared lead creation ──────────────────────────────────────────────

export async function createLeadFromMeta(
  fastify: FastifyInstance,
  data: CreateMetaLeadInput,
): Promise<CreateMetaLeadResult> {
  // ── 1. Find default branch ──
  const branchId = await findDefaultBranch(fastify);
  if (!branchId) {
    const reason = "No active branch found — lead skipped";
    console.warn("[meta-lead-create]", reason);
    return { skipped: true, reason };
  }

  // ── 2. Find system user for createdById ──
  const systemUserId = await findSystemUserId(fastify, branchId);
  if (!systemUserId) {
    const reason = "No users in branch — lead skipped";
    console.warn("[meta-lead-create]", reason);
    return { skipped: true, reason };
  }

  // ── 3. Duplicate detection by phone + email ──
  const existingLeads = await findDuplicateLeads({
    phone: data.phone,
    email: data.email,
    prisma: fastify.prisma,
  });

  if (existingLeads.length > 0) {
    const duplicateResult = checkDuplicate(
      data.phone,
      data.email ?? null,
      existingLeads.map((l) => ({
        ...l,
        status: l.status as LeadStatus,
      })),
    );

    if (duplicateResult.isDuplicate) {
      const matchType = duplicateResult.matchType ?? "PHONE";
      const originalLeadId = duplicateResult.originalLeadId;

      // Add continuation note to original lead
      const continuation = buildDuplicateContinuation({
        matchType: matchType as "PHONE" | "EMAIL" | "BOTH",
        incomingStudentName: data.studentName,
        incomingSourceName: data.isFromWhatsApp ? "WhatsApp" : "Meta Lead Form",
        incomingCourseIds: data.courseId ? [data.courseId] : [],
        incomingFollowUpAt: null,
        originalLeadId,
      });

      try {
        await fastify.prisma.$transaction(async (tx) => {
          await tx.interactionLog.create({
            data: {
              leadId: continuation.existingLeadId,
              userId: systemUserId,
              type: "NOTE",
              note: continuation.continuationNote,
            },
          });

          // If WhatsApp contact ID not yet set, update it
          if (data.waContactId) {
            await tx.lead.updateMany({
              where: { id: continuation.existingLeadId, waContactId: null },
              data: { waContactId: data.waContactId },
            });
          }
        });
      } catch (err) {
        console.error("[meta-lead-create] Failed to add continuation note", {
          error: err instanceof Error ? err.message : String(err),
          existingLeadId: continuation.existingLeadId,
        });
      }

      console.log("[meta-lead-create] Duplicate detected", {
        phone: data.phone,
        matchType,
        existingLeadId: originalLeadId,
      });
      return { duplicate: true, existingLeadId: originalLeadId, matchType };
    }
  }

  // ── 4. Auto-assign to employee with fewest active leads ──
  const assignedToId = await findAutoAssignee(fastify, branchId);

  // ── 5. Create lead in transaction ──
  let lead: { id: string };

  try {
    lead = await fastify.prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          studentName: data.studentName,
          phone: data.phone,
          email: data.email ?? null,
          fatherName: data.fatherName ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          qualification: null,            // Meta form sends text; not mapping to enum
          remarks: data.remarks ?? null,
          sourceId: data.sourceId ?? null,
          branchId,
          createdById: systemUserId,
          assignedToId: assignedToId ?? null,
          status: LeadStatus.NEW,
          // WhatsApp fields
          isFromWhatsApp: data.isFromWhatsApp ?? false,
          waContactId: data.waContactId ?? null,
          waFirstMessage: data.waFirstMessage?.slice(0, 500) ?? null,
          waMessageType: data.waMessageType ?? null,
          // Meta Lead Form fields
          metaLeadgenId: data.metaLeadgenId ?? null,
          metaAdName: data.metaAdName ?? null,
        } as any,
      });

      // Add course if resolved
      if (data.courseId) {
        await tx.leadCourse.create({
          data: { leadId: newLead.id, courseId: data.courseId, isPrimary: true },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          leadId: newLead.id,
          userId: systemUserId,
          action: "LEAD_CREATED",
          newValue: {
            studentName: data.studentName,
            phone: data.phone,
            source: data.isFromWhatsApp ? "whatsapp" : "meta-lead-form",
          },
        },
      });

      // Initial interaction log
      const source = data.isFromWhatsApp ? "WhatsApp" : "Meta Lead Form";
      const initialNote = data.isFromWhatsApp
        ? `Lead created from WhatsApp. First message: ${(data.waFirstMessage ?? "(no text)").slice(0, 500)}`
        : `Lead created from Meta Lead Form${data.metaAdName ? ` (Ad: ${data.metaAdName})` : ""}`;

      await tx.interactionLog.create({
        data: {
          leadId: newLead.id,
          userId: systemUserId,
          type: "NOTE",
          note: initialNote,
          statusAfter: LeadStatus.NEW,
        },
      });

      return newLead;
    });
  } catch (err) {
    console.error("[meta-lead-create] DB transaction failed", {
      error: err instanceof Error ? err.message : String(err),
      phone: data.phone,
    });
    throw err;
  }

  // ── 6. Invalidate caches (non-blocking failures) ──
  try {
    await invalidateAnalyticsCache(fastify.redis);
    await invalidateActivityCache(fastify.redis, branchId);
  } catch (err) {
    console.error("[meta-lead-create] Cache invalidation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 7. Queue counsellor notification ──
  if (assignedToId) {
    try {
      const counsellor = await fastify.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { email: true, name: true },
      });

      if (counsellor) {
        const jobName = data.isFromWhatsApp
          ? "whatsapp-lead-assigned"
          : "meta-lead-form-assigned";

        await fastify.queues[QUEUES.NOTIFICATIONS].add(
          jobName,
          {
            to: counsellor.email,
            employeeName: counsellor.name,
            studentName: data.studentName,
            phone: data.phone,
            email: data.email ?? null,
            leadId: lead.id,
            leadUrl: `${config.frontendUrl}/leads/${lead.id}`,
            // Lead Form extras
            adName: data.metaAdName ?? null,
            // WhatsApp extras
            firstMessage: data.waFirstMessage ?? null,
            timestamp: new Date().toISOString(),
          },
          { attempts: 3, backoff: { type: "exponential", delay: 3000 } },
        );

        console.log("[meta-lead-create] Notification queued", {
          leadId: lead.id,
          counsellorEmail: counsellor.email,
        });
      }
    } catch (err) {
      // EDGE: notification queue fails → lead still created
      console.error("[meta-lead-create] Failed to queue notification", {
        error: err instanceof Error ? err.message : String(err),
        leadId: lead.id,
      });
    }
  }

  console.log("[meta-lead-create] Lead created", {
    leadId: lead.id,
    phone: data.phone,
    source: data.isFromWhatsApp ? "whatsapp" : "meta-lead-form",
    assignedTo: assignedToId,
  });

  return { created: true, leadId: lead.id, assignedToId: assignedToId ?? null };
}
