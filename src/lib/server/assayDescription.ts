import { getBlockValue, getPageContentBlockIds, getTextContent } from "notion-utils";
import type { AssayPageWithRecordMap } from "./notion";

const descriptionBlockTypes = new Set([
  "text",
  "quote",
  "bulleted_list",
  "numbered_list",
  "callout",
  "toggle",
]);

export function getAssayDescription(assay: AssayPageWithRecordMap) {
  const contentBlockIds = getPageContentBlockIds(assay.recordMap, assay.page.notionPageId);
  const text = contentBlockIds
    .map((blockId) => getBlockValue(assay.recordMap.block[blockId]))
    .filter((block) => block && descriptionBlockTypes.has(block.type))
    .map((block) => getTextContent(block?.properties?.title))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return truncateDescription(text || assay.page.title);
}

function truncateDescription(value: string) {
  if (value.length <= 160) {
    return value;
  }

  return `${value.slice(0, 157).trimEnd()}...`;
}
