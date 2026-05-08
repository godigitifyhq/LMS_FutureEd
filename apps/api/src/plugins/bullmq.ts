import fp from 'fastify-plugin'
import { Queue } from 'bullmq'
import type Redis from 'ioredis'

// Queue names as constants — never use magic strings
export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  PDF:           'pdf',
  IMPORT:        'import',
} as const

export type QueueName = typeof QUEUES[keyof typeof QUEUES]

declare module 'fastify' {
  interface FastifyInstance {
    queues: Record<QueueName, Queue>
  }
}

export const bullmqPlugin = fp(async (fastify) => {
  const connection = fastify.redis as Redis

  const queues: Record<QueueName, Queue> = {
    [QUEUES.NOTIFICATIONS]: new Queue(QUEUES.NOTIFICATIONS, { connection }),
    [QUEUES.PDF]:           new Queue(QUEUES.PDF, { connection }),
    [QUEUES.IMPORT]:        new Queue(QUEUES.IMPORT, { connection }),
  }

  fastify.decorate('queues', queues)

  fastify.addHook('onClose', async () => {
    await Promise.all(
      Object.values(queues).map(q => q.close())
    )
  })
})