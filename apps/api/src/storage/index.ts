import { config } from "../config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type UploadResult = {
  url: string;
  key: string;
};

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }
  return r2Client;
}

function checkR2Config(): string | null {
  if (!config.r2AccountId) return "R2_ACCOUNT_ID is not set";
  if (!config.r2AccessKeyId) return "R2_ACCESS_KEY_ID is not set";
  if (!config.r2SecretAccessKey) return "R2_SECRET_ACCESS_KEY is not set";
  if (!config.r2BucketName || config.r2BucketName === "local")
    return "R2_BUCKET_NAME is not set";
  if (!config.r2PublicUrl || config.r2PublicUrl.startsWith("http://localhost"))
    return "R2_PUBLIC_URL is not set to a public URL";
  return null;
}

export async function uploadFile(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}): Promise<UploadResult> {
  const safeName = params.fileName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "");
  const key = `${params.folder}/${safeName}`;

  const configError = checkR2Config();
  if (configError) {
    throw new Error(`R2 storage is not configured: ${configError}`);
  }

  return uploadR2(key, params.buffer, params.mimeType);
}

async function uploadR2(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  const client = getR2Client();

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

export async function getSignedFileUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSignedUrl(client as any, command, { expiresIn: expiresInSeconds });
}

export async function deleteFile(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
    }),
  );
}

export function getStorageKeyFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  try {
    const publicBaseUrl = config.r2PublicUrl?.replace(/\/+$/, "");
    const normalizedUrl = fileUrl.replace(/\/+$/, "");

    if (publicBaseUrl && normalizedUrl.startsWith(publicBaseUrl)) {
      return normalizedUrl.slice(publicBaseUrl.length).replace(/^\//, "");
    }

    const parsedUrl = new URL(fileUrl);
    return parsedUrl.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}
