import bcrypt from "bcrypt";
import crypto from "crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@lms/db";
import type { Role } from "@lms/types";

const BCRYPT_ROUNDS = 12;
const MAX_DEVICES = 3;
const INACTIVITY_MS = 24 * 60 * 60 * 1000; // 1 day
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SETUP_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Password helpers ──

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Token generation ──
// crypto.randomBytes = cryptographically secure random
// Never use Math.random() for security tokens

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── Login ──

export async function loginUser(params: {
  email: string;
  password: string;
  deviceInfo: string | undefined;
  prisma: PrismaClient;
  fastify: FastifyInstance;
}): Promise<
  | {
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        name: string;
        email: string;
        role: Role;
        branchId: string;
      };
    }
  | { error: "INVALID_CREDENTIALS" }
  | { error: "ACCOUNT_DISABLED" }
> {
  const { email, password, deviceInfo, prisma, fastify } = params;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    // Constant-time comparison even on miss — prevents timing attacks
    await bcrypt.compare(
      password,
      "$2b$12$invalidhashfortimingattackprevention",
    );
    return { error: "INVALID_CREDENTIALS" };
  }

  // Check active
  if (!user.isActive) {
    return { error: "ACCOUNT_DISABLED" };
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { error: "INVALID_CREDENTIALS" };

  // Enforce max 3 devices
  // If already at limit, remove oldest session
  const existingTokens = await prisma.refreshToken.findMany({
    where: { userId: user.id },
    orderBy: { lastUsedAt: "asc" },
  });

  if (existingTokens.length >= MAX_DEVICES) {
    const oldest = existingTokens[0];
    if (oldest) {
      await prisma.refreshToken.delete({ where: { id: oldest.id } });
    }
  }

  // Generate tokens
  const rawRefreshToken = generateSecureToken();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + INACTIVITY_MS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      deviceInfo: deviceInfo ?? "unknown",
      expiresAt,
    },
  });

  try {
    await fastify.redis.del(`user-logout:${user.id}`);
    await fastify.redis.del(`notifs:${user.id}`);
  } catch {}

  // Sign JWT access token
  const accessToken = fastify.jwt.sign({
    sub: user.id,
    email: user.email,
    role: user.role as Role,
    branchId: user.branchId,
    jti: crypto.randomUUID(),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      branchId: user.branchId,
    },
  };
}

// ── Refresh ──

export async function refreshAccessToken(params: {
  rawRefreshToken: string;
  prisma: PrismaClient;
  fastify: FastifyInstance;
}): Promise<
  | { accessToken: string; refreshToken: string }
  | { error: "INVALID_TOKEN" }
  | { error: "TOKEN_EXPIRED" }
> {
  const { rawRefreshToken, prisma, fastify } = params;
  const tokenHash = hashToken(rawRefreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken) return { error: "INVALID_TOKEN" };
  if (!storedToken.user.isActive) return { error: "INVALID_TOKEN" };

  // Check inactivity expiry
  const inactiveSince = Date.now() - storedToken.lastUsedAt.getTime();
  if (inactiveSince > INACTIVITY_MS) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    return { error: "TOKEN_EXPIRED" };
  }

  // Rotate refresh token — invalidate old, issue new
  // This is called refresh token rotation — prevents token replay attacks
  const newRawToken = generateSecureToken();
  const newHash = hashToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + INACTIVITY_MS);

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      tokenHash: newHash,
      lastUsedAt: new Date(),
      expiresAt: newExpiresAt,
    },
  });

  const accessToken = fastify.jwt.sign({
    sub: storedToken.user.id,
    email: storedToken.user.email,
    role: storedToken.user.role as Role,
    branchId: storedToken.user.branchId,
    jti: crypto.randomUUID(), // ← add this
  });

  try {
    await (fastify as any).redis?.del(`user-logout:${storedToken.user.id}`);
  } catch {}

  return { accessToken, refreshToken: newRawToken };
}

// ── Logout ──

export async function logoutUser(params: {
  rawRefreshToken: string;
  accessTokenJti: string | undefined;
  prisma: PrismaClient;
  redis: import("ioredis").default;
}): Promise<void> {
  const { rawRefreshToken, prisma, redis } = params;
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.deleteMany({ where: { tokenHash } });

  // Blacklist the access token until it expires
  if (params.accessTokenJti) {
    await redis.setex(`blacklist:${params.accessTokenJti}`, 900, "1"); // 15 min TTL
  }
}

// ── Logout all devices ──

export async function logoutAllDevices(params: {
  userId: string;
  prisma: PrismaClient;
  redis: import("ioredis").default;
}): Promise<void> {
  await params.prisma.refreshToken.deleteMany({
    where: { userId: params.userId },
  });
  // Mark all tokens for this user as invalid
  await params.redis.setex(
    `user-logout:${params.userId}`,
    900,
    Date.now().toString(),
  );
}

// ── Instant invalidation on deactivation ──

export async function invalidateAllSessions(params: {
  userId: string;
  prisma: PrismaClient;
  redis: import("ioredis").default;
}): Promise<void> {
  await params.prisma.refreshToken.deleteMany({
    where: { userId: params.userId },
  });
  await params.redis.setex(
    `user-logout:${params.userId}`,
    900,
    Date.now().toString(),
  );
}

// ── Password reset token generation ──

export async function generatePasswordResetToken(params: {
  userId: string;
  prisma: PrismaClient;
  isSetupLink?: boolean;
}): Promise<string> {
  const raw = generateSecureToken();
  const hash = hashToken(raw);
  const expiry = params.isSetupLink
    ? SETUP_TOKEN_EXPIRY_MS
    : RESET_TOKEN_EXPIRY_MS;

  // Invalidate any existing reset tokens for this user
  await params.prisma.passwordResetToken.deleteMany({
    where: { userId: params.userId },
  });

  await params.prisma.passwordResetToken.create({
    data: {
      userId: params.userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + expiry),
    },
  });

  return raw;
}

// ── Reset password with token ──

export async function resetPasswordWithToken(params: {
  rawToken: string;
  newPassword: string;
  prisma: PrismaClient;
  redis: import("ioredis").default;
}): Promise<{ error: "INVALID_TOKEN" } | { success: true }> {
  const hash = hashToken(params.rawToken);

  const resetToken = await params.prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });

  if (!resetToken) return { error: "INVALID_TOKEN" };
  if (resetToken.usedAt) return { error: "INVALID_TOKEN" };
  if (resetToken.expiresAt < new Date()) return { error: "INVALID_TOKEN" };

  const newHash = await hashPassword(params.newPassword);

  await params.prisma.$transaction([
    // Update password
    params.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newHash },
    }),
    // Mark token as used
    params.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Invalidate all active sessions — security best practice
  await invalidateAllSessions({
    userId: resetToken.userId,
    prisma: params.prisma,
    redis: params.redis,
  });

  return { success: true };
}
