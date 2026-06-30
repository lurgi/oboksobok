import type { ReactNode } from "react";
import styles from "./HomePageLayout.module.css";

type HomePageLayoutProps = {
  children?: ReactNode;
};

export function HomePageLayout({ children }: HomePageLayoutProps) {
  return (
    <main className={styles.root}>
      <div className={styles.inner}>{children}</div>
    </main>
  );
}
