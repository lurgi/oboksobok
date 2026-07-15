import { PutObjectCommand, type PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";

const ONE_YEAR_SECONDS = 31_536_000;
const RETRY_DELAYS_MS = [500, 1500];

type R2AssetConfig = {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

type RetryableOperationInput = {
  label: string;
};

type PutR2ObjectInput = {
  body: NonNullable<PutObjectCommandInput["Body"]>;
  contentLength?: number;
  contentType: string;
  objectKey: string;
};

let client: S3Client | undefined;

export class NonRetryableAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableAssetError";
  }
}

export function shouldUseR2Assets() {
  return import.meta.env.PROD;
}

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  { label }: RetryableOperationInput,
): Promise<T> {
  let lastError: unknown;

  for (let attemptIndex = 0; attemptIndex <= RETRY_DELAYS_MS.length; attemptIndex += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (error instanceof NonRetryableAssetError || attemptIndex === RETRY_DELAYS_MS.length) {
        break;
      }

      await delay(RETRY_DELAYS_MS[attemptIndex]);
    }
  }

  throw new Error(`Failed to ${label}`, { cause: lastError });
}

export async function putR2Object({
  body,
  contentLength,
  contentType,
  objectKey,
}: PutR2ObjectInput) {
  const config = getR2AssetConfig();

  await getR2Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucket,
      CacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      ContentLength: contentLength,
      ContentType: contentType,
      Key: objectKey,
    }),
  );

  return buildR2PublicUrl(objectKey);
}

export function buildR2PublicUrl(objectKey: string, version?: string) {
  const config = getR2AssetConfig();
  const publicUrl = `${trimTrailingSlash(config.publicBaseUrl)}/${encodeObjectKeyPath(objectKey)}`;

  if (!version) {
    return publicUrl;
  }

  return `${publicUrl}?v=${encodeURIComponent(version)}`;
}

export function formatR2AssetVersion(lastEditedTime: string) {
  return lastEditedTime.replace(/\D/g, "");
}

export function trimSlashes(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function getR2AssetConfig(): R2AssetConfig {
  const config = {
    accessKeyId: import.meta.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    accountId: import.meta.env.CLOUDFLARE_R2_ACCOUNT_ID,
    bucket: import.meta.env.CLOUDFLARE_R2_BUCKET,
    publicBaseUrl: import.meta.env.CLOUDFLARE_R2_PUBLIC_BASE_URL,
    secretAccessKey: import.meta.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  };

  const missing = [
    ["CLOUDFLARE_R2_ACCESS_KEY_ID", config.accessKeyId],
    ["CLOUDFLARE_R2_ACCOUNT_ID", config.accountId],
    ["CLOUDFLARE_R2_BUCKET", config.bucket],
    ["CLOUDFLARE_R2_PUBLIC_BASE_URL", config.publicBaseUrl],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", config.secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new NonRetryableAssetError(`Missing Cloudflare R2 asset config: ${missing.join(", ")}`);
  }

  return config as R2AssetConfig;
}

function getR2Client(config: R2AssetConfig) {
  client ??= new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto",
  });

  return client;
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/g, "");
}

function encodeObjectKeyPath(objectKey: string) {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
