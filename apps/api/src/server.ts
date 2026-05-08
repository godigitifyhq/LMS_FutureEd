import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import { config } from "./config";
import { errorHandler } from "./errors/handler";
import { prismaPlugin } from "./plugins/prisma";
import { redisPlugin } from "./plugins/redis";
import { bullmqPlugin } from "./plugins/bullmq";
import { jwtPlugin } from "./plugins/jwt";
import { registerRoutes } from "./routes";

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.isDev ? "debug" : "info",
      ...(config.isDev && {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
    },
  });

  // ── Security ──
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // handled by frontend
  });

  await fastify.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  // Rate limit — global default
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ── Infrastructure plugins ──
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(bullmqPlugin);
  await fastify.register(jwtPlugin);

  await fastify.register(registerRoutes);

  // Serve uploaded files locally in development
  if (config.isDev) {
    const { join } = await import("path");
    await fastify.register(import("@fastify/static"), {
      root: join(process.cwd(), "uploads"),
      prefix: "/uploads/",
    });
  }

  // ── Global error handler ──
  fastify.setErrorHandler(errorHandler);

  // ── Health check — no auth required ──
  fastify.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: config.env,
  }));

  return fastify;
}
