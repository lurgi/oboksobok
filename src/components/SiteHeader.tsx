import { useEffect, useState } from "react";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let currentScrollState = window.scrollY > 12;

    const updateScrollState = () => {
      const nextScrollState = window.scrollY > 12;

      if (nextScrollState !== currentScrollState) {
        currentScrollState = nextScrollState;
        setIsScrolled(nextScrollState);
      }
    };

    setIsScrolled(currentScrollState);
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <a className={styles.wordmark} href="/" aria-label="오복소복 홈">
          <span className={styles.wordmarkFrame}>
            <img src="/oboksobok-wordmark.svg" alt="" />
          </span>
        </a>
      </div>
    </header>
  );
}
