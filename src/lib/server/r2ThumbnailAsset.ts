import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const DEFAULT_OBJECT_PREFIX = "notion/essays-thumbnails";
const JPEG_CONTENT_TYPE = "image/jpeg";
const JPEG_MAX_BYTES = 500 * 1024;
const JPEG_QUALITY_OPTIONS = [82, 76, 70, 64, 58, 52, 46, 40, 35, 30, 25];
const JPEG_WIDTH_OPTIONS = [1200, 1000, 800, 640, 480, 360];
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

  const sourceBody = new Uint8Array(await response.arrayBuffer());
  const body = await optimizeThumbnail(sourceBody);

  await getR2Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucket,
      CacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      ContentType: JPEG_CONTENT_TYPE,
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

async function optimizeThumbnail(sourceBody: Uint8Array) {
  let smallestBody: Buffer | undefined;

  for (const quality of JPEG_QUALITY_OPTIONS) {
    for (const width of JPEG_WIDTH_OPTIONS) {
      const body = await sharp(sourceBody)
        .rotate()
        .resize({
          fit: "inside",
          height: width,
          withoutEnlargement: true,
          width,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({
          mozjpeg: true,
          progressive: true,
          quality,
        })
        .toBuffer();

      if (!smallestBody || body.byteLength < smallestBody.byteLength) {
        smallestBody = body;
      }

      if (body.byteLength < JPEG_MAX_BYTES) {
        return body;
      }
    }
  }

  return smallestBody ?? Buffer.from(sourceBody);
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
  return `${trimSlashes(objectPrefix)}/${trimSlashes(id)}.jpg`;
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
