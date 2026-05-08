import fp from "fastify-plugin";
import { PrismaClient } from "@lms/db";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { config } from "../config";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (fastify) => {
  fastify.log.info("Connecting to database...");

  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10, // max connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test the connection immediately
  try {
    const client = await pool.connect();
    client.release();
    fastify.log.info("✓ Database connected successfully");
  } catch (error) {
    fastify.log.error({ error }, "✗ Database connection failed");
    throw error; // crash fast if DB is unreachable
  }

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();
  fastify.log.info("✓ Prisma client ready");

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    fastify.log.info("Disconnecting database...");
    await prisma.$disconnect();
    await pool.end();
    fastify.log.info("✓ Database disconnected");
  });
});
