import type { ReactNode } from "react";
import styles from "./PageLayout.module.css";

type PageLayoutProps = {
  children?: ReactNode;
  className?: string;
};

export function PageLayout({ children, className }: PageLayoutProps) {
  return <main className={[styles.page, className].filter(Boolean).join(" ")}>{children}</main>;
}
