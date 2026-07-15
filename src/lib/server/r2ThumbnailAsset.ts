import sharp from "sharp";
import {
  buildR2PublicUrl,
  formatR2AssetVersion,
  putR2Object,
  shouldUseR2Assets,
  trimSlashes,
  withTransientRetry,
} from "./r2AssetStorage";

const DEFAULT_OBJECT_PREFIX = "notion/essays-thumbnails";
const JPEG_CONTENT_TYPE = "image/jpeg";
const JPEG_MAX_BYTES = 500 * 1024;
const JPEG_QUALITY_OPTIONS = [82, 76, 70, 64, 58, 52, 46, 40, 35, 30, 25];
const JPEG_WIDTH_OPTIONS = [1200, 1000, 800, 640, 480, 360];

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

export { shouldUseR2Assets };

export async function uploadThumbnailToR2({
  alt,
  id,
  lastEditedTime,
  sourceUrl,
}: R2ThumbnailAssetInput): Promise<R2ThumbnailAsset> {
  const objectKey = getThumbnailObjectKey(getThumbnailObjectPrefix(), id);
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Notion thumbnail for "${id}": ${response.status} ${response.statusText}`,
    );
  }

  const sourceBody = new Uint8Array(await response.arrayBuffer());
  const body = await optimizeThumbnail(sourceBody);

  await withTransientRetry(
    () =>
      putR2Object({
        body,
        contentType: JPEG_CONTENT_TYPE,
        objectKey,
      }),
    { label: `upload Notion thumbnail "${id}" to R2` },
  );

  return {
    alt,
    src: buildR2PublicUrl(objectKey, formatR2AssetVersion(lastEditedTime)),
  };
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

function getThumbnailObjectKey(objectPrefix: string, id: string) {
  return `${trimSlashes(objectPrefix)}/${trimSlashes(id)}.jpg`;
}

function getThumbnailObjectPrefix() {
  return import.meta.env.CLOUDFLARE_R2_OBJECT_PREFIX ?? DEFAULT_OBJECT_PREFIX;
}
