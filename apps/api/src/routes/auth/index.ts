import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
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
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "@lms/types";
import { validateBody } from "../../middleware/validate";
import { z } from "zod";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const refreshCookieOptions = {
    httpOnly: true,
    secure: config.isProd,
    // SameSite=None required for cross-domain cookies (Vercel ↔ Railway)
    sameSite: (config.isProd ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };

  // ── POST /api/v1/auth/login ──
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: config.isDev ? 100 : 5,
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
      const validation = validateBody(LoginSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const { email, password } = validation.data;

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

      reply.setCookie(
        "refreshToken",
        result.refreshToken,
        refreshCookieOptions,
      );

      return reply.status(200).send({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    },
  );

  // ── POST /api/v1/auth/refresh ──
  fastify.post("/refresh", async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Session expired. Please login again.",
        },
      });
    }

    const result = await refreshAccessToken({
      rawRefreshToken: refreshToken,
      prisma: fastify.prisma,
      fastify,
    });

    if ("error" in result) {
      reply.clearCookie("refreshToken", { path: "/" });
      return reply.status(401).send({
        success: false,
        error: {
          code: result.error,
          message: "Session expired. Please login again.",
        },
      });
    }

    reply.setCookie("refreshToken", result.refreshToken, refreshCookieOptions);

    try {
      const decoded = fastify.jwt.decode(result.accessToken) as {
        sub?: string;
      } | null;
      if (decoded?.sub) {
        await fastify.redis.del(`user-logout:${decoded.sub}`);
      }
    } catch {}

    return reply.status(200).send({
      success: true,
      data: {
        accessToken: result.accessToken,
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
      const refreshToken = request.cookies.refreshToken;

      if (refreshToken) {
        await logoutUser({
          rawRefreshToken: refreshToken,
          accessTokenJti: (request.user as any).jti,
          prisma: fastify.prisma,
          redis: fastify.redis,
        });
      }

      reply.clearCookie("refreshToken", { path: "/" });

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
        rateLimit: { max: config.isDev ? 100 : 3, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
      const validation = validateBody(ForgotPasswordSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const { email } = validation.data;

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
    const validation = validateBody(ResetPasswordSchema, request.body);
    if (!validation.success) {
      return reply.status(400).send({ success: false, ...validation.error });
    }
    const { token, newPassword } = validation.data;

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

  fastify.post(
    "/change-password",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const validation = validateBody(ChangePasswordSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const { currentPassword, newPassword } = validation.data;

      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
      });
      if (!user)
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid)
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Current password is incorrect",
          },
        });

      const newHash = await bcrypt.hash(newPassword, 12);
      await fastify.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
        // Invalidate all existing refresh tokens for this user
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      });

      // Force re-auth on all devices by setting user-level logout flag (24h)
      await fastify.redis.setex(`user-logout:${user.id}`, 86400, "1");

      return reply.send({
        success: true,
        data: { message: "Password changed successfully. Please login again." },
      });
    },
  );

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
