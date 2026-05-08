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
  corsOrigin: optionalEnv("CORS_ORIGIN", "*"),

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

  isProd: process.env["NODE_ENV"] === "production",
  isDev: process.env["NODE_ENV"] !== "production",
} as const;
