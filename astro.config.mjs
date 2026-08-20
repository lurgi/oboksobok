import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { notionColumnBreakpoint } from "./config/notionColumnBreakpoint.mjs";

export default defineConfig({
  integrations: [react(), sitemap()],
  site: "https://oboksobok.com",
  vite: {
    plugins: [notionColumnBreakpoint()],
  },
});
