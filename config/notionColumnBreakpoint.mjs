const NOTION_COLUMN_MEDIA_QUERY = `@media (max-width: 640px) {
  .notion-row {
    flex-direction: column;
  }

  .notion-row .notion-column {
    width: 100% !important;
  }

  .notion-row .notion-spacer {
    display: none;
  }
}`;

const REACT_NOTION_STYLES_PATH = /react-notion-x[/\\]src[/\\]styles\.css(?:\?.*)?$/;

export function notionColumnBreakpoint() {
  return {
    enforce: "pre",
    name: "notion-column-breakpoint",
    transform(code, id) {
      if (!REACT_NOTION_STYLES_PATH.test(id)) {
        return null;
      }

      const firstMatch = code.indexOf(NOTION_COLUMN_MEDIA_QUERY);
      const lastMatch = code.lastIndexOf(NOTION_COLUMN_MEDIA_QUERY);

      if (firstMatch === -1 || firstMatch !== lastMatch) {
        throw new Error("The react-notion-x column breakpoint styles have changed.");
      }

      return {
        code: code.replace(
          NOTION_COLUMN_MEDIA_QUERY,
          NOTION_COLUMN_MEDIA_QUERY.replace("max-width: 640px", "max-width: 560px"),
        ),
        map: null,
      };
    },
  };
}
