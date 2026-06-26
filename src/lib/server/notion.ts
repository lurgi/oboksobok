import { Client as OfficialNotionClient } from "@notionhq/client";
import { NotionAPI } from "notion-client";

export type OboksobokNotionClientOptions = {
  integrationToken?: string;
  tokenV2?: string;
  activeUser?: string;
  assaysDatabaseId?: string;
};

export type AssayPageSummary = {
  id: string;
  title: string;
};

export type AssayPageWithRecordMap = {
  page: AssayPageSummary;
  recordMap: Awaited<ReturnType<NotionAPI["getPage"]>>;
};

type NotionDatabaseWithDataSources = {
  data_sources: Array<{ id: string }>;
};

type NotionPageWithProperties = {
  object: "page";
  id: string;
  properties: Record<string, unknown>;
};

export class OboksobokNotionClient {
  readonly official: OfficialNotionClient;
  readonly assaysDatabaseId?: string;

  private readonly recordMapApi: NotionAPI;

  constructor(options: OboksobokNotionClientOptions = {}) {
    const integrationToken = options.integrationToken ?? import.meta.env.NOTION_INTEGRATION_TOKEN;
    const tokenV2 = options.tokenV2 ?? import.meta.env.NOTION_TOKEN_V2;
    const activeUser = options.activeUser ?? import.meta.env.NOTION_ACTIVE_USER;

    this.assaysDatabaseId = options.assaysDatabaseId ?? import.meta.env.NOTION_ASSAYS_DATABASE_ID;
    this.official = new OfficialNotionClient({ auth: integrationToken });
    this.recordMapApi = new NotionAPI({
      authToken: tokenV2,
      activeUser,
    });
  }

  async getFirstAssayPage(): Promise<AssayPageWithRecordMap> {
    if (!this.assaysDatabaseId) {
      throw new Error("Missing NOTION_ASSAYS_DATABASE_ID");
    }

    const database = await this.official.databases.retrieve({
      database_id: this.assaysDatabaseId,
    });
    const dataSourceId = getFirstDataSourceId(database);

    if (!dataSourceId) {
      throw new Error(`Notion database "${this.assaysDatabaseId}" has no data sources`);
    }

    const response = await this.official.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 1,
      result_type: "page",
    });
    const page = response.results.find(isPageWithProperties);

    if (!page) {
      throw new Error(`Notion data source "${dataSourceId}" returned no pages`);
    }

    const recordMap = await this.getPageRecordMap(page.id);

    return {
      page: {
        id: page.id,
        title: extractTitle(page.properties),
      },
      recordMap,
    };
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
