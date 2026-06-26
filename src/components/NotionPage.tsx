import { NotionRenderer } from "react-notion-x";
import type { AssayPageWithRecordMap } from "../lib/server/notion";
import styles from "./NotionPage.module.css";

type NotionPageProps = {
  title: string;
  recordMap: AssayPageWithRecordMap["recordMap"];
  rootPageId: string;
};

export function NotionPage({ title, recordMap, rootPageId }: NotionPageProps) {
  return (
    <article className={styles.root} aria-labelledby="assay-title">
      <header className={styles.header}>
        <p>오복소복</p>
        <h1 id="assay-title">{title}</h1>
      </header>
      <div className={styles.notion}>
        <NotionRenderer
          recordMap={recordMap}
          rootPageId={rootPageId}
          fullPage={false}
          darkMode={false}
        />
      </div>
    </article>
  );
}
