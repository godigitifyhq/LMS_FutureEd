import type { FastifyReply, FastifyRequest } from "fastify";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();

    const payload = request.user;
    const userId =
      (payload as { id?: string; sub?: string }).id ??
      (payload as { sub?: string }).sub;
    if (!userId) {
      await reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }
    (payload as { id: string }).id = userId;

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
    const userLogout = await request.server.redis.get(`user-logout:${userId}`);
    if (userLogout) {
      await reply.status(401).send({
        success: false,
        error: { code: "SESSION_EXPIRED", message: "Please login again" },
      });
      return;
    }

    // Stamp lastActiveAt — fire-and-forget, never block the request.
    // Throttled to once per minute via Redis to avoid a DB write on every API call.
    const throttleKey = `lastActive:${userId}`;
    const alreadyStamped = await request.server.redis.get(throttleKey);
    if (!alreadyStamped) {
      void request.server.prisma.user
        .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
        .catch(() => undefined); // never fail the request on DB error
      await request.server.redis.setex(throttleKey, 60, "1");
    }
  } catch {
    await reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
}
