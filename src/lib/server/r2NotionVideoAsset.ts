import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { ExtendedRecordMap, VideoBlock } from "notion-types";
import { getBlockValue } from "notion-utils";
import {
  buildR2PublicUrl,
  formatR2AssetVersion,
  NonRetryableAssetError,
  putR2Object,
  trimSlashes,
  withTransientRetry,
} from "./r2AssetStorage";

const DEFAULT_VIDEO_OBJECT_PREFIX = "notion/assays-videos";
const DEFAULT_VIDEO_CONTENT_TYPE = "video/mp4";
const EXTERNAL_VIDEO_HOST_PARTS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "wistia.com",
  "loom.com",
  "videoask.com",
  "getcloudapp.com",
  "tella.tv",
];

type MaterializeNotionVideoAssetsInput = {
  lastEditedTime: string;
  pageId: string;
  recordMap: ExtendedRecordMap;
};

export async function materializeNotionVideoAssetsToR2({
  lastEditedTime,
  pageId,
  recordMap,
}: MaterializeNotionVideoAssetsInput) {
  recordMap.signed_urls ??= {};

  for (const blockMapValue of Object.values(recordMap.block)) {
    const block = getBlockValue(blockMapValue);

    if (!isVideoBlock(block)) {
      continue;
    }

    const sourceUrl = getVideoSource(recordMap, block);

    if (!sourceUrl) {
      throw new NonRetryableAssetError(`Notion video block "${block.id}" has no source URL`);
    }

    if (isExternalVideoEmbedSource(sourceUrl) || !isNotionHostedFileSource(sourceUrl)) {
      continue;
    }

    recordMap.signed_urls[block.id] = await uploadVideoBlockToR2({
      block,
      lastEditedTime,
      pageId,
      sourceUrl,
    });
  }
}

type UploadVideoBlockInput = {
  block: VideoBlock;
  lastEditedTime: string;
  pageId: string;
  sourceUrl: string;
};

async function uploadVideoBlockToR2({
  block,
  lastEditedTime,
  pageId,
  sourceUrl,
}: UploadVideoBlockInput) {
  const version = formatR2AssetVersion(lastEditedTime);
  let objectKey = "";

  await withTransientRetry(
    async () => {
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        throwFetchError(sourceUrl, response);
      }

      if (!response.body) {
        throw new NonRetryableAssetError(`Notion video block "${block.id}" returned no body`);
      }

      const responseContentType = response.headers.get("content-type")?.split(";")[0]?.trim();
      const contentLength = getContentLength(response.headers.get("content-length"), block.id);
      const extension = getVideoExtension(sourceUrl, responseContentType);
      const contentType = getVideoContentType(responseContentType, extension);
      objectKey = getVideoObjectKey(pageId, block.id, extension);

      await putR2Object({
        body: Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
        contentLength,
        contentType,
        objectKey,
      });
    },
    { label: `materialize Notion video block "${block.id}" to R2` },
  );

  return buildR2PublicUrl(objectKey, version);
}

function getVideoSource(recordMap: ExtendedRecordMap, block: VideoBlock) {
  return recordMap.signed_urls?.[block.id] ?? block.properties?.source?.[0]?.[0];
}

function isVideoBlock(block: unknown): block is VideoBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "video" &&
    "id" in block &&
    typeof block.id === "string"
  );
}

function isExternalVideoEmbedSource(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();

    return EXTERNAL_VIDEO_HOST_PARTS.some(
      (hostPart) => hostname === hostPart || hostname.endsWith(`.${hostPart}`),
    );
  } catch {
    return false;
  }
}

function isNotionHostedFileSource(sourceUrl: string) {
  if (sourceUrl.startsWith("attachment:")) {
    return true;
  }

  try {
    const url = new URL(sourceUrl);
    const hostname = url.hostname.toLowerCase();
    const pathname = decodeURIComponent(url.pathname).toLowerCase();

    return (
      hostname === "file.notion.so" ||
      hostname === "img.notionusercontent.com" ||
      hostname.includes("notion-static.com") ||
      hostname.includes("prod-files-secure") ||
      pathname.includes("secure.notion-static.com") ||
      pathname.includes("prod-files-secure")
    );
  } catch {
    return false;
  }
}

function throwFetchError(sourceUrl: string, response: Response): never {
  const message = `Failed to download Notion video "${sourceUrl}": ${response.status} ${response.statusText}`;

  if (response.status === 403 || response.status === 404) {
    throw new NonRetryableAssetError(message);
  }

  throw new Error(message);
}

function getVideoObjectKey(pageId: string, blockId: string, extension: string) {
  return `${DEFAULT_VIDEO_OBJECT_PREFIX}/${trimSlashes(pageId)}/${trimSlashes(blockId)}.${extension}`;
}

function getVideoExtension(sourceUrl: string, contentType?: string) {
  const extensionFromUrl = getExtensionFromUrl(sourceUrl);

  if (extensionFromUrl) {
    return extensionFromUrl;
  }

  switch (contentType) {
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    case "video/webm":
      return "webm";
    case "video/ogg":
      return "ogv";
    case "video/mpeg":
      return "mpeg";
    default:
      return "mp4";
  }
}

function getExtensionFromUrl(sourceUrl: string) {
  try {
    const pathname = decodeURIComponent(new URL(sourceUrl).pathname);
    const extension = pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();

    if (extension && isKnownVideoExtension(extension)) {
      return extension;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getVideoContentType(contentType: string | undefined, extension: string) {
  if (contentType?.startsWith("video/")) {
    return contentType;
  }

  if (contentType && contentType !== "application/octet-stream") {
    throw new NonRetryableAssetError(`Expected Notion video content, received "${contentType}"`);
  }

  return getVideoContentTypeFromExtension(extension);
}

function getContentLength(contentLength: string | null, blockId: string) {
  const parsedContentLength = contentLength ? Number(contentLength) : undefined;

  if (
    typeof parsedContentLength !== "number" ||
    !Number.isSafeInteger(parsedContentLength) ||
    parsedContentLength <= 0
  ) {
    throw new NonRetryableAssetError(
      `Notion video block "${blockId}" response is missing a valid content-length`,
    );
  }

  return parsedContentLength;
}

function getVideoContentTypeFromExtension(extension: string) {
  switch (extension) {
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "ogv":
    case "ogg":
      return "video/ogg";
    case "mpeg":
    case "mpg":
      return "video/mpeg";
    default:
      return DEFAULT_VIDEO_CONTENT_TYPE;
  }
}

function isKnownVideoExtension(extension: string) {
  return ["mp4", "mov", "webm", "ogv", "ogg", "mpeg", "mpg", "m4v"].includes(extension);
}
