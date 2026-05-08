import { config } from "../config";
import path from "path";
import fs from "fs/promises";

export type UploadResult = {
  url: string;
  key: string;
};

// In development: save to local /uploads folder
// In production: upload to Cloudflare R2
export async function uploadFile(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}): Promise<UploadResult> {
  const key = `${params.folder}/${Date.now()}-${params.fileName}`;

  if (config.isDev || !config.r2AccessKeyId) {
    return uploadLocal(key, params.buffer);
  }

  return uploadR2(key, params.buffer, params.mimeType);
}

// ── Local storage (dev only) ──
async function uploadLocal(key: string, buffer: Buffer): Promise<UploadResult> {
  const uploadDir = path.join(process.cwd(), "uploads", path.dirname(key));
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "uploads", key), buffer);

  return {
    url: `${config.r2PublicUrl}/${key}`,
    key,
  };
}

// ── Cloudflare R2 (production) ──
async function uploadR2(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  // Will be implemented when R2 credentials are ready
  // Uses AWS S3-compatible API
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return {
    url: `${config.r2PublicUrl}/${key}`,
    key,
  };
}
