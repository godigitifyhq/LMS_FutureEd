import type { Prisma, PrismaClient } from "@lms/db";

export const AUTO_FOLLOW_UP_TASK_TITLE = "Lead follow-up";

type DbClient = PrismaClient | Prisma.TransactionClient;

const OPEN_TASK_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

function buildFollowUpTaskDescription(studentName: string, nextFollowUpAt: Date): string {
  return `Follow up with ${studentName}. Scheduled for ${nextFollowUpAt.toISOString()}.`;
}

export async function syncLeadFollowUpTask(
  db: DbClient,
  params: {
    leadId: string;
    studentName: string;
    branchId: string;
    assignedToId: string | null;
    actorUserId: string;
    nextFollowUpAt: Date | null;
  },
): Promise<void> {
  const existingTasks = await db.task.findMany({
    where: {
      leadId: params.leadId,
      title: AUTO_FOLLOW_UP_TASK_TITLE,
      status: { in: [...OPEN_TASK_STATUSES] },
    },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  if (!params.nextFollowUpAt) {
    if (existingTasks.length > 0) {
      await db.task.updateMany({
        where: { id: { in: existingTasks.map((task) => task.id) } },
        data: {
          status: "CANCELLED",
          completedAt: null,
        },
      });
    }
    return;
  }

  const assignedToId = params.assignedToId ?? params.actorUserId;
  const description = buildFollowUpTaskDescription(
    params.studentName,
    params.nextFollowUpAt,
  );

  const [primaryTask, ...duplicateTasks] = existingTasks;

  if (!primaryTask) {
    await db.task.create({
      data: {
        title: AUTO_FOLLOW_UP_TASK_TITLE,
        description,
        status: "PENDING",
        assignedToId,
        createdById: params.actorUserId,
        leadId: params.leadId,
        branchId: params.branchId,
        dueAt: params.nextFollowUpAt,
      },
    });
    return;
  }

  await db.task.update({
    where: { id: primaryTask.id },
    data: {
      description,
      assignedToId,
      dueAt: params.nextFollowUpAt,
      completedAt: null,
    },
  });

  if (duplicateTasks.length > 0) {
    await db.task.updateMany({
      where: { id: { in: duplicateTasks.map((task) => task.id) } },
      data: {
        status: "CANCELLED",
        completedAt: null,
      },
    });
  }
}
