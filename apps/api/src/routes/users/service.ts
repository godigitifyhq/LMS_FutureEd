import bcrypt from 'bcrypt'
import type { PrismaClient } from '@lms/db'
import type { FastifyInstance } from 'fastify'
import { generatePasswordResetToken } from '../auth/service'
import { invalidateAllSessions } from '../auth/service'
import { resolveDeactivationUnassignment } from '@lms/core'
import { QUEUES } from '../../plugins/bullmq'
import { config } from '../../config'

const BCRYPT_ROUNDS = 12

// ── User stats — leads assigned + confirmed ──
export async function getUserStats(userId: string, prisma: PrismaClient) {
  const [assignedCount, confirmedCount] = await Promise.all([
    prisma.lead.count({
      where: {
        assignedToId: userId,
        status: { notIn: ['CONFIRMED', 'LOST', 'DUPLICATE'] },
      },
    }),
    prisma.lead.count({
      where: {
        assignedToId: userId,
        status: 'CONFIRMED',
      },
    }),
  ])

  return { assignedCount, confirmedCount }
}

// ── Create user + optionally send setup link ──
export async function createUser(params: {
  name: string
  email: string
  phone: string | null
  role: string
  branchId: string
  sendSetupLink: boolean
  createdById: string
  prisma: PrismaClient
  fastify: FastifyInstance
}): Promise<{ success: true; userId: string } | { error: 'EMAIL_EXISTS' }> {
  const { prisma, fastify } = params

  const existing = await prisma.user.findUnique({
    where: { email: params.email.toLowerCase().trim() },
  })

  if (existing) return { error: 'EMAIL_EXISTS' }

  // Temporary password — user will change via setup link
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      name: params.name,
      email: params.email.toLowerCase().trim(),
      phone: params.phone ?? null,
      role: params.role as any,
      branchId: params.branchId,
      passwordHash,
    },
  })

  if (params.sendSetupLink) {
    // Generate setup link (7 day expiry — longer than normal reset)
    const token = await generatePasswordResetToken({
      userId: user.id,
      prisma,
      isSetupLink: true,
    })

    // Queue welcome email with setup link
    await fastify.queues[QUEUES.NOTIFICATIONS].add('welcome-email', {
      to: user.email,
      name: user.name,
      role: user.role,
      setupUrl: `${config.frontendUrl}/setup-password?token=${token}`,
    })
  }

  return { success: true, userId: user.id }
}

// ── Admin resets password — sends new password via email ──
export async function adminResetPassword(params: {
  targetUserId: string
  newPassword: string
  prisma: PrismaClient
  redis: import('ioredis').default
  fastify: FastifyInstance
}): Promise<void> {
  const { prisma, redis, fastify } = params

  const passwordHash = await bcrypt.hash(params.newPassword, BCRYPT_ROUNDS)

  const user = await prisma.user.update({
    where: { id: params.targetUserId },
    data: { passwordHash },
    select: { email: true, name: true },
  })

  // Invalidate all existing sessions — security requirement
  await invalidateAllSessions({
    userId: params.targetUserId,
    prisma,
    redis,
  })

  // Email the new password to the employee
  await fastify.queues[QUEUES.NOTIFICATIONS].add('password-changed-email', {
    to: user.email,
    name: user.name,
    newPassword: params.newPassword,
    message: 'Your password has been reset by an administrator.',
  })
}

// ── Deactivate user — preview + execute ──
export async function getDeactivationPreview(params: {
  targetUserId: string
  prisma: PrismaClient
}): Promise<{
  userId: string
  userName: string
  leadsToUnassign: number
  confirmedLeadsKept: number
}> {
  const { prisma, targetUserId } = params

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { name: true },
  })

  const assignedLeads = await prisma.lead.findMany({
    where: { assignedToId: targetUserId },
    select: { id: true, status: true },
  })

  const { leadIdsToUnassign, skippedLeadIds } =
    resolveDeactivationUnassignment({
      deactivatedUserId: targetUserId,
      assignedLeads,
    })

  return {
    userId: targetUserId,
    userName: user?.name ?? 'Unknown',
    leadsToUnassign: leadIdsToUnassign.length,
    confirmedLeadsKept: skippedLeadIds.length,
  }
}

export async function executeDeactivation(params: {
  targetUserId: string
  executedById: string
  prisma: PrismaClient
  redis: import('ioredis').default
  fastify: FastifyInstance
}): Promise<void> {
  const { prisma, redis, fastify, targetUserId, executedById } = params

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, name: true },
  })

  if (!user) return

  const assignedLeads = await prisma.lead.findMany({
    where: { assignedToId: targetUserId },
    select: { id: true, status: true },
  })

  const { leadIdsToUnassign } = resolveDeactivationUnassignment({
    deactivatedUserId: targetUserId,
    assignedLeads,
  })

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    // Deactivate user
    await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    })

    // Unassign active leads
    if (leadIdsToUnassign.length > 0) {
      await tx.lead.updateMany({
        where: { id: { in: leadIdsToUnassign } },
        data: { assignedToId: null },
      })

      // Audit every unassigned lead
      await tx.auditLog.createMany({
        data: leadIdsToUnassign.map((leadId) => ({
          leadId,
          userId: executedById,
          action: 'LEAD_UNASSIGNED_USER_DEACTIVATED',
          oldValue: { assignedToId: targetUserId },
          newValue: { assignedToId: null },
        })),
      })
    }
  })

  // Invalidate all sessions instantly
  await invalidateAllSessions({ userId: targetUserId, prisma, redis })

  // Notify the deactivated employee
  await fastify.queues[QUEUES.NOTIFICATIONS].add('account-deactivated-email', {
    to: user.email,
    name: user.name,
    message:
      'Your account has been deactivated. Please contact your administrator.',
  })
}

// ── Helpers ──
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }
  return password
}