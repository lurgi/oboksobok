import type { QueryDataSourceResponse } from "@notionhq/client";
import { Client as OfficialNotionClient } from "@notionhq/client";
import { NotionAPI } from "notion-client";
import { materializeNotionVideoAssetsToR2 } from "./r2NotionVideoAsset";
import { shouldUseR2Assets, uploadThumbnailToR2 } from "./r2ThumbnailAsset";

export type OboksobokNotionClientOptions = {
  integrationToken?: string;
  tokenV2?: string;
  activeUser?: string;
  essaysDatabaseId?: string;
};

export type EssayPageSummary = {
  authorName: string;
  id: string;
  notionPageId: string;
  published: boolean;
  thumbnail?: EssayPageThumbnail;
  title: string;
};

export type EssayPageThumbnail = {
  alt?: string;
  aspectRatio: EssayThumbnailAspectRatio;
  src: string;
};

export type EssayThumbnailAspectRatio = "1:1" | "3:4" | "4:3";

export type EssayPageWithRecordMap = {
  page: EssayPageSummary;
  recordMap: Awaited<ReturnType<NotionAPI["getPage"]>>;
};

type NotionDatabaseWithDataSources = {
  data_sources: Array<{ id: string }>;
};

type NotionPageWithProperties = {
  object: "page";
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
};

export class OboksobokNotionClient {
  readonly official: OfficialNotionClient;
  readonly essaysDatabaseId?: string;

  private readonly recordMapApi: NotionAPI;

  constructor(options: OboksobokNotionClientOptions = {}) {
    const integrationToken = options.integrationToken ?? import.meta.env.NOTION_INTEGRATION_TOKEN;
    const tokenV2 = options.tokenV2 ?? import.meta.env.NOTION_TOKEN_V2;
    const activeUser = options.activeUser ?? import.meta.env.NOTION_ACTIVE_USER;

    this.essaysDatabaseId = options.essaysDatabaseId ?? import.meta.env.NOTION_ESSAYS_DATABASE_ID;
    this.official = new OfficialNotionClient({ auth: integrationToken });
    this.recordMapApi = new NotionAPI({
      authToken: tokenV2,
      activeUser,
    });
  }

  async getFirstEssayPage(): Promise<EssayPageWithRecordMap> {
    const [page] = await this.getPublishedEssayPages();

    if (!page) {
      throw new Error('Notion data source returned no pages where "발행" is checked');
    }

    return page;
  }

  async getPublishedEssayPages(): Promise<EssayPageWithRecordMap[]> {
    const essaysDatabaseId = this.essaysDatabaseId;

    if (!essaysDatabaseId) {
      throw new Error("Missing NOTION_ESSAYS_DATABASE_ID");
    }

    const dataSourceId = await this.getEssaysDataSourceId(essaysDatabaseId);
    const pages = await this.getPublishedEssayPageObjects(dataSourceId);

    return Promise.all(
      pages.map(async (page) => {
        const id = extractRequiredPagePropertyId(page.properties);
        const recordMap = await this.getPageRecordMap(page.id);

        if (shouldUseR2Assets()) {
          await materializeNotionVideoAssetsToR2({
            lastEditedTime: page.last_edited_time,
            pageId: page.id,
            recordMap,
          });
        }

        return {
          page: {
            authorName: extractAuthorName(page.properties),
            id,
            notionPageId: page.id,
            published: extractRequiredPublishedValue(page.properties),
            thumbnail: await resolveThumbnail(page.properties, id, page.last_edited_time),
            title: extractTitle(page.properties),
          },
          recordMap,
        };
      }),
    );
  }

  private async getEssaysDataSourceId(essaysDatabaseId: string) {
    const database = await this.official.databases.retrieve({
      database_id: essaysDatabaseId,
    });
    const dataSourceId = getFirstDataSourceId(database);

    if (!dataSourceId) {
      throw new Error(`Notion database "${essaysDatabaseId}" has no data sources`);
    }

    return dataSourceId;
  }

  private async getPublishedEssayPageObjects(dataSourceId: string) {
    const pages: NotionPageWithProperties[] = [];
    let startCursor: string | undefined;

    do {
      const response: QueryDataSourceResponse = await this.official.dataSources.query({
        data_source_id: dataSourceId,
        filter: {
          property: "발행",
          checkbox: {
            equals: true,
          },
        },
        page_size: 100,
        result_type: "page",
        start_cursor: startCursor,
      });

      pages.push(...response.results.filter(isPageWithProperties));
      startCursor = response.next_cursor ?? undefined;
    } while (startCursor);

    return pages.filter((page) => extractRequiredPublishedValue(page.properties));
  }

  async getPageRecordMap(pageId: string) {
    return this.recordMapApi.getPage(pageId, {
      fetchCollections: false,
      signFileUrls: true,
    });
  }
}

export const notion = new OboksobokNotionClient();

function getFirstDataSourceId(database: unknown) {
  if (!isDatabaseWithDataSources(database)) {
    return undefined;
  }

  return database.data_sources[0]?.id;
}

function isDatabaseWithDataSources(database: unknown): database is NotionDatabaseWithDataSources {
  return (
    typeof database === "object" &&
    database !== null &&
    "data_sources" in database &&
    Array.isArray(database.data_sources)
  );
}

function isPageWithProperties(page: unknown): page is NotionPageWithProperties {
  return (
    typeof page === "object" &&
    page !== null &&
    "object" in page &&
    page.object === "page" &&
    "id" in page &&
    typeof page.id === "string" &&
    "last_edited_time" in page &&
    typeof page.last_edited_time === "string" &&
    "properties" in page &&
    typeof page.properties === "object" &&
    page.properties !== null
  );
}

function extractTitle(properties: Record<string, unknown>) {
  for (const property of Object.values(properties)) {
    if (isTitleProperty(property)) {
      return property.title.map((part) => part.plain_text).join("");
    }
  }

  return "Untitled";
}

function extractRequiredPagePropertyId(properties: Record<string, unknown>): string {
  const idProperty = findPropertyByName(properties, "id");

  if (!idProperty) {
    throw new Error('Notion page is missing required "id" property');
  }

  const value = extractPlainPropertyValue(idProperty);

  if (!value) {
    throw new Error('Notion page "id" property is empty');
  }

  return value;
}

function extractAuthorName(properties: Record<string, unknown>) {
  const authorProperty = findFirstPropertyByName(properties, ["작성자", "author"]);

  if (!authorProperty) {
    throw new Error('Notion page is missing required "작성자" property');
  }

  const value = extractAuthorPropertyValue(authorProperty);

  if (!value) {
    throw new Error('Notion page "작성자" property is empty');
  }

  return value;
}

function extractRequiredPublishedValue(properties: Record<string, unknown>) {
  const publishedProperty = findPropertyByName(properties, "발행");

  if (!publishedProperty) {
    throw new Error('Notion page is missing required "발행" property');
  }

  const value = extractCheckboxPropertyValue(publishedProperty);

  if (typeof value !== "boolean") {
    throw new Error('Notion page "발행" property must be a checkbox');
  }

  return value;
}

async function resolveThumbnail(
  properties: Record<string, unknown>,
  id: string,
  lastEditedTime: string,
): Promise<EssayPageThumbnail | undefined> {
  const thumbnailProperty = findFirstPropertyByName(properties, ["썸네일", "thumbnail"]);
  const file = extractFirstFileValue(thumbnailProperty);

  if (!file) {
    return undefined;
  }

  const aspectRatio = extractThumbnailAspectRatio(properties);

  if (file.source === "file" && shouldUseR2Assets()) {
    return {
      ...(await uploadThumbnailToR2({
        alt: file.alt,
        id,
        lastEditedTime,
        sourceUrl: file.src,
      })),
      aspectRatio,
    };
  }

  return {
    alt: file.alt,
    aspectRatio,
    src: file.src,
  };
}

function extractThumbnailAspectRatio(
  properties: Record<string, unknown>,
): EssayThumbnailAspectRatio {
  const ratioProperty = findFirstPropertyByName(properties, [
    "썸네일 비율",
    "thumbnail ratio",
    "thumbnail aspect ratio",
  ]);
  const value = extractSelectPropertyValue(ratioProperty);

  if (value?.startsWith("1:1")) {
    return "1:1";
  }

  if (value?.startsWith("3:4")) {
    return "3:4";
  }

  if (value?.startsWith("4:3")) {
    return "4:3";
  }

  return "1:1";
}

function findPropertyByName(properties: Record<string, unknown>, name: string) {
  const target = name.toLowerCase();

  for (const [propertyName, property] of Object.entries(properties)) {
    if (propertyName.toLowerCase() === target) {
      return property;
    }
  }

  return undefined;
}

function findFirstPropertyByName(properties: Record<string, unknown>, names: string[]) {
  const targets = new Set(names.map((name) => name.toLowerCase()));

  for (const [propertyName, property] of Object.entries(properties)) {
    if (targets.has(propertyName.toLowerCase())) {
      return property;
    }
  }

  return undefined;
}

function extractAuthorPropertyValue(property: unknown): string | undefined {
  if (!isTypedProperty(property)) {
    return undefined;
  }

  switch (property.type) {
    case "people":
      return extractPeopleNames(property.people);
    case "created_by":
      return extractUserName(property.created_by);
    default:
      return extractPlainPropertyValue(property);
  }
}

function extractPlainPropertyValue(property: unknown): string | undefined {
  if (!isTypedProperty(property)) {
    return undefined;
  }

  switch (property.type) {
    case "title":
      return extractRichTextValue(property.title);
    case "rich_text":
      return extractRichTextValue(property.rich_text);
    case "unique_id":
      return extractUniqueIdValue(property.unique_id);
    case "number":
      return typeof property.number === "number" ? String(property.number) : undefined;
    case "formula":
      return extractFormulaValue(property.formula);
    case "url":
    case "email":
    case "phone_number": {
      const value = property[property.type];

      return typeof value === "string" ? value : undefined;
    }
    default:
      return undefined;
  }
}

function extractCheckboxPropertyValue(property: unknown): boolean | undefined {
  if (!isTypedProperty(property) || property.type !== "checkbox") {
    return undefined;
  }

  return typeof property.checkbox === "boolean" ? property.checkbox : undefined;
}

function extractSelectPropertyValue(property: unknown): string | undefined {
  if (!isTypedProperty(property) || property.type !== "select" || !isSelectValue(property.select)) {
    return undefined;
  }

  return property.select.name.trim() || undefined;
}

function extractFirstFileValue(
  property: unknown,
): (Omit<EssayPageThumbnail, "aspectRatio"> & { source: "external" | "file" }) | undefined {
  if (!isTypedProperty(property) || property.type !== "files" || !Array.isArray(property.files)) {
    return undefined;
  }

  const [file] = property.files;

  if (!isFilePropertyValue(file)) {
    return undefined;
  }

  switch (file.type) {
    case "external":
      return typeof file.external.url === "string"
        ? { alt: file.name, source: "external", src: file.external.url }
        : undefined;
    case "file":
      return typeof file.file.url === "string"
        ? { alt: file.name, source: "file", src: file.file.url }
        : undefined;
    default:
      return undefined;
  }
}

function extractRichTextValue(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = value
    .map((part) => (isPlainTextPart(part) ? part.plain_text : ""))
    .join("")
    .trim();

  return text || undefined;
}

function extractPeopleNames(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const names = value.map(extractUserName).filter((name) => typeof name === "string");

  return names.length > 0 ? names.join(", ") : undefined;
}

function extractUserName(value: unknown): string | undefined {
  if (!isUserValue(value)) {
    return undefined;
  }

  return value.name?.trim() || undefined;
}

function extractUniqueIdValue(value: unknown): string | undefined {
  if (!isUniqueIdValue(value)) {
    return undefined;
  }

  if (value.prefix) {
    return `${value.prefix}-${value.number}`;
  }

  return String(value.number);
}

function extractFormulaValue(value: unknown): string | undefined {
  if (!isFormulaValue(value)) {
    return undefined;
  }

  switch (value.type) {
    case "string":
      return typeof value.string === "string" ? value.string.trim() || undefined : undefined;
    case "number":
      return typeof value.number === "number" ? String(value.number) : undefined;
    default:
      return undefined;
  }
}

function isTitleProperty(
  property: unknown,
): property is { type: "title"; title: Array<{ plain_text: string }> } {
  return (
    typeof property === "object" &&
    property !== null &&
    "type" in property &&
    property.type === "title" &&
    "title" in property &&
    Array.isArray(property.title)
  );
}

function isTypedProperty(
  property: unknown,
): property is Record<string, unknown> & { type: string } {
  return (
    typeof property === "object" &&
    property !== null &&
    "type" in property &&
    typeof property.type === "string"
  );
}

function isPlainTextPart(part: unknown): part is { plain_text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    "plain_text" in part &&
    typeof part.plain_text === "string"
  );
}

function isUserValue(value: unknown): value is { name: string | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    (typeof value.name === "string" || value.name === null)
  );
}

function isUniqueIdValue(value: unknown): value is { prefix: string | null; number: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "prefix" in value &&
    (typeof value.prefix === "string" || value.prefix === null) &&
    "number" in value &&
    typeof value.number === "number"
  );
}

function isFormulaValue(value: unknown): value is Record<string, unknown> & { type: string } {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

function isSelectValue(value: unknown): value is { name: string } {
  return (
    typeof value === "object" && value !== null && "name" in value && typeof value.name === "string"
  );
}

function isFilePropertyValue(
  value: unknown,
): value is
  | { name?: string; type: "external"; external: { url?: string } }
  | { name?: string; type: "file"; file: { url?: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value.type === "external" || value.type === "file") &&
    ((value.type === "external" &&
      "external" in value &&
      typeof value.external === "object" &&
      value.external !== null) ||
      (value.type === "file" &&
        "file" in value &&
        typeof value.file === "object" &&
        value.file !== null))
  );
}
