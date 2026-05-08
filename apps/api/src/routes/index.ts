import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { leadRoutes } from "./leads";
import { interactionRoutes } from "./interactions";
import { uploadRoutes } from "./upload";

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  await fastify.register(leadRoutes, { prefix: "/api/v1/leads" });
  await fastify.register(interactionRoutes, { prefix: "/api/v1/leads" });
  await fastify.register(uploadRoutes, { prefix: "/api/v1/upload" });
}
