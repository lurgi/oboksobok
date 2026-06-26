import { NotionRenderer } from "react-notion-x";
import type { AssayPageWithRecordMap } from "../lib/server/notion";
import styles from "./NotionPage.module.css";

type NotionPageProps = {
  title: string;
  authorName: string;
  recordMap: AssayPageWithRecordMap["recordMap"];
  rootPageId: string;
};

export function NotionPage({ title, authorName, recordMap, rootPageId }: NotionPageProps) {
  return (
    <article className={`${styles.root} oboksobok-notion`} aria-labelledby="assay-title">
      <header className={styles.header}>
        <h1 id="assay-title">{title}</h1>
        <div className={styles.author}>
          <span className={styles.authorName}>{authorName}</span>
        </div>
        <hr className={styles.divider} />
      </header>
      <div>
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
