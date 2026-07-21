import { S3Client } from "@aws-sdk/client-s3";

export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim()?.replace(
    /\/+$/,
    ""
  );

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl || null
  };
}

export function isR2Configured() {
  return getR2Config() !== null;
}

export function createR2Client() {
  const config = getR2Config();
  if (!config) {
    throw new Error("R2 is not configured");
  }

  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      // Path-style: https://{account}.r2.cloudflarestorage.com/{bucket}/key
      // Avoids virtual-hosted rhoq.{account}.r2... which often breaks browser CORS.
      forcePathStyle: true,
      // AWS SDK v3 default checksums break browser PUTs to R2 (extra signed query params).
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED"
    }),
    bucket: config.bucket,
    publicBaseUrl: config.publicBaseUrl
  };
}

export function publicObjectUrl(key: string) {
  const config = getR2Config();
  if (!config?.publicBaseUrl) return null;
  const path = key.replace(/^\/+/, "");
  return `${config.publicBaseUrl}/${path}`;
}
