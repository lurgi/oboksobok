import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DEFAULT_OBJECT_PREFIX = "notion/essays-thumbnails";
const ONE_YEAR_SECONDS = 31_536_000;

type R2ThumbnailAssetInput = {
  alt?: string;
  id: string;
  lastEditedTime: string;
  sourceUrl: string;
};

type R2ThumbnailAsset = {
  alt?: string;
  src: string;
};

type R2AssetConfig = {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  objectPrefix: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

let client: S3Client | undefined;

export function shouldUseR2Assets() {
  return import.meta.env.PROD;
}

export async function uploadThumbnailToR2({
  alt,
  id,
  lastEditedTime,
  sourceUrl,
}: R2ThumbnailAssetInput): Promise<R2ThumbnailAsset> {
  const config = getR2AssetConfig();
  const objectKey = getThumbnailObjectKey(config.objectPrefix, id);
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Notion thumbnail for "${id}": ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const body = new Uint8Array(await response.arrayBuffer());

  await getR2Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucket,
      CacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      ContentType: contentType,
      Key: objectKey,
    }),
  );

  return {
    alt,
    src: `${trimTrailingSlash(config.publicBaseUrl)}/${encodeObjectKeyPath(objectKey)}?v=${formatVersion(lastEditedTime)}`,
  };
}

function getR2AssetConfig(): R2AssetConfig {
  const config = {
    accessKeyId: import.meta.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    accountId: import.meta.env.CLOUDFLARE_R2_ACCOUNT_ID,
    bucket: import.meta.env.CLOUDFLARE_R2_BUCKET,
    objectPrefix: import.meta.env.CLOUDFLARE_R2_OBJECT_PREFIX ?? DEFAULT_OBJECT_PREFIX,
    publicBaseUrl: import.meta.env.CLOUDFLARE_R2_PUBLIC_BASE_URL,
    secretAccessKey: import.meta.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  };

  const missing = [
    ["CLOUDFLARE_R2_ACCESS_KEY_ID", config.accessKeyId],
    ["CLOUDFLARE_R2_ACCOUNT_ID", config.accountId],
    ["CLOUDFLARE_R2_BUCKET", config.bucket],
    ["CLOUDFLARE_R2_OBJECT_PREFIX", config.objectPrefix],
    ["CLOUDFLARE_R2_PUBLIC_BASE_URL", config.publicBaseUrl],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", config.secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Cloudflare R2 asset config: ${missing.join(", ")}`);
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

function getThumbnailObjectKey(objectPrefix: string, id: string) {
  return `${trimSlashes(objectPrefix)}/${trimSlashes(id)}`;
}

function trimSlashes(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/g, "");
}

function encodeObjectKeyPath(objectKey: string) {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

function formatVersion(lastEditedTime: string) {
  return lastEditedTime.replace(/\D/g, "");
}
