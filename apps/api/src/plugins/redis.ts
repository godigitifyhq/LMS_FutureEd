import fp from "fastify-plugin";
import Redis from "ioredis";
import { config } from "../config";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp(async (fastify) => {
  fastify.log.info("Connecting to Redis...");

  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  redis.on("error", (error) => {
    fastify.log.error({ error }, "✗ Redis error");
  });

  redis.on("reconnecting", () => {
    fastify.log.warn("Redis reconnecting...");
  });

  await redis.connect();
  fastify.log.info("✓ Redis connected successfully");

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
    fastify.log.info("✓ Redis disconnected");
  });
});
