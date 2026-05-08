import type { FastifyInstance } from "fastify";
import { config } from "../../config";
import {
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  generatePasswordResetToken,
  resetPasswordWithToken,
} from "./service";
import { authenticate } from "../../middleware/authenticate";

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /api/v1/auth/login ──
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many login attempts. Try again in 15 minutes.",
            },
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      if (!email || !password) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Email and password required",
          },
        });
      }

      const deviceInfo = request.headers["user-agent"];

      const result = await loginUser({
        email,
        password,
        deviceInfo,
        prisma: fastify.prisma,
        fastify,
      });

      if ("error" in result) {
        // Same message for both invalid credentials AND disabled account
        // Never tell attacker WHICH check failed
        return reply.status(401).send({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        },
      });
    },
  );

  // ── POST /api/v1/auth/refresh ──
  fastify.post("/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };

    if (!refreshToken) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "Refresh token required" },
      });
    }

    const result = await refreshAccessToken({
      rawRefreshToken: refreshToken,
      prisma: fastify.prisma,
      fastify,
    });

    if ("error" in result) {
      return reply.status(401).send({
        success: false,
        error: {
          code: result.error,
          message: "Session expired. Please login again.",
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  });

  // ── POST /api/v1/auth/logout ──
  fastify.post(
    "/logout",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string };

      if (refreshToken) {
        await logoutUser({
          rawRefreshToken: refreshToken,
          accessTokenJti: (request.user as any).jti,
          prisma: fastify.prisma,
          redis: fastify.redis,
        });
      }

      return reply.status(200).send({ success: true, data: null });
    },
  );

  // ── POST /api/v1/auth/logout-all ──
  fastify.post(
    "/logout-all",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      await logoutAllDevices({
        userId: request.user.id,
        prisma: fastify.prisma,
        redis: fastify.redis,
      });

      return reply.status(200).send({ success: true, data: null });
    },
  );

  // ── POST /api/v1/auth/forgot-password ──
  fastify.post(
    "/forgot-password",
    {
      config: {
        rateLimit: { max: 3, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email?: string };

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "Email required" },
        });
      }

      const user = await fastify.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      // Always return success — never reveal if email exists
      // This prevents user enumeration attacks
      if (user && user.isActive) {
        const token = await generatePasswordResetToken({
          userId: user.id,
          prisma: fastify.prisma,
        });

        // Add to email queue
        await fastify.queues.notifications.add("password-reset-email", {
          to: user.email,
          name: user.name,
          resetUrl: `${config.corsOrigin}/reset-password?token=${token}`,
        });
      }

      return reply.status(200).send({
        success: true,
        data: { message: "If this email exists, a reset link has been sent." },
      });
    },
  );

  // ── POST /api/v1/auth/reset-password ──
  fastify.post("/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as {
      token?: string;
      newPassword?: string;
    };

    if (!token || !newPassword) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Token and new password required",
        },
      });
    }

    if (newPassword.length < 8) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Password must be at least 8 characters",
        },
      });
    }

    const result = await resetPasswordWithToken({
      rawToken: token,
      newPassword,
      prisma: fastify.prisma,
      redis: fastify.redis,
    });

    if ("error" in result) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Reset link is invalid or expired",
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: { message: "Password updated successfully. Please login." },
    });
  });

  // ── POST /api/v1/auth/me ──
  // Get current user from token
  fastify.get(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          branchId: true,
          branch: { select: { name: true, city: true } },
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
      }

      return reply.status(200).send({ success: true, data: user });
    },
  );
}
