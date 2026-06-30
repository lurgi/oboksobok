import type { ReactNode } from "react";
import styles from "./EssayThumbnailGrid.module.css";

type EssayThumbnailGridProps = {
  children: ReactNode;
  className?: string;
};

export function EssayThumbnailGrid({ children, className }: EssayThumbnailGridProps) {
  return <div className={[styles.root, className].filter(Boolean).join(" ")}>{children}</div>;
}
