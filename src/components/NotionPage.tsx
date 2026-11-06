import { NotionRenderer } from "react-notion-x";
import type { EssayPageWithRecordMap } from "../lib/server/notion";
import { Divider } from "./Divider";
import styles from "./NotionPage.module.css";

type NotionPageProps = {
  title: string;
  authorName: string;
  recordMap: EssayPageWithRecordMap["recordMap"];
  rootPageId: string;
};

export function NotionPage({ title, authorName, recordMap, rootPageId }: NotionPageProps) {
  const name = authorName.trim();
  const displayName = Array.from(name).slice(1).join("") || name;

  return (
    <article className={`${styles.root} oboksobok-notion`} aria-labelledby="essay-title">
      <header className={styles.header}>
        <h1 id="essay-title">{title}</h1>
        <p className={styles.author}>{displayName}</p>
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
