/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly NOTION_INTEGRATION_TOKEN?: string;
  readonly NOTION_TOKEN_V2?: string;
  readonly NOTION_ACTIVE_USER?: string;
  readonly NOTION_ASSAYS_DATABASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
