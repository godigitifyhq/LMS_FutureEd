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
  const now = new Date();

  const existingTasks = await db.task.findMany({
    where: {
      leadId: params.leadId,
      title: AUTO_FOLLOW_UP_TASK_TITLE,
      status: { in: [...OPEN_TASK_STATUSES] },
    },
    select: { id: true, status: true, dueAt: true },
    orderBy: { createdAt: "asc" },
  });

  // No new follow-up date → cancel all open tasks
  if (!params.nextFollowUpAt) {
    if (existingTasks.length > 0) {
      await db.task.updateMany({
        where: { id: { in: existingTasks.map((t) => t.id) } },
        data: { status: "CANCELLED", completedAt: null },
      });
    }
    return;
  }

  const assignedToId = params.assignedToId ?? params.actorUserId;
  const description  = buildFollowUpTaskDescription(params.studentName, params.nextFollowUpAt);

  const [primaryTask, ...duplicateTasks] = existingTasks;

  // No existing open task → create fresh
  if (!primaryTask) {
    await db.task.create({
      data: {
        title: AUTO_FOLLOW_UP_TASK_TITLE,
        description,
        status: "PENDING",
        assignedToId,
        createdById: params.actorUserId,
        leadId:      params.leadId,
        branchId:    params.branchId,
        dueAt:       params.nextFollowUpAt,
      },
    });
    return;
  }

  // Cancel any stray duplicates
  if (duplicateTasks.length > 0) {
    await db.task.updateMany({
      where: { id: { in: duplicateTasks.map((t) => t.id) } },
      data: { status: "CANCELLED", completedAt: null },
    });
  }

  const oldDueAt    = primaryTask.dueAt;
  const dateChanged = !oldDueAt || oldDueAt.getTime() !== params.nextFollowUpAt.getTime();
  // Old task was overdue (past due) and the employee is setting a NEW date
  // → they clearly did the follow-up; complete the old task and open a fresh one.
  const wasOverdue  = !!oldDueAt && oldDueAt <= now;

  if (dateChanged && wasOverdue) {
    await db.task.update({
      where: { id: primaryTask.id },
      data:  { status: "COMPLETED", completedAt: now },
    });
    await db.task.create({
      data: {
        title:       AUTO_FOLLOW_UP_TASK_TITLE,
        description,
        status:      "PENDING",
        assignedToId,
        createdById: params.actorUserId,
        leadId:      params.leadId,
        branchId:    params.branchId,
        dueAt:       params.nextFollowUpAt,
      },
    });
  } else {
    // Future task being rescheduled or same date — just update in place
    await db.task.update({
      where: { id: primaryTask.id },
      data:  { description, assignedToId, dueAt: params.nextFollowUpAt, completedAt: null },
    });
  }
}
