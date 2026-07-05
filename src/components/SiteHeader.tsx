import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a className={styles.wordmark} href="/" aria-label="오복소복 홈">
        <span className={styles.wordmarkFrame}>
          <img src="/oboksobok-wordmark.svg" alt="" />
        </span>
      </a>
    </header>
  );
}
