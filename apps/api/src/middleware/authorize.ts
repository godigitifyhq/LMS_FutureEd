import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@lms/types";

// Attach this to routes that require specific roles
export function authorize(allowedRoles: Role[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.user;

    if (!allowedRoles.includes(user.role)) {
      await reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action",
        },
      });
      return;
    }
  };
}
