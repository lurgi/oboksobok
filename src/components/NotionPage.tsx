import { NotionRenderer } from "react-notion-x";
import type { AssayPageWithRecordMap } from "../lib/server/notion";
import { Divider } from "./Divider";
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
        <div className={styles.author}>{authorName}</div>
        <Divider />
      </header>
      <div>
        <NotionRenderer
          recordMap={recordMap}
          rootPageId={rootPageId}
          fullPage={false}
          darkMode={false}
          previewImages={true}
        />
      </div>
    </article>
  );
}
