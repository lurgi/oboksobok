import type { ReactNode } from "react";
import styles from "./HomePageLayout.module.css";
import { PageLayout } from "./PageLayout";

type HomePageLayoutProps = {
  children?: ReactNode;
};

export function HomePageLayout({ children }: HomePageLayoutProps) {
  return (
    <PageLayout className={styles.page}>
      <div className={styles.inner}>{children}</div>
    </PageLayout>
  );
}
