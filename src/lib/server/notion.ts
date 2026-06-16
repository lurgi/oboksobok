import { Client as OfficialNotionClient } from "@notionhq/client";
import { NotionAPI } from "notion-client";

export type OboksobokNotionClientOptions = {
  token?: string;
  databaseId?: string;
};

export class OboksobokNotionClient {
  readonly official: OfficialNotionClient;
  readonly databaseId?: string;

  private readonly recordMapApi: NotionAPI;

  constructor(options: OboksobokNotionClientOptions = {}) {
    const token = options.token ?? import.meta.env.NOTION_TOKEN;

    this.databaseId = options.databaseId ?? import.meta.env.NOTION_DATABASE_ID;
    this.official = new OfficialNotionClient({ auth: token });
    this.recordMapApi = new NotionAPI();
  }

  async getPageRecordMap(pageId: string) {
    return this.recordMapApi.getPage(pageId);
  }
}

export const notion = new OboksobokNotionClient();
