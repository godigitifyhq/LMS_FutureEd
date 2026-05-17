import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { Role } from "@lms/types";

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  const guard = [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])];

  // Courses
  fastify.get(
    "/courses",
    { preHandler: authenticate },
    async (request, reply) => {
      const { isActive } = request.query as { isActive?: string };

      const where: Record<string, unknown> = {};
      if (isActive === "true") where["isActive"] = true;
      if (isActive === "false") where["isActive"] = false;
      // no param = return all (for settings page)

      const courses = await fastify.prisma.course.findMany({
        where,
        orderBy: { name: "asc" },
      });
      return reply.send({ success: true, data: courses });
    },
  );

  fastify.post("/courses", { preHandler: guard }, async (request, reply) => {
    const body = request.body as {
      name: string;
      code?: string;
      description?: string;
    };
    const course = await fastify.prisma.course.create({ data: body as any });
    return reply.status(201).send({ success: true, data: course });
  });

  fastify.patch(
    "/courses/:id",
    { preHandler: guard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const course = await fastify.prisma.course.update({
        where: { id },
        data: body as any,
      });
      return reply.send({ success: true, data: course });
    },
  );

  // Lead source types
  fastify.get("/sources", { preHandler: authenticate }, async (_, reply) => {
    const sources = await fastify.prisma.leadSourceType.findMany({
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data: sources });
  });

  fastify.post("/sources", { preHandler: guard }, async (request, reply) => {
    const body = request.body as { name: string };
    const source = await fastify.prisma.leadSourceType.create({ data: body });
    return reply.status(201).send({ success: true, data: source });
  });

  fastify.patch(
    "/sources/:id",
    { preHandler: guard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const source = await fastify.prisma.leadSourceType.update({
        where: { id },
        data: body as any,
      });
      return reply.send({ success: true, data: source });
    },
  );

  // Document types
  fastify.get("/documents", { preHandler: authenticate }, async (_, reply) => {
    const docs = await fastify.prisma.documentType.findMany({
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data: docs });
  });

  fastify.post("/documents", { preHandler: guard }, async (request, reply) => {
    const body = request.body as { name: string; isRequired?: boolean };
    const doc = await fastify.prisma.documentType.create({ data: body });
    return reply.status(201).send({ success: true, data: doc });
  });

  fastify.patch(
    "/documents/:id",
    { preHandler: guard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const doc = await fastify.prisma.documentType.update({
        where: { id },
        data: body as any,
      });
      return reply.send({ success: true, data: doc });
    },
  );
}
