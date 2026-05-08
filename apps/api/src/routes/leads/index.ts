import type { FastifyInstance } from "fastify";
import { leadListRoute } from "./list";
import { createLeadRoute } from "./create";
import { leadDetailRoute } from "./detail";
import { updateLeadRoute } from "./update";
import { transitionLeadRoute } from "./transition";
import { assignLeadRoute } from "./assign";
import { unassignedLeadsRoute } from "./unassigned";
import { overdueLeadsRoute } from "./overdue";
import { bulkLeadRoutes } from "./bulk";

export async function leadRoutes(fastify: FastifyInstance): Promise<void> {
  // Order matters — specific routes before parameterized routes
  await fastify.register(unassignedLeadsRoute);
  await fastify.register(overdueLeadsRoute);
  await fastify.register(bulkLeadRoutes);
  await fastify.register(leadListRoute);
  await fastify.register(createLeadRoute);
  await fastify.register(leadDetailRoute);
  await fastify.register(updateLeadRoute);
  await fastify.register(transitionLeadRoute);
  await fastify.register(assignLeadRoute);
}
