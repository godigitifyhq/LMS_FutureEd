import type { FastifyReply, FastifyRequest } from "fastify";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();

    const payload = request.user;

    // Check if token is blacklisted (logout/deactivation)
    const jti = (payload as any).jti as string | undefined;
    if (jti) {
      const blacklisted = await request.server.redis.get(`blacklist:${jti}`);
      if (blacklisted) {
        await reply.status(401).send({
          success: false,
          error: {
            code: "TOKEN_REVOKED",
            message: "Session has been invalidated",
          },
        });
        return;
      }
    }

    // Check user-level logout (all devices)
    const userLogout = await request.server.redis.get(
      `user-logout:${payload.id}`,
    );
    if (userLogout) {
      await reply.status(401).send({
        success: false,
        error: { code: "SESSION_EXPIRED", message: "Please login again" },
      });
      return;
    }
  } catch {
    await reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
}
