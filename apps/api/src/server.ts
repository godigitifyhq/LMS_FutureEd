import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
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

  await fastify.register(cookie, {
    secret: config.jwtSecret,
  });

  // Support a comma-separated list of allowed origins via CORS_ORIGIN
  const allowedOrigins = (config.corsOrigin || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await fastify.register(cors, {
    origin: function (origin, cb) {
      // Allow non-browser (e.g., server-to-server) requests with no origin
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0)
        return cb(new Error("CORS origin not configured"), false);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB global limit
      files: 1, // one file per request
    },
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

  // Serve public assets (logo, etc.) — available in all environments
  {
    const { join } = await import("path");
    await fastify.register(import("@fastify/static"), {
      root: join(process.cwd(), "public"),
      prefix: "/public/",
      decorateReply: false,
    });
  }

  // Serve uploaded files locally in development
  if (config.isDev) {
    const { join } = await import("path");
    await fastify.register(import("@fastify/static"), {
      root: join(process.cwd(), "uploads"),
      prefix: "/uploads/",
      decorateReply: false,
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
