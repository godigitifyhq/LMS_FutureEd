import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { leadRoutes } from "./leads";
import { interactionRoutes } from "./interactions";
import { uploadRoutes } from "./upload";
import { userRoutes } from "./users";
import { branchRoutes } from "./branches";
import { analyticsRoutes } from "./analytics";
import { activityRoutes } from "./activity";
import { settingsRoutes } from "./settings";
import { metaRoutes } from "./meta";

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  await fastify.register(leadRoutes, { prefix: "/api/v1/leads" });
  // Interaction routes expose endpoints under both
  // - GET/POST: /api/v1/leads/:leadId/interactions
  // - PATCH/DELETE for interactions by id: /api/v1/interactions/:id
  // To avoid collision with the lead update route (PATCH /api/v1/leads/:id)
  // we register interactionRoutes at the base API prefix so it can declare
  // both '/leads/:leadId/interactions' and '/interactions/:id' paths.
  await fastify.register(interactionRoutes, { prefix: "/api/v1" });
  await fastify.register(uploadRoutes, { prefix: "/api/v1/upload" });
  await fastify.register(userRoutes, { prefix: "/api/v1/users" });
  await fastify.register(branchRoutes, { prefix: "/api/v1/branches" });
  await fastify.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
  await fastify.register(activityRoutes, { prefix: "/api/v1/activity" });
  await fastify.register(settingsRoutes, { prefix: "/api/v1/settings" });
  // Meta webhook + lead capture (Lead Forms + WhatsApp Cloud API)
  await fastify.register(metaRoutes, { prefix: "/api/v1/meta" });
}
