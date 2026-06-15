import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

for (const envPath of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "src/.env"),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optionalEnv("NODE_ENV", "development"),
  port: parseInt(optionalEnv("PORT", "5000"), 10),

  // Database
  databaseUrl: requireEnv("DATABASE_URL"),

  // Redis
  redisUrl: requireEnv("REDIS_URL"),

  // JWT
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtAccessExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",

  // CORS
  // Default to localhost web origin in development to support credentials
  corsOrigin: optionalEnv("CORS_ORIGIN", "http://localhost:3000"),

  // Cloudflare R2 — optional in development
  r2AccountId: optionalEnv("R2_ACCOUNT_ID", ""),
  r2AccessKeyId: optionalEnv("R2_ACCESS_KEY_ID", ""),
  r2SecretAccessKey: optionalEnv("R2_SECRET_ACCESS_KEY", ""),
  r2BucketName: optionalEnv("R2_BUCKET_NAME", "local"),
  r2PublicUrl: optionalEnv("R2_PUBLIC_URL", "http://localhost:5000/uploads"),

  // App
  apiBaseUrl: optionalEnv(
    "API_BASE_URL",
    "https://api.futureeducationonline.com",
  ),

  // Email
  smtp: {
    host: optionalEnv("SMTP_HOST", "smtp.gmail.com"),
    port: parseInt(optionalEnv("SMTP_PORT", "587"), 10),
    user: optionalEnv("SMTP_USER", ""),
    pass: optionalEnv("SMTP_PASS", ""),
    from: optionalEnv("SMTP_FROM", "FutureEd LMS <noreply@futureeducation.in>"),
  },
  frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:3000"),
  logoUrl: optionalEnv("LOGO_URL", ""),

  isProd: process.env["NODE_ENV"] === "production",
  isDev: process.env["NODE_ENV"] !== "production",

  // ── Meta (shared for Lead Forms + WhatsApp) ──
  // All optional — system degrades gracefully when not set
  meta: {
    appId:                   optionalEnv("META_APP_ID", ""),
    appSecret:               optionalEnv("META_APP_SECRET", ""),
    webhookVerifyToken:      optionalEnv("META_WEBHOOK_VERIFY_TOKEN", ""),
    pageAccessToken:         optionalEnv("META_PAGE_ACCESS_TOKEN", ""),
    pageId:                  optionalEnv("META_PAGE_ID", ""),
    whatsappPhoneNumberId:   optionalEnv("META_WHATSAPP_PHONE_NUMBER_ID", ""),
    whatsappBusinessAccountId: optionalEnv("META_WHATSAPP_BUSINESS_ACCOUNT_ID", ""),
    whatsappAutoReply:       optionalEnv("META_WHATSAPP_AUTO_REPLY", "true") === "true",
    // Comma-separated form IDs whitelist — empty = accept all forms
    allowedFormIds:          optionalEnv("META_ALLOWED_FORM_IDS", "")
                               .split(",")
                               .map((s) => s.trim())
                               .filter(Boolean),
  },
} as const;
