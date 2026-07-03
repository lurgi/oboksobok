/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  readonly CLOUDFLARE_R2_ACCOUNT_ID?: string;
  readonly CLOUDFLARE_R2_BUCKET?: string;
  readonly CLOUDFLARE_R2_OBJECT_PREFIX?: string;
  readonly CLOUDFLARE_R2_PUBLIC_BASE_URL?: string;
  readonly CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  readonly NOTION_INTEGRATION_TOKEN?: string;
  readonly NOTION_TOKEN_V2?: string;
  readonly NOTION_ACTIVE_USER?: string;
  readonly NOTION_ASSAYS_DATABASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
