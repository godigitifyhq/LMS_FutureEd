import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  // Phase 9 onwards: lead routes, user routes etc added here
}
